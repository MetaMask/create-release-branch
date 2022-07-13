import fs from 'fs';
import YAML from 'yaml';
import execa from 'execa';
import { Editor } from './editor-utils';
import { debug, hasProperty, isErrorWithMessage, isObject } from './misc-utils';
import { Project } from './project-utils';
import { isValidSemver, semver, SemVer } from './semver-utils';

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
 */
export interface ReleaseSpecification {
  packages: Record<string, VersionSpecifier>;
}

/**
 * Generates a file that can be used to specify how a project should be updated.
 *
 * @param args - The set of arguments to this function.
 * @param args.project - Information about the project.
 * @param args.tempDirectoryPath - The path to a temporary directory in which to
 * write the file.
 * @param args.releaseSpecificationPath - The path to the file that will be written.
 * @param args.isEditorAvailable - Whether or not an executable can be found on
 * the user's computer to edit the release spec once it is generated.
 */
export async function generateReleaseSpecificationForMonorepo({
  project: { rootPackage, workspacePackages },
  tempDirectoryPath,
  releaseSpecificationPath,
  isEditorAvailable,
}: {
  project: Project;
  tempDirectoryPath: string;
  releaseSpecificationPath: string;
  isEditorAvailable: boolean;
}) {
  const afterEditingInstructions = isEditorAvailable
    ? `
# When you're finished making your selections, save this file and the script
# will continue automatically.`.trim()
    : `
# When you're finished making your selections, save this file and then re-run
# the script that generated this file.`.trim();

  const instructions = `
# The following is a list of packages in ${rootPackage.manifest.name}.
# Please indicate the packages for which you want to create a new release
# by updating "null" (which does nothing) to one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
# - null (to skip the package entirely)
#
${afterEditingInstructions}
  `.trim();

  const packages = Object.values(workspacePackages).reduce((obj, pkg) => {
    return { ...obj, [pkg.manifest.name]: null };
  }, {});

  const releaseSpecificationContents = [
    instructions,
    YAML.stringify({ packages }),
  ].join('\n\n');

  // TODO: Use file-utils for this instead of just straight fs.promises so that
  // if there are any errors, correct stacktraces areproduced
  await fs.promises.mkdir(tempDirectoryPath, { recursive: true });
  await fs.promises.writeFile(
    releaseSpecificationPath,
    releaseSpecificationContents,
  );
}

/**
 * Launches the given editor to allow the user to update the release spec
 * file.
 *
 * @param releaseSpecificationPath - The path to the release spec file.
 * @param editor - Information about the editor.
 * @returns A promise that resolves when the user has completed editing the
 * file, i.e. when the editor process completes.
 */
export async function waitForUserToEditReleaseSpecification(
  releaseSpecificationPath: string,
  editor: Editor,
) {
  debug(
    `Opening release spec file ${releaseSpecificationPath} with editor ${editor.path}...`,
  );

  const promiseForEditorCommand = execa(
    editor.path,
    [...editor.args, releaseSpecificationPath],
    {
      stdio: 'inherit',
      shell: true,
    },
  );

  process.stdout.write('Waiting for the release spec to be edited...');

  try {
    await promiseForEditorCommand;

    // Clear the previous line
    process.stdout.write('\r\u001B[K');
  } catch (error) {
    // Clear the previous line
    process.stdout.write('\r\u001B[K');

    // TODO: This is divorced from generating the release spec file, move
    // somewhere else?
    await fs.promises.rm(releaseSpecificationPath, { force: true });

    const message = isErrorWithMessage(error) ? error.message : error;
    throw new Error(
      `Encountered an error while waiting for the release spec to be edited: ${message}`,
    );
  }
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
  const workspacePackageNames = Object.values(project.workspacePackages).map(
    (pkg) => pkg.manifest.name,
  );
  const releaseSpecificationContents = await fs.promises.readFile(
    releaseSpecificationPath,
    'utf8',
  );
  const indexOfFirstUsableLine = releaseSpecificationContents
    .split('\n')
    .findIndex((line) => !/^#|[ ]+/u.test(line));

  let unvalidatedReleaseSpecification: {
    packages: Record<string, string | null>;
  };

  try {
    unvalidatedReleaseSpecification = YAML.parse(releaseSpecificationContents);
  } catch (error) {
    const message = isErrorWithMessage(error) ? error.message : error;
    throw new Error(
      [
        'Failed to parse release spec:',
        message,
        "The file has been retained for you to make the necessary fixes. Once you've done this, re-run this script.",
        releaseSpecificationPath,
      ].join('\n\n'),
    );
  }

  const postludeForAllErrorMessages = [
    "The release spec file has been retained for you to make the necessary fixes. Once you've done this, re-run this script.",
    releaseSpecificationPath,
  ].join('\n\n');

  if (!isObject(unvalidatedReleaseSpecification)) {
    const message = [
      `Your release spec could not be processed because it needs to be an object with a \`packages\` property. The value of \`packages\` must itself be an object, where each key is a package in the file and each value is a version specifier ("major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1.2.3").`,
      `Here is the parsed version of the file you provided:`,
      JSON.stringify(unvalidatedReleaseSpecification, null, 2),
      postludeForAllErrorMessages,
    ].join('\n\n');
    throw new Error(message);
  }

  const errors: { message: string | string[]; lineNumber: number }[] = [];
  Object.keys(unvalidatedReleaseSpecification.packages).forEach(
    (packageName, index) => {
      const versionSpecifier =
        unvalidatedReleaseSpecification.packages[packageName];
      const lineNumber = indexOfFirstUsableLine + index + 2;

      if (!workspacePackageNames.includes(packageName)) {
        errors.push({
          message: `${JSON.stringify(
            packageName,
          )} is not a package in the project`,
          lineNumber,
        });
      }

      if (
        versionSpecifier !== null &&
        !hasProperty(IncrementableVersionParts, versionSpecifier) &&
        !isValidSemver(versionSpecifier)
      ) {
        errors.push({
          message: [
            `${JSON.stringify(
              versionSpecifier,
            )} is not a valid version specifier for "${packageName}"`,
            `(must be "major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1.2.3")`,
          ],
          lineNumber,
        });
      }
    },
  );

  if (errors.length > 0) {
    const message = [
      'Your release spec could not be processed due to the following issues:',
      errors
        .flatMap((error) => {
          const itemPrefix = '- ';
          const lineNumberPrefix = `Line ${error.lineNumber}: `;

          if (Array.isArray(error.message)) {
            return [
              `${itemPrefix}${lineNumberPrefix}${error.message[0]}`,
              ...error.message.slice(1).map((line) => {
                const spaces = [];

                for (
                  let i = 0;
                  i < itemPrefix.length + lineNumberPrefix.length;
                  i += 1
                ) {
                  spaces[i] = ' ';
                }

                const indentation = spaces.join('');
                return `${indentation}${line}`;
              }),
            ];
          }

          return `${itemPrefix}${lineNumberPrefix}${error.message}`;
        })
        .join('\n'),
      postludeForAllErrorMessages,
    ].join('\n\n');
    throw new Error(message);
  }

  const packages = Object.keys(unvalidatedReleaseSpecification.packages).reduce(
    (obj, packageName) => {
      const versionSpecifier =
        unvalidatedReleaseSpecification.packages[packageName];

      if (versionSpecifier) {
        switch (versionSpecifier) {
          // TODO: Any way to avoid this?
          case IncrementableVersionParts.major:
          case IncrementableVersionParts.minor:
          case IncrementableVersionParts.patch:
            return { ...obj, [packageName]: versionSpecifier };
          default:
            return {
              ...obj,
              // Typecast: We know that this will safely parse.
              [packageName]: semver.parse(versionSpecifier) as SemVer,
            };
        }
      }

      return obj;
    },
    {} as ReleaseSpecification['packages'],
  );

  return { packages };
}
