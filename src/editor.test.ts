import { when } from 'jest-when';
import { determineEditor } from './editor';
import * as envModule from './env';
import * as miscUtils from './misc-utils';

jest.mock('./env');
jest.mock('./misc-utils');

describe('editor', () => {
  describe('determineEditor', () => {
    it('returns information about the editor from EDITOR if it resolves to an executable', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue('/path/to/resolved-editor');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/resolved-editor',
        args: [],
      });
    });

    it('falls back to VSCode if it exists and if EDITOR does not point to an executable', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockResolvedValue('/path/to/code');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/code',
        args: ['--wait'],
      });
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode returns null', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode throws', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode returns null', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockRejectedValue(new Error('some error'))
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode throws', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor', TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockRejectedValue(new Error('some error'))
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode returns null', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined, TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode throws', async () => {
      jest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined, TODAY: undefined });
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });
  });
});
