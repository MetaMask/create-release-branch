import { debug, resolveExecutable } from './utils';

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

  if (process.env.EDITOR !== undefined) {
    try {
      executablePath = await resolveExecutable(process.env.EDITOR);
    } catch (error) {
      debug(
        `Could not resolve executable ${process.env.EDITOR} (${error}), falling back to VSCode`,
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
