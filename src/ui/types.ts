export type ReleaseType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'intentionally-skip'
  | 'custom'
  | string;

export type Package = {
  name: string;
  version: string;
};

export const RELEASE_TYPE_OPTIONS = [
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
  { label: 'Patch', value: 'patch' },
  { label: 'Skip', value: 'intentionally-skip' },
] as const;
