# Using the tool in a monorepo with fixed versions

For a monorepo using a "fixed" versioning strategy, the tool needs to know not only which version you want to release, but also which packages you want to release.

Start by running:

```
create-release-branch
```

The tool will generate a "release specification", which is a YAML file, and open it in your editor (or, if it cannot detect an appropriate editor, output the path to the file for you to open yourself). This file represents an object which contains two properties:

- **`releaseVersion`:** Specifies the new version that you want to release. The value of this property can either be:
  - `major` if you want to bump the major part of the current version (e.g., if the current version is 1.0.0, then the release version would be 2.0.0).
  - `minor` if you want to bump the minor part of the current version (e.g. if the current version is 1.0.0, then the release version would be 1.1.0).
  - `patch` if you want to bump the patch part of the current version (e.g. if the current version is 1.0.0, then the release version would be 1.0.1).
  - An exact version such as `1.2.3`.
- **`packages`:** An array that lists the names of workspace packages that you want to release. The versions of the packages provided here will be changed to the `releaseVersion`. This list will be populated with all of the packages that have any changed since the previous release. You should not change this list.

A typical release spec, once edited, might look like this:

```
releaseVersion: major
packages:
- @metamask/base-controller
- @metamask/controller-utils
- @metamask/transaction-controller
- @metamask/assets-controllers
```

Once you've filled out the release spec, save and close it, and the tool will continue. (Or, if the tool couldn't detect your editor and you had to edit the file manually, then run `create-release-branch` again to resume.)

At this point, the tool will:

1. Adjust the `version` of the root package, and all of the specified packages, to the specified version.
2. Go through each workspace package specified, and:
   1. Read the Git history of the repo to extract the names of the commits which have made any changes to any files within the package since the Git tag that corresponds to the current version of the package.
   2. Add a new section to the changelog for the package which is titled by the release version and which lists the commits gathered.
3. Commit the changes to a new branch called `release/<release-version>` (e.g. `release/1.2.3`) and switch to that branch.
