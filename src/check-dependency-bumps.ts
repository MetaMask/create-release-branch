/**
 * Dependency Bump Checker Script
 *
 * This script analyzes git diffs to find dependency version changes in package.json files.
 * It focuses on dependencies and peerDependencies, excluding devDependencies.
 *
 */

import type { WriteStream } from 'fs';
import path from 'path';
import { validateChangelogs, updateChangelogs } from './changelog-validator.js';
import { getCurrentBranchName } from './repo.js';
import { getStdoutFromCommand } from './misc-utils.js';
import { getValidRepositoryUrl } from './project.js';
import { readPackageManifest } from './package-manifest.js';
import type { DependencyChange, PackageInfo, PackageChanges } from './types.js';

// Re-export types for convenience
export type { DependencyChange, PackageInfo, PackageChanges };

/**
 * Retrieves the git diff between two references for package.json files.
 *
 * @param fromRef - The starting git reference (commit, branch, or tag).
 * @param toRef - The ending git reference (commit, branch, or tag).
 * @param projectRoot - The project root directory.
 * @returns The raw git diff output.
 */
async function getGitDiff(
  fromRef: string,
  toRef: string,
  projectRoot: string,
): Promise<string> {
  try {
    return await getStdoutFromCommand(
      'git',
      [
        'diff',
        '-U9999', // Show maximum context to ensure section headers are visible
        fromRef,
        toRef,
        '--',
        '**/package.json',
      ],
      { cwd: projectRoot },
    );
  } catch (error: any) {
    // Git diff returns exit code 1 when there are no changes
    if (error.exitCode === 1 && error.stdout === '') {
      return '';
    }

    throw error;
  }
}

/**
 * Parses git diff output to extract dependency version changes and package version changes.
 *
 * @param diff - Raw git diff output.
 * @returns Object mapping package names to their changes and version info.
 */
function parseDiff(diff: string): PackageChanges {
  const lines = diff.split('\n');
  const changes: PackageChanges = {};

  let currentFile = '';
  let currentSection: 'dependencies' | 'peerDependencies' | null = null;
  const removedDeps = new Map<
    string,
    { version: string; section: 'dependencies' | 'peerDependencies' }
  >();
  const processedChanges = new Set<string>();
  const packageVersionsMap = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current file
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)/u);

      if (match) {
        currentFile = match[1];
      }
    }

    // Detect package version changes (for release detection)
    if (line.startsWith('+') && line.includes('"version":')) {
      const versionMatch = line.match(/^\+\s*"version":\s*"([^"]+)"/u);

      if (versionMatch) {
        const newVersion = versionMatch[1];
        const packageMatch = currentFile.match(/packages\/([^/]+)\//u);

        if (packageMatch) {
          const packageName = packageMatch[1];
          packageVersionsMap.set(packageName, newVersion);
        }
      }
    }

    // Detect dependency sections (excluding devDependencies)
    if (line.includes('"peerDependencies"')) {
      currentSection = 'peerDependencies';
    } else if (line.includes('"dependencies"')) {
      currentSection = 'dependencies';
    } else if (line.includes('"devDependencies"')) {
      // Skip devDependencies section
      currentSection = null;
    }

    // Check if we're leaving a section
    if ((currentSection && line.trim() === '},') || line.trim() === '}') {
      // Check if next line is another section or end of sections
      const nextLine = lines[i + 1];

      if (nextLine && !nextLine.includes('Dependencies"')) {
        currentSection = null;
      }
    }

    // Parse removed dependencies
    if (line.startsWith('-') && currentSection && line.includes('"@')) {
      const match = line.match(/^-\s*"([^"]+)":\s*"([^"]+)"/u);

      if (match && currentSection) {
        const [, dep, version] = match;
        const key = `${currentFile}:${currentSection}:${dep}`;
        removedDeps.set(key, {
          version,
          section: currentSection,
        });
      }
    }

    // Parse added dependencies and match with removed
    if (line.startsWith('+') && currentSection && line.includes('"@')) {
      const match = line.match(/^\+\s*"([^"]+)":\s*"([^"]+)"/u);

      if (match) {
        const [, dep, newVersion] = match;
        // Look for removed dependency in same section
        const key = `${currentFile}:${currentSection}:${dep}`;
        const removed = removedDeps.get(key);

        if (removed && removed.version !== newVersion) {
          // Extract package name from path
          const packageMatch = currentFile.match(/packages\/([^/]+)\//u);

          if (packageMatch) {
            const packageName = packageMatch[1];

            // Create unique change identifier
            const changeId = `${packageName}:${currentSection}:${dep}:${newVersion}`;

            // Skip if we've already processed this exact change
            if (!processedChanges.has(changeId)) {
              processedChanges.add(changeId);

              if (!changes[packageName]) {
                const pkgInfo: PackageInfo = {
                  dependencyChanges: [],
                };
                const packageNewVersion = packageVersionsMap.get(packageName);

                if (packageNewVersion) {
                  pkgInfo.newVersion = packageNewVersion;
                }

                changes[packageName] = pkgInfo;
              }

              // Check if we already have this dependency for this package and section
              const sectionType = currentSection;
              const existingChange = changes[
                packageName
              ].dependencyChanges.find(
                (c) => c.dependency === dep && c.type === sectionType,
              );

              if (!existingChange) {
                changes[packageName].dependencyChanges.push({
                  package: packageName,
                  dependency: dep,
                  type: sectionType,
                  oldVersion: removed.version,
                  newVersion,
                });
              }
            }
          }
        }
      }
    }
  }

  return changes;
}

/**
 * Reads package names from package.json files for all packages with changes.
 *
 * @param changes - Package changes with version info keyed by directory name.
 * @param projectRoot - The project root directory.
 * @returns Map of directory names to actual package names.
 * @throws If a package.json cannot be read or is invalid.
 */
async function getPackageNames(
  changes: PackageChanges,
  projectRoot: string,
): Promise<Record<string, string>> {
  const packageNames: Record<string, string> = {};

  for (const packageDirName of Object.keys(changes)) {
    const manifestPath = path.join(
      projectRoot,
      'packages',
      packageDirName,
      'package.json',
    );

    // We detected changes in this package.json via git diff,
    // so it must exist and be readable. If it's not, something is wrong.
    const { validated: packageManifest } =
      await readPackageManifest(manifestPath);
    packageNames[packageDirName] = packageManifest.name;
  }

  return packageNames;
}

/**
 * Gets the merge base between current branch and the default branch.
 *
 * @param defaultBranch - The default branch to compare against.
 * @param projectRoot - The project root directory.
 * @returns The merge base commit SHA.
 */
async function getMergeBase(
  defaultBranch: string,
  projectRoot: string,
): Promise<string> {
  try {
    return await getStdoutFromCommand(
      'git',
      ['merge-base', 'HEAD', defaultBranch],
      { cwd: projectRoot },
    );
  } catch {
    // If local branch doesn't exist, try remote
    try {
      return await getStdoutFromCommand(
        'git',
        ['merge-base', 'HEAD', `origin/${defaultBranch}`],
        { cwd: projectRoot },
      );
    } catch {
      throw new Error(
        `Could not find merge base with ${defaultBranch} or origin/${defaultBranch}`,
      );
    }
  }
}

/**
 * Main entry point for the dependency bump checker.
 *
 * Automatically validates changelog entries for all dependency bumps.
 * Use the --fix option to automatically update changelogs.
 *
 * @param options - Configuration options.
 * @param options.fromRef - The starting git reference (optional).
 * @param options.toRef - The ending git reference (defaults to HEAD).
 * @param options.defaultBranch - The default branch to compare against (defaults to main).
 * @param options.fix - Whether to fix missing changelog entries.
 * @param options.prNumber - PR number to use in changelog entries.
 * @param options.projectRoot - Root directory of the project.
 * @param options.stdout - A stream that can be used to write to standard out.
 * @param options.stderr - A stream that can be used to write to standard error.
 * @returns Object mapping package names to their changes and version info.
 */
export async function checkDependencyBumps({
  fromRef,
  toRef = 'HEAD',
  defaultBranch = 'main',
  fix = false,
  prNumber,
  projectRoot,
  stdout,
  stderr,
}: {
  fromRef?: string;
  toRef?: string;
  defaultBranch?: string;
  fix?: boolean;
  prNumber?: string;
  projectRoot: string;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}): Promise<PackageChanges> {
  let actualFromRef = fromRef || '';

  // Auto-detect branch changes if fromRef not provided
  if (!actualFromRef) {
    const currentBranch = await getCurrentBranchName(projectRoot);
    stdout.write(`\n📌 Current branch: ${currentBranch}\n`);

    // Skip if we're on main/master
    if (currentBranch === 'main' || currentBranch === 'master') {
      stdout.write(
        '⚠️  You are on the main/master branch. Please specify commits to compare or switch to a feature branch.\n',
      );
      return {};
    }

    // Find merge base with default branch
    try {
      actualFromRef = await getMergeBase(defaultBranch, projectRoot);
      stdout.write(
        `📍 Comparing against merge base with ${defaultBranch}: ${actualFromRef.substring(0, 8)}...\n`,
      );
    } catch {
      stderr.write(
        `❌ Could not find merge base with ${defaultBranch}. Please specify commits manually using --from, or use --default-branch to specify a different branch.\n`,
      );
      return {};
    }
  }

  stdout.write(
    `\n🔍 Checking dependency changes from ${actualFromRef.substring(0, 8)} to ${toRef}...\n\n`,
  );

  const diff = await getGitDiff(actualFromRef, toRef, projectRoot);

  if (!diff) {
    stdout.write('No package.json changes found.\n');
    return {};
  }

  const changes = parseDiff(diff);

  if (Object.keys(changes).length === 0) {
    stdout.write('No dependency version bumps found.\n');
    return {};
  }

  stdout.write('\n\n📊 JSON Output:\n');
  stdout.write('==============\n');
  stdout.write(JSON.stringify(changes, null, 2));
  stdout.write('\n');

  // Get repository URL and package names for validation/fixing
  const manifestPath = path.join(projectRoot, 'package.json');
  const { unvalidated: packageManifest } =
    await readPackageManifest(manifestPath);
  const repoUrl = await getValidRepositoryUrl(packageManifest, projectRoot);

  // Read package names once for all packages with changes
  const packageNames = await getPackageNames(changes, projectRoot);

  // Always validate to provide feedback
  stdout.write('\n\n🔍 Validating changelogs...\n');
  stdout.write('==========================\n');

  const validationResults = await validateChangelogs(
    changes,
    projectRoot,
    repoUrl,
    packageNames,
  );

  let hasErrors = false;

  for (const result of validationResults) {
    if (!result.hasChangelog) {
      stderr.write(`❌ ${result.package}: CHANGELOG.md not found\n`);
      hasErrors = true;
    } else if (!result.hasUnreleasedSection) {
      stderr.write(`❌ ${result.package}: No [Unreleased] section found\n`);
      hasErrors = true;
    } else if (result.missingEntries.length > 0) {
      stderr.write(
        `❌ ${result.package}: Missing ${result.missingEntries.length} changelog ${result.missingEntries.length === 1 ? 'entry' : 'entries'}:\n`,
      );

      for (const entry of result.missingEntries) {
        stderr.write(`   - ${entry.dependency}\n`);
      }

      hasErrors = true;
    } else {
      stdout.write(`✅ ${result.package}: All entries present\n`);
    }
  }

  if (hasErrors && !fix) {
    stderr.write('\n💡 Run with --fix to automatically update changelogs\n');
  }

  // Fix changelogs if requested
  if (fix) {
    stdout.write('\n\n🔧 Updating changelogs...\n');
    stdout.write('========================\n');

    const updateOptions: {
      projectRoot: string;
      prNumber?: string;
      repoUrl: string;
      packageNames: Record<string, string>;
      stdout: Pick<WriteStream, 'write'>;
      stderr: Pick<WriteStream, 'write'>;
    } = {
      projectRoot,
      repoUrl,
      packageNames,
      stdout,
      stderr,
    };

    if (prNumber !== undefined) {
      updateOptions.prNumber = prNumber;
    }

    const updatedCount = await updateChangelogs(changes, updateOptions);

    if (updatedCount > 0) {
      stdout.write(
        `\n✅ Updated ${updatedCount} changelog${updatedCount === 1 ? '' : 's'}\n`,
      );

      if (!prNumber) {
        stdout.write(
          '\n💡 Note: Placeholder PR numbers (XXXXX) were used. Update them manually or run with --pr <number>\n',
        );
      }
    } else {
      stdout.write('\n✅ All changelogs are up to date\n');
    }
  }

  return changes;
}
