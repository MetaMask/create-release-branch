# Using the tool for a polyrepo

For a polyrepo, the tool needs to know the new version of the package that you want to release (hereafter called the "release version"). This can happen one of two ways:

1. You can have the tool determine the release version automatically by bumping the major, minor, or patch part of the current version.

   For instance, if the current version is 1.0.0, then this command would bump the version to 2.0.0:

   ```
   create-release-branch --bump major
   ```

   If the current version is 1.0.0, then this command would bump the version to 1.1.0:

   ```
   create-release-branch --bump minor
   ```

   If the current version is 1.0.0, then this command would bump the version to 1.0.1:

   ```
   create-release-branch --bump patch
   ```

2. You can provide the version exactly. For instance, this command would change the version to 1.2.3 regardless of the current version:

   ```
   create-release-branch --version 1.2.3
   ```

After you run the command, the tool will:

1. Adjust the version of the package to the version specified.
2. Read the Git history of the repo to extract the names of the commits which have occurred since the Git tag that corresponds to the current version (before being changed).
3. Add a new section to the changelog for the release version which lists the commits gathered.
4. Commit the changes to a new branch called `release/<release-version>` (e.g. `release/1.2.3`) and switch to that branch.

At this point, you'll need to revise the changelog to place the newly added entries within the appropriate categories and to edit them to be more easily understood by users of the project.
Read [this guide](./changelog.md) for more on how to do this.
