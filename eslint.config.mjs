import base, { createConfig } from '@metamask/eslint-config';
import jest from '@metamask/eslint-config-jest';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';

const config = createConfig([
  {
    ignores: ['dist/', 'docs/', '.yarn/'],
  },

  {
    extends: [base, nodejs],

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: ['./tsconfig.json'],
      },
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
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
  },

  {
    files: ['**/*.ts'],
    extends: typescript,
  },

  {
    files: ['**/*.js', '**/*.cjs'],

    languageOptions: {
      sourceType: 'script',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.js'],
    extends: [jest, nodejs],
  },
]);

export default config;
