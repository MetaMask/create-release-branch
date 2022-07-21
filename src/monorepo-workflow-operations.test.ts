import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { MockWritable } from 'stdio-mock';
import { withSandbox, Sandbox, isErrorWithCode } from '../tests/helpers';
import { buildMockProject, Require } from '../tests/unit/helpers';
import { followMonorepoWorkflow } from './monorepo-workflow-operations';
import * as editorModule from './editor';
import type { Editor } from './editor';
import * as releaseSpecificationModule from './release-specification';
import type { ReleaseSpecification } from './release-specification';
import * as releasePlanModule from './release-plan';
import type { ReleasePlan } from './release-plan';
import * as repoModule from './repo';

jest.mock('./editor');
jest.mock('./release-plan');
jest.mock('./release-specification');
jest.mock('./repo');

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
 * Mocks the dependencies for `followMonorepoWorkflow`.
 *
 * @returns The corresponding mock functions for each of the dependencies.
 */
function getDependencySpies() {
  return {
    determineEditorSpy: jest.spyOn(editorModule, 'determineEditor'),
    generateReleaseSpecificationTemplateForMonorepoSpy: jest.spyOn(
      releaseSpecificationModule,
      'generateReleaseSpecificationTemplateForMonorepo',
    ),
    waitForUserToEditReleaseSpecificationSpy: jest.spyOn(
      releaseSpecificationModule,
      'waitForUserToEditReleaseSpecification',
    ),
    validateReleaseSpecificationSpy: jest.spyOn(
      releaseSpecificationModule,
      'validateReleaseSpecification',
    ),
    planReleaseSpy: jest.spyOn(releasePlanModule, 'planRelease'),
    executeReleasePlanSpy: jest.spyOn(releasePlanModule, 'executeReleasePlan'),
    captureChangesInReleaseBranchSpy: jest.spyOn(
      repoModule,
      'captureChangesInReleaseBranch',
    ),
  };
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
 * @param overrides.releaseName - The name of the new release. For a polyrepo or
 * a monorepo with fixed versions, this will be a version string with the shape
 * `<major>.<minor>.<patch>`; for a monorepo with independent versions, this
 * will be a version string with the shape `<year>.<month>.<day>-<build
 * number>`.
 * @param overrides.packages - Information about all of the packages in the
 * project. For a polyrepo, this consists of the self-same package; for a
 * monorepo it consists of the root package and any workspace packages.
 * @returns The mock release specification.
 */
function buildMockReleasePlan({
  releaseName = 'release-name',
  packages = [],
}: Partial<ReleasePlan> = {}): ReleasePlan {
  return { releaseName, packages };
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
 * `waitForUserToEditReleaseSpecification` will throw, or null/undefined if it
 * should not throw.
 * @returns Mock functions and other data that can be used in tests to make
 * assertions.
 */
async function setupFollowMonorepoWorkflow({
  sandbox,
  doesReleaseSpecFileExist,
  isEditorAvailable = false,
  errorUponEditingReleaseSpec = null,
}: {
  sandbox: Sandbox;
  doesReleaseSpecFileExist: boolean;
  isEditorAvailable?: boolean;
  errorUponEditingReleaseSpec?: Error | null;
}) {
  const {
    determineEditorSpy,
    generateReleaseSpecificationTemplateForMonorepoSpy,
    waitForUserToEditReleaseSpecificationSpy,
    validateReleaseSpecificationSpy,
    planReleaseSpy,
    executeReleasePlanSpy,
    captureChangesInReleaseBranchSpy,
  } = getDependencySpies();
  const editor = buildMockEditor();
  const releaseSpecificationPath = path.join(
    sandbox.directoryPath,
    'RELEASE_SPEC',
  );
  const releaseSpecification = buildMockReleaseSpecification({
    path: releaseSpecificationPath,
  });
  const releaseName = 'some-release-name';
  const releasePlan = buildMockReleasePlan({ releaseName });
  const projectDirectoryPath = '/path/to/project';
  const project = buildMockProject({ directoryPath: projectDirectoryPath });
  const today = new Date();
  const stdout = new MockWritable();
  const stderr = new MockWritable();
  determineEditorSpy.mockResolvedValue(isEditorAvailable ? editor : null);
  when(generateReleaseSpecificationTemplateForMonorepoSpy)
    .calledWith({ project, isEditorAvailable })
    .mockResolvedValue('');

  if (errorUponEditingReleaseSpec) {
    when(waitForUserToEditReleaseSpecificationSpy)
      .calledWith(releaseSpecificationPath, editor)
      .mockRejectedValue(errorUponEditingReleaseSpec);
  } else {
    when(waitForUserToEditReleaseSpecificationSpy)
      .calledWith(releaseSpecificationPath, editor)
      .mockResolvedValue();
  }

  when(validateReleaseSpecificationSpy)
    .calledWith(project, releaseSpecificationPath)
    .mockResolvedValue(releaseSpecification);
  when(planReleaseSpy)
    .calledWith({ project, releaseSpecification, today })
    .mockResolvedValue(releasePlan);
  executeReleasePlanSpy.mockResolvedValue();
  captureChangesInReleaseBranchSpy.mockResolvedValue();

  if (doesReleaseSpecFileExist) {
    await fs.promises.writeFile(
      releaseSpecificationPath,
      'some release specification',
    );
  }

  return {
    project,
    projectDirectoryPath,
    today,
    stdout,
    stderr,
    executeReleasePlanSpy,
    captureChangesInReleaseBranchSpy,
    releasePlan,
    releaseName,
    releaseSpecificationPath,
  };
}

describe('monorepo-workflow-operations', () => {
  describe('followMonorepoWorkflow', () => {
    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, an editor is available, and editing will succeed', () => {
      it('executes the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('creates a new branch named after the generated release version', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
            releaseName,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            releaseName,
          );
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, an editor is available, and editing will not succeed', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws the error', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
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
              today,
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, and an editor is not available', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: false,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(stdout.data()[0]).toMatch(
            /^A template has been generated that specifies this release/u,
          );
        });
      });

      it('does not remove the release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false and the release spec file already exists', () => {
      it('executes the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('creates a new branch named after the generated release version', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
            releaseName,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            releaseName,
          );
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not remove the release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file does not already exist, an editor is available, and editing will succeed', () => {
      it('executes the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('creates a new branch named after the generated release version', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
            releaseName,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            releaseName,
          );
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file does not already exist, an editor is available, and editing will not succeed', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws the error', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
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
              today,
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file does not already exist, and an editor is not available', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: false,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(stdout.data()[0]).toMatch(
            /^A template has been generated that specifies this release/u,
          );
        });
      });

      it('does not remove the release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: false,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file already exists, an editor is available, and editing will succeed', () => {
      it('executes the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).toHaveBeenCalledWith(
            project,
            releasePlan,
            stderr,
          );
        });
      });

      it('creates a new branch named after the generated release version', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
            releaseName,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
            errorUponEditingReleaseSpec: null,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            releaseName,
          );
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: true,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file already exists, an editor is available, and editing will not succeed', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('removes the release spec file at the end', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
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
              today,
              stdout,
              stderr,
            }),
          ).toBeRejected();

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('throws the error', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
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
              today,
              stdout,
              stderr,
            }),
          ).rejects.toThrow('oops');
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is true, the release spec file already exists, and an editor is not available', () => {
      it('does not try to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, executeReleasePlanSpy } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not try to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            today,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: false,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
        });
      });

      it('prints a message', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(stdout.data()).toMatchObject([
            /^A template has been generated that specifies this release/u,
          ]);
        });
      });

      it('does not remove the release spec file', async () => {
        await withSandbox(async (sandbox) => {
          const { project, today, stdout, stderr, releaseSpecificationPath } =
            await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: true,
              isEditorAvailable: false,
              errorUponEditingReleaseSpec: null,
            });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            today,
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });
  });
});
