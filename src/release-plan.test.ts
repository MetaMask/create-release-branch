import fs from 'fs';
import { SemVer } from 'semver';
import { buildMockProject, buildMockPackage } from '../tests/unit/helpers';
import { planRelease, executeReleasePlan } from './release-plan';
import * as packageModule from './package';
import { IncrementableVersionParts } from './release-specification';

jest.mock('./package');
jest.mock('./release-specification');

describe('release-plan', () => {
  describe('planRelease', () => {
    it('calculates final versions for all packages in the release spec', async () => {
      const project = buildMockProject({
        rootPackage: buildMockPackage('root', '2022.1.1'),
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
      const today = new Date('2022-07-21');

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        today,
      });

      expect(releasePlan).toMatchObject({
        releaseName: '2022-07-21',
        packages: [
          {
            package: project.rootPackage,
            newVersion: '2022.7.21',
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
          a: IncrementableVersionParts.major,
          b: IncrementableVersionParts.major,
          c: IncrementableVersionParts.patch,
          d: new SemVer('1.2.3'),
        },
        path: '/path/to/release/spec',
      };
      const today = new Date('2022-07-21');

      const releasePlan = await planRelease({
        project,
        releaseSpecification,
        today,
      });

      expect(releasePlan).toMatchObject({
        releaseName: '2022-07-21',
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
        releaseName: 'some-release-name',
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
      const updatePackageSpy = jest.spyOn(packageModule, 'updatePackage');

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
