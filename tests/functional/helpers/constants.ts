import path from 'path';

const ROOT_DIR = path.resolve(__dirname, '../../..');

/**
 * The path to the entrypoint of the tool, locally.
 *
 * This needs to match `bin/create-release-branch.js`.
 */
export const TOOL_EXECUTABLE_PATH = path.join(
  ROOT_DIR,
  'src',
  'scripts',
  'cli.ts',
);

/**
 * The path to `tsx`, locally.
 */
export const TSX_PATH = path.join(ROOT_DIR, 'node_modules', '.bin', 'tsx');
