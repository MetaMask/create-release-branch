#!/usr/bin/env node

// This file will only exist after running `yarn build`, and it will get a `.js`
// extension.
//
// We don't want developers or CI to receive a lint error if the script has not
// been run. (A warning will appear if the script *has* been run, but that is
// okay.)
//
// eslint-disable-next-line import-x/extensions, import-x/no-unassigned-import, import-x/no-unresolved
import '../dist/scripts/cli.js';
