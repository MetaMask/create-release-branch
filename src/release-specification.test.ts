import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { MockWritable } from 'stdio-mock';
import YAML from 'yaml';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/helpers.js';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers.js';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification.js';
import * as miscUtils from './misc-utils.js';

jest.mock('./misc-utils', () => {
  return {
    ...jest.requireActual('./misc-utils'),
    runCommand: jest.fn(),
  };
});

describe('release-specification', () => {
  describe('generateReleaseSpecificationTemplateForMonorepo', () => {
    it('returns a YAML-encoded string which has a list of all workspace packages in the project which have been changed since their latest releases', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: false,
          }),
          c: buildMockPackage('c', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const template = await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: true,
      });

      expect(template).toStrictEqual(
        `
# This file (called the "release spec") allows you to specify which packages you
# want to include in this release along with the new versions they should
# receive.
#
# By default, all packages which have changed since their latest release are
# listed here. You can choose not to publish a package by removing it from this
# list.
#
# For each package you *do* want to release, you will need to specify how that
# version should be changed depending on the impact of the changes that will go
# into the release. To help you make this decision, all of the changes have been
# automatically added to the changelog for the package. This has been done
# in a new commit, so you can keep this file open, run \`git show\` in the
# terminal, review the set of changes, then return to this file to specify the
# version.
#
# A version specifier (the value that goes after each package in the list below)
# can be one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
#
# When you're finished, save this file and close it. The tool will update the
# versions of the packages you've listed and will move the changelog entries to
# a new section.

packages:
  a: null
  c: null
`.trimStart(),
      );
    });

    it('throws if no packages have been changed', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: false,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: false,
          }),
        },
      });

      await expect(
        generateReleaseSpecificationTemplateForMonorepo({
          project,
          isEditorAvailable: false,
        }),
      ).rejects.toThrow(
        'Could not generate release specification: There are no packages that have changed since their latest release.',
      );
    });

    it('adjusts the instructions slightly if an editor is not available', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a', {
            hasChangesSinceLatestRelease: true,
          }),
          b: buildMockPackage('b', {
            hasChangesSinceLatestRelease: true,
          }),
        },
      });

      const template = await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: false,
      });

      expect(template).toStrictEqual(
        `
# This file (called the "release spec") allows you to specify which packages you
# want to include in this release along with the new versions they should
# receive.
#
# By default, all packages which have changed since their latest release are
# listed here. You can choose not to publish a package by removing it from this
# list.
#
# For each package you *do* want to release, you will need to specify how that
# version should be changed depending on the impact of the changes that will go
# into the release. To help you make this decision, all of the changes have been
# automatically added to the changelog for the package. This has been done
# in a new commit, so you can keep this file open, run \`git show\` in the
# terminal, review the set of changes, then return to this file to specify the
# version.
#
# A version specifier (the value that goes after each package in the list below)
# can be one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
#
# When you're finished, save this file and then run create-release-branch again.
# The tool will update the versions of the packages you've listed and will move
# the changelog entries to a new section.

packages:
  a: null
  b: null
`.trimStart(),
      );
    });
  });

  describe('waitForUserToEditReleaseSpecification', () => {
    it('waits for the given editor command to complete successfully', async () => {
      const releaseSpecificationPath = '/path/to/release-spec';
      const editor = {
        path: '/path/to/editor',
        args: ['arg1', 'arg2'],
      };
      when(jest.spyOn(miscUtils, 'runCommand'))
        .calledWith(
          '/path/to/editor',
          ['arg1', 'arg2', releaseSpecificationPath],
          {
            stdio: 'inherit',
            shell: true,
          },
        )
        .mockResolvedValue();

      expect(
        await waitForUserToEditReleaseSpecification(
          releaseSpecificationPath,
          editor,
        ),
      ).toBeUndefined();
    });

    it('prints a message to standard out, but then removes it, if the editor command succeeds', async () => {
      const releaseSpecificationPath = '/path/to/release-spec';
      const editor = { path: '/path/to/editor', args: [] };
      const stdout = new MockWritable();
      when(jest.spyOn(miscUtils, 'runCommand')).mockResolvedValue();

      await waitForUserToEditReleaseSpecification(
        releaseSpecificationPath,
        editor,
        stdout,
      );

      expect(stdout.data()).toStrictEqual([
        'Waiting for the release spec to be edited...',
        '\r\u001B[K',
      ]);
    });

    it('still removes the message printed to standard out when the editor command fails', async () => {
      const releaseSpecificationPath = '/path/to/release-spec';
      const editor = {
        path: '/path/to/editor',
        args: ['arg1', 'arg2'],
      };
      const stdout = new MockWritable();
      when(jest.spyOn(miscUtils, 'runCommand'))
        .calledWith(
          '/path/to/editor',
          ['arg1', 'arg2', releaseSpecificationPath],
          {
            stdio: 'inherit',
            shell: true,
          },
        )
        .mockRejectedValue(new Error('oops'));

      try {
        await waitForUserToEditReleaseSpecification(
          releaseSpecificationPath,
          editor,
          stdout,
        );
      } catch {
        // ignore any error that occurs
      }

      expect(stdout.data()).toStrictEqual([
        'Waiting for the release spec to be edited...',
        '\r\u001B[K',
      ]);
    });

    it('throws if the given editor command fails', async () => {
      const releaseSpecificationPath = '/path/to/release-spec';
      const editor = {
        path: '/path/to/editor',
        args: ['arg1', 'arg2'],
      };
      const error = new Error('oops');
      when(jest.spyOn(miscUtils, 'runCommand'))
        .calledWith(
          '/path/to/editor',
          ['arg1', 'arg2', releaseSpecificationPath],
          {
            stdio: 'inherit',
            shell: true,
          },
        )
        .mockRejectedValue(error);

      await expect(
        waitForUserToEditReleaseSpecification(releaseSpecificationPath, editor),
      ).rejects.toThrow(
        expect.objectContaining({
          message:
            'Encountered an error while waiting for the release spec to be edited.',
          cause: error,
        }),
      );
    });
  });

  describe('validateReleaseSpecification', () => {
    it('reads the release spec file and returns an expanded, typed version of its contents', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a'),
            b: buildMockPackage('b'),
            c: buildMockPackage('c'),
            d: buildMockPackage('d'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: 'minor',
              c: 'patch',
              d: '1.2.3',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'major',
            b: 'minor',
            c: 'patch',
            d: new SemVer('1.2.3'),
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('removes packages from the release spec which have "null" as their version specifier', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a'),
            b: buildMockPackage('b'),
            c: buildMockPackage('c'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: null,
              c: 'patch',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'major',
            c: 'patch',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('removes packages from the release spec which have "intentionally-skip" as their version specifier', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a'),
            b: buildMockPackage('b'),
            c: buildMockPackage('c'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: 'intentionally-skip',
              c: 'patch',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'major',
            c: 'patch',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('throws if the release spec cannot be parsed as valid YAML', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject();
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(releaseSpecificationPath, 'foo: "bar');

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringMatching(
              /^Your release spec does not appear to be valid YAML\.\n/u,
            ),
            cause: expect.objectContaining({
              message: expect.stringMatching(/^Missing closing "quote/u),
            }),
          }),
        );
      });
    });

    it('throws if the release spec does not hold an object', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject();
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify(12345),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          /^Your release spec could not be processed because it needs to be an object/u,
        );
      });
    });

    it('throws if the release spec holds an object but it does not have a "packages" property', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject();
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({ foo: 'bar' }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          /^Your release spec could not be processed because it needs to be an object/u,
        );
      });
    });

    it('throws if any of the keys in the "packages" object do not match the names of any workspace packages', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              foo: 'major',
              bar: 'minor',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          new RegExp(
            [
              '^Your release spec could not be processed due to the following issues:\n',
              '\\* Line 2: "foo" is not a package in the project',
              '\\* Line 3: "bar" is not a package in the project',
            ].join('\n'),
            'u',
          ),
        );
      });
    });

    it('throws if any one of the values in the "packages" object is an invalid version specifier', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a'),
            b: buildMockPackage('b'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'asdflksdaf',
              b: '1.2...3.',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          new RegExp(
            [
              '^Your release spec could not be processed due to the following issues:\n',
              '\\* Line 2: "asdflksdaf" is not a valid version specifier for package "a"',
              '          \\(must be "major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1\\.2\\.3"\\)',
              '\\* Line 3: "1.2\\.\\.\\.3\\." is not a valid version specifier for package "b"',
              '          \\(must be "major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1\\.2\\.3"\\)',
            ].join('\n'),
            'u',
          ),
        );
      });
    });

    it('throws if any one of the values in the "packages" object is a version string that matches the current version of the package', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '1.2.3'),
            b: buildMockPackage('b', '4.5.6'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '1.2.3',
              b: '4.5.6',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* Line 2: "1.2.3" is not a valid version specifier for package "a"
          ("a" is already at version "1.2.3")
* Line 3: "4.5.6" is not a valid version specifier for package "b"
          ("b" is already at version "4.5.6")
`.trim(),
        );
      });
    });

    it('throws if any one of the values in the "packages" object is a version string that is less than the current version of the package', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '1.2.3'),
            b: buildMockPackage('b', '4.5.6'),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '1.2.2',
              b: '4.5.5',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* Line 2: "1.2.2" is not a valid version specifier for package "a"
          ("a" is at a greater version "1.2.3")
* Line 3: "4.5.5" is not a valid version specifier for package "b"
          ("b" is at a greater version "4.5.6")
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but any of their peer dependents have changes since their latest release and are not listed in the release', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but any of their peer dependents are not listed in the release, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                peerDependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but any of their peer dependents have changes since their latest release and are not listed in the release', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but any of their peer dependents are not listed in the release, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                peerDependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but their peer dependents have changes since their latest release and have their version specified as null in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but their peer dependents have their version specified as null in the release spec, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                peerDependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but their peer dependents have changes since their latest release and have their version specified as null in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but their peer dependents have their version specified as null in the release spec, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                peerDependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that they are compatible with the new 'a' version.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but any of their direct dependents have changes since their latest release and are not listed in the release', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but any of their direct dependents are not listed in the release, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                dependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but any of their direct dependents have changes since their latest release and are not listed in the release', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but any of their direct dependents are not listed in the release, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                dependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but their direct dependents have changes since their latest release and have their version specified as null in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using the word "major", but their direct dependents have their version specified as null in the release spec, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                dependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('throws if there are any packages in the release with a major version bump using a literal version, but their direct dependents have changes since their latest release and have their version specified as null in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    // NEW
    it('throws if there are any packages in the release with a major version bump using a literal version, but their direct dependents have their version specified as null in the release spec, even if they have no changes', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
              validatedManifest: {
                dependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following direct dependents of package 'a', which is being released with a major version bump, are missing from the release spec.

  - b

  Consider including them in the release spec so that the dependency tree of consuming projects can be kept small.

  If you do not want to do this, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it('does not throw an error if packages in the release with a major version bump using the word "major", have their dependents via "dependencies" with their version specified as "intentionally-skip" in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'major',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('does not throw an error if packages in the release with a major version bump using a literal version, have their dependents via "dependencies" with their version specified as "intentionally-skip" in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: new SemVer('3.0.0'),
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('does not throw an error if packages in the release with a major version bump using the word "major", have their peer dependents with their version specified as "intentionally-skip" in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '1.0.0',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'major',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'major',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it('does not throw an error if packages in the release with a major version bump using a literal version, have their peer dependents with their version specified as "intentionally-skip" in the release spec', async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', '2.1.4', {
              hasChangesSinceLatestRelease: true,
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  a: '2.1.4',
                },
              },
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: '3.0.0',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: new SemVer('3.0.0'),
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it("throws if there are any packages not listed in the release which have changed and are being defined as 'dependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following packages, which are dependencies or peer dependencies of the package 'a' being released, are missing from the release spec.

  - b

  These packages may have changes that 'a' relies upon. Consider including them in the release spec.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it("throws if there are any packages not listed in the release which have changed and are being defined as 'peerDependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following packages, which are dependencies or peer dependencies of the package 'a' being released, are missing from the release spec.

  - b

  These packages may have changes that 'a' relies upon. Consider including them in the release spec.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it("throws if there are any packages unintentionally skipped from the release which have changed and are being defined as 'dependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following packages, which are dependencies or peer dependencies of the package 'a' being released, are missing from the release spec.

  - b

  These packages may have changes that 'a' relies upon. Consider including them in the release spec.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it("throws if there are any packages unintentionally skipped from the release which have changed and are being defined as 'peerDependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
              b: null,
            },
          }),
        );

        await expect(
          validateReleaseSpecification(project, releaseSpecificationPath),
        ).rejects.toThrow(
          `
Your release spec could not be processed due to the following issues:

* The following packages, which are dependencies or peer dependencies of the package 'a' being released, are missing from the release spec.

  - b

  These packages may have changes that 'a' relies upon. Consider including them in the release spec.

  If you are ABSOLUTELY SURE these packages are safe to omit, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      b: intentionally-skip

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

${releaseSpecificationPath}
`.trim(),
        );
      });
    });

    it("does not throw if there are any packages intentionally skipped from the release which have changed and are being defined as 'dependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'minor',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it("does not throw if there are any packages intentionally skipped from the release which have changed and are being defined as 'peerDependencies' by other packages which are listed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  b: '1.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: true,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
              b: 'intentionally-skip',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'minor',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it("does not throw when any packages defined as 'dependencies' by a listed package in the release are not listed but have not changed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                dependencies: {
                  b: '1.0.0',
                  c: '2.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'minor',
          },
          path: releaseSpecificationPath,
        });
      });
    });

    it("does not throw when any packages defined as 'peerDependencies' by a listed package in the release are not listed but have not changed", async () => {
      await withSandbox(async (sandbox) => {
        const project = buildMockProject({
          workspacePackages: {
            a: buildMockPackage('a', {
              hasChangesSinceLatestRelease: true,
              validatedManifest: {
                peerDependencies: {
                  b: '1.0.0',
                  c: '2.0.0',
                },
              },
            }),
            b: buildMockPackage('b', {
              hasChangesSinceLatestRelease: false,
            }),
          },
        });
        const releaseSpecificationPath = path.join(
          sandbox.directoryPath,
          'release-spec',
        );
        await fs.promises.writeFile(
          releaseSpecificationPath,
          YAML.stringify({
            packages: {
              a: 'minor',
            },
          }),
        );

        const releaseSpecification = await validateReleaseSpecification(
          project,
          releaseSpecificationPath,
        );

        expect(releaseSpecification).toStrictEqual({
          packages: {
            a: 'minor',
          },
          path: releaseSpecificationPath,
        });
      });
    });
  });
});
