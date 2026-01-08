import fs, { WriteStream } from 'fs';
import YAML from 'yaml';
import { diff } from 'semver';
import { Editor } from './editor.js';
import { readFile } from './fs.js';
import {
  debug,
  hasProperty,
  wrapError,
  isObject,
  runCommand,
} from './misc-utils.js';
import { Project } from './project.js';
import { isValidSemver, semver, SemVer } from './semver.js';
import { Package } from './package.js';

/**
 * The SemVer-compatible parts of a version string that can be bumped by this
 * tool.
 */
export enum IncrementableVersionParts {
  major = 'major',
  minor = 'minor',
  patch = 'patch',
}

/**
 * Describes how to update the version for a package, either by bumping a part
 * of the version or by setting that version exactly.
 */
type VersionSpecifier = IncrementableVersionParts | SemVer;

/**
 * User-provided instructions for how to update this project in order to prepare
 * it for a new release.
 *
 * @property packages - A mapping of package names to version specifiers.
 * @property path - The path to the original release specification file.
 */
export type ReleaseSpecification = {
  packages: Record<string, VersionSpecifier>;
  path: string;
};

const SKIP_PACKAGE_DIRECTIVE = null;
const INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE = 'intentionally-skip';

/**
 * Generates a skeleton for a release specification, which describes how a
 * project should be updated.
 *
 * @param args - The set of arguments to this function.
 * @param args.project - Information about the project.
 * @param args.isEditorAvailable - Whether or not an executable can be found on
 * the user's computer to edit the release spec once it is generated.
 * @returns The release specification template.
 */
export async function generateReleaseSpecificationTemplateForMonorepo({
  project: { workspacePackages },
  isEditorAvailable,
}: {
  project: Project;
  isEditorAvailable: boolean;
}) {
  const afterEditingInstructions = isEditorAvailable
    ? `
# When you're finished, save this file and close it. The tool will update the
# versions of the packages you've listed and will move the changelog entries to
# a new section.`.trim()
    : `
# When you're finished, save this file and then run create-release-branch again.
# The tool will update the versions of the packages you've listed and will move
# the changelog entries to a new section.`.trim();

  const instructions = `
# This file (called the "release spec") allows you to specify which packages you
# want to include in this release along with the new versions they should
# receive.
#
# By default, all packages which have changed since their latest release are
# listed here. You can choose not to publish a package by removing it from this
# list.
#
# For each package you *do* want to release, you will need to specify how that
# version should be changed depending on the impact of the changes that will go
# into the release. To help you make this decision, all of the changes have been
# automatically added to the changelog for the package. This has been done
# in a new commit, so you can keep this file open, run \`git show\` in the
# terminal, review the set of changes, then return to this file to specify the
# version.
#
# A version specifier (the value that goes after each package in the list below)
# can be one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
#
${afterEditingInstructions}
  `.trim();

  const changedWorkspacePackages = Object.values(workspacePackages).filter(
    (pkg) => pkg.hasChangesSinceLatestRelease,
  );

  if (changedWorkspacePackages.length === 0) {
    throw new Error(
      'Could not generate release specification: There are no packages that have changed since their latest release.',
    );
  }

  const packages = changedWorkspacePackages.reduce((obj, pkg) => {
    return { ...obj, [pkg.validatedManifest.name]: SKIP_PACKAGE_DIRECTIVE };
  }, {});

  return [instructions, YAML.stringify({ packages })].join('\n\n');
}

/**
 * Launches the given editor to allow the user to update the release spec
 * file.
 *
 * @param releaseSpecificationPath - The path to the release spec file.
 * @param editor - Information about the editor.
 * @param stdout - A stream that can be used to write to standard out. Defaults
 * to /dev/null.
 * @returns A promise that resolves when the user has completed editing the
 * file, i.e. when the editor process completes.
 */
export async function waitForUserToEditReleaseSpecification(
  releaseSpecificationPath: string,
  editor: Editor,
  stdout: Pick<WriteStream, 'write'> = fs.createWriteStream('/dev/null'),
) {
  let caughtError: unknown;

  debug(
    `Opening release spec file ${releaseSpecificationPath} with editor located at ${editor.path}...`,
  );

  const promiseForEditorCommand = runCommand(
    editor.path,
    [...editor.args, releaseSpecificationPath],
    {
      stdio: 'inherit',
      shell: true,
    },
  );

  stdout.write('Waiting for the release spec to be edited...');

  try {
    await promiseForEditorCommand;
  } catch (error) {
    caughtError = error;
  }

  // Clear the previous line
  stdout.write('\r\u001B[K');

  if (caughtError) {
    throw wrapError(
      'Encountered an error while waiting for the release spec to be edited.',
      caughtError,
    );
  }
}

/**
 * Finds all workspace packages that have the given package under a particular
 * "dependencies" section.
 *
 * @param project - The project containing workspace packages.
 * @param packageName - The name of the package to find dependents for.
 * @param type - The section in which to look for the package.
 * @returns An array of package names.
 */
export function findWorkspaceDependentNamesOfType(
  project: Project,
  packageName: string,
  type: 'dependencies' | 'peerDependencies',
): string[] {
  return Object.keys(project.workspacePackages).filter(
    (possibleDependentName) => {
      const possibleDependent =
        project.workspacePackages[possibleDependentName];
      return hasProperty(
        possibleDependent.validatedManifest[type],
        packageName,
      );
    },
  );
}

/**
 * Finds all workspace packages that list the package in a particular
 * "dependencies" section but are missing from the release spec.
 *
 * @param project - The project containing workspace packages.
 * @param packageName - The name of the package to find dependents for.
 * @param unvalidatedReleaseSpecificationPackages - The packages in the release
 * specification.
 * @param type - The type of dependents to find for.
 * @returns An array of package names.
 */
export function findMissingWorkspaceDependentNamesOfType(
  project: Project,
  packageName: string,
  unvalidatedReleaseSpecificationPackages: Record<string, string | null>,
  type: 'dependencies' | 'peerDependencies',
): string[] {
  const dependentNames = findWorkspaceDependentNamesOfType(
    project,
    packageName,
    type,
  );

  return dependentNames.filter((dependentName) => {
    return !unvalidatedReleaseSpecificationPackages[dependentName];
  });
}

/**
 * Finds all workspace packages that are direct or peer dependencies of the
 * given package and have changes since their latest release.
 *
 * @param project - The project containing workspace packages.
 * @param changedPackage - The package to find dependencies for.
 * @param unvalidatedReleaseSpecificationPackages - The packages in the release
 * specification.
 * @returns An array of package names.
 */
function findMissingUnreleasedDependencies(
  project: Project,
  changedPackage: Package,
  unvalidatedReleaseSpecificationPackages: Record<string, string | null>,
): string[] {
  return Object.keys({
    ...changedPackage.validatedManifest.dependencies,
    ...changedPackage.validatedManifest.peerDependencies,
  }).filter((dependency) => {
    return (
      project.workspacePackages[dependency]?.hasChangesSinceLatestRelease &&
      !unvalidatedReleaseSpecificationPackages[dependency]
    );
  });
}

/**
 * Finds the direct or peer dependents of a major-bumped package that are
 * candidates for inclusion in the release.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param packageName - The name of the package to validate.
 * @param versionSpecifierOrDirective - The version specifier or directive for
 * the package.
 * @param unvalidatedReleaseSpecificationPackages - The packages in the release
 * specification.
 * @param type - The type of dependents to search for.
 * @returns An array of direct dependents for the package.
 */
export function findCandidateDependentsOfTypeForMajorBump(
  project: Project,
  packageName: string,
  versionSpecifierOrDirective: string | null,
  unvalidatedReleaseSpecificationPackages: Record<string, string | null>,
  type: 'dependencies' | 'peerDependencies',
): string[] {
  const changedPackage = project.workspacePackages[packageName];

  if (
    versionSpecifierOrDirective === 'major' ||
    (isValidSemver(versionSpecifierOrDirective) &&
      diff(
        changedPackage.validatedManifest.version,
        versionSpecifierOrDirective,
      ) === 'major')
  ) {
    return findMissingWorkspaceDependentNamesOfType(
      project,
      packageName,
      unvalidatedReleaseSpecificationPackages,
      type,
    );
  }

  return [];
}

/**
 * For a package being included in the release, finds all direct peer or
 * dependencies that have changes since their last release but have not been
 * added to the release yet.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param changedPackage - The package to validate.
 * @param versionSpecifierOrDirective - The version specifier or directive for the package.
 * @param unvalidatedReleaseSpecificationPackages - The packages in the release specification.
 * @returns An array of validation errors, if any.
 */
export function findCandidateDependencies(
  project: Project,
  changedPackage: Package,
  versionSpecifierOrDirective: string | null,
  unvalidatedReleaseSpecificationPackages: Record<string, string | null>,
): string[] {
  if (
    changedPackage &&
    versionSpecifierOrDirective &&
    (hasProperty(IncrementableVersionParts, versionSpecifierOrDirective) ||
      isValidSemver(versionSpecifierOrDirective))
  ) {
    return findMissingUnreleasedDependencies(
      project,
      changedPackage,
      unvalidatedReleaseSpecificationPackages,
    );
  }

  return [];
}

/**
 * Validates all package entries in the release specification.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param unvalidatedReleaseSpecificationPackages - The packages in the release specification.
 * @param indexOfFirstUsableLine - The index of the first non-comment, non-whitespace line
 * in the release spec.
 * @returns An array of validation errors, if any.
 */
export function validateAllPackageEntries(
  project: Project,
  unvalidatedReleaseSpecificationPackages: Record<string, string | null>,
  indexOfFirstUsableLine: number,
): { message: string | string[]; lineNumber?: number }[] {
  const errors: { message: string | string[]; lineNumber?: number }[] = [];

  Object.entries(unvalidatedReleaseSpecificationPackages).forEach(
    ([changedPackageName, versionSpecifierOrDirective], index) => {
      const lineNumber = indexOfFirstUsableLine + index + 2;
      const changedPackage = project.workspacePackages[changedPackageName];

      if (changedPackage === undefined) {
        errors.push({
          message: `${JSON.stringify(changedPackageName)} is not a package in the project`,
          lineNumber,
        });
      }

      if (
        versionSpecifierOrDirective !== SKIP_PACKAGE_DIRECTIVE &&
        versionSpecifierOrDirective !== INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE &&
        !hasProperty(IncrementableVersionParts, versionSpecifierOrDirective) &&
        !isValidSemver(versionSpecifierOrDirective)
      ) {
        errors.push({
          message: [
            `${JSON.stringify(versionSpecifierOrDirective)} is not a valid version specifier for package "${changedPackageName}"`,
            `(must be "major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1.2.3")`,
          ],
          lineNumber,
        });
      }

      if (isValidSemver(versionSpecifierOrDirective)) {
        const comparison = new SemVer(versionSpecifierOrDirective).compare(
          changedPackage.validatedManifest.version,
        );

        if (comparison === 0) {
          errors.push({
            message: [
              `${JSON.stringify(versionSpecifierOrDirective)} is not a valid version specifier for package "${changedPackageName}"`,
              `("${changedPackageName}" is already at version "${versionSpecifierOrDirective}")`,
            ],
            lineNumber,
          });
        } else if (comparison < 0) {
          errors.push({
            message: [
              `${JSON.stringify(versionSpecifierOrDirective)} is not a valid version specifier for package "${changedPackageName}"`,
              `("${changedPackageName}" is at a greater version "${project.workspacePackages[changedPackageName].validatedManifest.version}")`,
            ],
            lineNumber,
          });
        }
      }

      const missingDirectDependentNames =
        findCandidateDependentsOfTypeForMajorBump(
          project,
          changedPackageName,
          versionSpecifierOrDirective,
          unvalidatedReleaseSpecificationPackages,
          'dependencies',
        );

      if (missingDirectDependentNames.length > 0) {
        errors.push({
          message: [
            `The following direct dependents of package '${changedPackageName}', which is being released with a major version bump, are missing from the release spec.`,
            missingDirectDependentNames
              .map((dependent) => `  - ${dependent}`)
              .join('\n'),
            `  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.`,
            `  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:`,
            YAML.stringify({
              packages: missingDirectDependentNames.reduce(
                (object, dependent) => ({
                  ...object,
                  [dependent]: INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE,
                }),
                {},
              ),
            })
              .trim()
              .split('\n')
              .map((line) => `    ${line}`)
              .join('\n'),
          ].join('\n\n'),
        });
      }

      const missingPeerDependentNames =
        findCandidateDependentsOfTypeForMajorBump(
          project,
          changedPackageName,
          versionSpecifierOrDirective,
          unvalidatedReleaseSpecificationPackages,
          'peerDependencies',
        );

      if (missingPeerDependentNames.length > 0) {
        errors.push({
          message: [
            `The following dependents of package '${changedPackageName}', which is being released with a major version bump, are missing from the release spec.`,
            missingPeerDependentNames
              .map((dependent) => `  - ${dependent}`)
              .join('\n'),
            `  Consider including them in the release spec so that they are compatible with the new '${changedPackageName}' version.`,
            `  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:`,
            YAML.stringify({
              packages: missingPeerDependentNames.reduce(
                (object, dependent) => ({
                  ...object,
                  [dependent]: INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE,
                }),
                {},
              ),
            })
              .trim()
              .split('\n')
              .map((line) => `    ${line}`)
              .join('\n'),
          ].join('\n\n'),
        });
      }

      const missingDependencies = findCandidateDependencies(
        project,
        changedPackage,
        versionSpecifierOrDirective,
        unvalidatedReleaseSpecificationPackages,
      );

      if (missingDependencies.length > 0) {
        errors.push({
          message: [
            `The following packages, which are dependencies or peer dependencies of the package '${changedPackageName}' being released, are missing from the release spec.`,
            missingDependencies
              .map((dependency) => `  - ${dependency}`)
              .join('\n'),
            `  These packages may have changes that '${changedPackageName}' relies upon. Consider including them in the release spec.`,
            `  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:`,
            YAML.stringify({
              packages: missingDependencies.reduce(
                (object, dependency) => ({
                  ...object,
                  [dependency]: INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE,
                }),
                {},
              ),
            })
              .trim()
              .split('\n')
              .map((line) => `    ${line}`)
              .join('\n'),
          ].join('\n\n'),
        });
      }
    },
  );

  return errors;
}

/**
 * Looks over the release spec that the user has edited to ensure that:
 *
 * 1. the names of all packages match those within the project; and
 * 2. the version specifiers for each package are valid.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param releaseSpecificationPath - The path to the release spec file.
 * @returns The validated release spec.
 * @throws If there are any issues with the file.
 */
export async function validateReleaseSpecification(
  project: Project,
  releaseSpecificationPath: string,
): Promise<ReleaseSpecification> {
  const releaseSpecificationContents = await readFile(releaseSpecificationPath);
  const indexOfFirstUsableLine = releaseSpecificationContents
    .split('\n')
    .findIndex((line) => !/^#|[ ]+/u.test(line));

  let unvalidatedReleaseSpecification: {
    packages: Record<string, string | null>;
  };

  const afterwordForAllErrorMessages = [
    "The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.",
    releaseSpecificationPath,
  ].join('\n\n');

  try {
    unvalidatedReleaseSpecification = YAML.parse(releaseSpecificationContents);
  } catch (error) {
    throw wrapError(
      [
        'Your release spec does not appear to be valid YAML.',
        afterwordForAllErrorMessages,
      ].join('\n\n'),
      error,
    );
  }

  if (
    !isObject(unvalidatedReleaseSpecification) ||
    unvalidatedReleaseSpecification.packages === undefined
  ) {
    const message = [
      `Your release spec could not be processed because it needs to be an object with a \`packages\` property. The value of \`packages\` must itself be an object, where each key is a workspace package in the project and each value is a version specifier ("major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1.2.3").`,
      `Here is the parsed version of the file you provided:`,
      JSON.stringify(unvalidatedReleaseSpecification, null, 2),
      afterwordForAllErrorMessages,
    ].join('\n\n');
    throw new Error(message);
  }

  const errors = validateAllPackageEntries(
    project,
    unvalidatedReleaseSpecification.packages,
    indexOfFirstUsableLine,
  );

  if (errors.length > 0) {
    const message = [
      'Your release spec could not be processed due to the following issues:',
      errors
        .flatMap((error) => {
          const itemPrefix = '* ';

          if (error.lineNumber === undefined) {
            return `${itemPrefix}${error.message}`;
          }

          const lineNumberPrefix = `Line ${error.lineNumber}: `;

          if (Array.isArray(error.message)) {
            return [
              `${itemPrefix}${lineNumberPrefix}${error.message[0]}`,
              ...error.message.slice(1).map((line) => {
                const indentedLineLength =
                  itemPrefix.length + lineNumberPrefix.length + line.length;
                return line.padStart(indentedLineLength, ' ');
              }),
            ];
          }

          return `${itemPrefix}${lineNumberPrefix}${error.message}`;
        })
        .join('\n'),
      afterwordForAllErrorMessages,
    ].join('\n\n');
    throw new Error(message);
  }

  const packages = Object.keys(unvalidatedReleaseSpecification.packages).reduce(
    (obj, packageName) => {
      const versionSpecifierOrDirective =
        unvalidatedReleaseSpecification.packages[packageName];

      if (
        versionSpecifierOrDirective !== SKIP_PACKAGE_DIRECTIVE &&
        versionSpecifierOrDirective !== INTENTIONALLY_SKIP_PACKAGE_DIRECTIVE
      ) {
        if (
          Object.values(IncrementableVersionParts).includes(
            // Typecast: It doesn't matter what type versionSpecifierOrDirective
            // is as we are checking for inclusion.
            versionSpecifierOrDirective as any,
          )
        ) {
          return {
            ...obj,
            // Typecast: We know what this is as we've checked it above.
            [packageName]:
              versionSpecifierOrDirective as IncrementableVersionParts,
          };
        }

        return {
          ...obj,
          // Typecast: We know that this will safely parse.
          [packageName]: semver.parse(versionSpecifierOrDirective) as SemVer,
        };
      }

      return obj;
    },
    {} as ReleaseSpecification['packages'],
  );

  return { packages, path: releaseSpecificationPath };
}
