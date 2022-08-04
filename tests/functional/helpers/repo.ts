import fs from 'fs';
import path from 'path';
import execa, { ExecaChildProcess, Options as ExecaOptions } from 'execa';
import deepmerge from 'deepmerge';
import { debug, isErrorWithCode, sleepFor } from './utils';

/**
 * A set of configuration options for a {@link Repo}.
 *
 * @property environmentDirectoryPath - The directory that holds the environment
 * that created this repo.
 */
export interface RepoOptions {
  environmentDirectoryPath: string;
}

/**
 * The minimum amount of time that the tests will ensure exists between commits.
 *
 * @see createCommit
 */
const MIN_TIME_BETWEEN_COMMITS = 500;

/**
 * A facade for a Git repository.
 */
export default abstract class Repo {
  /**
   * The directory that holds the environment that created this repo.
   */
  protected environmentDirectoryPath: string;

  /**
   * The time at which the last commit was created. Used to determine whether we
   * need to sleep before the next commit is created.
   */
  #latestCommitTime: Date | undefined;

  constructor({ environmentDirectoryPath }: RepoOptions) {
    this.environmentDirectoryPath = environmentDirectoryPath;
    this.#latestCommitTime = undefined;
  }

  /**
   * Sets up the repo.
   */
  async initialize() {
    await this.create();
    await this.afterCreate();
  }

  /**
   * Reads the contents of a file in the project that is expected to hold
   * JSON data, with JSON deserialization/serialization handled automatically.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @returns The object which the JSON file holds.
   */
  async readJsonFile(
    partialFilePath: string,
  ): Promise<Record<string, unknown>> {
    return JSON.parse(await this.readFile(partialFilePath));
  }

  /**
   * Reads the contents of a file in the project.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @returns The file contents.
   */
  async readFile(partialFilePath: string): Promise<string> {
    return await fs.promises.readFile(this.pathTo(partialFilePath), 'utf8');
  }

  /**
   * Updates the contents of a file in the project that is expected to hold JSON
   * data, with JSON deserialization/serialization handled automatically. If the
   * file does not exist, it is assumed to return `{}`.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @param updates - The updates to apply to the contents of the JSON file.
   * @returns The result of `fs.promises.writeFile`.
   */
  async updateJsonFile(
    partialFilePath: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    let newObject: Record<string, unknown>;

    try {
      const object = await this.readJsonFile(partialFilePath);
      newObject = deepmerge(object, updates);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === 'ENOENT') {
        newObject = updates;
      } else {
        throw error;
      }
    }

    return await this.writeJsonFile(partialFilePath, newObject);
  }

  /**
   * Creates or overwrites a file in the project that is expected to hold JSON
   * data, with JSON deserialization/serialization handled automatically.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @param object - The new object that the file should represent.
   * @returns The result of `fs.promises.writeFile`.
   */
  async writeJsonFile(
    partialFilePath: string,
    object: Record<string, unknown>,
  ): Promise<void> {
    return await this.writeFile(partialFilePath, JSON.stringify(object));
  }

  /**
   * Creates or overwrites a file in the project. If the directory where the
   * file is located does not exist, it will be created.
   *
   * @param partialFilePath - The path to the file, with the path to the project
   * directory omitted.
   * @param contents - The desired contents of the file.
   * @returns The result of `fs.promises.writeFile`.
   */
  async writeFile(partialFilePath: string, contents: string): Promise<void> {
    const fullFilePath = this.pathTo(partialFilePath);
    await fs.promises.mkdir(path.dirname(fullFilePath), { recursive: true });
    return await fs.promises.writeFile(fullFilePath, contents);
  }

  /**
   * Creates a Git commit with the given message, ensuring that any unstaged
   * changes are staged first (or allowing the commit to be created without any
   * staged changes, if none exist).
   *
   * @param message - The commit message.
   * @returns The result of the command.
   */
  async createCommit(message: string): Promise<ExecaChildProcess<string>> {
    // When we are creating commits in tests, the dates of those commits may be
    // so close together that it ends up confusing commands like `git rev-list`
    // (which sorts commits in chronological order). Sleeping for a bit seems to
    // solve this problem.
    const now = new Date();
    const timeSincePreviousCommit =
      this.#latestCommitTime === undefined
        ? null
        : now.getTime() - this.#latestCommitTime.getTime();

    if (
      timeSincePreviousCommit !== null &&
      timeSincePreviousCommit < MIN_TIME_BETWEEN_COMMITS
    ) {
      await sleepFor(MIN_TIME_BETWEEN_COMMITS - timeSincePreviousCommit);
    }

    await this.runCommand('git', ['add', '-A']);
    const result = await this.runCommand('git', ['commit', '-m', message]);
    this.#latestCommitTime = now;
    return result;
  }

  /**
   * Runs a command within the context of the project.
   *
   * @param executableName - The executable to run.
   * @param args - The arguments to the executable.
   * @param options - Options to `execa`.
   * @returns The result of the command.
   */
  async runCommand(
    executableName: string,
    args?: readonly string[] | undefined,
    options?: ExecaOptions<string> | undefined,
  ): Promise<ExecaChildProcess<string>> {
    const { env, ...remainingOptions } =
      options === undefined ? { env: {} } : options;

    debug(
      'Running command `%s %s`...',
      executableName,
      args?.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' '),
    );

    const result = await execa(executableName, args, {
      all: true,
      cwd: this.getWorkingDirectoryPath(),
      env: {
        ...env,
        DEBUG_COLORS: '1',
      } as NodeJS.ProcessEnv,
      ...remainingOptions,
    });

    debug(
      'Completed command `%s %s`',
      executableName,
      args?.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' '),
    );

    return result;
  }

  /**
   * Custom logic with which to create the repo. Can be overridden in
   * subclasses.
   */
  protected async create(): Promise<void> {
    // no-op
  }

  /**
   * Custom logic with which to further initialize the repo after it is created.
   * By default, this configures Git to use an email and name for commits.
   * Can be overridden in subclasses.
   */
  protected async afterCreate(): Promise<void> {
    await this.runCommand('git', ['config', 'user.email', 'test@example.com']);
    await this.runCommand('git', ['config', 'user.name', 'Test User']);
  }

  /**
   * Constructs the path of a file or directory within the project.
   *
   * @param partialEntryPath - The path to the file or directory, with the path
   * to the project directory omitted.
   * @returns The full path to the file or directory.
   */
  protected pathTo(partialEntryPath: string): string {
    return path.resolve(this.getWorkingDirectoryPath(), partialEntryPath);
  }

  /**
   * Returns the directory where the repo is located. Overridden in subclasses.
   */
  abstract getWorkingDirectoryPath(): string;
}
