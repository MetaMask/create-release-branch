import base, { createConfig } from '@metamask/eslint-config';
import jest from '@metamask/eslint-config-jest';
import nodejs from '@metamask/eslint-config-nodejs';
import typescript from '@metamask/eslint-config-typescript';

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
      // Consider copying this to @metamask/eslint-config
      'jsdoc/no-blank-blocks': 'error',
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
      // Consider copying this to @metamask/eslint-config
      'jsdoc/no-blank-blocks': 'error',
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
