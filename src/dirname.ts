import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the current directory path.
 *
 * @returns The current directory path.
 */
export function getCurrentDirectoryPath() {
  return __dirname;
}
