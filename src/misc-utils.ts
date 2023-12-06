import which from 'which';
import { execa, Options } from 'execa';
import createDebug from 'debug';
import { ErrorWithCause } from 'pony-cause';
import { isObject } from '@metamask/utils';

export { isTruthyString } from '@metamask/action-utils';
export { hasProperty, isNullOrUndefined } from '@metamask/utils';
export { isObject };

/**
 * A logger object for the implementation part of this project.
 *
 * @see The [debug](https://www.npmjs.com/package/debug) package.
 */
export const debug = createDebug('create-release-branch:impl');

/**
 * Type guard for determining whether the given value is an instance of Error.
 * For errors generated via `fs.promises`, `error instanceof Error` won't work,
 * so we have to come up with another way of testing.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
function isError(error: unknown): error is Error {
  return (
    error instanceof Error ||
    (isObject(error) && error.constructor.name === 'Error')
  );
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
 * Builds a new error object, linking to the original error via the `cause`
 * property if it is an Error.
 *
 * This function is useful to reframe error messages in general, but is
 * _critical_ when interacting with any of Node's filesystem functions as
 * provided via `fs.promises`, because these do not produce stack traces in the
 * case of an I/O error (see <https://github.com/nodejs/node/issues/30944>).
 *
 * @param message - The desired message of the new error.
 * @param originalError - The error that you want to cover (either an Error or
 * something throwable).
 * @returns A new error object.
 */
export function wrapError(message: string, originalError: unknown) {
  if (isError(originalError)) {
    const error: any = new ErrorWithCause(message, { cause: originalError });

    if (isErrorWithCode(originalError)) {
      error.code = originalError.code;
    }

    return error;
  }

  return new Error(`${message}: ${originalError}`);
}

/**
 * Retrieves the real path of an executable via `which`.
 *
 * @param executablePath - The path to an executable.
 * @returns The resolved path to the executable.
 * @throws what `which` throws if it is not a "not found" error.
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
  options?: Options | undefined,
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
  options?: Options | undefined,
): Promise<string> {
  return (await execa(command, args, options)).stdout.trim();
}

/**
 * Run a command, splitting up the immediate output into lines.
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
  options?: Options | undefined,
): Promise<string[]> {
  const { stdout } = await execa(command, args, options);
  return stdout.split('\n').filter((value) => value !== '');
}
