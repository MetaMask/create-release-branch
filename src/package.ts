import fs, { WriteStream } from 'fs';
import path from 'path';
import { updateChangelog } from '@metamask/auto-changelog';
import { isErrorWithCode } from './misc-utils';
import { readFile, writeFile, writeJsonFile } from './fs';
import {
  readPackageManifest,
  UnvalidatedPackageManifest,
  ValidatedPackageManifest,
} from './package-manifest';
import { Project } from './project';
import { PackageReleasePlan } from './workflow-operations';

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
}

/**
 * Collects information about a package.
 *
 * @param packageDirectoryPath - The path to a package within a project.
 * @returns Information about the package.
 */
export async function readPackage(
  packageDirectoryPath: string,
): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);
  const { unvalidatedManifest, validatedManifest } = await readPackageManifest(
    manifestPath,
  );

  return {
    directoryPath: packageDirectoryPath,
    manifestPath,
    validatedManifest,
    unvalidatedManifest,
    changelogPath,
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
