import os from 'os';
import path from 'path';
import { readCommandLineArguments } from './command-line-arguments.js';
import { WriteStreamLike } from './fs.js';
import { readProject, Project } from './project.js';

/**
 * The type of release being created as determined by the parent release.
 *
 * - An *ordinary* release includes features or fixes applied against the
 * latest release and is designated by bumping the first part of that release's
 * version string.
 * - A *backport* release includes fixes applied against a previous release and
 * is designated by bumping the second part of that release's version string.
 */
export type ReleaseType = 'ordinary' | 'backport';

type InitialParameters = {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
  releaseType: ReleaseType;
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
    releaseType: args.backport ? 'backport' : 'ordinary',
  };
}
