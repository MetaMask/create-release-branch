import which from 'which';
import {
  isErrorWithCode,
  isErrorWithMessage,
  isErrorWithStack,
  knownKeysOf,
  resolveExecutable,
} from './misc-utils';

jest.mock('which');

const whichMocked = jest.mocked(which);

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
      whichMocked.mockResolvedValue('/path/to/executable');

      expect(await resolveExecutable('executable')).toStrictEqual(
        '/path/to/executable',
      );
    });

    it('returns null if the given executable cannot be found', async () => {
      whichMocked.mockRejectedValue(new Error('not found: executable'));

      expect(await resolveExecutable('executable')).toBeNull();
    });

    it('throws the error that "which" throws if it is not a "not found" error', async () => {
      whichMocked.mockRejectedValue(new Error('something else'));

      await expect(resolveExecutable('executable')).rejects.toThrow(
        'something else',
      );
    });
  });
});
