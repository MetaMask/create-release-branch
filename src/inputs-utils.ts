import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

export interface Inputs {
  projectDirectory: string;
  tempDirectory: string | undefined;
  reset: boolean;
}

/**
 * Parse the arguments provided on the command line.
 *
 * @param argv - The name of this script and its arguments (as obtained via
 * `process.argv`).
 * @returns A promise for the `yargs` arguments object.
 */
export async function readInputs(argv: string[]): Promise<Inputs> {
  return await yargs(hideBin(argv))
    .usage('This script generates a release PR.')
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
    .parse();
}
