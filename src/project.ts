import { resolve } from 'path';
import { WriteStreamLike } from './fs';
import {
  Package,
  readMonorepoRootPackage,
  readMonorepoWorkspacePackage,
} from './package';
import { getRepositoryHttpsUrl, getTagNames } from './repo';
import { SemVer } from './semver';
import { getLinesFromCommand } from './misc-utils';

/**
 * The release version of the root package of a monorepo extracted from its
 * version string.
 *
 * @property ordinaryNumber - The number assigned to the release if it
 * introduces new changes that haven't appeared in any previous release; it will
 * be 0 if there haven't been any releases yet.
 * @property backportNumber - A backport release is a change ported from one
 * ordinary release to a previous ordinary release. This, then, is the number
 * which identifies this release relative to other backport releases under the
 * same ordinary release, starting from 1; it will be 0 if there aren't any
 * backport releases for the ordinary release yet.
 */
type ReleaseVersion = {
  ordinaryNumber: number;
  backportNumber: number;
};

export type YarnWorkspace = {
  location: string;
  name: string;
};

/**
 * Represents the entire codebase on which this tool is operating.
 *
 * @property directoryPath - The directory in which the project lives.
 * @property repositoryUrl - The public URL of the Git repository where the
 * codebase for the project lives.
 * @property rootPackage - Information about the root package (assuming that the
 * project is a monorepo).
 * @property workspacePackages - Information about packages that are referenced
 * via workspaces (assuming that the project is a monorepo).
 */
export type Project = {
  directoryPath: string;
  repositoryUrl: string;
  rootPackage: Package;
  workspacePackages: Record<string, Package>;
  isMonorepo: boolean;
  releaseVersion: ReleaseVersion;
};

/**
 * Given a SemVer version object, interprets the "major" part of the version
 * as the ordinary release number and the "minor" part as the backport release
 * number in the context of the ordinary release.
 *
 * @param packageVersion - The version of the package.
 * @returns An object containing the ordinary and backport numbers in the
 * version.
 */
function examineReleaseVersion(packageVersion: SemVer): ReleaseVersion {
  return {
    ordinaryNumber: packageVersion.major,
    backportNumber: packageVersion.minor,
  };
}

/**
 * List the workspaces in a monorepo using Yarn.
 *
 * @param projectDirectoryPath - The path to the project.
 * @returns An array of objects that represent the workspaces.
 */
export async function listWorkspaces(projectDirectoryPath: string) {
  const stdout = await getLinesFromCommand(
    'yarn',
    ['workspaces', 'list', '--json'],
    {
      cwd: projectDirectoryPath,
    },
  );

  return stdout
    .map((line) => JSON.parse(line) as YarnWorkspace)
    .filter(({ location }) => location !== '.');
}

/**
 * Collects information about a monorepo — its root package as well as any
 * packages within workspaces specified via the root `package.json`.
 *
 * @param projectDirectoryPath - The path to the project.
 * @param args - Additional arguments.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns An object that represents information about the project.
 * @throws if the project does not contain a root `package.json` (polyrepo and
 * monorepo) or if any of the workspaces specified in the root `package.json` do
 * not have `package.json`s (monorepo only).
 */
export async function readProject(
  projectDirectoryPath: string,
  { stderr }: { stderr: WriteStreamLike },
): Promise<Project> {
  const repositoryUrl = await getRepositoryHttpsUrl(projectDirectoryPath);
  const tagNames = await getTagNames(projectDirectoryPath);
  const rootPackage = await readMonorepoRootPackage({
    packageDirectoryPath: projectDirectoryPath,
    projectDirectoryPath,
    projectTagNames: tagNames,
  });
  const releaseVersion = examineReleaseVersion(
    rootPackage.validatedManifest.version,
  );

  const workspaceDirectories = await listWorkspaces(projectDirectoryPath);

  const workspacePackages = (
    await Promise.all(
      workspaceDirectories.map(async ({ location }) => {
        return await readMonorepoWorkspacePackage({
          packageDirectoryPath: resolve(projectDirectoryPath, location),
          rootPackageName: rootPackage.validatedManifest.name,
          rootPackageVersion: rootPackage.validatedManifest.version,
          projectDirectoryPath,
          projectTagNames: tagNames,
          stderr,
        });
      }),
    )
  ).reduce((obj, pkg) => {
    return { ...obj, [pkg.validatedManifest.name]: pkg };
  }, {} as Record<string, Package>);

  const isMonorepo = Object.keys(workspacePackages).length > 0;

  return {
    directoryPath: projectDirectoryPath,
    repositoryUrl,
    rootPackage,
    workspacePackages,
    isMonorepo,
    releaseVersion,
  };
}
