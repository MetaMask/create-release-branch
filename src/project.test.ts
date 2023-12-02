import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { SemVer } from 'semver';
import * as actionUtils from '@metamask/action-utils';
import { withSandbox } from '../tests/helpers.js';
import {
  buildMockPackage,
  createNoopWriteStream,
} from '../tests/unit/helpers.js';
import { readProject } from './project.js';
import * as packageModule from './package.js';
import * as repoModule from './repo.js';

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
});
