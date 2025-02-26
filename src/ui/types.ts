/**
 * What action to take for a package:
 *
 * - `"major"`: Include the package in the release; bump the version by a major
 * - `"minor"`: Include the package in the release; bump the version by a minor
 * - `"patch"`: Include the package in the release; bump the version by a patch
 * - `"intentionally-skip"`: Do not include the package in the release
 * - `"custom"`: Include the package in the release, but use a custom version
 * - `string`: Take no action. (Really, an empty string.)
 */
export type ReleaseType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'intentionally-skip'
  | 'custom'
  | string;

/**
 * A package in the monorepo.
 */
export type Package = {
  name: string;
  version: string;
};

/**
 * Options in the "release type" dropdown for each package.
 */
export const RELEASE_TYPE_OPTIONS = [
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
  { label: 'Patch', value: 'patch' },
  { label: 'Skip', value: 'intentionally-skip' },
] as const;
