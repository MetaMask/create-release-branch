import { getEnvironmentVariables } from './env-utils';
import { debug, resolveExecutable } from './misc-utils';

/**
 * Information about the editor present on the user's computer.
 *
 * @property path - The path to the executable representing the editor.
 * @property args - Command-line arguments to pass to the executable when
 * calling it.
 */
export interface Editor {
  path: string;
  args: string[];
}

/**
 * Looks for an executable that represents a code editor on your computer. Tries
 * the `EDITOR` environment variable first, falling back to the executable that
 * represents VSCode (`code`).
 *
 * @returns A promise that contains information about the found editor (path and
 * arguments), or null otherwise.
 */
export async function determineEditor(): Promise<Editor | null> {
  let executablePath: string | null = null;
  const executableArgs: string[] = [];
  const env = getEnvironmentVariables();

  if (env.EDITOR !== undefined) {
    try {
      executablePath = await resolveExecutable(env.EDITOR);
    } catch (error) {
      debug(
        `Could not resolve executable ${env.EDITOR} (${error}), falling back to VSCode`,
      );
      executablePath = await resolveExecutable('code');
      // Waits until the file is closed before returning
      executableArgs.push('--wait');
    }
  }

  if (executablePath) {
    return { path: executablePath, args: executableArgs };
  }

  return null;
}
