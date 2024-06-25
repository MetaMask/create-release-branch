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

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '2.0.0',
            private: true,
            workspaces: ['packages/*'],
            scripts: { foo: 'bar' },
            packageManager: 'yarn@3.2.1',
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
            packageManager: 'yarn@3.2.1',
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

          expect(await environment.readJsonFile('package.json')).toStrictEqual({
            name: '@scope/monorepo',
            version: '2.0.0',
            private: true,
            workspaces: ['packages/*'],
            packageManager: 'yarn@3.2.1',
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
