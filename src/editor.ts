import { getErrorMessage } from '@metamask/utils';

import { getEnvironmentVariables } from './env.js';
import { debug, resolveExecutable } from './misc-utils.js';

/**
 * Information about the editor present on the user's computer.
 *
 * @property path - The path to the executable representing the editor.
 * @property args - Command-line arguments to pass to the executable when
 * calling it.
 */
export type Editor = {
  path: string;
  args: string[];
};

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
  const { EDITOR } = getEnvironmentVariables();

  if (EDITOR !== undefined) {
    try {
      executablePath = await resolveExecutable(EDITOR);
    } catch (error) {
      debug(
        `Could not resolve executable ${EDITOR} (${getErrorMessage(error)}), falling back to VSCode`,
      );
    }
  }

  if (executablePath === null) {
    try {
      executablePath = await resolveExecutable('code');
      // Waits until the file is closed before returning
      executableArgs.push('--wait');
    } catch (error) {
      debug(
        `Could not resolve path to VSCode: ${getErrorMessage(error)}, continuing regardless`,
      );
    }
  }

  if (executablePath !== null) {
    return { path: executablePath, args: executableArgs };
  }

  return null;
}
