import type { WriteStream } from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import { debug } from './misc-utils';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from './fs';
import { determineEditor } from './editor';
import { getEnvironmentVariables } from './env';
import { updatePackage } from './package';
import { Project } from './project';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
  ReleaseSpecification,
} from './release-specification';
import { semver, SemVer } from './semver';
import {
  captureChangesInReleaseBranch,
  PackageReleasePlan,
  ReleasePlan,
} from './workflow-operations';

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
 * - The tool generates a release spec template, listing the workspace packages
 * in the project that have changed since the last release (or all of the
 * packages if this would be the first release).
 * - The tool then presents the template to the user so that they can specify
 * the desired versions for each package. It first does this by attempting to
 * locate an appropriate code editor on the user's computer (using the `EDITOR`
 * environment variable if that is defined, otherwise `code` if it is present)
 * and opening the file there, pausing while the user is editing the file. If no
 * editor can be found, the tool provides the user with the path to the template
 * so that they can edit it themselves, then exits.
 * - However the user has edited the file, the tool will parse and validate the
 * information in the file, then apply the desired changes to the monorepo.
 * - Finally, once it has made the desired changes, the tool will create a Git
 * commit that includes the changes, then create a branch using the current date
 * as the name.
 *
 * @param options - The options.
 * @param options.project - Information about the project.
 * @param options.tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @param options.firstRemovingExistingReleaseSpecification - Sometimes it's
 * possible for a release specification that was created in a previous run to
 * stick around (due to an error). This will ensure that the file is removed
 * first.
 * @param options.stdout - A stream that can be used to write to standard out.
 * @param options.stderr - A stream that can be used to write to standard error.
 */
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  firstRemovingExistingReleaseSpecification: boolean;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  const releaseSpecificationPath = path.join(tempDirectoryPath, 'RELEASE_SPEC');

  if (firstRemovingExistingReleaseSpecification) {
    await new Promise((resolve) => rimraf(releaseSpecificationPath, resolve));
  }

  if (await fileExists(releaseSpecificationPath)) {
    stdout.write(
      'Release spec already exists. Picking back up from previous run.\n',
    );
  } else {
    const editor = await determineEditor();

    const releaseSpecificationTemplate =
      await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: editor !== undefined,
      });
    await ensureDirectoryPathExists(tempDirectoryPath);
    await writeFile(releaseSpecificationPath, releaseSpecificationTemplate);

    if (!editor) {
      stdout.write(
        `${[
          'A template has been generated that specifies this release. Please open the following file in your editor of choice, then re-run this tool:',
          `${releaseSpecificationPath}`,
        ].join('\n\n')}\n`,
      );
      return;
    }

    try {
      await waitForUserToEditReleaseSpecification(
        releaseSpecificationPath,
        editor,
      );
    } catch (error) {
      await removeFile(releaseSpecificationPath);
      throw error;
    }
  }

  const releaseSpecification = await validateReleaseSpecification(
    project,
    releaseSpecificationPath,
  );
  const releasePlan = await planRelease(
    project,
    releaseSpecification,
    releaseSpecificationPath,
  );
  await applyUpdatesToMonorepo(project, releasePlan, stderr);
  await removeFile(releaseSpecificationPath);
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
 * @param releaseSpecificationPath - The path to the release specification file.
 * @returns A promise for information about the new release.
 */
async function planRelease(
  project: Project,
  releaseSpecification: ReleaseSpecification,
  releaseSpecificationPath: string,
): Promise<ReleasePlan> {
  const today = getToday();
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
    const newVersion =
      versionSpecifier instanceof SemVer
        ? versionSpecifier.toString()
        : new SemVer(currentVersion.toString())
            .inc(versionSpecifier)
            .toString();

    const versionDiff = semver.diff(currentVersion.toString(), newVersion);

    if (versionDiff === null) {
      throw new Error(
        [
          `Could not apply version specifier "${versionSpecifier}" to package "${packageName}" because the current and new versions would end up being the same.`,
          `The release spec file has been retained for you to make the necessary fixes. Once you've done this, re-run this tool.`,
          releaseSpecificationPath,
        ].join('\n\n'),
      );
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
 * @param stderr - A stream that can be used to write to standard error.
 */
async function applyUpdatesToMonorepo(
  project: Project,
  releasePlan: ReleasePlan,
  stderr: Pick<WriteStream, 'write'>,
) {
  await Promise.all(
    releasePlan.packages.map(async (workspaceReleasePlan) => {
      debug(
        `Updating package ${workspaceReleasePlan.package.manifest.name}...`,
      );
      await updatePackage({
        project,
        packageReleasePlan: workspaceReleasePlan,
        stderr,
      });
    }),
  );
}
