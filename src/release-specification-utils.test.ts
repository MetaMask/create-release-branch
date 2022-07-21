import fs from 'fs';
import path from 'path';
import { when } from 'jest-when';
import { MockWritable } from 'stdio-mock';
import YAML from 'yaml';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/helpers';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import {
  generateReleaseSpecificationTemplateForMonorepo,
  waitForUserToEditReleaseSpecification,
  validateReleaseSpecification,
} from './release-specification-utils';
import * as miscUtils from './misc-utils';

jest.mock('./misc-utils', () => {
  return {
    ...jest.requireActual('./misc-utils'),
    runCommand: jest.fn(),
  };
});

describe('release-specification-utils', () => {
  describe('generateReleaseSpecificationTemplateForMonorepo', () => {
    it('returns a YAML-encoded string which has a list of all workspace packages in the project', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a'),
          b: buildMockPackage('b'),
        },
      });

      const template = await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: true,
      });

      expect(template).toStrictEqual(
        `
# The following is a list of packages in monorepo.
# Please indicate the packages for which you want to create a new release
# by updating "null" (which does nothing) to one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
# - null (to skip the package entirely)
#
# When you're finished making your selections, save this file and the script
# will continue automatically.

packages:
  a: null
  b: null
`.slice(1),
      );
    });

    it('adjusts the instructions slightly if an editor is not available', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('monorepo'),
        workspacePackages: {
          a: buildMockPackage('a'),
          b: buildMockPackage('b'),
        },
      });

      const template = await generateReleaseSpecificationTemplateForMonorepo({
        project,
        isEditorAvailable: false,
      });

      expect(template).toStrictEqual(
        `
# The following is a list of packages in monorepo.
# Please indicate the packages for which you want to create a new release
# by updating "null" (which does nothing) to one of the following:
#
# - "major" (if you want to bump the major part of the package's version)
# - "minor" (if you want to bump the minor part of the package's version)
# - "patch" (if you want to bump the patch part of the package's version)
# - an exact version with major, minor, and patch parts (e.g. "1.2.3")
# - null (to skip the package entirely)
#
# When you're finished making your selections, save this file and then re-run
# the script that generated this file.

packages:
  a: null
  b: null
`.slice(1),
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

      await expect(
        waitForUserToEditReleaseSpecification(releaseSpecificationPath, editor),
      ).rejects.toThrow(
        'Encountered an error while waiting for the release spec to be edited: oops',
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

    it('removes packages which have "null" as their version specifier', async () => {
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
          /^Failed to parse release spec:\n\nMissing closing "quote at line 1/u,
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

    it('throws if any of the keys in the "packages" objectproperty do not match the names of any workspace packages', async () => {
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
              '- Line 2: "foo" is not a package in the project',
              '- Line 3: "bar" is not a package in the project',
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
              '- Line 2: "asdflksdaf" is not a valid version specifier for package "a"',
              '          \\(must be "major", "minor", or "patch"; or a version string with major, minor, and patch parts, such as "1\\.2\\.3"\\)',
              '- Line 3: "1.2\\.\\.\\.3\\." is not a valid version specifier for package "b"',
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
          new RegExp(
            [
              '^Your release spec could not be processed due to the following issues:\n',
              '- Line 2: "1.2.3" is not a valid version specifier for package "a"',
              '          \\("a" is already at version "1.2.3"\\)',
              '- Line 3: "4.5.6" is not a valid version specifier for package "b"',
              '          \\("b" is already at version "4.5.6"\\)',
            ].join('\n'),
            'u',
          ),
        );
      });
    });
  });
});
