# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0]
### Uncategorized
- Add support for nested workspaces ([#84](https://github.com/MetaMask/create-release-branch/pull/84))
- Add `.yml` extension to `RELEASE_SPEC` file ([#83](https://github.com/MetaMask/create-release-branch/pull/83))
- Bump semver from 7.5.0 to 7.5.2 ([#80](https://github.com/MetaMask/create-release-branch/pull/80))
- chore: bump dependencies ([#79](https://github.com/MetaMask/create-release-branch/pull/79))
- Bump @metamask/utils from 3.4.1 to 3.5.0 ([#74](https://github.com/MetaMask/create-release-branch/pull/74))
- Bump http-cache-semantics from 4.1.0 to 4.1.1 ([#73](https://github.com/MetaMask/create-release-branch/pull/73))
- Bump @metamask/utils from 3.4.0 to 3.4.1 ([#70](https://github.com/MetaMask/create-release-branch/pull/70))
- Bump json5 from 1.0.1 to 1.0.2 ([#69](https://github.com/MetaMask/create-release-branch/pull/69))
- Bump @metamask/utils from 3.3.1 to 3.4.0 ([#68](https://github.com/MetaMask/create-release-branch/pull/68))
- Demote warning in README to disclaimer ([#66](https://github.com/MetaMask/create-release-branch/pull/66))
- Bump @metamask/auto-changelog from 3.0.0 to 3.1.0 ([#53](https://github.com/MetaMask/create-release-branch/pull/53))
- Bump @metamask/utils from 3.0.3 to 3.3.1 ([#54](https://github.com/MetaMask/create-release-branch/pull/54))
- Update publishing instructions ([#52](https://github.com/MetaMask/create-release-branch/pull/52))

## [1.0.1]
### Fixed
- Update changelogs correctly for monorepo packages ([#50](https://github.com/MetaMask/create-release-branch/pull/50))
  - The changelog update step was encountering an error when used for a monorepo package release that had already been released at least once. Related to this, the changelog was being updated with the wrong tag links. Both problems should now be resolved.

## [1.0.0]
### Added
- Initial release
  - In this first release, this tool only supports monorepos with an independent versioning scheme. We will add support for other kinds of projects in future releases.
  - You can learn more on how to use this tool by reading the [documentation](docs/).

[Unreleased]: https://github.com/MetaMask/create-release-branch/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/MetaMask/create-release-branch/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/MetaMask/create-release-branch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MetaMask/create-release-branch/releases/tag/v1.0.0
