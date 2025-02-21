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
