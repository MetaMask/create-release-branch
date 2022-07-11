import fs from 'fs';
import path from 'path';
import rimraf from 'rimraf';
import MonorepoEnvironment, {
  MonorepoEnvironmentOptions,
} from './monorepo-environment';
import PolyrepoEnvironment, {
  PolyrepoEnvironmentOptions,
} from './polyrepo-environment';
import { SANDBOX_DIR } from './constants';
import { debug } from './utils';

/**
 * Type guard for determining whether the given value is an error object with a
 * `code` property such as the type of error that Node throws for filesystem
 * operations, etc.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
function isErrorWithCode(error: unknown): error is { code: string } {
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
 * Ensures that a temporary directory, which will be used to initialize
 * files that are necessary to run the script, exists for the duration of the
 * given function and is removed after the function completes.
 *
 * @param callback - The function to call with the temporary directory.
 * @returns Whatever the callback returns.
 */
export async function withInitializedSandboxDirectory<T>(
  callback: ({
    sandboxDir,
    environmentsDir,
  }: {
    sandboxDir: string;
    environmentsDir: string;
  }) => Promise<T>,
): Promise<T> {
  const environmentsDir = path.join(SANDBOX_DIR, 'projects');

  try {
    await new Promise((resolve) => {
      rimraf(SANDBOX_DIR, resolve);
    });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      // continue
    } else {
      const message = isErrorWithMessage(error) ? error.message : error;
      throw new Error(`Couldn't remove directory ${SANDBOX_DIR}: ${message}`);
    }
  }

  if (process.env.DEBUG) {
    debug('Removed sandbox directory', SANDBOX_DIR);
  }

  await fs.promises.mkdir(SANDBOX_DIR);
  await fs.promises.mkdir(environmentsDir);

  if (process.env.DEBUG) {
    debug('Created sandbox directory', SANDBOX_DIR);
  }

  /* eslint-disable-next-line node/no-callback-literal */
  return await callback({ sandboxDir: SANDBOX_DIR, environmentsDir });
}

/**
 * Runs the given function and ensures that even if `process.env` is changed
 * during the function, it is restored afterward.
 *
 * @param callback - The function to call that presumably will change `process.env`.
 * @returns Whatever the callback returns.
 */
export async function withProtectedProcessEnv<T>(callback: () => Promise<T>) {
  const originalEnv = { ...process.env };

  try {
    return await callback();
  } finally {
    Object.keys(originalEnv).forEach((key) => {
      process.env[key] = originalEnv[key];
    });
  }
}

/**
 * Builds a polyrepo project in a temporary directory, then yields the given
 * function with information about that project.
 *
 * @param options - The options with which to initialize the environment in
 * which the project will be interacted with.
 * @param callback - A function which will be called with an object that can be
 * used to interact with the project.
 * @returns Whatever the callback returns.
 */
export async function withPolyrepoProjectEnvironment<T>(
  options: Omit<
    PolyrepoEnvironmentOptions,
    'name' | 'sandboxDir' | 'environmentsDir'
  >,
  callback: (environment: PolyrepoEnvironment) => Promise<T>,
) {
  return withProtectedProcessEnv(async () => {
    return withInitializedSandboxDirectory(
      async ({ sandboxDir, environmentsDir }) => {
        const environment = new PolyrepoEnvironment({
          ...options,
          name: 'polyrepo',
          sandboxDir,
          environmentsDir,
        });
        await environment.initialize();
        return await callback(environment);
      },
    );
  });
}

/**
 * Builds a monorepo project in a temporary directory, then yields the given
 * function with information about that project.
 *
 * @param options - The options with which to initialize the environment in
 * which the project will be interacted with.
 * @param callback - A function which will be called with an object that can be
 * used to interact with the project.
 * @returns Whatever the callback returns.
 */
export async function withMonorepoProjectEnvironment<
  CallbackReturnValue,
  PackageNickname extends string
>(
  options: Omit<
    MonorepoEnvironmentOptions<PackageNickname>,
    'name' | 'sandboxDir' | 'environmentsDir'
  >,
  callback: (
    environment: MonorepoEnvironment<PackageNickname>,
  ) => Promise<CallbackReturnValue>,
) {
  return withProtectedProcessEnv(async () => {
    return withInitializedSandboxDirectory(
      async ({ sandboxDir, environmentsDir }) => {
        const environment = new MonorepoEnvironment({
          ...options,
          name: 'monorepo',
          sandboxDir,
          environmentsDir,
        });
        await environment.initialize();
        return await callback(environment);
      },
    );
  });
}
