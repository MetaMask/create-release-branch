import fs, { WriteStream } from 'fs';
import path from 'path';
import { format } from 'util';
import { parseChangelog, updateChangelog } from '@metamask/auto-changelog';
import { format as formatPrettier } from 'prettier/standalone';
import * as markdown from 'prettier/plugins/markdown';
import { WriteStreamLike, readFile, writeFile, writeJsonFile } from './fs.js';
import { isErrorWithCode } from './misc-utils.js';
import {
  readPackageManifest,
  UnvalidatedPackageManifest,
  ValidatedPackageManifest,
} from './package-manifest.js';
import { Project } from './project.js';
import { PackageReleasePlan } from './release-plan.js';
import { hasChangesInDirectorySinceGitTag } from './repo.js';
import { SemVer } from './semver.js';

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
export type Package = {
  directoryPath: string;
  manifestPath: string;
  unvalidatedManifest: UnvalidatedPackageManifest;
  validatedManifest: ValidatedPackageManifest;
  changelogPath: string;
  hasChangesSinceLatestRelease: boolean;
};

/**
 * Generates the possible Git tag name for the root package of a monorepo. The
 * only tag name in use at this time is "v" + the package version.
 *
 * @param packageVersion - The version of the package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoRootPackageReleaseTagName(packageVersion: string) {
  return `v${packageVersion}`;
}

/**
 * Generates a possible Git tag name for the workspace package of a monorepo.
 * Accounts for changes to `action-publish-release`, which going forward will
 * generate tags for workspace packages in `PACKAGE_NAME@MAJOR.MINOR.PATCH`.
 *
 * @param packageName - The name of the package.
 * @param packageVersion - The version of the package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoWorkspacePackageReleaseTagName(
  packageName: string,
  packageVersion: string,
) {
  return `${packageName}@${packageVersion}`;
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
  const { unvalidated: unvalidatedManifest, validated: validatedManifest } =
    await readPackageManifest(manifestPath);
  const expectedTagNameForLatestRelease =
    generateMonorepoRootPackageReleaseTagName(
      validatedManifest.version.toString(),
    );
  const matchingTagNameForLatestRelease = projectTagNames.find(
    (tagName) => tagName === expectedTagNameForLatestRelease,
  );

  if (
    projectTagNames.length > 0 &&
    matchingTagNameForLatestRelease === undefined
  ) {
    throw new Error(
      format(
        'The package %s has no Git tag for its current version %s (expected %s), so this tool is unable to determine whether it should be included in this release. You will need to create a tag for this package in order to proceed.',
        validatedManifest.name,
        validatedManifest.version,
        `"${expectedTagNameForLatestRelease}"`,
      ),
    );
  }

  const hasChangesSinceLatestRelease =
    matchingTagNameForLatestRelease === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          expectedTagNameForLatestRelease,
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
 * @param args.rootPackageName - The name of the root package within the
 * monorepo to which this package belongs.
 * @param args.rootPackageVersion - The version of the root package within the
 * monorepo to which this package belongs.
 * @param args.projectDirectoryPath - The path to the project directory.
 * @param args.projectTagNames - The tag names across the whole project.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns Information about the package.
 */
export async function readMonorepoWorkspacePackage({
  packageDirectoryPath,
  rootPackageName,
  rootPackageVersion,
  projectDirectoryPath,
  projectTagNames,
  stderr,
}: {
  packageDirectoryPath: string;
  rootPackageName: string;
  rootPackageVersion: SemVer;
  projectDirectoryPath: string;
  projectTagNames: string[];
  stderr: WriteStreamLike;
}): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);
  const { unvalidated: unvalidatedManifest, validated: validatedManifest } =
    await readPackageManifest(manifestPath);
  const expectedTagNameForWorkspacePackageLatestRelease =
    generateMonorepoWorkspacePackageReleaseTagName(
      validatedManifest.name,
      validatedManifest.version.toString(),
    );
  const expectedTagNameForRootPackageLatestRelease =
    generateMonorepoRootPackageReleaseTagName(rootPackageVersion.toString());
  const matchingTagNameForWorkspacePackageLatestRelease = projectTagNames.find(
    (tagName) => tagName === expectedTagNameForWorkspacePackageLatestRelease,
  );
  const matchingTagNameForRootPackageLatestRelease = projectTagNames.find(
    (tagName) => tagName === expectedTagNameForRootPackageLatestRelease,
  );
  const matchingTagNameForLatestRelease =
    matchingTagNameForWorkspacePackageLatestRelease ??
    matchingTagNameForRootPackageLatestRelease;

  if (
    projectTagNames.length > 0 &&
    matchingTagNameForLatestRelease === undefined
  ) {
    throw new Error(
      format(
        'The current release of workspace package %s, %s, has no corresponding Git tag %s, and the current release of root package %s, %s, has no tag %s. Hence, this tool is unable to know whether the workspace package changed and should be included in this release. You will need to create tags for both of these packages in order to proceed.',
        validatedManifest.name,
        validatedManifest.version,
        `"${expectedTagNameForWorkspacePackageLatestRelease}"`,
        rootPackageName,
        rootPackageVersion,
        `"${expectedTagNameForRootPackageLatestRelease}"`,
      ),
    );
  }

  if (
    matchingTagNameForWorkspacePackageLatestRelease === undefined &&
    matchingTagNameForRootPackageLatestRelease !== undefined
  ) {
    stderr.write(
      format(
        'WARNING: Could not determine changes for workspace package %s version %s based on Git tag %s; using tag for root package %s version %s, %s, instead.\n',
        validatedManifest.name,
        validatedManifest.version,
        `"${expectedTagNameForWorkspacePackageLatestRelease}"`,
        rootPackageName,
        rootPackageVersion,
        `"${expectedTagNameForRootPackageLatestRelease}"`,
      ),
    );
  }

  const hasChangesSinceLatestRelease =
    matchingTagNameForLatestRelease === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          matchingTagNameForLatestRelease,
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
 * Migrate all unreleased changes to a release section.
 *
 * Changes are migrated in their existing categories, and placed above any
 * pre-existing changes in that category.
 *
 * @param args - The arguments.
 * @param args.project - The project.
 * @param args.package - A particular package in the project.
 * @param args.version - The release version to migrate unreleased changes to.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns The result of writing to the changelog.
 */
export async function migrateUnreleasedChangelogChangesToRelease({
  project: { repositoryUrl },
  package: pkg,
  version,
  stderr,
}: {
  project: Pick<Project, 'directoryPath' | 'repositoryUrl'>;
  package: Package;
  version: string;
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

  const changelog = parseChangelog({
    changelogContent,
    repoUrl: repositoryUrl,
    tagPrefix: `${pkg.validatedManifest.name}@`,
    formatter: formatChangelog,
  });

  changelog.addRelease({ version });
  changelog.migrateUnreleasedChangesToRelease(version);
  await writeFile(pkg.changelogPath, await changelog.toString());
}

/**
 * Format the given changelog using Prettier. This is extracted into a separate
 * function for coverage purposes.
 *
 * @param changelog - The changelog to format.
 * @returns The formatted changelog.
 */
export async function formatChangelog(changelog: string) {
  return await formatPrettier(changelog, {
    parser: 'markdown',
    plugins: [markdown],
  });
}

/**
 * Updates the changelog file of the given package using
 * `@metamask/auto-changelog`. Assumes that the changelog file is located at the
 * package root directory and named "CHANGELOG.md".
 *
 * @param args - The arguments.
 * @param args.project - The project.
 * @param args.package - A particular package in the project.
 * @param args.stderr - A stream that can be used to write to standard error.
 * @returns The result of writing to the changelog.
 */
export async function updatePackageChangelog({
  project: { repositoryUrl },
  package: pkg,
  stderr,
}: {
  project: Pick<Project, 'directoryPath' | 'repositoryUrl'>;
  package: Package;
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
    // Setting `isReleaseCandidate` to false because `updateChangelog` requires a
    // specific version number when this flag is true, and the package release version
    // is not determined at this stage of the process.
    isReleaseCandidate: false,
    projectRootDirectory: pkg.directoryPath,
    repoUrl: repositoryUrl,
    tagPrefixes: [`${pkg.validatedManifest.name}@`, 'v'],
    formatter: formatChangelog,
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
 * Updates the package by replacing the `version` field in the manifest
 * according to the one in the given release plan. Also updates the
 * changelog by migrating changes in the Unreleased section to the section
 * representing the new version.
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
  const { package: pkg, newVersion } = packageReleasePlan;

  await writeJsonFile(pkg.manifestPath, {
    ...pkg.unvalidatedManifest,
    version: newVersion,
  });

  await migrateUnreleasedChangelogChangesToRelease({
    project,
    package: pkg,
    stderr,
    version: newVersion,
  });
}
