import { debug } from './misc-utils.js';
import { Project } from './project.js';
import {
  branchExists,
  getCurrentBranchName,
  runGitCommandWithin,
} from './repo.js';
import { ReleaseType } from './types.js';

/**
 * Creates a new release branch in the given project repository based on the specified release type.
 *
 * @param args - The arguments.
 * @param args.project - Information about the whole project (e.g., names of
 * packages and where they can found).
 * @param args.releaseType - The type of release ("ordinary" or "backport"),
 * which affects how the version is bumped.
 * @returns A promise that resolves to an object with the new
 * release version and a boolean indicating whether it's the first run.
 */
export async function createReleaseBranch({
  project,
  releaseType,
}: {
  project: Project;
  releaseType: ReleaseType;
}): Promise<{
  version: string;
  firstRun: boolean;
}> {
  const newReleaseVersion =
    releaseType === 'backport'
      ? `${project.releaseVersion.ordinaryNumber}.${
          project.releaseVersion.backportNumber + 1
        }.0`
      : `${project.releaseVersion.ordinaryNumber + 1}.0.0`;

  const releaseBranchName = `release/${newReleaseVersion}`;

  const currentBranchName = await getCurrentBranchName(project.directoryPath);

  if (currentBranchName === releaseBranchName) {
    debug(`Already on ${releaseBranchName} branch.`);
    return {
      version: newReleaseVersion,
      firstRun: false,
    };
  }

  if (await branchExists(project.directoryPath, releaseBranchName)) {
    debug(
      `Current release branch already exists. Checking out the existing branch.`,
    );
    await runGitCommandWithin(project.directoryPath, 'checkout', [
      releaseBranchName,
    ]);
    return {
      version: newReleaseVersion,
      firstRun: false,
    };
  }

  await runGitCommandWithin(project.directoryPath, 'checkout', [
    '-b',
    releaseBranchName,
  ]);

  return {
    version: newReleaseVersion,
    firstRun: true,
  };
}
