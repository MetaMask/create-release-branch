import fs, { WriteStream } from 'fs';
import path from 'path';
import { updateChangelog } from '@metamask/auto-changelog';
import { isErrorWithCode } from './misc-utils';
import { readFile, writeFile, writeJsonFile } from './file-utils';
import { hasChangesInDirectorySinceGitTag } from './git-utils';
import { Project } from './project-utils';
import {
  readManifest,
  UnvalidatedManifest,
  ValidatedManifest,
} from './package-manifest-utils';
import { PackageReleasePlan } from './release-plan-utils';
import { SemVer } from './semver-utils';

const MANIFEST_FILE_NAME = 'package.json';
const CHANGELOG_FILE_NAME = 'CHANGELOG.md';

/**
 * Information about a package within a project.
 *
 * @property directoryPath - The path to the directory where the package is
 * located.
 * @property manifestPath - The path to the manifest file.
 * @property manifest - The data extracted from the manifest.
 * @property changelogPath - The path to the changelog file (which may or may
 * not exist).
 */
export interface Package {
  directoryPath: string;
  manifestPath: string;
  unvalidatedManifest: UnvalidatedManifest;
  validatedManifest: ValidatedManifest;
  changelogPath: string;
  hasChangesSinceLatestRelease: boolean;
}

/**
 * Generates possible Git tag names for the root package of a monorepo. Accounts
 * for this tool (which generates tags in `YYYYMMDD.RELEASE_NUMBER.0` format) as
 * well as `action-create-release-pr` (which generates tags in
 * `vMAJOR.MINOR.PATCH` format).
 *
 * @param packageVersion - The version of the package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoRootPackageReleaseTagNames(packageVersion: string) {
  return [packageVersion, `v${packageVersion}`];
}

/**
 * Generates possible Git tag names for the workspace package of a monorepo.
 * Accounts for this tool (which generates tags for workspace packages in
 * `PACKAGE_NAME/MAJOR.MINOR.PATCH` format) as well as
 * `action-create-release-pr` (which does not generate tags for workspace
 * packages, but does generate tags for root packages in `vMAJOR.MINOR.PATCH`
 * format).
 *
 * @param packageName - The name of the package.
 * @param packageVersion - The version of the package.
 * @param rootPackageVersion - The version of the root package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoWorkspacePackageReleaseTagNames(
  packageName: string,
  packageVersion: string,
  rootPackageVersion: SemVer,
) {
  return [
    `${packageName}@${packageVersion}`,
    `v${rootPackageVersion.toString()}`,
  ];
}

/**
 * Collects information about the root package of a monorepo.
 *
 * @param args - The arguments to this function.
 * @param args.packageDirectoryPath - The path to a package within a project.
 * @param args.projectDirectoryPath - The path to the project directory.
 * @param args.projectTagNames - The tag names across the whole project.
 * @returns Information about the package.
 */
export async function readMonorepoRootPackage({
  packageDirectoryPath,
  projectDirectoryPath,
  projectTagNames,
}: {
  packageDirectoryPath: string;
  projectDirectoryPath: string;
  projectTagNames: string[];
}): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);
  const { unvalidatedManifest, validatedManifest } = await readManifest(
    manifestPath,
  );
  const expectedReleaseTagNames = generateMonorepoRootPackageReleaseTagNames(
    validatedManifest.version.toString(),
  );
  const matchingTagName = expectedReleaseTagNames.find((tagName) => {
    return projectTagNames.includes(tagName);
  });
  // TODO: Print a warning if allTagNames.length > 0 but matchingTagName ===
  // undefined?
  const hasChangesSinceLatestRelease =
    matchingTagName === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          matchingTagName,
        );

  return {
    directoryPath: packageDirectoryPath,
    manifestPath,
    validatedManifest,
    unvalidatedManifest,
    changelogPath,
    hasChangesSinceLatestRelease,
  };
}

/**
 * Collects information about a workspace package within a monorepo.
 *
 * @param args - The arguments to this function.
 * @param args.packageDirectoryPath - The path to a package within a project.
 * @param args.rootPackageVersion - The version of the root package of the
 * monorepo to which this package belongs.
 * @param args.projectDirectoryPath - The path to the project directory.
 * @param args.projectTagNames - The tag names across the whole project.
 * @returns Information about the package.
 */
export async function readMonorepoWorkspacePackage({
  packageDirectoryPath,
  rootPackageVersion,
  projectDirectoryPath,
  projectTagNames,
}: {
  packageDirectoryPath: string;
  rootPackageVersion: SemVer;
  projectDirectoryPath: string;
  projectTagNames: string[];
}): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);
  const { unvalidatedManifest, validatedManifest } = await readManifest(
    manifestPath,
  );
  const expectedReleaseTagNames =
    generateMonorepoWorkspacePackageReleaseTagNames(
      validatedManifest.name,
      validatedManifest.version.toString(),
      rootPackageVersion,
    );
  const matchingTagName = expectedReleaseTagNames.find((tagName) => {
    return projectTagNames.includes(tagName);
  });
  // TODO: Print a warning if allTagNames.length > 0 but matchingTagName ===
  // undefined?
  const hasChangesSinceLatestRelease =
    matchingTagName === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          matchingTagName,
        );

  return {
    directoryPath: packageDirectoryPath,
    manifestPath,
    validatedManifest,
    unvalidatedManifest,
    changelogPath,
    hasChangesSinceLatestRelease,
  };
}

/**
 * Updates the changelog file of the given package using
 * `@metamask/auto-changelog`. Assumes that the changelog file is located at the
 * package root directory and named "CHANGELOG.md".
 *
 * @param args - The arguments.
 * @param args.project - The project.
 * @param args.packageReleasePlan - The release plan for a particular package in
 * the project.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns The result of writing to the changelog.
 */
async function updatePackageChangelog({
  project: { repositoryUrl },
  packageReleasePlan: { package: pkg, newVersion },
  stderr,
}: {
  project: Pick<Project, 'directoryPath' | 'repositoryUrl'>;
  packageReleasePlan: PackageReleasePlan;
  stderr: Pick<WriteStream, 'write'>;
}): Promise<void> {
  let changelogContent;

  try {
    changelogContent = await readFile(pkg.changelogPath);
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      stderr.write(
        `${pkg.validatedManifest.name} does not seem to have a changelog. Skipping.\n`,
      );
      return;
    }

    throw error;
  }

  const newChangelogContent = await updateChangelog({
    changelogContent,
    currentVersion: newVersion,
    isReleaseCandidate: true,
    projectRootDirectory: pkg.directoryPath,
    repoUrl: repositoryUrl,
  });

  if (newChangelogContent) {
    await writeFile(pkg.changelogPath, newChangelogContent);
  } else {
    stderr.write(
      `Changelog for ${pkg.validatedManifest.name} was not updated as there were no updates to make.`,
    );
  }
}

/**
 * Updates the package as per the instructions in the given release plan by
 * replacing the `version` field in the manifest and adding a new section to the
 * changelog for the new version of the package.
 *
 * @param args - The project.
 * @param args.project - The project.
 * @param args.packageReleasePlan - The release plan for a particular package in the
 * project.
 * @param args.stderr - A stream that can be used to write to standard error.
 * Defaults to /dev/null.
 */
export async function updatePackage({
  project,
  packageReleasePlan,
  stderr = fs.createWriteStream('/dev/null'),
}: {
  project: Pick<Project, 'directoryPath' | 'repositoryUrl'>;
  packageReleasePlan: PackageReleasePlan;
  stderr?: Pick<WriteStream, 'write'>;
}): Promise<void> {
  const {
    package: pkg,
    newVersion,
    shouldUpdateChangelog,
  } = packageReleasePlan;

  await writeJsonFile(pkg.manifestPath, {
    ...pkg.unvalidatedManifest,
    version: newVersion,
  });

  if (shouldUpdateChangelog) {
    await updatePackageChangelog({ project, packageReleasePlan, stderr });
  }
}
