// This file tests a file that is concerned with accessing environment
// variables.
/* eslint-disable n/no-process-env */

/**
 * Environment variables that this tool uses.
 */
type Env = {
  // Environment variables are uppercase by convention.
  // eslint-disable-next-line @typescript-eslint/naming-convention
  EDITOR: string | undefined;
};

/**
 * Returns all of the environment variables that this tool uses.
 *
 * @returns An object with a selection of properties from `process.env` that
 * this tool needs to access, whether their values are defined or not.
 */
export function getEnvironmentVariables(): Env {
  return ['EDITOR'].reduce(
    (object, key) => {
      return { ...object, [key]: process.env[key] };
    },
    {
      EDITOR: undefined,
    },
  );
}
