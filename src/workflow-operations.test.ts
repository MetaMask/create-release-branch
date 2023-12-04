import { when } from 'jest-when';
import { buildMockProject } from '../tests/unit/helpers';
import { createReleaseBranch } from './workflow-operations';

import * as repoModule from './repo';

jest.mock('./repo');

describe('workflow-operations', () => {
  describe('createReleaseBranch', () => {
    it('should create a ordinary release branch if it does not exist', async () => {
      const project = buildMockProject();
      const newReleaseVersion = `${
        project.releaseVersion.ordinaryNumber + 1
      }.0.0`;
      const newReleaseBranchName = `release/${newReleaseVersion}`;
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue('main');
      when(jest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .mockResolvedValue(false);
      const runGitCommandWithin = jest.spyOn(repoModule, 'runGitCommandWithin');

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
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue('main');
      when(jest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .mockResolvedValue(false);
      const runGitCommandWithin = jest.spyOn(repoModule, 'runGitCommandWithin');

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
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue(newReleaseBranchName);

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
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue(newReleaseBranchName);

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
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue('main');
      when(jest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .mockResolvedValue(true);

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
      when(jest.spyOn(repoModule, 'getCurrentBranchName'))
        .calledWith(project.directoryPath)
        .mockResolvedValue('main');
      when(jest.spyOn(repoModule, 'branchExists'))
        .calledWith(project.directoryPath, newReleaseBranchName)
        .mockResolvedValue(true);

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
