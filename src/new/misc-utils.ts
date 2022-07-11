import createDebug from 'debug';
import which from 'which';

export { isTruthyString } from '@metamask/action-utils';

/**
 * A logger object for the implementation part of this project.
 *
 * @see The [debug](https://www.npmjs.com/package/debug) package.
 */
export const debug = createDebug('create-release-branch:impl');

/**
 * Returns a version of the given record type where optionality is removed from
 * the designated keys.
 */
export type Require<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * A JavaScript object that is not `null`, a function, or an array. The object
 * can still be an instance of a class.
 */
export type RuntimeObject = Record<number | string | symbol, unknown>;

/**
 * An alias for {@link Object.hasOwnProperty}.
 *
 * @param object - The object to check.
 * @param name - The property name to check for.
 * @returns Whether the specified object has an own property with the specified
 * name, regardless of whether it is enumerable or not.
 */
export const hasProperty = (
  object: RuntimeObject,
  name: string | number | symbol,
): boolean => Object.hasOwnProperty.call(object, name);

/**
 * Type guard for determining whether the given value is an error object with a
 * `code` property such as the type of error that Node throws for filesystem
 * operations, etc.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
export function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Type guard for determining whether the given value is an error object with a
 * `message` property, such as an instance of Error.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
export function isErrorWithMessage(
  error: unknown,
): error is { message: string } {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Type guard for determining whether the given value is an error object with a
 * `stack` property, such as an instance of Error.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
export function isErrorWithStack(error: unknown): error is { stack: string } {
  return typeof error === 'object' && error !== null && 'stack' in error;
}

/**
 * Type guard for "nullishness".
 *
 * @param value - Any value.
 * @returns `true` if the value is null or undefined, `false` otherwise.
 */
export function isNullOrUndefined(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * A type guard for {@link RuntimeObject}.
 *
 * @param value - The value to check.
 * @returns Whether the specified value has a runtime type of `object` and is
 * neither `null` nor an `Array`.
 */
export function isObject(value: unknown): value is RuntimeObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * `Object.keys()` is intentionally generic: it returns the keys of an object,
 * but it cannot make guarantees about the contents of that object, so the type
 * of the keys is merely `string[]`. While this is technically accurate, it is
 * also unnecessary if we have an object that we own and whose contents are
 * known exactly.
 *
 * @param object - The object. Note: The type of this object must be such that
 * all keys are required. This function will not work for a `Partial`-declared
 * object.
 * @returns The keys of an object, typed according to the type of the object
 * itself.
 */
export function knownKeysOf<K extends string | number | symbol>(
  object: Record<K, any>,
) {
  return Object.keys(object) as K[];
}

/**
 * Tests the given path to determine whether it represents an executable.
 *
 * @param executablePath - The path to an executable.
 * @returns A promise for true or false, depending on the result.
 */
export async function resolveExecutable(
  executablePath: string,
): Promise<string | null> {
  try {
    return await which(executablePath);
  } catch (error) {
    if (
      isErrorWithMessage(error) &&
      new RegExp(`^not found: ${executablePath}$`, 'u').test(error.message)
    ) {
      return null;
    }

    throw error;
  }
}
