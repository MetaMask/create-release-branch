import { withSandbox } from '../../helpers.js';
import MonorepoEnvironment, {
  MonorepoEnvironmentOptions,
} from './monorepo-environment.js';

/**
 * Runs the given function and ensures that even if `process.env` is changed
 * during the function, it is restored afterward.
 *
 * @param callback - The function to call that presumably will change
 * `process.env`.
 * @returns Whatever the callback returns.
 */
export async function withProtectedProcessEnv<T>(callback: () => Promise<T>) {
  const originalEnv = { ...process.env };

  try {
    return await callback();
  } finally {
    const originalKeys = Object.keys(originalEnv);
    const currentKeys = Object.keys(process.env);

    originalKeys.forEach((key) => {
      process.env[key] = originalEnv[key];
    });

    currentKeys
      .filter((key) => !originalKeys.includes(key))
      .forEach((key) => {
        delete process.env[key];
      });
  }
}

/**
 * Builds a monorepo project in a temporary directory, then calls the given
 * function with information about that project.
 *
 * @param options - The configuration options for the environment.
 * @param callback - A function which will be called with an object that can be
 * used to interact with the project.
 * @returns Whatever the callback returns.
 */
export async function withMonorepoProjectEnvironment<
  CallbackReturnValue,
  WorkspacePackageNickname extends string,
>(
  options: Omit<
    MonorepoEnvironmentOptions<WorkspacePackageNickname>,
    'directoryPath'
  >,
  callback: (
    environment: MonorepoEnvironment<WorkspacePackageNickname>,
  ) => Promise<CallbackReturnValue>,
) {
  return withProtectedProcessEnv(async () => {
    return withSandbox(async (sandbox) => {
      const environment = new MonorepoEnvironment({
        ...options,
        directoryPath: sandbox.directoryPath,
      });
      await environment.initialize();
      return await callback(environment);
    });
  });
}
