import fs from 'fs';
import os from 'os';
import path from 'path';
import { SemVer } from 'semver';
import { nanoid } from 'nanoid';
import type { Package } from '../../src/package-utils';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
} from '../../src/package-manifest-utils';
import type { Project } from '../../src/project-utils';
import type { ValidatedManifest } from '../../src/package-manifest-utils';

/**
 * Returns a version of the given record type where optionality is added to
 * the designated keys.
 */
type Unrequire<T, K extends keyof T> = Omit<T, K> & {
  [P in K]+?: T[P];
};

/**
 * Information about the sandbox provided to tests that need access to the
 * filesystem.
 */
interface Sandbox {
  directoryPath: string;
}

/**
 * The temporary directory that acts as a filesystem sandbox for tests.
 */
const TEMP_DIRECTORY_PATH = path.join(
  os.tmpdir(),
  'create-release-branch-tests',
);

/**
 * Creates a temporary directory to hold files that a test could write, runs the
 * given function, then ensures that the directory is removed afterward.
 *
 * @param fn - The function to call.
 * @throws If the temporary directory already exists for some reason. This would
 * indicate a bug in how the names of the directory is determined.
 */
export async function withSandbox(fn: (sandbox: Sandbox) => any) {
  const directoryPath = path.join(TEMP_DIRECTORY_PATH, nanoid());
  let stats;

  try {
    stats = await fs.promises.stat(directoryPath);

    if (stats.isDirectory()) {
      throw new Error(
        `Directory ${directoryPath} already exists, cannot continue`,
      );
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.promises.mkdir(directoryPath, { recursive: true });

  try {
    await fn({ directoryPath });
  } finally {
    await fs.promises.rmdir(directoryPath, { recursive: true });
  }
}

/**
 * Builds a project object for use in tests. All properties have default
 * values, so you can specify only the properties you care about.
 *
 * @param overrides - The properties that will go into the object.
 * @returns The mock Project.
 */
export function buildMockProject(overrides: Partial<Project> = {}): Project {
  return {
    directoryPath: '/path/to/project',
    repositoryUrl: 'https://repo.url',
    rootPackage: buildMockPackage('root'),
    workspacePackages: {},
    isMonorepo: false,
    ...overrides,
  };
}

type MockPackageOverrides = Omit<
  Unrequire<Package, 'directoryPath' | 'manifestPath' | 'changelogPath'>,
  'manifest'
> & {
  manifest?: Omit<
    Partial<ValidatedManifest>,
    ManifestFieldNames.Name | ManifestFieldNames.Version
  >;
};

/**
 * Builds a package object for use in tests. All properties have default
 * values, so you can specify only the properties you care about.
 *
 * @param name - The name of the package.
 * @param args - Either the version of the package and the properties that will
 * go into the object, or just the properties.
 * @returns The mock Package object.
 */
export function buildMockPackage(
  name: string,
  ...args: [string | SemVer, MockPackageOverrides] | [MockPackageOverrides] | []
): Package {
  let version, overrides;

  if (args.length === 0) {
    version = '1.0.0';
    overrides = {};
  } else if (args.length === 1) {
    version = '1.0.0';
    overrides = args[0];
  } else {
    version = args[0];
    overrides = args[1];
  }

  const {
    manifest = {},
    directoryPath = `/path/to/packages/${name}`,
    manifestPath = path.join(directoryPath, 'package.json'),
    changelogPath = path.join(directoryPath, 'CHANGELOG.md'),
  } = overrides;

  return {
    directoryPath,
    manifest: buildMockManifest({
      ...manifest,
      [ManifestFieldNames.Name]: name,
      [ManifestFieldNames.Version]:
        version instanceof SemVer ? version : new SemVer(version),
    }),
    manifestPath,
    changelogPath,
  };
}

/**
 * Builds a manifest object for use in tests. All properties have default
 * values, so you can specify only the properties you care about.
 *
 * @param overrides - The properties to override in the manifest.
 * @returns The mock ValidatedManifest.
 */
export function buildMockManifest(
  overrides: Partial<ValidatedManifest> = {},
): ValidatedManifest {
  return {
    [ManifestFieldNames.Name]: 'foo',
    [ManifestFieldNames.Version]: new SemVer('1.2.3'),
    [ManifestFieldNames.Private]: false,
    [ManifestFieldNames.Workspaces]: [],
    [ManifestDependencyFieldNames.Bundled]: {},
    [ManifestDependencyFieldNames.Production]: {},
    [ManifestDependencyFieldNames.Development]: {},
    [ManifestDependencyFieldNames.Optional]: {},
    [ManifestDependencyFieldNames.Peer]: {},
    ...overrides,
  };
}
