# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0]
### Changed
- **BREAKING:** Format changelogs using Prettier ([#100](https://github.com/MetaMask/create-release-branch/pull/100))
  - This is a breaking change since it changes the default formatting of the changelog in new release PRs. If you have a package script that runs `auto-changelog validate`, or you're calling `auto-changelog validate` in CI, you'll now need to pass the `--prettier` flag (see [example](https://github.com/MetaMask/metamask-module-template/pull/219)).

### Fixed
- Restore support for monorepos that use `workspace:^` references for interdependencies ([#125](https://github.com/MetaMask/create-release-branch/pull/125))

## [2.0.1]
### Fixed
- Move `@metamask/auto-changelog` from `devDependencies` to `dependencies` and pin to ~3.3.0 ([#122](https://github.com/MetaMask/create-release-branch/pull/122))

## [2.0.0]
### Changed
- **BREAKING** Bump minimum Node version to 16 ([#114](https://github.com/MetaMask/create-release-branch/pull/114))
- Reorder workflow to update changelogs first ([#109](https://github.com/MetaMask/create-release-branch/pull/109))
  - When you run this tool you can use the changelogs to decide which versions to include in your release.
- Allow for partial releases ([#98](https://github.com/MetaMask/create-release-branch/pull/98))
  - It is no longer necessary to release every package that has changed. Instead, you may release a subset of packages (as long as it is okay to do so; see next items).
- Soft-enforce major-bumped packages to be released along with their dependents ([#101](https://github.com/MetaMask/create-release-branch/pull/101))
  - If a new major version of a package A is being included in the release, and there are is a package B which depends on A but which is not also being released at the same time, then the tool will produce an error. This is to ensure that if a consumer is upgrading package A in a project and they also need to upgrade package B for compatibility reasons, they can.
- Soft-enforce dependents to be released along with their dependencies ([#102](https://github.com/MetaMask/create-release-branch/pull/102))
  - If package B depends on package A, and A has changed since its last release, and B is being included in the release but not A, then the tool will produce an error. This is to ensure that if B has been changed to rely on a new feature that was added to A, it doesn't break when it is used in a project (since that feature is present in development but has  not been published).

## [1.1.0]
### Added
- Add support for nested workspaces ([#84](https://github.com/MetaMask/create-release-branch/pull/84))

### Changed
- Add `.yml` extension to `RELEASE_SPEC` file ([#83](https://github.com/MetaMask/create-release-branch/pull/83))

## [1.0.1]
### Fixed
- Update changelogs correctly for monorepo packages ([#50](https://github.com/MetaMask/create-release-branch/pull/50))
  - The changelog update step was encountering an error when used for a monorepo package release that had already been released at least once. Related to this, the changelog was being updated with the wrong tag links. Both problems should now be resolved.

## [1.0.0]
### Added
- Initial release
  - In this first release, this tool only supports monorepos with an independent versioning scheme. We will add support for other kinds of projects in future releases.
  - You can learn more on how to use this tool by reading the [documentation](docs/).

[Unreleased]: https://github.com/MetaMask/create-release-branch/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/MetaMask/create-release-branch/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/MetaMask/create-release-branch/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/create-release-branch/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/MetaMask/create-release-branch/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/MetaMask/create-release-branch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MetaMask/create-release-branch/releases/tag/v1.0.0
