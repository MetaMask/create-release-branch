import { WriteStream } from 'fs';
import { debug, runCommand, getStdoutFromCommand } from './misc-utils.js';

/**
 * Checks the current Yarn version.
 *
 * @returns A promise that resolves to the Yarn version string.
 * @throws An execa error object if the command fails in some way.
 */
export async function getYarnVersion(): Promise<string> {
  return await getStdoutFromCommand('yarn', ['--version']);
}

/**
 * Runs `yarn constraints --fix` to fix any constraint issues.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param stderr - A stream that can be used to write to standard error.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function fixConstraints(
  repositoryDirectoryPath: string,
  stderr: Pick<WriteStream, 'write'>,
): Promise<void> {
  const version = await getYarnVersion();
  const majorVersion = parseInt(version.split('.')[0], 10);

  if (majorVersion >= 2) {
    await runCommand('yarn', ['constraints', '--fix'], {
      cwd: repositoryDirectoryPath,
    });
    debug('Yarn constraints fixed successfully.');
  } else {
    stderr.write(
      'Skipping constraints fix, current Yarn version does not support this feature.',
    );
  }
}

/**
 * Runs `yarn install --no-immutable` to update yarn lock.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function updateYarnLock(
  repositoryDirectoryPath: string,
): Promise<void> {
  debug('Installing dependencies...');
  await runCommand('yarn', ['install', '--no-immutable'], {
    cwd: repositoryDirectoryPath,
  });
}
