import type { Server } from 'http';
import type express from 'express';
import { MockWritable } from 'stdio-mock';
import { buildMockPackage, buildMockProject } from '../tests/unit/helpers.js';
import { createApp } from './ui.js';
import * as projectModule from './project.js';
import * as releasePlanModule from './release-plan.js';
import * as repoModule from './repo.js';
import * as yarnCommands from './yarn-commands.js';

jest.mock('./project');
jest.mock('./release-plan');
jest.mock('./repo');
jest.mock('./yarn-commands');
jest.mock('./dirname', () => ({
  getCurrentDirectoryPath: jest.fn().mockReturnValue('/path/to/somewhere'),
}));
jest.mock('open', () => ({
  __esModule: true,
  default: jest.fn(),
}));

async function withServer(
  app: express.Application,
  callback: (url: string) => Promise<void>,
) {
  let server: Server;
  const url = await new Promise<string>((resolve, reject) => {
    server = app.listen(0, () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('Unable to determine server port'));
        return;
      }

      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  try {
    await callback(url);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

describe('ui', () => {
  describe('createApp', () => {
    it('squashes the initial release commit before committing an interactive first run', async () => {
      const project = buildMockProject({
        directoryPath: '/path/to/project',
        workspacePackages: {
          '@scope/a': buildMockPackage('@scope/a', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });
      const releasePlan = { newVersion: '2.0.0', packages: [] };
      const stderr = new MockWritable();
      const closeServer = jest.fn();
      const resetLastCommitSpy = jest.spyOn(repoModule, 'resetLastCommit');
      const commitAllChangesSpy = jest.spyOn(repoModule, 'commitAllChanges');
      jest.spyOn(releasePlanModule, 'planRelease').mockResolvedValue(releasePlan);
      jest.spyOn(releasePlanModule, 'executeReleasePlan').mockResolvedValue();

      const app = createApp({
        project,
        defaultBranch: 'main',
        formatter: 'prettier',
        stderr,
        version: '2.0.0',
        firstRun: true,
        closeServer,
      });

      await withServer(app, async (url) => {
        const response = await fetch(`${url}/api/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ '@scope/a': 'major' }),
        });

        expect(response.ok).toBe(true);
        await expect(response.json()).resolves.toStrictEqual({
          status: 'success',
        });
      });

      expect(
        projectModule.restoreChangelogsForSkippedPackages,
      ).toHaveBeenCalledWith({
        project,
        releaseSpecificationPackages: { '@scope/a': 'major' },
        defaultBranch: 'main',
      });
      expect(yarnCommands.fixConstraints).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(yarnCommands.updateYarnLockfile).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(yarnCommands.deduplicateDependencies).toHaveBeenCalledWith(
        project.directoryPath,
      );
      expect(resetLastCommitSpy).toHaveBeenCalledWith(project.directoryPath);
      expect(commitAllChangesSpy).toHaveBeenCalledTimes(1);
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
      );
      expect(resetLastCommitSpy.mock.invocationCallOrder[0]).toBeLessThan(
        commitAllChangesSpy.mock.invocationCallOrder[0],
      );
      expect(closeServer).toHaveBeenCalledTimes(1);
    });

    it('does not reset HEAD before committing an existing interactive release branch', async () => {
      const project = buildMockProject({
        directoryPath: '/path/to/project',
        workspacePackages: {
          '@scope/a': buildMockPackage('@scope/a', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });
      const releasePlan = { newVersion: '2.0.0', packages: [] };
      const stderr = new MockWritable();
      const closeServer = jest.fn();
      const resetLastCommitSpy = jest.spyOn(repoModule, 'resetLastCommit');
      const commitAllChangesSpy = jest.spyOn(repoModule, 'commitAllChanges');
      jest.spyOn(releasePlanModule, 'planRelease').mockResolvedValue(releasePlan);
      jest.spyOn(releasePlanModule, 'executeReleasePlan').mockResolvedValue();

      const app = createApp({
        project,
        defaultBranch: 'main',
        formatter: 'prettier',
        stderr,
        version: '2.0.0',
        firstRun: false,
        closeServer,
      });

      await withServer(app, async (url) => {
        const response = await fetch(`${url}/api/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ '@scope/a': 'major' }),
        });

        expect(response.ok).toBe(true);
      });

      expect(resetLastCommitSpy).not.toHaveBeenCalled();
      expect(commitAllChangesSpy).toHaveBeenCalledWith(
        project.directoryPath,
        'Release 2.0.0',
      );
    });
  });
});
