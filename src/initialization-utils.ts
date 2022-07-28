import os from 'os';
import path from 'path';
import { readProject, Project } from './project-utils';
import { readInputs } from './inputs-utils';

interface InitialParameters {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
}

/**
 * Reads the inputs given to this tool via `process.argv` and uses them to
 * gather data we can use to proceed.
 *
 * @param argv - The arguments to this script.
 * @param cwd - The directory in which this script was executed.
 * @returns The initial parameters.
 */
export async function initialize(
  argv: string[],
  cwd: string,
): Promise<InitialParameters> {
  const inputs = await readInputs(argv);
  const projectDirectoryPath = path.resolve(cwd, inputs.projectDirectory);
  const project = await readProject(projectDirectoryPath);
  const tempDirectoryPath =
    inputs.tempDirectory === undefined
      ? path.join(
          os.tmpdir(),
          'create-release-branch',
          project.rootPackage.manifest.name.replace('/', '__'),
        )
      : path.resolve(cwd, inputs.tempDirectory);

  return { project, tempDirectoryPath, reset: inputs.reset };
}
