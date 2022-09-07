import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

export interface CommandLineArguments {
  projectDirectory: string;
  tempDirectory: string | undefined;
  continue: boolean;
  abort: boolean;
}

/**
 * Parses the arguments provided on the command line using `yargs`.
 *
 * @param argv - The name of this executable and its arguments (as obtained via
 * `process.argv`).
 * @returns A promise for the `yargs` arguments object.
 */
export async function readCommandLineArguments(
  argv: string[],
): Promise<CommandLineArguments> {
  return await yargs(hideBin(argv))
    .usage(
      'This tool prepares your project for a new release by bumping versions and updating changelogs.',
    )
    .option('project-directory', {
      alias: 'd',
      describe: 'The directory that holds your project.',
      default: '.',
    })
    .option('temp-directory', {
      describe:
        'The directory that is used to hold temporary files, such as the release spec template.',
      type: 'string',
    })
    .option('continue', {
      describe: 'Resumes a previous run by re-running the release spec.',
      type: 'boolean',
      default: false,
    })
    .option('abort', {
      describe:
        'Reverts all uncommitted file changes which have been made and removes the generated release spec.',
      type: 'boolean',
      default: false,
    })
    .help()
    .check((args) => {
      if (args.continue && args.abort) {
        throw new Error('You cannot provide both --continue and --abort.');
      } else {
        return true;
      }
    })
    .fail(async (_message, error, y) => {
      console.warn(`${error}\n\n${y.help()}`);
      /* eslint-disable-next-line */
      process.exit(1);
    })
    .parse();
}
