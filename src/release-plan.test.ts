import fs from 'fs';
import { SemVer } from 'semver';
import { vitest } from 'vitest';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers.js';
import { planRelease, executeReleasePlan } from './release-plan.js';
import { IncrementableVersionParts } from './release-specification.js';
import * as packageUtils from './package.js';

vitest.mock('./package');

describe('release-plan-utils', () => {
  describe('planRelease', () => {
    it('calculates final versions for all packages in the release spec, including bumping the ordinary part of the root package if this is an ordinary release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root', '1.0.0'),
        workspacePackages: {
          a: buildMockPackage('a', '1.0.0'),
          b: buildMockPackage('b', '1.0.0'),
          c: buildMockPackage('c', '1.0.0'),
          d: buildMockPackage('d', '1.0.0'),
        },
      });
      const releaseSpecification = {
        packages: {
          a: IncrementableVersionParts.major,
          b: IncrementableVersionParts.minor,
          c: IncrementableVersionParts.patch,
          d: new SemVer('1.2.3'),
        },
        path: '/path/to/release/spec',
      };
      const newReleaseVersion = '2.0.0';
      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        newReleaseVersion,
      });

      expect(releasePlan).toMatchObject({
        newVersion: newReleaseVersion,
        packages: [
          {
            package: project.rootPackage,
            newVersion: '2.0.0',
          },
          {
            package: project.workspacePackages.a,
            newVersion: '2.0.0',
          },
          {
            package: project.workspacePackages.b,
            newVersion: '1.1.0',
          },
          {
            package: project.workspacePackages.c,
            newVersion: '1.0.1',
          },
          {
            package: project.workspacePackages.d,
            newVersion: '1.2.3',
          },
        ],
      });
    });

    it('calculates final versions for all packages in the release spec, including bumping the backport part of the root package if this is a backport release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root', '1.0.0'),
        workspacePackages: {
          a: buildMockPackage('a', '1.0.0'),
          b: buildMockPackage('b', '1.0.0'),
          c: buildMockPackage('c', '1.0.0'),
          d: buildMockPackage('d', '1.0.0'),
        },
      });
      const releaseSpecification = {
        packages: {
          a: IncrementableVersionParts.major,
          b: IncrementableVersionParts.minor,
          c: IncrementableVersionParts.patch,
          d: new SemVer('1.2.3'),
        },
        path: '/path/to/release/spec',
      };
      const newReleaseVersion = '1.1.0';
      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        newReleaseVersion,
      });

      expect(releasePlan).toMatchObject({
        newVersion: newReleaseVersion,
        packages: [
          {
            package: project.rootPackage,
            newVersion: '1.1.0',
          },
          {
            package: project.workspacePackages.a,
            newVersion: '2.0.0',
          },
          {
            package: project.workspacePackages.b,
            newVersion: '1.1.0',
          },
          {
            package: project.workspacePackages.c,
            newVersion: '1.0.1',
          },
          {
            package: project.workspacePackages.d,
            newVersion: '1.2.3',
          },
        ],
      });
    });

    it('records that the changelog for the root package does not need to be updated, while those for the workspace packages do', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root'),
        workspacePackages: {
          a: buildMockPackage('a', '1.0.0'),
          b: buildMockPackage('b', '1.0.0'),
          c: buildMockPackage('c', '1.0.0'),
          d: buildMockPackage('d', '1.0.0'),
        },
      });
      const releaseSpecification = {
        packages: {
          a: new SemVer('2.0.0'),
          b: new SemVer('2.0.0'),
          c: new SemVer('2.0.0'),
          d: new SemVer('2.0.0'),
        },
        path: '/path/to/release/spec',
      };
      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        newReleaseVersion: '2.0.0',
      });

      expect(releasePlan).toMatchObject({
        packages: [
          {
            package: project.rootPackage,
          },
          {
            package: project.workspacePackages.a,
          },
          {
            package: project.workspacePackages.b,
          },
          {
            package: project.workspacePackages.c,
          },
          {
            package: project.workspacePackages.d,
          },
        ],
      });
    });
  });

  describe('executeReleasePlan', () => {
    it('runs updatePackage for each package in the release plan', async () => {
      const project = buildMockProject();
      const releasePlan = {
        newVersion: '1.0.0',
        packages: [
          {
            package: buildMockPackage(),
            newVersion: '1.2.3',
          },
          {
            package: buildMockPackage(),
            newVersion: '1.2.3',
          },
        ],
      };
      const stderr = fs.createWriteStream('/dev/null');
      const updatePackageSpy = vitest.spyOn(packageUtils, 'updatePackage');

      await executeReleasePlan(project, releasePlan, stderr);

      expect(updatePackageSpy).toHaveBeenNthCalledWith(1, {
        project,
        packageReleasePlan: releasePlan.packages[0],
        stderr,
      });
      expect(updatePackageSpy).toHaveBeenNthCalledWith(2, {
        project,
        packageReleasePlan: releasePlan.packages[1],
        stderr,
      });
    });
  });
});
