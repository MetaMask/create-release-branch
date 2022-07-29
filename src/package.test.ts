import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import * as autoChangelog from '@metamask/auto-changelog';
import { withSandbox } from '../tests/helpers';
import { buildMockProject, buildMockManifest } from '../tests/unit/helpers';
import { readPackage, updatePackage } from './package';
import * as fsModule from './fs';
import * as packageManifestModule from './package-manifest';

jest.mock('@metamask/auto-changelog');
jest.mock('./package-manifest');

describe('package', () => {
  describe('readPackage', () => {
    it('reads information about the package located at the given directory', async () => {
      const packageDirectoryPath = '/path/to/package';
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue(buildMockManifest());

      const pkg = await readPackage(packageDirectoryPath);

      expect(pkg).toStrictEqual({
        directoryPath: packageDirectoryPath,
        manifestPath: path.join(packageDirectoryPath, 'package.json'),
        manifest: buildMockManifest(),
        changelogPath: path.join(packageDirectoryPath, 'CHANGELOG.md'),
      });
    });
  });

  describe('updatePackage', () => {
    it('writes the planned version to the planned package', async () => {
      await withSandbox(async (sandbox) => {
        const project = {
          directoryPath: '/path/to/project',
          repositoryUrl: 'https://repo.url',
        };
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath,
            manifest: buildMockManifest(),
            changelogPath: path.join(sandbox.directoryPath, 'CHANGELOG.md'),
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: false,
        };

        await updatePackage({ project, packageReleasePlan });

        const newManifest = JSON.parse(
          await fs.promises.readFile(manifestPath, 'utf8'),
        );
        expect(newManifest).toMatchObject({
          version: '2.0.0',
        });
      });
    });

    it('updates the changelog of the package if requested to do so and if the package has one', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          repositoryUrl: 'https://repo.url',
        });
        const changelogPath = path.join(sandbox.directoryPath, 'CHANGELOG.md');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            manifest: buildMockManifest(),
            changelogPath,
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: true,
        };
        when(jest.spyOn(autoChangelog, 'updateChangelog'))
          .calledWith({
            changelogContent: 'existing changelog',
            currentVersion: '2.0.0',
            isReleaseCandidate: true,
            projectRootDirectory: sandbox.directoryPath,
            repoUrl: 'https://repo.url',
          })
          .mockResolvedValue('new changelog');
        await fs.promises.writeFile(changelogPath, 'existing changelog');

        await updatePackage({ project, packageReleasePlan });

        const newChangelogContent = await fs.promises.readFile(
          changelogPath,
          'utf8',
        );
        expect(newChangelogContent).toStrictEqual('new changelog');
      });
    });

    it("throws if reading the package's changelog fails in an unexpected way", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject();
        const changelogPath = path.join(sandbox.directoryPath, 'CHANGELOG.md');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            manifest: buildMockManifest(),
            changelogPath,
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: true,
        };
        jest.spyOn(fsModule, 'readFile').mockRejectedValue(new Error('oops'));

        await expect(
          updatePackage({ project, packageReleasePlan }),
        ).rejects.toThrow('oops');
      });
    });

    it('does not throw but merely prints a warning if the package does not have a changelog', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject();
        const changelogPath = path.join(sandbox.directoryPath, 'CHANGELOG.md');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            manifest: buildMockManifest(),
            changelogPath,
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: true,
        };
        jest
          .spyOn(autoChangelog, 'updateChangelog')
          .mockResolvedValue('new changelog');

        const result = await updatePackage({ project, packageReleasePlan });

        expect(result).toBeUndefined();
      });
    });

    it('does not update the changelog if updateChangelog returns nothing', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          repositoryUrl: 'https://repo.url',
        });
        const changelogPath = path.join(sandbox.directoryPath, 'CHANGELOG.md');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            manifest: buildMockManifest(),
            changelogPath,
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: true,
        };
        when(jest.spyOn(autoChangelog, 'updateChangelog'))
          .calledWith({
            changelogContent: 'existing changelog',
            currentVersion: '2.0.0',
            isReleaseCandidate: true,
            projectRootDirectory: sandbox.directoryPath,
            repoUrl: 'https://repo.url',
          })
          .mockResolvedValue(undefined);
        await fs.promises.writeFile(changelogPath, 'existing changelog');

        await updatePackage({ project, packageReleasePlan });

        const newChangelogContent = await fs.promises.readFile(
          changelogPath,
          'utf8',
        );
        expect(newChangelogContent).toStrictEqual('existing changelog');
      });
    });

    it('does not update the changelog if not requested to do so', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          repositoryUrl: 'https://repo.url',
        });
        const changelogPath = path.join(sandbox.directoryPath, 'CHANGELOG.md');
        const packageReleasePlan = {
          package: {
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            manifest: buildMockManifest(),
            changelogPath,
          },
          newVersion: '2.0.0',
          shouldUpdateChangelog: false,
        };
        when(jest.spyOn(autoChangelog, 'updateChangelog'))
          .calledWith({
            changelogContent: 'existing changelog',
            currentVersion: '2.0.0',
            isReleaseCandidate: true,
            projectRootDirectory: sandbox.directoryPath,
            repoUrl: 'https://repo.url',
          })
          .mockResolvedValue('new changelog');
        await fs.promises.writeFile(changelogPath, 'existing changelog');

        await updatePackage({ project, packageReleasePlan });

        const newChangelogContent = await fs.promises.readFile(
          changelogPath,
          'utf8',
        );
        expect(newChangelogContent).toStrictEqual('existing changelog');
      });
    });
  });
});
