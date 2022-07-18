import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import { nanoid } from 'nanoid';
import rimraf from 'rimraf';

/**
 * A promisified version of `rimraf`.
 */
const promisifiedRimraf = util.promisify(rimraf);

/**
 * Information about the sandbox provided to tests that need access to the
 * filesystem.
 */
interface Sandbox {
  directoryPath: string;
}

/**
 * The container for test-level sandboxes.
 */
export const TEMP_DIRECTORY_PATH = path.join(
  os.tmpdir(),
  'create-release-branch-tests',
);

/**
 * Creates a temporary directory to hold files that a test could write, runs the
 * given function, then ensures that the directory is removed afterward.
 *
 * @param fn - The function to call.
 * @throws If the temporary directory already exists for some reason. This would
 * indicate a bug in how the names of the directory is determined.
 */
export async function withSandbox(fn: (sandbox: Sandbox) => any) {
  const directoryPath = path.join(TEMP_DIRECTORY_PATH, nanoid());
  let stats;

  try {
    stats = await fs.promises.stat(directoryPath);

    if (stats.isDirectory()) {
      throw new Error(
        `Directory ${directoryPath} already exists, cannot continue`,
      );
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.promises.mkdir(directoryPath, { recursive: true });

  try {
    await fn({ directoryPath });
  } finally {
    await promisifiedRimraf(directoryPath);
  }
}
