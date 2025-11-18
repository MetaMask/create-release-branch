import fs from 'fs';
import { when } from 'jest-when';
import { buildMockManifest } from '../tests/unit/helpers.js';
import { checkDependencyBumps } from './check-dependency-bumps.js';
import * as repoModule from './repo.js';
import * as miscUtilsModule from './misc-utils.js';
import * as projectModule from './project.js';
import * as packageManifestModule from './package-manifest.js';
import * as changelogValidatorModule from './changelog-validator.js';

jest.mock('./repo');
jest.mock('./misc-utils');
jest.mock('./project');
jest.mock('./package-manifest');
jest.mock('./changelog-validator');

describe('check-dependency-bumps', () => {
  const stdout = fs.createWriteStream('/dev/null');
  const stderr = fs.createWriteStream('/dev/null');

  describe('checkDependencyBumps', () => {
    it('returns empty object when on main branch without fromRef', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      jest.spyOn(repoModule, 'getCurrentBranchName').mockResolvedValue('main');

      const result = await checkDependencyBumps({
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('📌 Current branch: main'),
      );
    });

    it('returns empty object when on master branch without fromRef', async () => {
      jest
        .spyOn(repoModule, 'getCurrentBranchName')
        .mockResolvedValue('master');

      const result = await checkDependencyBumps({
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
    });

    it('auto-detects merge base when fromRef is not provided', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      jest
        .spyOn(repoModule, 'getCurrentBranchName')
        .mockResolvedValue('feature-branch');

      // Mock merge base command
      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'main'], {
          cwd: '/path/to/project',
        })
        .mockResolvedValue('abc123def456');

      // Mock git diff command
      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123def456', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue('');

      await checkDependencyBumps({
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('merge base'),
      );
    });

    it('returns empty object when merge base cannot be found', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      jest
        .spyOn(repoModule, 'getCurrentBranchName')
        .mockResolvedValue('feature-branch');

      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'main'], {
          cwd: '/path/to/project',
        })
        .mockRejectedValue(new Error('Not found'));

      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'origin/main'], {
          cwd: '/path/to/project',
        })
        .mockRejectedValue(new Error('Not found'));

      const result = await checkDependencyBumps({
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not find merge base'),
      );
    });

    it('returns empty object when no package.json changes found', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue('');

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('No package.json changes found'),
      );
    });

    it('returns empty object when no dependency bumps found in diff', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithoutDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
index 1234567..890abcd 100644
--- a/packages/controller-utils/package.json
+++ b/packages/controller-utils/package.json
@@ -1,6 +1,6 @@
 {
-  "version": "1.0.0"
+  "version": "1.0.1"
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithoutDeps);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('No dependency version bumps found'),
      );
    });

    it('detects dependency version changes and validates changelogs', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
index 1234567..890abcd 100644
--- a/packages/controller-utils/package.json
+++ b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   },
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {
            repository: 'https://github.com/example-org/example-repo',
          },
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: true,
            hasUnreleasedSection: true,
            missingEntries: [],
            existingEntries: ['@metamask/transaction-controller'],
          },
        ]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies',
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 JSON Output'),
      );
      expect(changelogValidatorModule.validateChangelogs).toHaveBeenCalledWith(
        expect.any(Object),
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );
    });

    it('calls updateChangelogs when fix flag is set', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {
            repository: 'https://github.com/example-org/example-repo',
          },
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const updateChangelogsSpy = jest
        .spyOn(changelogValidatorModule, 'updateChangelogs')
        .mockResolvedValue(1);

      await checkDependencyBumps({
        fromRef: 'abc123',
        fix: true,
        prNumber: '1234',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(updateChangelogsSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          projectRoot: '/path/to/project',
          prNumber: '1234',
          repoUrl: 'https://github.com/example-org/example-repo',
          stdout,
          stderr,
        }),
      );
    });

    it('detects peerDependencies changes', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithPeerDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "peerDependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithPeerDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies',
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      });
    });

    it('handles git diff exit code 1 as no changes', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockRejectedValue({ exitCode: 1, stdout: '' });

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
    });

    it('rethrows git diff errors other than exit code 1', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockRejectedValue({ exitCode: 2, message: 'Git error' });

      await expect(
        checkDependencyBumps({
          fromRef: 'abc123',
          projectRoot: '/path/to/project',
          stdout,
          stderr,
        }),
      ).rejects.toMatchObject({ exitCode: 2 });
    });

    it('uses custom toRef when provided', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      when(getStdoutSpy)
        .calledWith(
          'git',
          [
            'diff',
            '-U9999',
            'abc123',
            'feature-branch',
            '--',
            '**/package.json',
          ],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue('');

      await checkDependencyBumps({
        fromRef: 'abc123',
        toRef: 'feature-branch',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(getStdoutSpy).toHaveBeenCalledWith(
        'git',
        ['diff', '-U9999', 'abc123', 'feature-branch', '--', '**/package.json'],
        { cwd: '/path/to/project' },
      );
    });

    it('uses custom defaultBranch when auto-detecting merge base', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      jest
        .spyOn(repoModule, 'getCurrentBranchName')
        .mockResolvedValue('feature-branch');

      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'develop'], {
          cwd: '/path/to/project',
        })
        .mockResolvedValue('abc123def456');

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123def456', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue('');

      await checkDependencyBumps({
        defaultBranch: 'develop',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(getStdoutSpy).toHaveBeenCalledWith(
        'git',
        ['merge-base', 'HEAD', 'develop'],
        { cwd: '/path/to/project' },
      );
    });

    it('tries origin/branch when local branch merge-base fails', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      jest
        .spyOn(repoModule, 'getCurrentBranchName')
        .mockResolvedValue('feature-branch');

      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'main'], {
          cwd: '/path/to/project',
        })
        .mockRejectedValue(new Error('Not found'));

      when(getStdoutSpy)
        .calledWith('git', ['merge-base', 'HEAD', 'origin/main'], {
          cwd: '/path/to/project',
        })
        .mockResolvedValue('abc123def456');

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123def456', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue('');

      await checkDependencyBumps({
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(getStdoutSpy).toHaveBeenCalledWith(
        'git',
        ['merge-base', 'HEAD', 'origin/main'],
        { cwd: '/path/to/project' },
      );
    });

    it('reports validation errors for missing changelogs', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: false,
            hasUnreleasedSection: false,
            missingEntries: [
              {
                package: 'controller-utils',
                dependency: '@metamask/transaction-controller',
                type: 'dependencies',
                oldVersion: '^61.0.0',
                newVersion: '^62.0.0',
              },
            ],
            existingEntries: [],
          },
        ]);

      await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ controller-utils: CHANGELOG.md not found'),
      );
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('💡 Run with --fix'),
      );
    });

    it('reports validation errors for missing unreleased section', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: true,
            hasUnreleasedSection: false,
            missingEntries: [],
            existingEntries: [],
          },
        ]);

      await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ controller-utils: No [Unreleased] section found',
        ),
      );
    });

    it('reports validation errors for missing changelog entries', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: true,
            hasUnreleasedSection: true,
            missingEntries: [
              {
                package: 'controller-utils',
                dependency: '@metamask/transaction-controller',
                type: 'dependencies',
                oldVersion: '^61.0.0',
                newVersion: '^62.0.0',
              },
            ],
            existingEntries: [],
          },
        ]);

      await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ controller-utils: Missing 1 changelog entry:',
        ),
      );
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('- @metamask/transaction-controller'),
      );
    });

    it('reports validation errors for multiple missing changelog entries (plural)', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithMultipleDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,8 +10,8 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0",
-    "@metamask/network-controller": "^5.0.0"
+    "@metamask/transaction-controller": "^62.0.0",
+    "@metamask/network-controller": "^6.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithMultipleDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: true,
            hasUnreleasedSection: true,
            missingEntries: [
              {
                package: 'controller-utils',
                dependency: '@metamask/transaction-controller',
                type: 'dependencies',
                oldVersion: '^61.0.0',
                newVersion: '^62.0.0',
              },
              {
                package: 'controller-utils',
                dependency: '@metamask/network-controller',
                type: 'dependencies',
                oldVersion: '^5.0.0',
                newVersion: '^6.0.0',
              },
            ],
            existingEntries: [],
          },
        ]);

      await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '❌ controller-utils: Missing 2 changelog entries:',
        ),
      );
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('- @metamask/transaction-controller'),
      );
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('- @metamask/network-controller'),
      );
    });

    it('reports validation success when all entries are present', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: true,
            hasUnreleasedSection: true,
            missingEntries: [],
            existingEntries: ['@metamask/transaction-controller'],
          },
        ]);

      await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ controller-utils: All entries present'),
      );
    });

    it('does not show fix hint when fix flag is set', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([
          {
            package: 'controller-utils',
            hasChangelog: false,
            hasUnreleasedSection: false,
            missingEntries: [
              {
                package: 'controller-utils',
                dependency: '@metamask/transaction-controller',
                type: 'dependencies',
                oldVersion: '^61.0.0',
                newVersion: '^62.0.0',
              },
            ],
            existingEntries: [],
          },
        ]);

      jest
        .spyOn(changelogValidatorModule, 'updateChangelogs')
        .mockResolvedValue(1);

      await checkDependencyBumps({
        fromRef: 'abc123',
        fix: true,
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not show the fix hint when fix is enabled
      expect(stderrWriteSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('💡 Run with --fix'),
      );
    });

    it('reports successful updates when fix updates changelogs', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      jest
        .spyOn(changelogValidatorModule, 'updateChangelogs')
        .mockResolvedValue(2);

      await checkDependencyBumps({
        fromRef: 'abc123',
        fix: true,
        prNumber: '1234',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Updated 2 changelogs'),
      );
    });

    it('reports when changelogs are already up to date', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      jest
        .spyOn(changelogValidatorModule, 'updateChangelogs')
        .mockResolvedValue(0);

      await checkDependencyBumps({
        fromRef: 'abc123',
        fix: true,
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ All changelogs are up to date'),
      );
    });

    it('shows placeholder note when no PR number provided with fix', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      jest
        .spyOn(changelogValidatorModule, 'updateChangelogs')
        .mockResolvedValue(1);

      await checkDependencyBumps({
        fromRef: 'abc123',
        fix: true,
        // No prNumber provided
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Placeholder PR numbers (XXXXX) were used'),
      );
    });

    it('skips devDependencies changes', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithDevDeps = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "devDependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDevDeps);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not detect devDependencies changes
      expect(result).toStrictEqual({});
    });

    it('deduplicates same dependency in different sections', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff showing same dependency changed in both dependencies and peerDependencies
      const diffWithDuplicates = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
index 1234567..890abcd 100644
--- a/packages/controller-utils/package.json
+++ b/packages/controller-utils/package.json
@@ -10,10 +10,10 @@
   },
   "dependencies": {
     "@metamask/network-controller": "^5.0.0",
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   },
   "peerDependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithDuplicates);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should have two entries: one for dependencies, one for peerDependencies
      expect(result['controller-utils'].dependencyChanges).toHaveLength(2);
      expect(result['controller-utils'].dependencyChanges[0].type).toBe(
        'dependencies',
      );
      expect(result['controller-utils'].dependencyChanges[1].type).toBe(
        'peerDependencies',
      );
    });

    it('handles diff without proper file path', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff without b/ prefix (malformed)
      const diffMalformed = `
diff --git a/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffMalformed);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should handle gracefully
      expect(result).toStrictEqual({});
    });

    it('detects peerDependencies without encountering dependencies keyword', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff where peerDependencies appears but "dependencies" string never appears
      const diffOnlyPeerDeps = `diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
index abc123..def456 100644
--- a/packages/controller-utils/package.json
+++ b/packages/controller-utils/package.json
@@ -1,8 +1,8 @@
 {
   "name": "@metamask/controller-utils",
   "version": "1.0.0",
   "peerDependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
 }`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffOnlyPeerDeps);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result['controller-utils'].dependencyChanges[0].type).toBe(
        'peerDependencies',
      );
    });

    it('ignores dependency changes not in packages directory', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff in root package.json (not in packages/)
      const diffInRoot = `
diff --git a/package.json b/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffInRoot);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not detect changes outside packages/ directory
      expect(result).toStrictEqual({});
    });

    it('ignores malformed dependency lines in diff', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff with malformed dependency lines
      const diffMalformed = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffMalformed);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not detect malformed lines
      expect(result).toStrictEqual({});
    });

    it('ignores changes where versions are identical', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff where removed and added versions are the same (formatting change)
      const diffSameVersion = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller":  "^61.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffSameVersion);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not detect when versions are the same
      expect(result).toStrictEqual({});
    });

    it('ignores added dependencies without corresponding removal', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff with only added dependency (new dependency, not a bump)
      const diffOnlyAdd = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,6 +10,7 @@
   "dependencies": {
     "@metamask/network-controller": "^5.0.0",
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffOnlyAdd);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should not detect new additions (only bumps)
      expect(result).toStrictEqual({});
    });

    it('handles section end detection with closing braces', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff with section ending detection
      const diffWithSectionEnd = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -5,12 +5,12 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   },
   "scripts": {
     "test": "jest"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithSectionEnd);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result['controller-utils'].dependencyChanges).toHaveLength(1);
    });

    it('handles transition between different dependency sections', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff transitioning from dependencies to peerDependencies
      const diffWithTransition = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -5,11 +5,11 @@
   "dependencies": {
-    "@metamask/network-controller": "^5.0.0"
+    "@metamask/network-controller": "^6.0.0"
   },
   "peerDependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithTransition);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result['controller-utils'].dependencyChanges).toHaveLength(2);
      expect(
        result['controller-utils'].dependencyChanges.find(
          (c) => c.type === 'dependencies',
        ),
      ).toBeDefined();
      expect(
        result['controller-utils'].dependencyChanges.find(
          (c) => c.type === 'peerDependencies',
        ),
      ).toBeDefined();
    });

    it('ignores lines without package name match in removed dependencies', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff with malformed removed line (no proper JSON format)
      const diffMalformed = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    bad line without proper format
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffMalformed);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
    });

    it('ignores added lines that start with + and have @ but do not match dependency format', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Diff with line that starts with + and has @, but doesn't match the regex
      const diffMalformed = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -10,7 +10,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/something: malformed without closing quote
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffMalformed);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      expect(result).toStrictEqual({});
    });

    it('deduplicates same dependency bumped multiple times in same section', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Multiple diff chunks with same dependency change (simulates complex merge)
      const diffWithRealDuplicates = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -5,7 +5,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0",
+    "@metamask/transaction-controller": "^62.0.0",
     "@metamask/network-controller": "^5.0.0"
@@ -15,7 +15,7 @@
   "dependencies": {
     "@metamask/network-controller": "^5.0.0",
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithRealDuplicates);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should only have one entry in dependencies section despite appearing twice
      expect(result['controller-utils'].dependencyChanges).toHaveLength(1);
      expect(result['controller-utils'].dependencyChanges[0]).toStrictEqual({
        package: 'controller-utils',
        dependency: '@metamask/transaction-controller',
        type: 'dependencies',
        oldVersion: '^61.0.0',
        newVersion: '^62.0.0',
      });
    });

    it('handles same dependency bumped to different versions by keeping first', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      // Same dependency bumped to different versions in same diff
      const diffDifferentVersions = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -5,7 +5,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
@@ -15,7 +15,7 @@
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^63.0.0"
   }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffDifferentVersions);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should only keep the first version (^62.0.0), not the second (^63.0.0)
      expect(result['controller-utils'].dependencyChanges).toHaveLength(1);
      expect(result['controller-utils'].dependencyChanges[0].newVersion).toBe(
        '^62.0.0',
      );
    });
    it('ignores version changes in root package.json', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffVersionInRoot = `
diff --git a/package.json b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "@metamask/core",
-  "version": "1.0.0",
+  "version": "1.1.0"
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffVersionInRoot);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // No dependency changes, so should be empty
      expect(result).toStrictEqual({});
    });

    it('ignores malformed version lines', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffMalformedVersion = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -1,6 +1,6 @@
 {
   "name": "@metamask/controller-utils",
+  "version": malformed without quotes
-  "version": "1.0.0"
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffMalformedVersion);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Should handle malformed version gracefully
      expect(result).toStrictEqual({});
    });

    it('detects package version changes for release detection', async () => {
      const getStdoutSpy = jest.spyOn(miscUtilsModule, 'getStdoutFromCommand');

      const diffWithVersionAndDep = `
diff --git a/packages/controller-utils/package.json b/packages/controller-utils/package.json
@@ -1,10 +1,10 @@
 {
   "name": "@metamask/controller-utils",
-  "version": "1.0.0",
+  "version": "1.1.0",
   "dependencies": {
-    "@metamask/transaction-controller": "^61.0.0"
+    "@metamask/transaction-controller": "^62.0.0"
   }
 }
`;

      when(getStdoutSpy)
        .calledWith(
          'git',
          ['diff', '-U9999', 'abc123', 'HEAD', '--', '**/package.json'],
          { cwd: '/path/to/project' },
        )
        .mockResolvedValue(diffWithVersionAndDep);

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest(),
        });

      when(jest.spyOn(packageManifestModule, 'readPackageManifest'))
        .calledWith('/path/to/project/packages/controller-utils/package.json')
        .mockResolvedValue({
          unvalidated: {},
          validated: buildMockManifest({
            name: '@metamask/controller-utils',
          }),
        });

      jest
        .spyOn(projectModule, 'getValidRepositoryUrl')
        .mockResolvedValue('https://github.com/example-org/example-repo');

      jest
        .spyOn(changelogValidatorModule, 'validateChangelogs')
        .mockResolvedValue([]);

      const result = await checkDependencyBumps({
        fromRef: 'abc123',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });

      // Verify the result includes the package version
      expect(result['controller-utils'].newVersion).toBe('1.1.0');
      expect(result['controller-utils'].dependencyChanges).toHaveLength(1);

      // Verify validateChangelogs is called
      expect(changelogValidatorModule.validateChangelogs).toHaveBeenCalledWith(
        expect.any(Object),
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );
    });
  });
});
