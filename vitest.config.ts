import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,

      // Only include source files in the `src` directory.
      include: ['src/**/*.test.ts'],

      // Exclude certain files from the coverage.
      exclude: ['node_modules/', 'src/cli.ts', 'src/command-line-arguments.ts'],

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

    // Calls .mockReset on all spies before each test.
    mockReset: true,

    // Calls .mockRestore on all spies before each test.
    restoreMocks: true,

    // Calls vi.unstubAllEnvs before each test.
    unstubEnvs: true,

    // Calls vi.unstubGlobals before each test.
    unstubGlobals: true,

    watch: false,
  },
});
