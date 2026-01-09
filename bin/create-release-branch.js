#!/usr/bin/env node

// Three things:
// - This file doesn't export anything, as it's a script.
// - We are using a `.js` extension because that's what appears in `dist/`.
// - This file will only exist after running `yarn build`. We don't want
//   developers or CI to receive a lint error if the script has not been run.
//   (A warning will appear if the script *has* been run, but that is okay.)
// eslint-disable-next-line import-x/no-unassigned-import, import-x/extensions
import '../dist/cli.js';
