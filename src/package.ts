import fs, { WriteStream } from 'fs';
import path from 'path';
import { format } from 'util';
import { updateChangelog } from '@metamask/auto-changelog';
import { isErrorWithCode } from './misc-utils';
import { readFile, writeFile, writeJsonFile } from './fs';
import {
  readPackageManifest,
  UnvalidatedPackageManifest,
  ValidatedPackageManifest,
} from './package-manifest';
import { Project } from './project';
import { PackageReleasePlan } from './release-plan';
import { hasChangesInDirectorySinceGitTag } from './repo';
import { SemVer } from './semver';

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
  unvalidatedManifest: UnvalidatedPackageManifest;
  validatedManifest: ValidatedPackageManifest;
  changelogPath: string;
  hasChangesSinceLatestRelease: boolean;
}

/**
 * Creates a sentence by connecting the given clauses with the given connector.
 *
 * @param connector - The connector, such as "and" or "or".
 * @param clauses - The clauses.
 * @returns The full sentence.
 */
function connectClausesWith(connector: string, clauses: string[]) {
  if (clauses.length < 3) {
    return clauses.join(` ${connector} `);
  }

  return [clauses.slice(0, -1).join(`, `), clauses[clauses.length - 1]].join(
    `, ${connector}`,
  );
}

/**
 * Generates possible Git tag names for the root package of a monorepo. The only
 * tag name in use at this time is "v" + the package version.
 *
 * @param packageVersion - The version of the package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoRootPackageReleaseTagNames(packageVersion: string) {
  return [`v${packageVersion}`];
}

/**
 * Generates possible Git tag names for the workspace package of a monorepo.
 * Accounts for changes to `action-publish-release`, which going forward will
 * generate tags for workspace packages in `PACKAGE_NAME@MAJOR.MINOR.PATCH`.
 *
 * @param packageName - The name of the package.
 * @param packageVersion - The version of the package.
 * @returns An array of possible release tag names.
 */
function generateMonorepoWorkspacePackageReleaseTagNames(
  packageName: string,
  packageVersion: string,
) {
  return [`${packageName}@${packageVersion}`];
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
  const expectedReleaseTagNames = generateMonorepoRootPackageReleaseTagNames(
    validatedManifest.version.toString(),
  );
  const tagNameMatchingLatestRelease = expectedReleaseTagNames.find(
    (tagName) => {
      return projectTagNames.includes(tagName);
    },
  );

  if (
    projectTagNames.length > 0 &&
    tagNameMatchingLatestRelease === undefined
  ) {
    throw new Error(
      format(
        'The package %s has no Git tag for its current version %s (expected %s), so this tool is unable to determine whether it should be included in this release. You will need to create a tag for this package in order to proceed.',
        validatedManifest.name,
        validatedManifest.version,
        connectClausesWith(
          'or',
          expectedReleaseTagNames.map((tagName) => `"${tagName}"`),
        ),
      ),
    );
  }

  const hasChangesSinceLatestRelease =
    tagNameMatchingLatestRelease === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          tagNameMatchingLatestRelease,
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
 * @returns Information about the package.
 */
export async function readMonorepoWorkspacePackage({
  packageDirectoryPath,
  rootPackageName,
  rootPackageVersion,
  projectDirectoryPath,
  projectTagNames,
}: {
  packageDirectoryPath: string;
  rootPackageName: string;
  rootPackageVersion: SemVer;
  projectDirectoryPath: string;
  projectTagNames: string[];
}): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);
  const { unvalidated: unvalidatedManifest, validated: validatedManifest } =
    await readPackageManifest(manifestPath);
  const expectedWorkspacePackageReleaseTagNames =
    generateMonorepoWorkspacePackageReleaseTagNames(
      validatedManifest.name,
      validatedManifest.version.toString(),
    );
  const expectedRootPackageReleaseTagNames =
    generateMonorepoRootPackageReleaseTagNames(rootPackageVersion.toString());
  const tagNameMatchingLatestRelease = [
    ...expectedWorkspacePackageReleaseTagNames,
    ...expectedRootPackageReleaseTagNames,
  ].find((tagName) => {
    return projectTagNames.includes(tagName);
  });

  if (
    projectTagNames.length > 0 &&
    tagNameMatchingLatestRelease === undefined
  ) {
    throw new Error(
      format(
        'The workspace package %s has no Git tag for its current version %s (expected %s), and the root package %s has no Git tag for its current version %s (expected %s), so this tool is unable to determine whether the workspace package should be included in this release. You will need to create tags for both of these packages in order to proceed.',
        validatedManifest.name,
        validatedManifest.version,
        connectClausesWith(
          'or',
          expectedWorkspacePackageReleaseTagNames.map(
            (tagName) => `"${tagName}"`,
          ),
        ),
        rootPackageName,
        rootPackageVersion,
        connectClausesWith(
          'or',
          expectedRootPackageReleaseTagNames.map((tagName) => `"${tagName}"`),
        ),
      ),
    );
  }

  const hasChangesSinceLatestRelease =
    tagNameMatchingLatestRelease === undefined
      ? true
      : await hasChangesInDirectorySinceGitTag(
          projectDirectoryPath,
          packageDirectoryPath,
          tagNameMatchingLatestRelease,
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
