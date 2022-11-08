# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1]
### Fixed
- Update changelogs correctly for monorepo packages ([#50](https://github.com/MetaMask/create-release-branch/pull/50))
  - The changelog update step was encountering an error when used for a monorepo package release that had already been released at least once. Related to this, the changelog was being updated with the wrong tag links. Both problems should now be resolved.

## [1.0.0]
### Added
- Initial release
  - In this first release, this tool only supports monorepos with an independent versioning scheme. We will add support for other kinds of projects in future releases.
  - You can learn more on how to use this tool by reading the [documentation](docs/).

[Unreleased]: https://github.com/MetaMask/create-release-branch/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/MetaMask/create-release-branch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MetaMask/create-release-branch/releases/tag/v1.0.0
