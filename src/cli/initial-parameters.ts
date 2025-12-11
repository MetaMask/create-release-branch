import os from 'os';
import path from 'path';

import { readCommandLineArguments } from './command-line-arguments.js';
import { WriteStreamLike } from '../core/fs.js';
import { readProject, Project } from '../core/project.js';
import { ReleaseType } from '../core/types.js';

/**
 * Various pieces of information that the tool uses to run, derived from
 * command-line arguments.
 */
type InitialParameters = {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  interactive: boolean;
  port: number;
};

/**
 * Reads the inputs given to this tool via `process.argv` and uses them to
 * gather information about the project the tool can use to run.
 *
 * @param args - The arguments to this function.
 * @param args.argv - The arguments to this executable.
 * @param args.cwd - The directory in which this executable was run.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns The initial parameters.
 */
export async function determineInitialParameters({
  argv,
  cwd,
  stderr,
}: {
  argv: string[];
  cwd: string;
  stderr: WriteStreamLike;
}): Promise<InitialParameters> {
  const args = await readCommandLineArguments(argv);

  const projectDirectoryPath = path.resolve(cwd, args.projectDirectory);
  const project = await readProject(projectDirectoryPath, { stderr });
  const tempDirectoryPath =
    args.tempDirectory === undefined
      ? path.join(
          os.tmpdir(),
          'create-release-branch',
          project.rootPackage.validatedManifest.name.replace('/', '__'),
        )
      : path.resolve(cwd, args.tempDirectory);

  return {
    project,
    tempDirectoryPath,
    reset: args.reset,
    defaultBranch: args.defaultBranch,
    releaseType: args.backport ? 'backport' : 'ordinary',
    interactive: args.interactive,
    port: args.port,
  };
}
