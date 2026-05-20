import { MockWritable } from 'stdio-mock';
import { buildMockPackage, buildMockProject } from '../tests/unit/helpers.js';
import { finalizeInteractiveRelease } from './ui.js';
import * as projectModule from './project.js';
import * as releasePlanModule from './release-plan.js';
import * as repoModule from './repo.js';
import * as yarnCommands from './yarn-commands.js';

jest.mock('./project');
jest.mock('./release-plan');
jest.mock('./repo');
jest.mock('./yarn-commands');
jest.mock('./dirname', () => ({
  getCurrentDirectoryPath: jest.fn().mockReturnValue('/path/to/somewhere'),
}));
jest.mock('open', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('ui', () => {
  describe('finalizeInteractiveRelease', () => {
    it('squashes the initial release commit before committing an interactive first run', async () => {
      const project = buildMockProject({
        directoryPath: '/path/to/project',
        workspacePackages: {
          '@scope/a': buildMockPackage('@scope/a', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });
      const releasePlan = { newVersion: '2.0.0', packages: [] };
      const stderr = new MockWritable();
      const resetLastCommitSpy = jest.spyOn(repoModule, 'resetLastCommit');
      const commitAllChangesSpy = jest.spyOn(repoModule, 'commitAllChanges');
      jest
        .spyOn(releasePlanModule, 'planRelease')
        .mockResolvedValue(releasePlan);
      jest.spyOn(releasePlanModule, 'executeReleasePlan').mockResolvedValue();

      const result = await finalizeInteractiveRelease({
        project,
        defaultBranch: 'main',
        formatter: 'prettier',
        stderr,
        version: '2.0.0',
        firstRun: true,
        releasedPackages: { '@scope/a': 'major' },
      });

      expect(result).toStrictEqual({ status: 'success' });
      expect(
        projectModule.restoreChangelogsForSkippedPackages,
      ).toHaveBeenCalledWith({
        project,
        releaseSpecificationPackages: { '@scope/a': 'major' },
        defaultBranch: 'main',
      });
      expect(yarnCommands.fixConstraints).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(yarnCommands.updateYarnLockfile).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(yarnCommands.deduplicateDependencies).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(resetLastCommitSpy).toHaveBeenCalledWith(project.directoryPath);
      expect(commitAllChangesSpy).toHaveBeenCalledTimes(1);
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
      );
      expect(resetLastCommitSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commitAllChangesSpy.mock.invocationCallOrder[0],
      );
    });

    it('does not reset HEAD before committing an existing interactive release branch', async () => {
      const project = buildMockProject({
        directoryPath: '/path/to/project',
        workspacePackages: {
          '@scope/a': buildMockPackage('@scope/a', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });
      const releasePlan = { newVersion: '2.0.0', packages: [] };
      const stderr = new MockWritable();
      const resetLastCommitSpy = jest.spyOn(repoModule, 'resetLastCommit');
      const commitAllChangesSpy = jest.spyOn(repoModule, 'commitAllChanges');
      jest
        .spyOn(releasePlanModule, 'planRelease')
        .mockResolvedValue(releasePlan);
      jest.spyOn(releasePlanModule, 'executeReleasePlan').mockResolvedValue();

      const result = await finalizeInteractiveRelease({
        project,
        defaultBranch: 'main',
        formatter: 'prettier',
        stderr,
        version: '2.0.0',
        firstRun: false,
        releasedPackages: { '@scope/a': 'major' },
      });

      expect(result).toStrictEqual({ status: 'success' });
      expect(resetLastCommitSpy).not.toHaveBeenCalled();
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
      );
    });
  });
});
