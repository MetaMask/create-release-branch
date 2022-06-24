import util from 'util';
import glob from 'glob';
import execa from 'execa';
import {
  ManifestFieldNames,
  ValidatedManifestFile,
  getValidatedManifestFile,
} from './package-utils';

export interface Project {
  directoryPath: string;
  repositoryUrl: string;
  rootManifestFile: ValidatedManifestFile;
  workspaceManifestFiles: Record<string, ValidatedManifestFile>;
}

const promisifiedGlob = util.promisify(glob);

/**
 * Collects information about a project. For a polyrepo, this information will
 * only cover the project's `package.json` file; for a monorepo, it will cover
 * `package.json` files for any workspaces which the monorepo defines.
 *
 * @param projectDirectoryPath - The path to the project.
 * @returns An object that represents information about the project.
 * @throws if the project does not contain a root `package.json` (polyrepo and
 * monorepo) or if any of the workspaces specified in the root `package.json` do
 * not have `package.json`s (monorepo only).
 */
export async function readProject(
  projectDirectoryPath: string,
): Promise<Project> {
  const rootManifestFile = await getValidatedManifestFile(
    projectDirectoryPath,
    {
      usingSemverForVersion: false,
    },
  );

  const workspaceDirectories = (
    await Promise.all(
      rootManifestFile.data[ManifestFieldNames.Workspaces].map(
        async (workspacePattern) => {
          return await promisifiedGlob(workspacePattern, {
            cwd: projectDirectoryPath,
            absolute: true,
          });
        },
      ),
    )
  ).flat();

  const workspaceManifestFiles = (
    await Promise.all(
      workspaceDirectories.map(async (directory) => {
        return await getValidatedManifestFile(directory, {
          usingSemverForVersion: true,
        });
      }),
    )
  ).reduce((obj, manifestFile) => {
    return { ...obj, [manifestFile.data.name]: manifestFile };
  }, {} as Record<string, ValidatedManifestFile>);

  const repositoryUrl = await getRepositoryHttpsUrl(projectDirectoryPath);

  return {
    directoryPath: projectDirectoryPath,
    repositoryUrl,
    rootManifestFile,
    workspaceManifestFiles,
  };
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
  const gitConfigUrl = await runCommandWithinProject(
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
 * Utility function for running a command within the given project and obtaining
 * the immediate output.
 *
 * @param projectDirectoryPath - The path to the project directory.
 * @param command - The command to execute.
 * @param args - The positional arguments to the command.
 * @returns The result of the command.
 * @throws An execa error object if the command fails in some way.
 */
export async function runCommandWithinProject(
  projectDirectoryPath: string,
  command: string,
  args?: readonly string[] | undefined,
): Promise<string> {
  return (
    await execa(command, args, { cwd: projectDirectoryPath })
  ).stdout.trim();
}
