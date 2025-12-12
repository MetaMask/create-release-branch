import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the absolute path of either the `src/` directory in development or the
 * `dist/` directory in production.
 *
 * This function exists so that we can mock it out in unit tests. (We cannot use
 * `import.meta` in Jest because we can't configured it to understand ESM, and
 * doing so would involve more work than we want to spend right now.)
 *
 * @returns The absolute path of either `src/` or `dest/`.
 */
export function getRootDirectoryPath(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}
