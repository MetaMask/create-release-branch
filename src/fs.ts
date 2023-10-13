import {
  readJsonObjectFile as underlyingReadJsonObjectFile,
  writeJsonFile as underlyingWriteJsonFile,
} from '@metamask/action-utils';
import fs from 'fs';

import { wrapError, isErrorWithCode } from './misc-utils';

/**
 * Represents a writeable stream, such as that represented by `process.stdout`
 * or `process.stderr`, or a fake one provided in tests.
 */
export type WriteStreamLike = Pick<fs.WriteStream, 'write'>;

/**
 * Reads the file at the given path, assuming its content is encoded as UTF-8.
 *
 * @param filePath - The path to the file.
 * @returns The content of the file.
 * @throws An error with a stack trace if reading fails in any way.
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    throw wrapError(`Could not read file '${filePath}'`, error);
  }
}

/**
 * Writes content to the file at the given path.
 *
 * @param filePath - The path to the file.
 * @param content - The new content of the file.
 * @throws An error with a stack trace if writing fails in any way.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    await fs.promises.writeFile(filePath, content);
  } catch (error) {
    throw wrapError(`Could not write file '${filePath}'`, error);
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
 * @throws An error with a stack trace if reading fails in any way.
 */
export async function readJsonObjectFile(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    return await underlyingReadJsonObjectFile(filePath);
  } catch (error) {
    throw wrapError(`Could not read JSON file '${filePath}'`, error);
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
 * @throws An error with a stack trace if writing fails in any way.
 */
export async function writeJsonFile(
  filePath: string,
  jsonValue: unknown,
): Promise<void> {
  try {
    await underlyingWriteJsonFile(filePath, jsonValue);
  } catch (error) {
    throw wrapError(`Could not write JSON file '${filePath}'`, error);
  }
}

/**
 * Tests the given path to determine whether it represents a file.
 *
 * @param entryPath - The path to a file (or directory) on the filesystem.
 * @returns A promise for true if the file exists or false otherwise.
 * @throws An error with a stack trace if reading fails in any way.
 */
export async function fileExists(entryPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(entryPath);
    return stats.isFile();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      return false;
    }

    throw wrapError(`Could not determine if file exists '${entryPath}'`, error);
  }
}

/**
 * Creates the given directory along with any directories leading up to the
 * directory. If the directory already exists, this is a no-op.
 *
 * @param directoryPath - The path to the desired directory.
 * @returns What `fs.promises.mkdir` returns.
 * @throws An error with a stack trace if reading fails in any way.
 */
export async function ensureDirectoryPathExists(
  directoryPath: string,
): Promise<string | undefined> {
  try {
    return await fs.promises.mkdir(directoryPath, { recursive: true });
  } catch (error) {
    throw wrapError(
      `Could not create directory path '${directoryPath}'`,
      error,
    );
  }
}

/**
 * Removes the given file, if it exists.
 *
 * @param filePath - The path to the file.
 * @returns What `fs.promises.rm` returns.
 * @throws An error with a stack trace if removal fails in any way.
 */
export async function removeFile(filePath: string): Promise<void> {
  try {
    return await fs.promises.rm(filePath, { force: true });
  } catch (error) {
    throw wrapError(`Could not remove file '${filePath}'`, error);
  }
}
