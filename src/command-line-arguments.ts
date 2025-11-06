import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

export type ReleaseCommandArguments = {
  _: string[];
  command: 'release';
  projectDirectory: string;
  tempDirectory?: string;
  reset: boolean;
  backport: boolean;
  defaultBranch: string;
  interactive: boolean;
  port: number;
};

export type CheckDepsCommandArguments = {
  _: string[];
  command: 'check-deps';
  fromRef?: string;
  toRef?: string;
  defaultBranch: string;
  fix?: boolean;
  pr?: string;
};

export type CommandLineArguments =
  | ReleaseCommandArguments
  | CheckDepsCommandArguments;

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
  const args = await yargs(hideBin(argv))
    .scriptName('create-release-branch')
    .usage('$0 <command> [options]')
    .command(
      ['release', '$0'],
      'Prepare your project for a new release by bumping versions and updating changelogs',
      (commandYargs) =>
        commandYargs
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
          .option('backport', {
            describe:
              'Instructs the tool to bump the second part of the version rather than the first for a backport release.',
            type: 'boolean',
            default: false,
          })
          .option('default-branch', {
            alias: 'b',
            describe: 'The name of the default branch in the repository.',
            default: 'main',
            type: 'string',
          })
          .option('interactive', {
            alias: 'i',
            describe:
              'Start an interactive web UI for selecting package versions to release',
            type: 'boolean',
            default: false,
          })
          .option('port', {
            describe:
              'Port to run the interactive web UI server (only used with --interactive)',
            type: 'number',
            default: 3000,
          }),
    )
    .command(
      'check-deps',
      'Check dependency version bumps between git references',
      (commandYargs) =>
        commandYargs
          .option('from', {
            describe:
              'The starting git reference (commit, branch, or tag). If not provided, auto-detects from merge base with default branch.',
            type: 'string',
          })
          .option('to', {
            describe: 'The ending git reference (commit, branch, or tag).',
            type: 'string',
            default: 'HEAD',
          })
          .option('default-branch', {
            alias: 'b',
            describe:
              'The name of the default branch to compare against when auto-detecting.',
            default: 'main',
            type: 'string',
          })
          .option('fix', {
            describe:
              'Automatically update changelogs with missing dependency bump entries.',
            type: 'boolean',
            default: false,
          })
          .option('pr', {
            describe:
              'PR number to use in changelog entries (uses placeholder if not provided).',
            type: 'string',
          }),
    )
    .help()
    .strict()
    .demandCommand(0, 1)
    .parse();

  const command = args._[0] || 'release';

  if (command === 'check-deps') {
    return {
      ...args,
      command: 'check-deps',
      fromRef: args.from,
      toRef: args.to,
      defaultBranch: args.defaultBranch,
      fix: args.fix,
      pr: args.pr,
    } as CheckDepsCommandArguments;
  }

  return {
    ...args,
    command: 'release',
    projectDirectory: args.projectDirectory,
    tempDirectory: args.tempDirectory,
    reset: args.reset,
    backport: args.backport,
    defaultBranch: args.defaultBranch,
    interactive: args.interactive,
    port: args.port,
  } as ReleaseCommandArguments;
}
