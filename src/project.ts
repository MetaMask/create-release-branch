import { WriteStream } from 'fs';
import { resolve } from 'path';
import { getWorkspaceLocations } from '@metamask/action-utils';
import { WriteStreamLike, fileExists } from './fs.js';
import {
  Package,
  readMonorepoRootPackage,
  readMonorepoWorkspacePackage,
  updatePackageChangelog,
} from './package.js';
import { getRepositoryHttpsUrl, getTagNames, restoreFiles } from './repo.js';
import { SemVer } from './semver.js';
import { PackageManifestFieldNames } from './package-manifest.js';
import { ReleaseSpecification } from './release-specification.js';

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
  ).reduce(
    (obj, pkg) => {
      return { ...obj, [pkg.validatedManifest.name]: pkg };
    },
    {} as Record<string, Package>,
  );

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

/**
 * Updates the changelog files of all packages that have changes since latest release to include those changes.
 *
 * @param args - The arguments.
 * @param args.project - The project.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns The result of writing to the changelog.
 */
export async function updateChangelogsForChangedPackages({
  project,
  stderr,
}: {
  project: Pick<
    Project,
    'directoryPath' | 'repositoryUrl' | 'workspacePackages'
  >;
  stderr: Pick<WriteStream, 'write'>;
}): Promise<void> {
  await Promise.all(
    Object.values(project.workspacePackages)
      .filter(
        ({ hasChangesSinceLatestRelease }) => hasChangesSinceLatestRelease,
      )
      .map((pkg) =>
        updatePackageChangelog({
          project,
          package: pkg,
          stderr,
        }),
      ),
  );
}

/**
 * Restores the changelogs of unreleased packages which has changes since latest release.
 *
 * @param args - The arguments.
 * @param args.project - The project.
 * @param args.releaseSpecification - A parsed version of the release spec
 * entered by the user.
 * @param args.defaultBranch - The name of the default branch in the repository.
 * @returns The result of writing to the changelog.
 */
export async function restoreChangelogsForSkippedPackages({
  project: { directoryPath, workspacePackages },
  releaseSpecification,
  defaultBranch,
}: {
  project: Pick<
    Project,
    'directoryPath' | 'repositoryUrl' | 'workspacePackages'
  >;
  releaseSpecification: ReleaseSpecification;
  defaultBranch: string;
}): Promise<void> {
  const existingSkippedPackageChangelogPaths = (
    await Promise.all(
      Object.entries(workspacePackages).map(async ([name, pkg]) => {
        const changelogPath = pkg.changelogPath.replace(
          `${directoryPath}/`,
          '',
        );
        const shouldInclude =
          pkg.hasChangesSinceLatestRelease &&
          !releaseSpecification.packages[name] &&
          (await fileExists(pkg.changelogPath));
        return [changelogPath, shouldInclude] as const;
      }),
    )
  )
    .filter(([_, shouldInclude]) => shouldInclude)
    .map(([changelogPath]) => changelogPath);

  if (existingSkippedPackageChangelogPaths.length > 0) {
    await restoreFiles(
      directoryPath,
      defaultBranch,
      existingSkippedPackageChangelogPaths,
    );
  }
}
