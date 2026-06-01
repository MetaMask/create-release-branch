# `--skip-changelog-update` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--skip-changelog-update` CLI flag that, when set, prevents the tool from auto-populating each package's `## Unreleased` changelog section from git commits and skips the accompanying `Initialize Release X.Y.Z` commit. Default behavior is unchanged.

**Architecture:** Thread a new boolean (`skipChangelogUpdate`) through the existing parameter chain — `command-line-arguments.ts` → `initial-parameters.ts` → `main.ts` → `followMonorepoWorkflow` / `startUI`. At each of the two workflow entry points, gate the existing `if (firstRun) { updateChangelogsForChangedPackages(...); commitAllChanges(...) }` block on `!skipChangelogUpdate`. Spec: `docs/superpowers/specs/2026-06-01-skip-changelog-update-design.md`.

**Tech Stack:** TypeScript (ESM), `yargs` for arg parsing, `jest` + `jest-when` for tests, `@metamask/auto-changelog` for the auto-populated changelog content (unaffected — we just gate the call site).

---

## File Structure

**Modified files:**

- `src/command-line-arguments.ts` — add `skipChangelogUpdate` to the `CommandLineArguments` type and to the yargs option list.
- `src/initial-parameters.ts` — add `skipChangelogUpdate` to `InitialParameters` and propagate it from parsed CLI args.
- `src/initial-parameters.test.ts` — update existing test mocks to include the new field; add a default-value test and a flag-on test.
- `src/main.ts` — destructure `skipChangelogUpdate` and forward to both `followMonorepoWorkflow` and `startUI`.
- `src/monorepo-workflow-operations.ts` — accept `skipChangelogUpdate` parameter; gate the first-run block.
- `src/monorepo-workflow-operations.test.ts` — update `setupFollowMonorepoWorkflow` helper to accept and forward `skipChangelogUpdate`; add new test covering the gated path.
- `src/ui.ts` — accept `skipChangelogUpdate` parameter; gate the first-run block.
- `src/functional.test.ts` — add one end-to-end test invoking the tool with `--skip-changelog-update`.
- `README.md` — document the new flag.
- `docs/usage.md` — document the new flag and its use case.

**No new files.**

---

## Task 1: Add `skipChangelogUpdate` to CLI argument parser

**Files:**

- Modify: `src/command-line-arguments.ts`

- [ ] **Step 1: Add the field to the `CommandLineArguments` type**

Open `src/command-line-arguments.ts`. Replace the existing type:

```ts
export type CommandLineArguments = {
  projectDirectory: string;
  tempDirectory: string | undefined;
  reset: boolean;
  backport: boolean;
  defaultBranch: string;
  interactive: boolean;
  port: number;
  formatter: string;
};
```

with:

```ts
export type CommandLineArguments = {
  projectDirectory: string;
  tempDirectory: string | undefined;
  reset: boolean;
  backport: boolean;
  defaultBranch: string;
  interactive: boolean;
  port: number;
  formatter: string;
  skipChangelogUpdate: boolean;
};
```

- [ ] **Step 2: Register the yargs option**

In the same file, inside the `readCommandLineArguments` chain, immediately after the existing `.option('formatter', { ... })` block and before `.help()`, insert:

```ts
    .option('skip-changelog-update', {
      describe:
        'Skip auto-populating the "Unreleased" section of each package\'s changelog from git commits since the last release. Use this in repos that maintain changelogs on the go. When set, the "Initialize Release" commit is also skipped.',
      type: 'boolean',
      default: false,
    })
```

Yargs camelCases option names automatically, so `--skip-changelog-update` becomes the `skipChangelogUpdate` field on the returned object.

- [ ] **Step 3: Verify the file type-checks**

Run: `yarn build` (or `yarn tsc --noEmit` if a typecheck-only script exists — check `package.json` if unsure).
Expected: succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/command-line-arguments.ts
git commit -m "feat: parse --skip-changelog-update CLI flag"
```

---

## Task 2: Propagate flag through `initial-parameters.ts`

**Files:**

- Modify: `src/initial-parameters.ts`
- Test: `src/initial-parameters.test.ts`

- [ ] **Step 1: Update existing tests' mock return values to include the new field**

In `src/initial-parameters.test.ts`, every call to `mockResolvedValue` on `readCommandLineArguments` currently returns an object without `skipChangelogUpdate`. Each one will fail type-checking once Task 1 ships (because the type now requires the field). Add `skipChangelogUpdate: false` to every such object. There are seven occurrences in the file (lines roughly 33-42, 75-84, 106-117, 139-150, 172-183, 203-214, 234-245, 265-276 — search for `readCommandLineArguments` to find all of them).

Example: change

```ts
.mockResolvedValue({
  projectDirectory: '/path/to/project',
  tempDirectory: '/path/to/temp',
  reset: true,
  backport: false,
  defaultBranch: 'main',
  interactive: false,
  port: 3000,
  formatter: 'prettier',
});
```

to

```ts
.mockResolvedValue({
  projectDirectory: '/path/to/project',
  tempDirectory: '/path/to/temp',
  reset: true,
  backport: false,
  defaultBranch: 'main',
  interactive: false,
  port: 3000,
  formatter: 'prettier',
  skipChangelogUpdate: false,
});
```

Apply to all seven occurrences. Also update the existing assertion on the full returned object (around line 56-65):

```ts
expect(initialParameters).toStrictEqual({
  project,
  tempDirectoryPath: '/path/to/temp',
  reset: true,
  releaseType: 'ordinary',
  defaultBranch: 'main',
  interactive: false,
  port: 3000,
  formatter: 'prettier',
});
```

becomes:

```ts
expect(initialParameters).toStrictEqual({
  project,
  tempDirectoryPath: '/path/to/temp',
  reset: true,
  releaseType: 'ordinary',
  defaultBranch: 'main',
  interactive: false,
  port: 3000,
  formatter: 'prettier',
  skipChangelogUpdate: false,
});
```

- [ ] **Step 2: Add new failing tests for the flag default and propagation**

At the end of the `describe('determineInitialParameters', ...)` block in `src/initial-parameters.test.ts` (just before the two closing `});` on lines 292-293), append:

```ts
it('returns initial parameters including skipChangelogUpdate: false by default', async () => {
  const project = buildMockProject();
  const stderr = createNoopWriteStream();
  when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
    .calledWith(['arg1', 'arg2'])
    .mockResolvedValue({
      projectDirectory: '/path/to/project',
      tempDirectory: '/path/to/temp',
      reset: false,
      backport: false,
      defaultBranch: 'main',
      interactive: false,
      port: 3000,
      formatter: 'prettier',
      skipChangelogUpdate: false,
    });
  jest
    .spyOn(envModule, 'getEnvironmentVariables')
    .mockReturnValue({ EDITOR: undefined });
  when(jest.spyOn(projectModule, 'readProject'))
    .calledWith('/path/to/project', { stderr })
    .mockResolvedValue(project);

  const initialParameters = await determineInitialParameters({
    argv: ['arg1', 'arg2'],
    cwd: '/path/to/somewhere',
    stderr,
  });

  expect(initialParameters.skipChangelogUpdate).toBe(false);
});

it('returns initial parameters including skipChangelogUpdate: true, derived from a command-line argument of "--skip-changelog-update true"', async () => {
  const project = buildMockProject();
  const stderr = createNoopWriteStream();
  when(jest.spyOn(commandLineArgumentsModule, 'readCommandLineArguments'))
    .calledWith(['arg1', 'arg2'])
    .mockResolvedValue({
      projectDirectory: '/path/to/project',
      tempDirectory: '/path/to/temp',
      reset: false,
      backport: false,
      defaultBranch: 'main',
      interactive: false,
      port: 3000,
      formatter: 'prettier',
      skipChangelogUpdate: true,
    });
  jest
    .spyOn(envModule, 'getEnvironmentVariables')
    .mockReturnValue({ EDITOR: undefined });
  when(jest.spyOn(projectModule, 'readProject'))
    .calledWith('/path/to/project', { stderr })
    .mockResolvedValue(project);

  const initialParameters = await determineInitialParameters({
    argv: ['arg1', 'arg2'],
    cwd: '/path/to/somewhere',
    stderr,
  });

  expect(initialParameters.skipChangelogUpdate).toBe(true);
});
```

- [ ] **Step 3: Run the new tests; they should fail**

Run: `yarn jest src/initial-parameters.test.ts -t "skipChangelogUpdate"`
Expected: both new tests fail (the field doesn't exist on `InitialParameters` yet, or returns `undefined`).

- [ ] **Step 4: Add `skipChangelogUpdate` to `InitialParameters` and propagate it**

In `src/initial-parameters.ts`, change the `InitialParameters` type:

```ts
type InitialParameters = {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  interactive: boolean;
  port: number;
  formatter: Formatter;
};
```

to:

```ts
type InitialParameters = {
  project: Project;
  tempDirectoryPath: string;
  reset: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  interactive: boolean;
  port: number;
  formatter: Formatter;
  skipChangelogUpdate: boolean;
};
```

Then update the `return` statement at the end of `determineInitialParameters`:

```ts
return {
  project,
  tempDirectoryPath,
  reset: args.reset,
  defaultBranch: args.defaultBranch,
  releaseType: args.backport ? 'backport' : 'ordinary',
  interactive: args.interactive,
  port: args.port,
  formatter: args.formatter as Formatter,
};
```

becomes:

```ts
return {
  project,
  tempDirectoryPath,
  reset: args.reset,
  defaultBranch: args.defaultBranch,
  releaseType: args.backport ? 'backport' : 'ordinary',
  interactive: args.interactive,
  port: args.port,
  formatter: args.formatter as Formatter,
  skipChangelogUpdate: args.skipChangelogUpdate,
};
```

- [ ] **Step 5: Run all initial-parameters tests; they should pass**

Run: `yarn jest src/initial-parameters.test.ts`
Expected: all tests pass (including the two new ones and the original seven, now with updated mocks).

- [ ] **Step 6: Commit**

```bash
git add src/initial-parameters.ts src/initial-parameters.test.ts
git commit -m "feat: propagate skipChangelogUpdate through initial parameters"
```

---

## Task 3: Gate the first-run block in the non-interactive workflow

**Files:**

- Modify: `src/monorepo-workflow-operations.ts`
- Test: `src/monorepo-workflow-operations.test.ts`

- [ ] **Step 1: Add a failing test asserting the gate works when `skipChangelogUpdate: true`**

Note on test helpers: `setupFollowMonorepoWorkflow` (around line 166) does NOT need to be modified. It only mocks dependencies; it does not invoke `followMonorepoWorkflow` itself. Tests construct that call directly, so each test that needs the new flag will pass it explicitly.

In `src/monorepo-workflow-operations.test.ts`, locate the test `'follows the workflow correctly when executed twice'` (around line 424). Immediately after that test (right after its closing `});` around line 523), insert a new test:

```ts
it('skips the auto-populated changelog update and the Initialize Release commit when skipChangelogUpdate is true', async () => {
  await withSandbox(async (sandbox) => {
    const releaseVersion = '1.1.0';
    const {
      project,
      stdout,
      stderr,
      createReleaseBranchSpy,
      commitAllChangesSpy,
      projectDirectoryPath,
      formatter,
    } = await setupFollowMonorepoWorkflow({
      sandbox,
      releaseVersion,
      doesReleaseSpecFileExist: false,
      isEditorAvailable: true,
    });

    createReleaseBranchSpy.mockResolvedValueOnce({
      version: releaseVersion,
      firstRun: true,
    });

    await followMonorepoWorkflow({
      project,
      tempDirectoryPath: sandbox.directoryPath,
      firstRemovingExistingReleaseSpecification: false,
      releaseType: 'ordinary',
      defaultBranch: 'main',
      formatter,
      skipChangelogUpdate: true,
      stdout,
      stderr,
    });

    expect(commitAllChangesSpy).not.toHaveBeenCalledWith(
      projectDirectoryPath,
      `Initialize Release ${releaseVersion}`,
    );
    expect(commitAllChangesSpy).toHaveBeenCalledWith(
      projectDirectoryPath,
      `Update Release ${releaseVersion}`,
    );
    expect(commitAllChangesSpy).toHaveBeenCalledTimes(1);
  });
});
```

Note: this test fails type-checking first because `followMonorepoWorkflow` doesn't accept `skipChangelogUpdate` yet. That's expected — TDD red.

- [ ] **Step 2: Run the new test; verify it fails (likely as a type/compile error or runtime assertion failure)**

Run: `yarn jest src/monorepo-workflow-operations.test.ts -t "skipChangelogUpdate"`
Expected: fails — either with a TypeScript error about `skipChangelogUpdate` not being assignable, or (if TS errors are non-fatal in jest config) with the assertion that `commitAllChangesSpy` WAS called with `Initialize Release 1.1.0` despite the new flag.

- [ ] **Step 3: Update `followMonorepoWorkflow` to accept and act on `skipChangelogUpdate`**

In `src/monorepo-workflow-operations.ts`, update the function signature. Change:

```ts
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification,
  releaseType,
  defaultBranch,
  formatter,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  firstRemovingExistingReleaseSpecification: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  formatter: Formatter;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
```

to:

```ts
export async function followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification,
  releaseType,
  defaultBranch,
  formatter,
  skipChangelogUpdate,
  stdout,
  stderr,
}: {
  project: Project;
  tempDirectoryPath: string;
  firstRemovingExistingReleaseSpecification: boolean;
  releaseType: ReleaseType;
  defaultBranch: string;
  formatter: Formatter;
  skipChangelogUpdate: boolean;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
}) {
```

Also add a `@param args.skipChangelogUpdate` line to the JSDoc above the function (just before `@param args.stdout`):

```
 * @param args.skipChangelogUpdate - When true, skips auto-populating the
 * Unreleased section of each package's changelog from git commits since the
 * last release, and skips the accompanying "Initialize Release" commit.
```

Then change the first-run block:

```ts
if (firstRun) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

to:

```ts
if (firstRun && !skipChangelogUpdate) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

- [ ] **Step 4: Update existing tests that call `followMonorepoWorkflow` so they pass the new required param**

Because `skipChangelogUpdate` is now required, every existing call to `followMonorepoWorkflow` in `src/monorepo-workflow-operations.test.ts` will fail to type-check. Add `skipChangelogUpdate: false` (the default behavior) to each call. There are many — search for `await followMonorepoWorkflow({` in the test file and add the field to each invocation. Order it next to `formatter` for consistency, e.g.:

```ts
await followMonorepoWorkflow({
  project,
  tempDirectoryPath: sandbox.directoryPath,
  firstRemovingExistingReleaseSpecification: false,
  releaseType: 'ordinary',
  defaultBranch: 'main',
  formatter,
  skipChangelogUpdate: false,
  stdout,
  stderr,
});
```

- [ ] **Step 5: Run the full monorepo-workflow test suite; everything passes**

Run: `yarn jest src/monorepo-workflow-operations.test.ts`
Expected: all tests pass, including the new `skipChangelogUpdate` test and all the originals with their updated invocations.

- [ ] **Step 6: Commit**

```bash
git add src/monorepo-workflow-operations.ts src/monorepo-workflow-operations.test.ts
git commit -m "feat: gate auto-changelog update and init commit on skipChangelogUpdate"
```

---

## Task 4: Apply the same gate in the interactive UI workflow

**Files:**

- Modify: `src/ui.ts`

There is no existing `src/ui.test.ts`. Per the spec, we make the parallel code change without adding a new test file — keeping parity with current coverage.

- [ ] **Step 1: Update `startUI` signature and gate the first-run block**

In `src/ui.ts`, change the `UIOptions` type (around lines 35-43):

```ts
type UIOptions = {
  project: Project;
  releaseType: 'ordinary' | 'backport';
  defaultBranch: string;
  port: number;
  formatter: Formatter;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
};
```

to:

```ts
type UIOptions = {
  project: Project;
  releaseType: 'ordinary' | 'backport';
  defaultBranch: string;
  port: number;
  formatter: Formatter;
  skipChangelogUpdate: boolean;
  stdout: Pick<WriteStream, 'write'>;
  stderr: Pick<WriteStream, 'write'>;
};
```

Update the `startUI` function destructuring (around lines 57-65):

```ts
export async function startUI({
  project,
  releaseType,
  defaultBranch,
  port,
  formatter,
  stdout,
  stderr,
}: UIOptions): Promise<void> {
```

to:

```ts
export async function startUI({
  project,
  releaseType,
  defaultBranch,
  port,
  formatter,
  skipChangelogUpdate,
  stdout,
  stderr,
}: UIOptions): Promise<void> {
```

Add a JSDoc line for the new param immediately before `@param options.stdout`:

```
 * @param options.skipChangelogUpdate - When true, skips auto-populating the
 * Unreleased section of each package's changelog from git commits since the
 * last release, and skips the accompanying "Initialize Release" commit.
```

Then change the first-run block (around lines 71-77):

```ts
if (firstRun) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

to:

```ts
if (firstRun && !skipChangelogUpdate) {
  await updateChangelogsForChangedPackages({ project, formatter, stderr });
  await commitAllChanges(
    project.directoryPath,
    `Initialize Release ${newReleaseVersion}`,
  );
}
```

- [ ] **Step 2: Type-check**

Run: `yarn build`
Expected: fails — `main.ts` calls `startUI(...)` without `skipChangelogUpdate`. That gets fixed in Task 5. For now, this is expected and OK; we'll commit Task 4 and Task 5 together if you'd prefer, but it's cleaner to defer the commit until Task 5 is done.

- [ ] **Step 3: Do NOT commit yet** — wait until Task 5 lands so the tree stays compilable between commits.

---

## Task 5: Forward `skipChangelogUpdate` from `main.ts`

**Files:**

- Modify: `src/main.ts`

- [ ] **Step 1: Destructure and forward**

In `src/main.ts`, change the destructured assignment (around lines 29-38):

```ts
const {
  project,
  tempDirectoryPath,
  reset,
  releaseType,
  defaultBranch,
  interactive,
  port,
  formatter,
} = await determineInitialParameters({ argv, cwd, stderr });
```

to:

```ts
const {
  project,
  tempDirectoryPath,
  reset,
  releaseType,
  defaultBranch,
  interactive,
  port,
  formatter,
  skipChangelogUpdate,
} = await determineInitialParameters({ argv, cwd, stderr });
```

Update the `startUI` call (around lines 46-54):

```ts
await startUI({
  project,
  releaseType,
  defaultBranch,
  port,
  formatter,
  stdout,
  stderr,
});
```

to:

```ts
await startUI({
  project,
  releaseType,
  defaultBranch,
  port,
  formatter,
  skipChangelogUpdate,
  stdout,
  stderr,
});
```

Update the `followMonorepoWorkflow` call (around lines 56-65):

```ts
await followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification: reset,
  releaseType,
  defaultBranch,
  formatter,
  stdout,
  stderr,
});
```

to:

```ts
await followMonorepoWorkflow({
  project,
  tempDirectoryPath,
  firstRemovingExistingReleaseSpecification: reset,
  releaseType,
  defaultBranch,
  formatter,
  skipChangelogUpdate,
  stdout,
  stderr,
});
```

- [ ] **Step 2: Type-check**

Run: `yarn build`
Expected: succeeds with no errors.

- [ ] **Step 3: Run the full unit test suite**

Run: `yarn jest`
Expected: all tests pass.

- [ ] **Step 4: Commit Task 4 + Task 5 changes together**

```bash
git add src/ui.ts src/main.ts
git commit -m "feat: gate auto-changelog update in interactive UI on skipChangelogUpdate"
```

---

## Task 6: Add end-to-end functional test

**Files:**

- Modify: `src/functional.test.ts`

- [ ] **Step 1: Read the surrounding test context**

Open `src/functional.test.ts` and locate the test `'switches to a new release branch and commits the changes'` (starts around line 564). The new test follows the same pattern but adds `args: ['--skip-changelog-update']` to the `runTool` call and inverts the commit-count expectation.

- [ ] **Step 2: Write the failing functional test**

Immediately after the closing `});` of the `'switches to a new release branch and commits the changes'` test (after line 635), insert:

```ts
it('does not create an Initialize Release commit when --skip-changelog-update is passed', async () => {
  await withMonorepoProjectEnvironment(
    {
      packages: {
        $root$: {
          name: '@scope/monorepo',
          version: '1.0.0',
          directoryPath: '.',
        },
        a: {
          name: '@scope/a',
          version: '1.0.0',
          directoryPath: 'packages/a',
        },
      },
      workspaces: {
        '.': ['packages/*'],
      },
    },
    async (environment) => {
      await environment.runTool({
        args: ['--skip-changelog-update'],
        releaseSpecification: {
          packages: {
            a: 'major',
          },
        },
      });

      const latestCommitsInReverse = (
        await environment.runCommand('git', [
          'log',
          '--pretty=%s%x09%H%x09%D',
          '--date-order',
          '--max-count=2',
        ])
      ).stdout
        .split('\n')
        .map((line) => {
          const [subject, commitId, revsMarker] = line.split('\x09');
          const revs = revsMarker.split(' -> ');
          return { subject, commitId, revs };
        });

      expect(latestCommitsInReverse[0].subject).toBe('Update Release 2.0.0');
      expect(latestCommitsInReverse[1].subject).not.toBe(
        'Initialize Release 2.0.0',
      );
      expect(latestCommitsInReverse[0].revs).toContain('HEAD');
      expect(latestCommitsInReverse[0].revs).toContain('release/2.0.0');
    },
  );
});
```

- [ ] **Step 3: Run the functional test**

Run: `yarn jest src/functional.test.ts -t "does not create an Initialize Release commit"`
Expected: passes (the implementation from Tasks 1–5 already supports this behavior).

If it fails: re-verify that `--skip-changelog-update` is correctly being parsed by yargs and that the gate in `monorepo-workflow-operations.ts` matches the flag. Functional tests invoke the real CLI binary via `tsx`, so a misparse there won't surface in unit tests.

- [ ] **Step 4: Commit**

```bash
git add src/functional.test.ts
git commit -m "test: cover --skip-changelog-update end-to-end"
```

---

## Task 7: Documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/usage.md`

- [ ] **Step 1: Inspect `README.md` to find the right place to mention the flag**

Open `README.md`. Scan for an existing "Usage" or "Options" section. As of the current state, the README points readers to `./docs` for usage. If there's no flag list in the README itself, leave it untouched and document only in `docs/usage.md` (Step 3). If there IS a flag/options list, add to it as described in Step 2.

- [ ] **Step 2: Add the flag to `README.md` if an options section exists**

If `README.md` lists CLI options, add a bullet:

```markdown
- `--skip-changelog-update`: Skip auto-populating the "Unreleased" section of each package's changelog from git commits since the last release. Use this in repos that maintain changelogs on the go. When set, the tool also skips the accompanying "Initialize Release" commit. Default: `false`.
```

If no such section exists, skip this step.

- [ ] **Step 3: Document the flag in `docs/usage.md`**

Open `docs/usage.md`. Scan for an existing CLI-options section or a description of `--reset` / `--backport` / `--interactive`. Append the new flag in the same style — keep formatting consistent with the surrounding flags. Example bullet (adapt to match existing style):

```markdown
### `--skip-changelog-update`

Skip auto-populating the "Unreleased" section of each package's changelog from
git commits since the last release. Use this in repos that maintain changelogs
on the go (e.g. each PR adds its own entry to `## Unreleased`). When set, the
tool also skips the accompanying "Initialize Release X.Y.Z" commit.

Default: `false`.
```

If `docs/usage.md` doesn't document any of the existing flags either, add a brief "Options" section listing this flag, and consider opening a follow-up to document the rest (out of scope here).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/usage.md
git commit -m "docs: document --skip-changelog-update flag"
```

(Adjust the `git add` list if you only modified one of the two files.)

---

## Final verification

- [ ] **Step 1: Run the full test suite**

Run: `yarn test` (or `yarn jest` if `test` runs anything heavier).
Expected: all unit + functional tests pass.

- [ ] **Step 2: Run the linter**

Run: `yarn lint`
Expected: passes. If it complains about a missing JSDoc tag or style issue introduced by the new param, fix and re-run.

- [ ] **Step 3: Manual smoke test (optional but recommended)**

Pick a downstream repo that maintains its changelog on the go (one of the MetaMask repos the user works with). From a scratch worktree of `create-release-branch`, link it into that repo (or use a preview build), and invoke:

```bash
yarn create-release-branch --skip-changelog-update
```

Confirm:

- No `Initialize Release X.Y.Z` commit lands on the new release branch.
- Each package's `## Unreleased` section is unchanged from what was on disk before the run, modulo the migration to the new version section that `executeReleasePlan` performs.

- [ ] **Step 4: Done**

The feature is complete. No additional follow-up needed unless the optional config-file source from the spec's "Out of scope" section is requested.
