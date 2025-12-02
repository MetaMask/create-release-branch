import fs from 'fs';
import { when } from 'jest-when';
import { parseChangelog } from '@metamask/auto-changelog';
import { validateChangelogs, updateChangelogs } from './changelog-validator.js';
import * as fsModule from './fs.js';
import * as packageModule from './package.js';

jest.mock('./fs');
jest.mock('./package');
jest.mock('@metamask/auto-changelog');

describe('changelog-validator', () => {
  const mockChanges = {
    'controller-utils': {
      packageName: '@metamask/controller-utils',
      dependencyChanges: [
        {
          package: 'controller-utils',
          dependency: '@metamask/transaction-controller',
          type: 'dependencies' as const,
          oldVersion: '^61.0.0',
          newVersion: '^62.0.0',
        },
      ],
    },
  };

  describe('validateChangelogs', () => {
    it('handles changelog with no Changed section', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');
      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({}), // No Changed section
      });

      const results = await validateChangelogs(
        mockChanges,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: true,
          hasUnreleasedSection: false,
          missingEntries: mockChanges['controller-utils'].dependencyChanges,
          existingEntries: [],
        },
      ]);
    });

    it('returns validation results indicating missing changelog when file does not exist', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(false);

      const results = await validateChangelogs(
        mockChanges,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: false,
          hasUnreleasedSection: false,
          missingEntries: mockChanges['controller-utils'].dependencyChanges,
          existingEntries: [],
        },
      ]);
    });

    it('returns validation results indicating missing unreleased section when changelog parse fails', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\nSome content');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');
      (parseChangelog as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid changelog format');
      });

      const results = await validateChangelogs(
        mockChanges,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: true,
          hasUnreleasedSection: false,
          missingEntries: mockChanges['controller-utils'].dependencyChanges,
          existingEntries: [],
        },
      ]);
    });

    it('returns validation results with missing entries when changelog exists but entries are missing', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');
      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [] }),
      });

      const results = await validateChangelogs(
        mockChanges,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: true,
          hasUnreleasedSection: true,
          missingEntries: mockChanges['controller-utils'].dependencyChanges,
          existingEntries: [],
        },
      ]);
    });

    it('returns validation results with existing entries when changelog has correct entries', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const parseChangelogSpy = jest.fn().mockReturnValue({
        getUnreleasedChanges: () => ({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))',
          ],
        }),
      });
      (parseChangelog as jest.Mock).mockImplementation(parseChangelogSpy);

      const results = await validateChangelogs(
        mockChanges,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: true,
          hasUnreleasedSection: true,
          missingEntries: [],
          existingEntries: ['@metamask/transaction-controller'],
        },
      ]);

      // Verify it uses the actual package name from packageNames map
      expect(parseChangelogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tagPrefix: '@metamask/controller-utils@',
        }),
      );
    });

    it('validates entries in release section when package version is provided', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [1.1.0]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: jest.fn().mockReturnValue({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))',
          ],
        }),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      const changesWithVersion = {
        'controller-utils': {
          ...mockChanges['controller-utils'],
          newVersion: '1.1.0',
        },
      };

      const results = await validateChangelogs(
        changesWithVersion,
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(mockChangelog.getReleaseChanges).toHaveBeenCalledWith('1.1.0');
      expect(results).toStrictEqual([
        {
          package: 'controller-utils',
          hasChangelog: true,
          hasUnreleasedSection: true,
          missingEntries: [],
          existingEntries: ['@metamask/transaction-controller'],
        },
      ]);
    });

    it('validates entries in unreleased section when no package version provided', async () => {
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: jest.fn().mockReturnValue({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))',
          ],
        }),
        getReleaseChanges: jest.fn(),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      const results = await validateChangelogs(
        mockChanges, // No newVersion in mockChanges
        '/path/to/project',
        'https://github.com/example-org/example-repo',
      );

      expect(mockChangelog.getUnreleasedChanges).toHaveBeenCalled();
      expect(mockChangelog.getReleaseChanges).not.toHaveBeenCalled();
      expect(results[0].existingEntries).toContain(
        '@metamask/transaction-controller',
      );
    });
  });

  describe('updateChangelogs', () => {
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');

    it('concatenates multiple existing PR numbers when updating entry', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234), [#5555](https://github.com/example-org/example-repo/pull/5555))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        prNumber: '6789',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify all three PR numbers are included
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('#1234'),
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('#5555'),
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('#6789'),
      );
    });

    it('does not duplicate PR numbers when updating entry', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        prNumber: '1234', // Same as existing
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      const writtenContent = writeFileSpy.mock.calls[0][1] as string;
      // Count occurrences of #1234
      const matches = writtenContent.match(/#1234/gu);
      expect(matches?.length).toBe(1); // Should only appear once
    });

    it('updates peerDependency entry with BREAKING prefix preserved', async () => {
      const peerDepChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      };

      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        '**BREAKING:** Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      await updateChangelogs(peerDepChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      const writtenContent = writeFileSpy.mock.calls[0][1] as string;
      // Verify BREAKING prefix is preserved
      expect(writtenContent).toContain('**BREAKING:**');
      expect(writtenContent).toContain('^62.0.0');
      expect(writtenContent).toContain('#1234');
      expect(writtenContent).toContain('#5678');
    });

    it('uses placeholder PR number when prNumber is not provided', async () => {
      jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        // No prNumber provided
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify placeholder is used in the added change
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('#XXXXX'),
      });
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0`',
        ),
      });
    });

    it('uses placeholder when updating entry without prNumber', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        // No prNumber provided
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      const writtenContent = writeFileSpy.mock.calls[0][1] as string;
      // Should have both the original PR and XXXXX placeholder
      expect(writtenContent).toContain('#1234');
      expect(writtenContent).toContain('#XXXXX');
    });

    it('preserves existing XXXXX placeholder when updating entry', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#XXXXX](https://github.com/example-org/example-repo/pull/XXXXX))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        prNumber: '1234',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      const writtenContent = writeFileSpy.mock.calls[0][1] as string;
      // Should have both XXXXX and new PR
      expect(writtenContent).toContain('#XXXXX');
      expect(writtenContent).toContain('#1234');
      expect(writtenContent).toContain('^62.0.0');
    });

    it('skips update and logs warning when changelog does not exist', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(false);

      const count = await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(0);
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('No CHANGELOG.md found for controller-utils'),
      );
    });

    it('skips update when all entries already exist', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');
      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))',
          ],
        }),
      });

      const count = await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(0);
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('All entries already exist'),
      );
    });

    it('adds new changelog entries when they are missing', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      const parseChangelogSpy = jest.fn().mockReturnValue(mockChangelog);
      (parseChangelog as jest.Mock).mockImplementation(parseChangelogSpy);

      const count = await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(1);
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0`',
        ),
      });
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        'Updated changelog content',
      );
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 changelog entry'),
      );

      // Verify it uses the actual package name from packageNames map
      expect(parseChangelogSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          tagPrefix: '@metamask/controller-utils@',
        }),
      );
    });

    it('updates single existing changelog entry with singular message', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [Unreleased]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      });

      const count = await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(1);
      // Should only write once (no new entries to add)
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('^62.0.0'),
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('#1234'),
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('#5678'),
      );
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated 1 existing entry'),
      );
    });

    it('updates multiple existing entries with plural message', async () => {
      const multipleExistingChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry1 =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';
      const existingEntry2 =
        'Bump `@metamask/network-controller` from `^5.0.0` to `^5.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(
          `# Changelog\n## [Unreleased]\n- ${existingEntry1}\n- ${existingEntry2}`,
        );
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      (parseChangelog as jest.Mock).mockReturnValue({
        getUnreleasedChanges: () => ({
          Changed: [existingEntry1, existingEntry2],
        }),
      });

      const count = await updateChangelogs(multipleExistingChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(1);
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated 2 existing entries'),
      );
    });

    it('handles peerDependencies changes with BREAKING prefix', async () => {
      const peerDepChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      };

      jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(peerDepChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('**BREAKING:**'),
      });
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0`',
        ),
      });
    });

    it('adds both peerDependencies and dependencies in correct order', async () => {
      const mixedTypeChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      };

      jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(mixedTypeChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // addChange prepends entries, so deps are added first (to appear after BREAKING)
      // Then peerDeps are added (to appear first in final output)
      expect(mockChangelog.addChange).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          description: expect.not.stringContaining('**BREAKING:**'),
        }),
      );
      expect(mockChangelog.addChange).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          description: expect.stringContaining('@metamask/network-controller'),
        }),
      );

      expect(mockChangelog.addChange).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          description: expect.stringContaining('**BREAKING:**'),
        }),
      );
      expect(mockChangelog.addChange).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          description: expect.stringContaining(
            '@metamask/transaction-controller',
          ),
        }),
      );
    });

    it('updates existing entries and adds new entries in same package', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      // First read returns original content
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- ${existingEntry}`,
        )
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- Bump \`@metamask/transaction-controller\` from \`^61.0.0\` to \`^62.0.0\` ([#1234](https://github.com/example-org/example-repo/pull/1234), [#5678](https://github.com/example-org/example-repo/pull/5678))`,
        );

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      // First parse shows one outdated entry
      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      };

      // Second parse after update, for adding new entries
      const mockChangelog2 = {
        getUnreleasedChanges: () => ({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234), [#5678](https://github.com/example-org/example-repo/pull/5678))',
          ],
        }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final updated changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      const count = await updateChangelogs(mixedChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(1);
      // Should write twice: once for update, once for final
      expect(writeFileSpy).toHaveBeenCalledTimes(2);
      // Should add the new network-controller entry
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/network-controller` from `^5.0.0` to `^6.0.0`',
        ),
      });
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated 1 and added 1'),
      );

      // Verify both parseChangelog calls use the actual package name
      expect(parseChangelog).toHaveBeenCalledTimes(2);
      expect(parseChangelog).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          tagPrefix: '@metamask/controller-utils@',
        }),
      );
      expect(parseChangelog).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          tagPrefix: '@metamask/controller-utils@',
        }),
      );
    });

    it('updates existing entry and adds only new peerDependency', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- ${existingEntry}`,
        )
        .mockResolvedValueOnce(`# Changelog\n## [Unreleased]\n- Updated`);

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      };

      const mockChangelog2 = {
        getUnreleasedChanges: () => ({ Changed: ['Updated entry'] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      await updateChangelogs(mixedChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Should add the peerDependency with BREAKING prefix
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('**BREAKING:**'),
      });
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('@metamask/network-controller'),
      });

      // Verify the combined update message
      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updated 1 and added 1 changelog entries'),
      );
    });

    it('updates existing entry and adds only new dependency (no peerDeps)', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- ${existingEntry}`,
        )
        .mockResolvedValueOnce(`# Changelog\n## [Unreleased]\n- Updated`);

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      };

      const mockChangelog2 = {
        getUnreleasedChanges: () => ({ Changed: ['Updated entry'] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      await updateChangelogs(mixedChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Should add the dependency WITHOUT BREAKING prefix
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.not.stringContaining('**BREAKING:**'),
      });
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('@metamask/network-controller'),
      });
    });

    it('updates existing entries and adds new peerDependencies correctly', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- ${existingEntry}`,
        )
        .mockResolvedValueOnce(
          `# Changelog\n## [Unreleased]\n- Bump \`@metamask/transaction-controller\` from \`^61.0.0\` to \`^62.0.0\` ([#1234](https://github.com/example-org/example-repo/pull/1234), [#5678](https://github.com/example-org/example-repo/pull/5678))`,
        );

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [existingEntry] }),
      };

      const mockChangelog2 = {
        getUnreleasedChanges: () => ({
          Changed: [
            'Bump `@metamask/transaction-controller` from `^61.0.0` to `^62.0.0` ([#1234](https://github.com/example-org/example-repo/pull/1234), [#5678](https://github.com/example-org/example-repo/pull/5678))',
          ],
        }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final updated changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      await updateChangelogs(mixedChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Should write twice
      expect(writeFileSpy).toHaveBeenCalledTimes(2);

      // Verify peerDependency is added first (it's the new entry)
      expect(mockChangelog2.addChange).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          description: expect.stringContaining('**BREAKING:**'),
        }),
      );
      expect(mockChangelog2.addChange).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          description: expect.stringContaining(
            'Bump `@metamask/network-controller`',
          ),
        }),
      );
    });

    it('adds single new entry with singular message', async () => {
      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 1 changelog entry'),
      );
    });

    it('adds multiple new entries with plural message', async () => {
      const multipleChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const stdoutWriteSpy = jest.spyOn(stdout, 'write');
      jest.spyOn(fsModule, 'writeFile');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog content'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(multipleChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(stdoutWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Added 2 changelog entries'),
      );
    });

    it('logs error when changelog parsing fails', async () => {
      const stderrWriteSpy = jest.spyOn(stderr, 'write');
      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');
      (parseChangelog as jest.Mock).mockImplementation(() => {
        throw new Error('Parse error');
      });

      const count = await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(count).toBe(0);
      expect(stderrWriteSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error updating CHANGELOG.md'),
      );
    });

    it('updates entries in release section when package version is provided', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');
      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(`# Changelog\n## [1.1.0]\n- ${existingEntry}`);
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: jest.fn().mockReturnValue({
          Changed: [existingEntry],
        }),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      const changesWithVersion = {
        'controller-utils': {
          ...mockChanges['controller-utils'],
          newVersion: '1.1.0',
        },
      };

      await updateChangelogs(changesWithVersion, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      expect(mockChangelog.getReleaseChanges).toHaveBeenCalledWith('1.1.0');
      // Verify the entry was updated with new version
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/path/to/project/packages/controller-utils/CHANGELOG.md',
        expect.stringContaining('^62.0.0'),
      );
    });

    it('adds new entries to release section when package is being released', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [1.1.0]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      const changesWithVersion = {
        'controller-utils': {
          ...mockChanges['controller-utils'],
          newVersion: '1.1.0', // Package is being released
        },
      };

      await updateChangelogs(changesWithVersion, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify addChange was called with version parameter
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/transaction-controller`',
        ),
        version: '1.1.0',
      });
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('adds new entries to unreleased section when package is not being released', async () => {
      const writeFileSpy = jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(mockChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify addChange was called WITHOUT version parameter (goes to Unreleased)
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining(
          'Bump `@metamask/transaction-controller`',
        ),
      });
      expect(writeFileSpy).toHaveBeenCalled();
    });

    it('adds peerDependencies to unreleased section when not being released', async () => {
      const peerDepChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
        },
      };

      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [Unreleased]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(peerDepChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify peerDependency with BREAKING prefix added WITHOUT version (to Unreleased)
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('**BREAKING:**'),
      });
    });

    it('adds peerDependencies to release section when package is being released', async () => {
      const peerDepChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
          ],
          newVersion: '1.1.0',
        },
      };

      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);
      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue('# Changelog\n## [1.1.0]');
      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: [] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Updated changelog'),
      };
      (parseChangelog as jest.Mock).mockReturnValue(mockChangelog);

      await updateChangelogs(peerDepChanges, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify peerDependency with BREAKING prefix added to release version
      expect(mockChangelog.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('**BREAKING:**'),
        version: '1.1.0',
      });
    });

    it('updates and adds entries to release section when package is being released', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'dependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(`# Changelog\n## [1.1.0]\n- ${existingEntry}`)
        .mockResolvedValueOnce(`# Changelog\n## [1.1.0]\n- Updated entry`);

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: [existingEntry] }),
      };

      const mockChangelog2 = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: ['Updated entry'] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      const mixedChangesWithVersion = {
        'controller-utils': {
          ...mixedChanges['controller-utils'],
          newVersion: '1.1.0', // Being released
        },
      };

      await updateChangelogs(mixedChangesWithVersion, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify addChange was called with version for release section
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('@metamask/network-controller'),
        version: '1.1.0',
      });
    });

    it('updates and adds peerDependency to release section when package is being released', async () => {
      const mixedChanges = {
        'controller-utils': {
          packageName: '@metamask/controller-utils',
          dependencyChanges: [
            {
              package: 'controller-utils',
              dependency: '@metamask/transaction-controller',
              type: 'dependencies' as const,
              oldVersion: '^61.0.0',
              newVersion: '^62.0.0',
            },
            {
              package: 'controller-utils',
              dependency: '@metamask/network-controller',
              type: 'peerDependencies' as const,
              oldVersion: '^5.0.0',
              newVersion: '^6.0.0',
            },
          ],
        },
      };

      const existingEntry =
        'Bump `@metamask/transaction-controller` from `^61.0.0` to `^61.1.0` ([#1234](https://github.com/example-org/example-repo/pull/1234))';

      jest.spyOn(fsModule, 'writeFile');

      when(jest.spyOn(fsModule, 'fileExists'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValue(true);

      when(jest.spyOn(fsModule, 'readFile'))
        .calledWith('/path/to/project/packages/controller-utils/CHANGELOG.md')
        .mockResolvedValueOnce(`# Changelog\n## [1.1.0]\n- ${existingEntry}`)
        .mockResolvedValueOnce(`# Changelog\n## [1.1.0]\n- Updated entry`);

      jest.spyOn(packageModule, 'formatChangelog').mockResolvedValue('');

      const mockChangelog1 = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: [existingEntry] }),
      };

      const mockChangelog2 = {
        getUnreleasedChanges: () => ({ Changed: [] }),
        getReleaseChanges: () => ({ Changed: ['Updated entry'] }),
        addChange: jest.fn(),
        toString: jest.fn().mockResolvedValue('Final changelog'),
      };

      (parseChangelog as jest.Mock)
        .mockReturnValueOnce(mockChangelog1)
        .mockReturnValueOnce(mockChangelog2);

      const mixedChangesWithVersion = {
        'controller-utils': {
          ...mixedChanges['controller-utils'],
          newVersion: '1.1.0',
        },
      };

      await updateChangelogs(mixedChangesWithVersion, {
        projectRoot: '/path/to/project',
        prNumber: '5678',
        repoUrl: 'https://github.com/example-org/example-repo',
        stdout,
        stderr,
      });

      // Verify peerDependency is added with version and BREAKING prefix
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('**BREAKING:**'),
        version: '1.1.0',
      });
      expect(mockChangelog2.addChange).toHaveBeenCalledWith({
        category: 'Changed',
        description: expect.stringContaining('@metamask/network-controller'),
        version: '1.1.0',
      });
    });
  });
});
