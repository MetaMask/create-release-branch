/**
 * Shared type definitions for dependency bump checker
 */

/**
 * Represents a single dependency version change
 */
export type DependencyChange = {
  package: string;
  dependency: string;
  type: 'dependencies' | 'peerDependencies';
  oldVersion: string;
  newVersion: string;
};

/**
 * Information about a package with changes
 */
export type PackageInfo = {
  /** Dependency changes for this package */
  dependencyChanges: DependencyChange[];
  /** New version if package is being released */
  newVersion?: string;
};

/**
 * Maps package directory names to their changes and version info
 */
export type PackageChanges = {
  [packageDirectoryName: string]: PackageInfo;
};
