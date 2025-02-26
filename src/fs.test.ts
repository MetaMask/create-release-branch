import fs from 'fs';
import path from 'path';
import { rimraf } from 'rimraf';
import { when } from 'vitest-when';
import * as actionUtils from '@metamask/action-utils';
import { withSandbox } from '../tests/helpers.js';
import {
  readFile,
  writeFile,
  readJsonObjectFile,
  writeJsonFile,
  fileExists,
  ensureDirectoryPathExists,
  removeFile,
} from './fs.js';

vitest.mock('@metamask/action-utils');

describe('fs', () => {
  describe('readFile', () => {
    it('reads the contents of the given file as a UTF-8-encoded string', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'test');

        await fs.promises.writeFile(filePath, 'some content 😄');

        expect(await readFile(filePath)).toBe('some content 😄');
      });
    });

    it('re-throws any error that occurs as a new error that points to the original', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'nonexistent');

        await expect(readFile(filePath)).rejects.toThrow(
          expect.objectContaining({
            message: `Could not read file '${filePath}'`,
            cause: expect.objectContaining({
              message: `ENOENT: no such file or directory, open '${filePath}'`,
            }),
          }),
        );
      });
    });
  });

  describe('writeFile', () => {
    it('writes the given data to the given file', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'test');

        await writeFile(filePath, 'some content 😄');

        expect(await fs.promises.readFile(filePath, 'utf8')).toBe(
          'some content 😄',
        );
      });
    });

    it('re-throws any error that occurs as a new error that points to the original', async () => {
      await withSandbox(async (sandbox) => {
        await rimraf(sandbox.directoryPath);
        const filePath = path.join(sandbox.directoryPath, 'test');

        await expect(writeFile(filePath, 'some content 😄')).rejects.toThrow(
          expect.objectContaining({
            message: `Could not write file '${filePath}'`,
            cause: expect.objectContaining({
              message: `ENOENT: no such file or directory, open '${filePath}'`,
            }),
          }),
        );
      });
    });
  });

  describe('readJsonObjectFile', () => {
    it('uses readJsonObjectFile from @metamask/action-utils to parse the contents of the given JSON file as an object', async () => {
      const filePath = '/some/file';
      when(vitest.spyOn(actionUtils, 'readJsonObjectFile'))
        .calledWith(filePath)
        .thenResolve({ some: 'object' });

      expect(await readJsonObjectFile(filePath)).toStrictEqual({
        some: 'object',
      });
    });

    it('re-throws any error that occurs as a new error that points to the original', async () => {
      const filePath = '/some/file';
      const error = new Error('oops');
      when(vitest.spyOn(actionUtils, 'readJsonObjectFile'))
        .calledWith(filePath)
        .thenReject(error);

      await expect(readJsonObjectFile(filePath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not read JSON file '${filePath}'`,
          cause: error,
        }),
      );
    });
  });

  describe('writeJsonFile', () => {
    it('uses writeJsonFile from @metamask/action-utils to write the given object to the given file as JSON', async () => {
      const filePath = '/some/file';
      when(vitest.spyOn(actionUtils, 'writeJsonFile'))
        .calledWith(filePath, { some: 'object' })
        .thenResolve(undefined);

      expect(await writeJsonFile(filePath, { some: 'object' })).toBeUndefined();
    });

    it('re-throws any error that occurs as a new error that points to the original', async () => {
      const filePath = '/some/file';
      const error = new Error('oops');
      when(vitest.spyOn(actionUtils, 'writeJsonFile'))
        .calledWith(filePath, { some: 'object' })
        .thenReject(error);

      await expect(writeJsonFile(filePath, { some: 'object' })).rejects.toThrow(
        expect.objectContaining({
          message: `Could not write JSON file '${filePath}'`,
          cause: error,
        }),
      );
    });
  });

  describe('fileExists', () => {
    it('returns true if the given path refers to an existing file', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'test');
        await fs.promises.writeFile(filePath, 'some content');

        expect(await fileExists(filePath)).toBe(true);
      });
    });

    it('returns false if the given path refers to something that is not a file', async () => {
      await withSandbox(async (sandbox) => {
        const dirPath = path.join(sandbox.directoryPath, 'test');
        await fs.promises.mkdir(dirPath);

        expect(await fileExists(dirPath)).toBe(false);
      });
    });

    it('returns false if the given path does not refer to any existing entry', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'nonexistent');

        expect(await fileExists(filePath)).toBe(false);
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const entryPath = '/some/file';
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(vitest.spyOn(fs.promises, 'stat'))
        .calledWith(entryPath)
        .thenReject(error);

      await expect(fileExists(entryPath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not determine if file exists '${entryPath}'`,
          cause: error,
        }),
      );
    });

    it('re-throws any error that occurs as a new error that points to the original', async () => {
      const entryPath = '/some/file';
      const error = new Error('oops');
      when(vitest.spyOn(fs.promises, 'stat'))
        .calledWith(entryPath)
        .thenReject(error);

      await expect(fileExists(entryPath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not determine if file exists '${entryPath}'`,
          cause: error,
        }),
      );
    });
  });

  describe('ensureDirectoryPathExists', () => {
    it('creates directories leading up to and including the given path', async () => {
      await withSandbox(async (sandbox) => {
        const directoryPath = path.join(
          sandbox.directoryPath,
          'foo',
          'bar',
          'baz',
        );

        await ensureDirectoryPathExists(directoryPath);

        await expect(
          fs.promises.readdir(path.join(sandbox.directoryPath, 'foo')),
        ).toResolve();
        await expect(
          fs.promises.readdir(path.join(sandbox.directoryPath, 'foo', 'bar')),
        ).toResolve();
        await expect(
          fs.promises.readdir(
            path.join(sandbox.directoryPath, 'foo', 'bar', 'baz'),
          ),
        ).toResolve();
      });
    });

    it('does not throw an error, returning undefined, if the given directory already exists', async () => {
      await withSandbox(async (sandbox) => {
        const directoryPath = path.join(
          sandbox.directoryPath,
          'foo',
          'bar',
          'baz',
        );
        await fs.promises.mkdir(path.join(sandbox.directoryPath, 'foo'));
        await fs.promises.mkdir(path.join(sandbox.directoryPath, 'foo', 'bar'));
        await fs.promises.mkdir(
          path.join(sandbox.directoryPath, 'foo', 'bar', 'baz'),
        );

        await expect(ensureDirectoryPathExists(directoryPath)).toResolve();
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const directoryPath = '/some/directory';
      const error = new Error('oops');
      when(vitest.spyOn(fs.promises, 'mkdir'))
        .calledWith(directoryPath, { recursive: true })
        .thenReject(error);

      await expect(ensureDirectoryPathExists(directoryPath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not create directory path '${directoryPath}'`,
          cause: error,
        }),
      );
    });
  });

  describe('removeFile', () => {
    it('removes the file at the given path', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'foo');
        await fs.promises.writeFile(filePath, 'some content');

        expect(await removeFile(filePath)).toBeUndefined();
      });
    });

    it('does nothing if the given file does not exist', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'foo');
        expect(await removeFile(filePath)).toBeUndefined();
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const filePath = '/some/file';
      const error = new Error('oops');
      when(vitest.spyOn(fs.promises, 'rm'))
        .calledWith(filePath, { force: true })
        .thenReject(error);

      await expect(removeFile(filePath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not remove file '${filePath}'`,
          cause: error,
        }),
      );
    });
  });
});
