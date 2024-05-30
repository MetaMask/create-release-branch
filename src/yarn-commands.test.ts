import fs from 'fs';
import { when } from 'jest-when';
import {
  deduplicateDependencies,
  fixConstraints,
  updateYarnLockfile,
} from './yarn-commands.js';
import * as miscUtils from './misc-utils.js';

jest.mock('./misc-utils');

describe('yarn-commands', () => {
  describe('fixConstraints', () => {
    it('runs "yarn constraints --fix" when yarn version is compatible with constraints', async () => {
      const repositoryDirectoryPath = '/path/to/repo';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('yarn', ['--version'])
        .mockResolvedValue('2.0.0');
      const stdout = fs.createWriteStream('/dev/null');

      await fixConstraints(repositoryDirectoryPath, stdout);

      expect(miscUtils.runCommand).toHaveBeenCalledWith(
        'yarn',
        ['constraints', '--fix'],
        {
          cwd: repositoryDirectoryPath,
        },
      );
    });

    it('does not run "yarn constraints --fix" when yarn version is not compatible with constraints', async () => {
      const repositoryDirectoryPath = '/path/to/repo';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('yarn', ['--version'])
        .mockResolvedValue('1.0.0');
      const stdout = fs.createWriteStream('/dev/null');

      await fixConstraints(repositoryDirectoryPath, stdout);

      expect(miscUtils.runCommand).toHaveBeenCalledTimes(0);
    });
  });

  describe('updateYarnLockfile', () => {
    it('runs "yarn install --no--immutable" with the correct parameters', async () => {
      const repositoryDirectoryPath = '/path/to/repo';

      await updateYarnLockfile('/path/to/repo');

      expect(miscUtils.runCommand).toHaveBeenCalledWith(
        'yarn',
        ['install', '--no-immutable'],
        {
          cwd: repositoryDirectoryPath,
        },
      );
    });
  });

  describe('deduplicateDependencies', () => {
    it('runs "yarn dedupe" with the correct parameters', async () => {
      const repositoryDirectoryPath = '/path/to/repo';

      await deduplicateDependencies('/path/to/repo');

      expect(miscUtils.runCommand).toHaveBeenCalledWith('yarn', ['dedupe'], {
        cwd: repositoryDirectoryPath,
      });
    });
  });
});
