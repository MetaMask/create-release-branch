import util from 'util';
import glob from 'glob';
import {
  Package,
  readMonorepoRootPackage,
  readMonorepoWorkspacePackage,
} from './package';
import { PackageManifestFieldNames } from './package-manifest';
import { getRepositoryHttpsUrl, getTagNames } from './repo';
import { SemVer } from './semver';

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
interface ReleaseVersion {
  ordinaryNumber: number;
  backportNumber: number;
}

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
export interface Project {
  directoryPath: string;
  repositoryUrl: string;
  rootPackage: Package;
  workspacePackages: Record<string, Package>;
  isMonorepo: boolean;
  releaseVersion: ReleaseVersion;
}

/**
 * A promisified version of `glob`.
 */
const promisifiedGlob = util.promisify(glob);

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
 * Collects information about a project. For a polyrepo package, this
 * information will only cover the project's `package.json` file; for a
 * monorepo, it will cover `package.json` files for any workspaces that the
 * monorepo defines.
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

  const workspaceDirectories = (
    await Promise.all(
      rootPackage.validatedManifest[PackageManifestFieldNames.Workspaces].map(
        async (workspacePattern) => {
          return await promisifiedGlob(workspacePattern, {
            cwd: projectDirectoryPath,
            absolute: true,
          });
        },
      ),
    )
  ).flat();

  const workspacePackages = (
    await Promise.all(
      workspaceDirectories.map(async (directory) => {
        return await readMonorepoWorkspacePackage({
          packageDirectoryPath: directory,
          rootPackageName: rootPackage.validatedManifest.name,
          rootPackageVersion: rootPackage.validatedManifest.version,
          projectDirectoryPath,
          projectTagNames: tagNames,
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
