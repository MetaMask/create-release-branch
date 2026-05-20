import { MockWritable } from 'stdio-mock';
import { buildMockPackage, buildMockProject } from '../tests/unit/helpers.js';
import {
  finalizeInteractiveRelease,
  prepareInteractiveReleaseBranch,
} from './ui.js';
import * as projectModule from './project.js';
import * as releasePlanModule from './release-plan.js';
import * as repoModule from './repo.js';
import * as yarnCommands from './yarn-commands.js';
import * as workflowOperations from './workflow-operations.js';

jest.mock('./project');
jest.mock('./release-plan');
jest.mock('./repo');
jest.mock('./yarn-commands');
jest.mock('./workflow-operations');
jest.mock('./dirname', () => ({
  getCurrentDirectoryPath: jest.fn().mockReturnValue('/path/to/somewhere'),
}));
jest.mock('open', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('ui', () => {
  describe('prepareInteractiveReleaseBranch', () => {
    it('updates changelogs without committing when creating an interactive release branch', async () => {
      const project = buildMockProject({ directoryPath: '/path/to/project' });
      const stderr = new MockWritable();
      const updateChangelogsForChangedPackagesSpy = jest.spyOn(
        projectModule,
        'updateChangelogsForChangedPackages',
      );
      const commitAllChangesSpy = jest.spyOn(repoModule, 'commitAllChanges');
      jest.spyOn(workflowOperations, 'createReleaseBranch').mockResolvedValue({
        version: '2.0.0',
        firstRun: true,
      });

      const result = await prepareInteractiveReleaseBranch({
        project,
        releaseType: 'ordinary',
        formatter: 'prettier',
        stderr,
      });

      expect(result).toStrictEqual({
        version: '2.0.0',
        firstRun: true,
      });

      expect(updateChangelogsForChangedPackagesSpy).toHaveBeenCalledWith({
        project,
        formatter: 'prettier',
        stderr,
      });
      expect(commitAllChangesSpy).not.toHaveBeenCalled();
    });
  });

  describe('finalizeInteractiveRelease', () => {
    it('commits an interactive first run without resetting HEAD', async () => {
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
      expect(commitAllChangesSpy).toHaveBeenCalledTimes(1);
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
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
        releasedPackages: { '@scope/a': 'major' },
      });

      expect(result).toStrictEqual({ status: 'success' });
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
      );
    });
  });
});
