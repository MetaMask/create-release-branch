import util from 'util';
import glob from 'glob';
import { getRepositoryHttpsUrl } from './git-utils';
import { Package, readPackage } from './package-utils';
import { ManifestFieldNames } from './package-manifest-utils';
import { SemVer } from './semver-utils';

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
  releaseInfo: ReleaseInfo;
}

interface ReleaseInfo {
  releaseDate: Date;
  releaseNumber: number;
}

const promisifiedGlob = util.promisify(glob);

/**
 * Reads a version string from a SemVer object and extracts the release date and
 * release number from it.
 *
 * @param version - The SemVer object.
 * @returns An object containing the release date and release number from the
 * version string, or null if neither could be extracted.
 */
function parseReleaseInfoFrom(version: SemVer): ReleaseInfo | null {
  const match = version.toString().match(/^(\d{4})(\d{2})(\d{2})\.(\d+)\.0$/u);

  if (match) {
    const year = Number(match[1]);
    const monthNumber = Number(match[2]);
    const day = Number(match[3]);
    const releaseDate = new Date(year, monthNumber - 1, day, 0, 0, 0);
    const releaseNumber = Number(match[4]);

    if (
      !isNaN(releaseDate.getTime()) &&
      releaseDate.getFullYear() === year &&
      releaseDate.getMonth() === monthNumber - 1 &&
      releaseDate.getDate() === day
    ) {
      return { releaseDate, releaseNumber };
    }
  }

  return null;
}

/**
 * Collects information about a project. For a polyrepo, this information will
 * only cover the project's `package.json` file; for a monorepo, it will cover
 * `package.json` files for any workspaces that the monorepo defines.
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
  const rootPackage = await readPackage(projectDirectoryPath);
  const releaseInfo = parseReleaseInfoFrom(
    rootPackage.validatedManifest.version,
  );

  if (releaseInfo === null) {
    throw new Error(
      `Could not extract release date and/or release version from package "${rootPackage.validatedManifest.name}" version "${rootPackage.validatedManifest.version}". Version must be in "<yyyymmdd>.<release-version>.0" format.`,
    );
  }

  const workspaceDirectories = (
    await Promise.all(
      rootPackage.validatedManifest[ManifestFieldNames.Workspaces].map(
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
        return await readPackage(directory);
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
    releaseInfo,
  };
}
