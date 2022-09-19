import fs from 'fs';
import { SemVer } from 'semver';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { planRelease, executeReleasePlan } from './release-plan';
import { IncrementableVersionParts } from './release-specification';
import * as packageUtils from './package';

jest.mock('./package');

describe('release-plan-utils', () => {
  describe('planRelease', () => {
    it('calculates final versions for all packages in the release spec', async () => {
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

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
      });

      expect(releasePlan).toMatchObject({
        newVersion: '2.0.0',
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
        newVersion: '1.0.0',
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
