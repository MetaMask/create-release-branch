# Using the tool for a monorepo with independent versions

For a monorepo with independent versions, the tool needs to know which packages you want to release and how to set the version for each package.

Start by running:

```
create-release-branch
```

The tool will generate a YAML file format and open it in your editor (or, if it cannot detect an appropriate editor, give you the path to the file for you to open yourself). This file contains one field, `packages`, which is an object where:

- Each key is the name of the workspace package you want to release.
- Each value specifies the new version the package should receive. This can either be:
  - `major` if you want to bump the major part of the current version. For instance, if the current version is 1.0.0, then the release version would be 2.0.0.
  - `minor` if you want to bump the minor part of the current version. For instance, if the current version is 1.0.0, then the release version would be 1.1.0.
  - `patch` if you want to bump the patch part of the current version. For instance, if the current version is 1.0.0, then the release version would be 1.0.1.
  - An exact version such as `1.2.3`.

This object will be populated with all of the packages that have any changed since the previous release, but you are free to remove or add any line as long as it refers to a valid workspace package.

Here is an example:

```
@metamask/base-controller: major
@metamask/controller-utils: minor
@metamask/transaction-controller: patch
@metamask/assets-controllers: 1.6.3
```

Once you've filled out this file, save and close it, and the tool will continue. (Or, if the tool couldn't detect your editor and you had to edit the file manually, then run `create-release-branch --continue`).

At this point, the tool will:

1. Calculate a new release version by extracting the build number from the current version, incrementing it, and combining it with the current date, then setting the `version` of the root package to this new version.
2. Go through each workspace package specified, and:
   1. Adjust the `version` of the package to the version specified.
   2. Read the Git history of the repo to extract the names of the commits which have made any changes to any files within the package since the Git tag that corresponds to the current version of the package.
   3. Add a new section to the changelog for the package which is titled by the release version and which lists the commits gathered.
3. Commit the changes to a new branch called `release/<release-version>`, where `<release-version>` is the version calculated in step one (e.g. `release/2022.6.8-123`), and switch to that branch.
