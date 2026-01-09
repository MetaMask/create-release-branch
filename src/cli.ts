import { main } from './main.js';

/**
 * The entrypoint to this tool.
 */
async function cli(): Promise<void> {
  await main({
    argv: process.argv,
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

cli().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
