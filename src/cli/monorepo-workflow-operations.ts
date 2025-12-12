import type { WriteStream } from 'fs';
import path from 'path';

import { getEnvironmentVariables } from './env.js';
import { determineEditor } from '../core/editor.js';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from '../core/fs.js';
import {
  Project,
  updateChangelogsForChangedPackages,
  restoreChangelogsForSkippedPackages,
} from '../core/project.js';
import { planRelease, executeReleasePlan } from '../core/release-plan.js';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from '../core/release-specification.js';
import { commitAllChanges } from '../core/repo.js';
import { ReleaseType } from '../core/types.js';
import { createReleaseBranch } from '../core/workflow-operations.js';
import {
  deduplicateDependencies,
  fixConstraints,
  updateYarnLockfile,
} from '../core/yarn-commands.js';

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
}): Promise<void> {
  const { version: newReleaseVersion, firstRun } = await createReleaseBranch({
    project,
    releaseType,
  });

  if (firstRun) {
    await updateChangelogsForChangedPackages({ project, stderr });
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
    const { EDITOR } = getEnvironmentVariables();
    const editor = await determineEditor(EDITOR);

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

  const { packages } = await validateReleaseSpecification(
    project,
    releaseSpecificationPath,
  );

  await restoreChangelogsForSkippedPackages({
    project,
    releaseSpecificationPackages: packages,
    defaultBranch,
  });

  const releasePlan = await planRelease({
    project,
    releaseSpecificationPackages: packages,
    newReleaseVersion,
  });
  await executeReleasePlan(project, releasePlan, stderr);
  await removeFile(releaseSpecificationPath);
  await fixConstraints(project.directoryPath);
  await updateYarnLockfile(project.directoryPath);
  await deduplicateDependencies(project.directoryPath);
  await commitAllChanges(
    project.directoryPath,
    `Update Release ${newReleaseVersion}`,
  );
}
