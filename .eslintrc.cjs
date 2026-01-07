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
      files: ['*.cjs'],
      parserOptions: {
        sourceType: 'script',
      },
    },
    {
      files: ['*.ts', '*.tsx', '*.mts'],
      extends: ['@metamask/eslint-config-typescript'],
    },

    {
      files: ['*.test.ts', '*.test.tsx'],
      extends: ['@metamask/eslint-config-jest'],
    },

    {
      files: ['src/ui/**/*.tsx'],
      extends: ['plugin:react/recommended', 'plugin:react/jsx-runtime'],
      rules: {
        // This rule isn't useful for us
        'react/no-unescaped-entities': 'off',
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
  ],

  ignorePatterns: ['dist/', 'node_modules/'],
};
