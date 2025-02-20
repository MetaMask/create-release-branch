import { mkdir } from 'fs/promises';
import path from 'path';
import { when } from 'jest-when';
import { SemVer } from 'semver';
import * as actionUtils from '@metamask/action-utils';
import { withSandbox } from '../tests/helpers.js';
import {
  buildMockPackage,
  buildMockProject,
  createNoopWriteStream,
} from '../tests/unit/helpers.js';
import {
  readProject,
  restoreChangelogsForSkippedPackages,
  updateChangelogsForChangedPackages,
} from './project.js';
import * as packageModule from './package.js';
import * as repoModule from './repo.js';
import * as fs from './fs.js';
import { IncrementableVersionParts } from './release-specification.js';

jest.mock('./package');
jest.mock('./repo');
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
        await mkdir(path.join(projectDirectoryPath, 'packages'));
        await mkdir(path.join(projectDirectoryPath, 'packages', 'a'));
        await mkdir(path.join(projectDirectoryPath, 'packages', 'subpackages'));
        await mkdir(
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
  describe('restoreChangelogsForSkippedPackages', () => {
    it('should reset changelog for packages with changes not included in release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: true,
          }),
          c: buildMockPackage('c', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const restoreFilesSpy = jest.spyOn(repoModule, 'restoreFiles');

      when(jest.spyOn(fs, 'fileExists'))
        .calledWith(project.workspacePackages.b.changelogPath)
        .mockResolvedValue(true);

      when(jest.spyOn(fs, 'fileExists'))
        .calledWith(project.workspacePackages.c.changelogPath)
        .mockResolvedValue(true);

      await restoreChangelogsForSkippedPackages({
        project,
        defaultBranch: 'main',
        releaseSpecificationPackages: {
          a: IncrementableVersionParts.minor,
        },
      });

      expect(restoreFilesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'main',
        [
          '/path/to/packages/b/CHANGELOG.md',
          '/path/to/packages/c/CHANGELOG.md',
        ],
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
        },
      });

      const restoreFilesSpy = jest.spyOn(repoModule, 'restoreFiles');

      await restoreChangelogsForSkippedPackages({
        project,
        defaultBranch: 'main',
        releaseSpecificationPackages: {
          a: IncrementableVersionParts.minor,
        },
      });

      expect(restoreFilesSpy).not.toHaveBeenCalledWith(
        project.directoryPath,
        'main',
        ['/path/to/packages/b/CHANGELOG.md'],
      );
    });

    it('should not reset non-existent changelogs', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      when(jest.spyOn(fs, 'fileExists'))
        .calledWith(project.workspacePackages.a.changelogPath)
        .mockResolvedValue(false);

      const restoreFilesSpy = jest.spyOn(repoModule, 'restoreFiles');

      await restoreChangelogsForSkippedPackages({
        project,
        defaultBranch: 'main',
        releaseSpecificationPackages: {
          a: IncrementableVersionParts.minor,
        },
      });

      expect(restoreFilesSpy).not.toHaveBeenCalledWith(
        project.directoryPath,
        'main',
        [project.workspacePackages.b.changelogPath],
      );
    });
  });

  describe('updateChangelogsForChangedPackages', () => {
    it('should update changelog files of all the packages that has changes since latest release', async () => {
      const stderr = createNoopWriteStream();
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const updatePackageChangelogSpy = jest.spyOn(
        packageModule,
        'updatePackageChangelog',
      );

      await updateChangelogsForChangedPackages({
        project,
        stderr,
      });

      expect(updatePackageChangelogSpy).toHaveBeenCalledWith({
        project,
        package: project.workspacePackages.a,
        stderr,
      });

      expect(updatePackageChangelogSpy).toHaveBeenCalledWith({
        project,
        package: project.workspacePackages.b,
        stderr,
      });
    });

    it('should not update changelog files of all the packages that has not changed since latest release', async () => {
      const stderr = createNoopWriteStream();
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: false,
          }),
        },
      });

      const updatePackageChangelogSpy = jest.spyOn(
        packageModule,
        'updatePackageChangelog',
      );

      await updateChangelogsForChangedPackages({
        project,
        stderr,
      });

      expect(updatePackageChangelogSpy).not.toHaveBeenCalledWith({
        project,
        package: project.workspacePackages.a,
        stderr,
      });
    });
  });
});
