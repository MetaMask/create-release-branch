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
    it('collects information about the repository URL, release version, and packages in the project', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const projectRepositoryUrl = 'https://github.com/some-org/some-repo';
        const rootPackage = buildMockPackage('root', '20220722.1234.0', {
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
          releaseInfo: {
            releaseDate: new Date(2022, 6, 22),
            releaseNumber: 1234,
          },
        });
      });
    });

    it('throws if the release date portion of the root version is not in "<yyymmdd>.<release-version>.0" format', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const rootPackage = buildMockPackage('root', '1.2.3');
        when(jest.spyOn(packageUtils, 'readPackage'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(rootPackage);

        await expect(readProject(projectDirectoryPath)).rejects.toThrow(
          /^Could not extract release date and\/or release version from package "root" version "1\.2\.3"/u,
        );
      });
    });

    it('throws if the release date portion of the root version is technically a valid date but is offset based on what was given', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        // This evaluates to 2021-11-30
        const rootPackage = buildMockPackage('root', '20220000.1.0');
        when(jest.spyOn(packageUtils, 'readPackage'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(rootPackage);

        await expect(readProject(projectDirectoryPath)).rejects.toThrow(
          /^Could not extract release date and\/or release version from package "root" version "20220000\.1\.0"/u,
        );
      });
    });

    it('throws if the release date portion of the root version is not a valid date whatsoever', async () => {
      await withSandbox(async (sandbox) => {
        const projectDirectoryPath = sandbox.directoryPath;
        const rootPackage = buildMockPackage('root', '99999999.1.0');
        when(jest.spyOn(packageUtils, 'readPackage'))
          .calledWith(projectDirectoryPath)
          .mockResolvedValue(rootPackage);

        await expect(readProject(projectDirectoryPath)).rejects.toThrow(
          /^Could not extract release date and\/or release version from package "root" version "99999999\.1\.0"/u,
        );
      });
    });
  });
});
