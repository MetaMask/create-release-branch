import type { WriteStream } from 'fs';
import { join } from 'path';
import express from 'express';
import {
  restoreChangelogsForSkippedPackages,
  updateChangelogsForChangedPackages,
  type Project,
} from './project.js';
import { Package } from './package.js';
import {
  findMissingUnreleasedDependenciesForRelease,
  findMissingUnreleasedDependentsForBreakingChanges,
  IncrementableVersionParts,
  ReleaseSpecification,
  validateAllPackageEntries,
} from './release-specification.js';
import { createReleaseBranch } from './workflow-operations.js';
import { commitAllChanges } from './repo.js';
import { SemVer, semver } from './semver.js';
import { executeReleasePlan, planRelease } from './release-plan.js';
import {
  deduplicateDependencies,
  fixConstraints,
  updateYarnLockfile,
} from './yarn-commands.js';
import { readFile } from './fs.js';
import { getCurrentDirectoryPath } from './dirname.js';

const UI_BUILD_DIR = join(getCurrentDirectoryPath(), 'ui');

type UIOptions = {
  project: Project;
  releaseType: 'ordinary' | 'backport';
  defaultBranch: string;
  port: number;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
};

/**
 * Starts the UI for the release process.
 *
 * @param options - The options for the UI.
 * @param options.project - The project object.
 * @param options.releaseType - The type of release.
 * @param options.defaultBranch - The default branch name.
 * @param options.port - The port number for the server.
 * @param options.stdout - The stdout stream.
 * @param options.stderr - The stderr stream.
 */
export async function startUI({
  project,
  releaseType,
  defaultBranch,
  port,
  stdout,
  stderr,
}: UIOptions): Promise<void> {
  const { version: newReleaseVersion, firstRun } = await createReleaseBranch({
    project,
    releaseType,
  });

  if (firstRun) {
    await updateChangelogsForChangedPackages({ project, stderr });
    await commitAllChanges(
      project.directoryPath,
      `Initialize Release ${newReleaseVersion}`,
    );
  }

  const app = createApp({
    project,
    defaultBranch,
    stderr,
    version: newReleaseVersion,
    closeServer: () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      server.close();
      stdout.write('Release process completed. Server shutdown.\n');
    },
  });

  const server = app.listen(port, async () => {
    const url = `http://localhost:${port}`;
    stdout.write(`UI server running at ${url}\n`);
  });

  return new Promise((resolve, reject) => {
    server.on('error', (error) => {
      stderr.write(`Failed to start server: ${error}\n`);
      reject(error);
    });

    server.on('close', () => {
      resolve();
    });
  });
}

/**
 * Creates an Express application for the UI server.
 *
 * @param options - The options for creating the app.
 * @param options.project - The project object.
 * @param options.defaultBranch - The default branch name.
 * @param options.stderr - The stderr stream.
 * @param options.version - The release version.
 * @param options.closeServer - The function to close the server.
 * @returns The Express application.
 */
function createApp({
  project,
  defaultBranch,
  stderr,
  version,
  closeServer,
}: {
  project: Project;
  defaultBranch: string;
  stderr: Pick<WriteStream, 'write'>;
  version: string;
  closeServer: () => void;
}): express.Application {
  const app = express();

  app.use(express.static(UI_BUILD_DIR));
  app.use(express.json());

  app.get('/api/packages', (_req, res) => {
    const pkgs = Object.values(project.workspacePackages).filter(
      (pkg) => pkg.hasChangesSinceLatestRelease,
    );

    const packages = pkgs.map((pkg) => ({
      name: pkg.validatedManifest.name,
      version: pkg.validatedManifest.version.version,
      location: pkg.directoryPath,
    }));

    res.json(packages);
  });

  app.get('/api/changelog', async (req, res) => {
    try {
      const packageName = req.query.package as string;

      const selectedPackage = Object.values(project.workspacePackages).find(
        (pkg) => pkg.validatedManifest.name === packageName,
      ) as Package;

      const changelogContent = await readFile(selectedPackage.changelogPath);

      res.send(changelogContent);
    } catch (error) {
      stderr.write(`Changelog error: ${error}\n`);
      res.status(500).send('Internal Server Error');
    }
  });

  app.post(
    '/api/check-packages',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const releasedPackages: Record<string, string | null> = req.body;

        const errors = Object.entries(releasedPackages).reduce(
          (map, [changedPackageName, versionSpecifierOrDirective]) => {
            const changedPackage =
              project.workspacePackages[changedPackageName];

            const missingDependentNames =
              findMissingUnreleasedDependentsForBreakingChanges(
                project,
                changedPackageName,
                versionSpecifierOrDirective,
                releasedPackages,
              );

            const missingDependencies =
              findMissingUnreleasedDependenciesForRelease(
                project,
                changedPackage,
                versionSpecifierOrDirective,
                releasedPackages,
              );

            if (
              missingDependentNames.length === 0 &&
              missingDependencies.length === 0
            ) {
              return map;
            }

            return {
              ...map,
              [changedPackageName]: {
                missingDependentNames,
                missingDependencies,
              },
            };
          },
          {},
        );

        if (Object.keys(errors).length > 0) {
          res.json({
            status: 'error',
            errors,
          });
          return;
        }

        res.json({ status: 'success' });
      } catch (error) {
        stderr.write(`Release error: ${error}\n`);
        res.status(400).send('Invalid request');
      }
    },
  );

  app.post(
    '/api/release',
    async (req: express.Request, res: express.Response): Promise<void> => {
      try {
        const releasedPackages: Record<string, string | null> = req.body;

        const errors = validateAllPackageEntries(project, releasedPackages, 0);

        if (errors.length > 0) {
          res.json({
            status: 'error',
            errors,
          });
          return;
        }

        const releaseSpecificationPackages = Object.keys(
          releasedPackages,
        ).reduce(
          (obj, packageName) => {
            const versionSpecifierOrDirective = releasedPackages[packageName];

            if (versionSpecifierOrDirective !== 'intentionally-skip') {
              if (
                Object.values(IncrementableVersionParts).includes(
                  versionSpecifierOrDirective as any,
                )
              ) {
                return {
                  ...obj,
                  [packageName]:
                    versionSpecifierOrDirective as IncrementableVersionParts,
                };
              }

              return {
                ...obj,
                [packageName]: semver.parse(
                  versionSpecifierOrDirective,
                ) as SemVer,
              };
            }

            return obj;
          },
          {} as ReleaseSpecification['packages'],
        );

        await restoreChangelogsForSkippedPackages({
          project,
          releaseSpecificationPackages,
          defaultBranch,
        });

        const releasePlan = await planRelease({
          project,
          releaseSpecificationPackages,
          newReleaseVersion: version,
        });
        await executeReleasePlan(project, releasePlan, stderr);
        await fixConstraints(project.directoryPath);
        await updateYarnLockfile(project.directoryPath);
        await deduplicateDependencies(project.directoryPath);
        await commitAllChanges(
          project.directoryPath,
          `Update Release ${version}`,
        );

        res.json({ status: 'success' });

        closeServer();
      } catch (error) {
        stderr.write(`Release error: ${error}\n`);
        res.status(400).send('Invalid request');
      }
    },
  );

  app.get('*', (_req, res) => {
    res.sendFile(join(UI_BUILD_DIR, 'index.html'));
  });

  return app;
}
