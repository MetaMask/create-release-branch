import { withProtectedProcessEnv, withSandbox } from '../../helpers.js';
import MonorepoEnvironment, {
  MonorepoEnvironmentOptions,
} from './monorepo-environment.js';

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
