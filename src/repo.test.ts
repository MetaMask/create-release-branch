import { when } from 'jest-when';
import {
  getRepositoryHttpsUrl,
  captureChangesInReleaseBranch,
  getTagNames,
  hasChangesInDirectorySinceGitTag,
} from './repo';
import * as miscUtils from './misc-utils';

jest.mock('./misc-utils');

describe('repo', () => {
  describe('getRepositoryHttpsUrl', () => {
    it('returns the URL of the "origin" remote of the given repo if it looks like a HTTPS public GitHub repo URL', async () => {
      const repositoryDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: repositoryDirectoryPath,
        })
        .mockResolvedValue('https://github.com/foo');

      expect(await getRepositoryHttpsUrl(repositoryDirectoryPath)).toBe(
        'https://github.com/foo',
      );
    });

    it('converts an SSH GitHub repo URL into an HTTPS URL', async () => {
      const repositoryDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: repositoryDirectoryPath,
        })
        .mockResolvedValue('git@github.com:Foo/Bar.git');

      expect(await getRepositoryHttpsUrl(repositoryDirectoryPath)).toBe(
        'https://github.com/Foo/Bar',
      );
    });

    it('throws if the URL of the "origin" remote is in an invalid format', async () => {
      const repositoryDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: repositoryDirectoryPath,
        })
        .mockResolvedValueOnce('foo')
        .mockResolvedValueOnce('http://github.com/Foo/Bar')
        .mockResolvedValueOnce('https://gitbar.foo/Foo/Bar')
        .mockResolvedValueOnce('git@gitbar.foo:Foo/Bar.git')
        .mockResolvedValueOnce('git@github.com:Foo/Bar.foo');

      await expect(
        getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).rejects.toThrow('Unrecognized URL for git remote "origin": foo');
      await expect(
        getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).rejects.toThrow(
        'Unrecognized URL for git remote "origin": http://github.com/Foo/Bar',
      );
      await expect(
        getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).rejects.toThrow(
        'Unrecognized URL for git remote "origin": https://gitbar.foo/Foo/Bar',
      );
      await expect(
        getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).rejects.toThrow(
        'Unrecognized URL for git remote "origin": git@gitbar.foo:Foo/Bar.git',
      );
      await expect(
        getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).rejects.toThrow(
        'Unrecognized URL for git remote "origin": git@github.com:Foo/Bar.foo',
      );
    });
  });

  describe('captureChangesInReleaseBranch', () => {
    it('checks out a new branch, stages all files, and creates a new commit', async () => {
      const getStdoutFromCommandSpy = jest.spyOn(
        miscUtils,
        'getStdoutFromCommand',
      );

      await captureChangesInReleaseBranch('/path/to/project', {
        releaseVersion: '1.0.0',
      });

      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'release/1.0.0'],
        { cwd: '/path/to/project' },
      );
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['add', '-A'],
        { cwd: '/path/to/project' },
      );
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'Release 1.0.0'],
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
});
