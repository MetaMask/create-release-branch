import fs from 'fs';
import path from 'path';
import os from 'os';
import rimraf from 'rimraf';
import { SemVer } from 'semver';
import { followMonorepoWorkflow } from './monorepo-workflow-utils';
import * as editorUtils from './editor-utils';
import * as envUtils from './env-utils';
import * as packageUtils from './package-utils';
import type {
  Package,
  ManifestDependencyFieldNames,
  ValidatedManifest,
} from './package-utils';
import type { Project } from './project-utils';
import * as releaseSpecificationUtils from './release-specification-utils';
import * as workflowUtils from './workflow-utils';
import type { Unrequire } from './misc-utils';

jest.mock('./editor-utils');
jest.mock('./env-utils');
jest.mock('./package-utils');
jest.mock('./release-specification-utils');
jest.mock('./workflow-utils');

type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;

const TEMP_DIRECTORY = path.join(os.tmpdir(), 'create-release-branch-tests');

describe('monorepo-workflow-utils', () => {
  describe('followMonorepoWorkflow', () => {
    beforeEach(async () => {
      await ensureDirectoryCleared(TEMP_DIRECTORY);
    });

    describe("if no release spec has been created and an editor exists on the user's computer", () => {
      it('generates a release spec, waits for the user to edit it, then applies it to the monorepo', async () => {
        const project = buildMockProject({
          rootPackage: buildMockPackage('root', '2022.1.1', {
            manifest: {
              private: true,
              workspaces: ['packages/*'],
            },
          }),
          workspacePackages: {
            a: buildMockPackage('a', '1.0.0', {
              manifest: {
                private: false,
              },
            }),
          },
        });
        const { updatePackageSpy } = mockDependencies({
          determineEditor: {
            path: '/some/editor',
            args: [],
          },
          getEnvironmentVariables: {
            TODAY: '2022-06-12',
          },
          validateReleaseSpecification: {
            packages: {
              a: releaseSpecificationUtils.IncrementableVersionParts.major,
            },
          },
        });

        await followMonorepoWorkflow(project, TEMP_DIRECTORY, {
          firstRemovingExistingReleaseSpecification: false,
        });

        expect(updatePackageSpy).toHaveBeenNthCalledWith(1, project, {
          package: project.rootPackage,
          newVersion: '2022.6.12',
          shouldUpdateChangelog: false,
        });
        expect(updatePackageSpy).toHaveBeenNthCalledWith(2, project, {
          package: project.workspacePackages.a,
          newVersion: '2.0.0',
          shouldUpdateChangelog: true,
        });
      });

      it('creates a new branch named after the generated release version', async () => {
        const project: Project = buildMockProject({
          rootPackage: buildMockPackage('root', '2022.1.1', {
            manifest: {
              private: true,
              workspaces: ['packages/*'],
            },
          }),
          workspacePackages: {
            a: buildMockPackage('a', '1.0.0', {
              manifest: {
                private: false,
              },
            }),
          },
        });
        const { captureChangesInReleaseBranchSpy } = mockDependencies({
          determineEditor: {
            path: '/some/editor',
            args: [],
          },
          getEnvironmentVariables: {
            TODAY: '2022-06-12',
          },
          validateReleaseSpecification: {
            packages: {
              a: releaseSpecificationUtils.IncrementableVersionParts.major,
            },
          },
        });

        await followMonorepoWorkflow(project, TEMP_DIRECTORY, {
          firstRemovingExistingReleaseSpecification: false,
        });

        expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(project, {
          releaseName: '2022-06-12',
          packages: [
            {
              package: project.rootPackage,
              newVersion: '2022.6.12',
              shouldUpdateChangelog: false,
            },
            {
              package: project.workspacePackages.a,
              newVersion: '2.0.0',
              shouldUpdateChangelog: true,
            },
          ],
        });
      });
    });
  });
});

/**
 * Removes the given directory (if it exists) and then recreates it.
 *
 * @param directoryPath - The path to the directory.
 */
async function ensureDirectoryCleared(directoryPath: string) {
  await new Promise((resolve) => rimraf(directoryPath, resolve));
  await fs.promises.mkdir(directoryPath);
}

/**
 * Builds a project for use in tests, where `directoryPath` and `repositoryUrl`
 * do not have to be provided (they are filled in with reasonable defaults).
 *
 * @param overrides - The properties that will go into the object.
 * @returns The mock Project object.
 */
function buildMockProject(
  overrides: Unrequire<Project, 'directoryPath' | 'repositoryUrl'>,
): Project {
  const {
    directoryPath = '/path/to/project',
    repositoryUrl = 'https://repo.url',
    ...rest
  } = overrides;

  return {
    directoryPath,
    repositoryUrl,
    ...rest,
  };
}

/**
 * Builds a package for use in tests, where `directoryPath`, `manifestPath`, and
 * `changelogPath` do not have to be provided (they are filled in with
 * reasonable defaults), and where some fields in `manifest` is prefilled based
 * on `name` and `version`.
 *
 * @param name - The name of the package.
 * @param version - The version of the package, as a version string.
 * @param overrides - The properties that will go into the object.
 * @returns The mock Package object.
 */
function buildMockPackage(
  name: string,
  version: string,
  overrides: Omit<
    Unrequire<Package, 'directoryPath' | 'manifestPath' | 'changelogPath'>,
    'manifest'
  > & {
    manifest: Omit<
      Unrequire<
        ValidatedManifest,
        | packageUtils.ManifestFieldNames.Workspaces
        | ManifestDependencyFieldNames
      >,
      | packageUtils.ManifestFieldNames.Name
      | packageUtils.ManifestFieldNames.Version
    >;
  },
): Package {
  const {
    directoryPath = `/path/to/packages/${name}`,
    manifest,
    manifestPath = `/path/to/packages/${name}/manifest`,
    changelogPath = `/path/to/packages/${name}/changelog`,
    ...rest
  } = overrides;

  return {
    directoryPath,
    manifest: buildMockManifest({
      ...manifest,
      [packageUtils.ManifestFieldNames.Name]: name,
      [packageUtils.ManifestFieldNames.Version]: new SemVer(version),
    }),
    manifestPath,
    changelogPath,
    ...rest,
  };
}

/**
 * Builds a manifest object for use in tests, where `workspaces` and
 * `*Dependencies` fields do not have to be provided (they are filled in with
 * empty collections by default).
 *
 * @param overrides - The properties that will go into the object.
 * @returns The mock ValidatedManifest object.
 */
function buildMockManifest(
  overrides: Unrequire<
    ValidatedManifest,
    packageUtils.ManifestFieldNames.Workspaces | ManifestDependencyFieldNames
  >,
): ValidatedManifest {
  const {
    workspaces = [],
    dependencies = {},
    devDependencies = {},
    peerDependencies = {},
    bundledDependencies = {},
    optionalDependencies = {},
    ...rest
  } = overrides;

  return {
    workspaces,
    dependencies,
    devDependencies,
    peerDependencies,
    bundledDependencies,
    optionalDependencies,
    ...rest,
  };
}

/**
 * Mocks dependencies that `followMonorepoWorkflow` uses internally.
 *
 * @param args - The arguments to this function.
 * @param args.determineEditor - The return value for `determineEditor`.
 * @param args.getEnvironmentVariables - The return value for
 * `getEnvironmentVariables`.
 * @param args.generateReleaseSpecificationForMonorepo - The return value for
 * `generateReleaseSpecificationForMonorepo`.
 * @param args.waitForUserToEditReleaseSpecification - The return value for
 * `waitForUserToEditReleaseSpecification`.
 * @param args.validateReleaseSpecification - The return value for
 * `validateReleaseSpecification`.
 * @param args.updatePackage - The return value for `updatePackage`.
 * @param args.captureChangesInReleaseBranch - The return value for
 * `captureChangesInReleaseBranch`.
 * @returns Jest spy objects for the aforementioned dependencies.
 */
function mockDependencies({
  determineEditor: determineEditorValue = null,
  getEnvironmentVariables: getEnvironmentVariablesValue = {},
  generateReleaseSpecificationForMonorepo:
    generateReleaseSpecificationForMonorepoValue = undefined,
  waitForUserToEditReleaseSpecification:
    waitForUserToEditReleaseSpecificationValue = undefined,
  validateReleaseSpecification: validateReleaseSpecificationValue,
  updatePackage: updatePackageValue = undefined,
  captureChangesInReleaseBranch: captureChangesInReleaseBranchValue = undefined,
}: {
  determineEditor?: UnwrapPromise<
    ReturnType<typeof editorUtils.determineEditor>
  >;
  getEnvironmentVariables?: Partial<
    ReturnType<typeof envUtils.getEnvironmentVariables>
  >;
  generateReleaseSpecificationForMonorepo?: UnwrapPromise<
    ReturnType<
      typeof releaseSpecificationUtils.generateReleaseSpecificationForMonorepo
    >
  >;
  waitForUserToEditReleaseSpecification?: UnwrapPromise<
    ReturnType<
      typeof releaseSpecificationUtils.waitForUserToEditReleaseSpecification
    >
  >;
  validateReleaseSpecification: UnwrapPromise<
    ReturnType<typeof releaseSpecificationUtils.validateReleaseSpecification>
  >;
  updatePackage?: UnwrapPromise<ReturnType<typeof packageUtils.updatePackage>>;
  captureChangesInReleaseBranch?: UnwrapPromise<
    ReturnType<typeof workflowUtils.captureChangesInReleaseBranch>
  >;
}) {
  jest
    .spyOn(editorUtils, 'determineEditor')
    .mockResolvedValue(determineEditorValue);
  jest.spyOn(envUtils, 'getEnvironmentVariables').mockReturnValue({
    EDITOR: undefined,
    TODAY: undefined,
    ...getEnvironmentVariablesValue,
  });
  jest
    .spyOn(releaseSpecificationUtils, 'generateReleaseSpecificationForMonorepo')
    .mockResolvedValue(generateReleaseSpecificationForMonorepoValue);
  jest
    .spyOn(releaseSpecificationUtils, 'waitForUserToEditReleaseSpecification')
    .mockResolvedValue(waitForUserToEditReleaseSpecificationValue);
  jest
    .spyOn(releaseSpecificationUtils, 'validateReleaseSpecification')
    .mockResolvedValue(validateReleaseSpecificationValue);
  const updatePackageSpy = jest
    .spyOn(packageUtils, 'updatePackage')
    .mockResolvedValue(updatePackageValue);
  const captureChangesInReleaseBranchSpy = jest
    .spyOn(workflowUtils, 'captureChangesInReleaseBranch')
    .mockResolvedValue(captureChangesInReleaseBranchValue);

  return { updatePackageSpy, captureChangesInReleaseBranchSpy };
}
