module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  rules: {
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
    'node/no-process-env': 'off',
    'node/no-process-exit': 'off',
  },

  overrides: [
    {
      files: ['**/*.ts'],
      extends: ['@metamask/eslint-config-typescript'],
      rules: {
        '@typescript-eslint/no-shadow': ['error', { builtinGlobals: true }],
        'jsdoc/check-indentation': 'off',
        'no-shadow': 'off',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'import/unambiguous': 'off',
      },
    },
    {
      files: ['**/*.test.js', '**/*.test.ts'],
      extends: ['@metamask/eslint-config-jest'],
    },
  ],

  ignorePatterns: ['!.eslintrc.js', 'lib/', 'dist/'],
};
