import { when } from 'jest-when';

import * as miscUtils from './misc-utils.js';
import {
  commitAllChanges,
  getTagNames,
  hasChangesInDirectorySinceGitTag,
  getCurrentBranchName,
  branchExists,
  restoreFiles,
} from './repo.js';

jest.mock('./misc-utils');

describe('repo', () => {
  describe('commitAllChanges', () => {
    it('stages all files, and creates a new commit', async () => {
      const getStdoutFromCommandSpy = jest.spyOn(
        miscUtils,
        'getStdoutFromCommand',
      );
      const commitMessage = 'Release 1.0.0';
      await commitAllChanges('/path/to/project', commitMessage);

      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['add', '-A'],
        { cwd: '/path/to/project' },
      );
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', commitMessage],
        { cwd: '/path/to/project' },
      );
    });
  });

  describe('getTagNames', () => {
    it('returns all of the tag names that match a known format, sorted by ascending semantic version order', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['tag', '--sort=version:refname', '--merged'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue(['tag1', 'tag2', 'tag3']);

      expect(await getTagNames('/path/to/repo')).toStrictEqual([
        'tag1',
        'tag2',
        'tag3',
      ]);
    });

    it('returns an empty array if the repo has no tags as long as it was not cloned shallowly', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['tag', '--sort=version:refname', '--merged'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue([]);
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['rev-parse', '--is-shallow-repository'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue('false');

      expect(await getTagNames('/path/to/repo')).toStrictEqual([]);
    });

    it('throws if the repo has no tags but it was cloned shallowly', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['tag', '--sort=version:refname', '--merged'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue([]);
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['rev-parse', '--is-shallow-repository'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue('true');

      await expect(getTagNames('/path/to/repo')).rejects.toThrow(
        '"git tag" returned no tags. Increase your git fetch depth.',
      );
    });

    it('throws if "git rev-parse --is-shallow-repository" returns neither "true" nor "false"', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['tag', '--sort=version:refname', '--merged'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue([]);
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['rev-parse', '--is-shallow-repository'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue('something-else');

      await expect(getTagNames('/path/to/repo')).rejects.toThrow(
        '"git rev-parse --is-shallow-repository" returned unrecognized value: "something-else"',
      );
    });
  });

  describe('hasChangesInDirectorySinceGitTag', () => {
    it('returns true if "git diff" includes any files within the given directory, for the first call', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['diff', 'v1.0.0', 'HEAD', '--name-only'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue(['file1', 'subdirectory/file1']);

      const hasChanges = await hasChangesInDirectorySinceGitTag(
        '/path/to/repo',
        '/path/to/repo/subdirectory',
        'v1.0.0',
      );

      expect(hasChanges).toBe(true);
    });

    it('returns false if "git diff" does not include any files within the given directory, for the first call', async () => {
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['diff', 'v2.0.0', 'HEAD', '--name-only'], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue(['file1', 'file2']);

      const hasChanges = await hasChangesInDirectorySinceGitTag(
        '/path/to/repo',
        '/path/to/repo/subdirectory',
        'v2.0.0',
      );

      expect(hasChanges).toBe(false);
    });

    it('only runs "git diff" once when called more than once for the same tag name (even for a different subdirectory)', async () => {
      const getLinesFromCommandSpy = jest
        .spyOn(miscUtils, 'getLinesFromCommand')
        .mockResolvedValue([]);

      await hasChangesInDirectorySinceGitTag(
        '/path/to/repo',
        '/path/to/repo/subdirectory1',
        'v3.0.0',
      );
      await hasChangesInDirectorySinceGitTag(
        '/path/to/repo',
        '/path/to/repo/subdirectory2',
        'v3.0.0',
      );

      expect(getLinesFromCommandSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCurrentBranchName', () => {
    it('gets the current branch name', async () => {
      const getStdoutFromCommandSpy = jest.spyOn(
        miscUtils,
        'getStdoutFromCommand',
      );

      when(getStdoutFromCommandSpy)
        .calledWith('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: '/path/to/project',
        })
        .mockResolvedValue('release/1.1.1');

      const branchName = await getCurrentBranchName('/path/to/project');

      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        { cwd: '/path/to/project' },
      );

      expect(branchName).toBe('release/1.1.1');
    });
  });

  describe('branchExists', () => {
    it('returns true when specified branch name exists', async () => {
      const releaseBranchName = 'release/1.0.0';
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['branch', '--list', releaseBranchName], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue([releaseBranchName]);

      expect(await branchExists('/path/to/repo', releaseBranchName)).toBe(true);
    });

    it("returns false when specified branch name doesn't exist", async () => {
      const releaseBranchName = 'release/1.0.0';
      when(jest.spyOn(miscUtils, 'getLinesFromCommand'))
        .calledWith('git', ['branch', '--list', releaseBranchName], {
          cwd: '/path/to/repo',
        })
        .mockResolvedValue([]);

      expect(await branchExists('/path/to/repo', releaseBranchName)).toBe(
        false,
      );
    });
  });

  describe('restoreFiles', () => {
    it('should call runCommand with the correct arguments', async () => {
      const getStdoutFromCommandSpy = jest.spyOn(
        miscUtils,
        'getStdoutFromCommand',
      );
      const defaultBranch = 'main';
      when(getStdoutFromCommandSpy)
        .calledWith('git', ['merge-base', defaultBranch, 'HEAD'], {
          cwd: '/path/to',
        })
        .mockResolvedValue('COMMIT_SH');
      const runCommandSpy = jest.spyOn(miscUtils, 'runCommand');
      await restoreFiles('/path/to', defaultBranch, ['packages/filename.ts']);
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['merge-base', defaultBranch, 'HEAD'],
        {
          cwd: '/path/to',
        },
      );
      expect(runCommandSpy).toHaveBeenCalledWith(
        'git',
        ['restore', '--source', 'COMMIT_SH', '--', 'packages/filename.ts'],
        {
          cwd: '/path/to',
        },
      );
    });
  });
});
