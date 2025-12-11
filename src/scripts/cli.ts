import { run } from '../cli/run.js';

run({
  argv: process.argv,
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
