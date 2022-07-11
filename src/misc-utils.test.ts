import * as whichModule from 'which';
import * as execaModule from 'execa';
import {
  isErrorWithCode,
  isErrorWithMessage,
  isErrorWithStack,
  wrapError,
  knownKeysOf,
  resolveExecutable,
  getStdoutFromCommand,
  runCommand,
} from './misc-utils';

jest.mock('which');
jest.mock('execa');

describe('misc-utils', () => {
  describe('isErrorWithCode', () => {
    it('returns true if given an object with a "code" property', () => {
      expect(isErrorWithCode({ code: 'some code' })).toBe(true);
    });

    it('returns false if given null', () => {
      expect(isErrorWithCode(null)).toBe(false);
    });

    it('returns false if given undefined', () => {
      expect(isErrorWithCode(undefined)).toBe(false);
    });

    it('returns false if given something that is not typeof object', () => {
      expect(isErrorWithCode(12345)).toBe(false);
    });

    it('returns false if given an object that does not have a "code" property', () => {
      expect(isErrorWithCode({})).toBe(false);
    });
  });

  describe('isErrorWithMessage', () => {
    it('returns true if given an object with a "message" property', () => {
      expect(isErrorWithMessage({ message: 'some message' })).toBe(true);
    });

    it('returns false if given null', () => {
      expect(isErrorWithMessage(null)).toBe(false);
    });

    it('returns false if given undefined', () => {
      expect(isErrorWithMessage(undefined)).toBe(false);
    });

    it('returns false if given something that is not typeof object', () => {
      expect(isErrorWithMessage(12345)).toBe(false);
    });

    it('returns false if given an object that does not have a "message" property', () => {
      expect(isErrorWithMessage({})).toBe(false);
    });
  });

  describe('isErrorWithStack', () => {
    it('returns true if given an object with a "stack" property', () => {
      expect(isErrorWithStack({ stack: 'some stack' })).toBe(true);
    });

    it('returns false if given null', () => {
      expect(isErrorWithStack(null)).toBe(false);
    });

    it('returns false if given undefined', () => {
      expect(isErrorWithStack(undefined)).toBe(false);
    });

    it('returns false if given something that is not typeof object', () => {
      expect(isErrorWithStack(12345)).toBe(false);
    });

    it('returns false if given an object that does not have a "stack" property', () => {
      expect(isErrorWithStack({})).toBe(false);
    });
  });

  describe('wrapError', () => {
    it('wraps the given error object by prepending the given prefix to its message', () => {
      const error = new Error('Some message');

      expect(
        wrapError(error, ({ message }) => `Some prefix: ${message}`),
      ).toMatchObject({
        message: 'Some prefix: Some message',
      });
    });

    it('returns a new error object that retains the "code" property of the original error object', () => {
      const error: any = new Error('foo');
      error.code = 'ESOMETHING';

      expect(wrapError(error)).toMatchObject({
        code: 'ESOMETHING',
      });
    });

    it('returns a new error object that retains the "stack" property of the original error object', () => {
      const error: any = new Error('foo');
      error.stack = 'some stack';

      expect(wrapError(error)).toMatchObject({
        stack: 'some stack',
      });
    });

    it('wraps the given string by prepending the given prefix to it', () => {
      expect(
        wrapError('Some message', ({ message }) => `Some prefix: ${message}`),
      ).toMatchObject({
        message: 'Some prefix: Some message',
      });
    });
  });

  describe('knownKeysOf', () => {
    it('returns the keys of an object', () => {
      const object = {
        foo: 'bar',
        baz: 'qux',
        fizz: 'buzz',
      };
      expect(knownKeysOf(object)).toStrictEqual(['foo', 'baz', 'fizz']);
    });
  });

  describe('resolveExecutable', () => {
    it('returns the fullpath of the given executable as returned by "which"', async () => {
      jest
        .spyOn(whichModule, 'default')
        .mockResolvedValue('/path/to/executable');

      expect(await resolveExecutable('executable')).toStrictEqual(
        '/path/to/executable',
      );
    });

    it('returns null if the given executable cannot be found', async () => {
      jest
        .spyOn(whichModule, 'default')
        .mockRejectedValue(new Error('not found: executable'));

      expect(await resolveExecutable('executable')).toBeNull();
    });

    it('throws the error that "which" throws if it is not a "not found" error', async () => {
      jest
        .spyOn(whichModule, 'default')
        .mockRejectedValue(new Error('something else'));

      await expect(resolveExecutable('executable')).rejects.toThrow(
        'something else',
      );
    });
  });

  describe('getStdoutFromCommand', () => {
    it('executes the given command and returns a version of the standard out from the command with whitespace trimmed', async () => {
      const execaSpy = jest
        .spyOn(execaModule, 'default')
        // Typecast: It's difficult to provide a full return value for execa
        .mockResolvedValue({ stdout: '   some output  ' } as any);

      const output = await getStdoutFromCommand(
        'some command',
        ['arg1', 'arg2'],
        { all: true },
      );

      expect(execaSpy).toHaveBeenCalledWith('some command', ['arg1', 'arg2'], {
        all: true,
      });
      expect(output).toStrictEqual('some output');
    });
  });

  describe('runCommand', () => {
    it('runs the command, discarding its output', async () => {
      const execaSpy = jest
        .spyOn(execaModule, 'default')
        // Typecast: It's difficult to provide a full return value for execa
        .mockResolvedValue({ stdout: '   some output  ' } as any);

      const result = await runCommand('some command', ['arg1', 'arg2'], {
        all: true,
      });

      expect(execaSpy).toHaveBeenCalledWith('some command', ['arg1', 'arg2'], {
        all: true,
      });
      expect(result).toBeUndefined();
    });
  });
});
