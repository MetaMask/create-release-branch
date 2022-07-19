import fs from 'fs';
import path from 'path';
import util from 'util';
import rimraf from 'rimraf';
import { when } from 'jest-when';
import * as actionUtils from '@metamask/action-utils';
import { withSandbox } from '../tests/unit/helpers';
import {
  readFile,
  writeFile,
  readJsonObjectFile,
  writeJsonFile,
  fileExists,
  ensureDirectoryPathExists,
  removeFile,
} from './file-utils';

jest.mock('@metamask/action-utils');

const promisifiedRimraf = util.promisify(rimraf);

describe('file-utils', () => {
  describe('readFile', () => {
    it('reads the contents of the given file as a UTF-8-encoded string', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'test');

        await fs.promises.writeFile(filePath, 'some content 😄');

        expect(await readFile(filePath)).toStrictEqual('some content 😄');
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      await withSandbox(async (sandbox) => {
        const filePath = path.join(sandbox.directoryPath, 'nonexistent');

        await expect(readFile(filePath)).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringMatching(
              new RegExp(
                `^Could not read file '${filePath}': ENOENT: no such file or directory, open '${filePath}'`,
                'u',
              ),
            ),
            code: 'ENOENT',
            stack: expect.anything(),
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

        expect(await fs.promises.readFile(filePath, 'utf8')).toStrictEqual(
          'some content 😄',
        );
      });
    });

    it.only('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      await withSandbox(async (sandbox) => {
        await promisifiedRimraf(sandbox.directoryPath);
        const filePath = path.join(sandbox.directoryPath, 'test');

        await expect(writeFile(filePath, 'some content 😄')).rejects.toThrow(
          expect.objectContaining({
            message: expect.stringMatching(
              new RegExp(
                `^Could not write file '${filePath}': ENOENT: no such file or directory, open '${filePath}'`,
                'u',
              ),
            ),
            code: 'ENOENT',
            stack: expect.anything(),
          }),
        );
      });
    });
  });

  describe('readJsonObjectFile', () => {
    it('uses readJsonObjectFile from @metamask/action-utils to parse the contents of the given JSON file as an object', async () => {
      const filePath = '/some/file';
      when(jest.spyOn(actionUtils, 'readJsonObjectFile'))
        .calledWith(filePath)
        .mockResolvedValue({ some: 'object' });

      expect(await readJsonObjectFile(filePath)).toStrictEqual({
        some: 'object',
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const filePath = '/some/file';
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(jest.spyOn(actionUtils, 'readJsonObjectFile'))
        .calledWith(filePath)
        .mockRejectedValue(error);

      await expect(readJsonObjectFile(filePath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not read JSON file '${filePath}': oops`,
          code: 'ESOMETHING',
          stack: 'some stack',
        }),
      );
    });
  });

  describe('writeJsonFile', () => {
    it('uses writeJsonFile from @metamask/action-utils to write the given object to the given file as JSON', async () => {
      const filePath = '/some/file';
      when(jest.spyOn(actionUtils, 'writeJsonFile'))
        .calledWith(filePath, { some: 'object' })
        .mockResolvedValue(undefined);

      expect(await writeJsonFile(filePath, { some: 'object' })).toBeUndefined();
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const filePath = '/some/file';
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(jest.spyOn(actionUtils, 'writeJsonFile'))
        .calledWith(filePath, { some: 'object' })
        .mockRejectedValue(error);

      await expect(writeJsonFile(filePath, { some: 'object' })).rejects.toThrow(
        expect.objectContaining({
          message: `Could not write JSON file '${filePath}': oops`,
          code: 'ESOMETHING',
          stack: 'some stack',
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
      when(jest.spyOn(fs.promises, 'stat'))
        .calledWith(entryPath)
        .mockRejectedValue(error);

      await expect(fileExists(entryPath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not determine if file exists '${entryPath}': oops`,
          code: 'ESOMETHING',
          stack: 'some stack',
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

        // We don't really need this expectations, but it is here to satisfy
        // ESLint
        const results = await Promise.all([
          fs.promises.readdir(path.join(sandbox.directoryPath, 'foo')),
          fs.promises.readdir(path.join(sandbox.directoryPath, 'foo', 'bar')),
          fs.promises.readdir(
            path.join(sandbox.directoryPath, 'foo', 'bar', 'baz'),
          ),
        ]);
        expect(JSON.parse(JSON.stringify(results))).toStrictEqual([
          ['bar'],
          ['baz'],
          [],
        ]);
      });
    });

    it('does nothing if the given directory already exists', async () => {
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

        // We don't really need this expectations, but it is here to satisfy
        // ESLint
        expect(await ensureDirectoryPathExists(directoryPath)).toBeUndefined();
      });
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const directoryPath = '/some/directory';
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(jest.spyOn(fs.promises, 'mkdir'))
        .calledWith(directoryPath, { recursive: true })
        .mockRejectedValue(error);

      await expect(ensureDirectoryPathExists(directoryPath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not create directory path '${directoryPath}': oops`,
          code: 'ESOMETHING',
          stack: 'some stack',
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
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(jest.spyOn(fs.promises, 'rm'))
        .calledWith(filePath, { force: true })
        .mockRejectedValue(error);

      await expect(removeFile(filePath)).rejects.toThrow(
        expect.objectContaining({
          message: `Could not remove file '${filePath}': oops`,
          code: 'ESOMETHING',
          stack: 'some stack',
        }),
      );
    });
  });
});
