import path from 'path';
import {
  ManifestFieldNames as PackageManifestFieldNames,
  ManifestDependencyFieldNames as PackageManifestDependenciesFieldNames,
} from '@metamask/action-utils';
import { isPlainObject } from '@metamask/utils';
import validateNPMPackageName from 'validate-npm-package-name';
import { readJsonObjectFile } from './fs.js';
import { isTruthyString } from './misc-utils.js';
import { semver, SemVer } from './semver.js';

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
 */
export type ValidatedPackageManifest = {
  readonly [PackageManifestFieldNames.Name]: string;
  readonly [PackageManifestFieldNames.Version]: SemVer;
  readonly [PackageManifestFieldNames.Private]: boolean;
  readonly [PackageManifestFieldNames.Workspaces]: string[];
  readonly [PackageManifestDependenciesFieldNames.Production]: Record<
    string,
    string
  >;
  readonly [PackageManifestDependenciesFieldNames.Peer]: Record<string, string>;
};

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
  [PackageManifestDependenciesFieldNames.Production]: {
    validate: isValidPackageManifestDependenciesField,
    errorMessage: 'must be a valid dependencies field',
  },
  [PackageManifestDependenciesFieldNames.Peer]: {
    validate: isValidPackageManifestDependenciesField,
    errorMessage: 'must be a valid peerDependencies field',
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
  return isTruthyString(version) && semver.validRange(version) !== null;
}

/**
 * Type guard to ensure that the provided version value is a valid dependency version
 * specifier for a package manifest. This function validates:
 * semantic versioning ranges
 * 'workspace:^' notation
 * 'npm:{packageName}:{semverRange}' redirections.
 *
 * @param version - The value to check.
 * @returns `true` if the version is a valid string that either
 * represents a semantic versioning range or is exactly 'workspace:^'.
 * Otherwise, it returns `false`.
 */
function isValidPackageManifestDependencyValue(
  version: unknown,
): version is string {
  if (typeof version !== 'string') {
    return false;
  }

  if (
    isValidPackageManifestVersionField(version) ||
    version === 'workspace:^'
  ) {
    return true;
  }

  const redirectedDependencyRegexp = /^npm:(.*)@(.*?)$/u;

  try {
    const redirectedDependencyMatch = redirectedDependencyRegexp.exec(version);

    /* istanbul ignore if */
    if (!redirectedDependencyMatch) {
      return false;
    }

    const [, redirectedName, redirectedVersion] = redirectedDependencyMatch;
    return (
      validateNPMPackageName(redirectedName)?.validForOldPackages &&
      isValidPackageManifestVersionField(redirectedVersion)
    );
  } catch (e) /* istanbul ignore next */ {
    return false;
  }
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
 * Type guard to ensure that the value of the "dependencies" or "peerDependencies" field of a manifest is
 * valid.
 *
 * @param depsValue - The value to check.
 * @returns Whether the value is has valid values.
 */
function isValidPackageManifestDependenciesField(
  depsValue: unknown,
): depsValue is Record<string, string> {
  return (
    depsValue === undefined ||
    (isPlainObject(depsValue) &&
      Object.entries(depsValue).every(([pkgName, version]) => {
        return (
          isTruthyString(pkgName) &&
          isValidPackageManifestDependencyValue(version)
        );
      }))
  );
}

/**
 * Retrieves and validates the "dependencies" or "peerDependencies" fields within the package manifest
 * object.
 *
 * @param manifest - The manifest object.
 * @param parentDirectory - The directory in which the manifest lives.
 * @param fieldName - The field name "dependencies" or "peerDependencies".
 * @returns The value of the "dependencies" or "peerDependencies" field.
 * @throws If the value of the field is not valid.
 */
export function readPackageManifestDependenciesField(
  manifest: UnvalidatedPackageManifest,
  parentDirectory: string,
  fieldName:
    | PackageManifestDependenciesFieldNames.Production
    | PackageManifestDependenciesFieldNames.Peer,
): Record<string, string> {
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

  return value || {};
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
export async function readPackageManifest(manifestPath: string): Promise<{
  unvalidated: UnvalidatedPackageManifest;
  validated: ValidatedPackageManifest;
}> {
  const unvalidated = await readJsonObjectFile(manifestPath);
  const parentDirectory = path.dirname(manifestPath);
  const name = readPackageManifestNameField(unvalidated, parentDirectory);
  const version = readPackageManifestVersionField(unvalidated, parentDirectory);
  const workspaces = readPackageManifestWorkspacesField(
    unvalidated,
    parentDirectory,
  );
  const privateValue = readPackageManifestPrivateField(
    unvalidated,
    parentDirectory,
  );
  const dependencies = readPackageManifestDependenciesField(
    unvalidated,
    parentDirectory,
    PackageManifestDependenciesFieldNames.Production,
  );
  const peerDependencies = readPackageManifestDependenciesField(
    unvalidated,
    parentDirectory,
    PackageManifestDependenciesFieldNames.Peer,
  );

  const validated = {
    [PackageManifestFieldNames.Name]: name,
    [PackageManifestFieldNames.Version]: version,
    [PackageManifestFieldNames.Workspaces]: workspaces,
    [PackageManifestFieldNames.Private]: privateValue,
    [PackageManifestDependenciesFieldNames.Production]: dependencies,
    [PackageManifestDependenciesFieldNames.Peer]: peerDependencies,
  };

  return { unvalidated, validated };
}
