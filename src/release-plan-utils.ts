import type { WriteStream } from 'fs';
import { SemVer } from 'semver';
import { format as formatDate } from 'date-fns';
import { debug } from './misc-utils';
import { Package, updatePackage } from './package-utils';
import { Project } from './project-utils';
import { ReleaseSpecification } from './release-specification-utils';

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
  releaseDate: Date;
  releaseNumber: number;
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
 * Uses the release specification to calculate the final versions of all of the
 * packages that we want to update, as well as a new release name.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseSpecification - A parsed version of the release spec
 * entered by the user.
 * @param args.today - The current date.
 * @returns A promise for information about the new release.
 */
export async function planRelease({
  project,
  releaseSpecification,
  today,
}: {
  project: Project;
  releaseSpecification: ReleaseSpecification;
  today: Date;
}): Promise<ReleasePlan> {
  const newReleaseDate = today
    .toISOString()
    .replace(/T.+$/u, '')
    .replace(/\D+/gu, '');
  const newReleaseNumber = project.releaseInfo.releaseNumber + 1;
  const newRootVersion = `${newReleaseDate}.${newReleaseNumber}.0`;

  const rootReleasePlan: PackageReleasePlan = {
    package: project.rootPackage,
    newVersion: newRootVersion,
    shouldUpdateChangelog: false,
  };

  const workspaceReleasePlans: PackageReleasePlan[] = Object.keys(
    releaseSpecification.packages,
  ).map((packageName) => {
    const pkg = project.workspacePackages[packageName];
    const versionSpecifier = releaseSpecification.packages[packageName];
    const currentVersion = pkg.validatedManifest.version;
    const newVersion =
      versionSpecifier instanceof SemVer
        ? versionSpecifier.toString()
        : new SemVer(currentVersion.toString())
            .inc(versionSpecifier)
            .toString();

    return {
      package: pkg,
      newVersion,
      shouldUpdateChangelog: true,
    };
  });

  return {
    releaseDate: today,
    releaseNumber: newReleaseNumber,
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
