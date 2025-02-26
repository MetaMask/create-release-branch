import createDebug from 'debug';

/**
 * Logger for development only.
 */
export const debug = createDebug('create-release-branch:tests');

/**
 * `Object.keys()` is intentionally generic: it returns the keys of an object,
 * but it cannot make guarantees about the contents of that object, so the type
 * of the keys is merely `string[]`. While this is technically accurate, it is
 * also unnecessary if we have an object that we own and whose contents are
 * known exactly.
 *
 * @param object - The object.
 * @returns The keys of an object, typed according to the type of the object
 * itself.
 */
export function knownKeysOf<Key extends string | number | symbol>(
  object: Partial<Record<Key, any>>,
): Key[] {
  return Object.keys(object) as Key[];
}

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
 * Pauses execution for some time.
 *
 * @param duration - The number of milliseconds to pause.
 */
export async function sleepFor(duration: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, duration));
}
