import fs from 'fs';
import path from 'path';
import execa from 'execa';
import YAML from 'yaml';
import rimraf from 'rimraf';
import { debug, hasProperty, isErrorWithMessage, isObject } from './utils';
import { fileExists } from './file-utils';
import { determineEditor, Editor } from './editor-utils';
import { updatePackage } from './package-utils';
import { Project } from './project-utils';
import { isValidSemver, semver, SemVer } from './semver-utils';
import {
  captureChangesInReleaseBranch,
  PackageReleasePlan,
  ReleasePlan,
} from './workflow-utils';

enum IncrementableVersionParts {
  major = 'major',
  minor = 'minor',
  patch = 'patch',
}

interface ReleaseSpecification {
  packages: Record<string, IncrementableVersionParts | SemVer>;
}

/**
 * For a monorepo, the process works like this:
 *
 * - The script generates a release spec template, listing the workspace
 *   packages in the project that have changed since the last release (or all of
 *   the packages if this would be the first release).
 * - The script then presents the template to the user so that they can specify
 *   the desired versions for each package. It first does this by attempting to
 *   locate an appropriate code editor on the user's computer (using the
 *   `EDITOR` environment variable if that is defined, otherwise `code` if it is
 *   present) and opening the file there, pausing while the user is editing the
 *   file. If no editor can be found, the script provides the user with the path
 *   to the template so that they can edit it themselves, then exits.
 * - However the user has edited the file, the script will parse and validate
 *   the information in the file, then apply the desired changes to the
 *   monorepo.
 * - Finally, once it has made the desired changes, the script will create a Git
 *   commit that includes the changes, then create a branch using the current
 *   date as the name.
 *
 * @param project - Information about the project.
 * @param tempDirectory - A directory in which to hold the generated release
 * spec file.
 * @param options - The options.
 * @param options.firstRemovingExistingReleaseSpecification - If true, removes
 * an existing release specification that was created in a previous run.
 */
export async function followMonorepoWorkflow(
  project: Project,
  tempDirectory: string,
  {
    firstRemovingExistingReleaseSpecification,
  }: { firstRemovingExistingReleaseSpecification: boolean },
) {
  const releaseSpecificationPath = path.join(tempDirectory, 'RELEASE_SPEC');

  if (
    firstRemovingExistingReleaseSpecification &&
    (await fileExists(releaseSpecificationPath))
  ) {
    await new Promise((resolve) => {
      rimraf(releaseSpecificationPath, resolve);
    });
  }

  if (await fileExists(releaseSpecificationPath)) {
    console.log(
      'Release spec already exists. Picking back up from previous run.',
    );
    // TODO: If we end up here, then we will probably get an error later when
    // attempting to bump versions of packages, as that may have already
    // happened — we need to be idempotent
  } else {
    const editor = await determineEditor();

    await generateReleaseSpecForMonorepo({
      project,
      tempDirectory,
      releaseSpecificationPath,
      isEditorAvailable: editor !== undefined,
    });

    if (!editor) {
      console.log(
        [
          'A template has been generated that specifies this release. Please open the following file in your editor of choice, then re-run this script:',
          `${releaseSpecificationPath}`,
        ].join('\n\n'),
      );
      return;
    }

    await waitForUserToEditReleaseSpecification(
      releaseSpecificationPath,
      editor,
    );
  }

  const releaseSpecification = await validateReleaseSpecification(
    releaseSpecificationPath,
    project,
  );

  const releasePlan = await planRelease(project, releaseSpecification);

  await applyUpdatesToMonorepo(project, releasePlan);

  await captureChangesInReleaseBranch(project, releasePlan);
}

/**
 * Generates a file that can be used to specify how a project should be updated.
 *
 * @param args - The set of arguments to this function.
 * @param args.project - Information about the project.
 * @param args.tempDirectory - A temporary directory in which to write the file.
 * @param args.releaseSpecificationPath - The path to the file that will be written.
 * @param args.isEditorAvailable - Whether or not an executable can be found on
 * the user's computer to edit the release spec once it is generated.
 */
async function generateReleaseSpecForMonorepo({
  project: { rootPackage, workspacePackages },
  tempDirectory,
  releaseSpecificationPath,
  isEditorAvailable,
}: {
  project: Project;
  tempDirectory: string;
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

  await fs.promises.mkdir(tempDirectory, { recursive: true });
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
async function waitForUserToEditReleaseSpecification(
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
 * @param releaseSpecificationPath - The path to the release spec file.
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @returns The validated release spec.
 * @throws If there are any issues with the file.
 */
async function validateReleaseSpecification(
  releaseSpecificationPath: string,
  project: Project,
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
            // Typecast: We know that this will safely parse.
            return {
              ...obj,
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

/**
 * Uses the release specification to calculate the final versions of all of the
 * packages that we want to update, as well as a new release name.
 *
 * @param project - The project.
 * @param releaseSpecification - A parsed version of the release spec entered by
 * the user.
 * @returns A promise for information about the new release.
 */
async function planRelease(
  project: Project,
  releaseSpecification: ReleaseSpecification,
): Promise<ReleasePlan> {
  const today =
    process.env.TODAY === undefined ? new Date() : new Date(process.env.TODAY);
  // TODO: What if this version already exists?
  const newReleaseName = today.toISOString().replace(/T.+$/u, '');
  const newRootVersion = [
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    today.getUTCDate(),
  ].join('.');

  const rootReleasePlan: PackageReleasePlan = {
    package: project.rootPackage,
    newVersion: newRootVersion,
    shouldUpdateChangelog: false,
  };

  const workspaceReleasePlans: PackageReleasePlan[] = Object.keys(
    releaseSpecification.packages,
  ).map((packageName) => {
    const pkg = project.workspacePackages[packageName];
    const versionSpecifier = releaseSpecification.packages[packageName];
    const currentVersion = pkg.manifest.version;
    let newVersion: string;
    // TODO: Figure out if we need this or not
    // let versionDiff: semver.ReleaseType | null;

    if (versionSpecifier instanceof SemVer) {
      newVersion = versionSpecifier.toString();
      const versionDiff = semver.diff(currentVersion.toString(), newVersion);

      if (versionDiff === null) {
        throw new Error(
          `Could not bump ${packageName} because the current and new versions are the same`,
        );
      }
    } else {
      newVersion = new SemVer(currentVersion.toString())
        .inc(versionSpecifier)
        .toString();
      // versionDiff = versionSpecifier;
    }

    return {
      package: pkg,
      newVersion,
      shouldUpdateChangelog: true,
    };
  });

  return {
    releaseName: newReleaseName,
    packages: [rootReleasePlan, ...workspaceReleasePlans],
  };
}

/**
 * Bumps versions and updates changelogs of packages within the monorepo
 * according to the release plan.
 *
 * @param project - The project.
 * @param releasePlan - The release plan.
 */
async function applyUpdatesToMonorepo(
  project: Project,
  releasePlan: ReleasePlan,
) {
  await Promise.all(
    releasePlan.packages.map(async (workspaceReleasePlan) => {
      debug(
        `Updating package ${workspaceReleasePlan.package.manifest.name}...`,
      );
      await updatePackage(project, workspaceReleasePlan);
    }),
  );
}
