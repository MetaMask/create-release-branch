import path from 'path';
import { SemVer } from 'semver';
import { isPlainObject } from '@metamask/utils';
import type { Package } from '../../src/package';
import {
  ManifestFieldNames,
  ManifestDependencyFieldNames,
} from '../../src/package-manifest';
import type { ValidatedManifest } from '../../src/package-manifest';
import type { Project } from '../../src/project';

/**
 * Returns a version of the given record type where optionality is added to
 * the designated keys.
 */
type Unrequire<T, K extends keyof T> = Omit<T, K> & {
  [P in K]+?: T[P];
};

type MockPackageOverrides = Omit<
  Unrequire<Package, 'directoryPath' | 'manifestPath' | 'changelogPath'>,
  'unvalidatedManifest' | 'validatedManifest'
> & {
  validatedManifest?: Omit<
    Partial<ValidatedManifest>,
    ManifestFieldNames.Name | ManifestFieldNames.Version
  >;
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

/**
 * Builds a package object for use in tests. All properties have default
 * values, so you can specify only the properties you care about.
 *
 * @param args - The name of the package (optional), the version of the package
 * (optional) and the properties that will go into the object (optional).
 * @returns The mock Package object.
 */
export function buildMockPackage(
  ...args:
    | [string, string | SemVer, MockPackageOverrides]
    | [string, string | SemVer]
    | [string, MockPackageOverrides]
    | [string]
    | [MockPackageOverrides]
    | []
): Package {
  let name, version, overrides;

  switch (args.length) {
    case 0:
      name = 'package';
      version = '1.0.0';
      overrides = {};
      break;
    case 1:
      name = isPlainObject(args[0]) ? 'package' : args[0];
      version = '1.0.0';
      overrides = isPlainObject(args[0]) ? args[0] : {};
      break;
    case 2:
      name = args[0];
      version = isPlainObject(args[1]) ? '1.0.0' : args[1];
      overrides = isPlainObject(args[1]) ? args[1] : {};
      break;
    default:
      name = args[0];
      version = args[1];
      overrides = args[2];
  }

  const {
    validatedManifest = {},
    directoryPath = `/path/to/packages/${name}`,
    manifestPath = path.join(directoryPath, 'package.json'),
    changelogPath = path.join(directoryPath, 'CHANGELOG.md'),
  } = overrides;

  return {
    directoryPath,
    unvalidatedManifest: {},
    validatedManifest: buildMockManifest({
      ...validatedManifest,
      [ManifestFieldNames.Name]: name,
      [ManifestFieldNames.Version]:
        version instanceof SemVer ? version : new SemVer(version),
    }),
    manifestPath,
    changelogPath,
  };
}

/**
 * Builds a package for use in tests which is designed to be the root package of
 * a monorepo.
 *
 * @param args - The name of the package (optional), the version of the package
 * (optional) and the properties that will go into the object (optional).
 * @returns The mock Package object.
 */
export function buildMockMonorepoRootPackage(
  ...args:
    | [string, string | SemVer, MockPackageOverrides]
    | [string, string | SemVer]
    | [string, MockPackageOverrides]
    | [string]
    | [MockPackageOverrides]
    | []
): Package {
  let name, version, overrides;

  switch (args.length) {
    case 0:
      name = 'package';
      version = '1.0.0';
      overrides = {};
      break;
    case 1:
      name = isPlainObject(args[0]) ? 'package' : args[0];
      version = '1.0.0';
      overrides = isPlainObject(args[0]) ? args[0] : {};
      break;
    case 2:
      name = args[0];
      version = isPlainObject(args[1]) ? '1.0.0' : args[1];
      overrides = isPlainObject(args[1]) ? args[1] : {};
      break;
    default:
      name = args[0];
      version = args[1];
      overrides = args[2];
  }

  const { validatedManifest, ...rest } = overrides;
  return buildMockPackage(name, version, {
    validatedManifest: {
      private: true,
      workspaces: ['packages/*'],
      ...validatedManifest,
    },
    ...rest,
  });
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
