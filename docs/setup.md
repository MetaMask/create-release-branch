# Setting up your project

There are three different use cases that this tool supports: polyrepos, monorepos with fixed versions, and monorepos with independent versions (see [here](./understanding.md) for more about the implications between them). The tool has the ability to detect the difference between these at runtime, provided that some requirements are met.

## Polyrepos

First, by default, the tool will assume your project is a polyrepo, so if that is the case, you can start using the tool right away — no setup needed.

## Monorepos

To determine whether a project is a monorepo, the tool looks for the existence of a non-empty `workspaces` field within the project's `package.json` file. In other words, it assumes that you are using workspaces to manage the packages within a repo. Likely you are already doing this for your monorepo, but if not, then you will want to adopt this feature (which is supported by all package managers) and add this field.

Additionally, to determine which versioning strategy a monorepo uses, you will
need to provide some configuration. The tool will look for the presence of a `@metamask/create-release-branch` section in the root package's `package.json` for options, and one of the options supported is `versioningStrategy`. The expected value for this option and associated requirements are explained below.

### Monorepos with fixed versions

For a monorepo with fixed versions, you will update the root `package.json` with a `versioningStrategy` of `"fixed"`. For example:

```json
{
  "version": "1.0.0",
  "workspaces": ["packages/*"],
  "@metamask/create-release-branch": {
    "versioningStrategy": "fixed"
  }
}
```

### Monorepos with independent versions

For a monorepo with independent versions, you will want to make two changes to the root `package.json`:

1. Use a `versioningStrategy` of `"independent"`
2. Change the format of the `version` from `<major>.<minor>.<patch>` to `<year>.<month>.<day>-<build number>` ("1" is a sensible starting build number). For example:

```json
{
  "version": "2022.6.7-1",
  "workspaces": ["packages/*"],
  "@metamask/create-release-branch": {
    "versioningStrategy": "independent"
  }
}
```
