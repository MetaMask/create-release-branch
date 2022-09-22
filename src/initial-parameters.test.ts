import os from 'os';
import path from 'path';
import { when } from 'jest-when';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { determineInitialParameters } from './initial-parameters';
import * as commandLineArgumentsModule from './command-line-arguments';
import * as envModule from './env';
import * as projectModule from './project';

jest.mock('./command-line-arguments');
jest.mock('./env');
jest.mock('./project');

describe('initial-parameters', () => {
  describe('determineInitialParameters', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns an object derived from command-line arguments and environment variables that contains data necessary to run the workflow', async () => {
      const project = buildMockProject();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: true,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/somewhere',
      );

      expect(config).toStrictEqual({
        project,
        tempDirectoryPath: '/path/to/temp',
        reset: true,
      });
    });

    it('resolves the given project directory relative to the current working directory', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage(),
      });
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: 'project',
          tempDirectory: undefined,
          reset: true,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      const readProjectSpy = jest
        .spyOn(projectModule, 'readProject')
        .mockResolvedValue(project);

      await determineInitialParameters(['arg1', 'arg2'], '/path/to/cwd');

      expect(readProjectSpy).toHaveBeenCalledWith('/path/to/cwd/project');
    });

    it('resolves the given temporary directory relative to the current working directory', async () => {
      const project = buildMockProject();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: 'tmp',
          reset: true,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/cwd',
      );

      expect(config.tempDirectoryPath).toStrictEqual('/path/to/cwd/tmp');
    });

    it('uses a default temporary directory based on the name of the package if no temporary directory was given', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('@foo/bar'),
      });
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: undefined,
          reset: true,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/cwd',
      );

      expect(config.tempDirectoryPath).toStrictEqual(
        path.join(os.tmpdir(), 'create-release-branch', '@foo__bar'),
      );
    });

    it('returns initial parameters including reset: true, derived from a command-line argument of "--reset true"', async () => {
      const project = buildMockProject();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: true,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/somewhere',
      );

      expect(config.reset).toBe(true);
    });

    it('returns initial parameters including reset: false, derived from a command-line argument of "--reset false"', async () => {
      const project = buildMockProject();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: false,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/somewhere',
      );

      expect(config.reset).toBe(false);
    });
  });
});
