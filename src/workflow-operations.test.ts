import { buildMockProject } from '../tests/unit/helpers';
import { captureChangesInReleaseBranch } from './workflow-operations';
import * as repoModule from './repo';

jest.mock('./repo');

describe('workflow-operations', () => {
  describe('captureChangesInReleaseBranch', () => {
    it('checks out a new branch named after the name of the release, stages all changes, then commits them to the branch', async () => {
      const project = buildMockProject({
        directoryPath: '/path/to/project',
      });
      const releasePlan = {
        releaseName: 'release-name',
        packages: [],
      };
      const getStdoutFromGitCommandWithinSpy = jest
        .spyOn(repoModule, 'getStdoutFromGitCommandWithin')
        .mockResolvedValue('the output');

      await captureChangesInReleaseBranch(project, releasePlan);

      expect(getStdoutFromGitCommandWithinSpy).toHaveBeenNthCalledWith(
        1,
        '/path/to/project',
        ['checkout', '-b', 'release/release-name'],
      );
      expect(getStdoutFromGitCommandWithinSpy).toHaveBeenNthCalledWith(
        2,
        '/path/to/project',
        ['add', '-A'],
      );
      expect(getStdoutFromGitCommandWithinSpy).toHaveBeenNthCalledWith(
        3,
        '/path/to/project',
        ['commit', '-m', 'Release release-name'],
      );
    });
  });
});
