import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { SemVer } from 'semver';
import * as actionUtils from '@metamask/action-utils';
import { withSandbox } from '../tests/helpers';
import {
  buildMockPackage,
  buildMockProject,
  createNoopWriteStream,
} from '../tests/unit/helpers';
import { readProject, restoreUnreleasedPackagesChangelog } from './project';
import * as packageModule from './package';
import * as repoModule from './repo';
import { IncrementableVersionParts } from './release-specification';

jest.mock('./package');
jest.mock('./repo');
jest.mock('./misc-utils');
jest.mock('@metamask/action-utils', () => ({
  ...jest.requireActual('@metamask/action-utils'),
  getWorkspaceLocations: jest.fn(),
}));

describe('project', () => {
  describe('readProject', () => {
    it('collects information about the repository URL, release version, and packages in the project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackageName = 'root';
        const rootPackageVersion = new SemVer('4.38.0');
        const rootPackage = buildMockPackage(
          rootPackageName,
          rootPackageVersion,
          {
            directoryPath: projectDirectoryPath,
            validatedManifest: {
              workspaces: ['packages/a', 'packages/subpackages/*'],
            },
          },
        );
        const workspacePackages = {
          a: buildMockPackage('a', {
            directoryPath: path.join(projectDirectoryPath, 'packages', 'a'),
          }),
          b: buildMockPackage('b', {
            directoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'subpackages',
              'b',
            ),
          }),
        };
        const projectTagNames = ['tag1', 'tag2', 'tag3'];
        const stderr = createNoopWriteStream();
        when(jest.spyOn(repoModule, 'getRepositoryHttpsUrl'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(projectRepositoryUrl);
        when(jest.spyOn(repoModule, 'getTagNames'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(projectTagNames);
        when(jest.spyOn(packageModule, 'readMonorepoRootPackage'))
          .calledWith({
            packageDirectoryPath: projectDirectoryPath,
            projectDirectoryPath,
            projectTagNames,
          })
          .mockResolvedValue(rootPackage);
        when(
          jest.spyOn(actionUtils, 'getWorkspaceLocations'),
        ).mockResolvedValue(['packages/a', 'packages/subpackages/b']);
        when(jest.spyOn(packageModule, 'readMonorepoWorkspacePackage'))
          .calledWith({
            packageDirectoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'a',
            ),
            rootPackageName,
            rootPackageVersion,
            projectDirectoryPath,
            projectTagNames,
            stderr,
          })
          .mockResolvedValue(workspacePackages.a)
          .calledWith({
            packageDirectoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'subpackages',
              'b',
            ),
            rootPackageName,
            rootPackageVersion,
            projectDirectoryPath,
            projectTagNames,
            stderr,
          })
          .mockResolvedValue(workspacePackages.b);
        await fs.promises.mkdir(path.join(projectDirectoryPath, 'packages'));
        await fs.promises.mkdir(
          path.join(projectDirectoryPath, 'packages', 'a'),
        );
        await fs.promises.mkdir(
          path.join(projectDirectoryPath, 'packages', 'subpackages'),
        );
        await fs.promises.mkdir(
          path.join(projectDirectoryPath, 'packages', 'subpackages', 'b'),
        );

        expect(
          await readProject(projectDirectoryPath, { stderr }),
        ).toStrictEqual({
          directoryPath: projectDirectoryPath,
          repositoryUrl: projectRepositoryUrl,
          rootPackage,
          workspacePackages,
          isMonorepo: true,
          releaseVersion: {
            ordinaryNumber: 4,
            backportNumber: 38,
          },
        });
      });
    });
  });
  describe('resetUnreleasedPackagesChangelog', () => {
    it('should reset changelog for packages with changes not included in release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: false,
          }),
          c: buildMockPackage('c', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const restoreFilesSpy = jest.spyOn(repoModule, 'restoreFiles');

      await restoreUnreleasedPackagesChangelog({
        project,
        defaultBranch: 'main',
        releaseSpecification: {
          packages: {
            a: IncrementableVersionParts.minor,
          },
          path: '/path/to/release/specs',
        },
      });

      expect(restoreFilesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'main',
        ['/path/to/packages/c/CHANGELOG.md'],
      );
    });

    it('should not reset changelog for packages without changes since last release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: false,
          }),
          c: buildMockPackage('c', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const restoreFilesSpy = jest.spyOn(repoModule, 'restoreFiles');

      await restoreUnreleasedPackagesChangelog({
        project,
        defaultBranch: 'main',
        releaseSpecification: {
          packages: {
            a: IncrementableVersionParts.minor,
          },
          path: '/path/to/release/specs',
        },
      });

      expect(restoreFilesSpy).not.toHaveBeenCalledWith(
        '/path/to/packages/b',
        'checkout',
        ['--', 'CHANGELOG.md'],
      );
    });
  });
});
