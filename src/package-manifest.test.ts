import fs from 'fs';
import path from 'path';
import { SemVer } from 'semver';

import { readPackageManifest } from './package-manifest';
import { withSandbox } from '../tests/helpers';

describe('package-manifest', () => {
  describe('readPackageManifest', () => {
    it('reads a minimal package manifest, expanding it by filling in values for optional fields', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          dependencies: {},
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where "private" is true', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          private: true,
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: true,
          dependencies: {},
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where "dependencies" has valid values', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          private: true,
          dependencies: {
            a: '1.0.0',
          },
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: true,
          dependencies: {
            a: '1.0.0',
          },
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where "peerDependencies" has valid values', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          private: true,
          peerDependencies: {
            a: '1.0.0',
          },
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: true,
          dependencies: {},
          peerDependencies: {
            a: '1.0.0',
          },
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where "private" is false', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          private: false,
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          dependencies: {},
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where optional fields are fully provided', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          workspaces: ['packages/*'],
          private: true,
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: ['packages/*'],
          private: true,
          dependencies: {},
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
        });
      });
    });

    it('reads a package manifest where the "workspaces" field is provided but empty', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        const unvalidated = {
          name: 'foo',
          version: '1.2.3',
          workspaces: [],
        };
        const validated = {
          name: 'foo',
          version: new SemVer('1.2.3'),
          workspaces: [],
          private: false,
          dependencies: {},
          peerDependencies: {},
        };
        await fs.promises.writeFile(manifestPath, JSON.stringify(unvalidated));

        expect(await readPackageManifest(manifestPath)).toStrictEqual({
          unvalidated,
          validated,
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

    it('throws if any of the "dependencies" has a non SemVer-compatible version string', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.0.0',
            dependencies: {
              a: 12345,
            },
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "dependencies" in the manifest for "foo" must be a valid dependencies field',
        );
      });
    });

    it('throws if any of the "peerDependencies" has a non SemVer-compatible version string', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.0.0',
            peerDependencies: {
              a: 12345,
            },
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "peerDependencies" in the manifest for "foo" must be a valid peerDependencies field',
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

    it('throws if "private" is not a boolean', async () => {
      await withSandbox(async (sandbox) => {
        const manifestPath = path.join(sandbox.directoryPath, 'package.json');
        await fs.promises.writeFile(
          manifestPath,
          JSON.stringify({
            name: 'foo',
            version: '1.2.3',
            private: 'whatever',
          }),
        );

        await expect(readPackageManifest(manifestPath)).rejects.toThrow(
          'The value of "private" in the manifest for "foo" must be true or false (if present)',
        );
      });
    });
  });
});
