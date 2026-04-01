import fs from 'fs';

import * as initialParametersModule from './initial-parameters.js';
import { main } from './main.js';
import * as monorepoWorkflowOperations from './monorepo-workflow-operations.js';
import * as ui from './ui.js';
import { buildMockProject } from '../tests/unit/helpers.js';

jest.mock('./initial-parameters');
jest.mock('./monorepo-workflow-operations');
jest.mock('./ui');
jest.mock('./dirname', () => ({
  getCurrentDirectoryPath: jest.fn().mockReturnValue('/path/to/somewhere'),
}));
jest.mock('open', () => ({
  apps: {
    browser: jest.fn(),
  },
}));

describe('main', () => {
  it('executes the CLI monorepo workflow if the project is a monorepo and interactive is false', async () => {
    const project = buildMockProject({ isMonorepo: true });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest
      .spyOn(initialParametersModule, 'determineInitialParameters')
      .mockResolvedValue({
        project,
        tempDirectoryPath: '/path/to/temp/directory',
        reset: true,
        defaultBranch: 'main',
        releaseType: 'backport',
        interactive: false,
        port: 3000,
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
      releaseType: 'backport',
      defaultBranch: 'main',
      stdout,
      stderr,
    });
  });

  it('executes the interactive UI monorepo workflow if the project is a monorepo and interactive is true', async () => {
    const project = buildMockProject({ isMonorepo: true });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest
      .spyOn(initialParametersModule, 'determineInitialParameters')
      .mockResolvedValue({
        project,
        tempDirectoryPath: '/path/to/temp/directory',
        reset: true,
        defaultBranch: 'main',
        releaseType: 'backport',
        interactive: true,
        port: 3000,
      });
    const startUISpy = jest.spyOn(ui, 'startUI').mockResolvedValue();

    await main({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(startUISpy).toHaveBeenCalledWith({
      project,
      releaseType: 'backport',
      defaultBranch: 'main',
      port: 3000,
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
        defaultBranch: 'main',
        releaseType: 'backport',
        interactive: false,
        port: 3000,
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
