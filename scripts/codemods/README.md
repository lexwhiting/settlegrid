# Codemods

A small, extensible framework for running idempotent transformations across the 1,022 templates in `open-source-servers/`. Built on [jscodeshift](https://github.com/facebook/jscodeshift) for TypeScript AST edits and targeted string replacement for JSON files.

## Why

The SDK (`@settlegrid/mcp`) evolves. When it ships a breaking change, every template must be migrated. A manual edit-commit-push loop across 1,022 repos is not an option for a solo founder. Codemods automate this: a single `npm run codemod:<name>` pass rewrites every template deterministically.

## Invariants

1. **Dry-run by default.** No file is written unless `--apply` is passed explicitly. Every run prints a unified diff so you can review the change before committing.
2. **Idempotent.** Running the same codemod twice is a no-op on the second run. Tests enforce this.
3. **Minimal diffs.** A codemod must touch only the lines it needs to change — never reformat a whole file. The `sdk-version-bump` codemod's package.json edit is a single-line substring replacement, not a `JSON.stringify`.
4. **Failure logging.** A template that fails to parse or transform is logged to `docs/audit-failures/codemod-<name>-<date>.json` and the runner continues with the next template.

## Running a Codemod

```bash
# Dry run against every template (default target = open-source-servers/*)
npm run codemod:sdk-bump -- --from 0.1.1 --to 0.2.0

# Dry run against a single template
npm run codemod:sdk-bump -- --from 0.1.1 --to 0.2.0 --target "open-source-servers/settlegrid-500px"

# Apply the changes (writes to disk)
npm run codemod:sdk-bump -- --from 0.1.1 --to 0.2.0 --apply
```

The runner prints a unified diff for every template it would touch, followed by a summary line:

```
[codemod:sdk-version-bump] 1 templates, 1 files would touch, 1 skipped, 0 errors
[codemod:sdk-version-bump] DRY RUN — pass --apply to write changes
```

Per-template results are persisted to `scripts/codemods/.last-run.json` for post-hoc inspection.

## Writing a New Codemod

1. Create `scripts/codemods/<codemod-name>.js` that exports a `run(templateDir, options)` function:

   ```js
   export async function run(templateDir, opts) {
     return {
       filesTouched: [],  // relative paths of files the codemod would / did change
       skipped: [],       // per-file skip reasons
       errors: [],        // parse or transform errors
       diffs: [],         // [{ file, diff }] unified-diff strings (used in dry-run output)
     };
   }
   ```

2. The runner loads the module by name, iterates the target glob, calls `run()` for each directory, and aggregates results. In dry-run mode, no writes happen — your codemod MUST honor `opts.dryRun === true` and skip disk writes accordingly.

3. Add fixtures under `scripts/codemods/fixtures/before/` and `scripts/codemods/fixtures/after/`.

4. Add tests under `scripts/codemods/__tests__/<codemod-name>.test.mjs` using `node:test`. Every codemod must include tests for:
   - Dry-run produces the expected diff without writing
   - Apply mode writes the expected bytes
   - Idempotency (second run is a no-op)
   - Malformed input produces a structured error, not a crash
   - Unrelated files are left untouched

5. Register a shortcut npm script in the repo root `package.json`:
   ```json
   "codemod:your-name": "node scripts/codemods/runner.mjs your-name"
   ```

## Running the Test Suite

```bash
node --test scripts/codemods/__tests__/*.test.mjs
```

The codemod test suite uses `node:test` (built-in, no vitest dependency) for consistency with the rest of the scripts/ tests (`scripts/audit/__tests__`). Tests run in under a second and cover 30+ scenarios for `sdk-version-bump` alone.

## Existing Codemods

| Name | Purpose | Inputs |
|------|---------|--------|
| `sdk-version-bump` | Bump `@settlegrid/mcp` dependency range in `package.json` and rewrite deprecated imports in `src/server.ts` via a per-version rename map | `--from <version> --to <version>` |
| `sdk-breaking-changes` | Apply a registry of known `@settlegrid/mcp` breaking-change transforms across every template's `src/` tree (no `--from`/`--to` required) — rename `costCents` to `priceCents`, rewrite `@settlegrid/mcp/legacy` to the canonical import, rename `SGError` to `SettleGridError`, remove deprecated `sg.debug()` calls | _(none)_ |

## Weekly CI Pipeline (P3.11)

The template-ci workflow (`.github/workflows/template-ci.yml`) runs
this batch every Sunday at 06:00 UTC, creating a single PR per
week labeled `template-ci` and assigned to the founder.

**Prerequisite:** the [Renovate GitHub App](https://github.com/apps/renovate)
must be installed on the repo. Renovate handles the dependency-
update half of template maintenance (driven by the committed
`renovate.json`); this workflow handles the codemod half. Both
streams converge on the `template-ci` label. The workflow does
NOT invoke Renovate CLI itself — the App-based pattern is the
standard Renovate integration and avoids a second auth
configuration.

## Batch Runner (P3.11)

The `run-all.mjs` runner applies every registered codemod to every
template under the configured roots (`open-source-servers/*` and
`packages/create-settlegrid-tool/templates/*`). Used by the weekly
`template-ci` GitHub Actions workflow to sweep the whole corpus.

```bash
# Dry-run every codemod against every template
node scripts/codemods/run-all.mjs

# Apply and smoke-test 5 random templates post-apply
node scripts/codemods/run-all.mjs --apply --smoke-test 5
```

Exit codes:
- `0` — clean pass (or dry-run with no errors)
- `1` — at least one template errored during codemod execution
- `2` — post-apply smoke test found a typecheck regression
- `3` — argument / configuration error

The smoke-test sample is seeded by the current ISO date, so two
runs on the same day test the same templates — important for
reproducing a regression.

## Files

```
scripts/codemods/
├── README.md                              ← this file
├── package.json                           ← scoped `type: module` marker
├── runner.mjs                             ← framework entry (CLI + orchestrator)
├── sdk-version-bump.js                    ← first codemod
├── fixtures/
│   ├── before/
│   │   ├── package.json                   ← standard starting state
│   │   ├── package-at-target.json         ← already bumped (idempotency test)
│   │   ├── package-extra-deps.json        ← unrelated deps (isolation test)
│   │   ├── package-malformed.json         ← intentionally broken JSON
│   │   ├── server.ts                      ← clean SDK import
│   │   └── server-with-deprecated.ts      ← imports that a rename map would touch
│   └── after/
│       └── package.json                   ← expected state after 0.1.1 → 0.2.0 bump
├── __tests__/
│   └── sdk-version-bump.test.mjs          ← 30+ tests
└── .last-run.json                         ← runner state (gitignored)
```
