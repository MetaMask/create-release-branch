import { runCommand } from './misc-utils.js';

/**
 * Runs `yarn constraints --fix` to fix any constraint issues.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function fixConstraints(
  repositoryDirectoryPath: string,
): Promise<void> {
  await runCommand('yarn', ['constraints', '--fix'], {
    cwd: repositoryDirectoryPath,
  });
}

/**
 * Runs `yarn` to install dependencies.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function installDependencies(
  repositoryDirectoryPath: string,
): Promise<void> {
  await runCommand('yarn', [], {
    cwd: repositoryDirectoryPath,
  });
}
