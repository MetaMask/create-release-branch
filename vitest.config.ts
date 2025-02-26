import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,

    // Vitest doesn't inject the globals by default. We enable this option to
    // inject the globals like `describe`, `it`, `expect`, etc.
    globals: true,

    coverage: {
      enabled: true,

      // Configure the coverage provider. We use `istanbul` here, because it
      // is more stable than `v8`.
      provider: 'istanbul',

      // Only include source files in the `src` directory.
      include: ['src/**/*.test.ts'],

      // Exclude certain files from the coverage.
      exclude: ['node_modules/', 'src/cli.ts', 'src/command-line-arguments.ts'],

      // Hide files with 100% coverage.
      skipFull: true,

      // Coverage thresholds. If the coverage is below these thresholds, the
      // test will fail.
      thresholds: {
        // Auto-update the coverage thresholds.
        autoUpdate: true,

        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
});
