import { withSandbox } from '../../helpers';
import MonorepoEnvironment, {
  MonorepoEnvironmentOptions,
} from './monorepo-environment';

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
  PackageNickname extends string,
>(
  options: Omit<
    MonorepoEnvironmentOptions<PackageNickname>,
    'name' | 'directoryPath'
  >,
  callback: (
    environment: MonorepoEnvironment<PackageNickname>,
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
