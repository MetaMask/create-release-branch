import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import {
  buildMockManifest,
  buildMockPackage,
  withSandbox,
} from '../tests/unit/helpers';
import { readProject } from './project';
import * as packageModule from './package';
import * as repoModule from './repo';

jest.mock('./package');
jest.mock('./repo');

describe('project', () => {
  describe('readProject', () => {
    it('collects information about a monorepo project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackage = buildMockPackage('root', {
          directoryPath: projectDirectoryPath,
          manifest: buildMockManifest({
            workspaces: ['packages/a', 'packages/subpackages/*'],
          }),
        });
        const workspacePackages = {
          a: buildMockPackage('a', {
            directoryPath: path.join(projectDirectoryPath, 'packages', 'a'),
            manifest: buildMockManifest(),
          }),
          b: buildMockPackage('b', {
            directoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'subpackages',
              'b',
            ),
            manifest: buildMockManifest(),
          }),
        };
        when(jest.spyOn(repoModule, 'getRepositoryHttpsUrl'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(projectRepositoryUrl);
        when(jest.spyOn(packageModule, 'readPackage'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(rootPackage)
          .calledWith(path.join(projectDirectoryPath, 'packages', 'a'))
          .mockResolvedValue(workspacePackages.a)
          .calledWith(
            path.join(projectDirectoryPath, 'packages', 'subpackages', 'b'),
          )
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

        expect(await readProject(projectDirectoryPath)).toStrictEqual({
          directoryPath: projectDirectoryPath,
          repositoryUrl: projectRepositoryUrl,
          rootPackage,
          workspacePackages,
          isMonorepo: true,
        });
      });
    });

    it('collects information about a polyrepo project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackage = buildMockPackage('root', {
          directoryPath: projectDirectoryPath,
        });
        when(jest.spyOn(repoModule, 'getRepositoryHttpsUrl'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(projectRepositoryUrl);
        when(jest.spyOn(packageModule, 'readPackage'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(rootPackage);

        expect(await readProject(projectDirectoryPath)).toStrictEqual({
          directoryPath: projectDirectoryPath,
          repositoryUrl: projectRepositoryUrl,
          rootPackage,
          workspacePackages: {},
          isMonorepo: false,
        });
      });
    });
  });
});
