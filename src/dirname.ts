import { dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Get the current directory path.
 *
 * @returns The current directory path.
 */
export function getCurrentDirectoryPath(): string {
  return dirname(fileURLToPath(import.meta.url));
}
