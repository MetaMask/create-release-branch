module.exports = {
  root: true,

  extends: ['@metamask/eslint-config', '@metamask/eslint-config-nodejs'],

  parserOptions: {
    sourceType: 'module',
  },

  rules: {},

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
