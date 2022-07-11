import execa from 'execa';
import { Package } from './package-utils';
import { Project } from './project-utils';

export interface ReleasePlan {
  releaseName: string;
  packages: PackageReleasePlan[];
}

export interface PackageReleasePlan {
  package: Package;
  newVersion: string;
  shouldUpdateChangelog: boolean;
}

/**
 * Does three things:
 *
 * - Stages all of the changes which have been made to the repo thus far and
 *   creates a new Git commit which carries the name of the new release.
 * - Creates a new branch pointed to that commit (which also carries the name of
 *   the new release).
 * - Switches to that branch.
 *
 * @param project - The project.
 * @param releasePlan - The release plan.
 */
export async function captureChangesInReleaseBranch(
  project: Project,
  releasePlan: ReleasePlan,
) {
  // TODO: What if the index was dirty before this script was run? Or what if
  // you're in the middle of a rebase? Might want to check that up front before
  // changes are even made.
  // TODO: What if this branch already exists? Append a number?
  await execa('git', ['checkout', '-b', `release/${releasePlan.releaseName}`], {
    cwd: project.directoryPath,
  });
  await execa('git', ['add', '-A'], { cwd: project.directoryPath });
  await execa('git', ['commit', '-m', `Release ${releasePlan.releaseName}`], {
    cwd: project.directoryPath,
  });
}
