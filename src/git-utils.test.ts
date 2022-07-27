import { when } from 'jest-when';
import * as miscUtils from './misc-utils';
import {
  getStdoutFromGitCommandWithin,
  getRepositoryHttpsUrl,
} from './git-utils';

jest.mock('./misc-utils');

describe('git-utils', () => {
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
      const projectDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: projectDirectoryPath,
        })
        .mockResolvedValue('https://github.com/foo');

      expect(await getRepositoryHttpsUrl(projectDirectoryPath)).toStrictEqual(
        'https://github.com/foo',
      );
    });

    it('converts an SSH GitHub repo URL into an HTTPS URL', async () => {
      const projectDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: projectDirectoryPath,
        })
        .mockResolvedValue('git@github.com:Foo/Bar.git');

      expect(await getRepositoryHttpsUrl(projectDirectoryPath)).toStrictEqual(
        'https://github.com/Foo/Bar',
      );
    });

    it('throws if the URL of the "origin" remote is in an invalid format', async () => {
      const projectDirectoryPath = '/path/to/project';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('git', ['config', '--get', 'remote.origin.url'], {
          cwd: projectDirectoryPath,
        })
        .mockResolvedValueOnce('foo')
        .mockResolvedValueOnce('http://github.com/Foo/Bar')
        .mockResolvedValueOnce('https://gitbar.foo/Foo/Bar')
        .mockResolvedValueOnce('git@gitbar.foo:Foo/Bar.git')
        .mockResolvedValueOnce('git@github.com:Foo/Bar.foo');

      await expect(getRepositoryHttpsUrl(projectDirectoryPath)).rejects.toThrow(
        'Unrecognized URL for git remote "origin": foo',
      );
      await expect(getRepositoryHttpsUrl(projectDirectoryPath)).rejects.toThrow(
        'Unrecognized URL for git remote "origin": http://github.com/Foo/Bar',
      );
      await expect(getRepositoryHttpsUrl(projectDirectoryPath)).rejects.toThrow(
        'Unrecognized URL for git remote "origin": https://gitbar.foo/Foo/Bar',
      );
      await expect(getRepositoryHttpsUrl(projectDirectoryPath)).rejects.toThrow(
        'Unrecognized URL for git remote "origin": git@gitbar.foo:Foo/Bar.git',
      );
      await expect(getRepositoryHttpsUrl(projectDirectoryPath)).rejects.toThrow(
        'Unrecognized URL for git remote "origin": git@github.com:Foo/Bar.foo',
      );
    });
  });
});
