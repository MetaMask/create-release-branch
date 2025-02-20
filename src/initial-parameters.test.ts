import os from 'os';
import path from 'path';
import { when } from 'jest-when';
import {
  buildMockProject,
  buildMockPackage,
  createNoopWriteStream,
} from '../tests/unit/helpers.js';
import { determineInitialParameters } from './initial-parameters.js';
import * as commandLineArgumentsModule from './command-line-arguments.js';
import * as envModule from './env.js';
import * as projectModule from './project.js';

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
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: true,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/somewhere',
        stderr,
      });

      expect(initialParameters).toStrictEqual({
        project,
        tempDirectoryPath: '/path/to/temp',
        reset: true,
        releaseType: 'ordinary',
        defaultBranch: 'main',
        interactive: false,
        port: 3000,
      });
    });

    it('resolves the given project directory relative to the current working directory', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage(),
      });
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: 'project',
          tempDirectory: undefined,
          reset: true,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      const readProjectSpy = jest
        .spyOn(projectModule, 'readProject')
        .mockResolvedValue(project);

      await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/cwd',
        stderr,
      });

      expect(readProjectSpy).toHaveBeenCalledWith('/path/to/cwd/project', {
        stderr,
      });
    });

    it('resolves the given temporary directory relative to the current working directory', async () => {
      const project = buildMockProject();
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: 'tmp',
          reset: true,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/cwd',
        stderr,
      });

      expect(initialParameters.tempDirectoryPath).toBe('/path/to/cwd/tmp');
    });

    it('uses a default temporary directory based on the name of the package if no temporary directory was given', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('@foo/bar'),
      });
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: undefined,
          reset: true,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/cwd',
        stderr,
      });

      expect(initialParameters.tempDirectoryPath).toStrictEqual(
        path.join(os.tmpdir(), 'create-release-branch', '@foo__bar'),
      );
    });

    it('returns initial parameters including reset: true, derived from a command-line argument of "--reset true"', async () => {
      const project = buildMockProject();
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: true,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/somewhere',
        stderr,
      });

      expect(initialParameters.reset).toBe(true);
    });

    it('returns initial parameters including reset: false, derived from a command-line argument of "--reset false"', async () => {
      const project = buildMockProject();
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: false,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/somewhere',
        stderr,
      });

      expect(initialParameters.reset).toBe(false);
    });

    it('returns initial parameters including a releaseType of "backport", derived from a command-line argument of "--backport true"', async () => {
      const project = buildMockProject();
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: false,
          backport: true,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/somewhere',
        stderr,
      });

      expect(initialParameters.releaseType).toBe('backport');
    });

    it('returns initial parameters including a releaseType of "ordinary", derived from a command-line argument of "--backport false"', async () => {
      const project = buildMockProject();
      const stderr = createNoopWriteStream();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: false,
          backport: false,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project', { stderr })
        .mockResolvedValue(project);

      const initialParameters = await determineInitialParameters({
        argv: ['arg1', 'arg2'],
        cwd: '/path/to/somewhere',
        stderr,
      });

      expect(initialParameters.releaseType).toBe('ordinary');
    });
  });
});
