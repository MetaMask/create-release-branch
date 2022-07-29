import path from 'path';

export const ROOT_DIR = path.resolve(__dirname, '../../..');
export const SCRIPT_EXECUTABLE_PATH = path.join(ROOT_DIR, 'src', 'cli.ts');
export const TS_NODE_PATH = path.join(
  ROOT_DIR,
  'node_modules',
  '.bin',
  'ts-node',
);
