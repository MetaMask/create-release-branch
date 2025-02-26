module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  parserOptions: {
    sourceType: 'module',
  },

  rules: {
    // This makes integration tests easier to read by allowing setup code and
    // assertions to be grouped together better
    'padding-line-between-statements': [
      'error',
      {
        blankLine: 'always',
        prev: 'directive',
        next: '*',
      },
      {
        blankLine: 'any',
        prev: 'directive',
        next: 'directive',
      },
      {
        blankLine: 'always',
        prev: 'multiline-block-like',
        next: '*',
      },
      {
        blankLine: 'always',
        prev: '*',
        next: 'multiline-block-like',
      },
    ],

    // It's common for scripts to access `process.env`
    'node/no-process-env': 'off',
  },

  overrides: [
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
    },

    {
      files: ['*.test.ts'],
      extends: ['@metamask/eslint-config-jest'],

      settings: {
        jest: {
          // This package uses Vitest, but `@metamask/eslint-config-vitest` is
          // only available for ESLint 9+. The Jest rules are similar enough,
          // but we need to explicitly set the Jest version since we're not
          // using the `jest` package directly.
          // TODO: Remove this when migrating to
          //  `@metamask/eslint-config-vitest`.
          version: 29,
        },
      },
    },
  ],

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/'],
};
