module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  env: {
    // See parserOptions comment
    es2022: true,
  },

  parserOptions: {
    // We've had issues with the corresponding env setting being overriden.
    // As for the specific choice, at the time of writing most of our codebase
    // is on Node 16, and ES2022 is the latest version that's mostly compatible
    // with Node 16 per https://node.green/.
    ecmaVersion: '2022',
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
    },
  ],

  ignorePatterns: ['!.eslintrc.js', '!.prettierrc.js', 'dist/'],
};
