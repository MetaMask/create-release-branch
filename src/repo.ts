import {
  runCommand,
  getStdoutFromCommand,
  getLinesFromCommand,
  placeInSpecificOrder,
} from './misc-utils';

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
async function runGitCommandWithin(
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
  return await getLinesFromGitCommandWithin(repositoryDirectoryPath, 'diff', [
    tagName,
    'HEAD',
    '--name-only',
  ]);
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
 * This function does three things:
 *
 * 1. Stages all of the changes which have been made to the repo thus far and
 * creates a new Git commit which carries the name of the new release.
 * 2. Creates a new branch pointed to that commit (which also carries the name
 * of the new release).
 * 3. Switches to that branch.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param args - The arguments.
 * @param args.releaseVersion - The release version.
 */
export async function captureChangesInReleaseBranch(
  repositoryDirectoryPath: string,
  { releaseVersion }: { releaseVersion: string },
) {
  await getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'checkout', [
    '-b',
    `release/${releaseVersion}`,
  ]);
  await getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'add', ['-A']);
  await getStdoutFromGitCommandWithin(repositoryDirectoryPath, 'commit', [
    '-m',
    `Release ${releaseVersion}`,
  ]);
}

/**
 * Retrieves the names of the tags in the given repo, sorted by earliest created
 * to latest created. As this fetches tags from the remote first, you are
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

  // The --merged flag ensures that we only get tags that are parents of or
  // equal to the current HEAD.
  const unsortedMergedTagNames = await getLinesFromGitCommandWithin(
    repositoryDirectoryPath,
    'tag',
    ['--merged'],
  );
  const sortedComprehensiveTagNames = await getLinesFromGitCommandWithin(
    repositoryDirectoryPath,
    'rev-list',
    ['--tags', '--date-order'],
  );

  if (
    unsortedMergedTagNames.length === 0 &&
    sortedComprehensiveTagNames.length === 0 &&
    !(await hasCompleteGitHistory(repositoryDirectoryPath))
  ) {
    throw new Error(
      `"git tag" returned no tags. Increase your git fetch depth.`,
    );
  }

  return placeInSpecificOrder(
    unsortedMergedTagNames,
    sortedComprehensiveTagNames,
  );
}

/**
 * Calculates whether there have been any commits since the given tag that
 * include changes to any of the files within the given directory.
 *
 * @param repositoryDirectoryPath - The path to the repository directory.
 * @param directoryPath - The path to a subdirectory within the repository.
 * @param tagName - The name of a tag in the repository.
 * @returns True or false, depending on the result.
 */
export async function hasChangesInDirectorySinceGitTag(
  repositoryDirectoryPath: string,
  directoryPath: string,
  tagName: string,
): Promise<boolean> {
  let changedFilePaths: string[];

  if (tagName in CHANGED_FILE_PATHS_BY_TAG_NAME) {
    changedFilePaths = CHANGED_FILE_PATHS_BY_TAG_NAME[tagName];
  } else {
    changedFilePaths = await getFilesChangedSince(
      repositoryDirectoryPath,
      tagName,
    );
    // This function is the only thing that updates
    // CHANGED_FILE_PATHS_BY_TAG_NAME, so there's no chance that it would get
    // updated while the promise above is being resolved.
    // TODO: Use mutex?
    /* eslint-disable-next-line require-atomic-updates */
    CHANGED_FILE_PATHS_BY_TAG_NAME[tagName] = changedFilePaths;
  }

  return changedFilePaths.some((filePath) => {
    return filePath.startsWith(directoryPath);
  });
}
