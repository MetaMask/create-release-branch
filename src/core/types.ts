/**
 * The type of release being created as determined by the parent release.
 *
 * - An *ordinary* release includes features or fixes applied against the latest
 *   release and is designated by bumping the first part of that release's
 *   version string.
 * - A *backport* release includes fixes applied against a previous release and
 *   is designated by bumping the second part of that release's version string.
 */
export type ReleaseType = 'ordinary' | 'backport';
