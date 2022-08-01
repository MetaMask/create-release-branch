import { when } from 'jest-when';
import {
  getStdoutFromGitCommandWithin,
  getRepositoryHttpsUrl,
  captureChangesInReleaseBranch,
} from './repo';
import * as miscUtils from './misc-utils';

jest.mock('./misc-utils');

describe('repo', () => {
  describe('getStdoutFromGitCommandWithin', () => {
    it('calls getStdoutFromCommand with "git" as the command, passing the given args and using the given directory as the working directory', async () => {
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['foo', 'bar'], { cwd: '/path/to/repo' })
        .mockResolvedValue('the output');

      const output = await getStdoutFromGitCommandWithin('/path/to/repo', [
        'foo',
        'bar',
      ]);

      expect(output).toStrictEqual('the output');
    });
  });

  describe('getRepositoryHttpsUrl', () => {
    it('returns the URL of the "origin" remote of the given repo if it looks like a HTTPS public GitHub repo URL', async () => {
      const repositoryDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: repositoryDirectoryPath,
        })
        .mockResolvedValue('https://github.com/foo');

      expect(
        await getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).toStrictEqual('https://github.com/foo');
    });

    it('converts an SSH GitHub repo URL into an HTTPS URL', async () => {
      const repositoryDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: repositoryDirectoryPath,
        })
        .mockResolvedValue('git@github.com:Foo/Bar.git');

      expect(
        await getRepositoryHttpsUrl(repositoryDirectoryPath),
      ).toStrictEqual('https://github.com/Foo/Bar');
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

      await captureChangesInReleaseBranch({
        repositoryDirectoryPath: '/path/to/project',
        releaseDate: new Date(2022, 6, 22),
        releaseNumber: 12345,
      });

      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'release/2022-07-22/12345'],
        { cwd: '/path/to/project' },
      );
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['add', '-A'],
        { cwd: '/path/to/project' },
      );
      expect(getStdoutFromCommandSpy).toHaveBeenCalledWith(
        'git',
        ['commit', '-m', 'Release 2022-07-22 (R12345)'],
        { cwd: '/path/to/project' },
      );
    });
  });
});
