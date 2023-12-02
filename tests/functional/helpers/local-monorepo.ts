import path from 'path';
import { PackageSpecification } from './environment.js';
import LocalRepo, { LocalRepoOptions } from './local-repo.js';
import { knownKeysOf } from './utils.js';

/**
 * A set of configuration options for a {@link LocalMonorepo}. In addition
 * to the options listed in {@link LocalRepoOptions}, these include:
 *
 * @property packages - The known packages within this repo (including the
 * root).
 * @property workspaces - The known workspaces within this repo.
 */
export type LocalMonorepoOptions<WorkspacePackageNickname extends string> = {
  packages: Record<WorkspacePackageNickname, PackageSpecification>;
  workspaces: Record<string, string[]>;
} & LocalRepoOptions;

/**
 * Represents the repo that the tool is run against, containing logic specific
 * to a monorepo.
 */
export default class LocalMonorepo<
  WorkspacePackageNickname extends string,
> extends LocalRepo {
  /**
   * The known packages within this repo (including the root).
   */
  #packages: Record<'$root$' | WorkspacePackageNickname, PackageSpecification>;

  /**
   * The known workspaces within this repo.
   */
  #workspaces: LocalMonorepoOptions<WorkspacePackageNickname>['workspaces'];

  constructor({
    packages,
    workspaces,
    ...rest
  }: LocalMonorepoOptions<WorkspacePackageNickname>) {
    super(rest);
    this.#packages = {
      $root$: {
        name: 'monorepo',
        version: '2022.1.1',
        directoryPath: '.',
      },
      ...packages,
    };
    this.#workspaces = workspaces;
  }

  /**
   * Reads a file within a workspace package within the project.
   *
   * @param packageNickname - The nickname of the workspace package, as
   * identified in the `packages` options passed to
   * `withMonorepoProjectEnvironment`.
   * @param partialFilePath - The path to the desired file within the package.
   * @returns The content of the file.
   */
  async readFileWithinPackage(
    packageNickname: '$root$' | WorkspacePackageNickname,
    partialFilePath: string,
  ) {
    const packageDirectoryPath = this.#packages[packageNickname].directoryPath;
    return await this.readFile(
      path.join(packageDirectoryPath, partialFilePath),
    );
  }

  /**
   * Reads a JSON file within a workspace package within the project.
   *
   * @param packageNickname - The nickname of the workspace package, as
   * identified in the `packages` options passed to
   * `withMonorepoProjectEnvironment`.
   * @param partialFilePath - The path to the desired file within the package.
   * @returns The object which the JSON file holds.
   */
  async readJsonFileWithinPackage(
    packageNickname: '$root$' | WorkspacePackageNickname,
    partialFilePath: string,
  ) {
    const packageDirectoryPath = this.#packages[packageNickname].directoryPath;
    return await this.readJsonFile(
      path.join(packageDirectoryPath, partialFilePath),
    );
  }

  /**
   * Creates or overwrites a file within a workspace package within the project.
   *
   * @param packageNickname - The nickname of the workspace package, as
   * identified in the `packages` options passed to
   * `withMonorepoProjectEnvironment`.
   * @param partialFilePath - The path to the desired file within the package.
   * @param contents - The desired contents of the file.
   */
  async writeFileWithinPackage(
    packageNickname: '$root$' | WorkspacePackageNickname,
    partialFilePath: string,
    contents: string,
  ): Promise<void> {
    const packageDirectoryPath = this.#packages[packageNickname].directoryPath;
    await this.writeFile(
      path.join(packageDirectoryPath, partialFilePath),
      contents,
    );
  }

  /**
   * Creates or overwrites a JSON file within a workspace package within the
   * project.
   *
   * @param packageNickname - The nickname of the workspace package, as
   * identified in the `packages` options passed to
   * `withMonorepoProjectEnvironment`.
   * @param partialFilePath - The path to the desired file within the package.
   * @param object - The new object that the file should represent.
   */
  async writeJsonFileWithinPackage(
    packageNickname: '$root$' | WorkspacePackageNickname,
    partialFilePath: string,
    object: Record<string, unknown>,
  ): Promise<void> {
    const packageDirectoryPath = this.#packages[packageNickname].directoryPath;
    await this.writeJsonFile(
      path.join(packageDirectoryPath, partialFilePath),
      object,
    );
  }

  /**
   * Updates a JSON file within a workspace package within the project.
   *
   * @param packageNickname - The nickname of the workspace package, as
   * identified in the `packages` options passed to
   * `withMonorepoProjectEnvironment`.
   * @param partialFilePath - The path to the desired file within the package.
   * @param object - The new object should be merged into the file.
   */
  async updateJsonFileWithinPackage(
    packageNickname: '$root$' | WorkspacePackageNickname,
    partialFilePath: string,
    object: Record<string, unknown>,
  ): Promise<void> {
    const packageDirectoryPath = this.#packages[packageNickname].directoryPath;
    await this.updateJsonFile(
      path.join(packageDirectoryPath, partialFilePath),
      object,
    );
  }

  /**
   * Writes an initial package.json for the root package as well as any
   * workspace packages (if specified).
   */
  protected async afterCreate() {
    await super.afterCreate();

    await this.writeJsonFile('package.json', { private: true });

    // Update manifests for root and workspace packages with `name`, `version`,
    // and (optionally) `workspaces`
    await Promise.all(
      knownKeysOf(this.#packages).map((packageName) => {
        const pkg = this.#packages[packageName];
        const content = {
          name: pkg.name,
          ...('version' in pkg ? { version: pkg.version } : {}),
          ...(pkg.directoryPath in this.#workspaces
            ? { workspaces: this.#workspaces[pkg.directoryPath] }
            : {}),
        };
        return this.updateJsonFile(
          path.join(pkg.directoryPath, 'package.json'),
          content,
        );
      }),
    );
  }

  /**
   * Gets the name of the primary package that this project represents.
   *
   * @returns The name of the root package.
   */
  protected getPackageName() {
    return this.#packages.$root$.name;
  }

  /**
   * Gets the version of the primary package that this project represents.
   *
   * @returns The version of the root package.
   */
  protected getPackageVersion() {
    return this.#packages.$root$.version;
  }
}
