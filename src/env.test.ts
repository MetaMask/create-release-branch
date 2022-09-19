import { getEnvironmentVariables } from './env';

describe('env', () => {
  describe('getEnvironmentVariables', () => {
    let existingProcessEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      existingProcessEnv = { ...process.env };
    });

    afterEach(() => {
      Object.keys(existingProcessEnv).forEach((key) => {
        process.env[key] = existingProcessEnv[key];
      });
    });

    it('returns only the environment variables from process.env that we use in this tool', () => {
      process.env.EDITOR = 'editor';
      process.env.EXTRA = 'extra';

      expect(getEnvironmentVariables()).toStrictEqual({
        EDITOR: 'editor',
      });
    });
  });
});
