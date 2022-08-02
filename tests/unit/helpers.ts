import path from 'path';
import { SemVer } from 'semver';
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
