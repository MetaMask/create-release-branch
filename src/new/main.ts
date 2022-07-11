import os from 'os';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { readProject } from './project-utils';
import { followMonorepoWorkflow } from './monorepo-workflow-utils';

/**
 * The entrypoint to this script.
 */
async function main() {
  const args = await yargs(hideBin(process.argv))
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
    .option('force', {
      describe:
        'Removes any cached files from a previous run that may have been created.',
      type: 'boolean',
    })
    .help()
    .parse();

  const projectDirectoryPath = path.resolve(
    process.cwd(),
    args.projectDirectory,
  );
  const project = await readProject(projectDirectoryPath);
  const tempDirectory =
    args.tempDirectory === undefined
      ? path.join(
          os.tmpdir(),
          'create-release-branch',
          project.rootManifestFile.data.name.replace('/', '__'),
        )
      : path.resolve(process.cwd(), args.tempDirectory);

  if (Object.keys(project.workspaceManifestFiles).length > 0) {
    console.log(
      'Project appears to have workspaces. Following monorepo workflow.',
    );
    await followMonorepoWorkflow(project, tempDirectory, {
      firstRemovingExistingReleaseSpecification: args.force ?? false,
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
