import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { MockWritable } from 'stdio-mock';
import { withSandbox, Sandbox, isErrorWithCode } from '../tests/helpers';
import { buildMockProject, Require } from '../tests/unit/helpers';
import { followMonorepoWorkflow } from './monorepo-workflow-operations';
import * as editorModule from './editor';
import type { Editor } from './editor';
import { ReleaseType } from './initial-parameters';
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
 * @param args.releaseType - The type of release.
 * @param args.editorPath - Mocked path to the editor binary.
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
  releaseType = 'ordinary',
  editorPath = '/some/editor',
}: {
  sandbox: Sandbox;
  doesReleaseSpecFileExist: boolean;
  isEditorAvailable?: boolean;
  errorUponEditingReleaseSpec?: Error;
  errorUponValidatingReleaseSpec?: Error;
  errorUponPlanningRelease?: Error;
  errorUponExecutingReleasePlan?: Error;
  releaseVersion?: string;
  releaseType?: ReleaseType;
  editorPath?: string;
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
  const editor = buildMockEditor({ path: editorPath });
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

  if (errorUponValidatingReleaseSpec) {
    when(validateReleaseSpecificationSpy)
      .calledWith(project, releaseSpecificationPath)
      .mockRejectedValue(errorUponValidatingReleaseSpec);
  } else {
    when(validateReleaseSpecificationSpy)
      .calledWith(project, releaseSpecificationPath)
      .mockResolvedValue(releaseSpecification);
  }

  if (errorUponPlanningRelease) {
    when(planReleaseSpy)
      .calledWith({ project, releaseSpecification, releaseType })
      .mockRejectedValue(errorUponPlanningRelease);
  } else {
    when(planReleaseSpy)
      .calledWith({ project, releaseSpecification, releaseType })
      .mockResolvedValue(releasePlan);
  }

  if (errorUponExecutingReleasePlan) {
    when(executeReleasePlanSpy)
      .calledWith(project, releasePlan, stderr)
      .mockRejectedValue(errorUponExecutingReleasePlan);
  } else {
    when(executeReleasePlanSpy)
      .calledWith(project, releasePlan, stderr)
      .mockResolvedValue(undefined);
  }

  when(captureChangesInReleaseBranchSpy)
    .calledWith(projectDirectoryPath, {
      releaseVersion,
    })
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
    generateReleaseSpecificationTemplateForMonorepoSpy,
    waitForUserToEditReleaseSpecificationSpy,
    releaseSpecification,
    planReleaseSpy,
    executeReleasePlanSpy,
    captureChangesInReleaseBranchSpy,
    releasePlan,
    releaseVersion,
    releaseSpecificationPath,
  };
}

describe('monorepo-workflow-operations', () => {
  describe('followMonorepoWorkflow', () => {
    describe('when firstRemovingExistingReleaseSpecification is false, the release spec file does not already exist, and an editor is available', () => {
      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            releaseType: 'ordinary',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'ordinary',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            releaseType: 'backport',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'backport',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'backport',
          });
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
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

      for (const [description, editorPath] of [
        ['editor path with spaces', '/path/to/my editor'],
        ['editor path with quote', "/path/to/my 'editor"],
        ['editor path with quotes', "/path/to/my 'proje'ct"],
        ['editor path with double-quote', '/path/to/my "editor'],
        ['editor path with double-quotes', '/path/to/my "edi"tor'],
        [
          'editor path with special characters',
          '/path/~to/#my/!y \'\\"\\e@i/0"r',
        ],
      ]) {
        it(`can edit successfully with ${description}`, async () => {
          await withSandbox(async (sandbox) => {
            const {
              project,
              stdout,
              stderr,
              executeReleasePlanSpy,
              releasePlan,
            } = await setupFollowMonorepoWorkflow({
              sandbox,
              doesReleaseSpecFileExist: false,
              isEditorAvailable: true,
              editorPath,
            });

            await followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
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
      }

      it('creates a new branch named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
          } = await setupFollowMonorepoWorkflow({
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            { releaseVersion: '4.38.0' },
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
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch if the release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
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
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
          const {
            project,
            stdout,
            stderr,
            waitForUserToEditReleaseSpecificationSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(
            waitForUserToEditReleaseSpecificationSpy,
          ).not.toHaveBeenCalled();
        });
      });

      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            releaseType: 'ordinary',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'ordinary',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            releaseType: 'backport',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'backport',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'backport',
          });
        });
      });

      it('attempts to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
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
            releaseType: 'ordinary',
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

      it('creates a new branch named after the generated release version if validating and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            releaseVersion: '4.38.0',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: false,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            { releaseVersion: '4.38.0' },
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: false,
              releaseType: 'ordinary',
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
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            releaseType: 'ordinary',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'ordinary',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
            releaseType: 'backport',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'backport',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'backport',
          });
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: false,
            isEditorAvailable: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
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

      it('creates a new branch named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
          } = await setupFollowMonorepoWorkflow({
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            { releaseVersion: '4.38.0' },
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
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch if the release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
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
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
          const {
            project,
            stdout,
            stderr,
            generateReleaseSpecificationTemplateForMonorepoSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(
            generateReleaseSpecificationTemplateForMonorepoSpy,
          ).toHaveBeenCalledWith({
            project,
            isEditorAvailable: true,
          });
        });
      });

      it('plans an ordinary release if given releaseType: "ordinary"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
            releaseType: 'ordinary',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'ordinary',
          });
        });
      });

      it('plans a backport release if given releaseType: "backport"', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            releaseSpecification,
            planReleaseSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
            releaseType: 'backport',
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'backport',
            stdout,
            stderr,
          });

          expect(planReleaseSpy).toHaveBeenCalledWith({
            project,
            releaseSpecification,
            releaseType: 'backport',
          });
        });
      });

      it('attempts to execute the release spec if it was successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            executeReleasePlanSpy,
            releasePlan,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: true,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
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

      it('creates a new branch named after the generated release version if editing, validating, and executing the release spec succeeds', async () => {
        await withSandbox(async (sandbox) => {
          const {
            project,
            stdout,
            stderr,
            captureChangesInReleaseBranchSpy,
            projectDirectoryPath,
          } = await setupFollowMonorepoWorkflow({
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
            projectDirectoryPath,
            { releaseVersion: '4.38.0' },
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
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(false);
        });
      });

      it('does not attempt to execute the release spec if it was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch if the release spec was not successfully edited', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
              stdout,
              stderr,
            }),
          ).rejects.toThrow(expect.anything());

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
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
            });

          await expect(
            followMonorepoWorkflow({
              project,
              tempDirectoryPath: sandbox.directoryPath,
              firstRemovingExistingReleaseSpecification: true,
              releaseType: 'ordinary',
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
          const {
            project,
            stdout,
            stderr,
            generateReleaseSpecificationTemplateForMonorepoSpy,
          } = await setupFollowMonorepoWorkflow({
            sandbox,
            doesReleaseSpecFileExist: true,
            isEditorAvailable: false,
          });

          await followMonorepoWorkflow({
            project,
            tempDirectoryPath: sandbox.directoryPath,
            firstRemovingExistingReleaseSpecification: true,
            releaseType: 'ordinary',
            stdout,
            stderr,
          });

          expect(
            generateReleaseSpecificationTemplateForMonorepoSpy,
          ).toHaveBeenCalledWith({
            project,
            isEditorAvailable: false,
          });
        });
      });

      it('does not attempt to execute the edited release spec', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, executeReleasePlanSpy } =
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
            stdout,
            stderr,
          });

          expect(executeReleasePlanSpy).not.toHaveBeenCalled();
        });
      });

      it('does not attempt to create a new branch', async () => {
        await withSandbox(async (sandbox) => {
          const { project, stdout, stderr, captureChangesInReleaseBranchSpy } =
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
            stdout,
            stderr,
          });

          expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
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
            stdout,
            stderr,
          });

          expect(await fileExists(releaseSpecificationPath)).toBe(true);
        });
      });
    });
  });
});
