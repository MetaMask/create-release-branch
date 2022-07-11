import fs from 'fs';
import {
  readJsonObjectFile as underlyingReadJsonObjectFile,
  writeJsonFile as underlyingWriteJsonFile,
} from '@metamask/action-utils';
import { isErrorWithCode, isErrorWithStack } from './utils';

/**
 * Reads the file at the given path, assuming its content is encoded as UTF-8.
 *
 * @param filePath - The path to the file.
 * @returns The content of the file.
 * @throws If reading fails in any way.
 */
export async function readFile(filePath: string): Promise<string> {
  // Node's `fs.promises` module does not produce a stack trace if there is an
  // I/O error. See: <https://github.com/nodejs/node/issues/30944>
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch (error) {
    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(`Could not read file '${filePath}': ${message}`);
  }
}

/**
 * Writes content to the file at the given path.
 *
 * @param filePath - The path to the file.
 * @param content - The new content of the file.
 * @returns Nothing meaningful.
 * @throws If writing fails in any way.
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  // Node's `fs.promises` module does not produce a stack trace if there is an
  // I/O error. See: <https://github.com/nodejs/node/issues/30944>
  try {
    return await fs.promises.writeFile(filePath, content);
  } catch (error) {
    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(`Could not write file '${filePath}': ${message}`);
  }
}

/**
 * Reads the assumed JSON file at the given path, attempts to parse it, and
 * returns the resulting object.
 *
 * Throws if failing to read or parse, or if the parsed JSON value is not a
 * plain object.
 *
 * @param path - The path segments pointing to the JSON file. Will be passed
 * to path.join().
 * @returns The object corresponding to the parsed JSON file.
 */
export async function readJsonObjectFile(
  path: string,
): Promise<Record<string, unknown>> {
  // Node's `fs.promises` module does not produce a stack trace if there is an
  // I/O error. See: <https://github.com/nodejs/node/issues/30944>
  try {
    return await underlyingReadJsonObjectFile(path);
  } catch (error) {
    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(`Could not read JSON file '${path}': ${message}`);
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
 * @returns Nothing meaningful.
 */
export async function writeJsonFile(
  filePath: string,
  jsonValue: unknown,
): Promise<void> {
  // Node's `fs.promises` module does not produce a stack trace if there is an
  // I/O error. See: <https://github.com/nodejs/node/issues/30944>
  try {
    return await underlyingWriteJsonFile(filePath, jsonValue);
  } catch (error) {
    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(`Could not write JSON file: ${message}`);
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

    const message = isErrorWithStack(error) ? error.stack : error;
    throw new Error(
      `Could not determine if file exists '${entryPath}': ${message}`,
    );
  }
}
