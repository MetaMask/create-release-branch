import fs from 'fs';
import path from 'path';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/helpers';
import {
  buildMockPackage,
  buildMockMonorepoRootPackage,
  buildMockProject,
} from '../tests/unit/helpers';
import { followMonorepoWorkflow } from './monorepo-workflow-operations';
import * as editorModule from './editor';
import * as envModule from './env';
import * as packageModule from './package';
import type { Package } from './package';
import type { ValidatedManifest } from './package-manifest';
import type { Project } from './project';
import * as releaseSpecificationModule from './release-specification';
import * as workflowOperations from './workflow-operations';

jest.mock('./editor');
jest.mock('./env');
jest.mock('./package');
jest.mock('./release-specification');
jest.mock('./workflow-operations');

/**
 * Given a Promise type, returns the type inside.
 */
type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;

describe('monorepo-workflow-operations', () => {
  describe('followMonorepoWorkflow', () => {
    describe('when firstRemovingExistingReleaseSpecification is true', () => {
      describe('when a release spec file does not already exist', () => {
        describe('when an editor can be determined', () => {
          describe('when the editor command completes successfully', () => {
            it('generates a release spec, waits for the user to edit it, then applies it to the monorepo', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    b: buildMockPackage('b', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    c: buildMockPackage('c', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    d: buildMockPackage('d', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const {
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                  updatePackageSpy,
                } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                      b: releaseSpecificationModule.IncrementableVersionParts
                        .minor,
                      c: releaseSpecificationModule.IncrementableVersionParts
                        .patch,
                      d: new SemVer('1.2.3'),
                    },
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                expect(
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                ).toHaveBeenCalled();
                expect(updatePackageSpy).toHaveBeenNthCalledWith(1, {
                  project,
                  packageReleasePlan: {
                    package: project.rootPackage,
                    newVersion: '2022.6.12',
                    shouldUpdateChangelog: false,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(2, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.a,
                    newVersion: '2.0.0',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(3, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.b,
                    newVersion: '1.1.0',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(4, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.c,
                    newVersion: '1.0.1',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(5, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.d,
                    newVersion: '1.2.3',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
              });
            });

            it('creates a new branch named after the generated release version', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const { captureChangesInReleaseBranchSpy } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                    },
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
                  project,
                  {
                    releaseName: '2022-06-12',
                    packages: [
                      {
                        package: project.rootPackage,
                        newVersion: '2022.6.12',
                        shouldUpdateChangelog: false,
                      },
                      {
                        package: project.workspacePackages.a,
                        newVersion: '2.0.0',
                        shouldUpdateChangelog: true,
                      },
                    ],
                  },
                );
              });
            });

            it('removes the release spec file at the end', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                await expect(
                  fs.promises.readFile(
                    path.join(sandbox.directoryPath, 'RELEASE_SPEC'),
                    'utf8',
                  ),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });

            it("throws if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });

                await expect(
                  followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  }),
                ).rejects.toThrow(
                  /^Could not apply version specifier "1.0.0" to package "a" because the current and new versions would end up being the same./u,
                );
              });
            });

            it("does not remove the release spec file if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error
                }

                expect(await fs.promises.stat(releaseSpecPath)).toStrictEqual(
                  expect.anything(),
                );
              });
            });
          });

          describe('when the editor command does not complete successfully', () => {
            it('removes the release spec file', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });
                jest
                  .spyOn(
                    releaseSpecificationModule,
                    'waitForUserToEditReleaseSpecification',
                  )
                  .mockRejectedValue(new Error('oops'));

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error above
                }

                await expect(
                  fs.promises.readFile(
                    path.join(sandbox.directoryPath, 'RELEASE_SPEC'),
                    'utf8',
                  ),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });
          });
        });

        describe('when an editor cannot be determined', () => {
          it('merely generates a release spec and nothing more', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject();
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              const {
                generateReleaseSpecificationTemplateForMonorepoSpy,
                waitForUserToEditReleaseSpecificationSpy,
                validateReleaseSpecificationSpy,
                updatePackageSpy,
                captureChangesInReleaseBranchSpy,
              } = mockDependencies({
                determineEditor: null,
              });

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: true,
                stdout,
                stderr,
              });

              expect(
                generateReleaseSpecificationTemplateForMonorepoSpy,
              ).toHaveBeenCalled();
              expect(
                waitForUserToEditReleaseSpecificationSpy,
              ).not.toHaveBeenCalled();
              expect(validateReleaseSpecificationSpy).not.toHaveBeenCalled();
              expect(updatePackageSpy).not.toHaveBeenCalled();
              expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
            });
          });
        });
      });

      describe('when a release spec file already exists', () => {
        describe('when an editor can be determined', () => {
          describe('when the editor command completes successfully', () => {
            it('re-generates the release spec, waits for the user to edit it, then applies it to the monorepo', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const {
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                  updatePackageSpy,
                } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                    },
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                expect(
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                ).toHaveBeenCalled();
                expect(updatePackageSpy).toHaveBeenNthCalledWith(1, {
                  project,
                  packageReleasePlan: {
                    package: project.rootPackage,
                    newVersion: '2022.6.12',
                    shouldUpdateChangelog: false,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(2, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.a,
                    newVersion: '2.0.0',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
              });
            });

            it('creates a new branch named after the generated release version', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const { captureChangesInReleaseBranchSpy } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                    },
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
                  project,
                  {
                    releaseName: '2022-06-12',
                    packages: [
                      {
                        package: project.rootPackage,
                        newVersion: '2022.6.12',
                        shouldUpdateChangelog: false,
                      },
                      {
                        package: project.workspacePackages.a,
                        newVersion: '2.0.0',
                        shouldUpdateChangelog: true,
                      },
                    ],
                  },
                );
              });
            });

            it('removes the release spec file at the end', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: true,
                  stdout,
                  stderr,
                });

                await expect(
                  fs.promises.readFile(releaseSpecPath, 'utf8'),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });

            it("throws if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                await expect(
                  followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  }),
                ).rejects.toThrow(
                  /^Could not apply version specifier "1.0.0" to package "a" because the current and new versions would end up being the same./u,
                );
              });
            });

            it("does not remove the release spec file if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error
                }

                expect(await fs.promises.stat(releaseSpecPath)).toStrictEqual(
                  expect.anything(),
                );
              });
            });
          });

          describe('when the editor command does not complete successfully', () => {
            it('removes the release spec file', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });
                jest
                  .spyOn(
                    releaseSpecificationModule,
                    'waitForUserToEditReleaseSpecification',
                  )
                  .mockRejectedValue(new Error('oops'));
                const releaseSpecPath = path.join(
                  sandbox.directoryPath,
                  'RELEASE_SPEC',
                );
                await fs.promises.writeFile(releaseSpecPath, 'release spec');

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: true,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error above
                }

                await expect(
                  fs.promises.readFile(releaseSpecPath, 'utf8'),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });
          });
        });

        describe('when an editor cannot be determined', () => {
          it('merely re-generates a release spec and nothing more', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject();
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              const {
                generateReleaseSpecificationTemplateForMonorepoSpy,
                waitForUserToEditReleaseSpecificationSpy,
                validateReleaseSpecificationSpy,
                updatePackageSpy,
                captureChangesInReleaseBranchSpy,
              } = mockDependencies({
                determineEditor: null,
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: true,
                stdout,
                stderr,
              });

              expect(
                generateReleaseSpecificationTemplateForMonorepoSpy,
              ).toHaveBeenCalled();
              expect(
                waitForUserToEditReleaseSpecificationSpy,
              ).not.toHaveBeenCalled();
              expect(validateReleaseSpecificationSpy).not.toHaveBeenCalled();
              expect(updatePackageSpy).not.toHaveBeenCalled();
              expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
            });
          });
        });
      });
    });

    describe('when firstRemovingExistingReleaseSpecification is false', () => {
      describe('when a release spec file does not already exist', () => {
        describe('when an editor can be determined', () => {
          describe('when the editor command completes successfully', () => {
            it('generates a release spec, waits for the user to edit it, then applies it to the monorepo', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    b: buildMockPackage('b', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    c: buildMockPackage('c', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                    d: buildMockPackage('d', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const {
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                  updatePackageSpy,
                } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                      b: releaseSpecificationModule.IncrementableVersionParts
                        .minor,
                      c: releaseSpecificationModule.IncrementableVersionParts
                        .patch,
                      d: new SemVer('1.2.3'),
                    },
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                });

                expect(
                  generateReleaseSpecificationTemplateForMonorepoSpy,
                ).toHaveBeenCalled();
                expect(updatePackageSpy).toHaveBeenNthCalledWith(1, {
                  project,
                  packageReleasePlan: {
                    package: project.rootPackage,
                    newVersion: '2022.6.12',
                    shouldUpdateChangelog: false,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(2, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.a,
                    newVersion: '2.0.0',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(3, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.b,
                    newVersion: '1.1.0',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(4, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.c,
                    newVersion: '1.0.1',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
                expect(updatePackageSpy).toHaveBeenNthCalledWith(5, {
                  project,
                  packageReleasePlan: {
                    package: project.workspacePackages.d,
                    newVersion: '1.2.3',
                    shouldUpdateChangelog: true,
                  },
                  stderr,
                });
              });
            });

            it('creates a new branch named after the generated release version', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                const { captureChangesInReleaseBranchSpy } = mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: releaseSpecificationModule.IncrementableVersionParts
                        .major,
                    },
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                });

                expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
                  project,
                  {
                    releaseName: '2022-06-12',
                    packages: [
                      {
                        package: project.rootPackage,
                        newVersion: '2022.6.12',
                        shouldUpdateChangelog: false,
                      },
                      {
                        package: project.workspacePackages.a,
                        newVersion: '2.0.0',
                        shouldUpdateChangelog: true,
                      },
                    ],
                  },
                );
              });
            });

            it('removes the release spec file at the end', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });

                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                });

                await expect(
                  fs.promises.readFile(
                    path.join(sandbox.directoryPath, 'RELEASE_SPEC'),
                    'utf8',
                  ),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });

            it("throws if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });

                await expect(
                  followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: false,
                    stdout,
                    stderr,
                  }),
                ).rejects.toThrow(
                  /^Could not apply version specifier "1.0.0" to package "a" because the current and new versions would end up being the same./u,
                );
              });
            });

            it("does not remove the release spec file if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject({
                  rootPackage: buildMockPackage('root', '2022.1.1', {
                    validatedManifest: {
                      private: true,
                      workspaces: ['packages/*'],
                    },
                  }),
                  workspacePackages: {
                    a: buildMockPackage('a', '1.0.0', {
                      validatedManifest: {
                        private: false,
                      },
                    }),
                  },
                });
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                  getEnvironmentVariables: {
                    TODAY: '2022-06-12',
                  },
                  validateReleaseSpecification: {
                    packages: {
                      a: new SemVer('1.0.0'),
                    },
                  },
                });

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: false,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error
                }

                expect(
                  await fs.promises.stat(
                    path.join(sandbox.directoryPath, 'RELEASE_SPEC'),
                  ),
                ).toStrictEqual(expect.anything());
              });
            });
          });

          describe('when the editor command does not complete successfully', () => {
            it('removes the release spec file', async () => {
              await withSandbox(async (sandbox) => {
                const project = buildMockMonorepoProject();
                const stdout = fs.createWriteStream('/dev/null');
                const stderr = fs.createWriteStream('/dev/null');
                mockDependencies({
                  determineEditor: {
                    path: '/some/editor',
                    args: [],
                  },
                });
                jest
                  .spyOn(
                    releaseSpecificationModule,
                    'waitForUserToEditReleaseSpecification',
                  )
                  .mockRejectedValue(new Error('oops'));

                try {
                  await followMonorepoWorkflow({
                    project,
                    tempDirectoryPath: sandbox.directoryPath,
                    firstRemovingExistingReleaseSpecification: false,
                    stdout,
                    stderr,
                  });
                } catch {
                  // ignore the error above
                }

                await expect(
                  fs.promises.readFile(
                    path.join(sandbox.directoryPath, 'RELEASE_SPEC'),
                    'utf8',
                  ),
                ).rejects.toThrow(/^ENOENT: no such file or directory/u);
              });
            });
          });
        });

        describe('when an editor cannot be determined', () => {
          it('merely generates a release spec and nothing more', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject();
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              const {
                generateReleaseSpecificationTemplateForMonorepoSpy,
                waitForUserToEditReleaseSpecificationSpy,
                validateReleaseSpecificationSpy,
                updatePackageSpy,
                captureChangesInReleaseBranchSpy,
              } = mockDependencies({
                determineEditor: null,
              });

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: false,
                stdout,
                stderr,
              });

              expect(
                generateReleaseSpecificationTemplateForMonorepoSpy,
              ).toHaveBeenCalled();
              expect(
                waitForUserToEditReleaseSpecificationSpy,
              ).not.toHaveBeenCalled();
              expect(validateReleaseSpecificationSpy).not.toHaveBeenCalled();
              expect(updatePackageSpy).not.toHaveBeenCalled();
              expect(captureChangesInReleaseBranchSpy).not.toHaveBeenCalled();
            });
          });
        });
      });

      describe('when a release spec file already exists', () => {
        describe('when the editor command completes successfully', () => {
          it('does not re-generate the release spec, but applies it to the monorepo', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject({
                rootPackage: buildMockPackage('root', '2022.1.1', {
                  validatedManifest: {
                    private: true,
                    workspaces: ['packages/*'],
                  },
                }),
                workspacePackages: {
                  a: buildMockPackage('a', '1.0.0', {
                    validatedManifest: {
                      private: false,
                    },
                  }),
                },
              });
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              const {
                generateReleaseSpecificationTemplateForMonorepoSpy,
                waitForUserToEditReleaseSpecificationSpy,
                updatePackageSpy,
              } = mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
                getEnvironmentVariables: {
                  TODAY: '2022-06-12',
                },
                validateReleaseSpecification: {
                  packages: {
                    a: releaseSpecificationModule.IncrementableVersionParts
                      .major,
                  },
                },
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: false,
                stdout,
                stderr,
              });

              expect(
                generateReleaseSpecificationTemplateForMonorepoSpy,
              ).not.toHaveBeenCalled();
              expect(
                waitForUserToEditReleaseSpecificationSpy,
              ).not.toHaveBeenCalled();
              expect(updatePackageSpy).toHaveBeenNthCalledWith(1, {
                project,
                packageReleasePlan: {
                  package: project.rootPackage,
                  newVersion: '2022.6.12',
                  shouldUpdateChangelog: false,
                },
                stderr,
              });
              expect(updatePackageSpy).toHaveBeenNthCalledWith(2, {
                project,
                packageReleasePlan: {
                  package: project.workspacePackages.a,
                  newVersion: '2.0.0',
                  shouldUpdateChangelog: true,
                },
                stderr,
              });
            });
          });

          it('creates a new branch named after the generated release version', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject({
                rootPackage: buildMockPackage('root', '2022.1.1', {
                  validatedManifest: {
                    private: true,
                    workspaces: ['packages/*'],
                  },
                }),
                workspacePackages: {
                  a: buildMockPackage('a', '1.0.0', {
                    validatedManifest: {
                      private: false,
                    },
                  }),
                },
              });
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              const { captureChangesInReleaseBranchSpy } = mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
                getEnvironmentVariables: {
                  TODAY: '2022-06-12',
                },
                validateReleaseSpecification: {
                  packages: {
                    a: releaseSpecificationModule.IncrementableVersionParts
                      .major,
                  },
                },
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: false,
                stdout,
                stderr,
              });

              expect(captureChangesInReleaseBranchSpy).toHaveBeenCalledWith(
                project,
                {
                  releaseName: '2022-06-12',
                  packages: [
                    {
                      package: project.rootPackage,
                      newVersion: '2022.6.12',
                      shouldUpdateChangelog: false,
                    },
                    {
                      package: project.workspacePackages.a,
                      newVersion: '2.0.0',
                      shouldUpdateChangelog: true,
                    },
                  ],
                },
              );
            });
          });

          it('removes the release spec file at the end', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject();
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              await followMonorepoWorkflow({
                project,
                tempDirectoryPath: sandbox.directoryPath,
                firstRemovingExistingReleaseSpecification: false,
                stdout,
                stderr,
              });

              await expect(
                fs.promises.readFile(releaseSpecPath, 'utf8'),
              ).rejects.toThrow(/^ENOENT: no such file or directory/u);
            });
          });

          it("throws if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject({
                rootPackage: buildMockPackage('root', '2022.1.1', {
                  validatedManifest: {
                    private: true,
                    workspaces: ['packages/*'],
                  },
                }),
                workspacePackages: {
                  a: buildMockPackage('a', '1.0.0', {
                    validatedManifest: {
                      private: false,
                    },
                  }),
                },
              });
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
                getEnvironmentVariables: {
                  TODAY: '2022-06-12',
                },
                validateReleaseSpecification: {
                  packages: {
                    a: new SemVer('1.0.0'),
                  },
                },
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              await expect(
                followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                }),
              ).rejects.toThrow(
                /^Could not apply version specifier "1.0.0" to package "a" because the current and new versions would end up being the same./u,
              );
            });
          });

          it("does not remove the release spec file if a version specifier for a package within the edited release spec, when applied, would result in no change to the package's version", async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject({
                rootPackage: buildMockPackage('root', '2022.1.1', {
                  validatedManifest: {
                    private: true,
                    workspaces: ['packages/*'],
                  },
                }),
                workspacePackages: {
                  a: buildMockPackage('a', '1.0.0', {
                    validatedManifest: {
                      private: false,
                    },
                  }),
                },
              });
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
                getEnvironmentVariables: {
                  TODAY: '2022-06-12',
                },
                validateReleaseSpecification: {
                  packages: {
                    a: new SemVer('1.0.0'),
                  },
                },
              });
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              try {
                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                });
              } catch {
                // ignore the error
              }

              expect(await fs.promises.stat(releaseSpecPath)).toStrictEqual(
                expect.anything(),
              );
            });
          });
        });

        describe('when the editor command does not complete successfully', () => {
          it('removes the release spec file', async () => {
            await withSandbox(async (sandbox) => {
              const project = buildMockMonorepoProject();
              const stdout = fs.createWriteStream('/dev/null');
              const stderr = fs.createWriteStream('/dev/null');
              mockDependencies({
                determineEditor: {
                  path: '/some/editor',
                  args: [],
                },
              });
              jest
                .spyOn(
                  releaseSpecificationModule,
                  'waitForUserToEditReleaseSpecification',
                )
                .mockRejectedValue(new Error('oops'));
              const releaseSpecPath = path.join(
                sandbox.directoryPath,
                'RELEASE_SPEC',
              );
              await fs.promises.writeFile(releaseSpecPath, 'release spec');

              try {
                await followMonorepoWorkflow({
                  project,
                  tempDirectoryPath: sandbox.directoryPath,
                  firstRemovingExistingReleaseSpecification: false,
                  stdout,
                  stderr,
                });
              } catch {
                // ignore the error above
              }

              await expect(
                fs.promises.readFile(releaseSpecPath, 'utf8'),
              ).rejects.toThrow(/^ENOENT: no such file or directory/u);
            });
          });
        });
      });
    });
  });
});

/**
 * Builds a project for use in tests which represents a monorepo.
 *
 * @param overrides - The properties that will go into the object.
 * @returns The mock Project object.
 */
function buildMockMonorepoProject(overrides: Partial<Project> = {}) {
  return buildMockProject({
    rootPackage: buildMockMonorepoRootPackage(),
    workspacePackages: {},
    ...overrides,
  });
}

/**
 * Mocks dependencies that `followMonorepoWorkflow` uses internally.
 *
 * @param args - The arguments to this function.
 * @param args.determineEditor - The return value for `determineEditor`.
 * @param args.getEnvironmentVariables - The return value for
 * `getEnvironmentVariables`.
 * @param args.generateReleaseSpecificationTemplateForMonorepo - The return
 * value for `generateReleaseSpecificationTemplateForMonorepo`.
 * @param args.waitForUserToEditReleaseSpecification - The return value for
 * `waitForUserToEditReleaseSpecification`.
 * @param args.validateReleaseSpecification - The return value for
 * `validateReleaseSpecification`.
 * @param args.updatePackage - The return value for `updatePackage`.
 * @param args.captureChangesInReleaseBranch - The return value for
 * `captureChangesInReleaseBranch`.
 * @returns Jest spy objects for the aforementioned dependencies.
 */
function mockDependencies({
  determineEditor: determineEditorValue = null,
  getEnvironmentVariables: getEnvironmentVariablesValue = {},
  generateReleaseSpecificationTemplateForMonorepo:
    generateReleaseSpecificationTemplateForMonorepoValue = '{}',
  waitForUserToEditReleaseSpecification:
    waitForUserToEditReleaseSpecificationValue = undefined,
  validateReleaseSpecification: validateReleaseSpecificationValue = {
    packages: {},
  },
  updatePackage: updatePackageValue = undefined,
  captureChangesInReleaseBranch: captureChangesInReleaseBranchValue = undefined,
}: {
  determineEditor?: UnwrapPromise<
    ReturnType<typeof editorModule.determineEditor>
  >;
  getEnvironmentVariables?: Partial<
    ReturnType<typeof envModule.getEnvironmentVariables>
  >;
  generateReleaseSpecificationTemplateForMonorepo?: UnwrapPromise<
    ReturnType<
      typeof releaseSpecificationModule.generateReleaseSpecificationTemplateForMonorepo
    >
  >;
  waitForUserToEditReleaseSpecification?: UnwrapPromise<
    ReturnType<
      typeof releaseSpecificationModule.waitForUserToEditReleaseSpecification
    >
  >;
  validateReleaseSpecification?: UnwrapPromise<
    ReturnType<typeof releaseSpecificationModule.validateReleaseSpecification>
  >;
  updatePackage?: UnwrapPromise<ReturnType<typeof packageModule.updatePackage>>;
  captureChangesInReleaseBranch?: UnwrapPromise<
    ReturnType<typeof workflowOperations.captureChangesInReleaseBranch>
  >;
}) {
  jest
    .spyOn(editorModule, 'determineEditor')
    .mockResolvedValue(determineEditorValue);
  jest.spyOn(envModule, 'getEnvironmentVariables').mockReturnValue({
    EDITOR: undefined,
    TODAY: undefined,
    ...getEnvironmentVariablesValue,
  });
  const generateReleaseSpecificationTemplateForMonorepoSpy = jest
    .spyOn(
      releaseSpecificationModule,
      'generateReleaseSpecificationTemplateForMonorepo',
    )
    .mockResolvedValue(generateReleaseSpecificationTemplateForMonorepoValue);
  const waitForUserToEditReleaseSpecificationSpy = jest
    .spyOn(releaseSpecificationModule, 'waitForUserToEditReleaseSpecification')
    .mockResolvedValue(waitForUserToEditReleaseSpecificationValue);
  const validateReleaseSpecificationSpy = jest
    .spyOn(releaseSpecificationModule, 'validateReleaseSpecification')
    .mockResolvedValue(validateReleaseSpecificationValue);
  const updatePackageSpy = jest
    .spyOn(packageModule, 'updatePackage')
    .mockResolvedValue(updatePackageValue);
  const captureChangesInReleaseBranchSpy = jest
    .spyOn(workflowOperations, 'captureChangesInReleaseBranch')
    .mockResolvedValue(captureChangesInReleaseBranchValue);

  return {
    generateReleaseSpecificationTemplateForMonorepoSpy,
    waitForUserToEditReleaseSpecificationSpy,
    validateReleaseSpecificationSpy,
    updatePackageSpy,
    captureChangesInReleaseBranchSpy,
  };
}
