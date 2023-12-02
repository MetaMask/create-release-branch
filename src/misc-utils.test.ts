import * as whichModule from 'which';
import * as execaModule from 'execa';
import {
  isErrorWithCode,
  isErrorWithMessage,
  isErrorWithStack,
  wrapError,
  resolveExecutable,
  runCommand,
  getStdoutFromCommand,
  getLinesFromCommand,
} from './misc-utils.js';

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
    it('returns a new Error that links to the given Error', () => {
      const originalError = new Error('oops');
      const newError = wrapError('Some message', originalError);

      expect(newError.message).toBe('Some message');
      expect(newError.cause).toBe(originalError);
    });

    it('copies over any "code" property that exists on the given Error', () => {
      const originalError: any = new Error('oops');
      originalError.code = 'CODE';
      const newError: any = wrapError('Some message', originalError);

      expect(newError.code).toBe('CODE');
    });

    it('returns a new Error which prefixes the given message', () => {
      const newError = wrapError('Some message', 'Some original message');

      expect(newError.message).toBe('Some message: Some original message');
      expect(newError.cause).toBeUndefined();
    });
  });

  describe('resolveExecutable', () => {
    it('returns the fullpath of the given executable as returned by "which"', async () => {
      jest
        .spyOn(whichModule, 'default')
        .mockResolvedValue('/path/to/executable');

      expect(await resolveExecutable('executable')).toBe('/path/to/executable');
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
      expect(output).toBe('some output');
    });
  });

  describe('getLinesFromCommand', () => {
    it('executes the given command and returns the standard out from the command split into lines', async () => {
      const execaSpy = jest
        .spyOn(execaModule, 'default')
        // Typecast: It's difficult to provide a full return value for execa
        .mockResolvedValue({ stdout: 'line 1\nline 2\nline 3' } as any);

      const lines = await getLinesFromCommand(
        'some command',
        ['arg1', 'arg2'],
        { all: true },
      );

      expect(execaSpy).toHaveBeenCalledWith('some command', ['arg1', 'arg2'], {
        all: true,
      });
      expect(lines).toStrictEqual(['line 1', 'line 2', 'line 3']);
    });

    it('does not strip leading and trailing whitespace from the output, but does remove empty lines', async () => {
      const execaSpy = jest
        .spyOn(execaModule, 'default')
        // Typecast: It's difficult to provide a full return value for execa
        .mockResolvedValue({
          stdout: '  line 1\nline 2\n\n   line 3   \n',
        } as any);

      const lines = await getLinesFromCommand(
        'some command',
        ['arg1', 'arg2'],
        { all: true },
      );

      expect(execaSpy).toHaveBeenCalledWith('some command', ['arg1', 'arg2'], {
        all: true,
      });
      expect(lines).toStrictEqual(['  line 1', 'line 2', '   line 3   ']);
    });
  });
});
