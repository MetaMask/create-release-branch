// We use Babel to transpile down ESM dependencies to CommonJS for our tests
// using babel-jest.
module.exports = {
  env: {
    test: {
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    },
  },
};
