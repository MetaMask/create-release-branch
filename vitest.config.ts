import { coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,

      // Only include source files in the `src` directory.
      include: ['src/**/*.test.ts'],

      // Exclude certain files from the coverage.
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/cli.ts',
        'src/command-line-arguments.ts',
      ],

      // Configure the coverage provider. We use `istanbul` here, because it
      // is more stable than `v8`.
      provider: 'istanbul',

      // Hide files with 100% coverage.
      skipFull: true,

      // Coverage thresholds. If the coverage is below these thresholds, the
      // test will fail.
      thresholds: {
        // Auto-update the coverage thresholds.
        autoUpdate: true,

        // These should be set to 100 at all times.
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },

    // Vitest doesn't inject the globals by default. We enable this option to
    // inject the globals like `describe`, `it`, `expect`, etc.
    globals: true,

    // Ensure all mock functions are reset before each test.
    mockReset: true,

    // Ensure all mock functions are restored before each test.
    restoreMocks: true,

    // Ensure environment variable stubs are removed before each test.
    unstubEnvs: true,

    // Ensure global variable stubs are removed before each test.
    unstubGlobals: true,

    // Don't watch files unless requested to do so.
    watch: false,
  },
});
