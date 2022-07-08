# Calling the executable

The name of the executable that this tool exports is called `create-release-branch`. However, you will rarely use this directly. Instead, you'll use one of two wrappers depending on which package manager you are using for your project. For Yarn v1 and NPM, you'll want to use `npx`, e.g.:

```
npx @metamask/create-release-branch [OPTIONS]
```

Whereas for Yarn v2 and above, you'll want to use `yarn dlx`, e.g.:

```
yarn dlx @metamask/create-release-branch [OPTIONS]
```

In other guides, this is shortened to `create-release-branch`, but you will want to keep the full command in mind.
