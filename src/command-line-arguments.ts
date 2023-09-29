import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

export type CommandLineArguments = {
  projectDirectory: string;
  tempDirectory: string | undefined;
  reset: boolean;
};

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
    .option('reset', {
      describe:
        'Removes any cached files from a previous run that may have been created.',
      type: 'boolean',
      default: false,
    })
    .help()
    .strict()
    .parse();
}
