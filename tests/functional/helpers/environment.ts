import path from 'path';
import LocalRepo from './local-repo';
import RemoteRepo from './remote-repo';
import Repo from './repo';

/**
 * Describes the package that is used to initialize a polyrepo, or one of the
 * packages that is used to initialize a monorepo.
 *
 * @property name - The desired name of the package.
 * @property version - The desired version of the package.
 * @property directory - The path relative to the repo's root directory that
 * holds this package.
 */
export interface PackageSpecification {
  name: string;
  version?: string;
  directoryPath: string;
}

/**
 * A set of options with which to configure the tool or the repos
 * against which the tool is run.
 *
 * @property sandbox - The directory out of which this environment will operate.
 * @property createInitialCommit - Usually when a repo is initialized, a commit
 * is created (which will contain starting `package.json` files). You can use
 * this option to disable that if you need to create your own commits for
 * clarity.
 */
export interface EnvironmentOptions {
  directoryPath: string;
  createInitialCommit?: boolean;
}

/**
 * This class sets up each test and acts as a facade to all of the actions that
 * we need to take from within the test.
 */
export default abstract class Environment<SpecificLocalRepo extends LocalRepo> {
  protected directoryPath: string;

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

  constructor(options: EnvironmentOptions) {
    const { directoryPath } = options;
    this.directoryPath = directoryPath;
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
  async initialize() {
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
