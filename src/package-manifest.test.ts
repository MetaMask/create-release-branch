import fs from 'fs';
import path from 'path';
import { SemVer } from 'semver';
import { withSandbox } from '../tests/unit/helpers';
import { readPackageManifest } from './package-manifest';

describe('package-manifest', () => {
  describe('readPackageManifest', () => {
    it('reads a minimal package manifest, expanding it by filling in values for optional fields', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          bundledDependencies: {},
          dependencies: {},
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {},
        });
      });
    });

    it('reads a package manifest where "private" is true', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            private: true,
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: true,
          bundledDependencies: {},
          dependencies: {},
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {},
        });
      });
    });

    it('reads a package manifest where "private" is false', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            private: false,
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          bundledDependencies: {},
          dependencies: {},
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {},
        });
      });
    });

    it('reads a package manifest where optional fields are fully provided', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            workspaces: ['packages/*'],
            private: true,
            bundledDependencies: {
              foo: 'bar',
            },
            dependencies: {
              foo: 'bar',
            },
            devDependencies: {
              foo: 'bar',
            },
            optionalDependencies: {
              foo: 'bar',
            },
            peerDependencies: {
              foo: 'bar',
            },
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: ['packages/*'],
          private: true,
          bundledDependencies: {
            foo: 'bar',
          },
          dependencies: {
            foo: 'bar',
          },
          devDependencies: {
            foo: 'bar',
          },
          optionalDependencies: {
            foo: 'bar',
          },
          peerDependencies: {
            foo: 'bar',
          },
        });
      });
    });

    it('reads a package manifest where dependencies fields are provided but empty', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            private: true,
            bundledDependencies: {},
            dependencies: {},
            devDependencies: {},
            optionalDependencies: {},
            peerDependencies: {},
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: true,
          bundledDependencies: {},
          dependencies: {},
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {},
        });
      });
    });

    it('reads a package manifest where the "workspaces" field is provided but empty', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            workspaces: [],
          }),
        );

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          bundledDependencies: {},
          dependencies: {},
          devDependencies: {},
          optionalDependencies: {},
          peerDependencies: {},
        });
      });
    });

    it('throws if "name" is not provided', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            version: '1.2.3',
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          `The value of "name" in the manifest located at "${sandbox.directoryPath}" must be a non-empty string`,
        );
      });
    });

    it('throws if "name" is an empty string', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: '',
            version: '1.2.3',
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          `The value of "name" in the manifest located at "${sandbox.directoryPath}" must be a non-empty string`,
        );
      });
    });

    it('throws if "name" is not a string', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 12345,
            version: '1.2.3',
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          `The value of "name" in the manifest located at "${sandbox.directoryPath}" must be a non-empty string`,
        );
      });
    });

    it('throws if "version" is not provided', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "version" in the manifest for "foo" must be a valid SemVer version string',
        );
      });
    });

    it('throws if "version" is not a SemVer-compatible version string', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: 12345,
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "version" in the manifest for "foo" must be a valid SemVer version string',
        );
      });
    });

    it('throws if "workspaces" is not an array of strings', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            workspaces: 12345,
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "workspaces" in the manifest for "foo" must be an array of non-empty strings (if present)',
        );
      });
    });

    [
      'bundledDependencies',
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ].forEach((fieldName) => {
      it(`throws if "${fieldName}" is not an object`, async () => {
        await withSandbox(async (sandbox) => {
          const manifestPath = path.join(sandbox.directoryPath, 'package.json');
          await fs.promises.writeFile(
            manifestPath,
            JSON.stringify({
              name: 'foo',
              version: '1.2.3',
              [fieldName]: 12345,
            }),
          );

          await expect(readPackageManifest(manifestPath)).rejects.toThrow(
            `The value of "${fieldName}" in the manifest for "foo" must be an object with non-empty string keys and non-empty string values`,
          );
        });
      });

      it(`throws if "${fieldName}" is not an object with string values`, async () => {
        await withSandbox(async (sandbox) => {
          const manifestPath = path.join(sandbox.directoryPath, 'package.json');
          await fs.promises.writeFile(
            manifestPath,
            JSON.stringify({
              name: 'foo',
              version: '1.2.3',
              [fieldName]: { foo: 12345 },
            }),
          );

          await expect(readPackageManifest(manifestPath)).rejects.toThrow(
            `The value of "${fieldName}" in the manifest for "foo" must be an object with non-empty string keys and non-empty string values`,
          );
        });
      });
    });
  });
});
