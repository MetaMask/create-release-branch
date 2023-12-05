# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0]
### Changed
- Convert package to ESM ([#113](https://github.com/MetaMask/create-release-branch/pull/113))
- Disable git commit GPG signing in tests ([#115](https://github.com/MetaMask/create-release-branch/pull/115))
- Reorder workflow to update changelogs first ([#109](https://github.com/MetaMask/create-release-branch/pull/109))
- Bump minimum Node version to 16 ([#114](https://github.com/MetaMask/create-release-branch/pull/114))
- Allow users to omit packages ([#98](https://github.com/MetaMask/create-release-branch/pull/98))
- Compel users to release packages with breaking changes alongside their dependents ([#101](https://github.com/MetaMask/create-release-branch/pull/101))
- Compel users to release new versions of dependencies alongside their dependents ([#102](https://github.com/MetaMask/create-release-branch/pull/102))

### Fixed
- fix: replace `null` with `intentionally-skip` in release-spec template comment ([#99](https://github.com/MetaMask/create-release-branch/pull/99))
- Correct setup instructions for a monorepo w/ independent versions ([#87](https://github.com/MetaMask/create-release-branch/pull/87))

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

[Unreleased]: https://github.com/MetaMask/create-release-branch/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/MetaMask/create-release-branch/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/MetaMask/create-release-branch/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/MetaMask/create-release-branch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MetaMask/create-release-branch/releases/tag/v1.0.0
