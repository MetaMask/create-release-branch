import os from 'os';
import path from 'path';
import { when } from 'jest-when';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { initialize } from './initialization-utils';
import * as inputsUtils from './inputs-utils';
import * as projectUtils from './project-utils';

jest.mock('./inputs-utils');
jest.mock('./project-utils');

describe('initialize', () => {
  it('returns an object that contains data necessary to run the workflow', async () => {
    const project = buildMockProject();
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: '/path/to/project',
        tempDirectory: '/path/to/temp',
        reset: true,
      });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);

    const config = await initialize(['arg1', 'arg2'], '/path/to/somewhere');

    expect(config).toStrictEqual({
      project,
      tempDirectoryPath: '/path/to/temp',
      reset: true,
    });
  });

  it('uses a default temporary directory based on the name of the package if no such directory was passed as an input', async () => {
    const project = buildMockProject({
      rootPackage: buildMockPackage('@foo/bar'),
    });
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: '/path/to/project',
        tempDirectory: undefined,
        reset: true,
      });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);

    const config = await initialize(['arg1', 'arg2'], '/path/to/somewhere');

    expect(config).toStrictEqual({
      project,
      tempDirectoryPath: path.join(
        os.tmpdir(),
        'create-release-branch',
        '@foo__bar',
      ),
      reset: true,
    });
  });
});
