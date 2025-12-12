import fs from 'fs';

import * as initialParametersModule from './initial-parameters.js';
import * as monorepoWorkflowOperations from './monorepo-workflow-operations.js';
import { run } from './run.js';
import { buildMockProject } from '../../tests/unit/helpers.js';
import * as ui from '../ui/start.js';

jest.mock('../core/get-root-directory-path', () => ({
  getRootDirectoryPath: jest.fn().mockReturnValue('/path/to/somewhere'),
}));
jest.mock('../ui/start');
jest.mock('./initial-parameters');
jest.mock('./monorepo-workflow-operations');
jest.mock('open', () => ({
  apps: {
    browser: jest.fn(),
  },
}));

describe('start', () => {
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

    await run({
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
    const startSpy = jest.spyOn(ui, 'start').mockResolvedValue();

    await run({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(startSpy).toHaveBeenCalledWith({
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

    await run({
      argv: [],
      cwd: '/path/to/somewhere',
      stdout,
      stderr,
    });

    expect(followMonorepoWorkflowSpy).not.toHaveBeenCalled();
  });
});
