# Skip Changelog Auto-Update — Design

**Date:** 2026-06-01
**Status:** Approved (pending implementation plan)

## Problem

On the first run against a new release branch, `create-release-branch` auto-populates each changed package's `## Unreleased` section by reading commits since the last release tag (via `@metamask/auto-changelog`'s `updateChangelog`). It then commits the result as `Initialize Release X.Y.Z`.

Some MetaMask repos already maintain their changelogs on the go — contributors add entries under `## Unreleased` as part of every PR. For those repos the auto-pull step is at best redundant (it produces noise that needs to be cleaned up by hand) and at worst harmful (it duplicates or overwrites entries that were already carefully written).

## Goal

Add an opt-in flag that disables both the auto-pull and the accompanying `Initialize Release` commit, so repos that maintain changelogs on the go can use the tool without that step running at all.

## Non-goals

- No change to existing default behavior. Repos that don't pass the flag get exactly what they get today.
- No config-file/`package.json`-based opt-in (deferred — out of scope here).
- No change to `restoreChangelogsForSkippedPackages`, `migrateUnreleasedChangelogChangesToRelease`, the `Update Release X.Y.Z` commit, lockfile updates, or any other release-plan execution step.

## Design

### CLI surface

A new boolean flag on `command-line-arguments.ts`:

```
--skip-changelog-update
  Skip auto-populating the "Unreleased" section of each package's changelog
  from git commits since the last release. Use this in repos that maintain
  changelogs on the go (so commits are already documented as PRs land).
  When set, no "Initialize Release X.Y.Z" commit is created either.
```

- Default: `false` (preserves current behavior).
- Type: `boolean`.
- No alias.

### Parameter plumbing

The flag travels through the existing chain:

1. `src/command-line-arguments.ts`
   - Add `skipChangelogUpdate: boolean` to `CommandLineArguments`.
   - Register the option with `yargs`.

2. `src/initial-parameters.ts`
   - Add `skipChangelogUpdate: boolean` to `InitialParameters`.
   - Propagate `args.skipChangelogUpdate` in `determineInitialParameters`.

3. `src/main.ts`
   - Destructure `skipChangelogUpdate` and forward to both `followMonorepoWorkflow` and `startUI`.

4. `src/monorepo-workflow-operations.ts` and `src/ui.ts`
   - Accept `skipChangelogUpdate: boolean` in the function signature.
   - Apply the behavior change below.

### Behavior change

Identical edit at both call sites:

`src/monorepo-workflow-operations.ts` lines 88-94 and `src/ui.ts` lines 71-77 currently read:

```ts
if (firstRun) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

They become:

```ts
if (firstRun && !skipChangelogUpdate) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

That is the entire functional change. Everything downstream is untouched.

### Why the gate covers both the update AND the commit

`commitAllChanges` runs `git add -A && git commit -m <msg>`. If we skip the auto-population but try to commit, `git commit` exits non-zero (nothing to commit) and the tool crashes. Gating the whole block is required, not optional. An empty `Initialize Release` commit (via `--allow-empty`) was considered and rejected: no downstream automation in this repo or the surrounding release tooling reads the message, and an empty commit adds nothing meaningful to the PR diff.

### What is intentionally NOT changed

- **`restoreChangelogsForSkippedPackages`** still runs. It restores skipped packages' changelogs from the default branch — but only for files that have changes since the latest release AND aren't in the release spec AND already exist on disk. When auto-population was skipped, there's nothing in the working tree to undo, so this call is a safe no-op.
- **`migrateUnreleasedChangelogChangesToRelease`** (invoked via `executeReleasePlan`) still runs. This is what moves a package's manually-maintained `## Unreleased` entries into the new version section — exactly what on-the-go-changelog repos depend on.
- **`Update Release X.Y.Z`** commit (line 161 in `monorepo-workflow-operations.ts`; lines 343-346 in `ui.ts`) still runs. It carries version bumps, lockfile updates, and the migrated changelog entries.

### Scope: both CLI and interactive UI

The same block exists in both `monorepo-workflow-operations.ts` (non-interactive) and `ui.ts` (interactive web UI). The flag gates both, so the behavior is consistent regardless of which mode the user invokes.

## Testing

### Unit / integration tests

- **`src/initial-parameters.test.ts`** — assert `skipChangelogUpdate` is `false` by default and `true` when the flag is passed; assert it appears in the returned `InitialParameters`.
- **`src/monorepo-workflow-operations.test.ts`** — add a test case to the first-run scenarios. Pattern: mirror an existing "first run calls `updateChangelogsForChangedPackages` and commits `Initialize Release X.Y.Z`" test, but pass `skipChangelogUpdate: true` and assert:
  - `updateChangelogsForChangedPackages` is NOT called.
  - `commitAllChanges` is NOT called with `Initialize Release X.Y.Z`.
  - `commitAllChanges` IS still called with `Update Release X.Y.Z` at the end.
- **`src/ui.ts`** equivalent — if existing UI tests cover the first-run block (verify in implementation), add the parallel `skipChangelogUpdate: true` case. Otherwise add coverage for the existing block first to keep parity between the two workflows.

### End-to-end test

- **`src/functional.test.ts`** — one scenario invoking the tool with `--skip-changelog-update`. Assert:
  - The release branch contains a single new commit (`Update Release X.Y.Z`), not two.
  - Each package's `CHANGELOG.md` was untouched by auto-population (i.e., the `## Unreleased` section matches what was on disk before the run, modulo the migration to the new version section that `executeReleasePlan` performs).

### Documentation

- **`README.md`** — mention the new flag in the usage section.
- **`docs/usage.md`** (and `docs/usage-monorepo-independent.md` if it documents flags) — describe the flag and the use case ("maintain changelog on the go").
- **`docs/changelog.md`** — if it documents the auto-population step, add a note about the opt-out.

## Risks & considerations

- **Existing repos**: no behavior change unless they pass the flag. Zero migration cost.
- **Help text discoverability**: contributors in changelog-on-the-go repos need to know the flag exists. Documenting it in `README.md` + repo-level invocation scripts is sufficient; we don't need any in-tool warning or auto-detection.
- **Interaction with `--reset`**: independent. `--reset` removes a cached release spec; `--skip-changelog-update` controls a different step. They compose naturally.
- **Interaction with `--backport`**: independent. Backport releases go through the same `firstRun` block.

## Out of scope (future work)

- Reading the setting from `package.json` or a project config file. Worth considering once we know how many repos adopt the flag — if most invocations of `create-release-branch` in a repo carry it, a config field saves repetition. Not needed now.
- Auto-detecting "changelog maintained on the go" (e.g., heuristic on commit messages). Too magical; explicit opt-in is clearer.
