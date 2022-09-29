import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import * as autoChangelog from '@metamask/auto-changelog';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/helpers';
import {
  buildMockPackage,
  buildMockProject,
  buildMockManifest,
} from '../tests/unit/helpers';
import {
  readMonorepoRootPackage,
  readMonorepoWorkspacePackage,
  updatePackage,
} from './package';
import * as fsModule from './fs';
import * as packageManifestModule from './package-manifest';
import * as repoModule from './repo';

jest.mock('@metamask/auto-changelog');
jest.mock('./package-manifest');
jest.mock('./repo');

describe('package', () => {
  describe('readMonorepoRootPackage', () => {
    it('returns information about the file structure of the package located at the given directory', async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      const pkg = await readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
      });

      expect(pkg).toMatchObject({
        directoryPath: '/path/to/package',
        manifestPath: '/path/to/package/package.json',
        changelogPath: '/path/to/package/CHANGELOG.md',
      });
    });

    it('returns information about the manifest (in both unvalidated and validated forms)', async () => {
      const unvalidatedManifest = {};
      const validatedManifest = buildMockManifest();
      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/package/package.json')
        .mockResolvedValue({
          unvalidated: unvalidatedManifest,
          validated: validatedManifest,
        });

      const pkg = await readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
      });

      expect(pkg).toMatchObject({
        unvalidatedManifest,
        validatedManifest,
      });
    });

    it('throws if a tag matching the current version does not exist', async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: 'some-package',
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v1.0.0')
        .mockResolvedValue(true);

      const promiseForPkg = readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['some-tag'],
      });

      await expect(promiseForPkg).rejects.toThrow(
        new Error(
          'The package some-package has no Git tag for its current version 1.0.0 (expected "v1.0.0"), so this tool is unable to determine whether it should be included in this release. You will need to create a tag for this package in order to proceed.',
        ),
      );
    });

    it("flags the package as having been changed since its latest release if a tag matching the current version exists and changes have been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v1.0.0')
        .mockResolvedValue(true);

      const pkg = await readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['v1.0.0'],
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: true,
      });
    });

    it("does not flag the package as having been changed since its latest release if a tag matching the current version exists, but changes have not been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v1.0.0')
        .mockResolvedValue(false);

      const pkg = await readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['v1.0.0'],
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: false,
      });
    });

    it('flags the package as having been changed since its latest release if a tag matching the current version does not exist', async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });

      const pkg = await readMonorepoRootPackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: true,
      });
    });
  });

  describe('readMonorepoWorkspacePackage', () => {
    it('returns information about the file structure of the package located at the given directory', async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        directoryPath: '/path/to/package',
        manifestPath: '/path/to/package/package.json',
        changelogPath: '/path/to/package/CHANGELOG.md',
      });
    });

    it('returns information about the manifest (in both unvalidated and validated forms)', async () => {
      const unvalidatedManifest = {};
      const validatedManifest = buildMockManifest();
      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/package/package.json')
        .mockResolvedValue({
          unvalidated: unvalidatedManifest,
          validated: validatedManifest,
        });

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        unvalidatedManifest,
        validatedManifest,
      });
    });

    it('throws if a tag matching the current version does not exist', async () => {
      const unvalidatedManifest = {};
      const validatedManifest = buildMockManifest({
        name: 'workspace-package',
        version: new SemVer('1.0.0'),
      });
      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/package/package.json')
        .mockResolvedValue({
          unvalidated: unvalidatedManifest,
          validated: validatedManifest,
        });

      const promiseForPkg = readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['some-tag'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      await expect(promiseForPkg).rejects.toThrow(
        new Error(
          'The workspace package workspace-package has no Git tag for its current version 1.0.0 (expected "workspace-package@1.0.0"), and the root package root-package has no Git tag for its current version 5.0.0 (expected "v5.0.0"), so this tool is unable to determine whether the workspace package should be included in this release. You will need to create tags for both of these packages in order to proceed.',
        ),
      );
    });

    it("flags the package as having been changed since its latest release if a tag matching the package name + version exists and changes have been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@scope/some-package',
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith(
          '/path/to/project',
          '/path/to/package',
          '@scope/some-package@1.0.0',
        )
        .mockResolvedValue(true);

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['@scope/some-package@1.0.0'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: true,
      });
    });

    it("does not flag the package as having been changed since its latest release if a tag matching the package name + version exists, but changes have not been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@scope/some-package',
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith(
          '/path/to/project',
          '/path/to/package',
          '@scope/some-package@1.0.0',
        )
        .mockResolvedValue(false);

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['@scope/some-package@1.0.0'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: false,
      });
    });

    it("flags the package as having been changed since its latest release if a tag matching 'v' + the root package version exists instead of the package name + version, and changes have been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v5.0.0')
        .mockResolvedValue(true);

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['v5.0.0'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: true,
      });
    });

    it("does not flag the package as having been changed since its latest release if a tag matching 'v' + the root package version exists instead of the package name + version, but changes have not been made to the package's directory since the tag", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v5.0.0')
        .mockResolvedValue(false);

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['v5.0.0'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: false,
      });
    });

    it("prints a warning if a tag matching 'v' + the root package version exists instead of the package name + version", async () => {
      const stderr = new MockWritable();
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: 'workspace-package',
            version: new SemVer('1.0.0'),
          }),
        });
      when(jest.spyOn(repoModule, 'hasChangesInDirectorySinceGitTag'))
        .calledWith('/path/to/project', '/path/to/package', 'v5.0.0')
        .mockResolvedValue(false);

      await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: ['v5.0.0'],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
        stderr,
      });

      expect(stderr.data()).toStrictEqual(
        'WARNING: It appears that the package workspace-package is missing a Git tag for its current release 1.0.0 (expected: "1.0.0"). This tool can make do with the tag that exists for root package ("v5.0.0"), but you should create this tag as soon as possible.',
      );
    });

    it("flags the package as having been changed since its latest release if a tag matching neither the package name + version nor 'v' + the root package version exists", async () => {
      jest
        .spyOn(packageManifestModule, 'readPackageManifest')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            version: new SemVer('1.0.0'),
          }),
        });

      const pkg = await readMonorepoWorkspacePackage({
        packageDirectoryPath: '/path/to/package',
        projectDirectoryPath: '/path/to/project',
        projectTagNames: [],
        rootPackageName: 'root-package',
        rootPackageVersion: new SemVer('5.0.0'),
      });

      expect(pkg).toMatchObject({
        hasChangesSinceLatestRelease: true,
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath,
            validatedManifest: buildMockManifest(),
            changelogPath: path.join(sandbox.directoryPath, 'CHANGELOG.md'),
          }),
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            validatedManifest: buildMockManifest(),
            changelogPath,
          }),
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            validatedManifest: buildMockManifest(),
            changelogPath,
          }),
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            validatedManifest: buildMockManifest(),
            changelogPath,
          }),
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            validatedManifest: buildMockManifest(),
            changelogPath,
          }),
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
          package: buildMockPackage({
            directoryPath: sandbox.directoryPath,
            manifestPath: path.join(sandbox.directoryPath, 'package.json'),
            validatedManifest: buildMockManifest(),
            changelogPath,
          }),
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
