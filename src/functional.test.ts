import { withMonorepoProjectEnvironment } from '../tests/functional/helpers/with';
import { buildChangelog } from '../tests/functional/helpers/utils';

describe('create-release-branch (functional)', () => {
  describe('against a monorepo with independent versions', () => {
    it('bumps the ordinary part of the root package and updates the versions of the specified packages according to the release spec', async () => {
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
              version: '1.2.3',
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
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'minor',
                c: 'patch',
                d: '1.2.4',
              },
            },
          });

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '2.0.0',
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
            version: '1.2.4',
            scripts: { foo: 'bar' },
          });
        },
      );
    });

    it('bumps the backport part of the root package and updates the versions of the specified packages according to the release spec if --backport is provided', async () => {
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
              version: '1.2.3',
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
            args: ['--backport'],
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'minor',
                c: 'patch',
                d: '1.2.4',
              },
            },
          });

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '1.1.0',
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
            version: '1.2.4',
            scripts: { foo: 'bar' },
          });
        },
      );
    });

    it("updates each of the specified packages' changelogs by adding a new section which lists all commits concerning the package over the entire history of the repo", async () => {
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

          // Run the tool
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

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@2.0.0
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

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/b@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/b@2.0.0
            `),
          );
        },
      );
    });

    it('updates package changelogs with package changes since the last package release', async () => {
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

            ## [1.0.0]
            ### Added
            - Initial release

            [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@1.0.0...HEAD
            [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@1.0.0
            `),
          );
          await environment.writeFileWithinPackage(
            'b',
            'CHANGELOG.md',
            buildChangelog(`
            ## [Unreleased]

            ## [1.0.0]
            ### Added
            - Initial release

            [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/b@1.0.0...HEAD
            [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/b@1.0.0
            `),
          );
          await environment.createCommit('Initial commit');
          await environment.runCommand('git', ['tag', '@scope/a@1.0.0']);
          await environment.runCommand('git', ['tag', '@scope/b@1.0.0']);
          await environment.runCommand('git', ['tag', 'v1.0.0']);

          // Create another commit that only changes "a"
          await environment.writeFileWithinPackage(
            'a',
            'dummy.txt',
            'Some content',
          );
          await environment.createCommit('Update "a"');

          // Run the tool
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
              },
            },
          });

          // Only "a" should be updated
          expect(
            await environment.readFileWithinPackage('a', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]
              ### Uncategorized
              - Update "a"

              ## [1.0.0]
              ### Added
              - Initial release

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/compare/@scope/a@1.0.0...@scope/a@2.0.0
              [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@1.0.0
            `),
          );
          expect(
            await environment.readFileWithinPackage('b', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
            ## [Unreleased]

            ## [1.0.0]
            ### Added
            - Initial release

            [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/b@1.0.0...HEAD
            [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/b@1.0.0
            `),
          );
        },
      );
    });

    it('updates package changelogs with package changes since the last root release if this is the first package release', async () => {
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
              version: '0.0.0',
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

            ## [1.0.0]
            ### Added
            - Initial release

            [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/b@1.0.0...HEAD
            [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/b@1.0.0
            `),
          );
          await environment.createCommit('Initial commit');
          await environment.runCommand('git', ['tag', '@scope/b@1.0.0']);
          await environment.runCommand('git', ['tag', 'v1.0.0']);

          // Create another commit that only changes "a"
          await environment.writeFileWithinPackage(
            'a',
            'dummy.txt',
            'Some content',
          );
          await environment.createCommit('Update "a"');

          // Run the tool
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
              },
            },
          });

          // Only "a" should be updated
          expect(
            await environment.readFileWithinPackage('a', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [1.0.0]
              ### Uncategorized
              - Update "a"

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@1.0.0...HEAD
              [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@1.0.0
            `),
          );
          expect(
            await environment.readFileWithinPackage('b', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
            ## [Unreleased]

            ## [1.0.0]
            ### Added
            - Initial release

            [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/b@1.0.0...HEAD
            [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/b@1.0.0
            `),
          );
        },
      );
    });

    it('switches to a new release branch and commits the changes', async () => {
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
        },
        async (environment) => {
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
              },
            },
          });

          // Tests four things:
          // * The latest commit should be called "Release 1.0.0"
          // * The latest commit should be the current commit (HEAD)
          // * The latest branch should be called "release/1.0.0"
          // * The latest branch should point to the latest commit
          const [latestCommitSubject, latestCommitId, latestCommitRevsMarker] =
            (
              await environment.runCommand('git', [
                'log',
                '--pretty=%s%x09%H%x09%D',
                '--date-order',
                '--max-count=1',
              ])
            ).stdout.split('\x09');
          const latestCommitRevs = latestCommitRevsMarker.split(' -> ');
          const latestBranchCommitId = (
            await environment.runCommand('git', [
              'rev-list',
              '--branches',
              '--date-order',
              '--max-count=1',
            ])
          ).stdout;
          expect(latestCommitSubject).toBe('Release 2.0.0');
          expect(latestCommitRevs).toContain('HEAD');
          expect(latestCommitRevs).toContain('release/2.0.0');
          expect(latestBranchCommitId).toStrictEqual(latestCommitId);
        },
      );
    });

    it('errors before making any changes if the edited release spec omits changed packages', async () => {
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
              version: '1.2.3',
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

The release spec file has been retained for you to edit again and make the necessary fixes. Once you've done this, re-run this tool.

<<release-spec-file-path>>
<<stack-trace>>
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
            version: '1.0.0',
            private: true,
            workspaces: ['packages/*'],
          });
          expect(
            await environment.readJsonFileWithinPackage('a', 'package.json'),
          ).toStrictEqual({
            name: '@scope/a',
            version: '0.1.2',
          });
          expect(
            await environment.readJsonFileWithinPackage('b', 'package.json'),
          ).toStrictEqual({
            name: '@scope/b',
            version: '1.1.4',
          });
          expect(
            await environment.readJsonFileWithinPackage('c', 'package.json'),
          ).toStrictEqual({
            name: '@scope/c',
            version: '2.0.13',
          });
          expect(
            await environment.readJsonFileWithinPackage('d', 'package.json'),
          ).toStrictEqual({
            name: '@scope/d',
            version: '1.2.3',
          });
        },
      );
    });

    it('does not update the versions of any packages that have been tagged with intentionally-skip', async () => {
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
              version: '1.2.3',
              directoryPath: 'packages/d',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
        },
        async (environment) => {
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'intentionally-skip',
                c: 'patch',
                d: 'intentionally-skip',
              },
            },
          });

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '2.0.0',
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
            version: '1.1.4',
          });
          expect(
            await environment.readJsonFileWithinPackage('c', 'package.json'),
          ).toStrictEqual({
            name: '@scope/c',
            version: '2.0.14',
          });
          expect(
            await environment.readJsonFileWithinPackage('d', 'package.json'),
          ).toStrictEqual({
            name: '@scope/d',
            version: '1.2.3',
          });
        },
      );
    });

    it('does not update the changelogs of any packages that have been tagged with intentionally-skip', async () => {
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

          // Run the tool
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'intentionally-skip',
              },
            },
          });

          // Only "a" should get updated
          expect(
            await environment.readFileWithinPackage('a', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]
              ### Uncategorized
              - Update "a"
              - Initial commit

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@2.0.0
            `),
          );
          expect(
            await environment.readFileWithinPackage('b', 'CHANGELOG.md'),
          ).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
        },
      );
    });
  });
});
