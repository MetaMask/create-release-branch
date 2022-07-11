import os from 'os';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { readProject } from './project-utils';
import { followMonorepoWorkflow } from './monorepo-workflow-utils';

/**
 * Parse the arguments provided on the command.line.
 *
 * @returns A promise for the `yargs` arguments object.
 */
async function parseArgs() {
  return await yargs(hideBin(process.argv))
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

/**
 * The entrypoint to this script.
 */
async function main() {
  const args = await parseArgs();

  const projectDirectoryPath = path.resolve(
    process.cwd(),
    args.projectDirectory,
  );
  const project = await readProject(projectDirectoryPath);
  const tempDirectoryPath =
    args.tempDirectory === undefined
      ? path.join(
          os.tmpdir(),
          'create-release-branch',
          project.rootPackage.manifest.name.replace('/', '__'),
        )
      : path.resolve(process.cwd(), args.tempDirectory);
  const isMonorepo = Object.keys(project.workspacePackages).length > 0;

  if (isMonorepo) {
    console.log(
      'Project appears to have workspaces. Following monorepo workflow.',
    );
    await followMonorepoWorkflow(project, tempDirectoryPath, {
      firstRemovingExistingReleaseSpecification: args.reset,
    });
  } else {
    console.log(
      'Project does not appear to have any workspaces. Following polyrepo workflow.',
    );
    // TODO
  }
}

main().catch((error) => {
  console.error(error.stack);
  process.exit(1);
});
