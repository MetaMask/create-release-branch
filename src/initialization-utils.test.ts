import os from 'os';
import path from 'path';
import { when } from 'jest-when';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { initialize } from './initialization-utils';
import * as envUtils from './env-utils';
import * as inputsUtils from './inputs-utils';
import * as projectUtils from './project-utils';

jest.mock('./env-utils');
jest.mock('./inputs-utils');
jest.mock('./project-utils');

describe('initialize', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an object derived from command-line arguments and environment variables that contains data necessary to run the workflow', async () => {
    const project = buildMockProject();
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: '/path/to/project',
        tempDirectory: '/path/to/temp',
        reset: true,
      });
    jest
      .spyOn(envUtils, 'getEnvironmentVariables')
      .mockReturnValue({ TODAY: '2022-06-22', EDITOR: undefined });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);

    const config = await initialize(['arg1', 'arg2'], '/path/to/cwd');

    expect(config).toStrictEqual({
      project,
      tempDirectoryPath: '/path/to/temp',
      reset: true,
      today: new Date('2022-06-22'),
    });
  });

  it('resolves the project directory relative to the current working directory', async () => {
    const project = buildMockProject({
      rootPackage: buildMockPackage('@foo/bar'),
    });
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: 'project',
        tempDirectory: undefined,
        reset: true,
      });
    jest
      .spyOn(envUtils, 'getEnvironmentVariables')
      .mockReturnValue({ TODAY: undefined, EDITOR: undefined });
    const readProjectSpy = jest
      .spyOn(projectUtils, 'readProject')
      .mockResolvedValue(project);

    await initialize(['arg1', 'arg2'], '/path/to/cwd');

    expect(readProjectSpy).toHaveBeenCalledWith('/path/to/cwd/project');
  });

  it('uses a default temporary directory based on the name of the package', async () => {
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
    jest
      .spyOn(envUtils, 'getEnvironmentVariables')
      .mockReturnValue({ TODAY: undefined, EDITOR: undefined });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);

    const config = await initialize(['arg1', 'arg2'], '/path/to/cwd');

    expect(config.tempDirectoryPath).toStrictEqual(
      path.join(os.tmpdir(), 'create-release-branch', '@foo__bar'),
    );
  });

  it('uses the current date if TODAY is undefined', async () => {
    const project = buildMockProject();
    const today = new Date('2022-01-01');
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: '/path/to/project',
        tempDirectory: undefined,
        reset: true,
      });
    jest
      .spyOn(envUtils, 'getEnvironmentVariables')
      .mockReturnValue({ TODAY: undefined, EDITOR: undefined });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);
    jest.setSystemTime(today);

    const config = await initialize(['arg1', 'arg2'], '/path/to/cwd');

    expect(config.today).toStrictEqual(today);
  });

  it('uses the current date if TODAY is not a parsable date', async () => {
    const project = buildMockProject();
    const today = new Date('2022-01-01');
    when(jest.spyOn(inputsUtils, 'readInputs'))
      .calledWith(['arg1', 'arg2'])
      .mockResolvedValue({
        projectDirectory: '/path/to/project',
        tempDirectory: undefined,
        reset: true,
      });
    jest
      .spyOn(envUtils, 'getEnvironmentVariables')
      .mockReturnValue({ TODAY: 'asdfgdasf', EDITOR: undefined });
    when(jest.spyOn(projectUtils, 'readProject'))
      .calledWith('/path/to/project')
      .mockResolvedValue(project);
    jest.setSystemTime(today);

    const config = await initialize(['arg1', 'arg2'], '/path/to/cwd');

    expect(config.today).toStrictEqual(today);
  });
});
