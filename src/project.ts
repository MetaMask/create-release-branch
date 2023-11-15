import { resolve } from 'path';
import { getWorkspaceLocations } from '@metamask/action-utils';
import { WriteStreamLike } from './fs';
import {
  Package,
  readMonorepoRootPackage,
  readMonorepoWorkspacePackage,
} from './package';
import { getRepositoryHttpsUrl, getTagNames } from './repo';
import { SemVer } from './semver';
import { PackageManifestFieldNames } from './package-manifest';

/**
 * The release version of the root package of a monorepo extracted from its
 * version string.
 */
export type ReleaseVersion = SemVer;

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
  const releaseVersion = rootPackage.validatedManifest.version;

  const workspaceDirectories = await getWorkspaceLocations(
    rootPackage.validatedManifest[PackageManifestFieldNames.Workspaces],
    projectDirectoryPath,
    true,
  );

  const workspacePackages = (
    await Promise.all(
      workspaceDirectories.map(async (directory) => {
        return await readMonorepoWorkspacePackage({
          packageDirectoryPath: resolve(projectDirectoryPath, directory),
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
