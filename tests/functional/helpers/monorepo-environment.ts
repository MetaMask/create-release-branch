import type { ExecaReturnValue } from 'execa';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';

import { TOOL_EXECUTABLE_PATH, TSX_PATH } from './constants.js';
import Environment, {
  EnvironmentOptions,
  PackageSpecification,
} from './environment.js';
import LocalMonorepo from './local-monorepo.js';
import { debug, knownKeysOf } from './utils.js';

/**
 * A set of configuration options for a {@link MonorepoEnvironment}. In addition
 * to the options listed in {@link EnvironmentOptions}, these include:
 *
 * Properties:
 *
 * - `packages` - The known packages within this repo (including the root).
 * - `workspaces` - The known workspaces within this repo.
 * - `directoryPath` - The directory out of which this environment will operate.
 * - `createInitialCommit` - Usually when a repo is initialized, a commit is
 *   created (which will contain starting `package.json` files). You can use
 *   this option to disable that if you need to create your own commits for
 *   clarity.
 */
export type MonorepoEnvironmentOptions<
  WorkspacePackageNickname extends string,
> = {
  packages: Record<WorkspacePackageNickname, PackageSpecification>;
  workspaces: Record<string, string[]>;
} & EnvironmentOptions;

/**
 * The release specification data.
 *
 * Properties:
 *
 * - `packages` - The workspace packages within this repo that will be released.
 */
type ReleaseSpecification<WorkspacePackageNickname extends string> = {
  packages: Partial<Record<WorkspacePackageNickname, string>>;
};

/**
 * This class configures the environment such that the "local" repo becomes a
 * monorepo.
 */
export default class MonorepoEnvironment<
  WorkspacePackageNickname extends string,
> extends Environment<LocalMonorepo<WorkspacePackageNickname>> {
  readFileWithinPackage: LocalMonorepo<WorkspacePackageNickname>['readFileWithinPackage'];

  writeFileWithinPackage: LocalMonorepo<WorkspacePackageNickname>['writeFileWithinPackage'];

  readJsonFileWithinPackage: LocalMonorepo<WorkspacePackageNickname>['readJsonFileWithinPackage'];

  updateJsonFileWithinPackage: LocalMonorepo<WorkspacePackageNickname>['updateJsonFileWithinPackage'];

  readonly #packages: MonorepoEnvironmentOptions<WorkspacePackageNickname>['packages'];

  /**
   * Creates a MonorepoEnvironment.
   *
   * @param options - The options.
   */
  constructor(options: MonorepoEnvironmentOptions<WorkspacePackageNickname>) {
    super(options);
    this.#packages = options.packages;
    this.readFileWithinPackage = this.localRepo.readFileWithinPackage.bind(
      this.localRepo,
    );
    this.writeFileWithinPackage = this.localRepo.writeFileWithinPackage.bind(
      this.localRepo,
    );
    this.readJsonFileWithinPackage =
      this.localRepo.readJsonFileWithinPackage.bind(this.localRepo);
    this.updateJsonFileWithinPackage =
      this.localRepo.updateJsonFileWithinPackage.bind(this.localRepo);
  }

  /**
   * Runs the tool within the context of the project, editing the generated
   * release spec template automatically with the given information before
   * continuing.
   *
   * @param args - The arguments to this function.
   * @param args.args - Additional arguments to pass to the command.
   * @param args.releaseSpecification - An object which specifies which packages
   * should be bumped, where keys are the *nicknames* of packages as specified
   * in the set of options passed to `withMonorepoProjectEnvironment`. Will be
   * used to fill in the release spec file that the tool generates.
   * @returns The result of the command.
   */
  async runTool({
    args: additionalArgs = [],
    releaseSpecification: releaseSpecificationWithPackageNicknames,
  }: {
    args?: string[];
    releaseSpecification: ReleaseSpecification<WorkspacePackageNickname>;
  }): Promise<ExecaReturnValue<string>> {
    const releaseSpecificationPath = path.join(
      this.directoryPath,
      'release-spec',
    );
    const releaseSpecificationWithPackageNames = {
      packages: knownKeysOf(
        releaseSpecificationWithPackageNicknames.packages,
      ).reduce((obj, packageNickname) => {
        const packageSpecification = this.#packages[packageNickname];
        const versionSpecifier =
          releaseSpecificationWithPackageNicknames.packages[packageNickname];
        return { ...obj, [packageSpecification.name]: versionSpecifier };
      }, {}),
    };
    await fs.promises.writeFile(
      releaseSpecificationPath,
      YAML.stringify(releaseSpecificationWithPackageNames),
    );

    const releaseSpecificationEditorPath = path.join(
      this.directoryPath,
      'release-spec-editor',
    );
    await fs.promises.writeFile(
      releaseSpecificationEditorPath,
      `
#!/bin/sh

if [ -z "$1" ]; then
  echo "ERROR: Must provide a path to edit."
  exit 1
fi

cat "${releaseSpecificationPath}" > "$1"
      `.trim(),
    );
    await fs.promises.chmod(releaseSpecificationEditorPath, 0o777);

    const args = [
      TOOL_EXECUTABLE_PATH,
      '--project-directory',
      this.localRepo.getWorkingDirectoryPath(),
      '--temp-directory',
      this.tempDirectoryPath,
      ...additionalArgs,
    ];
    const env = {
      EDITOR: releaseSpecificationEditorPath,
    };
    const result = await this.localRepo.runCommand(TSX_PATH, args, { env });

    debug(
      ['---- START OUTPUT -----', result.all, '---- END OUTPUT -----'].join(
        '\n',
      ),
    );

    return result;
  }

  /**
   * Creates a local monorepo.
   *
   * @param args - The arguments.
   * @param args.packages - The packages to include in the monorepo.
   * @param args.workspaces - The workspaces to include in the monorepo.
   * @param args.createInitialCommit - Whether to create an initial commit
   * when the monorepo is initialized.
   * @returns The local monorepo.
   */
  protected buildLocalRepo({
    packages,
    workspaces,
    createInitialCommit = true,
  }: MonorepoEnvironmentOptions<WorkspacePackageNickname>): LocalMonorepo<WorkspacePackageNickname> {
    return new LocalMonorepo<WorkspacePackageNickname>({
      environmentDirectoryPath: this.directoryPath,
      remoteRepoDirectoryPath: this.remoteRepo.getWorkingDirectoryPath(),
      packages,
      workspaces,
      createInitialCommit,
    });
  }
}
