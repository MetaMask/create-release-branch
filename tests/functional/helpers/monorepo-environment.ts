import fs from 'fs';
import path from 'path';
import { ExecaReturnValue } from 'execa';
import YAML from 'yaml';
import { TOOL_EXECUTABLE_PATH, TS_NODE_PATH } from './constants';
import Environment, {
  EnvironmentOptions,
  PackageSpecification,
} from './environment';
import LocalMonorepo from './local-monorepo';
import { debug } from './utils';

/**
 * A set of options with which to configure the tool or the repos
 * against which the tool is run. In addition to the options listed
 * in {@link EnvironmentOptions}, these include:
 *
 * @property packages - The known packages within this repo (including the
 * root).
 * @property workspaces - The known workspaces within this repo.
 */
export interface MonorepoEnvironmentOptions<PackageNickname extends string>
  extends EnvironmentOptions {
  packages?: Record<PackageNickname, PackageSpecification>;
  workspaces?: Record<string, string[]>;
  today?: Date;
}

/**
 * The release specification data.
 *
 * @property packages - The workspace packages within this repo that will be
 * released.
 */
interface ReleaseSpecification<PackageNickname extends string> {
  packages: Partial<Record<PackageNickname, string>>;
}

/**
 * This class configures Environment such that the "local" repo becomes a
 * monorepo.
 */
export default class MonorepoEnvironment<
  PackageNickname extends string,
> extends Environment<LocalMonorepo<PackageNickname>> {
  readFileWithinPackage: LocalMonorepo<PackageNickname>['readFileWithinPackage'];

  writeFileWithinPackage: LocalMonorepo<PackageNickname>['writeFileWithinPackage'];

  readJsonFileWithinPackage: LocalMonorepo<PackageNickname>['readJsonFileWithinPackage'];

  #packages: Record<PackageNickname, PackageSpecification>;

  #today: Date | undefined;

  constructor({ today, ...rest }: MonorepoEnvironmentOptions<PackageNickname>) {
    super(rest);
    this.#packages =
      rest.packages ?? ({} as Record<PackageNickname, PackageSpecification>);
    this.#today = today;
    this.readFileWithinPackage = this.localRepo.readFileWithinPackage.bind(
      this.localRepo,
    );
    this.writeFileWithinPackage = this.localRepo.writeFileWithinPackage.bind(
      this.localRepo,
    );
    this.readJsonFileWithinPackage =
      this.localRepo.readJsonFileWithinPackage.bind(this.localRepo);
  }

  protected buildLocalRepo({
    packages = {} as Record<PackageNickname, PackageSpecification>,
    workspaces = {},
    createInitialCommit = true,
  }: MonorepoEnvironmentOptions<PackageNickname>) {
    return new LocalMonorepo<PackageNickname>({
      environmentDirectoryPath: this.directoryPath,
      remoteRepoDirectoryPath: this.remoteRepo.getWorkingDirectoryPath(),
      packages,
      workspaces,
      createInitialCommit,
    });
  }

  /**
   * Runs the tool within the context of the project, editing the generated
   * release spec template automatically with the given information before
   * continuing.
   *
   * @param args - The arguments to this function.
   * @param args.releaseSpecification - An object which specifies which packages
   * should be bumped, where keys are the *nicknames* of packages as specified
   * in the set of options passed to `withMonorepoProjectEnvironment`. Will be
   * used to fill in the release spec file that the tool generates.
   * @returns The result of the command.
   */
  async runTool({
    releaseSpecification: releaseSpecificationWithPackageNicknames,
  }: {
    releaseSpecification: ReleaseSpecification<PackageNickname>;
  }): Promise<ExecaReturnValue<string>> {
    const releaseSpecificationPath = path.join(
      this.directoryPath,
      'release-spec',
    );
    const releaseSpecificationWithPackageNames = {
      packages: Object.keys(
        releaseSpecificationWithPackageNicknames.packages,
      ).reduce((obj, packageNickname) => {
        const packageSpecification =
          this.#packages[packageNickname as PackageNickname];
        const versionSpecifier =
          releaseSpecificationWithPackageNicknames.packages[
            packageNickname as PackageNickname
          ];
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

    const env = {
      EDITOR: releaseSpecificationEditorPath,
      ...(this.#today === undefined
        ? {}
        : { TODAY: this.#today.toISOString().replace(/T.+$/u, '') }),
    };

    const result = await this.localRepo.runCommand(
      TS_NODE_PATH,
      [
        '--transpileOnly',
        TOOL_EXECUTABLE_PATH,
        '--project-directory',
        this.localRepo.getWorkingDirectoryPath(),
        '--temp-directory',
        path.join(this.localRepo.getWorkingDirectoryPath(), 'tmp'),
      ],
      { env },
    );

    debug(
      ['---- START OUTPUT -----', result.all, '---- END OUTPUT -----'].join(
        '\n',
      ),
    );

    return result;
  }
}
