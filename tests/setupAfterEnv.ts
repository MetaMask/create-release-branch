import { getErrorMessage } from '@metamask/utils';
import type { ExecaReturnValue } from 'execa';

import { isExecaError } from './helpers.js';

/**
 * Matches a series of lines that represent a stack trace (by looking for the
 * first instance of "at" preceded by some whitespace and then looking for a
 * final ")"). For example, this whole section should match:
 *
 * ```
 *      at c (/private/tmp/error.js:10:9)
 *      at b (/private/tmp/error.js:6:3)
 *      at a (/private/tmp/error.js:2:3)
 *      at Object.<anonymous> (/private/tmp/error.js:13:1)
 *      at Module._compile (node:internal/modules/cjs/loader:1105:14)
 * ```
 */
const STACK_TRACE_SECTION = /^\s+at.+\)$/msu;

declare global {
  // Using `namespace` here is okay because this is how the Jest types are
  // defined.
  /* eslint-disable-next-line @typescript-eslint/no-namespace */
  namespace jest {
    // We need to use `interface`, as well the same name for the type parameter,
    // because we are augmenting a type
    // eslint-disable-next-line @typescript-eslint/consistent-type-definitions, @typescript-eslint/naming-convention
    interface Matchers<R> {
      toResolve(): Promise<R>;
      toThrowExecaError(
        message: string,
        {
          replacements,
        }: { replacements: { from: string | RegExp; to: string }[] },
      ): Promise<R>;
    }
  }
}

// Export something so that TypeScript thinks that we are performing type
// augmentation
export {};

const UNRESOLVED = Symbol('timedOut');
// Store this in case it gets stubbed later
const originalSetTimeout = global.setTimeout;
const TIME_TO_WAIT_UNTIL_UNRESOLVED = 100;
const START = '▼▼▼ START ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼';
const END = '▲▲▲ END ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲';

/**
 * Produces a sort of dummy promise which can be used in conjunction with a
 * "real" promise to determine whether the "real" promise was ever resolved. If
 * the promise that is produced by this function resolves first, then the other
 * one must be unresolved.
 *
 * @param duration - How long to wait before resolving the promise returned by
 * this function.
 * @returns A promise that resolves to a symbol.
 */
const treatUnresolvedAfter = async (
  duration: number,
): Promise<typeof UNRESOLVED> => {
  return new Promise((resolve) => {
    originalSetTimeout(resolve, duration, UNRESOLVED);
  });
};

expect.extend({
  /**
   * Tests that the given promise is resolved within a certain amount of time
   * (which defaults to the time that Jest tests wait before timing out as
   * configured in the Jest configuration file).
   *
   * Inspired by <https://stackoverflow.com/a/68409467/260771>.
   *
   * @param promise - The promise to test.
   * @returns The result of the matcher.
   */
  async toResolve(promise: Promise<any>) {
    if (this.isNot) {
      throw new Error(
        'Using `.not.toResolve()` is not supported. Use .rejects.toThrow(expect.anything()) instead.',
      );
    }

    let resolutionValue: any;
    let rejectionValue: any;

    try {
      resolutionValue = await Promise.race([
        promise,
        treatUnresolvedAfter(TIME_TO_WAIT_UNTIL_UNRESOLVED),
      ]);
    } catch (error) {
      rejectionValue = error;
    }

    return rejectionValue !== undefined || resolutionValue === UNRESOLVED
      ? {
          message: () => {
            return `Expected promise to resolve after ${TIME_TO_WAIT_UNTIL_UNRESOLVED}ms, but it ${
              rejectionValue === undefined ? 'did not' : 'was rejected'
            }.`;
          },
          pass: false,
        }
      : {
          message: () =>
            `This message should never get produced because .isNot is disallowed.`,
          pass: true,
        };
  },

  async toThrowExecaError(
    promise: Promise<ExecaReturnValue<string>>,
    message: string,
    { replacements }: { replacements: { from: string | RegExp; to: string }[] },
  ) {
    try {
      await promise;
      return {
        message: () =>
          'Expected running the tool to fail with the given error message, but it did not.',
        pass: false,
      };
    } catch (error) {
      if (isExecaError(error)) {
        const stderr = [
          {
            from: STACK_TRACE_SECTION,
            to: '<<stack-trace>>',
          },
          ...replacements,
        ].reduce((string, { from, to }) => {
          return string.replace(from, to);
        }, error.stderr);

        if (stderr === message) {
          return {
            message: () =>
              'Expected running the tool not to fail with the given error message, but it did',
            pass: true,
          };
        }

        return {
          message: () =>
            `Expected running the tool to fail with:\n\n${START}\n${message}\n${END}\n\nBut it failed instead with:\n\n${START}\n${stderr}\n${END}`,
          pass: false,
        };
      }

      return {
        message: () =>
          `Expected running the tool to fail with an error from \`execa\`, but it failed with:\n\n${getErrorMessage(error)}`,
        pass: false,
      };
    }
  },
});
