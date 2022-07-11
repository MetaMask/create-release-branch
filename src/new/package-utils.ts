import fs from 'fs';
import path from 'path';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
  PackageManifest,
} from '@metamask/action-utils';
import { updateChangelog } from '@metamask/auto-changelog';
import type { Require } from './utils';
import {
  isErrorWithCode,
  isErrorWithStack,
  isNullOrUndefined,
  isTruthyString,
  knownKeysOf,
} from './utils';
import { readJsonObjectFile, writeJsonFile } from './file-utils';
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

export { ManifestFieldNames, PackageManifest };

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
interface UnvalidatedManifestFile {
  path: string;
  parentDirectory: string;
  data: UnvalidatedManifest;
}

// TODO: Move this to action-utils
export interface ValidatedManifestFile {
  path: string;
  parentDirectory: string;
  data: Require<
    Omit<UnvalidatedManifest, ManifestFieldNames.Version>,
    | ManifestFieldNames.Name
    | ManifestFieldNames.Private
    | ManifestFieldNames.Workspaces
    | ManifestDependencyFieldNames
  > & { [ManifestFieldNames.Version]: SemVer };
}

const MANIFEST_FILE_NAME = 'package.json';

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
 * Type guard to ensure that the given manifest has a valid "workspaces" field.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns Whether the manifest has a valid "workspaces" field.
 */
function hasValidWorkspacesField<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): manifestFile is F & {
  data: Require<F['data'], ManifestFieldNames.Workspaces>;
} {
  return !isNullOrUndefined(manifestFile.data[ManifestFieldNames.Workspaces]);
}

/**
 * Type guard to ensure that the given manifest has a valid "private" field.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns Whether the manifest has a valid "private" field.
 */
function hasValidPrivateField<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): manifestFile is F & {
  data: Require<F['data'], ManifestFieldNames.Private>;
} {
  return !isNullOrUndefined(manifestFile.data[ManifestFieldNames.Private]);
}

/**
 * Validates the "name" field of a package manifest object, i.e. a parsed
 * "package.json" file.
 *
 * TODO: Move back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns The unmodified manifest file, with the "name" field typed correctly.
 */
export function validateManifestName<F extends UnvalidatedManifestFile>(
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
 * TODO: Move back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @param options - The options.
 * @param options.usingSemver - Whether or not to check that the version is
 * not only present but also conforms to SemVer.
 * @returns The unmodified manifest file, with the "version" field typed correctly.
 */
export function validateManifestVersion<F extends UnvalidatedManifestFile>(
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
 * Validates the "workspaces" field of a package manifest object, i.e. a parsed
 * "package.json" file.
 *
 * TODO: Move back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns The unmodified manifest file, with the "version" field typed correctly.
 */
export function validateManifestWorkspaces<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): F & {
  data: Require<F['data'], ManifestFieldNames.Workspaces>;
} {
  if (!hasValidWorkspacesField(manifestFile)) {
    throw new Error(
      `Manifest in "${manifestFile.parentDirectory}" does not have a valid "${ManifestFieldNames.Workspaces}" field.`,
    );
  }

  return manifestFile;
}

/**
 * Validates the "private" field of a package manifest object, i.e. a parsed
 * "package.json" file.
 *
 * TODO: Move back to action-utils.
 *
 * @param manifestFile - The manifest file to validate.
 * @returns The unmodified manifest file, with the "version" field typed correctly.
 */
export function validateManifestPrivate<F extends UnvalidatedManifestFile>(
  manifestFile: F,
): F & {
  data: Require<F['data'], ManifestFieldNames.Private>;
} {
  if (!hasValidPrivateField(manifestFile)) {
    throw new Error(
      `Manifest in "${manifestFile.parentDirectory}" does not have a valid "${ManifestFieldNames.Private}" field.`,
    );
  }

  return manifestFile;
}

/**
 * Read and parse the object corresponding to the package.json file in the given
 * directory.
 *
 * An error is thrown if the file does not exist or if validation fails.
 *
 * TODO: Update corresponding function in action-utils.
 *
 * @param parentDirectory - The complete path to the directory containing the
 * `package.json` file.
 * @returns The object corresponding to the parsed package.json file.
 */
async function readManifestFile(
  parentDirectory: string,
): Promise<UnvalidatedManifestFile> {
  // Node's `fs.promises` module does not produce a stack trace if there is an
  // I/O error. See: <https://github.com/nodejs/node/issues/30944>
  try {
    const manifestPath = path.join(parentDirectory, MANIFEST_FILE_NAME);
    const data = await readJsonObjectFile(manifestPath);
    return { path: manifestPath, parentDirectory, data };
  } catch (error) {
    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(`Could not get package manifest: ${message}`);
  }
}

/**
 * Reads the `package.json` within the given package directory, detecting
 * whether the directory represents a monorepo or a polyrepo based on the
 * existence of a `workspaces` field, and returns an object containing the
 * information therein.
 *
 * @param parentDirectory - The path to the project that contains a
 * `package.json`.
 * @param options - The options.
 * @param options.usingSemverForVersion - Whether or not to check that the
 * version is not only present but also conforms to SemVer.
 * @returns A promise for an object that represents the information within
 * `package.json`.
 */
export async function getValidatedManifestFile(
  parentDirectory: string,
  { usingSemverForVersion }: { usingSemverForVersion: boolean },
): Promise<ValidatedManifestFile> {
  const manifestFile = await readManifestFile(parentDirectory);
  const manifestFileWithKnownName = validateManifestName(manifestFile);
  const manifestFileWithKnownVersion = validateManifestVersion(
    manifestFileWithKnownName,
    { usingSemver: usingSemverForVersion },
  );
  const rawVersion =
    manifestFileWithKnownVersion.data[ManifestFieldNames.Version];
  const parsedVersion = semver.parse(rawVersion);

  if (parsedVersion === null) {
    throw new Error(`Root package has invalid version "${rawVersion}"`);
  }

  return {
    ...manifestFile,
    data: {
      [ManifestFieldNames.Name]:
        manifestFileWithKnownName.data[ManifestFieldNames.Name],
      [ManifestFieldNames.Version]: parsedVersion,
      [ManifestFieldNames.Workspaces]:
        manifestFile.data[ManifestFieldNames.Workspaces] ?? [],
      [ManifestFieldNames.Private]:
        manifestFile.data[ManifestFieldNames.Private] ?? false,
      ...knownKeysOf(ManifestDependencyFieldNames).reduce((obj, key) => {
        return {
          ...obj,
          [key]: manifestFile.data[ManifestDependencyFieldNames[key]] ?? {},
        };
      }, {} as Record<ManifestDependencyFieldNames, Record<string, string>>),
    },
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
    changelogContent = await fs.promises.readFile(pkg.changelogPath, 'utf-8');
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
    projectRootDirectory: project.directoryPath,
    repoUrl: project.repositoryUrl,
  });

  if (newChangelogContent) {
    await fs.promises.writeFile(pkg.changelogPath, newChangelogContent);
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
  const { manifestFile, newVersion, shouldUpdateChangelog } =
    packageReleasePlan;

  await writeJsonFile(manifestFile.path, {
    ...manifestFile.data,
    version: newVersion,
  });

  if (shouldUpdateChangelog) {
    await updatePackageChangelog(project, packageReleasePlan);
  }
}
