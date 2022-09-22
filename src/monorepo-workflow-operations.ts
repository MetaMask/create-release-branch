import type { WriteStream } from 'fs';
import path from 'path';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from './fs';
import { determineEditor } from './editor';
import { Project } from './project';
import { planRelease, executeReleasePlan } from './release-plan';
import { captureChangesInReleaseBranch } from './repo';
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
  const releasePlan = await planRelease({
    project,
    releaseSpecification,
  });
  await executeReleasePlan(project, releasePlan, stderr);
  await removeFile(releaseSpecificationPath);
  await captureChangesInReleaseBranch(project.directoryPath, {
    releaseVersion: releasePlan.newVersion,
  });
}
