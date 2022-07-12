import { when } from 'jest-when';
import { determineEditor } from './editor-utils';
import { getEnvironmentVariables } from './env-utils';
import { resolveExecutable } from './misc-utils';

jest.mock('./env-utils', () => {
  return {
    getEnvironmentVariables: jest.fn(),
  };
});

jest.mock('./misc-utils', () => {
  return {
    ...jest.requireActual('./misc-utils'),
    resolveExecutable: jest.fn(),
  };
});

const mockedGetEnvironmentVariables = jest.mocked(getEnvironmentVariables);
const mockedResolveExecutable = jest.mocked(resolveExecutable);

describe('editor-utils', () => {
  describe('determineEditor', () => {
    it('returns information about the editor from EDITOR if it resolves to an executable', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockResolvedValue('/path/to/resolved-editor');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/resolved-editor',
        args: [],
      });
    });

    it('falls back to VSCode if it exists and if EDITOR does not point to an executable', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockResolvedValue(null);
      when(mockedResolveExecutable)
        .calledWith('code')
        .mockResolvedValue('/path/to/code');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/code',
        args: ['--wait'],
      });
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode returns null', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockResolvedValue(null);
      when(mockedResolveExecutable).calledWith('code').mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode throws', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockResolvedValue(null);
      when(mockedResolveExecutable)
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode returns null', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockRejectedValue(new Error('some error'));
      when(mockedResolveExecutable).calledWith('code').mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode throws', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: 'editor' });
      when(mockedResolveExecutable)
        .calledWith('editor')
        .mockRejectedValue(new Error('some error'));
      when(mockedResolveExecutable)
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode returns null', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: undefined });
      when(mockedResolveExecutable).calledWith('code').mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode throws', async () => {
      mockedGetEnvironmentVariables.mockReturnValue({ EDITOR: undefined });
      when(mockedResolveExecutable)
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });
  });
});
