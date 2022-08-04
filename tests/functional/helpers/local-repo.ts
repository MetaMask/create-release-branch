import path from 'path';
import Repo, { RepoOptions } from './repo';

/**
 * A set of configuration options for a {@link LocalRepo}. In addition to the
 * options listed in {@link RepoOptions}, these include:
 *
 * @property remoteRepoDirectoryPath - The directory that holds the "remote"
 * companion of this repo.
 * @property createInitialCommit - Usually when this repo is initialized, a
 * commit is created (which will contain starting `package.json` files). You can
 * use this option to disable that if you need to create your own commits for
 * clarity.
 */
export interface LocalRepoOptions extends RepoOptions {
  remoteRepoDirectoryPath: string;
  createInitialCommit: boolean;
}

/**
 * A facade for the "local" repo, which is the repo with which the tool
 * interacts.
 */
export default abstract class LocalRepo extends Repo {
  /**
   * The directory that holds the "remote" companion of this repo.
   */
  #remoteRepoDirectoryPath: string;

  /**
   * Usually when this repo is initialized, a commit is created (which will
   * contain starting `package.json` files). You can use this option to disable
   * that if you need to create your own commits for clarity.
   */
  #createInitialCommit: boolean;

  constructor({
    remoteRepoDirectoryPath,
    createInitialCommit,
    ...rest
  }: LocalRepoOptions) {
    super(rest);
    this.#remoteRepoDirectoryPath = remoteRepoDirectoryPath;
    this.#createInitialCommit = createInitialCommit;
  }

  /**
   * Clones the "remote" repo.
   */
  protected async create() {
    await this.runCommand(
      'git',
      ['clone', this.#remoteRepoDirectoryPath, this.getWorkingDirectoryPath()],
      { cwd: path.resolve(this.getWorkingDirectoryPath(), '..') },
    );
  }

  /**
   * Writes an initial `package.json` (based on the configured name and version)
   * and changelog. Also creates an initial commit if this repo was configured
   * with `createInitialCommit: true`.
   */
  protected async afterCreate() {
    await super.afterCreate();

    // We reconfigure the repo such that it ostensibly has a remote that points
    // to a https:// or git:// URL, yet secretly points to the repo cloned
    // above. This way the tool is able to verify that the URL of `origin` is
    // correct, but we don't actually have to hit the internet when we run `git
    // fetch --tags`, etc.
    await this.runCommand('git', ['remote', 'remove', 'origin']);
    await this.runCommand('git', [
      'remote',
      'add',
      'origin',
      'https://github.com/example-org/example-repo',
    ]);
    await this.runCommand('git', [
      'config',
      `url.${this.#remoteRepoDirectoryPath}.insteadOf`,
      'https://github.com/example-org/example-repo',
    ]);

    await this.writeJsonFile('package.json', {
      name: this.getPackageName(),
      version: this.getPackageVersion(),
    });

    await this.writeFile(
      'CHANGELOG.md',
      `
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/example-org/example-repo/commits/main
      `.slice(1),
    );

    if (this.#createInitialCommit) {
      await this.createCommit('Initial commit');
    }
  }

  /**
   * Returns the path of the directory where this repo is located.
   *
   * @returns `local-repo` within the environment directory.
   */
  getWorkingDirectoryPath() {
    return path.join(this.environmentDirectoryPath, 'local-repo');
  }

  /**
   * Returns the name of the sole or main package that this repo represents. Overridden
   * in subclasses.
   */
  protected abstract getPackageName(): string;

  /**
   * Returns the version of the sole or main package that this repo represents.
   * Overridden in subclasses>
   */
  protected abstract getPackageVersion(): string | undefined;
}
