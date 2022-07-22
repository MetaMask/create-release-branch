import fs from 'fs';
import { SemVer } from 'semver';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { IncrementableVersionParts } from './release-specification-utils';
import { planRelease, executeReleasePlan } from './release-plan-utils';
import * as packageUtils from './package-utils';

jest.mock('./package-utils');

describe('release-plan-utils', () => {
  describe('planRelease', () => {
    it('calculates final versions for all packages in the release spec', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root', '20220721.1.0'),
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
      const today = new Date(2022, 7, 1);

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        today,
      });

      expect(releasePlan).toMatchObject({
        releaseDate: today,
        releaseNumber: 2,
        packages: [
          {
            package: project.rootPackage,
            newVersion: '20220801.2.0',
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

    it('merely bumps the build number in the root version if a release is being created on the same day as a previous release', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root', '20220101.1.0'),
        workspacePackages: {},
      });
      const releaseSpecification = {
        packages: {},
        path: '/path/to/release/spec',
      };
      const today = new Date(2022, 0, 1);

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        today,
      });

      expect(releasePlan).toMatchObject({
        packages: [
          {
            package: project.rootPackage,
            newVersion: '20220101.2.0',
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
      const today = new Date();

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        today,
      });

      expect(releasePlan).toMatchObject({
        packages: [
          {
            package: project.rootPackage,
            shouldUpdateChangelog: false,
          },
          {
            package: project.workspacePackages.a,
            shouldUpdateChangelog: true,
          },
          {
            package: project.workspacePackages.b,
            shouldUpdateChangelog: true,
          },
          {
            package: project.workspacePackages.c,
            shouldUpdateChangelog: true,
          },
          {
            package: project.workspacePackages.d,
            shouldUpdateChangelog: true,
          },
        ],
      });
    });
  });

  describe('executeReleasePlan', () => {
    it('runs updatePackage for each package in the release plan', async () => {
      const project = buildMockProject();
      const releasePlan = {
        releaseDate: new Date(),
        releaseNumber: 1,
        packages: [
          {
            package: buildMockPackage(),
            newVersion: '1.2.3',
            shouldUpdateChangelog: true,
          },
          {
            package: buildMockPackage(),
            newVersion: '1.2.3',
            shouldUpdateChangelog: true,
          },
        ],
      };
      const stderr = fs.createWriteStream('/dev/null');
      const updatePackageSpy = jest.spyOn(packageUtils, 'updatePackage');

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
