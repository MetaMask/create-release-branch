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
        // Methods
        MethodDefinition: true,
      },
      contexts: [
        // Type interfaces defined at the topmost scope of a file
        'Program > TSInterfaceDeclaration',
        // Type aliases defined at the topmost scope of a file
        'Program > TSTypeAliasDeclaration',
        // Enums defined at the topmost scope of a file
        'Program > TSEnumDeclaration',
        // Class declarations defined at the topmost scope of a file
        'Program > ClassDeclaration',
        // Function declarations defined at the topmost scope of a file
        'Program > FunctionDeclaration',
        // Arrow functions defined at the topmost scope of a file
        'Program > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
        // Function expressions defined at the topmost scope of a file
        'Program > VariableDeclaration > VariableDeclarator > FunctionExpression',
        // Exported variables defined at the topmost scope of a file
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
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
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
    files: ['**/*.test.ts', '**/*.test.tsx'],
    extends: jest,
  },

  {
    files: ['src/ui/**.tsx'],
    extends: [
      browser,
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
    ],
    rules: {
      // This rule isn't useful for us
      'react/no-unescaped-entities': 'off',
      // Copied from `@metamask/eslint-config`, but tweaked to allow functions
      // to be formatted as PascalCase
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'enumMember',
          format: ['PascalCase'],
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: {
            regex: '^I[A-Z]',
            match: false,
          },
        },
        {
          selector: 'objectLiteralMethod',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
        {
          selector: 'objectLiteralProperty',
          // Disabled because object literals are often parameters to 3rd party libraries/services,
          // which we don't set the naming conventions for
          format: null,
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          custom: {
            regex: '^.{3,}',
            match: true,
          },
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: [
            'classProperty',
            'objectLiteralProperty',
            'typeProperty',
            'classMethod',
            'objectLiteralMethod',
            'typeMethod',
            'accessor',
            'enumMember',
          ],
          format: null,
          modifiers: ['requiresQuotes'],
        },
      ],
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
