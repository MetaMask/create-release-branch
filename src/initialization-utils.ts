import os from 'os';
import path from 'path';
import { readProject, Project } from './project-utils';
import { readInputs } from './inputs-utils';

/**
 * Reads the inputs given to this script via `process.argv` and uses them to
 * gather data we can use to proceed.
 *
 * @param argv - The arguments to this script.
 * @param cwd - The directory in which this script was executed.
 * @returns Information we need to proceed with the script.
 */
export async function initialize(
  argv: string[],
  cwd: string,
): Promise<{ project: Project; tempDirectoryPath: string; reset: boolean }> {
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
