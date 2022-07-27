import which from 'which';
import execa from 'execa';
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
export type Require<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: T[P] };

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
 * Builds a new error object by optionally prepending a prefix or appending a
 * suffix to the error's message (or the error itself, it is a string). Retains
 * the `code` and `stack` of the original error object if they exist.
 *
 * This function is useful to reframe error messages in general, but is
 * _critical_ when interacting with any of Node's filesystem functions as
 * provided via `fs.promises`, because these do not produce stack traces in the
 * case of an I/O error (see <https://github.com/nodejs/node/issues/30944>).
 *
 * @param errorLike - Any value that can be thrown.
 * @param buildMessage - A function that can be used to build the message of the
 * new error object. It's passed an object that has a `message` property, and
 * returns that `message` by default.
 * @returns A new error object.
 */
export function wrapError(
  errorLike: unknown,
  buildMessage: (props: { message: string }) => string = (props) =>
    props.message,
) {
  const message = isErrorWithMessage(errorLike)
    ? errorLike.message
    : String(errorLike);
  const code = isErrorWithCode(errorLike) ? errorLike.code : undefined;
  const stack = isErrorWithStack(errorLike) ? errorLike.stack : undefined;
  const errorWithStack: Error & {
    code?: string | undefined;
    stack?: string | undefined;
  } = new Error(buildMessage({ message }));

  if (code !== undefined) {
    errorWithStack.code = code;
  }

  if (stack !== undefined) {
    errorWithStack.stack = stack;
  }

  return errorWithStack;
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

/**
 * Runs a command, discarding its output.
 *
 * @param command - The command to execute.
 * @param args - The positional arguments to the command.
 * @param options - The options to `execa`.
 * @throws An `execa` error object if the command fails in some way.
 * @see `execa`.
 */
export async function runCommand(
  command: string,
  args?: readonly string[] | undefined,
  options?: execa.Options<string> | undefined,
): Promise<void> {
  await execa(command, args, options);
}

/**
 * Runs a command, retrieving the standard output with leading and trailing
 * whitespace removed.
 *
 * @param command - The command to execute.
 * @param args - The positional arguments to the command.
 * @param options - The options to `execa`.
 * @returns The standard output of the command.
 * @throws An `execa` error object if the command fails in some way.
 * @see `execa`.
 */
export async function getStdoutFromCommand(
  command: string,
  args?: readonly string[] | undefined,
  options?: execa.Options<string> | undefined,
): Promise<string> {
  return (await execa(command, args, options)).stdout.trim();
}

/**
 * Runs a Git command, splitting up the immediate output into lines.
 *
 * @param command - The command to execute.
 * @param args - The positional arguments to the command.
 * @param options - The options to `execa`.
 * @returns The standard output of the command.
 * @throws An `execa` error object if the command fails in some way.
 * @see `execa`.
 */
export async function getLinesFromCommand(
  command: string,
  args?: readonly string[] | undefined,
  options?: execa.Options<string> | undefined,
): Promise<string[]> {
  const { stdout } = await execa(command, args, options);
  return stdout.split('\n').filter((value) => value !== '');
}

/**
 * Reorders the given set of strings according to the sort order.
 *
 * @param unsortedStrings - A set of strings that need to be sorted.
 * @param sortedStrings - A set of strings that designate the order in which
 * the first set of strings should be placed.
 * @returns A sorted version of `unsortedStrings`.
 */
export function placeInSpecificOrder(
  unsortedStrings: string[],
  sortedStrings: string[],
): string[] {
  const unsortedStringsCopy = unsortedStrings.slice();
  const newSortedStrings: string[] = [];
  sortedStrings.forEach((string) => {
    const index = unsortedStringsCopy.indexOf(string);

    if (index !== -1) {
      unsortedStringsCopy.splice(index, 1);
      newSortedStrings.push(string);
    }
  });
  newSortedStrings.push(...unsortedStringsCopy);
  return newSortedStrings;
}
