import type { WriteStream } from 'fs';
import path from 'path';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from './file-utils';
import { determineEditor } from './editor-utils';
import { captureChangesInReleaseBranch } from './git-utils';
import { Project } from './project-utils';
import { planRelease, executeReleasePlan } from './release-plan-utils';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification-utils';

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
 * @param options - The options.
 * @param options.project - Information about the project.
 * @param options.tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @param options.firstRemovingExistingReleaseSpecification - Sometimes it's
 * possible for a release specification that was created in a previous run to
 * stick around (due to an error). This will ensure that the file is removed
 * first.
 * @param options.today - The current date.
 * @param options.stdout - A stream that can be used to write to standard out.
 * @param options.stderr - A stream that can be used to write to standard error.
 */
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification,
  today,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  firstRemovingExistingReleaseSpecification: boolean;
  today: Date;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  const releaseSpecificationPath = path.join(tempDirectoryPath, 'RELEASE_SPEC');

  if (
    !firstRemovingExistingReleaseSpecification &&
    (await fileExists(releaseSpecificationPath))
  ) {
    stdout.write(
      'Release spec already exists. Picking back up from previous run.\n',
    );
    // TODO: If we end up here, then we will probably get an error later when
    // attempting to bump versions of packages, as that may have already
    // happened — we need to be idempotent
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
          'A template has been generated that specifies this release. Please open the following file in your editor of choice, then re-run this script:',
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
  const releasePlan = await planRelease({
    project,
    releaseSpecification,
    today,
  });
  await executeReleasePlan(project, releasePlan, stderr);
  await removeFile(releaseSpecificationPath);
  await captureChangesInReleaseBranch(
    project.directoryPath,
    releasePlan.releaseName,
  );
}
