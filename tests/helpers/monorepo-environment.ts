import fs from 'fs';
import path from 'path';
import { ExecaReturnValue } from 'execa';
import YAML from 'yaml';
import { SCRIPT_EXECUTABLE_PATH, TS_NODE_PATH } from './constants';
import Environment, {
  CommandEnv,
  EnvironmentOptions,
  PackageSpecification,
} from './environment';
import LocalMonorepo from './local-monorepo';
import { debug } from './utils';

/**
 * A set of options with which to configure the action script or the repos
 * against which the action script is run. In addition to the options listed
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

interface ReleaseSpecification<PackageNickname extends string> {
  packages: Partial<Record<PackageNickname, string>>;
}

/**
 * This class configures Environment such that the "local" repo becomes a
 * monorepo.
 */
export default class MonorepoEnvironment<
  PackageNickname extends string
> extends Environment<LocalMonorepo<PackageNickname>> {
  readFileWithinPackage: LocalMonorepo<PackageNickname>['readFileWithinPackage'];

  writeFileWithinPackage: LocalMonorepo<PackageNickname>['writeFileWithinPackage'];

  readJsonFileWithinPackage: LocalMonorepo<PackageNickname>['readJsonFileWithinPackage'];

  writeJsonFileWithinPackage: LocalMonorepo<PackageNickname>['writeJsonFileWithinPackage'];

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
    this.readJsonFileWithinPackage = this.localRepo.readJsonFileWithinPackage.bind(
      this.localRepo,
    );
    this.writeJsonFileWithinPackage = this.localRepo.writeJsonFileWithinPackage.bind(
      this.localRepo,
    );
  }

  protected buildLocalRepo(
    projectDir: string,
    remoteRepoDir: string,
    {
      packages = {} as Record<PackageNickname, PackageSpecification>,
      workspaces = {},
      commandEnv = {},
      createInitialCommit = true,
    }: Omit<MonorepoEnvironmentOptions<PackageNickname>, 'commandEnv'> & {
      commandEnv: CommandEnv;
    },
  ) {
    return new LocalMonorepo<PackageNickname>({
      environmentDir: projectDir,
      packages,
      workspaces,
      commandEnv,
      createInitialCommit,
      remoteRepoDir,
    });
  }

  /**
   * Runs the script within the context of the project, editing the generated
   * release spec template automatically with the given information before
   * continuing.
   *
   * @param args - The arguments to this function.
   * @param args.releaseSpecification - An object which specifies which packages should
   * be bumped, where keys are the *nicknames* of packages as specified in the
   * set of options passed to `withMonorepoProjectEnvironment`. Will be used
   * to fill in the release spec file that the script generates.
   * @returns The result of the command.
   */
  async runScript({
    releaseSpecification: releaseSpecificationWithPackageNicknames,
  }: {
    releaseSpecification: ReleaseSpecification<PackageNickname>;
  }): Promise<ExecaReturnValue<string>> {
    const releaseSpecificationPath = path.join(this.sandboxDir, 'release-spec');
    const releaseSpecificationWithPackageNames = {
      packages: Object.keys(
        releaseSpecificationWithPackageNicknames.packages,
      ).reduce((obj, packageNickname) => {
        const packageSpecification = this.#packages[
          packageNickname as PackageNickname
        ];
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
      this.sandboxDir,
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
        SCRIPT_EXECUTABLE_PATH,
        '--project-directory',
        this.localRepo.getWorkingDir(),
        '--temp-directory',
        path.join(this.localRepo.getWorkingDir(), 'tmp'),
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
