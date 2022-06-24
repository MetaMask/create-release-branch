import path from 'path';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
  PackageManifest,
} from '@metamask/action-utils';
import type { Require } from './utils';
import {
  isErrorWithStack,
  isNullOrUndefined,
  isTruthyString,
  knownKeysOf,
} from './utils';
import { readJsonObjectFile } from './file-utils';
import { isValidSemver, semver, SemVer } from './semver-utils';

export {
  updatePackage,
  MonorepoUpdateSpecification,
  UpdateSpecification,
} from '../old/package-operations';

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
  parentDirectory: string;
  data: UnvalidatedManifest;
}

// TODO: Move this to action-utils
export interface ValidatedManifestFile {
  parentDirectory: string;
  data: Require<
    Omit<UnvalidatedManifest, ManifestFieldNames.Version>,
    | ManifestFieldNames.Name
    | ManifestFieldNames.Private
    | ManifestFieldNames.Workspaces
    | ManifestDependencyFieldNames
  > & { [ManifestFieldNames.Version]: SemVer };
}

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
    const manifestPath = path.join(parentDirectory, 'package.json');
    const data = await readJsonObjectFile(manifestPath);
    return { parentDirectory, data };
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
