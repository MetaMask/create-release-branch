import fs from 'fs';
import os from 'os';
import path from 'path';
import rimraf from 'rimraf';
import { when } from 'jest-when';
import {
  readJsonObjectFile as underlyingReadJsonObjectFile,
  writeJsonFile as underlyingWriteJsonFile,
} from '@metamask/action-utils';
import {
  readFile,
  writeFile,
  readJsonObjectFile,
  writeJsonFile,
  fileExists,
} from './file-utils';

jest.mock('@metamask/action-utils', () => {
  return {
    ...jest.requireActual('@metamask/action-utils'),
    readJsonObjectFile: jest.fn(),
    writeJsonFile: jest.fn(),
  };
});

const TEMP_DIRECTORY = path.join(os.tmpdir(), 'create-release-branch-tests');

const mockedUnderlyingReadJsonObjectFile = jest.mocked(
  underlyingReadJsonObjectFile,
);
const mockedUnderlyingWriteJsonFile = jest.mocked(underlyingWriteJsonFile);

describe('file-utils', () => {
  beforeEach(async () => {
    await new Promise((resolve) => rimraf(TEMP_DIRECTORY, resolve));
    await fs.promises.mkdir(TEMP_DIRECTORY);
  });

  describe('readFile', () => {
    it('reads the contents of the given file as a UTF-8-encoded string', async () => {
      const filePath = path.join(TEMP_DIRECTORY, 'test');

      await fs.promises.writeFile(filePath, 'some content 😄');

      expect(await readFile(filePath)).toStrictEqual('some content 😄');
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const filePath = path.join(TEMP_DIRECTORY, 'nonexistent');

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

  describe('writeFile', () => {
    it('writes the given data to the given file', async () => {
      const filePath = path.join(TEMP_DIRECTORY, 'test');

      await writeFile(filePath, 'some content 😄');

      expect(await fs.promises.readFile(filePath, 'utf8')).toStrictEqual(
        'some content 😄',
      );
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      await new Promise((resolve) => rimraf(TEMP_DIRECTORY, resolve));
      const filePath = path.join(TEMP_DIRECTORY, 'test');

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

  describe('readJsonObjectFile', () => {
    it('uses readJsonObjectFile from @metamask/action-utils to parse the contents of the given JSON file as an object', async () => {
      const filePath = '/some/file';
      when(mockedUnderlyingReadJsonObjectFile)
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
      when(mockedUnderlyingReadJsonObjectFile)
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
      when(mockedUnderlyingWriteJsonFile)
        .calledWith(filePath, { some: 'object' })
        .mockResolvedValue(undefined);

      expect(await writeJsonFile(filePath, { some: 'object' })).toBeUndefined();
    });

    it('re-throws any error that occurs, assigning it the same code, a wrapped message, and a new stack', async () => {
      const filePath = '/some/file';
      const error: any = new Error('oops');
      error.code = 'ESOMETHING';
      error.stack = 'some stack';
      when(mockedUnderlyingWriteJsonFile)
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
      const filePath = path.join(TEMP_DIRECTORY, 'test');
      await fs.promises.writeFile(filePath, 'some content');

      expect(await fileExists(filePath)).toBe(true);
    });

    it('returns false if the given path refers to something that is not a file', async () => {
      const dirPath = path.join(TEMP_DIRECTORY, 'test');
      await fs.promises.mkdir(dirPath);

      expect(await fileExists(dirPath)).toBe(false);
    });

    it('returns false if the given path does not refer to any existing entry', async () => {
      const filePath = path.join(TEMP_DIRECTORY, 'nonexistent');

      expect(await fileExists(filePath)).toBe(false);
    });
  });
});
