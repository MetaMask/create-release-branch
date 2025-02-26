import { when } from 'vitest-when';
import { determineEditor } from './editor.js';
import * as envModule from './env.js';
import * as miscUtils from './misc-utils.js';

vitest.mock('./env');
vitest.mock('./misc-utils');

describe('editor', () => {
  describe('determineEditor', () => {
    it('returns information about the editor from EDITOR if it resolves to an executable', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenResolve('/path/to/resolved-editor');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/resolved-editor',
        args: [],
      });
    });

    it('falls back to VSCode if it exists and if EDITOR does not point to an executable', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenResolve(null);
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenResolve('/path/to/code');

      expect(await determineEditor()).toStrictEqual({
        path: '/path/to/code',
        args: ['--wait'],
      });
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode returns null', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenResolve(null);
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenResolve(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR returns null and resolving VSCode throws', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenResolve(null);
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenReject(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode returns null', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenReject(new Error('some error'));
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenResolve(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if resolving EDITOR throws and resolving VSCode throws', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: 'editor' });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('editor')
        .thenReject(new Error('some error'));
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenReject(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode returns null', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenResolve(null);

      expect(await determineEditor()).toBeNull();
    });

    it('returns null if EDITOR is unset and resolving VSCode throws', async () => {
      vitest
        .spyOn(envModule, 'getEnvironmentVariables')
        .mockReturnValue({ EDITOR: undefined });
      when(vitest.spyOn(miscUtils, 'resolveExecutable'))
        .calledWith('code')
        .thenReject(new Error('some error'));

      expect(await determineEditor()).toBeNull();
    });
  });
});
