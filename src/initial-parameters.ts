import os from 'os';
import path from 'path';
import { readCommandLineArguments } from './command-line-arguments';
import { readProject, Project } from './project';

interface InitialParameters {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
}

/**
 * Reads the inputs given to this tool via `process.argv` and uses them to
 * gather information about the project the tool can use to run.
 *
 * @param argv - The arguments to this executable.
 * @param cwd - The directory in which this executable was run.
 * @returns The initial parameters.
 */
export async function determineInitialParameters(
  argv: string[],
  cwd: string,
): Promise<InitialParameters> {
  const inputs = await readCommandLineArguments(argv);
  const projectDirectoryPath = path.resolve(cwd, inputs.projectDirectory);
  const project = await readProject(projectDirectoryPath);
  const tempDirectoryPath =
    inputs.tempDirectory === undefined
      ? path.join(
          os.tmpdir(),
          'create-release-branch',
          project.rootPackage.validatedManifest.name.replace('/', '__'),
        )
      : path.resolve(cwd, inputs.tempDirectory);

  return { project, tempDirectoryPath, reset: inputs.reset };
}
