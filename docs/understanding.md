# Understanding your project

Before you use this tool, you'll want to ask three questions:

1. Which version of Yarn is my project using: "classic" Yarn (v1) or "modern" Yarn (v2 and beyond)?
2. Is my project a polyrepo or a monorepo?
3. If my project is a monorepo, am I using a fixed versioning strategy or an independent versioning strategy?

The answers to these questions impact how you use this tool.

## Package manager

There are many differences between Yarn 1.x and 2.x (and all versions after it). One of these changes concerns how to run executables in globally available packages. You can read more about that [here](./calling.md).

## Role

Your project may be a _polyrepo_, housing only one NPM package, or a _monorepo_, housing multiple NPM packages. The nature of your project changes the workflow behind this tool, as the process involved in preparing a release for a monorepo is more complex than for a polyrepo, as the tool needs to discover and operate on files within multiple directories within your project instead of just one, and it cannot make the same assumptions about which files to update as it can for a polyrepo.

## Versioning strategy (monorepo only)

Finally, if your project is a monorepo, there are a couple of different ways that you can maintain versions across your packages.

If you are following a _fixed_ versioning strategy, it means that your monorepo has a top-level version, and when you issue a new release, you will update this version along with any packages you want to include in the release to the same version.

If you are following an _independent_ versioning strategy, your monorepo has no such top-level version, so when you issue a new release, you do not need to synchronize the versions of packages you want to include in the release.

The independent strategy is slightly more complex than the fixed strategy, as in the fixed strategy, you need to specify only one release version, whereas in the independent case, you need to specify versions for one or many packages.
