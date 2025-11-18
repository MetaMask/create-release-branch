import fs from 'fs';
import { when } from 'jest-when';
import { buildMockProject } from '../tests/unit/helpers.js';
import { main } from './main.js';
import * as commandLineArgumentsModule from './command-line-arguments.js';
import * as initialParametersModule from './initial-parameters.js';
import * as monorepoWorkflowOperations from './monorepo-workflow-operations.js';
import * as checkDependencyBumpsModule from './check-dependency-bumps.js';
import * as ui from './ui.js';

jest.mock('./command-line-arguments');
jest.mock('./initial-parameters');
jest.mock('./monorepo-workflow-operations');
jest.mock('./check-dependency-bumps');
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
  describe('when command is "release"', () => {
    it('executes the CLI monorepo workflow if the project is a monorepo and interactive is false', async () => {
      const project = buildMockProject({ isMonorepo: true });
      const stdout = fs.createWriteStream('/dev/null');
      const stderr = fs.createWriteStream('/dev/null');
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith([])
        .mockResolvedValue({
          _: ['release'],
          command: 'release',
          projectDirectory: '.',
          reset: true,
          backport: true,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
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
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith([])
        .mockResolvedValue({
          _: ['release'],
          command: 'release',
          projectDirectory: '.',
          reset: true,
          backport: true,
          defaultBranch: 'main',
          interactive: true,
          port: 3000,
        });
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
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith([])
        .mockResolvedValue({
          _: ['release'],
          command: 'release',
          projectDirectory: '.',
          reset: false,
          backport: true,
          defaultBranch: 'main',
          interactive: false,
          port: 3000,
        });
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

  describe('when command is "check-deps"', () => {
    it('calls checkDependencyBumps with all provided options', async () => {
      const stdout = fs.createWriteStream('/dev/null');
      const stderr = fs.createWriteStream('/dev/null');
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['check-deps', '--from', 'abc123', '--fix', '--pr', '1234'])
        .mockResolvedValue({
          _: ['check-deps'],
          command: 'check-deps',
          fromRef: 'abc123',
          toRef: 'HEAD',
          defaultBranch: 'main',
          fix: true,
          pr: '1234',
        });
      const checkDependencyBumpsSpy = jest
        .spyOn(checkDependencyBumpsModule, 'checkDependencyBumps')
        .mockResolvedValue({});

      await main({
        argv: ['check-deps', '--from', 'abc123', '--fix', '--pr', '1234'],
        cwd: '/path/to/project',
        stdout,
        stderr,
      });

      expect(checkDependencyBumpsSpy).toHaveBeenCalledWith({
        fromRef: 'abc123',
        toRef: 'HEAD',
        defaultBranch: 'main',
        fix: true,
        prNumber: '1234',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });
    });

    it('calls checkDependencyBumps with default options when optionals are not provided', async () => {
      const stdout = fs.createWriteStream('/dev/null');
      const stderr = fs.createWriteStream('/dev/null');
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['check-deps'])
        .mockResolvedValue({
          _: ['check-deps'],
          command: 'check-deps',
          toRef: 'HEAD',
          defaultBranch: 'main',
        });
      const checkDependencyBumpsSpy = jest
        .spyOn(checkDependencyBumpsModule, 'checkDependencyBumps')
        .mockResolvedValue({});

      await main({
        argv: ['check-deps'],
        cwd: '/path/to/project',
        stdout,
        stderr,
      });

      expect(checkDependencyBumpsSpy).toHaveBeenCalledWith({
        toRef: 'HEAD',
        defaultBranch: 'main',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });
    });

    it('calls checkDependencyBumps with custom toRef when provided', async () => {
      const stdout = fs.createWriteStream('/dev/null');
      const stderr = fs.createWriteStream('/dev/null');
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['check-deps', '--to', 'feature-branch'])
        .mockResolvedValue({
          _: ['check-deps'],
          command: 'check-deps',
          toRef: 'feature-branch',
          defaultBranch: 'main',
        });
      const checkDependencyBumpsSpy = jest
        .spyOn(checkDependencyBumpsModule, 'checkDependencyBumps')
        .mockResolvedValue({});

      await main({
        argv: ['check-deps', '--to', 'feature-branch'],
        cwd: '/path/to/project',
        stdout,
        stderr,
      });

      expect(checkDependencyBumpsSpy).toHaveBeenCalledWith({
        toRef: 'feature-branch',
        defaultBranch: 'main',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });
    });

    it('calls checkDependencyBumps with custom defaultBranch when provided', async () => {
      const stdout = fs.createWriteStream('/dev/null');
      const stderr = fs.createWriteStream('/dev/null');
      when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
        .calledWith(['check-deps', '--default-branch', 'develop'])
        .mockResolvedValue({
          _: ['check-deps'],
          command: 'check-deps',
          toRef: 'HEAD',
          defaultBranch: 'develop',
        });
      const checkDependencyBumpsSpy = jest
        .spyOn(checkDependencyBumpsModule, 'checkDependencyBumps')
        .mockResolvedValue({});

      await main({
        argv: ['check-deps', '--default-branch', 'develop'],
        cwd: '/path/to/project',
        stdout,
        stderr,
      });

      expect(checkDependencyBumpsSpy).toHaveBeenCalledWith({
        toRef: 'HEAD',
        defaultBranch: 'develop',
        projectRoot: '/path/to/project',
        stdout,
        stderr,
      });
    });
  });
});
