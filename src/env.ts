type Env = {
  EDITOR: string | undefined;
  SSH_AUTH_SOCK: string | undefined;
};

/**
 * The environment variables that this tool can use.
 *
 * - EDITOR: The text editor used to edit the release spec.
 * - SSH_AUTH_SOCK: The path to the SSH agent socket.
 */
const ALLOWED_ENV_VARS = ['EDITOR', 'SSH_AUTH_SOCK'];

/**
 * Returns all of the environment variables that this tool uses.
 *
 * @returns An object with a selection of properties from `process.env` that
 * this tool needs to access, whether their values are defined or not.
 */
export function getEnvironmentVariables(): Env {
  return ALLOWED_ENV_VARS.reduce(
    (object, key) => {
      return { ...object, [key]: process.env[key] };
    },
    {
      EDITOR: undefined,
      SSH_AUTH_SOCK: undefined,
    },
  );
}
