import path from 'path';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
} from '@metamask/action-utils';
import { readJsonObjectFile } from './file-utils';
import { isNullOrUndefined, isTruthyString, isObject } from './misc-utils';
import { isValidSemver, semver, SemVer } from './semver-utils';

export { ManifestFieldNames, ManifestDependencyFieldNames };

/**
 * An unverified representation of the data in a package's `package.json`.
 * (We know which properties could be present but haven't confirmed this yet.)
 *
 * TODO: Move this to action-utils
 */
type UnvalidatedManifest = Readonly<Partial<Record<ManifestFieldNames, any>>> &
  Readonly<Partial<Record<ManifestDependencyFieldNames, any>>>;

/**
 * A type-checked representation of the data in a package's `package.json`.
 *
 * TODO: Move this to action-utils
 */
export type ValidatedManifest = {
  readonly [ManifestFieldNames.Name]: string;
  readonly [ManifestFieldNames.Version]: SemVer;
  readonly [ManifestFieldNames.Private]: boolean;
  readonly [ManifestFieldNames.Workspaces]: string[];
} & Readonly<
  Partial<Record<ManifestDependencyFieldNames, Record<string, string>>>
>;

/**
 * Type guard to ensure that the given "name" field of a manifest is valid.
 *
 * TODO: Move this to action-utils.
 *
 * @param name - The name to check.
 * @returns Whether the name is valid.
 */
function isValidManifestNameField(name: any): name is string {
  return isTruthyString(name);
}

/**
 * Type guard to ensure that the given "version" field of a manifest is valid.
 *
 * TODO: Move this to action-utils.
 *
 * @param version - The value to check.
 * @returns Whether the value is valid.
 */
function isValidManifestVersionField(version: any): version is string {
  return isTruthyString(version) && isValidSemver(version);
}

/**
 * Type guard to ensure that the given "workspaces" field of a manifest is
 * valid.
 *
 * TODO: Move this to action-utils.
 *
 * @param workspaces - The value to check.
 * @returns Whether the value is valid.
 */
function isValidManifestWorkspacesField(
  workspaces: any,
): workspaces is string[] | null | undefined {
  return (
    isNullOrUndefined(workspaces) ||
    (Array.isArray(workspaces) &&
      workspaces.every((workspace) => isTruthyString(workspace)))
  );
}

/**
 * Type guard to ensure that the given "private" field of a manifest is valid.
 *
 * TODO: Move this to action-utils.
 *
 * @param privateValue - The value to check.
 * @returns Whether the value is valid.
 */
function isValidManifestPrivateField(
  privateValue: any,
): privateValue is boolean | null | undefined {
  return (
    isNullOrUndefined(privateValue) ||
    privateValue === true ||
    privateValue === false
  );
}

/**
 * Type guard to ensure that the given dependencies field of a manifest is valid.
 *
 * TODO: Move this to action-utils.
 *
 * @param dependencies - The value to check.
 * @returns Whether the value is valid.
 */
function isValidManifestDependenciesField(
  dependencies: any,
): dependencies is Record<string, string> {
  return (
    isObject(dependencies) &&
    Object.keys(dependencies).every(isTruthyString) &&
    Object.values(dependencies).every(isTruthyString)
  );
}

/**
 * Gets the prefix of an error message for a manifest file validation error.
 *
 * TODO: Remove when other functions are moved to action-utils.
 *
 * @param manifest - The manifest data that's invalid.
 * @param invalidField - The name of the invalid field.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The prefix of a manifest validation error message.
 */
function getManifestErrorMessagePrefix(
  manifest: UnvalidatedManifest,
  invalidField: ManifestFieldNames | ManifestDependencyFieldNames,
  parentDirectory: string,
) {
  return manifest[ManifestFieldNames.Name]
    ? `"${manifest[ManifestFieldNames.Name]}" manifest "${invalidField}"`
    : `"${invalidField}" of manifest in "${parentDirectory}"`;
}

/**
 * Retrieves and checks the "name" field of a package manifest object, throwing
 * if it is not present or is not the correct type.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The value of the "name" field.
 */
function readManifestNameField(
  manifest: UnvalidatedManifest,
  parentDirectory: string,
): string {
  const name = manifest[ManifestFieldNames.Name];

  if (!isValidManifestNameField(name)) {
    throw new Error(
      `Manifest in "${parentDirectory}" does not have a valid "${ManifestFieldNames.Name}" field.`,
    );
  }

  return manifest[ManifestFieldNames.Name];
}

/**
 * Retrieves and checks the "version" field of a package manifest object, throwing
 * if it is not present or is not the correct type.
 *
 * TODO: Move this back to action-utils.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The value of the "version" field.
 */
function readManifestVersionField(
  manifest: UnvalidatedManifest,
  parentDirectory: string,
): SemVer {
  const version = manifest[ManifestFieldNames.Version];

  if (!isValidManifestVersionField(version)) {
    throw new Error(
      `${getManifestErrorMessagePrefix(
        manifest,
        ManifestFieldNames.Version,
        parentDirectory,
      )} is not a valid SemVer version: ${version}`,
    );
  }

  // Typecast: We know that this string will parse successfully.
  return semver.parse(version) as SemVer;
}

/**
 * Retrieves and checks the "workspaces" field of a package manifest object,
 * throwing if it is not present or is not the correct type.
 *
 * TODO: Move this to action-utils.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The value of the "workspaces" field.
 */
function readManifestWorkspacesField(
  manifest: UnvalidatedManifest,
  parentDirectory: string,
): string[] {
  const workspaces = manifest[ManifestFieldNames.Workspaces];

  if (!isValidManifestWorkspacesField(workspaces)) {
    throw new Error(
      `${getManifestErrorMessagePrefix(
        manifest,
        ManifestFieldNames.Workspaces,
        parentDirectory,
      )} does not have a valid "${ManifestFieldNames.Workspaces}" field`,
    );
  }

  return workspaces ?? [];
}

/**
 * Retrieves and checks the "private" field of a package manifest object,
 * throwing if it is not present or is not the correct type.
 *
 * TODO: Move this to action-utils.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The value of the "private" field.
 */
function readManifestPrivateField(
  manifest: UnvalidatedManifest,
  parentDirectory: string,
): boolean {
  const privateValue = manifest[ManifestFieldNames.Private];

  if (!isValidManifestPrivateField(privateValue)) {
    throw new Error(
      `${getManifestErrorMessagePrefix(
        manifest,
        ManifestFieldNames.Private,
        parentDirectory,
      )} does not have a valid "${ManifestFieldNames.Private}" field`,
    );
  }

  return privateValue ?? false;
}

/**
 * Retrieves and checks the dependency fields of a package manifest object,
 * throwing if any of them is not present or is not the correct type.
 *
 * TODO: Move this to action-utils.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @returns The extracted dependency fields and their values.
 */
function readManifestDependencyFields(
  manifest: UnvalidatedManifest,
  parentDirectory: string,
) {
  return Object.values(ManifestDependencyFieldNames).reduce((obj, key) => {
    const dependencies = manifest[key];

    if (isValidManifestDependenciesField(dependencies)) {
      throw new Error(
        `${getManifestErrorMessagePrefix(
          manifest,
          key,
          parentDirectory,
        )} does not have a valid "${key}" field`,
      );
    }

    return { ...obj, [key]: dependencies ?? {} };
  }, {} as Record<ManifestDependencyFieldNames, Record<string, string>>);
}

/**
 * Reads the package manifest at the given path, verifying key data within the
 * manifest and throwing if that data is incomplete.
 *
 * TODO: Move this to action-utils.
 *
 * @param manifestPath - The path of the manifest file.
 * @returns Information about a correctly typed version of the manifest for a
 * package.
 */
export async function readManifest(
  manifestPath: string,
): Promise<ValidatedManifest> {
  const unvalidatedManifest = await readJsonObjectFile(manifestPath);
  const parentDirectory = path.dirname(manifestPath);
  const name = readManifestNameField(unvalidatedManifest, parentDirectory);
  const version = readManifestVersionField(
    unvalidatedManifest,
    parentDirectory,
  );
  const workspaces = readManifestWorkspacesField(
    unvalidatedManifest,
    parentDirectory,
  );
  const privateValue = readManifestPrivateField(
    unvalidatedManifest,
    parentDirectory,
  );
  const dependencyFields = readManifestDependencyFields(
    unvalidatedManifest,
    parentDirectory,
  );

  return {
    [ManifestFieldNames.Name]: name,
    [ManifestFieldNames.Version]: version,
    [ManifestFieldNames.Workspaces]: workspaces,
    [ManifestFieldNames.Private]: privateValue,
    ...dependencyFields,
  };
}
