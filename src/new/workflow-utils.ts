import execa from 'execa';
import { Package } from './package-utils';
import { Project } from './project-utils';

/**
 * Instructions for how to update the project in order to prepare it for a new
 * release.
 *
 * @property releaseName - The name of the new release. For a polyrepo or a
 * monorepo with fixed versions, this will be a version string with the shape
 * `<major>.<minor>.<patch>`; for a monorepo with independent versions, this
 * will be a version string with the shape `<year>.<month>.<day>-<build
 * number>`.
 * @property packages - Information about all of the packages in the project.
 * For a polyrepo, this consists of the self-same package; for a monorepo it
 * consists of the root package and any workspace packages.
 */
export interface ReleasePlan {
  releaseName: string;
  packages: PackageReleasePlan[];
}

/**
 * Instructions for how to update a package within a project in order to prepare
 * it for a new release.
 *
 * @property package - Information about the package.
 * @property newVersion - The new version to which the package should be
 * updated.
 * @property shouldUpdateChangelog - Whether or not the changelog for the
 * package should get updated. For a polyrepo, this will always be true; for a
 * monorepo, this will be true only for workspace packages (the root package
 * doesn't have a changelog, since it is a virtual package).
 */
export interface PackageReleasePlan {
  package: Package;
  newVersion: string;
  shouldUpdateChangelog: boolean;
}

/**
 * This function does three things:
 *
 * 1. Stages all of the changes which have been made to the repo thus far and
 *    creates a new Git commit which carries the name of the new release.
 * 2. Creates a new branch pointed to that commit (which also carries the name
 *    of the new release).
 * 3. Switches to that branch.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param releasePlan - Compiled instructions on how exactly to update the
 * project in order to prepare a new release.
 */
export async function captureChangesInReleaseBranch(
  project: Project,
  releasePlan: ReleasePlan,
) {
  const options = { cwd: project.directoryPath };
  // TODO: What if the index was dirty before this script was run? Or what if
  // you're in the middle of a rebase? Might want to check that up front before
  // changes are even made.
  // TODO: What if this branch already exists? Append the build number?
  await execa(
    'git',
    ['checkout', '-b', `release/${releasePlan.releaseName}`],
    options,
  );
  await execa('git', ['add', '-A'], options);
  await execa(
    'git',
    ['commit', '-m', `Release ${releasePlan.releaseName}`],
    options,
  );
}
