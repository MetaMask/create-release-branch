import os from 'os';
import path from 'path';
import { when } from 'jest-when';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { determineInitialParameters } from './initial-parameters';
import * as commandLineArgumentsModule from './command-line-arguments';
import * as projectModule from './project';

jest.mock('./command-line-arguments');
jest.mock('./project');

describe('initial-parameters', () => {
  describe('determineInitialParameters', () => {
    it('returns an object that contains data necessary to run the workflow', async () => {
      const project = buildMockProject();
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['arg1', 'arg2'])
        .mockResolvedValue({
          projectDirectory: '/path/to/project',
          tempDirectory: '/path/to/temp',
          reset: true,
        });
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

    it('uses a default temporary directory based on the name of the package if no such directory was passed as an input', async () => {
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
      when(jest.spyOn(projectModule, 'readProject'))
        .calledWith('/path/to/project')
        .mockResolvedValue(project);

      const config = await determineInitialParameters(
        ['arg1', 'arg2'],
        '/path/to/somewhere',
      );

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
});
