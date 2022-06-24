import { ExecaReturnValue } from 'execa';
import { SCRIPT_EXECUTABLE_PATH, TS_NODE_PATH } from './constants';
import Environment, { CommandEnv, EnvironmentOptions } from './environment';
import LocalPolyrepo from './local-polyrepo';

/**
 * A set of options with which to configure the action script or the repos
 * against which the action script is run. In addition to the options listed
 * in {@link EnvironmentOptions}, these include:
 *
 * @property packageVersion - The version with which to initialize the package
 * represented by the "local" repo.
 */
export interface PolyrepoEnvironmentOptions extends EnvironmentOptions {
  packageVersion?: string;
}

/**
 * This class configures Environment such that the "local" repo becomes a
 * polyrepo.
 */
export default class PolyrepoEnvironment extends Environment<LocalPolyrepo> {
  protected buildLocalRepo(
    projectDir: string,
    remoteRepoDir: string,
    {
      packageVersion = '1.0.0',
      commandEnv = {},
      createInitialCommit = true,
    }: Omit<PolyrepoEnvironmentOptions, 'commandEnv'> & {
      commandEnv: CommandEnv;
    },
  ) {
    return new LocalPolyrepo({
      environmentDir: projectDir,
      packageName: 'polyrepo',
      packageVersion,
      commandEnv,
      createInitialCommit,
      remoteRepoDir,
    });
  }

  /**
   * Runs the script within the context of the project.
   *
   * @returns The result of the command.
   */
  async runScript(): Promise<ExecaReturnValue<string>> {
    return await this.localRepo.runCommand(TS_NODE_PATH, [
      '--transpileOnly',
      SCRIPT_EXECUTABLE_PATH,
    ]);
  }
}
