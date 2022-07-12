import fs from 'fs';
import {
  readJsonObjectFile as underlyingReadJsonObjectFile,
  writeJsonFile as underlyingWriteJsonFile,
} from '@metamask/action-utils';
import {
  isErrorWithCode,
  isErrorWithMessage,
  isErrorWithStack,
} from './misc-utils';

/**
 * Node's `fs.promises` module does not produce a stack trace if there is an I/O
 * error, so this function provides one by creating a new Error object.
 *
 * @param errorLike - Any value that can be thrown.
 * @param prefix - A string to place in the error message before the original
 * message.
 * @see https://github.com/nodejs/node/issues/30944
 * @returns A copy of the given error, but with a stack.
 */
function buildErrorWithStackFrom(errorLike: unknown, prefix: string) {
  const message = isErrorWithMessage(errorLike) ? errorLike.message : errorLike;
  const code = isErrorWithCode(errorLike) ? errorLike.code : undefined;
  const stack = isErrorWithStack(errorLike) ? errorLike.stack : undefined;
  const errorWithStack: Error & {
    code?: string | undefined;
    stack?: string | undefined;
  } = new Error(`${prefix}: ${message}`);
  errorWithStack.code = code;
  errorWithStack.stack = stack;
  return errorWithStack;
}

/**
 * Reads the file at the given path, assuming its content is encoded as UTF-8.
 *
 * @param filePath - The path to the file.
 * @returns The content of the file.
 * @throws If reading fails in any way.
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    throw buildErrorWithStackFrom(error, `Could not read file '${filePath}'`);
  }
}

/**
 * Writes content to the file at the given path.
 *
 * @param filePath - The path to the file.
 * @param content - The new content of the file.
 * @throws If writing fails in any way.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.promises.writeFile(filePath, content);
  } catch (error) {
    throw buildErrorWithStackFrom(error, `Could not write file '${filePath}'`);
  }
}

/**
 * Reads the assumed JSON file at the given path, attempts to parse it, and
 * returns the resulting object.
 *
 * Throws if failing to read or parse, or if the parsed JSON value is not a
 * plain object.
 *
 * @param filePath - The path segments pointing to the JSON file. Will be passed
 * to path.join().
 * @returns The object corresponding to the parsed JSON file.
 */
export async function readJsonObjectFile(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    return await underlyingReadJsonObjectFile(filePath);
  } catch (error) {
    throw buildErrorWithStackFrom(
      error,
      `Could not read JSON file '${filePath}'`,
    );
  }
}

/**
 * Attempts to write the given JSON-like value to the file at the given path.
 * Adds a newline to the end of the file.
 *
 * @param filePath - The path to write the JSON file to, including the file
 * itself.
 * @param jsonValue - The JSON-like value to write to the file. Make sure that
 * JSON.stringify can handle it.
 */
export async function writeJsonFile(
  filePath: string,
  jsonValue: unknown,
): Promise<void> {
  try {
    await underlyingWriteJsonFile(filePath, jsonValue);
  } catch (error) {
    throw buildErrorWithStackFrom(
      error,
      `Could not write JSON file '${filePath}'`,
    );
  }
}

/**
 * Tests the given path to determine whether it represents a file.
 *
 * @param entryPath - The path to a file (or directory) on the filesystem.
 * @returns A promise for true if the file exists or false otherwise.
 */
export async function fileExists(entryPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(entryPath);
    return stats.isFile();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      return false;
    }

    throw buildErrorWithStackFrom(
      error,
      `Could not determine if file exists '${entryPath}'`,
    );
  }
}
