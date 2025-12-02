/**
 * Changelog Validator and Updater
 *
 * This module handles validation and updating of CHANGELOG.md files
 * to ensure dependency bumps are properly documented.
 */

import path from 'path';
import type { WriteStream } from 'fs';
import { parseChangelog } from '@metamask/auto-changelog';
import { readFile, writeFile, fileExists } from './fs.js';
import { formatChangelog } from './package.js';
import type { DependencyChange, PackageChanges } from './types.js';

type ChangelogValidationResult = {
  package: string;
  hasChangelog: boolean;
  hasUnreleasedSection: boolean;
  missingEntries: DependencyChange[];
  existingEntries: string[];
};

/**
 * Formats a changelog entry for a dependency bump.
 *
 * @param change - The dependency change.
 * @param prNumber - Optional PR number (uses placeholder if not provided).
 * @param repoUrl - Repository URL for PR links.
 * @returns Formatted changelog entry.
 */
function formatChangelogEntry(
  change: DependencyChange,
  prNumber: string | undefined,
  repoUrl: string,
): string {
  const pr = prNumber || 'XXXXX';
  const prLink = `[#${pr}](${repoUrl}/pull/${pr})`;
  const prefix = change.type === 'peerDependencies' ? '**BREAKING:** ' : '';

  return `${prefix}Bump \`${change.dependency}\` from \`${change.oldVersion}\` to \`${change.newVersion}\` (${prLink})`;
}

/**
 * Reads a changelog file.
 *
 * @param changelogPath - Path to the CHANGELOG.md file.
 * @returns The changelog content, or null if file doesn't exist.
 */
async function readChangelog(changelogPath: string): Promise<string | null> {
  // Check if file exists first to avoid error handling complexity
  if (!(await fileExists(changelogPath))) {
    return null;
  }

  return await readFile(changelogPath);
}

/**
 * Checks if a changelog entry exists for a dependency change with matching versions.
 *
 * @param unreleasedChanges - The unreleased changes from the parsed changelog.
 * @param change - The dependency change to check.
 * @returns Object with match status and existing entry if found.
 */
function hasChangelogEntry(
  unreleasedChanges: Partial<Record<string, string[]>>,
  change: DependencyChange,
): { hasExactMatch: boolean; existingEntry?: string; entryIndex?: number } {
  // Check in the Changed category for dependency bumps
  const changedEntries = unreleasedChanges.Changed || [];

  const escapedDep = change.dependency.replace(/[/\\^$*+?.()|[\]{}]/gu, '\\$&');
  const escapedOldVer = change.oldVersion.replace(
    /[/\\^$*+?.()|[\]{}]/gu,
    '\\$&',
  );
  const escapedNewVer = change.newVersion.replace(
    /[/\\^$*+?.()|[\]{}]/gu,
    '\\$&',
  );

  // Look for exact version match: dependency from oldVersion to newVersion
  const exactPattern = new RegExp(
    `Bump \`${escapedDep}\` from \`${escapedOldVer}\` to \`${escapedNewVer}\``,
    'u',
  );

  const exactIndex = changedEntries.findIndex((entry) =>
    exactPattern.test(entry),
  );

  if (exactIndex !== -1) {
    return {
      hasExactMatch: true,
      existingEntry: changedEntries[exactIndex],
      entryIndex: exactIndex,
    };
  }

  // Check if there's an entry for this dependency with different versions
  // Use \x60 (backtick) to avoid template literal issues
  const anyVersionPattern = new RegExp(
    `Bump \x60${escapedDep}\x60 from \x60[^\x60]+\x60 to \x60[^\x60]+\x60`,
    'u',
  );

  const anyIndex = changedEntries.findIndex((entry) =>
    anyVersionPattern.test(entry),
  );

  if (anyIndex !== -1) {
    return {
      hasExactMatch: false,
      existingEntry: changedEntries[anyIndex],
      entryIndex: anyIndex,
    };
  }

  return { hasExactMatch: false };
}

/**
 * Validates changelog entries for dependency changes.
 *
 * @param changes - Package changes to validate.
 * @param projectRoot - Root directory of the project.
 * @param repoUrl - Repository URL for changelog links.
 * @returns Validation results for each package.
 */
export async function validateChangelogs(
  changes: PackageChanges,
  projectRoot: string,
  repoUrl: string,
): Promise<ChangelogValidationResult[]> {
  const results: ChangelogValidationResult[] = [];

  for (const [packageDirName, packageInfo] of Object.entries(changes)) {
    const packageChanges = packageInfo.dependencyChanges;
    const packageVersion = packageInfo.newVersion;
    const packagePath = path.join(projectRoot, 'packages', packageDirName);
    const changelogPath = path.join(packagePath, 'CHANGELOG.md');

    const changelogContent = await readChangelog(changelogPath);

    if (!changelogContent) {
      results.push({
        package: packageDirName,
        hasChangelog: false,
        hasUnreleasedSection: false,
        missingEntries: packageChanges,
        existingEntries: [],
      });
      continue;
    }

    try {
      // Use the actual package name from packageInfo
      const actualPackageName = packageInfo.packageName;

      // Parse the changelog using auto-changelog
      const changelog = parseChangelog({
        changelogContent,
        repoUrl,
        tagPrefix: `${actualPackageName}@`,
        formatter: formatChangelog,
      });

      // Check if package is being released (has version change)
      const changesSection = packageVersion
        ? changelog.getReleaseChanges(packageVersion)
        : changelog.getUnreleasedChanges();

      // Check if there's an Unreleased/Release section (at least one category with changes)
      const hasUnreleasedSection = Object.keys(changesSection).length > 0;

      const missingEntries: DependencyChange[] = [];
      const existingEntries: string[] = [];

      for (const change of packageChanges) {
        const entryCheck = hasChangelogEntry(changesSection, change);

        if (entryCheck.hasExactMatch) {
          existingEntries.push(change.dependency);
        } else {
          // Missing or has wrong version
          missingEntries.push(change);
        }
      }

      results.push({
        package: packageDirName,
        hasChangelog: true,
        hasUnreleasedSection,
        missingEntries,
        existingEntries,
      });
    } catch (error) {
      // If parsing fails, assume changelog is malformed
      results.push({
        package: packageDirName,
        hasChangelog: true,
        hasUnreleasedSection: false,
        missingEntries: packageChanges,
        existingEntries: [],
      });
    }
  }

  return results;
}

/**
 * Updates changelogs with missing dependency bump entries.
 *
 * @param changes - Package changes to add to changelogs.
 * @param options - Update options.
 * @param options.projectRoot - Root directory of the project.
 * @param options.prNumber - PR number to use in entries.
 * @param options.repoUrl - Repository URL for changelog links.
 * @param options.stdout - Stream for output messages.
 * @param options.stderr - Stream for error messages.
 * @returns Number of changelogs updated.
 */
export async function updateChangelogs(
  changes: PackageChanges,
  {
    projectRoot,
    prNumber,
    repoUrl,
    stdout,
    stderr,
  }: {
    projectRoot: string;
    prNumber?: string;
    repoUrl: string;
    stdout: Pick<WriteStream, 'write'>;
    stderr: Pick<WriteStream, 'write'>;
  },
): Promise<number> {
  let updatedCount = 0;

  for (const [packageDirName, packageInfo] of Object.entries(changes)) {
    const packageChanges = packageInfo.dependencyChanges;
    const packageVersion = packageInfo.newVersion;
    const packagePath = path.join(projectRoot, 'packages', packageDirName);
    const changelogPath = path.join(packagePath, 'CHANGELOG.md');

    const changelogContent = await readChangelog(changelogPath);

    if (!changelogContent) {
      stderr.write(
        `⚠️  No CHANGELOG.md found for ${packageDirName} at ${changelogPath}\n`,
      );
      continue;
    }

    try {
      // Use the actual package name from packageInfo
      const actualPackageName = packageInfo.packageName;

      // Parse the changelog using auto-changelog
      const changelog = parseChangelog({
        changelogContent,
        repoUrl,
        tagPrefix: `${actualPackageName}@`,
        formatter: formatChangelog,
      });

      // Check if package is being released (has version change)
      const changesSection = packageVersion
        ? changelog.getReleaseChanges(packageVersion)
        : changelog.getUnreleasedChanges();

      // Categorize changes: add new, update existing with wrong versions
      const entriesToAdd: DependencyChange[] = [];
      const entriesToUpdate: {
        change: DependencyChange;
        existingEntry: string;
      }[] = [];

      for (const change of packageChanges) {
        const entryCheck = hasChangelogEntry(changesSection, change);

        if (entryCheck.hasExactMatch) {
          // Entry already exists with correct versions
          continue;
        } else if (entryCheck.existingEntry) {
          // Entry exists but with wrong version - needs update
          entriesToUpdate.push({
            change,
            existingEntry: entryCheck.existingEntry,
          });
        } else {
          // No entry exists - needs to be added
          entriesToAdd.push(change);
        }
      }

      if (entriesToAdd.length === 0 && entriesToUpdate.length === 0) {
        stdout.write(`✅ ${packageDirName}: All entries already exist\n`);
        continue;
      }

      // Update existing entries by modifying the changelog content directly
      let updatedContent = changelogContent;

      for (const { change, existingEntry } of entriesToUpdate) {
        // Extract existing PR numbers from the entry
        const prMatches = existingEntry.matchAll(/\[#(\d+|XXXXX)\]/gu);
        const existingPRs = Array.from(prMatches, (m) => m[1]);

        // Add new PR number
        const newPR = prNumber || 'XXXXX';

        if (!existingPRs.includes(newPR)) {
          existingPRs.push(newPR);
        }

        // Create PR links
        const prLinks = existingPRs
          .map((pr) => `[#${pr}](${repoUrl}/pull/${pr})`)
          .join(', ');

        // Create updated entry with new "to" version and all PR numbers
        const prefix =
          change.type === 'peerDependencies' ? '**BREAKING:** ' : '';
        const updatedEntry = `${prefix}Bump \`${change.dependency}\` from \`${change.oldVersion}\` to \`${change.newVersion}\` (${prLinks})`;

        // Replace the old entry with the updated one
        updatedContent = updatedContent.replace(existingEntry, updatedEntry);
      }

      // If we updated any entries, write the content and re-parse
      if (entriesToUpdate.length > 0) {
        await writeFile(changelogPath, updatedContent);

        // Re-parse to add new entries if needed
        if (entriesToAdd.length === 0) {
          stdout.write(
            `✅ ${packageDirName}: Updated ${entriesToUpdate.length} existing ${entriesToUpdate.length === 1 ? 'entry' : 'entries'}\n`,
          );
          updatedCount += 1;
          continue;
        }

        // Re-parse the updated changelog
        const updatedChangelogContent = await readFile(changelogPath);
        const updatedChangelog = parseChangelog({
          changelogContent: updatedChangelogContent,
          repoUrl,
          tagPrefix: `${actualPackageName}@`,
          formatter: formatChangelog,
        });

        // Group new entries by type (dependencies first, then peerDependencies)
        const deps = entriesToAdd.filter((c) => c.type === 'dependencies');
        const peerDeps = entriesToAdd.filter(
          (c) => c.type === 'peerDependencies',
        );

        // addChange prepends entries, so we iterate in reverse to maintain
        // alphabetical order in the final changelog output.
        // Add dependencies first (they'll appear after BREAKING in final output)
        for (let i = deps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(deps[i], prNumber, repoUrl);
          updatedChangelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        // Then add peerDependencies (BREAKING - they'll appear first in final output)
        for (let i = peerDeps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(
            peerDeps[i],
            prNumber,
            repoUrl,
          );
          updatedChangelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        // Write the final changelog
        await writeFile(changelogPath, await updatedChangelog.toString());

        stdout.write(
          `✅ ${packageDirName}: Updated ${entriesToUpdate.length} and added ${entriesToAdd.length} changelog entries\n`,
        );
      } else {
        // Only adding new entries
        // Group entries by type (dependencies first, then peerDependencies)
        const deps = entriesToAdd.filter((c) => c.type === 'dependencies');
        const peerDeps = entriesToAdd.filter(
          (c) => c.type === 'peerDependencies',
        );

        // addChange prepends entries, so we iterate in reverse to maintain
        // alphabetical order in the final changelog output.
        // Add dependencies first (they'll appear after BREAKING in final output)
        for (let i = deps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(deps[i], prNumber, repoUrl);
          changelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        // Then add peerDependencies (BREAKING - they'll appear first in final output)
        for (let i = peerDeps.length - 1; i >= 0; i--) {
          const description = formatChangelogEntry(
            peerDeps[i],
            prNumber,
            repoUrl,
          );
          changelog.addChange({
            category: 'Changed' as any,
            description,
            ...(packageVersion && { version: packageVersion }),
          });
        }

        // Write the updated changelog
        const updatedChangelogContent = await changelog.toString();
        await writeFile(changelogPath, updatedChangelogContent);

        stdout.write(
          `✅ ${packageDirName}: Added ${entriesToAdd.length} changelog ${entriesToAdd.length === 1 ? 'entry' : 'entries'}\n`,
        );
      }

      updatedCount += 1;
    } catch (error) {
      stderr.write(
        `⚠️  Error updating CHANGELOG.md for ${packageDirName}: ${error}\n`,
      );
    }
  }

  return updatedCount;
}
