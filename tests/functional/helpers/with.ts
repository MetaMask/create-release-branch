import { withSandbox } from '../../helpers';
import MonorepoEnvironment, {
  MonorepoEnvironmentOptions,
} from './monorepo-environment';

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
 * @param options - Configuration options for the environment used to interact
 * with the project.
 * @param callback - Function which will be called with an object that can be
 * used to interact with the created environment in tests.
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
