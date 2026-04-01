import { WriteStream } from 'fs';
import { SemVer } from 'semver';

import { debug } from './misc-utils.js';
import { Package, updatePackage } from './package.js';
import { Project } from './project.js';
import { ReleaseSpecification } from './release-specification.js';

/**
 * Instructions for how to update the project in order to prepare it for a new
 * release.
 *
 * @property newVersion - The new version that should be released, encompassing
 * one or more updates to packages within the project. This is always a
 * SemVer-compatible string, though the meaning of each number depends on the
 * type of project. For a polyrepo package or a monorepo with fixed versions,
 * the format of the version string is "MAJOR.MINOR.PATCH"; for a monorepo with
 * independent versions, it is "ORDINARY.BACKPORT.0", where `BACKPORT` is used
 * to name a release that sits between two ordinary releases, and `ORDINARY` is
 * used to name any other (non-backport) release.
 * @property packages - Describes how the packages in the project should be
 * updated. For a polyrepo package, this list will only contain the package
 * itself; for a monorepo package it will consist of the root package and any
 * workspace packages that will be included in the release.
 */
export type ReleasePlan = {
  newVersion: string;
  packages: PackageReleasePlan[];
};

/**
 * Instructions for how to update a package within a project in order to prepare
 * it for a new release.
 *
 * Properties:
 *
 * - `package` - Information about the package.
 * - `newVersion` - The new version for the package, as a SemVer-compatible
 *   string.
 */
export type PackageReleasePlan = {
  package: Package;
  newVersion: string;
};

/**
 * Uses the release specification to calculate the final versions of all of the
 * packages that we want to update.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseSpecificationPackages - A parsed version of the release spec
 * entered by the user.
 * @param args.newReleaseVersion - The new release version.
 * @returns A promise for information about the new release.
 */
export async function planRelease({
  project,
  releaseSpecificationPackages,
  newReleaseVersion,
}: {
  project: Project;
  releaseSpecificationPackages: ReleaseSpecification['packages'];
  newReleaseVersion: string;
}): Promise<ReleasePlan> {
  const rootReleasePlan: PackageReleasePlan = {
    package: project.rootPackage,
    newVersion: newReleaseVersion,
  };

  const workspaceReleasePlans: PackageReleasePlan[] = Object.keys(
    releaseSpecificationPackages,
  ).map((packageName) => {
    const pkg = project.workspacePackages[packageName];
    const versionSpecifier = releaseSpecificationPackages[packageName];
    const currentVersion = pkg.validatedManifest.version;
    const newVersion =
      versionSpecifier instanceof SemVer
        ? versionSpecifier
        : new SemVer(currentVersion.version).inc(versionSpecifier);

    return {
      package: pkg,
      newVersion: newVersion.version,
    };
  });

  return {
    newVersion: newReleaseVersion,
    packages: [rootReleasePlan, ...workspaceReleasePlans],
  };
}

/**
 * Bumps versions of packages within the monorepo according to the release plan.
 *
 * @param project - Information about the whole project (e.g., names of packages
 * and where they can found).
 * @param releasePlan - Compiled instructions on how exactly to update the
 * project in order to prepare a new release.
 * @param stderr - A stream that can be used to write to standard error.
 */
export async function executeReleasePlan(
  project: Project,
  releasePlan: ReleasePlan,
  stderr: Pick<WriteStream, 'write'>,
): Promise<void> {
  await Promise.all(
    releasePlan.packages.map(async (workspaceReleasePlan) => {
      debug(
        `Updating package ${workspaceReleasePlan.package.validatedManifest.name}...`,
      );
      await updatePackage({
        project,
        packageReleasePlan: workspaceReleasePlan,
        stderr,
      });
    }),
  );
}
