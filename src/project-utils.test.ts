import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { withSandbox } from '../tests/helpers';
import { buildMockManifest, buildMockPackage } from '../tests/unit/helpers';
import * as gitUtils from './git-utils';
import * as packageUtils from './package-utils';
import { readProject } from './project-utils';

jest.mock('./git-utils');
jest.mock('./package-utils');

describe('project-utils', () => {
  describe('readProject', () => {
    it('collects information about the repository URL as well as the root and workspace packages within the project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackage = buildMockPackage('root', {
          directoryPath: projectDirectoryPath,
          validatedManifest: buildMockManifest({
            workspaces: ['packages/a', 'packages/subpackages/*'],
          }),
        });
        const workspacePackages = {
          a: buildMockPackage('a', {
            directoryPath: path.join(projectDirectoryPath, 'packages', 'a'),
            validatedManifest: buildMockManifest(),
          }),
          b: buildMockPackage('b', {
            directoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'subpackages',
              'b',
            ),
            validatedManifest: buildMockManifest(),
          }),
        };
        when(jest.spyOn(gitUtils, 'getRepositoryHttpsUrl'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(projectRepositoryUrl);
        when(jest.spyOn(packageUtils, 'readPackage'))
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
  });
});
