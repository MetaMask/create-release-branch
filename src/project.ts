import util from 'util';
import glob from 'glob';
import { Package, readPackage } from './package';
import { PackageManifestFieldNames } from './package-manifest';
import { getRepositoryHttpsUrl } from './repo';

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

/**
 * Information about the release of the root package of a monorepo extracted
 * from its version string.
 *
 * @property releaseDate - The release date.
 * @property releaseNumber - The release number (starting from 1).
 */
interface ReleaseInfo {
  releaseDate: Date;
  releaseNumber: number;
}

/**
 * A promisified version of `glob`.
 */
const promisifiedGlob = util.promisify(glob);

/**
 * Reads a version string from a SemVer object and extracts the release date and
 * release number from it.
 *
 * @param packageVersionString - The version string of the package.
 * @param packageName - The name of the package.
 * @returns An object containing the release date and release number from the
 * version string.
 * @throws If the version string is invalid in some way.
 */
function parseReleaseInfoFrom(
  packageVersionString: string,
  packageName: string,
): ReleaseInfo {
  const match = packageVersionString.match(
    /^(?<releaseDateString>(?<releaseYearString>\d{4})(?<releaseMonthString>\d{2})(?<releaseDayString>\d{2}))\.(?<releaseNumberString>\d+)\.0$/u,
  );
  const errorMessagePrefix = `Could not extract release info from package "${packageName}" version "${packageVersionString}"`;

  if (match?.groups) {
    const releaseYear = Number(match.groups.releaseYearString);
    const releaseMonthNumber = Number(match.groups.releaseMonthString);
    const releaseDay = Number(match.groups.releaseDayString);
    const releaseDate = new Date(
      releaseYear,
      releaseMonthNumber - 1,
      releaseDay,
      0,
      0,
      0,
    );
    const releaseNumber = Number(match.groups.releaseNumberString);

    if (
      isNaN(releaseDate.getTime()) ||
      releaseDate.getFullYear() !== releaseYear ||
      releaseDate.getMonth() !== releaseMonthNumber - 1 ||
      releaseDate.getDate() !== releaseDay
    ) {
      throw new Error(
        `${errorMessagePrefix}: "${match.groups.releaseDateString}" must be a valid date in "<yyyy><mm><dd>" format.`,
      );
    }

    if (releaseNumber === 0) {
      throw new Error(
        `${errorMessagePrefix}: Release version must be greater than 0.`,
      );
    }

    return { releaseDate, releaseNumber };
  }

  throw new Error(
    `${errorMessagePrefix}: Must be in "<yyyymmdd>.<release-version>.0" format.`,
  );
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
    rootPackage.validatedManifest.version.toString(),
    rootPackage.validatedManifest.name,
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
