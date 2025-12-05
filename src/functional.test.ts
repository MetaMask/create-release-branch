import { withMonorepoProjectEnvironment } from '../tests/functional/helpers/with.js';
import { buildChangelog } from '../tests/helpers.js';

jest.setTimeout(10_000);

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

          expect(await environment.readJsonFile('package.json')).toMatchObject({
            name: '@scope/monorepo',
            version: '2.0.0',
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

          expect(await environment.readJsonFile('package.json')).toMatchObject({
            name: '@scope/monorepo',
            version: '1.1.0',
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

          // Tests five things:
          // * The latest commit should be called "Update Release 2.0.0"
          // * The before latest commit should be called "Initialize Release 2.0.0"
          // * The latest commit should be the current commit (HEAD)
          // * The latest branch should be called "release/2.0.0"
          // * The latest branch should point to the latest commit
          const latestCommitsInReverse = (
            await environment.runCommand('git', [
              'log',
              '--pretty=%s%x09%H%x09%D',
              '--date-order',
              '--max-count=2',
            ])
          ).stdout
            .split('\n')
            .map((line) => {
              const [subject, commitId, revsMarker] = line.split('\x09');
              const revs = revsMarker.split(' -> ');
              return { subject, commitId, revs };
            });
          const latestBranchCommitId = (
            await environment.runCommand('git', [
              'rev-list',
              '--branches',
              '--date-order',
              '--max-count=1',
            ])
          ).stdout;
          expect(latestCommitsInReverse[0].subject).toBe(
            'Update Release 2.0.0',
          );
          expect(latestCommitsInReverse[1].subject).toBe(
            'Initialize Release 2.0.0',
          );

          expect(latestCommitsInReverse[0].revs).toContain('HEAD');
          expect(latestCommitsInReverse[0].revs).toContain('release/2.0.0');

          expect(latestBranchCommitId).toStrictEqual(
            latestCommitsInReverse[0].commitId,
          );
        },
      );
    });

    it('updates the dependency version in package "b" when package "a" version is bumped', async () => {
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
              version: '2.0.0',
              directoryPath: 'packages/b',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
        },
        async (environment) => {
          await environment.updateJsonFileWithinPackage('b', 'package.json', {
            dependencies: {
              '@scope/a': '1.0.0',
            },
          });
          const constraintsProContent = `
          % All packages must have a name and version defined.
          \\+ gen_enforced_field(_, 'name', null).
          \\+ gen_enforced_field(_, 'version', null).

          % All version ranges used to reference one workspace package in another workspace package's \`dependencies\` or \`devDependencies\` must match the current version of that package.
          gen_enforced_dependency(Pkg, DependencyIdent, CorrectDependencyRange, DependencyType) :-
            DependencyType \\= 'peerDependencies',
            workspace_has_dependency(Pkg, DependencyIdent, _, DependencyType),
            workspace_ident(DepPkg, DependencyIdent),
            workspace_version(DepPkg, DependencyVersion),
            atomic_list_concat(['^', DependencyVersion], CorrectDependencyRange),
            Pkg \\= DepPkg. % Ensure we do not add self-dependency

          % Entry point to check all constraints.
          workspace_package(Pkg) :-
            package_json(Pkg, _, _).

          enforce_all :-
            workspace_package(Pkg),
            enforce_has_name(Pkg),
            enforce_has_version(Pkg),
            (package_json(Pkg, 'dependencies', Deps) -> enforce_dependencies(Pkg, Deps) ; true).

          enforce_has_name(Pkg) :-
            package_json(Pkg, 'name', _).

          enforce_has_version(Pkg) :-
            package_json(Pkg, 'version', _).

          enforce_dependencies(_, []).
          enforce_dependencies(Pkg, [DepPkg-DepVersion | Rest]) :-
            workspace_package(DepPkg),
            package_json(DepPkg, 'version', DepVersion),
            enforce_dependency_version(Pkg, DepPkg),
            enforce_dependencies(Pkg, Rest).

          enforce_dependency_version(Pkg, DepPkg) :-
            package_json(Pkg, 'dependencies', Deps),
            package_json(DepPkg, 'version', DepVersion),
            member(DepPkg-DepVersion, Deps).

          update_dependency_version(Pkg, DepPkg) :-
            package_json(Pkg, 'dependencies', Deps),
            package_json(DepPkg, 'version', DepVersion),
            \\+ member(DepPkg-DepVersion, Deps),
            Pkg \\= DepPkg, % Ensure we do not add self-dependency
            set_package_json(Pkg, 'dependencies', DepPkg, DepVersion).
          `;

          await environment.writeFile('constraints.pro', constraintsProContent);
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'intentionally-skip',
              },
            },
          });

          expect(
            await environment.readJsonFileWithinPackage('a', 'package.json'),
          ).toStrictEqual({
            name: '@scope/a',
            version: '2.0.0',
          });
          expect(
            await environment.readJsonFileWithinPackage('b', 'package.json'),
          ).toStrictEqual({
            name: '@scope/b',
            version: '2.0.0',
            dependencies: { '@scope/a': '^2.0.0' },
          });
        },
      );
    });

    it('updates the yarn lock file', async () => {
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
              version: '2.0.0',
              directoryPath: 'packages/b',
            },
          },
          workspaces: {
            '.': ['packages/*'],
          },
        },
        async (environment) => {
          await environment.updateJsonFileWithinPackage('b', 'package.json', {
            dependencies: {
              '@scope/a': '1.0.0',
            },
          });
          const constraintsProContent = `
          % All packages must have a name and version defined.
          \\+ gen_enforced_field(_, 'name', null).
          \\+ gen_enforced_field(_, 'version', null).

          % All version ranges used to reference one workspace package in another workspace package's \`dependencies\` or \`devDependencies\` must match the current version of that package.
          gen_enforced_dependency(Pkg, DependencyIdent, CorrectDependencyRange, DependencyType) :-
            DependencyType \\= 'peerDependencies',
            workspace_has_dependency(Pkg, DependencyIdent, _, DependencyType),
            workspace_ident(DepPkg, DependencyIdent),
            workspace_version(DepPkg, DependencyVersion),
            atomic_list_concat(['^', DependencyVersion], CorrectDependencyRange),
            Pkg \\= DepPkg. % Ensure we do not add self-dependency

          % Entry point to check all constraints.
          workspace_package(Pkg) :-
            package_json(Pkg, _, _).

          enforce_all :-
            workspace_package(Pkg),
            enforce_has_name(Pkg),
            enforce_has_version(Pkg),
            (package_json(Pkg, 'dependencies', Deps) -> enforce_dependencies(Pkg, Deps) ; true).

          enforce_has_name(Pkg) :-
            package_json(Pkg, 'name', _).

          enforce_has_version(Pkg) :-
            package_json(Pkg, 'version', _).

          enforce_dependencies(_, []).
          enforce_dependencies(Pkg, [DepPkg-DepVersion | Rest]) :-
            workspace_package(DepPkg),
            package_json(DepPkg, 'version', DepVersion),
            enforce_dependency_version(Pkg, DepPkg),
            enforce_dependencies(Pkg, Rest).

          enforce_dependency_version(Pkg, DepPkg) :-
            package_json(Pkg, 'dependencies', Deps),
            package_json(DepPkg, 'version', DepVersion),
            member(DepPkg-DepVersion, Deps).

          update_dependency_version(Pkg, DepPkg) :-
            package_json(Pkg, 'dependencies', Deps),
            package_json(DepPkg, 'version', DepVersion),
            \\+ member(DepPkg-DepVersion, Deps),
            Pkg \\= DepPkg, % Ensure we do not add self-dependency
            set_package_json(Pkg, 'dependencies', DepPkg, DepVersion).
          `;
          await environment.writeFile('constraints.pro', constraintsProContent);
          const outdatedLockfile = `
          # This file is generated by running "yarn install" inside your project.
          # Manual changes might be lost - proceed with caution!

          __metadata:
            version: 6

          "@scope/a@^1.0.0, @scope/a@workspace:packages/a":
            version: 0.0.0-use.local
            resolution: "@scope/a@workspace:packages/a"
            languageName: unknown
            linkType: soft

          "@scope/b@workspace:packages/b":
            version: 0.0.0-use.local
            resolution: "@scope/b@workspace:packages/b"
            dependencies:
              "@scope/a": ^1.0.0
            languageName: unknown
            linkType: soft

          "@scope/monorepo@workspace:.":
            version: 0.0.0-use.local
            resolution: "@scope/monorepo@workspace:."
            languageName: unknown
            linkType: soft`;
          await environment.writeFile('yarn.lock', outdatedLockfile);
          await environment.runTool({
            releaseSpecification: {
              packages: {
                a: 'major',
                b: 'intentionally-skip',
              },
            },
          });

          const updatedLockfile = `# This file is generated by running "yarn install" inside your project.
# Manual changes might be lost - proceed with caution!

__metadata:
  version: 6

"@scope/a@^2.0.0, @scope/a@workspace:packages/a":
  version: 0.0.0-use.local
  resolution: "@scope/a@workspace:packages/a"
  languageName: unknown
  linkType: soft

"@scope/b@workspace:packages/b":
  version: 0.0.0-use.local
  resolution: "@scope/b@workspace:packages/b"
  dependencies:
    "@scope/a": ^2.0.0
  languageName: unknown
  linkType: soft

"@scope/monorepo@workspace:.":
  version: 0.0.0-use.local
  resolution: "@scope/monorepo@workspace:."
  languageName: unknown
  linkType: soft
`;

          expect(await environment.readFile('yarn.lock')).toStrictEqual(
            updatedLockfile,
          );
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

          expect(await environment.readJsonFile('package.json')).toMatchObject({
            name: '@scope/monorepo',
            version: '2.0.0',
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

  describe('check-deps command', () => {
    it('detects dependency bumps and validates changelogs', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump dependency version
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump @scope/b to 2.0.0');

          // Run check-deps
          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
          });

          // Should detect the dependency bump and report missing changelog entry
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('@scope/b');
          expect(result.stdout).toContain('1.0.0');
          expect(result.stdout).toContain('2.0.0');
          // The error could be about missing section or missing entries
          expect(
            result.stderr.includes('Missing') ||
              result.stderr.includes('No [Unreleased] section'),
          ).toBe(true);
        },
      );
    });

    it('automatically fixes missing changelog entries with --fix', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump dependency version
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump @scope/b to 2.0.0');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '123',
          });

          // Should update the changelog
          expect(result.exitCode).toBe(0);
          // Verify changes were detected
          expect(result.stdout).toContain('@scope/b');
          // Verify the command tried to update
          expect(result.stdout).toContain('Updating changelogs');
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](https://github.com/example-org/example-repo/pull/123))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
        },
      );
    });

    it('detects peerDependency bumps', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            peerDependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump peerDependency version
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            peerDependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit(
            'Bump @scope/b peerDependency to 2.0.0',
          );

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '456',
          });

          // Should detect and update peerDependency change
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - **BREAKING:** Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#456](https://github.com/example-org/example-repo/pull/456))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
        },
      );
    });

    it('detects non-scoped package dependency bumps', async () => {
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
          createInitialCommit: false,
        },
        async (environment) => {
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              lodash: '4.17.20',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump non-scoped dependency
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              lodash: '4.17.21',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump lodash to 4.17.21');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '789',
          });

          // Should detect and update non-scoped package change
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`lodash\` from \`4.17.20\` to \`4.17.21\` ([#789](https://github.com/example-org/example-repo/pull/789))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
        },
      );
    });

    it('validates existing changelog entries correctly', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#123](https://github.com/example-org/example-repo/pull/123))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump dependency version
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump @scope/b to 2.0.0');

          // Run check-deps
          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
          });

          // Should validate that changelog entry exists
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('All entries present');
          expect(result.stderr).not.toContain('Missing');
        },
      );
    });

    it('handles multiple dependency bumps in the same package', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
              '@scope/c': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump multiple dependencies
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '2.0.0',
              '@scope/c': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump multiple dependencies');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '999',
          });

          // Should detect and update all dependency changes
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#999](https://github.com/example-org/example-repo/pull/999))
              - Bump \`@scope/c\` from \`1.0.0\` to \`2.0.0\` ([#999](https://github.com/example-org/example-repo/pull/999))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
        },
      );
    });

    it('orders BREAKING changes before regular dependencies', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
              '@scope/c': '1.0.0',
            },
            peerDependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              [Unreleased]: https://github.com/example-org/example-repo
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump both dependency and peerDependency
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '2.0.0',
              '@scope/c': '2.0.0',
            },
            peerDependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit(
            'Bump dependencies and peerDependencies',
          );

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '111',
          });

          // Should order BREAKING (peerDeps) first, then regular deps
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );

          // Find the Changed section
          const changedSectionStart = changelog.indexOf('### Changed');
          expect(changedSectionStart).toBeGreaterThan(-1);

          // Extract the Changed section content
          const changedSection = changelog.substring(changedSectionStart);

          // Find BREAKING entry (for @scope/b peerDependency)
          const breakingIndex = changedSection.indexOf('**BREAKING:**');
          expect(breakingIndex).toBeGreaterThan(-1);

          // Find regular dependency entries (for @scope/b and @scope/c dependencies)
          const regularDepBIndex = changedSection.indexOf('Bump `@scope/b`');
          const regularDepCIndex = changedSection.indexOf('Bump `@scope/c`');

          // BREAKING entry should appear before regular dependency entries
          expect(regularDepBIndex).toBeGreaterThan(-1);
          expect(regularDepCIndex).toBeGreaterThan(-1);
          expect(breakingIndex).toBeLessThan(regularDepBIndex);
          expect(breakingIndex).toBeLessThan(regularDepCIndex);
        },
      );
    });

    it('updates existing changelog entry when dependency is bumped again', async () => {
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
          // Set up initial state with existing changelog entry
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#100](https://github.com/example-org/example-repo/pull/100))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump dependency version again (from 2.0.0 to 3.0.0)
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            dependencies: {
              '@scope/b': '3.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump @scope/b to 3.0.0');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '200',
          });

          // Should update the existing entry with new version and preserve old PR
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`3.0.0\` ([#100](https://github.com/example-org/example-repo/pull/100), [#200](https://github.com/example-org/example-repo/pull/200))

              [Unreleased]: https://github.com/example-org/example-repo/
            `),
          );
        },
      );
    });

    it('handles renamed packages correctly', async () => {
      await withMonorepoProjectEnvironment(
        {
          packages: {
            $root$: {
              name: '@scope/monorepo',
              version: '1.0.0',
              directoryPath: '.',
            },
            a: {
              name: '@scope/renamed-package',
              version: '6.0.0',
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
          // Set up initial state with package rename info in scripts
          // Package was renamed from "old-package-name" to "@scope/renamed-package" at version 5.0.1
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            name: '@scope/renamed-package',
            version: '6.0.0',
            dependencies: {
              '@scope/b': '1.0.0',
            },
            scripts: {
              'auto-changelog':
                'auto-changelog --tag-prefix-before-package-rename old-package-name@ --version-before-package-rename 5.0.1',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          // Changelog has historical entries with old package name (before 5.0.1)
          // and entries with new package name (after 5.0.1)
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              ## [6.0.0]

              ### Changed

              - Some change in version 6.0.0

              ## [5.0.1]

              ### Changed

              - Package renamed from old-package-name to @scope/renamed-package

              ## [5.0.0]

              ### Changed

              - Some change in version 5.0.0 (old package name)

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/renamed-package@6.0.0...HEAD
              [6.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/renamed-package@6.0.0
              [5.0.1]: https://github.com/example-org/example-repo/releases/tag/@scope/renamed-package@5.0.1
              [5.0.0]: https://github.com/example-org/example-repo/releases/tag/old-package-name@5.0.0
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump dependency version
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            name: '@scope/renamed-package',
            version: '6.0.0',
            dependencies: {
              '@scope/b': '2.0.0',
            },
            scripts: {
              'auto-changelog':
                'auto-changelog --tag-prefix-before-package-rename old-package-name@ --version-before-package-rename 5.0.1',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Bump @scope/b to 2.0.0');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '300',
          });

          // Should detect and update dependency change, preserving historical entries
          // and maintaining both old and new tag prefixes in links
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          // Verify the new entry was added to Unreleased section
          expect(changelog).toContain(
            'Bump `@scope/b` from `1.0.0` to `2.0.0`',
          );
          expect(changelog).toContain('[#300]');
          // Verify historical entries are preserved
          expect(changelog).toContain('Some change in version 6.0.0');
          expect(changelog).toContain('Some change in version 5.0.0');
          expect(changelog).toContain(
            'Package renamed from old-package-name to @scope/renamed-package',
          );
          // Verify links reference both old and new tag prefixes correctly
          // Versions before rename (5.0.0, 5.0.1) use old package name
          expect(changelog).toContain('old-package-name@5.0.0');
          // Versions after rename (6.0.0+) use new package name
          expect(changelog).toContain('@scope/renamed-package@6.0.0');
          // Verify Unreleased link uses new package name
          expect(changelog).toContain(
            '[Unreleased]: https://github.com/example-org/example-repo/compare/@scope/renamed-package@6.0.0...HEAD',
          );
        },
      );
    });

    it('adds changelog entry under release version when package is being released', async () => {
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
          // Set up initial state
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            name: '@scope/a',
            version: '1.0.0',
            dependencies: {
              '@scope/b': '1.0.0',
            },
          });
          // Format the JSON file so the diff parser can work with it
          const initialPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(initialPkg, null, 2)}\n`,
          );
          // Create changelog with [2.0.0] section already present
          // (in real scenarios, this would be created by the release process)
          await environment.writeFileWithinPackage(
            'a',
            'CHANGELOG.md',
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]

              ## [1.0.0]

              ### Changed

              - Initial release

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/compare/@scope/a@1.0.0...@scope/a@2.0.0
              [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@1.0.0
            `),
          );
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Bump both package version and dependency version
          // The [2.0.0] section will be created by auto-changelog when we add the entry
          await environment.updateJsonFileWithinPackage('a', 'package.json', {
            name: '@scope/a',
            version: '2.0.0',
            dependencies: {
              '@scope/b': '2.0.0',
            },
          });
          // Format the JSON file again
          const updatedPkg = await environment.readJsonFileWithinPackage(
            'a',
            'package.json',
          );
          await environment.writeFileWithinPackage(
            'a',
            'package.json',
            `${JSON.stringify(updatedPkg, null, 2)}\n`,
          );
          await environment.createCommit('Release 2.0.0 and bump @scope/b');

          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
            fix: true,
            prNumber: '400',
          });

          // Should add entry under [2.0.0] section, not [Unreleased]
          expect(result.exitCode).toBe(0);
          const changelog = await environment.readFileWithinPackage(
            'a',
            'CHANGELOG.md',
          );
          expect(changelog).toStrictEqual(
            buildChangelog(`
              ## [Unreleased]

              ## [2.0.0]

              ### Changed

              - Bump \`@scope/b\` from \`1.0.0\` to \`2.0.0\` ([#400](https://github.com/example-org/example-repo/pull/400))

              ## [1.0.0]

              ### Changed

              - Initial release

              [Unreleased]: https://github.com/example-org/example-repo/compare/@scope/a@2.0.0...HEAD
              [2.0.0]: https://github.com/example-org/example-repo/compare/@scope/a@1.0.0...@scope/a@2.0.0
              [1.0.0]: https://github.com/example-org/example-repo/releases/tag/@scope/a@1.0.0
            `),
          );
        },
      );
    });

    it('reports no changes when no dependency bumps are found', async () => {
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
          createInitialCommit: false,
        },
        async (environment) => {
          await environment.createCommit('Initial commit');
          const baseCommit = (
            await environment.runCommand('git', ['rev-parse', 'HEAD'])
          ).stdout.trim();

          // Make a non-dependency change
          await environment.writeFileWithinPackage('a', 'dummy.txt', 'content');
          await environment.createCommit('Non-dependency change');

          // Run check-deps
          const result = await environment.runCheckDeps({
            fromRef: baseCommit,
          });

          // Should report no dependency bumps (or no package.json changes)
          expect(result.exitCode).toBe(0);
          expect(
            result.stdout.includes('No dependency version bumps found') ||
              result.stdout.includes('No package.json changes found'),
          ).toBe(true);
        },
      );
    });
  });
});
