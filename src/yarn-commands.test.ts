import fs from 'fs';
import { when } from 'jest-when';
import {
  fixConstraints,
  getYarnVersion,
  installDependencies,
} from './yarn-commands.js';
import * as miscUtils from './misc-utils.js';

jest.mock('./misc-utils');

describe('yarn-commands', () => {
  describe('getYarnVersion', () => {
    it('should run yarn --version with the correct parameters', async () => {
      await getYarnVersion();

      expect(miscUtils.getStdoutFromCommand).toHaveBeenCalledWith('yarn', [
        '--version',
      ]);
    });
  });

  describe('fixConstraints', () => {
    it('should run yarn constraints --fix when yarn version is compatible with constraints', async () => {
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

    it('should not run yarn constraints --fix when yarn version is not compatible with constraints', async () => {
      const repositoryDirectoryPath = '/path/to/repo';
      when(jest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('yarn', ['--version'])
        .mockResolvedValue('1.0.0');
      const stdout = fs.createWriteStream('/dev/null');

      await fixConstraints(repositoryDirectoryPath, stdout);

      expect(miscUtils.runCommand).toHaveBeenCalledTimes(0);
    });
  });

  describe('installDependencies', () => {
    it('should run yarn with the correct parameters', async () => {
      const repositoryDirectoryPath = '/path/to/repo';

      await installDependencies('/path/to/repo');

      expect(miscUtils.runCommand).toHaveBeenCalledWith('yarn', [], {
        cwd: repositoryDirectoryPath,
      });
    });
  });
});
