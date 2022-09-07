import type { WriteStream } from 'fs';
import path from 'path';
import {
  ensureDirectoryPathExists,
  fileExists,
  removeFile,
  writeFile,
} from './fs';
import { determineEditor } from './editor';
import { Phases } from './initial-parameters';
import { Project } from './project';
import { captureChangesInReleaseBranch } from './repo';
import { planRelease, executeReleasePlan } from './release-plan';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification';

/**
 * Runs a new workflow.
 *
 * @param args - The arguments.
 * @param args.project - Information about the project.
 * @param args.tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @param args.today - A representation of "today" which will be used to set
 * the release date.
 * @param args.stdout - A stream that can be used to write to standard out.
 * @param args.stderr - A stream that can be used to write to standard error.
 */
async function runNewWorkflow({
  project,
  tempDirectoryPath,
  today,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  today: Date;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  const releaseSpecificationPath = path.join(tempDirectoryPath, 'RELEASE_SPEC');

  if (await fileExists(releaseSpecificationPath)) {
    throw new Error(
      [
        'It looks like you are in the middle of a run. Assuming that you have edited the release spec to your liking, please re-run this tool with --continue to resume the run or --abort if you want to stop it.',
        `The path to the release spec is:\n${releaseSpecificationPath}`,
      ].join('\n\n'),
    );
  }

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
        'A template has been generated that specifies this release. Please open the following file in your editor of choice, then re-run this tool with --continue:',
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
    stdout.write(
      `${[
        'It appears that your editor did not exit cleanly. A template has been generated that specifies this release. Please open the following file in your editor separately, then re-run this tool with --continue:',
        `${releaseSpecificationPath}`,
      ].join('\n\n')}\n`,
    );
    return;
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
  await captureChangesInReleaseBranch(project.directoryPath, {
    releaseDate: releasePlan.releaseDate,
    releaseNumber: releasePlan.releaseNumber,
  });
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
 * @param args - The options.
 * @param args.project - Information about the project.
 * @param args.tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @param args.phase - The portion of the workflow that should be run:
 * "start" to run from the beginning, "continue" to resume a previous run, or
 * "abort" to discard a previous run.
 * @param args.today - A representation of "today" which will be used to set
 * the release date.
 * @param args.stdout - A stream that can be used to write to standard out.
 * @param args.stderr - A stream that can be used to write to standard error.
 */
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  phase,
  today,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  phase: Phases;
  today: Date;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  switch (phase) {
    case Phases.Start:
      await runNewWorkflow({
        project,
        tempDirectoryPath,
        today,
        stdout,
        stderr,
      });
      break;
    default:
      throw new Error(`Unknown phase ${phase}.`);
    /*
    case Phases.Continue:
      await resumeExistingWorkflow({

  project,
  tempDirectoryPath,
  today,
  stdout,
  stderr,
      });
    case Phases.Abort;
      await discardExistingWorkflow({
  project,
  tempDirectoryPath,
  today,
  stdout,
  stderr,
      });
      */
  }
}
