import fs from 'fs';
import { buildMockProject } from '../tests/unit/helpers';
import * as initializationUtils from './initialization-utils';
import * as monorepoWorkflowUtils from './monorepo-workflow-utils';
import { main } from './main';

jest.mock('./initialization-utils');
jest.mock('./monorepo-workflow-utils');

describe('main', () => {
  it('executes the monorepo workflow if the project is a monorepo', async () => {
    const project = buildMockProject({ isMonorepo: true });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest.spyOn(initializationUtils, 'initialize').mockResolvedValue({
      project,
      tempDirectoryPath: '/path/to/temp/directory',
      reset: false,
    });
    const followMonorepoWorkflowSpy = jest
      .spyOn(monorepoWorkflowUtils, 'followMonorepoWorkflow')
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
      firstRemovingExistingReleaseSpecification: false,
      stdout,
      stderr,
    });
  });

  it('executes the polyrepo workflow if the project is within a polyrepo', async () => {
    const project = buildMockProject({ isMonorepo: false });
    const stdout = fs.createWriteStream('/dev/null');
    const stderr = fs.createWriteStream('/dev/null');
    jest.spyOn(initializationUtils, 'initialize').mockResolvedValue({
      project,
      tempDirectoryPath: '/path/to/temp/directory',
      reset: false,
    });
    const followMonorepoWorkflowSpy = jest
      .spyOn(monorepoWorkflowUtils, 'followMonorepoWorkflow')
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
