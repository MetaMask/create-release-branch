import path from 'path';
import {
  ManifestFieldNames as PackageManifestFieldNames,
  ManifestDependencyFieldNames as PackageManifestDependenciesFieldNames,
} from '@metamask/action-utils';
import { readJsonObjectFile } from './fs';
import { isTruthyString, isObject, Require } from './misc-utils';
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
 * Represents options to `readPackageManifestField`.
 *
 * @template T - The expected type of the field value (should include
 * `undefined` if not expected to present).
 * @template U - The return type of this function, as determined via
 * `defaultValue` (if present) or `transform` (if present).
 * @property manifest - The manifest object.
 * @property parentDirectory - The directory in which the manifest lives.
 * @property fieldName - The name of the field.
 * @property validation - The validation object.
 * @property validation.check - A function to test whether the value for the
 * field is valid.
 * @property validation.failureReason - A snippet of the message that will be
 * produced if the validation fails which explains the requirements of the field
 * or merely says that it is invalid, with no explanation.
 * @property defaultValue - A value to return in place of the field value if
 * the field is not present.
 * @property transform - A function to call with the value after it has been
 * validated.
 */
interface ReadPackageManifestFieldOptions<T, U> {
  manifest: UnvalidatedPackageManifest;
  parentDirectory: string;
  fieldName: keyof UnvalidatedPackageManifest;
  validation: {
    check: (value: any) => value is T;
    failureReason: string;
  };
  defaultValue?: U;
  transform?: (value: T) => U;
}

/**
 * Object that includes a check for validating the "name" field of a manifest
 * along with an error message if that validation fails.
 */
const validationForPackageManifestNameField = {
  check: isTruthyString,
  failureReason: 'must be a non-empty string',
};

/**
 * Object that includes a check for validating the "version" field of a manifest
 * along with an error message if that validation fails.
 */
const validationForPackageManifestVersionField = {
  check: isValidPackageManifestVersionField,
  failureReason: 'must be a valid SemVer version string',
};

/**
 * Object that includes a check for validating the "workspaces" field of a
 * manifest along with an error message if that validation fails.
 */
const validationForPackageManifestWorkspacesField = {
  check: isValidPackageManifestWorkspacesField,
  failureReason: 'must be an array of non-empty strings (if present)',
};

/**
 * Object that includes a check for validating the "private" field of a manifest
 * along with an error message if that validation fails.
 */
const validationForPackageManifestPrivateField = {
  check: isValidPackageManifestPrivateField,
  failureReason: 'must be true or false (if present)',
};

/**
 * Object that includes a check for validating any of the "dependencies" fields
 * of a manifest along with an error message if that validation fails.
 */
const validationForPackageManifestDependenciesField = {
  check: isValidPackageManifestDependenciesField,
  failureReason:
    'must be an object with non-empty string keys and non-empty string values',
};

/**
 * Type guard to ensure that the given "version" field of a manifest is valid.
 *
 * @param version - The value to check.
 * @returns Whether the value is valid.
 */
function isValidPackageManifestVersionField(version: any): version is string {
  return isTruthyString(version) && isValidSemver(version);
}

/**
 * Type guard to ensure that the given "workspaces" field of a manifest is
 * valid.
 *
 * @param workspaces - The value to check.
 * @returns Whether the value is valid.
 */
function isValidPackageManifestWorkspacesField(
  workspaces: any,
): workspaces is string[] | undefined {
  return (
    workspaces === undefined ||
    (Array.isArray(workspaces) &&
      workspaces.every((workspace) => isTruthyString(workspace)))
  );
}

/**
 * Type guard to ensure that the given "private" field of a manifest is valid.
 *
 * @param privateValue - The value to check.
 * @returns Whether the value is valid.
 */
function isValidPackageManifestPrivateField(
  privateValue: any,
): privateValue is boolean | undefined {
  return (
    privateValue === undefined ||
    privateValue === true ||
    privateValue === false
  );
}

/**
 * Type guard to ensure that the given dependencies field of a manifest is
 * valid.
 *
 * @param dependencies - The value to check.
 * @returns Whether the value is valid.
 */
function isValidPackageManifestDependenciesField(
  dependencies: any,
): dependencies is Record<string, string> {
  return (
    dependencies === undefined ||
    (isObject(dependencies) &&
      Object.values(dependencies).every(isTruthyString))
  );
}

/**
 * Constructs a message for a manifest file validation error.
 *
 * @param args - The arguments.
 * @param args.manifest - The manifest data that's invalid.
 * @param args.parentDirectory - The directory of the package to which the manifest
 * belongs.
 * @param args.invalidFieldName - The name of the invalid field.
 * @param args.verbPhrase - Either the fact that the field is invalid or an
 * explanation for why it is invalid.
 * @returns The error message.
 */
function buildPackageManifestFieldValidationErrorMessage({
  manifest,
  parentDirectory,
  invalidFieldName,
  verbPhrase,
}: {
  manifest: UnvalidatedPackageManifest;
  parentDirectory: string;
  invalidFieldName: keyof UnvalidatedPackageManifest;
  verbPhrase: string;
}) {
  const subject = isTruthyString(manifest[PackageManifestFieldNames.Name])
    ? `The value of "${invalidFieldName}" in the manifest for "${
        manifest[PackageManifestFieldNames.Name]
      }"`
    : `The value of "${invalidFieldName}" in the manifest located at "${parentDirectory}"`;
  return `${subject} ${verbPhrase}`;
}

/**
 * Retrieves and validates a field within a package manifest object.
 *
 * @template T - The expected type of the field value (should include
 * `undefined` if not expected to present).
 * @template U - The return type of this function, as determined via
 * `defaultValue` (if present) or `transform` (if present).
 * @param args - The arguments.
 * @param args.manifest - The manifest object.
 * @param args.parentDirectory - The directory in which the manifest lives.
 * @param args.fieldName - The name of the field.
 * @param args.validation - The validation object.
 * @param args.validation.check - A function to test whether the value for the
 * field is valid.
 * @param args.validation.failureReason - A snippet of the message that will be
 * produced if the validation fails which explains the requirements of the field
 * or merely says that it is invalid, with no explanation.
 * @param args.defaultValue - A value to return in place of the field value if
 * the field is not present.
 * @param args.transform - A function to call with the value after it has been
 * validated.
 * @returns The value of the field, or the default value if the field is not
 * present.
 * @throws If the validation on the field fails.
 */
function readPackageManifestField<T, U>(
  options: Omit<
    ReadPackageManifestFieldOptions<T, U>,
    'transform' | 'defaultValue'
  >,
): T;
function readPackageManifestField<T, U>(
  options: Require<ReadPackageManifestFieldOptions<T, U>, 'transform'>,
): U;
function readPackageManifestField<T, U>(
  options: Require<ReadPackageManifestFieldOptions<T, U>, 'defaultValue'>,
): T extends undefined ? U : T;
/* eslint-disable-next-line jsdoc/require-jsdoc */
function readPackageManifestField<T, U>({
  manifest,
  parentDirectory,
  fieldName,
  validation,
  defaultValue,
  transform,
}: ReadPackageManifestFieldOptions<T, U>): T | U {
  const value = manifest[fieldName];

  if (!validation.check(value)) {
    throw new Error(
      buildPackageManifestFieldValidationErrorMessage({
        manifest,
        parentDirectory,
        invalidFieldName: fieldName,
        verbPhrase: validation.failureReason,
      }),
    );
  }

  if (defaultValue === undefined || value !== undefined) {
    if (transform === undefined) {
      return value;
    }

    return transform(value);
  }

  return defaultValue;
}

/**
 * Retrieves and validates the "dependencies" fields of a package manifest
 * object.
 *
 * @param args - The arguments.
 * @param args.manifest - The manifest data to validate.
 * @param args.parentDirectory - The directory of the package to which the
 * manifest belongs.
 * @returns All of the possible "dependencies" fields and their values (if any
 * one does not exist, it defaults to `{}`).
 * @throws If the validation on any of the dependencies fields fails.
 */
function readPackageManifestDependenciesFields({
  manifest,
  parentDirectory,
}: {
  manifest: UnvalidatedPackageManifest;
  parentDirectory: string;
}) {
  return Object.values(PackageManifestDependenciesFieldNames).reduce(
    (obj, fieldName) => {
      const dependencies = readPackageManifestField({
        manifest,
        parentDirectory,
        fieldName,
        validation: validationForPackageManifestDependenciesField,
        defaultValue: {},
      });
      return { ...obj, [fieldName]: dependencies };
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
 * `version`).
 */
export async function readPackageManifest(manifestPath: string): Promise<{
  unvalidatedManifest: UnvalidatedPackageManifest;
  validatedManifest: ValidatedPackageManifest;
}> {
  const unvalidatedManifest = await readJsonObjectFile(manifestPath);
  const parentDirectory = path.dirname(manifestPath);
  const name = readPackageManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: PackageManifestFieldNames.Name,
    validation: validationForPackageManifestNameField,
  });
  const version = readPackageManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: PackageManifestFieldNames.Version,
    validation: validationForPackageManifestVersionField,
    transform: (value: string) => new SemVer(value),
  });
  const workspaces = readPackageManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: PackageManifestFieldNames.Workspaces,
    validation: validationForPackageManifestWorkspacesField,
    defaultValue: [],
  });
  const privateValue = readPackageManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: PackageManifestFieldNames.Private,
    validation: validationForPackageManifestPrivateField,
    defaultValue: false,
  });
  const dependenciesFields = readPackageManifestDependenciesFields({
    manifest: unvalidatedManifest,
    parentDirectory,
  });

  const validatedManifest = {
    [PackageManifestFieldNames.Name]: name,
    [PackageManifestFieldNames.Version]: version,
    [PackageManifestFieldNames.Workspaces]: workspaces,
    [PackageManifestFieldNames.Private]: privateValue,
    ...dependenciesFields,
  };

  return { unvalidatedManifest, validatedManifest };
}
