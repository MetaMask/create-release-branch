import createDebug from 'debug';

export const debug = createDebug('create-release-branch:tests');

/**
 * `Object.keys()` is intentionally generic: it returns the keys of an object,
 * but it cannot make guarantees about the contents of that object, so the type
 * of the keys is merely `string[]`. While this is technically accurate, it is
 * also unnecessary if we have an object that we own and whose contents are
 * known exactly.
 *
 * Note: This function will not work when given an object where any of the keys
 * are optional.
 *
 * @param object - The object.
 * @returns The keys of an object, typed according to the type of the object
 * itself.
 */
export function knownKeysOf<K extends string | number | symbol>(
  object: Record<K, any>,
) {
  return Object.keys(object) as K[];
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
 * Pauses execution for some time.
 *
 * @param duration - The number of milliseconds to pause.
 */
export async function sleepFor(duration: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, duration));
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
