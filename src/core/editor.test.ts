import { when } from 'jest-when';

import { determineEditor } from './editor.js';
import * as miscUtils from './misc-utils.js';

jest.mock('./misc-utils');

describe('editor', () => {
  describe('determineEditor', () => {
    it('returns information about the path if it resolves to an executable', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue('/path/to/resolved-editor');

      expect(await determineEditor('editor')).toStrictEqual({
        path: '/path/to/resolved-editor',
        args: [],
      });
    });

    it('defaults to VSCode if the given path does not resolve to an executable', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockResolvedValue('/path/to/code');

      expect(await determineEditor('editor')).toStrictEqual({
        path: '/path/to/code',
        args: ['--wait'],
      });
    });

    it('returns null if the given path cannot be resolved and VSCode cannot be found', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor('editor')).toBeNull();
    });

    it('returns null if the given path cannot be resolved and attempting to find VSCode fails', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockResolvedValue(null)
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor('editor')).toBeNull();
    });

    it('returns null if resolving the given path fails', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .mockRejectedValue(new Error('some error'))
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor('editor')).toBeNull();
    });

    it('returns null no path is given and VSCode cannot be found', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .mockResolvedValue(null);

      expect(await determineEditor(undefined)).toBeNull();
    });

    it('returns null no path is given and attempting to find VSCode fails', async () => {
      when(jest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .mockRejectedValue(new Error('some error'));

      expect(await determineEditor(undefined)).toBeNull();
    });
  });
});
