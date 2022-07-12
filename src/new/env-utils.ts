interface Env {
  EDITOR: string | undefined;
}

/**
 * Returns all of the environment variables that this tool uses.
 *
 * @returns An object with a selection of properties from `process.env` that
 * this tool needs to access, whether their values are defined or not.
 */
export function getEnvironmentVariables(): Env {
  return {
    EDITOR: process.env.EDITOR,
  };
}
