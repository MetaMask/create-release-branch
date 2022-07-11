import path from 'path';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
} from '@metamask/action-utils';
import { readJsonObjectFile } from './file-utils';
import { isTruthyString, isObject, Require } from './misc-utils';
import { isValidSemver, SemVer } from './semver-utils';

export { ManifestFieldNames, ManifestDependencyFieldNames };

/**
 * An unverified representation of the data in a package's `package.json`.
 * (We know which properties could be present but haven't checked their types
 * yet.)
 *
 * TODO: Move this to action-utils.
 */
type UnvalidatedManifest = Readonly<Partial<Record<ManifestFieldNames, any>>> &
  Readonly<Partial<Record<ManifestDependencyFieldNames, any>>>;

/**
 * A type-checked representation of the data in a package's `package.json`.
 *
 * TODO: Move this to action-utils.
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
 * Represents options to `readManifestField`.
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
interface ReadManifestFieldOptions<T, U> {
  manifest: UnvalidatedManifest;
  parentDirectory: string;
  fieldName: keyof UnvalidatedManifest;
  validation: {
    check: (value: any) => value is T;
    failureReason: string;
  };
  defaultValue?: U;
  transform?: (value: T) => U;
}

const validationForManifestNameField = {
  check: isTruthyString,
  failureReason: 'must be a non-empty string',
};

const validationForManifestVersionField = {
  check: isValidManifestVersionField,
  failureReason: 'must be a valid SemVer version string',
};

const validationForManifestWorkspacesField = {
  check: isValidManifestWorkspacesField,
  failureReason: 'must be an array of non-empty strings (if present)',
};

const validationForManifestPrivateField = {
  check: isValidManifestPrivateField,
  failureReason: 'must be true or false (if present)',
};

const validationForManifestDependenciesField = {
  check: isValidManifestDependenciesField,
  failureReason:
    'must be an object with non-empty string keys and non-empty string values',
};

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
 * TODO: Move this to action-utils.
 *
 * @param privateValue - The value to check.
 * @returns Whether the value is valid.
 */
function isValidManifestPrivateField(
  privateValue: any,
): privateValue is boolean | undefined {
  return (
    privateValue === undefined ||
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
    dependencies === undefined ||
    (isObject(dependencies) &&
      Object.keys(dependencies).every(isTruthyString) &&
      Object.values(dependencies).every(isTruthyString))
  );
}

/**
 * Constructs a message for a manifest file validation error.
 *
 * TODO: Remove when other functions are moved to action-utils.
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
function buildManifestFieldValidationErrorMessage({
  manifest,
  parentDirectory,
  invalidFieldName,
  verbPhrase,
}: {
  manifest: UnvalidatedManifest;
  parentDirectory: string;
  invalidFieldName: keyof UnvalidatedManifest;
  verbPhrase: string;
}) {
  const subject = isTruthyString(manifest[ManifestFieldNames.Name])
    ? `The value of "${invalidFieldName}" in the manifest for "${
        manifest[ManifestFieldNames.Name]
      }"`
    : `The value of "${invalidFieldName}" in the manifest located at "${parentDirectory}"`;
  return `${subject} ${verbPhrase}`;
}

/**
 * Retrieves and validates a field within a package manifest object, throwing if
 * validation fails.
 *
 * TODO: Move this to action-utils.
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
 * @returns The value of the field, or the default value.
 */
function readManifestField<T, U>(
  options: Omit<ReadManifestFieldOptions<T, U>, 'transform' | 'defaultValue'>,
): T;
function readManifestField<T, U>(
  options: Require<ReadManifestFieldOptions<T, U>, 'transform'>,
): U;
function readManifestField<T, U>(
  options: Require<ReadManifestFieldOptions<T, U>, 'defaultValue'>,
): T extends undefined ? U : T;
/* eslint-disable-next-line jsdoc/require-jsdoc */
function readManifestField<T, U>({
  manifest,
  parentDirectory,
  fieldName,
  validation,
  defaultValue,
  transform,
}: ReadManifestFieldOptions<T, U>): T | U {
  const value = manifest[fieldName];

  if (!validation.check(value)) {
    throw new Error(
      buildManifestFieldValidationErrorMessage({
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
  return Object.values(ManifestDependencyFieldNames).reduce(
    (obj, fieldName) => {
      const dependencies = readManifestField({
        manifest,
        parentDirectory,
        fieldName,
        validation: validationForManifestDependenciesField,
        defaultValue: {},
      });
      return { ...obj, [fieldName]: dependencies };
    },
    {} as Record<ManifestDependencyFieldNames, Record<string, string>>,
  );
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
  const name = readManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: ManifestFieldNames.Name,
    validation: validationForManifestNameField,
  });
  const version = readManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: ManifestFieldNames.Version,
    validation: validationForManifestVersionField,
    transform: (value: string) => new SemVer(value),
  });
  const workspaces = readManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: ManifestFieldNames.Workspaces,
    validation: validationForManifestWorkspacesField,
    defaultValue: [],
  });
  const privateValue = readManifestField({
    manifest: unvalidatedManifest,
    parentDirectory,
    fieldName: ManifestFieldNames.Private,
    validation: validationForManifestPrivateField,
    defaultValue: false,
  });
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
