import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import rimraf from 'rimraf';
import { SemVer } from 'semver';
import { nanoid } from 'nanoid';
import type { Package } from '../../src/package';
import {
  PackageManifestFieldNames,
  PackageManifestDependenciesFieldNames,
} from '../../src/package-manifest';
import type { ValidatedPackageManifest } from '../../src/package-manifest';
import type { Project } from '../../src/project';

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

const promisifiedRimraf = util.promisify(rimraf);

/**
 * The temporary directory that acts as a filesystem sandbox for tests.
 */
const TEMP_DIRECTORY_PATH = path.join(
  os.tmpdir(),
  'create-release-branch-tests',
);

/**
 * Each test gets its own randomly generated directory in a temporary directory
 * where it can perform filesystem operations. There is a miniscule chance
 * that more than one test will receive the same name for its directory. If this
 * happens, then all bets are off, and we should stop running tests, because
 * the state that we expect to be isolated to a single test has now bled into
 * another test.
 *
 * @param entryPath - The path to the directory.
 * @throws If the directory already exists (or a file exists in its place).
 */
async function ensureFileEntryDoesNotExist(entryPath: string): Promise<void> {
  try {
    await fs.promises.access(entryPath);
    throw new Error(`${entryPath} already exists, cannot continue`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Creates a temporary directory to hold files that a test could write to, runs
 * the given function, then ensures that the directory is removed afterward.
 *
 * @param fn - The function to call.
 * @throws If the temporary directory already exists for some reason. This would
 * indicate a bug in how the names of the directory is determined.
 */
export async function withSandbox(fn: (sandbox: Sandbox) => any) {
  const directoryPath = path.join(TEMP_DIRECTORY_PATH, nanoid());
  await ensureFileEntryDoesNotExist(directoryPath);
  await fs.promises.mkdir(directoryPath, { recursive: true });

  try {
    await fn({ directoryPath });
  } finally {
    await promisifiedRimraf(directoryPath);
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
    Partial<ValidatedPackageManifest>,
    PackageManifestFieldNames.Name | PackageManifestFieldNames.Version
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
      [PackageManifestFieldNames.Name]: name,
      [PackageManifestFieldNames.Version]:
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
 * @returns The mock ValidatedPackageManifest.
 */
export function buildMockManifest(
  overrides: Partial<ValidatedPackageManifest> = {},
): ValidatedPackageManifest {
  return {
    [PackageManifestFieldNames.Name]: 'foo',
    [PackageManifestFieldNames.Version]: new SemVer('1.2.3'),
    [PackageManifestFieldNames.Private]: false,
    [PackageManifestFieldNames.Workspaces]: [],
    [PackageManifestDependenciesFieldNames.Bundled]: {},
    [PackageManifestDependenciesFieldNames.Production]: {},
    [PackageManifestDependenciesFieldNames.Development]: {},
    [PackageManifestDependenciesFieldNames.Optional]: {},
    [PackageManifestDependenciesFieldNames.Peer]: {},
    ...overrides,
  };
}
