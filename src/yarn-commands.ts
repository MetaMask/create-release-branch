import { debug, runCommand } from './misc-utils.js';

/**
 * Runs `yarn constraints --fix` to autofix all unmet constraints.
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
  debug('Yarn constraints fixed successfully.');
}

/**
 * Runs `yarn install --no-immutable` to update the Yarn lockfile.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function updateYarnLockfile(
  repositoryDirectoryPath: string,
): Promise<void> {
  debug('Installing dependencies...');
  await runCommand('yarn', ['install', '--no-immutable'], {
    cwd: repositoryDirectoryPath,
  });
}

/**
 * Runs `yarn dedupe` to deduplicate dependencies in the project.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function deduplicateDependencies(
  repositoryDirectoryPath: string,
): Promise<void> {
  debug('Deduplicating dependencies...');
  await runCommand('yarn', ['dedupe'], {
    cwd: repositoryDirectoryPath,
  });
}
