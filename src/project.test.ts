import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/helpers';
import { buildMockPackage } from '../tests/unit/helpers';
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
        const rootPackageVersion = new SemVer('4.38.0');
        const rootPackage = buildMockPackage('root', rootPackageVersion, {
          directoryPath: projectDirectoryPath,
          validatedManifest: {
            workspaces: ['packages/a', 'packages/subpackages/*'],
          },
        });
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
        when(jest.spyOn(packageModule, 'readMonorepoWorkspacePackage'))
          .calledWith({
            packageDirectoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'a',
            ),
            rootPackageVersion,
            projectDirectoryPath,
            projectTagNames,
          })
          .mockResolvedValue(workspacePackages.a)
          .calledWith({
            packageDirectoryPath: path.join(
              projectDirectoryPath,
              'packages',
              'subpackages',
              'b',
            ),
            rootPackageVersion,
            projectDirectoryPath,
            projectTagNames,
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
