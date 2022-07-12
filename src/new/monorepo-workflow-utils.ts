import path from 'path';
import rimraf from 'rimraf';
import { debug } from './misc-utils';
import { fileExists } from './file-utils';
import { determineEditor } from './editor-utils';
import { getEnvironmentVariables } from './env-utils';
import { updatePackage } from './package-utils';
import { Project } from './project-utils';
import {
  generateReleaseSpecificationForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
  ReleaseSpecification,
} from './release-specification-utils';
import { semver, SemVer } from './semver-utils';
import {
  captureChangesInReleaseBranch,
  PackageReleasePlan,
  ReleasePlan,
} from './workflow-utils';

/**
 * Creates a date from the value of the `TODAY` environment variable, falling
 * back to the current date if it is invalid or was not provided. This will be
 * used to assign a name to the new release in the case of a monorepo with
 * independent versions.
 *
 * @returns A date that represents "today".
 */
function getToday() {
  const { TODAY } = getEnvironmentVariables();
  const parsedTodayTimestamp =
    TODAY === undefined ? NaN : new Date(TODAY).getTime();
  return isNaN(parsedTodayTimestamp)
    ? new Date()
    : new Date(parsedTodayTimestamp);
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

    await generateReleaseSpecificationForMonorepo({
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
    project,
    releaseSpecificationPath,
  );

  const releasePlan = await planRelease(project, releaseSpecification);

  await applyUpdatesToMonorepo(project, releasePlan);

  await captureChangesInReleaseBranch(project, releasePlan);
}

/**
 * Uses the release specification to calculate the final versions of all of the
 * packages that we want to update, as well as a new release name.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param releaseSpecification - A parsed version of the release spec entered by
 * the user.
 * @returns A promise for information about the new release.
 */
async function planRelease(
  project: Project,
  releaseSpecification: ReleaseSpecification,
): Promise<ReleasePlan> {
  const today = getToday();
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
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param releasePlan - Compiled instructions on how exactly to update the
 * project in order to prepare a new release.
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
