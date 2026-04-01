import fs from 'fs';
import { when } from 'jest-when';
import path from 'path';
import { MockWritable } from 'stdio-mock';

import { determineEditor } from './editor.js';
import type { Editor } from './editor.js';
import { followMonorepoWorkflow } from './monorepo-workflow-operations.js';
import { Project } from './project.js';
import { executeReleasePlan, planRelease } from './release-plan.js';
import type { ReleasePlan } from './release-plan.js';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification.js';
import type { ReleaseSpecification } from './release-specification.js';
import { commitAllChanges } from './repo.js';
import * as workflowOperationsModule from './workflow-operations.js';
import {
  deduplicateDependencies,
  fixConstraints,
  updateYarnLockfile,
} from './yarn-commands.js';
import { withSandbox, Sandbox, isErrorWithCode } from '../tests/helpers.js';
import { buildMockProject, Require } from '../tests/unit/helpers.js';

jest.mock('./editor');
jest.mock('./release-plan');
jest.mock('./release-specification');
jest.mock('./repo');
jest.mock('./yarn-commands.js');

const determineEditorMock = jest.mocked(determineEditor);
const generateReleaseSpecificationTemplateForMonorepoMock = jest.mocked(
  generateReleaseSpecificationTemplateForMonorepo,
);
const waitForUserToEditReleaseSpecificationMock = jest.mocked(
  waitForUserToEditReleaseSpecification,
);
const validateReleaseSpecificationMock = jest.mocked(
  validateReleaseSpecification,
);
const planReleaseMock = jest.mocked(planRelease);
const executeReleasePlanMock = jest.mocked(executeReleasePlan);
const commitAllChangesMock = jest.mocked(commitAllChanges);
const fixConstraintsMock = jest.mocked(fixConstraints);
const updateYarnLockfileMock = jest.mocked(updateYarnLockfile);
const deduplicateDependenciesMock = jest.mocked(deduplicateDependencies);

/**
 * Tests the given path to determine whether it represents a file.
 *
 * @param entryPath - The path to a file (or directory) on the filesystem.
 * @returns A promise for true if the file exists or false otherwise.
 */
async function fileExists(entryPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(entryPath);
    return stats.isFile();
  } catch (error) {
    if (isErrorWithCode(error) && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
}

/**
 * Builds a release specification object for use in tests. All properties have
 * default values, so you can specify only the properties you care about.
 *
 * @param overrides - The properties you want to override in the mock release
 * specification.
 * @param overrides.packages - A mapping of package names to version specifiers.
 * @param overrides.path - The path to the original release specification file.
 * @returns The mock release specification.
 */
function buildMockReleaseSpecification({
  packages = {},
  path: releaseSpecificationPath,
}: Require<Partial<ReleaseSpecification>, 'path'>): ReleaseSpecification {
  return { packages, path: releaseSpecificationPath };
}

/**
 * Builds a release plan object for use in tests. All properties have
 * default values, so you can specify only the properties you care about.
 *
 * @param overrides - The properties you want to override in the mock release
 * plan.
 * @param overrides.newVersion - The new version that should be released,
 * encompassing one or more updates to packages within the project. This is
 * always a SemVer-compatible string, though the meaning of each number depends
 * on the type of project. For a polyrepo package or a monorepo with fixed
 * versions, the format of the version string is "MAJOR.MINOR.PATCH"; for a
 * monorepo with independent versions, it is "ORDINARY.BACKPORT.0", where
 * `BACKPORT` is used to name a release that sits between two ordinary releases,
 * and `ORDINARY` is used to name any other (non-backport) release.
 * @param overrides.packages - Describes how the packages in the project should
 * be updated. For a polyrepo package, this list will only contain the package
 * itself; for a monorepo package it will consist of the root package and any
 * workspace packages that will be included in the release.
 * @returns The mock release specification.
 */
function buildMockReleasePlan({
  newVersion = '1.0.0',
  packages = [],
}: Partial<ReleasePlan> = {}): ReleasePlan {
  return { newVersion, packages };
}

/**
 * Builds an editor object for use in tests. All properties have default values,
 * so you can specify only the properties you care about.
 *
 * @param overrides - The properties you want to override in the mock editor.
 * @param overrides.path - The path to the executable representing the editor.
 * @param overrides.args - Command-line arguments to pass to the executable when
 * calling it.
 * @returns The mock editor.
 */
function buildMockEditor({
  path: editorPath = '/some/editor',
  args = [],
}: Partial<Editor> = {}): Editor {
  return { path: editorPath, args };
}

/**
 * Sets up an invocation of `followMonorepoWorkflow` so that a particular
 * branch of logic within its implementation will be followed.
 *
 * @param args - The arguments.
 * @param args.sandbox - The sandbox.
 * @param args.doesReleaseSpecFileExist - Whether the release spec file should
 * be created.
 * @param args.isEditorAvailable - Whether `determineEditor` should return an
 * editor object.
 * @param args.errorUponEditingReleaseSpec - The error that
 * `waitForUserToEditReleaseSpecification` will throw.
 * @param args.errorUponValidatingReleaseSpec - The error that
 * `validateReleaseSpecification` will throw.
 * @param args.errorUponPlanningRelease - The error that `planRelease` will
 * throw.
 * @param args.errorUponExecutingReleasePlan - The error that
 * `executeReleasePlan` will throw.
 * @param args.releaseVersion - The new version that the release plan will
 * contain.
 * @returns Mock functions and other data that can be used in tests to make
 * assertions.
 */
async function setupFollowMonorepoWorkflow({
  sandbox,
  doesReleaseSpecFileExist,
  isEditorAvailable = false,
  errorUponEditingReleaseSpec,
  errorUponValidatingReleaseSpec,
  errorUponPlanningRelease,
  errorUponExecutingReleasePlan,
  releaseVersion = '1.0.0',
}: {
  sandbox: Sandbox;
  doesReleaseSpecFileExist: boolean;
  isEditorAvailable?: boolean;
  errorUponEditingReleaseSpec?: Error;
  errorUponValidatingReleaseSpec?: Error;
  errorUponPlanningRelease?: Error;
  errorUponExecutingReleasePlan?: Error;
  releaseVersion?: string;
}): Promise<{
  project: Project;
  projectDirectoryPath: string;
  stdout: MockWritable;
  stderr: MockWritable;
  releaseSpecification: ReleaseSpecification;
  releasePlan: ReleasePlan;
  releaseVersion: string;
  releaseSpecificationPath: string;
}> {
  const editor = buildMockEditor();
  const releaseSpecificationPath = path.join(
    sandbox.directoryPath,
    'RELEASE_SPEC.yml',
  );
  const releaseSpecification = buildMockReleaseSpecification({
    path: releaseSpecificationPath,
  });
  const releasePlan = buildMockReleasePlan({ newVersion: releaseVersion });
  const projectDirectoryPath = '/path/to/project';
  const project = buildMockProject({ directoryPath: projectDirectoryPath });
  const stdout = new MockWritable();
  const stderr = new MockWritable();
  determineEditorMock.mockResolvedValue(isEditorAvailable ? editor : null);
  when(generateReleaseSpecificationTemplateForMonorepoMock)
    .calledWith({ project, isEditorAvailable })
    .mockResolvedValue('');

  if (errorUponEditingReleaseSpec) {
    when(waitForUserToEditReleaseSpecificationMock)
      .calledWith(releaseSpecificationPath, editor)
      .mockRejectedValue(errorUponEditingReleaseSpec);
  } else {
    when(waitForUserToEditReleaseSpecificationMock)
      .calledWith(releaseSpecificationPath, editor)
      .mockResolvedValue();
  }

  if (errorUponValidatingReleaseSpec) {
    when(validateReleaseSpecificationMock)
      .calledWith(project, releaseSpecificationPath)
      .mockRejectedValue(errorUponValidatingReleaseSpec);
  } else {
    when(validateReleaseSpecificationMock)
      .calledWith(project, releaseSpecificationPath)
      .mockResolvedValue(releaseSpecification);
  }

  if (errorUponPlanningRelease) {
    when(planReleaseMock)
      .calledWith({
        project,
        releaseSpecificationPackages: releaseSpecification.packages,
        newReleaseVersion: releaseVersion,
      })
      .mockRejectedValue(errorUponPlanningRelease);
  } else {
    when(planReleaseMock)
      .calledWith({
        project,
        releaseSpecificationPackages: releaseSpecification.packages,
        newReleaseVersion: releaseVersion,
      })
      .mockResolvedValue(releasePlan);
  }

  if (errorUponExecutingReleasePlan) {
    when(executeReleasePlanMock)
      .calledWith(project, releasePlan, stderr)
      .mockRejectedValue(errorUponExecutingReleasePlan);
  } else {
    when(executeReleasePlanMock)
      .calledWith(project, releasePlan, stderr)
      .mockResolvedValue(undefined);
  }

  when(commitAllChangesMock)
    .calledWith(projectDirectoryPath, '')
    .mockResolvedValue();

  if (doesReleaseSpecFileExist) {
    await fs.promises.writeFile(
      releaseSpecificationPath,
      'some release specification',
    );
  }

  return {
    project,
    projectDirectoryPath,
    stdout,
    stderr,
    releaseSpecification,
    releasePlan,
    releaseVersion,
    releaseSpecificationPath,
  };
}

describe('monorepo-workflow-operations', () => {
  describe('followMonorepoWorkflow', () => {
    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, and an editor is available', () => {
      it('should call createReleaseBranch with the correct arguments if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const createReleaseBranchMock = jest.spyOn(
            workflowOperationsModule,
            'createReleaseBranch',
          );
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(createReleaseBranchMock).toHaveBeenCalledWith({
            project,
            releaseType: 'ordinary',
          });
        });
      });

      it('should call createReleaseBranch with the correct arguments if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const createReleaseBranchMock = jest.spyOn(
            workflowOperationsModule,
            'createReleaseBranch',
          );
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'backport',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(createReleaseBranchMock).toHaveBeenCalledWith({
            project,
            releaseType: 'backport',
          });
        });
      });

      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '2.0.0',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'backport',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '1.1.0',
          });
        });
      });

      it('follows the workflow correctly when executed twice', async () => {
        await withSandbox(async (sandbox) => {
          const releaseVersion = '1.1.0';
          const createReleaseBranchMock = jest.spyOn(
            workflowOperationsModule,
            'createReleaseBranch',
          );
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              releaseVersion,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          createReleaseBranchMock.mockResolvedValueOnce({
            version: releaseVersion,
            firstRun: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(createReleaseBranchMock).toHaveBeenCalledTimes(1);
          expect(createReleaseBranchMock).toHaveBeenLastCalledWith({
            project,
            releaseType: 'ordinary',
          });

          expect(commitAllChangesMock).toHaveBeenCalledTimes(2);
          expect(commitAllChangesMock).toHaveBeenNthCalledWith(
            1,
            projectDirectoryPath,
            `Initialize Release ${releaseVersion}`,
          );
          expect(commitAllChangesMock).toHaveBeenNthCalledWith(
            2,
            projectDirectoryPath,
            `Update Release ${releaseVersion}`,
          );

          expect(fixConstraintsMock).toHaveBeenCalledTimes(1);
          expect(fixConstraintsMock).toHaveBeenCalledWith(projectDirectoryPath);

          expect(updateYarnLockfileMock).toHaveBeenCalledTimes(1);
          expect(updateYarnLockfileMock).toHaveBeenCalledWith(
            projectDirectoryPath,
          );

          expect(deduplicateDependenciesMock).toHaveBeenCalledTimes(1);
          expect(deduplicateDependenciesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
          );

          // Second call of followMonorepoWorkflow

          createReleaseBranchMock.mockResolvedValueOnce({
            version: releaseVersion,
            firstRun: false, // It's no longer the first run
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(createReleaseBranchMock).toHaveBeenCalledTimes(2);
          expect(createReleaseBranchMock).toHaveBeenLastCalledWith({
            project,
            releaseType: 'ordinary',
          });

          expect(commitAllChangesMock).toHaveBeenCalledTimes(3);
          expect(commitAllChangesMock).toHaveBeenNthCalledWith(
            3,
            projectDirectoryPath,
            `Update Release ${releaseVersion}`,
          );
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releasePlan } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              releaseVersion: '2.0.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('should make exactly two commits named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              releaseVersion: '4.38.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Initialize Release 2.0.0',
          );

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file after editing, validating, and executing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the final release update commit when release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Initialize Release 2.0.0',
          );
          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file even if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws an error produced while editing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while validating the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponValidatingReleaseSpec = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponValidatingReleaseSpec,
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponValidatingReleaseSpec);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while planning the release', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponPlanningRelease = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponPlanningRelease,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponPlanningRelease);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while executing the release plan', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponExecutingReleasePlan = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponExecutingReleasePlan,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponExecutingReleasePlan);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, and an editor is not available', () => {
      it('does not attempt to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the release update commit', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(stdout.data()[0]).toMatch(
            /^A template has been generated that specifies this release/u,
          );
        });
      });

      it('does not remove the generated release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false and the release spec file already exists', () => {
      it('does not open the editor', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(
            waitForUserToEditReleaseSpecificationMock,
          ).not.toHaveBeenCalled();
        });
      });

      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '2.0.0',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'backport',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '1.1.0',
          });
        });
      });

      it('attempts to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releasePlan } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              releaseVersion: '2.0.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('should make exactly two commits named after the generated release version if validating and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              releaseVersion: '4.38.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Initialize Release 2.0.0',
          );

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file after validating and executing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not remove the generated release spec file if an error is thrown while validating the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponValidatingReleaseSpec = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              errorUponValidatingReleaseSpec,
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponValidatingReleaseSpec);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if an error is thrown while planning the release', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponPlanningRelease = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              errorUponPlanningRelease,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponPlanningRelease);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if an error is thrown while executing the release plan', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponExecutingReleasePlan = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              errorUponExecutingReleasePlan,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponExecutingReleasePlan);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file does not already exist, and an editor is available', () => {
      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '2.0.0',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'backport',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '1.1.0',
          });
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releasePlan } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              releaseVersion: '2.0.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('should make exactly two commits named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              releaseVersion: '4.38.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Initialize Release 2.0.0',
          );

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file after editing, validating, and executing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the release update commit if the release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file even if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws an error produced while editing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while validating the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponValidatingReleaseSpec = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponValidatingReleaseSpec,
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponValidatingReleaseSpec);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while planning the release', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponPlanningRelease = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponPlanningRelease,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponPlanningRelease);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while executing the release plan', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponExecutingReleasePlan = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponExecutingReleasePlan,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponExecutingReleasePlan);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file does not already exist, and an editor is not available', () => {
      it('does not attempt to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the release update commit', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(stdout.data()[0]).toMatch(
            /^A template has been generated that specifies this release/u,
          );
        });
      });

      it('does not remove the generated release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file already exists, and an editor is available', () => {
      it('generates a new release spec instead of using the existing one', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(
            generateReleaseSpecificationTemplateForMonorepoMock,
          ).toHaveBeenCalledWith({
            project,
            isEditorAvailable: true,
          });
        });
      });

      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '2.0.0',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecification } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'backport',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(planReleaseMock).toHaveBeenCalledWith({
            project,
            releaseSpecificationPackages: releaseSpecification.packages,
            newReleaseVersion: '1.1.0',
          });
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releasePlan } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              releaseVersion: '2.0.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('should make exactly two commits named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              releaseVersion: '4.38.0',
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Initialize Release 2.0.0',
          );

          expect(commitAllChangesMock).toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file after editing, validating, and executing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the release update commit if the release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('removes the release spec file even if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws an error produced while editing the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: new Error('oops'),
            },
          );

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while validating the release spec', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponValidatingReleaseSpec = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponValidatingReleaseSpec,
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponValidatingReleaseSpec);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while planning the release', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponPlanningRelease = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponPlanningRelease,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponPlanningRelease);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });

      it('does not remove the generated release spec file if it was successfully edited but an error is thrown while executing the release plan', async () => {
        await withSandbox(async (sandbox) => {
          const errorUponExecutingReleasePlan = new Error('oops');
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponExecutingReleasePlan,
              releaseVersion: '2.0.0',
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
              defaultBranch: 'main',
              stdout,
              stderr,
            }),
          ).rejects.toThrow(errorUponExecutingReleasePlan);

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file already exists, and an editor is not available', () => {
      it('generates a new release spec instead of using the existing one', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(
            generateReleaseSpecificationTemplateForMonorepoMock,
          ).toHaveBeenCalledWith({
            project,
            isEditorAvailable: false,
          });
        });
      });

      it('does not attempt to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(executeReleasePlanMock).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to make the release update commit', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, projectDirectoryPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(commitAllChangesMock).not.toHaveBeenCalledWith(
            projectDirectoryPath,
            'Update Release 2.0.0',
          );
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr } = await setupFollowMonorepoWorkflow(
            {
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            },
          );

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(stdout.data()[0]).toMatch(
            /^A template has been generated that specifies this release/u,
          );
        });
      });

      it('does not remove the generated release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            defaultBranch: 'main',
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });
  });
});
