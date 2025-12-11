import path from 'path';

import LocalRepo from './local-repo.js';
import RemoteRepo from './remote-repo.js';
import Repo from './repo.js';

/**
 * Describes the package that is used to initialize a polyrepo, or one of the
 * packages that is used to initialize a monorepo.
 *
 * Properties:
 *
 * - `name` - The desired name of the package.
 * - `version` - The desired version of the package.
 * - `directory` - The path relative to the repo's root directory that holds
 *   this package.
 */
export type PackageSpecification = {
  name: string;
  version?: string;
  directoryPath: string;
};

/**
 * A set of configuration options for an {@link Environment}.
 *
 * Properties:
 *
 * - `directoryPath` - The directory out of which this environment will operate.
 * - `createInitialCommit` - Usually when a repo is initialized, a commit is
 *   created (which will contain starting `package.json` files). You can use
 *   this option to disable that if you need to create your own commits for
 *   clarity.
 */
export type EnvironmentOptions = {
  directoryPath: string;
  createInitialCommit?: boolean;
};

/**
 * This class sets up each test and acts as a facade to all of the actions that
 * we need to take from within the test.
 */
export default abstract class Environment<SpecificLocalRepo extends LocalRepo> {
  protected directoryPath: EnvironmentOptions['directoryPath'];

  protected createInitialCommit: boolean;

  protected remoteRepo: Repo;

  protected localRepo: SpecificLocalRepo;

  tempDirectoryPath: string;

  readJsonFile: SpecificLocalRepo['readJsonFile'];

  readFile: SpecificLocalRepo['readFile'];

  updateJsonFile: SpecificLocalRepo['updateJsonFile'];

  writeJsonFile: SpecificLocalRepo['writeJsonFile'];

  writeFile: SpecificLocalRepo['writeFile'];

  runCommand: SpecificLocalRepo['runCommand'];

  createCommit: SpecificLocalRepo['createCommit'];

  /**
   * Creates an Environment.
   *
   * @param options - The options.
   */
  constructor(options: EnvironmentOptions) {
    const { directoryPath, createInitialCommit = true } = options;
    this.directoryPath = directoryPath;
    this.createInitialCommit = createInitialCommit;
    this.remoteRepo = new RemoteRepo({
      environmentDirectoryPath: directoryPath,
    });
    this.localRepo = this.buildLocalRepo(options);
    this.tempDirectoryPath = path.join(
      this.localRepo.getWorkingDirectoryPath(),
      'tmp',
    );
    this.readJsonFile = this.localRepo.readJsonFile.bind(this.localRepo);
    this.readFile = this.localRepo.readFile.bind(this.localRepo);
    this.updateJsonFile = this.localRepo.updateJsonFile.bind(this.localRepo);
    this.writeJsonFile = this.localRepo.writeJsonFile.bind(this.localRepo);
    this.writeFile = this.localRepo.writeFile.bind(this.localRepo);
    this.runCommand = this.localRepo.runCommand.bind(this.localRepo);
    this.createCommit = this.localRepo.createCommit.bind(this.localRepo);
  }

  /**
   * Creates two repos: a "remote" repo so that the tool can run commands such
   * as `git fetch --tags`, and a "local" repo, which is the one against which
   * the tool is run.
   */
  async initialize(): Promise<void> {
    await this.remoteRepo.initialize();
    await this.localRepo.initialize();
  }

  /**
   * This method is overridden in subclasses to return either a LocalPolyrepo or
   * a LocalMonorepo, depending on the use case.
   */
  protected abstract buildLocalRepo(
    options: EnvironmentOptions,
  ): SpecificLocalRepo;
}
