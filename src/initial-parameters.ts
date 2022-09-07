import os from 'os';
import path from 'path';
import { parseISO as parseDateAsISO } from 'date-fns';
import { readCommandLineArguments } from './command-line-arguments';
import { getEnvironmentVariables } from './env';
import { readProject, Project } from './project';

/**
 * States in which this tool can run.
 *
 * @property start - Starts from the beginning.
 * @property continue - Resumes from a previous run.
 * @property abort - Discards a previous run.
 */
export enum Phases {
  Start = 'start',
  Continue = 'continue',
  Abort = 'abort',
}

/**
 * The information that the tool requires to start its workflow.
 *
 * @property project - Information about the project.
 * @property tempDirectoryPath - A directory in which to hold the generated
 * release spec file.
 * @property today - A representation of "today" which will be used to set the
 * release date.
 * @property phase - The exact branch of the overall workflow that the tool
 * will follow.
 */
interface InitialParameters {
  project: Project;
  tempDirectoryPath: string;
  today: Date;
  phase: Phases;
}

/**
 * Gathers information about the project by first resolving the given path
 * relative to the current working directory.
 *
 * @param partialProjectDirectoryPath - Either an absolute path or a path
 * relative to the current working directory.
 * @param cwd - The current working directory.
 * @returns The project.
 */
async function determineProject(
  partialProjectDirectoryPath: string,
  cwd: string,
): Promise<Project> {
  return await readProject(path.resolve(cwd, partialProjectDirectoryPath));
}

/**
 * Determines the path of the temporary directory that this tool will use by
 * resolving the given path relative to the current working directory or by
 * generating a path within within the OS's temporary directory.
 *
 * @param partialTempDirectoryPath - An absolute path, a path relative to the
 * current working directory, or undefined.
 * @param project - The project.
 * @param cwd - The current working directory.
 * @returns The temporary directory path.
 */
function determineTempDirectoryPath(
  partialTempDirectoryPath: string | undefined,
  project: Project,
  cwd: string,
): string {
  return partialTempDirectoryPath === undefined
    ? path.join(
        os.tmpdir(),
        'create-release-branch',
        project.rootPackage.validatedManifest.name.replace('/', '__'),
      )
    : path.resolve(cwd, partialTempDirectoryPath);
}

/**
 * Determines the representation of "today" that this tool will use to set the
 * release version by converting the given date string to a Date object or using
 * the current date if a date is not given.
 *
 * @param today - Either a date string in UTC format, or undefined.
 * @returns The date that represents "today".
 */
function determineToday(today: string | undefined): Date {
  const parsedTodayTimestamp =
    today === undefined ? NaN : parseDateAsISO(today).getTime();
  return isNaN(parsedTodayTimestamp)
    ? new Date()
    : new Date(parsedTodayTimestamp);
}

/**
 * Determines the state in which this tool can run.
 *
 * - `--continue` will resume from a previous run.
 * - `--abort` will discard a previous run.
 * - Neither of these will start from the beginning.
 *
 * @param options - The command-line options.
 * @param options.continue - Whether or not `--continue` was provided as a
 * command-line option.
 * @param options.abort - Whether or not `--abort` was provided as a
 * command-line option.
 * @returns The phase.
 */
function determinePhase(options: { continue: boolean; abort: boolean }) {
  if (options.abort) {
    return Phases.Abort;
  } else if (options.continue) {
    return Phases.Continue;
  }

  return Phases.Start;
}

/**
 * Reads the inputs given to this tool via `process.argv` and uses them to
 * gather information that the tool requires to start its workflow.
 *
 * @param argv - The arguments to this executable.
 * @param cwd - The directory in which this executable was run.
 * @returns The initial parameters.
 */
export async function determineInitialParameters(
  argv: string[],
  cwd: string,
): Promise<InitialParameters> {
  const inputs = await readCommandLineArguments(argv);
  const env = getEnvironmentVariables();

  const project = await determineProject(inputs.projectDirectory, cwd);
  const tempDirectoryPath = determineTempDirectoryPath(
    inputs.tempDirectory,
    project,
    cwd,
  );
  const today = determineToday(env.TODAY);
  const phase = determinePhase({
    continue: inputs.continue,
    abort: inputs.abort,
  });

  return { project, tempDirectoryPath, today, phase };
}
