import type { WriteStream } from 'fs';
import { initialize } from './initialization-utils';
import { followMonorepoWorkflow } from './monorepo-workflow-utils';

/**
 * The main function for this script.
 *
 * @param args - The arguments.
 * @param args.argv - The name of this script and its arguments (as obtained via
 * `process.argv`).
 * @param args.cwd - The directory in which this script was executed.
 * @param args.stdout - A stream that can be used to write to standard out.
 * @param args.stderr - A stream that can be used to write to standard error.
 */
export async function main({
  argv,
  cwd,
  stdout,
  stderr,
}: {
  argv: string[];
  cwd: string;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
  const { project, tempDirectoryPath, reset } = await initialize(argv, cwd);

  if (project.isMonorepo) {
    stdout.write(
      'Project appears to have workspaces. Following monorepo workflow.\n',
    );
    await followMonorepoWorkflow({
      project,
      tempDirectoryPath,
      firstRemovingExistingReleaseSpecification: reset,
      stdout,
      stderr,
    });
  } else {
    stdout.write(
      'Project does not appear to have any workspaces. Following polyrepo workflow.\n',
    );
    // TODO
  }
}
