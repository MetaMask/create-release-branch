import { fixConstraints, installDependencies } from './yarn-commands.js';
import { runCommand } from './misc-utils.js';

jest.mock('./misc-utils');

describe('yarn-commands', () => {
  describe('fixConstraints', () => {
    const repositoryDirectoryPath = '/path/to/repo';

    it('should run yarn constraints --fix with the correct parameters', async () => {
      await fixConstraints(repositoryDirectoryPath);

      expect(runCommand).toHaveBeenCalledWith(
        'yarn',
        ['constraints', '--fix'],
        {
          cwd: repositoryDirectoryPath,
        },
      );
    });
  });

  describe('installDependencies', () => {
    const repositoryDirectoryPath = '/path/to/repo';

    it('should run yarn with the correct parameters', async () => {
      await installDependencies('/path/to/repo');

      expect(runCommand).toHaveBeenCalledWith('yarn', [], {
        cwd: repositoryDirectoryPath,
      });
    });
  });
});
