import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { withSandbox } from '../tests/helpers';
import { buildMockManifest, buildMockPackage } from '../tests/unit/helpers';
import { readProject } from './project';
import * as packageModule from './package';
import * as repoModule from './repo';

jest.mock('./package');
jest.mock('./repo');

describe('project', () => {
  describe('readProject', () => {
    it('collects information about the repository URL, release version, and packages in the project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackage = buildMockPackage('root', '4.38.0', {
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
          releaseVersion: {
            ordinaryNumber: 4,
            backportNumber: 38,
          },
        });
      });
    });
  });
});
