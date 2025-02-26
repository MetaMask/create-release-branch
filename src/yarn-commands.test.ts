import { when } from 'vitest-when';
import { vitest } from 'vitest';
import {
  deduplicateDependencies,
  fixConstraints,
  updateYarnLockfile,
} from './yarn-commands.js';
import * as miscUtils from './misc-utils.js';

vitest.mock('./misc-utils');

describe('yarn-commands', () => {
  describe('fixConstraints', () => {
    it('runs "yarn constraints --fix" with the correct parameters', async () => {
      const repositoryDirectoryPath = '/path/to/repo';
      when(vitest.spyOn(miscUtils, 'getStdoutFromCommand'))
        .calledWith('yarn', ['--version'])
        .thenResolve('2.0.0');

      await fixConstraints(repositoryDirectoryPath);

      expect(miscUtils.runCommand).toHaveBeenCalledWith(
        'yarn',
        ['constraints', '--fix'],
        {
          cwd: repositoryDirectoryPath,
        },
      );
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
