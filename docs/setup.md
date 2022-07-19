# Setting up your project

There are three different type of projects that this tool supports: packages that live within a polyrepo architecture (or stand alone), monorepos that use a "fixed" versioning strategy, and monorepos that use an "independent" versioning strategy (see [here](./understanding.md) for more about the implications between them). The tool has the ability to detect the difference between these at runtime, provided that some requirements are met.

## Polyrepos

By default, the tool will assume your project is within a polyrepo, so if that is the case, you can start using the tool right away — there's no additional setup needed.

## Monorepos

To determine whether a project is a monorepo, the tool will look at the project's `package.json` file for a non-empty `workspaces` field, which lists directories that hold packages you want to publish.

To determine which versioning strategy a monorepo is using, the tool will look for a `release.config.json` file within the root directory of the project. This file should define an object, and that object should have a `versioningStrategy` property. The expected value for this property and associated requirements are explained below.

### Monorepos with fixed versions

For a monorepo with fixed versions, you will want to add a `release.config.json` with a `versioningStrategy` of `"fixed"`.

All together, this looks like:

```
# package.json
{
  "version": "1.0.0",
  "workspaces": ["packages/*"],
}

# release.config.json
{
  "versioningStrategy": "fixed"
}
```

### Monorepos with independent versions

For a monorepo with independent versions, you will want to:

1. Add a `release.config.json` with a `versioningStrategy` of `"independent"`.
2. Change the format of the `version` within the root `package.json` from `<major>.<minor>.<patch>` to `<yyyymmdd>.1.0` (where `yyyymmdd` is a date in ISO format without the dashes, and "1" is the build number, which will be incremented with successive releases).

All together, this looks like:

```
# package.json
{
  "version": "20220607.1",
  "workspaces": ["packages/*"],
}

# release.config.json
{
  "versioningStrategy": "independent"
}
```
