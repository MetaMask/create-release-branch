import type { WriteStream } from 'fs';
import { SemVer } from 'semver';
import { assert } from '@metamask/utils';
import { debug } from './misc-utils';
import { Package, updatePackage } from './package';
import { Project } from './project';
import {
  IncrementableVersionParts,
  ReleaseSpecification,
  VersionSpecifier,
} from './release-specification';
import { semver } from './semver';

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
 * @property package - Information about the package.
 * @property newVersion - The new version for the package, as a
 * SemVer-compatible string.
 * @property shouldUpdateChangelog - Whether or not the changelog for the
 * package should get updated. For a polyrepo, this will always be true; for a
 * monorepo, this will be true only for workspace packages (the root package
 * doesn't have a changelog, since it is a virtual package).
 */
export type PackageReleasePlan = {
  package: Package;
  newVersion: string;
  shouldUpdateChangelog: boolean;
};

/**
 * Get the new version for a package, based on the release specification.
 *
 * @param currentVersion - The current version of the package.
 * @param versionSpecifier - The version specifier from the release
 * specification.
 * @returns The new version for the package.
 */
export function getNewPackageVersion(
  currentVersion: SemVer,
  versionSpecifier: VersionSpecifier,
) {
  return versionSpecifier instanceof SemVer
    ? versionSpecifier
    : new SemVer(currentVersion.toString()).inc(versionSpecifier);
}

/**
 * Get the new release version for a monorepo, based on the release
 * specification.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseSpecification - A parsed version of the release spec
 * entered by the user.
 * @returns The new release version.
 */
export function getNewReleaseVersion({
  project,
  releaseSpecification,
}: {
  project: Project;
  releaseSpecification: ReleaseSpecification;
}): string {
  const versionIncrement = Object.entries(
    releaseSpecification.packages,
  ).reduce<IncrementableVersionParts>(
    (currentIncrementableVersion, [packageName, versionSpecifier]) => {
      // If the current incrementable version is "major", we can stop
      // immediately, since we can't increment the version any further.
      if (currentIncrementableVersion === IncrementableVersionParts.major) {
        return currentIncrementableVersion;
      }

      const currentVersion =
        project.workspacePackages[packageName].validatedManifest.version;
      const newVersion = getNewPackageVersion(currentVersion, versionSpecifier);

      // `diff` returns null if the versions are the same, or a string
      // representing the type of change otherwise (e.g., "major", "minor",
      // "patch"). We then convert that string to the enum value.
      const diff = semver.diff(
        currentVersion,
        newVersion,
      ) as IncrementableVersionParts;

      if (
        diff === null ||
        !Object.values(IncrementableVersionParts).includes(diff)
      ) {
        return currentIncrementableVersion;
      }

      // Assuming that the `IncrementableVersionParts` enum is ordered from
      // most to least significant, we can compare the weights of the two
      // versions to determine which one is more significant. For example, if
      // the current incrementable version is "patch" and the diff is "minor",
      // we check the weight of "minor" and "patch" and find that "minor" is
      // more significant, so we return "minor" as the new incrementable
      // version.
      const weight = Object.values(IncrementableVersionParts).indexOf(diff);
      const currentWeight = Object.values(IncrementableVersionParts).indexOf(
        currentIncrementableVersion,
      );

      return weight < currentWeight ? diff : currentIncrementableVersion;
    },
    IncrementableVersionParts.patch,
  );

  const newVersion = semver.inc(project.releaseVersion, versionIncrement);
  assert(newVersion !== null, 'Invalid new version.');

  return newVersion;
}

/**
 * Uses the release specification to calculate the final versions of all of the
 * packages that we want to update, as well as a new release name.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseSpecification - A parsed version of the release spec
 * entered by the user.
 * @returns A promise for information about the new release.
 */
export async function planRelease({
  project,
  releaseSpecification,
}: {
  project: Project;
  releaseSpecification: ReleaseSpecification;
}): Promise<ReleasePlan> {
  const newReleaseVersion = getNewReleaseVersion({
    project,
    releaseSpecification,
  });

  const rootReleasePlan: PackageReleasePlan = {
    package: project.rootPackage,
    newVersion: newReleaseVersion,
    shouldUpdateChangelog: false,
  };

  const workspaceReleasePlans: PackageReleasePlan[] = Object.keys(
    releaseSpecification.packages,
  ).map((packageName) => {
    const pkg = project.workspacePackages[packageName];
    const versionSpecifier = releaseSpecification.packages[packageName];
    const currentVersion = pkg.validatedManifest.version;
    const newVersion = getNewPackageVersion(currentVersion, versionSpecifier);

    return {
      package: pkg,
      newVersion: newVersion.toString(),
      shouldUpdateChangelog: true,
    };
  });

  return {
    newVersion: newReleaseVersion,
    packages: [rootReleasePlan, ...workspaceReleasePlans],
  };
}

/**
 * Bumps versions and updates changelogs of packages within the monorepo
 * according to the release plan.
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
) {
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
