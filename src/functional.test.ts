import { withMonorepoProjectEnvironment } from '../tests/functional/helpers/with';
import { buildChangelog } from '../tests/functional/helpers/utils';

describe('create-release-branch (functional)', () => {
  describe('against a monorepo with independent versions', () => {
    it('updates the version of the root package to be the current date along with the versions of the specified packages', async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '2022.1.1',
              directoryPath: '.',
            },
            a: {
              name: '@scope/a',
              version: '0.1.2',
              directoryPath: 'packages/a',
            },
            b: {
              name: '@scope/b',
              version: '1.1.4',
              directoryPath: 'packages/b',
            },
            c: {
              name: '@scope/c',
              version: '2.0.13',
              directoryPath: 'packages/c',
            },
            d: {
              name: '@scope/d',
              version: '1.7.12',
              directoryPath: 'packages/d',
            },
            e: {
              name: '@scope/e',
              version: '0.0.3',
              directoryPath: 'packages/e',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
          today: new Date('2022-06-24'),
        },
        async (environment) => {
          await environment.updateJsonFile('package.json', {
            scripts: {
              foo: 'bar',
            },
          });
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            scripts: {
              foo: 'bar',
            },
          });
          await environment.updateJsonFileWithinPackage('b', 'package.json', {
            scripts: {
              foo: 'bar',
            },
          });
          await environment.updateJsonFileWithinPackage('c', 'package.json', {
            scripts: {
              foo: 'bar',
            },
          });
          await environment.updateJsonFileWithinPackage('d', 'package.json', {
            scripts: {
              foo: 'bar',
            },
          });
          await environment.updateJsonFileWithinPackage('e', 'package.json', {
            scripts: {
              foo: 'bar',
            },
          });

          await environment.runScript({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'minor',
                c: 'patch',
                d: '1.2.3',
              },
            },
          });

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '2022.6.24',
            private: true,
            workspaces: ['packages/*'],
            scripts: { foo: 'bar' },
          });
          expect(
            await environment.readJsonFileWithinPackage('a', 'package.json'),
          ).toStrictEqual({
            name: '@scope/a',
            version: '1.0.0',
            scripts: { foo: 'bar' },
          });
          expect(
            await environment.readJsonFileWithinPackage('b', 'package.json'),
          ).toStrictEqual({
            name: '@scope/b',
            version: '1.2.0',
            scripts: { foo: 'bar' },
          });
          expect(
            await environment.readJsonFileWithinPackage('c', 'package.json'),
          ).toStrictEqual({
            name: '@scope/c',
            version: '2.0.14',
            scripts: { foo: 'bar' },
          });
          expect(
            await environment.readJsonFileWithinPackage('d', 'package.json'),
          ).toStrictEqual({
            name: '@scope/d',
            version: '1.2.3',
            scripts: { foo: 'bar' },
          });
          expect(
            await environment.readJsonFileWithinPackage('e', 'package.json'),
          ).toStrictEqual({
            name: '@scope/e',
            version: '0.0.3',
            scripts: { foo: 'bar' },
          });
        },
      );
    });

    it("updates each of the specified package's changelog by adding a new section which lists all commits concerning the package over the entire history of the repo", async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '1.0.0',
              directoryPath: '.',
            },
            a: {
              name: '@scope/a',
              version: '1.0.0',
              directoryPath: 'packages/a',
            },
            b: {
              name: '@scope/b',
              version: '1.0.0',
              directoryPath: 'packages/b',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
          createInitialCommit: false,
        },
        async (environment) => {
          // Create an initial commit
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.writeFileWithinPackage(
            'b',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');

          // Create another commit that only changes "a"
          await environment.writeFileWithinPackage(
            'a',
            'dummy.txt',
            'Some content',
          );
          await environment.createCommit('Update "a"');

          // Run the script
          await environment.runScript({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'major',
              },
            },
          });

          // Both changelogs should get updated, with an additional
          // commit listed for "a"
          expect(
            await environment.readFileWithinPackage('a', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]
              ### Uncategorized
              - Update "a"
              - Initial commit

              [Unreleased]: https://github.com/example-org/example-repo/compare/v2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/v2.0.0
            `),
          );
          expect(
            await environment.readFileWithinPackage('b', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]
              ### Uncategorized
              - Initial commit

              [Unreleased]: https://github.com/example-org/example-repo/compare/v2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/v2.0.0
            `),
          );
        },
      );
    });

    it('commits the updates and saves the new commit to a new branch, then switches to that branch', async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '1.0.0',
              directoryPath: '.',
            },
            a: {
              name: '@scope/a',
              version: '1.0.0',
              directoryPath: 'packages/a',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
          today: new Date('2022-06-24'),
        },
        async (environment) => {
          await environment.runScript({
            releaseSpecification: {
              packages: {
                a: 'major',
              },
            },
          });

          // The most recent commit should be called the right thing, and
          // should be the current one, and should also be called
          // `release/YYYY-MM-DD`
          const mostRecentCommitInfo = (
            await environment.runCommand('git', [
              'log',
              '--pretty=%D%x09%s%x09%H',
              '--date-order',
              '--max-count=1',
            ])
          ).stdout
            .trim()
            .split('\x09');
          expect(mostRecentCommitInfo.slice(0, -1)).toStrictEqual([
            'HEAD -> release/2022-06-24',
            'Release 2022-06-24',
          ]);
          // The most recent branch should point to the most recent commit
          const commitIdOfMostRecentBranch = (
            await environment.runCommand('git', [
              'rev-list',
              '--branches',
              '--date-order',
              '--max-count=1',
            ])
          ).stdout.trim();
          expect(mostRecentCommitInfo[2]).toStrictEqual(
            commitIdOfMostRecentBranch,
          );
        },
      );
    });
  });
});
