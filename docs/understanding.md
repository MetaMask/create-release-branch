# Understanding your project

Before you use this tool, you'll want to answer a couple of questions about your project:

1. Are you using the tool within a monorepo architecture?
2. If you have a monorepo, are you using a fixed versioning strategy for your packages or an independent versioning strategy?

The answers to these questions impact how you use this tool.

## Structure

This tool is designed for two methods of organizing publishable code within an ecosystem:

* **Multiple-package repositories** (also called a "monorepo" architecture). In this type of setup, you have a suite of NPM packages that are contained within a single repository. When you issue a release, you may want to publish a new version of a subset or the entirety of these packages.
* **Single-package repositories** (also called a "polyrepo" architecture). Here, you have a suite of packages spread out across multiple repositories, where one repository houses exactly one NPM package. When you issue a release, you will publish a new version of that package and only that package.

The nature of your project changes the workflow behind this tool. For a monorepo specifically, the process involved in preparing a release is more complex than in the polyrepo case, as the tool needs to discover and operate on files within multiple directories within your project instead of just one.

## Versioning strategy (monorepo only)

If you have a monorepo, there are a couple of different ways that you can maintain versions across your packages.

If you are following a **fixed** versioning strategy, it means that your monorepo has a top-level version, and when you issue a new release, you will update this version along with any packages you want to include in the release to the same version.

If you are following an **independent** versioning strategy, your monorepo has no such top-level version, so when you issue a new release, you may update the versions of packages without the need to synchronize them with any other packages.

The strategy you're using also changes the workflow behind this tool. It's slightly more complex if you're using the "independent" strategy, as in the fixed case, you will need to specify only one release version, which will be applied across all packages you want to release, whereas in the independent case, you will need to specify a version for each of the packages you want to release.
