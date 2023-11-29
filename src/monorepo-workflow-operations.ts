import type { WriteStream } from 'fs';
import path from 'path';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from './fs';
import { debug } from './misc-utils';
import { determineEditor } from './editor';
import { ReleaseType } from './initial-parameters';
import {
  Project,
  updateChangedPackagesChangelog,
  restoreChangelogsForSkippedPackages,
} from './project';
import { planRelease, executeReleasePlan } from './release-plan';
import {
  branchExists,
  commitAllChanges,
  getCurrentBranchName,
  runGitCommandWithin,
} from './repo';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification';

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
 * @param args - The arguments to this function.
 * @param args.project - Information about the project.
 * @param args.tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @param args.firstRemovingExistingReleaseSpecification - Sometimes it's
 * possible for a release specification that was created in a previous run to
 * stick around (due to an error). This will ensure that the file is removed
 * first.
 * @param args.releaseType - The type of release ("ordinary" or "backport"),
 * which affects how the version is bumped.
 * @param args.defaultBranch - The name of the default branch in the repository.
 * @param args.stdout - A stream that can be used to write to standard out.
 * @param args.stderr - A stream that can be used to write to standard error.
 */
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification,
  releaseType,
  defaultBranch,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  firstRemovingExistingReleaseSpecification: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  const { version: newReleaseVersion, firstRun } = await createReleaseBranch({
    project,
    releaseType,
  });

  if (firstRun) {
    await updateChangedPackagesChangelog({ project, stderr });
    await commitAllChanges(
      project.directoryPath,
      `Initialize Release ${newReleaseVersion}`,
    );
  }

  const releaseSpecificationPath = path.join(
    tempDirectoryPath,
    'RELEASE_SPEC.yml',
  );

  if (
    !firstRemovingExistingReleaseSpecification &&
    (await fileExists(releaseSpecificationPath))
  ) {
    stdout.write(
      'Release spec already exists. Picking back up from previous run.\n',
    );
  } else {
    const editor = await determineEditor();

    const releaseSpecificationTemplate =
      await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: editor !== null,
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

  await restoreChangelogsForSkippedPackages({
    project,
    releaseSpecification,
    defaultBranch,
  });

  const releasePlan = await planRelease({
    project,
    releaseSpecification,
    newReleaseVersion,
  });
  await executeReleasePlan(project, releasePlan, stderr);
  await removeFile(releaseSpecificationPath);
  await commitAllChanges(
    project.directoryPath,
    `Update Release ${newReleaseVersion}`,
  );
}

/**
 * Creates a new release branch in the given project repository based on the specified release type.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseType - The type of release ("ordinary" or "backport"),
 * which affects how the version is bumped.
 * @returns A promise that resolves to an object with the new
 * release version and a boolean indicating whether it's the first run.
 */
export async function createReleaseBranch({
  project,
  releaseType,
}: {
  project: Project;
  releaseType: ReleaseType;
}): Promise<{
  version: string;
  firstRun: boolean;
}> {
  const newReleaseVersion =
    releaseType === 'backport'
      ? `${project.releaseVersion.ordinaryNumber}.${
          project.releaseVersion.backportNumber + 1
        }.0`
      : `${project.releaseVersion.ordinaryNumber + 1}.0.0`;

  const releaseBranchName = `release/${newReleaseVersion}`;

  const currentBranchName = await getCurrentBranchName(project.directoryPath);

  if (currentBranchName === releaseBranchName) {
    debug(`Already on ${releaseBranchName} branch.`);
    return {
      version: newReleaseVersion,
      firstRun: false,
    };
  }

  if (await branchExists(project.directoryPath, releaseBranchName)) {
    debug(
      `Current release branch already exists. Checking out the existing branch.`,
    );
    await runGitCommandWithin(project.directoryPath, 'checkout', [
      releaseBranchName,
    ]);
    return {
      version: newReleaseVersion,
      firstRun: false,
    };
  }

  await runGitCommandWithin(project.directoryPath, 'checkout', [
    '-b',
    releaseBranchName,
  ]);

  return {
    version: newReleaseVersion,
    firstRun: true,
  };
}
