import { getStdoutFromCommand } from './misc-utils';

/**
 * Runs a command within the given directory, obtaining the immediate output.
 *
 * @param directoryPath - The path to the directory.
 * @param command - The command to execute.
 * @param args - The positional arguments to the command.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
async function getStdoutFromCommandWithin(
  directoryPath: string,
  command: string,
  args?: readonly string[] | undefined,
): Promise<string> {
  return await getStdoutFromCommand(command, args, { cwd: directoryPath });
}

/**
 * Runs a Git command within the given directory, obtaining the immediate
 * output.
 *
 * @param repoDirectory - The directory of the repository.
 * @param args - The arguments to the command.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function getStdoutFromGitCommandWithin(
  repoDirectory: string,
  args: readonly string[],
) {
  return await getStdoutFromCommandWithin(repoDirectory, 'git', args);
}

/**
 * Gets the HTTPS URL of the primary remote with which the given project has
 * been configured. Assumes that the git config `remote.origin.url` string
 * matches one of:
 *
 * - https://github.com/OrganizationName/RepositoryName
 * - git@github.com:OrganizationName/RepositoryName.git
 *
 * If the URL of the "origin" remote matches neither pattern, an error is
 * thrown.
 *
 * @param projectDirectoryPath - The path to the project directory.
 * @returns The HTTPS URL of the repository, e.g.
 * `https://github.com/OrganizationName/RepositoryName`.
 */
export async function getRepositoryHttpsUrl(
  projectDirectoryPath: string,
): Promise<string> {
  const httpsPrefix = 'https://github.com';
  const sshPrefixRegex = /^git@github\.com:/u;
  const sshPostfixRegex = /\.git$/u;
  const gitConfigUrl = await getStdoutFromCommandWithin(
    projectDirectoryPath,
    'git',
    ['config', '--get', 'remote.origin.url'],
  );

  if (gitConfigUrl.startsWith(httpsPrefix)) {
    return gitConfigUrl;
  }

  // Extracts "OrganizationName/RepositoryName" from
  // "git@github.com:OrganizationName/RepositoryName.git" and returns the
  // corresponding HTTPS URL.
  if (
    gitConfigUrl.match(sshPrefixRegex) &&
    gitConfigUrl.match(sshPostfixRegex)
  ) {
    return `${httpsPrefix}/${gitConfigUrl
      .replace(sshPrefixRegex, '')
      .replace(sshPostfixRegex, '')}`;
  }

  throw new Error(`Unrecognized URL for git remote "origin": ${gitConfigUrl}`);
}

/**
 * This function does three things:
 *
 * 1. Stages all of the changes which have been made to the repo thus far and
 *    creates a new Git commit which carries the name of the new release.
 * 2. Creates a new branch pointed to that commit (which also carries the name
 *    of the new release).
 * 3. Switches to that branch.
 *
 * @param projectRepositoryPath - The path to the project directory.
 * @param releaseName - The name of the release, which will be used to name the
 * commit and the branch.
 */
export async function captureChangesInReleaseBranch(
  projectRepositoryPath: string,
  releaseName: string,
) {
  // TODO: What if the index was dirty before this script was run? Or what if
  // you're in the middle of a rebase? Might want to check that up front before
  // changes are even made.
  // TODO: What if this branch already exists? Append the build number?
  await getStdoutFromGitCommandWithin(projectRepositoryPath, [
    'checkout',
    '-b',
    `release/${releaseName}`,
  ]);
  await getStdoutFromGitCommandWithin(projectRepositoryPath, ['add', '-A']);
  await getStdoutFromGitCommandWithin(projectRepositoryPath, [
    'commit',
    '-m',
    `Release ${releaseName}`,
  ]);
}
