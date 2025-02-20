import fs from 'fs';
import { buildMockProject } from '../tests/unit/helpers.js';
import { main } from './main.js';
import * as initialParametersModule from './initial-parameters.js';
import * as monorepoWorkflowOperations from './monorepo-workflow-operations.js';
import * as interactiveUi from './interactive-ui.js';

jest.mock('./initial-parameters');
jest.mock('./monorepo-workflow-operations');
jest.mock('./interactive-ui');

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

  it('executes the interactive UI workflow if the project is a monorepo', async () => {
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
    const startInteractiveUISpy = jest
      .spyOn(interactiveUi, 'startInteractiveUI')
      .mockResolvedValue();

    await main({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(startInteractiveUISpy).toHaveBeenCalledWith({
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
