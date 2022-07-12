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
  ManifestFieldNames,
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

const TEMP_DIRECTORY = path.join(os.tmpdir(), 'create-release-branch-tests');

/**
 * @param overrides
 */
function buildMockManifest(
  overrides: Unrequire<
    ValidatedManifest,
    ManifestFieldNames.Workspaces | ManifestDependencyFieldNames
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

describe('monorepo-workflow-utils', () => {
  describe('followMonorepoWorkflow', () => {
    beforeEach(async () => {
      await new Promise((resolve) => rimraf(TEMP_DIRECTORY, resolve));
      await fs.promises.mkdir(TEMP_DIRECTORY);
    });

    describe("if no release spec has been created and an editor exists on the user's computer", () => {
      it('generates a release spec, waits for the user to edit it, then applies it to the monorepo', async () => {
        const project: Project = {
          directoryPath: '/path/to/project',
          repositoryUrl: 'https://repo.url',
          rootPackage: {
            directoryPath: '/path/to/packages/root',
            manifest: buildMockManifest({
              name: 'root',
              version: new SemVer('2022.1.1'),
              private: true,
              workspaces: ['packages/*'],
            }),
            manifestPath: '/path/to/packages/root/manifest',
            changelogPath: '/path/to/packages/root/changelog',
          },
          workspacePackages: {
            a: {
              directoryPath: '/path/to/packages/a',
              manifest: buildMockManifest({
                name: 'a',
                version: new SemVer('1.0.0'),
                private: false,
              }),
              manifestPath: '/path/to/packages/a/manifest',
              changelogPath: '/path/to/packages/a/changelog',
            },
          },
        };
        jest.spyOn(editorUtils, 'determineEditor').mockResolvedValue({
          path: '/some/editor',
          args: [],
        });
        jest.spyOn(envUtils, 'getEnvironmentVariables').mockReturnValue({
          EDITOR: undefined,
          TODAY: '2022-06-12',
        });
        jest
          .spyOn(
            releaseSpecificationUtils,
            'generateReleaseSpecificationForMonorepo',
          )
          .mockResolvedValue();
        jest
          .spyOn(
            releaseSpecificationUtils,
            'waitForUserToEditReleaseSpecification',
          )
          .mockResolvedValue();
        jest
          .spyOn(releaseSpecificationUtils, 'validateReleaseSpecification')
          .mockResolvedValue({
            packages: {
              a: releaseSpecificationUtils.IncrementableVersionParts.major,
            },
          });
        const updatePackageSpy = jest
          .spyOn(packageUtils, 'updatePackage')
          .mockResolvedValue();
        jest
          .spyOn(workflowUtils, 'captureChangesInReleaseBranch')
          .mockResolvedValue();

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
        const project: Project = {
          directoryPath: '/path/to/project',
          repositoryUrl: 'https://repo.url',
          rootPackage: {
            directoryPath: '/path/to/packages/root',
            manifest: buildMockManifest({
              name: 'root',
              version: new SemVer('2022.1.1'),
              private: true,
              workspaces: ['packages/*'],
            }),
            manifestPath: '/path/to/packages/root/manifest',
            changelogPath: '/path/to/packages/root/changelog',
          },
          workspacePackages: {
            a: {
              directoryPath: '/path/to/packages/a',
              manifest: buildMockManifest({
                name: 'a',
                version: new SemVer('1.0.0'),
                private: false,
              }),
              manifestPath: '/path/to/packages/a/manifest',
              changelogPath: '/path/to/packages/a/changelog',
            },
          },
        };
        jest.spyOn(editorUtils, 'determineEditor').mockResolvedValue({
          path: '/some/editor',
          args: [],
        });
        jest.spyOn(envUtils, 'getEnvironmentVariables').mockReturnValue({
          EDITOR: undefined,
          TODAY: '2022-06-12',
        });
        jest
          .spyOn(
            releaseSpecificationUtils,
            'generateReleaseSpecificationForMonorepo',
          )
          .mockResolvedValue();
        jest
          .spyOn(
            releaseSpecificationUtils,
            'waitForUserToEditReleaseSpecification',
          )
          .mockResolvedValue();
        jest
          .spyOn(releaseSpecificationUtils, 'validateReleaseSpecification')
          .mockResolvedValue({
            packages: {
              a: releaseSpecificationUtils.IncrementableVersionParts.major,
            },
          });
        jest.spyOn(packageUtils, 'updatePackage').mockResolvedValue();
        const captureChangesInReleaseBranchSpy = jest
          .spyOn(workflowUtils, 'captureChangesInReleaseBranch')
          .mockResolvedValue();

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
