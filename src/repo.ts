import path from 'path';
import {
  runCommand,
  getStdoutFromCommand,
  getLinesFromCommand,
} from './misc-utils.js';

const CHANGED_FILE_PATHS_BY_TAG_NAME: Record<string, string[]> = {};

/**
 * Runs a Git command within the given repository, discarding its output.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param commandName - The name of the Git command (e.g., "commit").
 * @param commandArgs - The arguments to the command.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function runGitCommandWithin(
  repositoryDirectoryPath: string,
  commandName: string,
  commandArgs: readonly string[],
): Promise<void> {
  await runCommand('git', [commandName, ...commandArgs], {
    cwd: repositoryDirectoryPath,
  });
}

/**
 * Runs a Git command within the given repository, obtaining the immediate
 * output.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param commandName - The name of the Git command (e.g., "commit").
 * @param commandArgs - The arguments to the command.
 * @returns The standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
async function getStdoutFromGitCommandWithin(
  repositoryDirectoryPath: string,
  commandName: string,
  commandArgs: readonly string[],
): Promise<string> {
  return await getStdoutFromCommand('git', [commandName, ...commandArgs], {
    cwd: repositoryDirectoryPath,
  });
}

/**
 * Runs a Git command within the given repository, splitting up the immediate
 * output into lines.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param commandName - The name of the Git command (e.g., "commit").
 * @param commandArgs - The arguments to the command.
 * @returns A set of lines from the standard output of the command.
 * @throws An execa error object if the command fails in some way.
 */
async function getLinesFromGitCommandWithin(
  repositoryDirectoryPath: string,
  commandName: string,
  commandArgs: readonly string[],
): Promise<string[]> {
  return await getLinesFromCommand('git', [commandName, ...commandArgs], {
    cwd: repositoryDirectoryPath,
  });
}

/**
 * Check whether the local repository has a complete git history.
 * Implemented using `git rev-parse --is-shallow-repository`.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns Whether the local repository has a complete, as opposed to shallow,
 * git history.
 * @throws if `git rev-parse --is-shallow-repository` returns an unrecognized
 * value.
 */
async function hasCompleteGitHistory(
  repositoryDirectoryPath: string,
): Promise<boolean> {
  const isShallow = await getStdoutFromGitCommandWithin(
    repositoryDirectoryPath,
    'rev-parse',
    ['--is-shallow-repository'],
  );

  // We invert the meaning of these strings because we want to know if the
  // repository is NOT shallow.
  if (isShallow === 'true') {
    return false;
  } else if (isShallow === 'false') {
    return true;
  }

  throw new Error(
    `"git rev-parse --is-shallow-repository" returned unrecognized value: ${JSON.stringify(
      isShallow,
    )}`,
  );
}

/**
 * Performs a diff in order to obtains a set of files that were changed in the
 * given repository between a particular tag and HEAD.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param tagName - The name of the tag to compare against HEAD.
 * @returns An array of paths to files that have changes between the given tag
 * and HEAD.
 */
async function getFilesChangedSince(
  repositoryDirectoryPath: string,
  tagName: string,
): Promise<string[]> {
  const partialFilePaths = await getLinesFromGitCommandWithin(
    repositoryDirectoryPath,
    'diff',
    [tagName, 'HEAD', '--name-only'],
  );
  return partialFilePaths.map((partialFilePath) =>
    path.join(repositoryDirectoryPath, partialFilePath),
  );
}

/**
 * Gets the HTTPS URL of the primary remote with which the given repository has
 * been configured. Assumes that the git config `remote.origin.url` string
 * matches one of:
 *
 * - https://github.com/OrganizationName/RepositoryName
 * - git@github.com:OrganizationName/RepositoryName.git
 *
 * If the URL of the "origin" remote matches neither pattern, an error is
 * thrown.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The HTTPS URL of the repository, e.g.
 * `https://github.com/OrganizationName/RepositoryName`.
 */
export async function getRepositoryHttpsUrl(
  repositoryDirectoryPath: string,
): Promise<string> {
  const httpsPrefix = 'https://github.com';
  const sshPrefixRegex = /^git@github\.com:/u;
  const sshPostfixRegex = /\.git$/u;
  const gitConfigUrl = await getStdoutFromGitCommandWithin(
    repositoryDirectoryPath,
    'config',
    ['--get', 'remote.origin.url'],
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
 * Commits all changes in a git repository with a specified commit message.
 *
 * @param repositoryDirectoryPath - The file system path to the git repository where changes are to be committed.
 * @param commitMessage - The message to be used for the git commit.
 * @throws If any git command fails to execute.
 */
export async function commitAllChanges(
  repositoryDirectoryPath: string,
  commitMessage: string,
) {
  await getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'add', ['-A']);
  await getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'commit', [
    '-m',
    commitMessage,
  ]);
}

/**
 * Retrieves the current branch name of a git repository.
 *
 * @param repositoryDirectoryPath - The file system path to the git repository.
 * @returns The name of the current branch in the specified repository.
 */
export function getCurrentBranchName(repositoryDirectoryPath: string) {
  return getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'rev-parse', [
    '--abbrev-ref',
    'HEAD',
  ]);
}

/**
 * Restores specific files in a git repository to their state at the common ancestor commit
 * of the current HEAD and the repository's default branch.
 *
 * This asynchronous function calculates the common ancestor (merge base) of the current HEAD
 * and the specified default branch. Then, it uses the `git restore` command to revert the
 * specified files back to their state at that ancestor commit. This is useful for undoing
 * changes in specific files that have occurred since the branch diverged from the default branch.
 *
 * @param repositoryDirectoryPath - The file system path to the git repository.
 * @param repositoryDefaultBranch - The name of the default branch in the repository.
 * @param filePaths - An array of file paths (relative to the repository root) to restore.
 */
export async function restoreFiles(
  repositoryDirectoryPath: string,
  repositoryDefaultBranch: string,
  filePaths: string[],
) {
  const ancestorCommitSha = await getStdoutFromGitCommandWithin(
    repositoryDirectoryPath,
    'merge-base',
    [repositoryDefaultBranch, 'HEAD'],
  );
  await runGitCommandWithin(repositoryDirectoryPath, 'restore', [
    '--source',
    ancestorCommitSha,
    '--',
    ...filePaths,
  ]);
}

/**
 * Checks if a specific branch exists in the given git repository.
 *
 * @param repositoryDirectoryPath - The file system path to the git repository.
 * @param branchName - The name of the branch to check for existence.
 * @returns A promise that resolves to `true` if the branch exists, `false` otherwise.
 */
export async function branchExists(
  repositoryDirectoryPath: string,
  branchName: string,
) {
  const branchNames = await getLinesFromGitCommandWithin(
    repositoryDirectoryPath,
    'branch',
    ['--list', branchName],
  );
  return branchNames.length > 0;
}

/**
 * Retrieves the names of the tags in the given repo, sorted by ascending
 * semantic version order. As this fetches tags from the remote first, you are
 * advised to only run this once.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @returns The names of the tags.
 * @throws If no tags are found and the local git history is incomplete.
 */
export async function getTagNames(
  repositoryDirectoryPath: string,
): Promise<string[]> {
  await runGitCommandWithin(repositoryDirectoryPath, 'fetch', ['--tags']);

  const tagNames = await getLinesFromGitCommandWithin(
    repositoryDirectoryPath,
    'tag',
    [
      '--sort=version:refname',
      // The --merged flag ensures that we only get tags that are parents of or
      // equal to the current HEAD.
      '--merged',
    ],
  );

  if (
    tagNames.length === 0 &&
    !(await hasCompleteGitHistory(repositoryDirectoryPath))
  ) {
    throw new Error(
      `"git tag" returned no tags. Increase your git fetch depth.`,
    );
  }

  return tagNames;
}

/**
 * Calculates whether there have been any commits in the given repo since the
 * given tag that include changes to any of the files within the given
 * subdirectory within that repo. The result is cached so that multiple calls
 * using the same tag name do not re-request the diff.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param subdirectoryPath - The path to a subdirectory within the repository.
 * @param tagName - The name of a tag in the repository.
 * @returns True or false, depending on the result.
 */
export async function hasChangesInDirectorySinceGitTag(
  repositoryDirectoryPath: string,
  subdirectoryPath: string,
  tagName: string,
): Promise<boolean> {
  if (!(tagName in CHANGED_FILE_PATHS_BY_TAG_NAME)) {
    const changedFilePaths = await getFilesChangedSince(
      repositoryDirectoryPath,
      tagName,
    );

    /* istanbul ignore else */
    if (!(tagName in CHANGED_FILE_PATHS_BY_TAG_NAME)) {
      CHANGED_FILE_PATHS_BY_TAG_NAME[tagName] = changedFilePaths;
    }
  }

  return CHANGED_FILE_PATHS_BY_TAG_NAME[tagName].some((filePath) => {
    return filePath.startsWith(subdirectoryPath);
  });
}
