import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import { SemVer } from 'semver';
import * as autoChangelog from '@metamask/auto-changelog';
import { readPackage, updatePackage } from './package-utils';
import * as packageManifestUtils from './package-manifest-utils';

jest.mock('@metamask/auto-changelog');
jest.mock('./package-manifest-utils');

const TEMP_DIRECTORY = path.join(os.tmpdir(), 'create-release-branch-tests');

/**
 * Builds a mock project for use in tests.
 *
 * @returns The mock Project.
 */
function buildMockProject() {
  return {
    directoryPath: '/path/to/project',
    repositoryUrl: 'https://repo.url',
  };
}

/**
 * Builds a manifest object for use in tests.
 *
 * @returns The mock ValidatedManifest.
 */
function buildMockManifest() {
  return {
    name: 'foo',
    version: new SemVer('1.2.3'),
    private: false,
    bundledDependencies: {},
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {},
    workspaces: [],
  };
}

describe('package-utils', () => {
  beforeEach(async () => {
    await ensureDirectoryCleared(TEMP_DIRECTORY);
  });

  describe('readPackage', () => {
    it('reads information about the package located at the given directory', async () => {
      const packageDirectoryPath = '/path/to/package';
      jest
        .spyOn(packageManifestUtils, 'readManifest')
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
      const project = {
        directoryPath: '/path/to/project',
        repositoryUrl: 'https://repo.url',
      };
      const manifestPath = path.join(TEMP_DIRECTORY, 'package.json');
      const packageReleasePlan = {
        package: {
          directoryPath: TEMP_DIRECTORY,
          manifestPath,
          manifest: buildMockManifest(),
          changelogPath: path.join(TEMP_DIRECTORY, 'CHANGELOG.md'),
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

    it('updates the changelog of the planned package if requested', async () => {
      const project = buildMockProject();
      const changelogPath = path.join(TEMP_DIRECTORY, 'CHANGELOG.md');
      const packageReleasePlan = {
        package: {
          directoryPath: TEMP_DIRECTORY,
          manifestPath: path.join(TEMP_DIRECTORY, 'package.json'),
          manifest: buildMockManifest(),
          changelogPath,
        },
        newVersion: '2.0.0',
        shouldUpdateChangelog: true,
      };
      jest
        .spyOn(autoChangelog, 'updateChangelog')
        .mockResolvedValue('new changelog');
      await fs.promises.writeFile(changelogPath, 'existing changelog');

      await updatePackage({ project, packageReleasePlan });

      const newChangelogContent = await fs.promises.readFile(
        changelogPath,
        'utf8',
      );
      expect(newChangelogContent).toStrictEqual('new changelog');
    });

    it('does not throw but merely prints a warning if no changelog exists', async () => {
      const project = buildMockProject();
      const changelogPath = path.join(TEMP_DIRECTORY, 'CHANGELOG.md');
      const packageReleasePlan = {
        package: {
          directoryPath: TEMP_DIRECTORY,
          manifestPath: path.join(TEMP_DIRECTORY, 'package.json'),
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
});

/**
 * Removes the given directory (if it exists) and then recreates it.
 *
 * @param directoryPath - The path to the directory.
 */
async function ensureDirectoryCleared(directoryPath: string) {
  await new Promise((resolve) => rimraf(directoryPath, resolve));
  await fs.promises.mkdir(directoryPath);
}
