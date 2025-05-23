# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.1.3]

### Fixed

- When creating a new release and populating the Unreleased section, use the same repo URLs in PR links as `auto-changelog update` would use ([#165](https://github.com/MetaMask/create-release-branch/pull/165))
  - This prevents the updated changelog that `create-release-branch` produces from being invalid in the case where a non-standard URL was used to clone the repo originally.

## [4.1.2]

### Fixed

- Improved error handling when opening browser fails due to System Events permissions or non-standard browser configurations ([#178](https://github.com/MetaMask/create-release-branch/pull/178))
  - Now provides clear manual URL instructions instead of failing with osascript errors
  - Handles both cases: when terminal lacks System Events permissions and when using alternative browsers like Brave

## [4.1.1]

### Fixed

- Ask users to include peer dependents of a major-bumped package in the release, even they've had no changes ([#173](https://github.com/MetaMask/create-release-branch/pull/173))
- UI: Include all peer dependents of a major-bumped package as available packages to release, even if they've had no changes ([#173](https://github.com/MetaMask/create-release-branch/pull/173))

## [4.1.0]

### Added

- Add interactive web UI for selecting package versions to release ([#166](https://github.com/MetaMask/create-release-branch/pull/166))
  - Added `--interactive` (`-i`) flag to launch a web-based UI for easier version selection
  - Added `--port` option to configure the web server port (default: 3000)

### Changed

- Refine breaking change dependent detection to only consider peer dependencies ([#170](https://github.com/MetaMask/create-release-branch/pull/170))
  - This change supports our policy of requiring packages with breaking changes to be released alongside their dependents
  - Regular dependencies are no longer included in this check
- Allow `npm:name@version` dependency redirections in manifest ([#158](https://github.com/MetaMask/create-release-branch/pull/158))

## [4.0.0]

### Changed

- **BREAKING:** Bump minimum Node.js version to `^18.18` ([#156](https://github.com/MetaMask/create-release-branch/pull/156))
- **BREAKING:** Bump `@metamask/auto-changelog` to `^4.0.0` ([#156](https://github.com/MetaMask/create-release-branch/pull/156))
  - This requires `prettier@>=3.0.0`.

## [3.1.0]

### Changed

- Allow `npm:name@version` dependency redirections in manifest ([#158](https://github.com/MetaMask/create-release-branch/pull/158)) ([#159](https://github.com/MetaMask/create-release-branch/pull/159))

## [3.0.1]

### Changed

- Bump `@metamask/utils` to `^9.0.0` ([#150](https://github.com/MetaMask/create-release-branch/pull/150))

### Fixed

- Correct Yarn constraint violations and update Yarn lockfile at the end of the release process ([#145](https://github.com/MetaMask/create-release-branch/pull/145))
  - This was previously a required step after running `create-release-branch`.

### Security

- Enable MetaMask security code scanner ([#133](https://github.com/MetaMask/create-release-branch/pull/133))

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
  - If package B depends on package A, and A has changed since its last release, and B is being included in the release but not A, then the tool will produce an error. This is to ensure that if B has been changed to rely on a new feature that was added to A, it doesn't break when it is used in a project (since that feature is present in development but has not been published).

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

[Unreleased]: https://github.com/MetaMask/create-release-branch/compare/v4.1.3...HEAD
[4.1.3]: https://github.com/MetaMask/create-release-branch/compare/v4.1.2...v4.1.3
[4.1.2]: https://github.com/MetaMask/create-release-branch/compare/v4.1.1...v4.1.2
[4.1.1]: https://github.com/MetaMask/create-release-branch/compare/v4.1.0...v4.1.1
[4.1.0]: https://github.com/MetaMask/create-release-branch/compare/v4.0.0...v4.1.0
[4.0.0]: https://github.com/MetaMask/create-release-branch/compare/v3.1.0...v4.0.0
[3.1.0]: https://github.com/MetaMask/create-release-branch/compare/v3.0.1...v3.1.0
[3.0.1]: https://github.com/MetaMask/create-release-branch/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/MetaMask/create-release-branch/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/MetaMask/create-release-branch/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/create-release-branch/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/MetaMask/create-release-branch/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/MetaMask/create-release-branch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/MetaMask/create-release-branch/releases/tag/v1.0.0
