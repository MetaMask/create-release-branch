# Using the tool for a monorepo with fixed versions

For a monorepo with fixed versions, the tool needs to know not only which version you want to release, but also which packages you want to release.

Start by running:

```
create-release-branch
```

The tool will generate a YAML file format and open it in your editor (or, if it cannot detect an appropriate editor, give you the path to the file for you to open yourself). This file contains two fields:

- **`releaseVersion`:** Specifies the new version that you want to release. This can either be:
  - `major` if you want to bump the major part of the current version. For instance, if the current version is 1.0.0, then the release version would be 2.0.0.
  - `minor` if you want to bump the minor part of the current version. For instance, if the current version is 1.0.0, then the release version would be 1.1.0.
  - `patch` if you want to bump the patch part of the current version. For instance, if the current version is 1.0.0, then the release version would be 1.0.1.
  - An exact version such as `1.2.3`.
- **`packages`:** An array that lists the names of workspace packages that you want to release. The versions of the packages provided here will be changed to the `releaseVersion`. This list will be populated with all of the packages that have any changed since the previous release, but you are free to remove or add any line as long as it refers to a valid workspace package.

Once you've filled out this file, save and close it, and the tool will continue. (Or, if the tool couldn't detect your editor and you had to edit the file manually, then run `create-release-branch --continue`.)

At this point, the tool will:

1. Adjust the `version` of the root package, and all of the provided packages, to the version specified.
2. Go through each workspace package specified, and:
   1. Read the Git history of the repo to extract the names of the commits which have made any changes to any files within the package since the Git tag that corresponds to the current version of the package.
   2. Add a new section to the changelog for the package which is titled by the release version and which lists the commits gathered.
3. Commit the changes to a new branch called `release/<release-version>` (e.g. `release/1.2.3`) and switch to that branch.
