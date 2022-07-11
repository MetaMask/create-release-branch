import { main } from './main';

/**
 * The entrypoint to this script.
 */
async function index() {
  await main({
    argv: process.argv,
    cwd: process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
  });
}

index().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
