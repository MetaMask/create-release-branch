interface Env {
  EDITOR: string | undefined;
}

/**
 * Returns all of the environment variables that this tool uses.
 *
 * @returns An object with all of the properties that will be accessed, whether
 * their values are defined or not.
 */
export function getEnvironmentVariables(): Env {
  return {
    EDITOR: process.env.EDITOR,
  };
}
