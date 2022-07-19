module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

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
    // It's common for scripts to exit explicitly
    'node/no-process-exit': 'off',
  },

  overrides: [
    {
      files: ['*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        // This prevents using bulleted/numbered lists in JSDoc blocks.
        // See: <https://github.com/gajus/eslint-plugin-jsdoc/issues/541>
        'jsdoc/check-indentation': 'off',
      },
    },

    {
      files: ['*.test.ts'],
      extends: ['@metamask/eslint-config-jest'],
    },
  ],

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/'],
};
