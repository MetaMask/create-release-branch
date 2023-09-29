import fs from 'fs';
import { buildMockProject } from '../tests/unit/helpers';
import { main } from './main';
import * as initialParametersModule from './initial-parameters';
import * as monorepoWorkflowOperations from './monorepo-workflow-operations';

jest.mock('./initial-parameters');
jest.mock('./monorepo-workflow-operations');

describe('main', () => {
  it('executes the monorepo workflow if the project is a monorepo', async () => {
    const project = buildMockProject({ isMonorepo: true });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest
      .spyOn(initialParametersModule, 'determineInitialParameters')
      .mockResolvedValue({
        project,
        tempDirectoryPath: '/path/to/temp/directory',
        reset: true,
      });
    const followMonorepoWorkflowSpy = jest
      .spyOn(monorepoWorkflowOperations, 'followMonorepoWorkflow')
      .mockResolvedValue();

    await main({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(followMonorepoWorkflowSpy).toHaveBeenCalledWith({
      project,
      tempDirectoryPath: '/path/to/temp/directory',
      firstRemovingExistingReleaseSpecification: true,
      stdout,
      stderr,
    });
  });

  it('executes the polyrepo workflow if the project is within a polyrepo', async () => {
    const project = buildMockProject({ isMonorepo: false });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest
      .spyOn(initialParametersModule, 'determineInitialParameters')
      .mockResolvedValue({
        project,
        tempDirectoryPath: '/path/to/temp/directory',
        reset: false,
      });
    const followMonorepoWorkflowSpy = jest
      .spyOn(monorepoWorkflowOperations, 'followMonorepoWorkflow')
      .mockResolvedValue();

    await main({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(followMonorepoWorkflowSpy).not.toHaveBeenCalled();
  });
});
