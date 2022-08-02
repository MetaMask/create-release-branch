import path from 'path';
import {
  ManifestFieldNames as PackageManifestFieldNames,
  ManifestDependencyFieldNames as PackageManifestDependenciesFieldNames,
} from '@metamask/action-utils';
import { readJsonObjectFile } from './fs';
import { isTruthyString, isObject } from './misc-utils';
import { isValidSemver, SemVer } from './semver';

export { PackageManifestFieldNames, PackageManifestDependenciesFieldNames };

/**
 * An unverified representation of the data in a package's `package.json`.
 */
export type UnvalidatedPackageManifest = Readonly<Record<string, any>>;

/**
 * A type-checked representation of the data in a package's `package.json`.
 *
 * @property name - The name of the package.
 * @property version - The version of the package.
 * @property private - Whether the package is private.
 * @property workspaces - Paths to subpackages within the package.
 * @property bundledDependencies - The set of packages that are expected to be
 * bundled when publishing the package.
 * @property dependencies - The set of packages, and their versions, that the
 * published version of the package needs to run effectively.
 * @property devDependencies - The set of packages, and their versions, that the
 * the package relies upon for development purposes (such as tests or
 * locally-run scripts).
 * @property optionalDependencies - The set of packages, and their versions,
 * that the package may need but is not required for use.
 * @property peerDependencies - The set of packages, and their versions, that
 * the package may need but is not required for use. Intended for plugins.
 */
export type ValidatedPackageManifest = {
  readonly [PackageManifestFieldNames.Name]: string;
  readonly [PackageManifestFieldNames.Version]: SemVer;
  readonly [PackageManifestFieldNames.Private]: boolean;
  readonly [PackageManifestFieldNames.Workspaces]: string[];
} & Readonly<
  Partial<Record<PackageManifestDependenciesFieldNames, Record<string, string>>>
>;

/**
 * Constructs a validation error message for a field within the manifest.
 *
 * @param args - The arguments.
 * @param args.manifest - The manifest data that's invalid.
 * @param args.parentDirectory - The directory of the package to which the
 * manifest belongs.
 * @param args.fieldName - The name of the field in the manifest.
 * @param args.verbPhrase - Either the fact that the field is invalid or an
 * explanation for why it is invalid.
 * @returns The error message.
 */
function buildPackageManifestFieldValidationErrorMessage({
  manifest,
  parentDirectory,
  fieldName,
  verbPhrase,
}: {
  manifest: UnvalidatedPackageManifest;
  parentDirectory: string;
  fieldName: keyof UnvalidatedPackageManifest;
  verbPhrase: string;
}) {
  const subject = isTruthyString(manifest[PackageManifestFieldNames.Name])
    ? `The value of "${fieldName}" in the manifest for "${
        manifest[PackageManifestFieldNames.Name]
      }"`
    : `The value of "${fieldName}" in the manifest located at "${parentDirectory}"`;
  return `${subject} ${verbPhrase}`;
}

/**
 * Object that includes checks for validating fields within a manifest
 * along with error messages if those validations fail.
 */
const schemata = {
  [PackageManifestFieldNames.Name]: {
    validate: isTruthyString,
    errorMessage: 'must be a non-empty string',
  },
  [PackageManifestFieldNames.Version]: {
    validate: isValidPackageManifestVersionField,
    errorMessage: 'must be a valid SemVer version string',
  },
  [PackageManifestFieldNames.Workspaces]: {
    validate: isValidPackageManifestWorkspacesField,
    errorMessage: 'must be an array of non-empty strings (if present)',
  },
  [PackageManifestFieldNames.Private]: {
    validate: isValidPackageManifestPrivateField,
    errorMessage: 'must be true or false (if present)',
  },
  dependencies: {
    validate: isValidPackageManifestDependenciesField,
    errorMessage:
      'must be an object with non-empty string keys and non-empty string values',
  },
};

/**
 * Retrieves and validates the "name" field within the package manifest object.
 *
 * @param manifest - The manifest object.
 * @param parentDirectory - The directory in which the manifest lives.
 * @returns The value of the "name" field.
 * @throws If the value of the field is not a truthy string.
 */
export function readPackageManifestNameField(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
): string {
  const fieldName = PackageManifestFieldNames.Name;
  const value = manifest[fieldName];
  const schema = schemata[fieldName];

  if (!schema.validate(value)) {
    throw new Error(
      buildPackageManifestFieldValidationErrorMessage({
        manifest,
        parentDirectory,
        fieldName: PackageManifestFieldNames.Name,
        verbPhrase: schema.errorMessage,
      }),
    );
  }

  return value;
}

/**
 * Type guard to ensure that the value of the "version" field of a manifest is
 * valid.
 *
 * @param version - The value to check.
 * @returns Whether the version is a valid SemVer version string.
 */
function isValidPackageManifestVersionField(
  version: unknown,
): version is string {
  return isTruthyString(version) && isValidSemver(version);
}

/**
 * Retrieves and validates the "version" field within the package manifest
 * object.
 *
 * @param manifest - The manifest object.
 * @param parentDirectory - The directory in which the manifest lives.
 * @returns The value of the "version" field wrapped in a SemVer object.
 * @throws If the value of the field is not a valid SemVer version string.
 */
export function readPackageManifestVersionField(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
): SemVer {
  const fieldName = PackageManifestFieldNames.Version;
  const value = manifest[fieldName];
  const schema = schemata[fieldName];

  if (!schema.validate(value)) {
    throw new Error(
      buildPackageManifestFieldValidationErrorMessage({
        manifest,
        parentDirectory,
        fieldName: PackageManifestFieldNames.Version,
        verbPhrase: schema.errorMessage,
      }),
    );
  }

  return new SemVer(value);
}

/**
 * Type guard to ensure that the value of the "workspaces" field of a manifest
 * is valid.
 *
 * @param workspaces - The value to check.
 * @returns Whether the value is an array of truthy strings.
 */
function isValidPackageManifestWorkspacesField(
  workspaces: unknown,
): workspaces is string[] | undefined {
  return (
    workspaces === undefined ||
    (Array.isArray(workspaces) &&
      workspaces.every((workspace) => isTruthyString(workspace)))
  );
}

/**
 * Retrieves and validates the "workspaces" field within the package manifest
 * object.
 *
 * @param manifest - The manifest object.
 * @param parentDirectory - The directory in which the manifest lives.
 * @returns The value of the "workspaces" field, or an empty array if no such
 * field exists.
 * @throws If the value of the field is not an array of truthy strings.
 */
export function readPackageManifestWorkspacesField(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
): string[] {
  const fieldName = PackageManifestFieldNames.Workspaces;
  const value = manifest[fieldName];
  const schema = schemata[fieldName];

  if (!schema.validate(value)) {
    throw new Error(
      buildPackageManifestFieldValidationErrorMessage({
        manifest,
        parentDirectory,
        fieldName,
        verbPhrase: schema.errorMessage,
      }),
    );
  }

  return value ?? [];
}

/**
 * Type guard to ensure that the value of the "private" field of a manifest is
 * valid.
 *
 * @param privateValue - The value to check.
 * @returns Whether the value is undefined, true, or false.
 */
function isValidPackageManifestPrivateField(
  privateValue: unknown,
): privateValue is boolean | undefined {
  return (
    privateValue === undefined ||
    privateValue === true ||
    privateValue === false
  );
}

/**
 * Retrieves and validates the "private" field within the package manifest
 * object.
 *
 * @param manifest - The manifest object.
 * @param parentDirectory - The directory in which the manifest lives.
 * @returns The value of the "private" field, or false if no such field exists.
 * @throws If the value of the field is not true or false.
 */
export function readPackageManifestPrivateField(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
): boolean {
  const fieldName = PackageManifestFieldNames.Private;
  const value = manifest[fieldName];
  const schema = schemata[fieldName];

  if (!schema.validate(value)) {
    throw new Error(
      buildPackageManifestFieldValidationErrorMessage({
        manifest,
        parentDirectory,
        fieldName,
        verbPhrase: schema.errorMessage,
      }),
    );
  }

  return value ?? false;
}

/**
 * Type guard to ensure that the value of the dependencies field of a manifest
 * is valid.
 *
 * @param dependencies - The value to check.
 * @returns Whether the value is undefined or an object with truthy strings.
 */
function isValidPackageManifestDependenciesField(
  dependencies: unknown,
): dependencies is Record<string, string> {
  return (
    dependencies === undefined ||
    (isObject(dependencies) &&
      Object.values(dependencies).every(isTruthyString))
  );
}

/**
 * Retrieves and validates the dependencies fields of a package manifest
 * object.
 *
 * @param manifest - The manifest data to validate.
 * @param parentDirectory - The directory of the package to which the
 * manifest belongs.
 * @returns All of the possible dependencies fields and their values (if any one
 * does not exist, it defaults to `{}`).
 * @throws If any one of the dependencies fields is not an object whose values
 * are truthy strings.
 */
function readPackageManifestDependenciesFields(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
): Record<PackageManifestDependenciesFieldNames, Record<string, string>> {
  return Object.values(PackageManifestDependenciesFieldNames).reduce(
    (obj, fieldName) => {
      const value = manifest[fieldName];
      const schema = schemata.dependencies;

      if (!schema.validate(value)) {
        throw new Error(
          buildPackageManifestFieldValidationErrorMessage({
            manifest,
            parentDirectory,
            fieldName,
            verbPhrase: schema.errorMessage,
          }),
        );
      }

      return { ...obj, [fieldName]: value ?? {} };
    },
    {} as Record<PackageManifestDependenciesFieldNames, Record<string, string>>,
  );
}

/**
 * Reads the package manifest at the given path, verifying key data within the
 * manifest.
 *
 * @param manifestPath - The path of the manifest file.
 * @returns The correctly typed version of the manifest.
 * @throws If key data within the manifest is missing (currently `name` and
 * `version`) or the value of any other fields is unexpected.
 */
export async function readPackageManifest(
  manifestPath: string,
): Promise<ValidatedPackageManifest> {
  const unvalidatedPackageManifest = await readJsonObjectFile(manifestPath);
  const parentDirectory = path.dirname(manifestPath);
  const name = readPackageManifestNameField(
    unvalidatedPackageManifest,
    parentDirectory,
  );
  const version = readPackageManifestVersionField(
    unvalidatedPackageManifest,
    parentDirectory,
  );
  const workspaces = readPackageManifestWorkspacesField(
    unvalidatedPackageManifest,
    parentDirectory,
  );
  const privateValue = readPackageManifestPrivateField(
    unvalidatedPackageManifest,
    parentDirectory,
  );
  const dependenciesFields = readPackageManifestDependenciesFields(
    unvalidatedPackageManifest,
    parentDirectory,
  );

  return {
    [PackageManifestFieldNames.Name]: name,
    [PackageManifestFieldNames.Version]: version,
    [PackageManifestFieldNames.Workspaces]: workspaces,
    [PackageManifestFieldNames.Private]: privateValue,
    ...dependenciesFields,
  };
}
