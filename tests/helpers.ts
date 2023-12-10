import fs from 'fs';
import os from 'os';
import path from 'path';
import { nanoid } from 'nanoid';
import type { ExecaError } from 'execa';
import { hasProperty, isObject } from '@metamask/utils';

/**
 * Information about the sandbox provided to tests that need access to the
 * filesystem.
 */
export type Sandbox = {
  directoryPath: string;
};

/**
 * The temporary directory that acts as a filesystem sandbox for tests.
 */
const TEMP_DIRECTORY_PATH = path.join(
  os.tmpdir(),
  'create-release-branch-tests',
);

/**
 * Each test gets its own randomly generated directory in a temporary directory
 * where it can perform filesystem operations. There is a miniscule chance
 * that more than one test will receive the same name for its directory. If this
 * happens, then all bets are off, and we should stop running tests, because
 * the state that we expect to be isolated to a single test has now bled into
 * another test.
 *
 * @param entryPath - The path to the directory.
 * @throws If the directory already exists (or a file exists in its place).
 */
async function ensureFileEntryDoesNotExist(entryPath: string): Promise<void> {
  try {
    await fs.promises.access(entryPath);
    throw new Error(`${entryPath} already exists, cannot continue`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Creates a temporary directory to hold files that a test could write to, runs
 * the given function, then ensures that the directory is removed afterward.
 *
 * @param fn - The function to call.
 * @throws If the temporary directory already exists for some reason. This would
 * indicate a bug in how the names of the directory is determined.
 */
export async function withSandbox(fn: (sandbox: Sandbox) => any) {
  const directoryPath = path.join(TEMP_DIRECTORY_PATH, nanoid());
  await ensureFileEntryDoesNotExist(directoryPath);
  await fs.promises.mkdir(directoryPath, { recursive: true });

  try {
    await fn({ directoryPath });
  } finally {
    await fs.promises.rm(directoryPath, { force: true, recursive: true });
  }
}

/**
 * Type guard for determining whether the given value is an error object with a
 * `code` property such as the type of error that Node throws for filesystem
 * operations, etc.
 *
 * @param error - The object to check.
 * @returns True or false, depending on the result.
 */
export function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

/**
 * Type guard for determining whether the given value is an error object
 * produced by `execa`.
 *
 * @param error - The possible error object.
 * @returns True or false, depending on the result.
 */
export function isExecaError(error: unknown): error is ExecaError {
  return (
    isObject(error) &&
    hasProperty(error, 'message') &&
    hasProperty(error, 'shortMessage') &&
    hasProperty(error, 'isCanceled') &&
    hasProperty(error, 'exitCode')
  );
}

/**
 * Given a string, resets its indentation and removes leading and trailing
 * whitespace (except for a trailing newline).
 *
 * @param string - The string.
 * @returns The normalized string.
 */
export function normalizeMultilineString(string: string): string {
  const lines = string
    .replace(/^[\n\r]+/u, '')
    .replace(/[\n\r]+$/u, '')
    .split('\n');
  const indentation = lines[0].match(/^([ ]+)/u)?.[1] ?? '';
  const normalizedString = lines
    .map((line) => {
      return line.replace(new RegExp(`^${indentation}`, 'u'), '');
    })
    .join('\n')
    .trim();
  return `${normalizedString}\n`;
}

/**
 * Builds a changelog by filling in the first part automatically, which never
 * changes.
 *
 * @param variantContent - The part of the changelog that can change depending
 * on what is expected or what sort of changes have been made to the repo so
 * far.
 * @returns The full changelog.
 */
export function buildChangelog(variantContent: string): string {
  const invariantContent = normalizeMultilineString(`
    # Changelog

    All notable changes to this project will be documented in this file.

    The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
    and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
  `);

  return `${invariantContent}\n${normalizeMultilineString(variantContent)}`;
}
