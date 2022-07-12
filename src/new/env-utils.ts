interface Env {
  EDITOR: string | undefined;
  TODAY: string | undefined;
}

/**
 * Returns all of the environment variables that this tool uses.
 *
 * @returns An object with a selection of properties from `process.env` that
 * this tool needs to access, whether their values are defined or not.
 */
export function getEnvironmentVariables(): Env {
  return ['EDITOR', 'TODAY'].reduce((object, key) => {
    return { ...object, [key]: process.env[key] };
  }, {} as Env);
}
