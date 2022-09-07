import { withMonorepoProjectEnvironment } from '../tests/functional/helpers/with';
import { buildChangelog } from '../tests/functional/helpers/utils';

const defaultOptions = {
  packages: {
    $root$: {
      name: '@scope/monorepo',
      version: '20220101.1.0',
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
};

describe('create-release-branch (functional)', () => {
  describe('against a monorepo with independent versions', () => {
    it('updates the version of the root package to be the current date along with the versions of the specified packages', async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '20220101.1.0',
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
          },
          workspaces: {
            '.': ['packages/*'],
          },
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

          await environment.runTool({
            today: new Date(2022, 5, 24),
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
            version: '20220624.2.0',
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
        },
      );
    });

    it("updates each of the specified package's changelog by adding a new section which lists all commits concerning the package over the entire history of the repo", async () => {
      await withMonorepoProjectEnvironment(
        {
          repositoryUrl: 'https://github.com/example-org/example-repo',
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '20220101.1.0',
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
          await environment.runTool({
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
              version: '20220101.1.0',
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
        },
        async (environment) => {
          await environment.runTool({
            today: new Date(2022, 5, 24),
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
            'HEAD -> release/2022-06-24/2',
            'Release 2022-06-24 (R2)',
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

    it('errors before making any changes if the edited release spec omits changed packages', async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '20220101.1.0',
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
            c: {
              name: '@scope/c',
              version: '1.0.0',
              directoryPath: 'packages/c',
            },
            d: {
              name: '@scope/d',
              version: '1.0.0',
              directoryPath: 'packages/d',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
        },
        async (environment) => {
          await expect(
            environment.runTool({
              today: new Date(2022, 5, 24),
              releaseSpecification: {
                packages: {
                  a: 'major',
                  c: 'patch',
                },
              },
            }),
          ).toThrowExecaError(
            `
Error: Your release spec could not be processed due to the following issues:

* The following packages, which have changed since their latest release, are missing.

  - @scope/b
  - @scope/d

  Consider including them in the release spec so that any packages that rely on them won't break in production.

  If you are ABSOLUTELY SURE that this won't occur, however, and want to postpone the release of a package, then list it with a directive of "intentionally-skip". For example:

    packages:
      "@scope/b": intentionally-skip
      "@scope/d": intentionally-skip

The release spec file has been retained for you to make the necessary fixes. Once you've done this, re-run this tool.

<<release-spec-file-path>>
<<backtrace>>
`.trim(),
            {
              replacements: [
                {
                  from: `${environment.tempDirectoryPath}/RELEASE_SPEC`,
                  to: '<<release-spec-file-path>>',
                },
              ],
            },
          );

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '20220101.1.0',
            private: true,
            workspaces: ['packages/*'],
          });
          expect(
            await environment.readJsonFileWithinPackage('a', 'package.json'),
          ).toStrictEqual({
            name: '@scope/a',
            version: '1.0.0',
          });
          expect(
            await environment.readJsonFileWithinPackage('b', 'package.json'),
          ).toStrictEqual({
            name: '@scope/b',
            version: '1.0.0',
          });
          expect(
            await environment.readJsonFileWithinPackage('c', 'package.json'),
          ).toStrictEqual({
            name: '@scope/c',
            version: '1.0.0',
          });
          expect(
            await environment.readJsonFileWithinPackage('d', 'package.json'),
          ).toStrictEqual({
            name: '@scope/d',
            version: '1.0.0',
          });
        },
      );
    });

    it('errors if both --continue and --abort are given', async () => {
      await withMonorepoProjectEnvironment(
        defaultOptions,
        async (environment) => {
          await expect(
            environment.runTool({
              args: ['--continue', '--abort'],
            }),
          ).rejects.toThrowExecaError(
            /^Error: You cannot provide both --continue and --abort\./u,
          );
        },
      );
    });

    it.only('errors if re-run without --continue or --abort after a release spec has already been generated', async () => {
      await withMonorepoProjectEnvironment(
        defaultOptions,
        async (environment) => {
          // Run tool once without an editor set to get it to generate the
          // release spec template and quit immediately
          const result = await environment.runTool({
            withEditorUnavailable: true,
          });
          console.log('all', result.all);

          // Run the tool again
          await expect(environment.runTool()).rejects.toThrowExecaError(
            `
Error: It looks like you are in the middle of a run. This could either mean that you haven't edited the release spec yet, or you have and the tool unexpectedly stopped while executing it.

You can re-run this tool with --continue if you want to resume the run, or you can use --abort if you want to revert all changes made so far and start over.

If you need to access the release spec again, here is its path:

<<release-spec-file-path>>
<<backtrace>>
`.trim(),
            {
              replacements: [
                {
                  from: `${environment.tempDirectoryPath}/RELEASE_SPEC`,
                  to: '<<release-spec-file-path>>',
                },
              ],
            },
          );
        },
      );
    }, 10000);

    it('errors if --continue is given but no release spec has been generated yet', async () => {
      await withMonorepoProjectEnvironment(
        defaultOptions,
        async (environment) => {
          await expect(
            environment.runTool({
              args: ['--continue'],
            }),
          ).rejects.toThrowExecaError(
            `
Error: It looks like you are in the middle of a run. Please ensure that the release spec is to your liking and re-run this tool with --continue to resume the run. Or, run --abort if you want to discard the run and all existing changes.

The path to the release spec is:

<<release-spec-file-path>>
<<backtrace>>
`.trim(),
            {
              replacements: [
                {
                  from: `${environment.tempDirectoryPath}/RELEASE_SPEC`,
                  to: '<<release-spec-file-path>>',
                },
              ],
            },
          );
        },
      );
    });

    it('re-applies a previously edited template spec to the project when --continue is given, even if some changes have already been applied', async () => {
      await withMonorepoProjectEnvironment(
        {
          repositoryUrl: 'https://github.com/example-org/example-repo',
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '20220101.1.0',
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
            c: {
              name: '@scope/c',
              version: '1.0.0',
              directoryPath: 'packages/c',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
          createInitialCommit: false,
        },
        async (environment) => {
          // Create an initial commit
          await environment.createCommit('Initial commit');

          // Run tool once without an editor set to get it to generate the
          // release spec template and quit immediately
          await environment.runTool({
            today: new Date(2022, 5, 24),
            withEditorUnavailable: true,
          });

          // Manually apply some changes to the repo to simulate the tool
          // crashing midway through a run
          await environment.updateJsonFile('package.json', {
            version: '20220624.2.0',
          });
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            version: '2.0.0',
          });
          await environment.writeFileWithinPackage(
            'b',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]
              ### Uncategorized
              - Initial commit

              [Unreleased]: https://github.com/example-org/example-repo/compare/v2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/v2.0.0
            `),
          );

          // Re-run the tool, using `--continue` this time
          await environment.runTool({
            today: new Date(2022, 5, 24),
            args: ['--continue'],
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'major',
                c: 'major',
              },
            },
          });

          // The changes that were already applied should remain, and the
          // remaining changes should be applied
          expect(await environment.readJsonFile('package.json')).toMatchObject({
            version: '20220624.2.0',
          });
          expect(
            await environment.readJsonFileWithinPackage('a', 'package.json'),
          ).toMatchObject({
            version: '2.0.0',
          });
          expect(
            await environment.readFileWithinPackage('a', 'CHANGELOG.md'),
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
          expect(
            await environment.readJsonFileWithinPackage('b', 'package.json'),
          ).toStrictEqual({
            version: '2.0.0',
          });
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
          expect(
            await environment.readJsonFileWithinPackage('c', 'package.json'),
          ).toStrictEqual({
            version: '2.0.0',
          });
          expect(
            await environment.readFileWithinPackage('c', 'CHANGELOG.md'),
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
  });
});
