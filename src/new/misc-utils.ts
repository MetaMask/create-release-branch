import which from 'which';
import createDebug from 'debug';

export { isTruthyString } from '@metamask/action-utils';
export { hasProperty, isNullOrUndefined, isObject } from '@metamask/utils';

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
 * Returns a version of the given record type where optionality is added to
 * the designated keys.
 */
export type Unrequire<T, K extends keyof T> = Omit<T, K> & {
  [P in K]+?: T[P];
};

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
 * `Object.keys()` is intentionally generic: it returns the keys of an object,
 * but it cannot make guarantees about the contents of that object, so the type
 * of the keys is merely `string[]`. While this is technically accurate, it is
 * also unnecessary if we have an object that we own and whose contents are
 * known exactly.
 *
 * Note: This function will not work when given an object where any of the keys
 * are optional.
 *
 * @param object - The object.
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
