import { when } from 'vitest-when';
import { buildMockProject } from '../tests/unit/helpers.js';
import { createReleaseBranch } from './workflow-operations.js';

import * as repoModule from './repo.js';

vitest.mock('./repo');

describe('workflow-operations', () => {
  describe('createReleaseBranch', () => {
    it('should create a ordinary release branch if it does not exist', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${
        project.releaseVersion.ordinaryNumber + 1
      }.0.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve('main');
      when(vitest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .thenResolve(false);
      const runGitCommandWithin = vitest.spyOn(
        repoModule,
        'runGitCommandWithin',
      );

      const result = await createReleaseBranch({
        project,
        releaseType: 'ordinary',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: true,
      });
      expect(runGitCommandWithin).toHaveBeenCalledWith(
        project.directoryPath,
        'checkout',
        ['-b', newReleaseBranchName],
      );
    });

    it('should create a backport release branch if it does not exist', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${project.releaseVersion.ordinaryNumber}.${
        project.releaseVersion.backportNumber + 1
      }.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve('main');
      when(vitest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .thenResolve(false);
      const runGitCommandWithin = vitest.spyOn(
        repoModule,
        'runGitCommandWithin',
      );

      const result = await createReleaseBranch({
        project,
        releaseType: 'backport',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: true,
      });
      expect(runGitCommandWithin).toHaveBeenCalledWith(
        project.directoryPath,
        'checkout',
        ['-b', newReleaseBranchName],
      );
    });

    it('should return existing ordinary release branch info if already checked out', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${
        project.releaseVersion.ordinaryNumber + 1
      }.0.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve(newReleaseBranchName);

      const result = await createReleaseBranch({
        project,
        releaseType: 'ordinary',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: false,
      });
    });

    it('should return existing backport release branch info if already checked out', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${project.releaseVersion.ordinaryNumber}.${
        project.releaseVersion.backportNumber + 1
      }.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve(newReleaseBranchName);

      const result = await createReleaseBranch({
        project,
        releaseType: 'backport',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: false,
      });
    });

    it('should checkout existing ordinary release branch if it already exists', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${
        project.releaseVersion.ordinaryNumber + 1
      }.0.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve('main');
      when(vitest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .thenResolve(true);

      const result = await createReleaseBranch({
        project,
        releaseType: 'ordinary',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: false,
      });
    });

    it('should checkout existing backport release branch if it already exists', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${project.releaseVersion.ordinaryNumber}.${
        project.releaseVersion.backportNumber + 1
      }.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(vitest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .thenResolve('main');
      when(vitest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .thenResolve(true);

      const result = await createReleaseBranch({
        project,
        releaseType: 'backport',
      });

      expect(result).toStrictEqual({
        version: newReleaseVersion,
        firstRun: false,
      });
    });
  });
});
