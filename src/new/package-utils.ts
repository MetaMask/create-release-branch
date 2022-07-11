import path from 'path';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
} from '@metamask/action-utils';
import { updateChangelog } from '@metamask/auto-changelog';
import type { Require } from './utils';
import { isErrorWithCode, isTruthyString, knownKeysOf } from './utils';
import {
  readFile,
  writeFile,
  readJsonObjectFile,
  writeJsonFile,
} from './file-utils';
import { Project } from './project-utils';
import { isValidSemver, semver, SemVer } from './semver-utils';
import { PackageReleasePlan } from './workflow-utils';

export interface UpdateSpecification {
  readonly newVersion: string;
  readonly repositoryUrl: string;
  readonly shouldUpdateChangelog: boolean;
}

export interface MonorepoUpdateSpecification extends UpdateSpecification {
  readonly packagesToUpdate: ReadonlySet<string>;
  readonly synchronizeVersions: boolean;
}

export { ManifestFieldNames };

// TODO: Move this to action-utils
interface UnvalidatedManifest
  extends Readonly<
    Partial<Record<ManifestDependencyFieldNames, Record<string, string>>>
  > {
  readonly [ManifestFieldNames.Name]?: string;
  readonly [ManifestFieldNames.Version]?: string;
  readonly [ManifestFieldNames.Private]?: boolean;
  readonly [ManifestFieldNames.Workspaces]?: string[];
}

// TODO: Move this to action-utils
type ValidatedManifest = Require<
  Omit<UnvalidatedManifest, ManifestFieldNames.Version>,
  | ManifestFieldNames.Name
  | ManifestFieldNames.Private
  | ManifestFieldNames.Workspaces
  | ManifestDependencyFieldNames
> & { [ManifestFieldNames.Version]: SemVer };

// TODO: Move this to action-utils
interface UnvalidatedManifestFile {
  path: string;
  parentDirectory: string;
  data: UnvalidatedManifest;
}

// TODO: Move this to action-utils
interface ValidatedManifestFile {
  path: string;
  parentDirectory: string;
  data: ValidatedManifest;
}

export interface Package {
  directoryPath: string;
  manifestPath: string;
  manifest: ValidatedManifest;
  changelogPath: string;
}

const MANIFEST_FILE_NAME = 'package.json';
const CHANGELOG_FILE_NAME = 'CHANGELOG.md';

/**
 * Type guard to ensure that the given manifest has a valid "name" field.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns Whether the manifest has a valid "name" field.
 */
function hasValidNameField<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): manifestFile is F & { data: Require<F['data'], ManifestFieldNames.Name> } {
  return isTruthyString(manifestFile.data[ManifestFieldNames.Name]);
}

/**
 * Type guard to ensure that the given manifest has a valid "version" field.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @param usingSemver - Whether or not to check that the version is not only
 * present but also conforms to SemVer.
 * @returns Whether the manifest has a valid "version" field.
 */
function hasValidVersionField<F extends UnvalidatedManifestFile>(
  manifestFile: F,
  usingSemver: boolean,
): manifestFile is F & {
  data: Require<F['data'], ManifestFieldNames.Version>;
} {
  const version = manifestFile.data[ManifestFieldNames.Version];
  return isTruthyString(version) && (!usingSemver || isValidSemver(version));
}

/**
 * Validates the "name" field of a package manifest object, i.e. a parsed
 * "package.json" file.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns The unmodified manifest file, with the "name" field typed correctly.
 */
function validateManifestName<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): F & {
  data: Require<F['data'], ManifestFieldNames.Name>;
} {
  if (!hasValidNameField(manifestFile)) {
    throw new Error(
      `Manifest in "${manifestFile.parentDirectory}" does not have a valid "${ManifestFieldNames.Name}" field.`,
    );
  }

  return manifestFile;
}

/**
 * Gets the prefix of an error message for a manifest file validation error.
 *
 * TODO: Remove when others are moved to action-utils.
 *
 * @param manifestFile - The manifest file that's invalid.
 * @param invalidField - The name of the invalid field.
 * @returns The prefix of a manifest validation error message.
 */
function getManifestErrorMessagePrefix(
  manifestFile: UnvalidatedManifestFile,
  invalidField: ManifestFieldNames,
) {
  return `${
    manifestFile.data[ManifestFieldNames.Name]
      ? `"${
          manifestFile.data[ManifestFieldNames.Name]
        }" manifest "${invalidField}"`
      : `"${invalidField}" of manifest in "${manifestFile.parentDirectory}"`
  }`;
}

/**
 * Validates the "version" field of a package manifest object, i.e. a parsed
 * "package.json" file.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @param options - The options.
 * @param options.usingSemver - Whether or not to check that the version is
 * not only present but also conforms to SemVer.
 * @returns The unmodified manifest file, with the "version" field typed correctly.
 */
function validateManifestVersion<F extends UnvalidatedManifestFile>(
  manifestFile: F,
  { usingSemver }: { usingSemver: boolean },
): F & {
  data: Require<F['data'], ManifestFieldNames.Version>;
} {
  if (!hasValidVersionField(manifestFile, usingSemver)) {
    throw new Error(
      `${getManifestErrorMessagePrefix(
        manifestFile,
        ManifestFieldNames.Version,
      )} is not a valid SemVer version: ${
        manifestFile.data[ManifestFieldNames.Version]
      }`,
    );
  }

  return manifestFile;
}

/**
 * Verifies key data within the manifest of a package, throwing if that data is
 * incomplete.
 *
 * TODO: Move this to action-utils.
 *
 * @param unvalidatedManifestFile - Information about the manifest for a
 * package.
 * @param options - The options.
 * @param options.expectSemverVersion - Whether or not to check that the
 * version is not only present but also conforms to SemVer.
 * @returns Information about a correctly typed version of the manifest for a
 * package.
 */
async function validateManifest(
  unvalidatedManifestFile: UnvalidatedManifestFile,
  { expectSemverVersion }: { expectSemverVersion: boolean },
): Promise<ValidatedManifestFile> {
  const manifestFileWithKnownName = validateManifestName(
    unvalidatedManifestFile,
  );
  const manifestFileWithKnownVersion = validateManifestVersion(
    manifestFileWithKnownName,
    { usingSemver: expectSemverVersion },
  );
  const rawVersion =
    manifestFileWithKnownVersion.data[ManifestFieldNames.Version];
  const parsedVersion = semver.parse(rawVersion);

  if (parsedVersion === null) {
    throw new Error(`Root package has invalid version "${rawVersion}"`);
  }

  return {
    ...unvalidatedManifestFile,
    data: {
      [ManifestFieldNames.Name]:
        manifestFileWithKnownName.data[ManifestFieldNames.Name],
      [ManifestFieldNames.Version]: parsedVersion,
      [ManifestFieldNames.Workspaces]:
        unvalidatedManifestFile.data[ManifestFieldNames.Workspaces] ?? [],
      [ManifestFieldNames.Private]:
        unvalidatedManifestFile.data[ManifestFieldNames.Private] ?? false,
      ...knownKeysOf(ManifestDependencyFieldNames).reduce((obj, key) => {
        return {
          ...obj,
          [key]:
            unvalidatedManifestFile.data[ManifestDependencyFieldNames[key]] ??
            {},
        };
      }, {} as Record<ManifestDependencyFieldNames, Record<string, string>>),
    },
  };
}

/**
 * Collects information about a package.
 *
 * @param packageDirectoryPath - The path to the package within a project.
 * @param options - The options.
 * @param options.expectSemverVersion - Whether or not to check that the
 * version is not only present but also conforms to SemVer.
 * @returns Information about the package.
 */
export async function readPackage(
  packageDirectoryPath: string,
  { expectSemverVersion }: { expectSemverVersion: boolean },
): Promise<Package> {
  const manifestPath = path.join(packageDirectoryPath, MANIFEST_FILE_NAME);
  const changelogPath = path.join(packageDirectoryPath, CHANGELOG_FILE_NAME);

  const unvalidatedManifest = await readJsonObjectFile(manifestPath);
  const unvalidatedManifestFile = {
    parentDirectory: packageDirectoryPath,
    path: manifestPath,
    data: unvalidatedManifest,
  };
  const validatedManifestFile = await validateManifest(
    unvalidatedManifestFile,
    { expectSemverVersion },
  );

  return {
    directoryPath: packageDirectoryPath,
    manifestPath,
    manifest: validatedManifestFile.data,
    changelogPath,
  };
}

/**
 * Updates the changelog file of the given package, using
 * `@metamask/auto-changelog`. Assumes that the changelog file is located at the
 * package root directory and named "CHANGELOG.md".
 *
 * @param project - The project.
 * @param packageReleasePlan - The package release plan.
 * @param packageReleasePlan.package - The package to update.
 * @param packageReleasePlan.newVersion - The new version.
 * @returns The result of writing to the changelog.
 */
async function updatePackageChangelog(
  project: Project,
  { package: pkg, newVersion }: PackageReleasePlan,
): Promise<void> {
  let changelogContent;

  try {
    changelogContent = await readFile(pkg.changelogPath);
  } catch (error) {
    // If the error is not a file not found error, throw it
    if (!isErrorWithCode(error) || error.code !== 'ENOENT') {
      console.error(`Failed to read changelog in "${project.directoryPath}".`);
      throw error;
    } else {
      console.warn(`Failed to read changelog in "${project.directoryPath}".`);
      return;
    }
  }

  const newChangelogContent = await updateChangelog({
    changelogContent,
    currentVersion: newVersion,
    isReleaseCandidate: true,
    projectRootDirectory: pkg.directoryPath,
    repoUrl: project.repositoryUrl,
  });

  if (newChangelogContent) {
    await writeFile(pkg.changelogPath, newChangelogContent);
  } else {
    throw new Error(
      `"updateChangelog" returned an empty value for package ${pkg.manifest.name}.`,
    );
  }
}

/**
 * Updates the manifest and changelog of the given package per the update
 * specification and writes the changes to disk. The following changes are made
 * to the manifest:
 *
 * - The "version" field is replaced with the new version.
 * - If package versions are being synchronized, updates their version ranges
 * wherever they appear as dependencies.
 *
 * @param project - The project.
 * @param packageReleasePlan - The package release plan.
 * @param packageReleasePlan.manifestFile - The manifest file.
 * @param packageReleasePlan.newVersion - The new version.
 * @param packageReleasePlan.shouldUpdateChangelog - Whether the changelog
 * should be updated.
 */
export async function updatePackage(
  project: Project,
  packageReleasePlan: PackageReleasePlan,
): Promise<void> {
  const {
    package: pkg,
    newVersion,
    shouldUpdateChangelog,
  } = packageReleasePlan;

  await writeJsonFile(pkg.manifestPath, {
    ...pkg.manifest,
    version: newVersion,
  });

  if (shouldUpdateChangelog) {
    await updatePackageChangelog(project, packageReleasePlan);
  }
}
