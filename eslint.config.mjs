import globals from 'globals';
import base, { createConfig } from '@metamask/eslint-config';
import browser from '@metamask/eslint-config-browser';
import jest from '@metamask/eslint-config-jest';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';
import react from 'eslint-plugin-react';

// Copied from `jsdoc/check-tag-names`, except `@property` is omitted
// <https://github.com/gajus/eslint-plugin-jsdoc/blob/f219b6282a1383b99d3a1497abf2836c03346b65/test/rules/assertions/checkTagNames.js>
const typedTagsAlwaysUnnecessary = new Set([
  'augments',
  'callback',
  'class',
  'enum',
  'implements',
  'private',
  'protected',
  'public',
  'readonly',
  'this',
  'type',
  'typedef',
]);

// Copied from `jsdoc/check-tag-names`
// <https://github.com/gajus/eslint-plugin-jsdoc/blob/f219b6282a1383b99d3a1497abf2836c03346b65/test/rules/assertions/checkTagNames.js>
const typedTagsNeedingName = new Set(['template']);

// Copied from `jsdoc/check-tag-names`, except `@property` is omitted
// <https://github.com/gajus/eslint-plugin-jsdoc/blob/f219b6282a1383b99d3a1497abf2836c03346b65/test/rules/assertions/checkTagNames.js>
const typedTagsUnnecessaryOutsideDeclare = new Set([
  'abstract',
  'access',
  'class',
  'constant',
  'constructs',
  'enum',
  'export',
  'exports',
  'function',
  'global',
  'inherits',
  'instance',
  'interface',
  'member',
  'memberof',
  'memberOf',
  'method',
  'mixes',
  'mixin',
  'module',
  'name',
  'namespace',
  'override',
  'requires',
  'static',
  'this',
]);

// Consider copying this to @metamask/eslint-config
const requireJsdocOverride = {
  'jsdoc/require-jsdoc': [
    'error',
    {
      require: {
        // Classes
        ClassDeclaration: true,
        // Function declarations
        FunctionDeclaration: true,
        // Methods
        MethodDefinition: true,
      },
      contexts: [
        // Type interfaces that are not defined within `declare` blocks
        ':not(TSModuleBlock) > TSInterfaceDeclaration',
        // Type aliases
        'TSTypeAliasDeclaration',
        // Enums
        'TSEnumDeclaration',
        // Arrow functions that are not contained within plain objects or
        // are not arguments to functions or methods
        ':not(Property, NewExpression, CallExpression) > ArrowFunctionExpression',
        // Function expressions that are not contained within plain objects
        // or are not arguments to functions or methods
        ':not(Property, NewExpression, CallExpression) > FunctionExpression',
        // Exported variables at the root
        'ExportNamedDeclaration:has(> VariableDeclaration)',
      ],
    },
  ],
};

const config = createConfig([
  {
    ignores: ['dist/', 'docs/', '.yarn/'],
  },

  {
    extends: base,

    languageOptions: {
      sourceType: 'module',
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      // Consider copying this to @metamask/eslint-config
      'jsdoc/no-blank-blocks': 'error',
      ...requireJsdocOverride,
    },

    settings: {
      'import-x/extensions': ['.js', '.mjs'],
    },
  },

  {
    files: ['**/*.ts'],
    extends: typescript,
    rules: {
      // Consider copying this to @metamask/eslint-config
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
        },
      ],
      // Consider copying this to @metamask/eslint-config
      'jsdoc/no-blank-blocks': 'error',
      ...requireJsdocOverride,
      // Override this rule so that the JSDoc tags that were checked with
      // `typed: true` still apply, but `@property` is excluded
      'jsdoc/check-tag-names': ['error', { typed: false }],
      'jsdoc/no-restricted-syntax': [
        'error',
        {
          contexts: [
            ...Array.from(typedTagsAlwaysUnnecessary).map((tag) => ({
              comment: `JsdocBlock:has(JsdocTag[tag='${tag}'])`,
              message: `'@${tag}' is redundant when using a type system.`,
            })),
            ...Array.from(typedTagsNeedingName).map((tag) => ({
              comment: `JsdocBlock:has(JsdocTag[tag='${tag}']:not([name]))`,
              message: `'@${tag}' is redundant without a name when using a type system.`,
            })),
            ...Array.from(typedTagsUnnecessaryOutsideDeclare).map((tag) => ({
              // We want to allow the use of these tags inside of `declare`
              // blocks. The only way to do this seems to be to name all common
              // node types, but exclude `TSModuleBlock` and
              // `TSModuleDeclaration`.
              context:
                'TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassDeclaration, FunctionDeclaration, MethodDefinition, VariableDeclaration, TSEnumDeclaration, PropertyDefinition, TSPropertySignature, TSMethodSignature',
              comment: `JsdocBlock:has(JsdocTag[tag='${tag}'])`,
              message: `'@${tag}' is redundant when using a type system outside of ambient declarations.`,
            })),
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.js', '**/*.cjs', '**/*.ts', '**/*.test.ts', '**/*.test.js'],
    ignores: ['src/ui/**'],
    extends: nodejs,
  },

  {
    files: ['**/*.test.ts'],
    extends: jest,
  },

  {
    files: ['src/ui/**.tsx'],
    extends: [browser],
    plugins: { react },
    rules: {
      // This rule isn't useful for us
      'react/no-unescaped-entities': 'off',
    },
    // TODO: Is this necessary?
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // List this last to override any settings inherited from plugins,
  // especially `eslint-config-n`, which mistakenly assumes that all `.cjs`
  // files are modules (since we specified `type: module` in `package.json`)
  {
    files: ['**/*.js', '**/*.cjs'],
    // This *is* a script, but is written using ESM.
    ignores: ['bin/create-release-branch.js'],
    languageOptions: {
      sourceType: 'script',
    },
  },
]);

export default config;
