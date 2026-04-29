# Phase 2 — Distribution Surfaces (Weeks 3-4)

*Generated as part of SettleGrid Quantum Leap Master Plan (MP-QL-001)*

---

# SettleGrid Phase 2 — Distribution Surfaces (Weeks 3-4)

## Phase 2 Summary

**Phase goal:** Ship the distribution machinery that makes SettleGrid discoverable and adoptable at scale — a one-command CLI to monetize any existing MCP server, a shadow directory of 1,000+ auto-generated landing pages targeting long-tail SEO, and a hand-polished gallery of 20 canonical templates backed by a schema-validated registry. By end of Phase 2, any developer can `npx settlegrid add` against their repo or `npx create-settlegrid-tool --template <name>` against the gallery, and search engines index a SettleGrid page for every MCP server on the internet.

**Prompt sequence overview:**
- P2.1 — `settlegrid-cli` package scaffold (@clack/prompts + giget + jscodeshift)
- P2.2 — CLI repo type detection (MCP / LangChain / REST / other)
- P2.3 — CLI jscodeshift transform for SDK wrapping
- P2.4 — CLI GitHub PR creation via Octokit
- P2.5 — CLI unit + smoke tests on 3 real MCP repos
- P2.6 — `template.json` Zod schema + validator
- P2.7 — `scripts/build-registry.ts` walks templates, emits registry.json
- P2.8 — 20 canonical templates hand-polish (batch + manual review)
- P2.9 — Gallery SSG (`/templates` + `/templates/[slug]`)
- P2.10 — Gallery search with Meilisearch (Fly.io self-host)
- P2.11 — Shadow directory Postgres schema + multi-source crawler
- P2.12 — Shadow directory SSG (`/mcp/[owner]/[repo]`)
- P2.13 — Template quality gate CI workflow
- P2.14 — Phase 2 exit criteria audit gate

**Expected artifacts at end of phase:**
- `packages/settlegrid-cli/` published to npm, smoke-tested on 3 real repos
- `apps/web/public/registry.json` served publicly, schema-validated
- 20 polished canonical templates in `open-source-servers/` with template.json
- `apps/web/src/app/templates/` gallery live (feature-flag optional)
- `apps/web/src/app/mcp/[owner]/[repo]/` shadow directory with ≥1,000 SSG pages
- `mcp_shadow_index` Postgres table populated from PulseMCP, Smithery, awesome-mcp
- `.github/workflows/template-quality.yml` green on main
- `create-settlegrid-tool` CLI reads published registry.json
- Phase 2 audit log: all 14 prompts PASS

**Estimated total hours and cost:** ~82-98 hours, ~$1,350-$1,650 in Claude inference + $10/mo infra (Fly.io Meilisearch + Postgres crawler runtime). Single-session wall time per prompt stays under 3 hours.

---

## P2.1 — settlegrid-cli package scaffold

**Phase:** 2
**Depends on:** P1 exit gate (Phase 1 all PASS)
**Blocks:** P2.2, P2.3, P2.4, P2.5
**Estimated effort:** 5h, ~$85
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Phase 2 introduces a new npm package `@settlegrid/cli` exposing the `settlegrid` binary. Its flagship command, `settlegrid add`, takes any MCP repo (local path or GitHub URL) and monetizes it by adding `settlegrid.init()` + `sg.wrap()` calls, then optionally opens a PR. This prompt scaffolds the package skeleton only — commands are stubs; subsequent prompts (P2.2-P2.4) fill in detection, codemod, and PR creation. The package must be installable as `npx settlegrid` and belong to the pnpm workspace.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-cli/` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/package.json` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/index.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/tsup.config.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/tsconfig.json` (to be created)
- `/Users/lex/settlegrid/pnpm-workspace.yaml`
- `/Users/lex/settlegrid/turbo.json`

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/package.json` — reference package.json structure, tsup setup, bin field, publishConfig
- `/Users/lex/settlegrid/packages/mcp/tsup.config.ts` — reference build config
- `/Users/lex/settlegrid/packages/create-settlegrid-tool/package.json` — reference bin + npx entry for CLI package
- `/Users/lex/settlegrid/packages/create-settlegrid-tool/src/index.ts` — reference CLI entry shape
- `/Users/lex/settlegrid/pnpm-workspace.yaml` — confirm workspace globs include `packages/*`
- `/Users/lex/settlegrid/turbo.json` — confirm build/test pipelines apply to new package

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] `pnpm -w typecheck` is green on main before starting
- [ ] `pnpm -w test` is green on main before starting
- [ ] Node 20+, pnpm 9+ available

### Specification
Create a new workspace package `packages/settlegrid-cli/` named `@settlegrid/cli` that:
1. Declares `"bin": { "settlegrid": "./dist/index.js" }` so `npx settlegrid` works
2. Declares dependencies on `@clack/prompts`, `giget`, `jscodeshift`, `@octokit/rest`, `commander`, `kleur`, and `zod`
3. Uses `tsup` to build ESM + CJS with shebang preservation
4. Exposes a `settlegrid add [source]` command (stub — prints "not yet implemented" + parses flags: `--github <url>`, `--path <dir>`, `--dry-run`, `--no-pr`, `--out-branch <name>`)
5. Has one passing smoke test in `src/index.test.ts` that spawns the built binary with `--version` and asserts non-zero exit on unknown command
6. Is wired into `pnpm-workspace.yaml` and `turbo.json` so `pnpm -w build` and `pnpm -w test` include it

Package version: `0.1.0`. License: same as other workspace packages. Node engine: `>=20`.

**Files you may touch:**
- `packages/settlegrid-cli/**`
- `pnpm-workspace.yaml` (only to confirm; do not modify if `packages/*` already matches)
- `turbo.json` (only if pipeline filters need updating)
- `pnpm-lock.yaml` (regenerated automatically)

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `packages/create-settlegrid-tool/**`
- `apps/web/**`
- `open-source-servers/**`
- Any other workspace package

**External services touched:**
- npm registry (dependency install only; no publish in this prompt)

### Implementation Steps
1. Read the reference files listed above to confirm the workspace conventions (tsup config, tsconfig extends, eslint extends).
2. Create `packages/settlegrid-cli/package.json` with name `@settlegrid/cli`, version `0.1.0`, `type: "module"`, `bin.settlegrid: "./dist/index.js"`, `main`, `types`, `exports` fields, scripts (`build`, `test`, `typecheck`, `lint`), dependencies, devDependencies (`tsup`, `vitest`, `@types/node`, `@types/jscodeshift`).
3. Create `tsup.config.ts` that builds `src/index.ts` as ESM, emits `.js` + `.d.ts`, preserves shebang `#!/usr/bin/env node`, targets node20.
4. Create `tsconfig.json` extending the workspace root tsconfig, rootDir `src`, outDir `dist`.
5. Create `src/index.ts`: import `commander`, define `program`, set version from package.json, register `add` subcommand delegating to `./commands/add.ts`, call `program.parseAsync(process.argv)` inside an `async` IIFE with a top-level try/catch.
6. Create `src/commands/add.ts` exporting `addCommand(program: Command)` that wires options and a handler body that, for now, logs the parsed options via `@clack/prompts` and exits 0 (stub).
7. Create `src/index.test.ts` with a vitest that `exec`s `node dist/index.js --version` (after build) and asserts output matches `/^0\.1\.0$/`.
8. Run `pnpm install` at repo root, then `pnpm --filter @settlegrid/cli build`, then `pnpm --filter @settlegrid/cli test`.
9. Verify `pnpm -w typecheck` and `pnpm -w test` both pass.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `packages/settlegrid-cli/package.json` exists with correct bin + deps
- [ ] `pnpm --filter @settlegrid/cli build` succeeds; `dist/index.js` has shebang
- [ ] `node packages/settlegrid-cli/dist/index.js --version` prints `0.1.0`
- [ ] `node packages/settlegrid-cli/dist/index.js add --help` prints flag documentation
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, new smoke test added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
`git rm -r packages/settlegrid-cli && pnpm install && git commit`. No migrations, no external state, no published artifacts. Trivial reversal.

### Commit Message Template
```
cli: scaffold @settlegrid/cli package with add command stub

Creates packages/settlegrid-cli with tsup build, commander entry,
add subcommand stub, and smoke test. No detection or codemod logic
yet — this prompt only establishes the package shape and bin entry.

Refs: P2.1
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.2 — CLI: repo type detection

**Phase:** 2
**Depends on:** P2.1
**Blocks:** P2.3, P2.5
**Estimated effort:** 5h, ~$85
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The `settlegrid add` command must decide how to wrap a target repo. Different repo shapes need different codemods: an MCP server exports `Server` from `@modelcontextprotocol/sdk`, a LangChain tool subclasses `Tool`, a REST server uses Express/Fastify/Hono, and anything else is flagged as unsupported. This prompt adds pure-function detection logic so P2.3 can branch on the detected type. Detection must be fast, side-effect-free, and handle both local paths and freshly-fetched GitHub repos via `giget`.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/detect/index.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/detect/index.test.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/detect/fixtures/` (to be created — small sample package.json and source files)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` (modified)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` — current stub to extend
- `/Users/lex/settlegrid/open-source-servers/` — sample any 3-5 real MCP server package.json files to understand field patterns
- `/Users/lex/settlegrid/packages/mcp/src/` — understand what SettleGrid considers a "handler" to wrap

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.1 audit log PASS
- [ ] `pnpm --filter @settlegrid/cli build` succeeds

### Specification
Export a pure async function:
```ts
export type RepoType = 'mcp-server' | 'langchain-tool' | 'rest-api' | 'unknown';
export interface DetectResult {
  type: RepoType;
  confidence: number; // 0-1
  language: 'ts' | 'js' | 'py' | 'unknown';
  entryPoints: string[]; // relative paths
  reasons: string[];
}
export async function detectRepoType(rootDir: string): Promise<DetectResult>;
```

Detection rules (first match wins, highest confidence):
1. **mcp-server**: `package.json.dependencies` contains `@modelcontextprotocol/sdk` OR any `.ts`/`.js` file imports `@modelcontextprotocol/sdk`. Confidence 0.95.
2. **langchain-tool**: package.json contains `@langchain/core` or `langchain` AND at least one source file extends `StructuredTool` / `Tool` / `DynamicStructuredTool`. Confidence 0.9.
3. **rest-api**: package.json contains one of `express`, `fastify`, `hono`, `koa`, `@hono/node-server`. Confidence 0.8.
4. **unknown**: no match. Confidence 0.

Language inference: if `package.json` has `"type": "module"` + `.ts` files present → `ts`. If `.py` files + `pyproject.toml` → `py`. Else `js`.

Entry points: read `package.json.main`, `package.json.module`, `package.json.exports["."].default`, and any `bin` values. Dedupe and return existing-on-disk paths.

All file I/O via `node:fs/promises`. Use `fast-glob` (add as dep) for source scans, capped at 500 files and 5MB per file, timeout 10s total. Never execute repo code.

`add.ts` command handler must call `detectRepoType` after resolving the source (local path or `giget` tmp dir), print the result via `@clack/prompts.note`, and exit with code `1` + message if type is `unknown` (unless `--force` passed).

**Files you may touch:**
- `packages/settlegrid-cli/src/detect/**`
- `packages/settlegrid-cli/src/commands/add.ts`
- `packages/settlegrid-cli/package.json` (add `fast-glob` dep)
- `packages/settlegrid-cli/src/lib/source-resolver.ts` (new — handles `--path` vs `--github` → returns local dir)

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `apps/web/**`
- `open-source-servers/**`

**External services touched:**
- None (giget fetch is wired but only exercised in tests via mock)

### Implementation Steps
1. Read P2.1 output and sample 5 real MCP server package.json files under `open-source-servers/`.
2. Create `src/detect/index.ts` with types and `detectRepoType` implementation matching the rules above.
3. Create `src/detect/fixtures/` with 4 miniature repo dirs: `mcp-sample/`, `langchain-sample/`, `rest-sample/`, `unknown-sample/`. Each has a `package.json` plus one `src/index.ts` file.
4. Create `src/detect/index.test.ts` with a vitest test per fixture asserting `type`, `confidence ≥ expected`, and `reasons` non-empty. Add edge cases: empty dir, malformed package.json, python-only repo.
5. Create `src/lib/source-resolver.ts` exporting `resolveSource(opts: { path?: string; github?: string }): Promise<{ dir: string; cleanup: () => Promise<void> }>`. Use `giget` for GitHub fetches into a `node:os.tmpdir()` subdir.
6. Update `src/commands/add.ts` to call `resolveSource` then `detectRepoType`, print via `@clack/prompts`, exit 1 on unknown unless `--force`.
7. Add `fast-glob` to `dependencies`. Run `pnpm install` at repo root.
8. Build and test: `pnpm --filter @settlegrid/cli build && pnpm --filter @settlegrid/cli test`.
9. Verify `pnpm -w typecheck` and `pnpm -w test` green.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `detectRepoType` correctly classifies 4 fixture repos
- [ ] Handles malformed package.json without throwing
- [ ] `settlegrid add ./fixture-mcp-sample --dry-run` prints detected type
- [ ] No repo code is executed during detection (audit: no `require`, `import()`, `spawn` on repo files)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥6 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `packages/settlegrid-cli/src/detect/` and `src/lib/source-resolver.ts`, restore `src/commands/add.ts` to P2.1 stub. `pnpm install`. No external state.

### Commit Message Template
```
cli: add repo type detection for settlegrid add

Adds detectRepoType pure function that classifies a target repo as
mcp-server, langchain-tool, rest-api, or unknown based on package.json
deps and source file scans. Wires detection into `settlegrid add`
and bails on unknown unless --force.

Refs: P2.2
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.3 — CLI: SDK wrapping transform (jscodeshift)

**Phase:** 2
**Depends on:** P2.2
**Blocks:** P2.4, P2.5
**Estimated effort:** 8h, ~$140
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
With the target repo type detected, the CLI must transform source code to add `settlegrid.init()` at the entry point and wrap every handler with `sg.wrap()`. This is the most code-sensitive step in Phase 2. We implement it as a jscodeshift codemod so transformations are idempotent, preserve formatting, and only modify the minimum necessary. The codemod must be safe to run twice (second run is a no-op) and must never break an existing valid repo.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/add-mcp.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/add-langchain.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/add-rest.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/runner.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/**/*.test.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/__testfixtures__/` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` (modified)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/src/index.ts` — canonical `settlegrid.init()` and `sg.wrap()` API surface so codemod matches reality
- `/Users/lex/settlegrid/packages/mcp/README.md` — reference usage patterns to replicate
- `/Users/lex/settlegrid/packages/create-settlegrid-tool/templates/` — existing wrapped template to mirror the output shape
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/detect/index.ts` — what the transforms receive

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.2 audit log PASS
- [ ] `@settlegrid/mcp` public API surface stable (no P1 breaking changes pending)

### Specification
Export a unified transform runner:
```ts
export interface TransformInput {
  rootDir: string;
  detect: DetectResult;
  dryRun: boolean;
}
export interface TransformOutput {
  changedFiles: Array<{ path: string; before: string; after: string }>;
  skipped: Array<{ path: string; reason: string }>;
  addedDependencies: Record<string, string>; // { "@settlegrid/mcp": "^0.1.1" }
  envVarsRequired: string[]; // e.g. SETTLEGRID_API_KEY
}
export async function runTransform(input: TransformInput): Promise<TransformOutput>;
```

Per-type codemods:

**add-mcp**: In the entry file(s), (a) add `import { settlegrid } from '@settlegrid/mcp';` if absent, (b) add `const sg = settlegrid.init({ apiKey: process.env.SETTLEGRID_API_KEY });` directly before the first `new Server(...)` instantiation, (c) wrap every `server.setRequestHandler(schema, handler)` so the handler becomes `sg.wrap('<schema.method or fallback>', handler)`.

**add-langchain**: In files where `StructuredTool`/`Tool` subclasses are defined, wrap the `_call`/`invoke` method body with `sg.wrap('<this.name>', async () => { /* original body */ })`. Add import + init as above.

**add-rest**: For each route handler (`app.get`, `app.post`, `app.route(...).get`, etc. for express/hono/fastify), wrap the handler in `sg.wrap('<method>:<path>', handler)`. Add import + init before `app.listen`.

Idempotency rules: if `import ... from '@settlegrid/mcp'` already exists OR any call to `settlegrid.init` exists, the file is treated as already-wrapped and added to `skipped` with reason `already-wrapped`.

Dependency updates: append `@settlegrid/mcp` to the target repo's `package.json.dependencies` with caret range matching the currently published version. Do NOT run `npm install` — only mutate package.json.

env vars: always emit `SETTLEGRID_API_KEY` in `envVarsRequired`.

Dry-run: when `dryRun: true`, return `TransformOutput` with `before`/`after` diffs but do not write to disk.

**Files you may touch:**
- `packages/settlegrid-cli/src/transforms/**`
- `packages/settlegrid-cli/src/commands/add.ts`
- `packages/settlegrid-cli/package.json` (add `jscodeshift` + `@types/jscodeshift` if missing; they should exist from P2.1)

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `apps/web/**`
- `open-source-servers/**`
- `packages/create-settlegrid-tool/**`

**External services touched:**
- None

### Implementation Steps
1. Read `packages/mcp/src/index.ts` and confirm the exact `settlegrid.init()` + `sg.wrap()` signatures; cite line numbers in your plan.
2. Create `src/transforms/__testfixtures__/` with before/after pairs for each codemod: `mcp-basic.before.ts` / `mcp-basic.after.ts`, `mcp-multi-handler.before.ts` / `.after.ts`, `mcp-already-wrapped.before.ts` / `.after.ts`, `langchain-tool.before.ts`, `rest-express.before.ts`, `rest-hono.before.ts` (+ corresponding after files).
3. Implement `add-mcp.ts` using jscodeshift: traverse ImportDeclarations and CallExpressions to match handler registrations, insert nodes with `j.template.statement` to keep formatting minimal.
4. Implement `add-langchain.ts` and `add-rest.ts` following the same patterns.
5. Implement `runner.ts` that dispatches based on `detect.type`, reads entry point files, runs the matching codemod, and collects diffs. Use `fast-glob` to enumerate source files beyond entry points (cap at 500).
6. Write vitest tests that load each fixture, run the codemod, and assert `after === expected`. Also assert idempotency by running the codemod twice and confirming the second run produces zero changes.
7. Update `src/commands/add.ts` to call `runTransform` after detection; if `--dry-run`, print the diff; otherwise write files and show a summary.
8. Build and test: `pnpm --filter @settlegrid/cli build && pnpm --filter @settlegrid/cli test`.
9. Manual smoke: run `node dist/index.js add ./src/detect/fixtures/mcp-sample --dry-run` and inspect output.
10. Verify `pnpm -w typecheck` and `pnpm -w test` green.
11. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] All 6+ codemod fixture pairs pass
- [ ] Idempotency test passes (second run = zero changes)
- [ ] `package.json` dependency insertion is deterministic (keys stay sorted)
- [ ] Dry-run never writes to disk (verified by stat mtime test)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥10 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `packages/settlegrid-cli/src/transforms/`. Restore `src/commands/add.ts` to P2.2 state. `pnpm install`. No external state.

### Commit Message Template
```
cli: implement jscodeshift transforms for add command

Adds per-repo-type codemods (mcp-server, langchain-tool, rest-api)
that insert `settlegrid.init()` and wrap handlers with `sg.wrap()`.
Transforms are idempotent, respect dry-run, and mutate target
package.json to add @settlegrid/mcp. Includes fixture-based tests
covering 6+ before/after pairs and idempotency assertions.

Refs: P2.3
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.4 — CLI: GitHub PR creation

**Phase:** 2
**Depends on:** P2.3
**Blocks:** P2.5
**Estimated effort:** 5h, ~$85
**Risk level:** Medium (touches GitHub API with a user token)
**Rollback complexity:** Trivial (code only; no prior runs before smoke test)

### Context
After transforming a repo, `settlegrid add` must optionally open a pull request explaining the changes. This prompt adds an Octokit-backed PR workflow: fork the target repo if the user lacks push, create a branch, commit the transformed files, push, and open a PR with a generated body that shows the diff summary, monetization math, and a link to SettleGrid docs. Must work in dry-run mode (preview body only, no API calls) and degrade gracefully when no token is provided (falls back to a local patch file).

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/pr/github.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/pr/body-template.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/pr/github.test.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` (modified)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/runner.ts` — what shape of output the PR body consumes
- `/Users/lex/settlegrid/packages/mcp/README.md` — language for monetization math in the PR body

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.3 audit log PASS
- [ ] `@octokit/rest` installed (from P2.1)

### Specification
Export:
```ts
export interface OpenPrInput {
  repoOwner: string;
  repoName: string;
  branchName: string;
  baseBranch: string; // usually 'main'
  changes: TransformOutput['changedFiles'];
  dependencyBump: Record<string, string>;
  envVarsRequired: string[];
  token: string; // GITHUB_TOKEN
}
export interface OpenPrResult {
  url: string;
  number: number;
  forkUsed: boolean;
}
export async function openPullRequest(input: OpenPrInput): Promise<OpenPrResult>;
export function renderPrBody(input: Omit<OpenPrInput, 'token' | 'baseBranch' | 'branchName'>): string;
```

Flow inside `openPullRequest`:
1. Octokit authenticates with `token`.
2. Check push permissions on `repoOwner/repoName`. If no push, fork via `POST /repos/{owner}/{repo}/forks` and poll until ready (max 30s).
3. Get base branch SHA, create new branch `branchName` from it.
4. Create a tree with the transformed files (base64-encoded blobs), create a commit, update the ref.
5. Call `pulls.create` with title `chore: monetize with SettleGrid`, body from `renderPrBody`, head `user:branchName`, base `baseBranch`.
6. Return PR url + number + forkUsed flag.

`renderPrBody` output includes:
- Summary of changed files (count + list)
- Added dependency: `@settlegrid/mcp@<version>`
- Required env vars block
- "How this works" 3-bullet explanation
- "How to remove SettleGrid" section (single-paragraph revert instructions)
- Footer: `Generated by \`npx settlegrid add\``

CLI integration: `settlegrid add` flags `--no-pr` skips this step; `--token <t>` passes token explicitly; otherwise reads `process.env.GITHUB_TOKEN`. If no token and `--no-pr` not set, print a warning and emit a `.patch` file to cwd instead.

Tests: use `msw` or Octokit's `fetch` override to mock API calls. Test (a) happy-path branch creation, (b) fork fallback, (c) `renderPrBody` snapshot, (d) no-token graceful patch-file fallback.

**Files you may touch:**
- `packages/settlegrid-cli/src/pr/**`
- `packages/settlegrid-cli/src/commands/add.ts`
- `packages/settlegrid-cli/package.json` (add `msw` to devDependencies if needed)

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `apps/web/**`
- `open-source-servers/**`

**External services touched:**
- GitHub REST API (mocked in tests; only real in P2.5 smoke tests)

### Implementation Steps
1. Read `src/transforms/runner.ts` and confirm `TransformOutput` shape.
2. Implement `src/pr/body-template.ts` with `renderPrBody` as pure function. Snapshot-test.
3. Implement `src/pr/github.ts` with `openPullRequest` using Octokit. Structure as small helpers: `ensurePushAccess`, `forkAndWait`, `createBranch`, `commitFiles`, `createPr`.
4. Write tests using mocked Octokit (msw or a thin `fetch` stub). Cover push, fork, and error cases.
5. Update `src/commands/add.ts`: after transform, decide PR vs patch file vs skip based on flags; call `openPullRequest`; on success, print PR url via `@clack/prompts`.
6. Build and test.
7. Verify `pnpm -w typecheck` and `pnpm -w test` green.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `openPullRequest` tests cover happy path + fork fallback + no-token fallback
- [ ] `renderPrBody` snapshot is deterministic and human-readable
- [ ] `--dry-run` never touches the GitHub API (test asserts zero fetches)
- [ ] Token never logged or echoed to stdout (grep check in test)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥6 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. No GitHub state was mutated (tests are mocked; smoke tests live in P2.5). `pnpm install`.

### Commit Message Template
```
cli: add GitHub PR creation to settlegrid add

Implements openPullRequest via Octokit with fork fallback when the
user lacks push access, and renderPrBody that generates a human-
readable PR description with monetization math and a SettleGrid
removal section. Supports --no-pr, --token, and graceful patch-file
fallback when no token is available.

Refs: P2.4
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.5 — CLI: unit + smoke tests on 3 real MCP repos

**Phase:** 2
**Depends on:** P2.1, P2.2, P2.3, P2.4
**Blocks:** P2.14
**Estimated effort:** 6h, ~$100
**Risk level:** Medium (interacts with real GitHub repos)
**Rollback complexity:** Trivial (test-only code)

### Context
Before declaring the CLI production-grade, we must prove it works against real MCP servers in the wild. This prompt adds an opt-in smoke test script that clones 3 known-good MCP repos, runs the CLI end-to-end in a tmp dir with `--dry-run --no-pr`, and asserts the expected transformation. The smoke test runs locally (not in default CI) and is invoked by the Phase 2 gate (P2.14) to validate the exit criterion "CLI passes smoke test on 3 real MCP repos."

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-cli/scripts/smoke.ts` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/scripts/smoke-targets.json` (to be created)
- `/Users/lex/settlegrid/packages/settlegrid-cli/package.json` (modified — add `smoke` script)
- `/Users/lex/settlegrid/packages/settlegrid-cli/README.md` (to be created)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/commands/add.ts` — CLI entry used by smoke
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/detect/index.ts` — for type assertions
- `/Users/lex/settlegrid/packages/settlegrid-cli/src/transforms/runner.ts` — for change assertions

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.4 audit log PASS
- [ ] `pnpm --filter @settlegrid/cli build` succeeds

### Specification
Pick 3 small, stable, permissively-licensed MCP server repos from `open-source-servers/` metadata (confirm they still exist on GitHub at time of authoring). Good candidates are well-known `modelcontextprotocol/servers` entries such as `everything`, `filesystem`, `fetch` — verify each at author time and lock to a specific commit SHA in `smoke-targets.json`.

`smoke-targets.json` shape:
```json
{
  "targets": [
    {
      "name": "mcp-everything",
      "github": "modelcontextprotocol/servers",
      "subdir": "src/everything",
      "commit": "<SHA>",
      "expectedType": "mcp-server",
      "expectedMinChangedFiles": 1
    }
  ]
}
```

`smoke.ts` flow per target:
1. Use `giget` to fetch the repo at the pinned commit into a tmp dir.
2. If `subdir` is set, point the CLI at `<tmpDir>/<subdir>`.
3. Spawn `node dist/index.js add <dir> --dry-run --no-pr --json` (add `--json` output flag in P2.5 if not already present — emit the TransformOutput as JSON).
4. Parse JSON and assert:
   - `detect.type === expectedType`
   - `changedFiles.length >= expectedMinChangedFiles`
   - `addedDependencies["@settlegrid/mcp"]` is set
   - No file outside the tmp dir was touched (stat check)
5. Clean up tmp dir.
6. Exit 0 if all targets pass; exit 1 with target-level summary otherwise.

Add `"smoke": "tsx scripts/smoke.ts"` to package scripts. Do NOT run smoke in default `pnpm -w test` (it's network-bound); wire it into the `test:smoke` pipeline only.

Also add `README.md` to the package with: install, usage, flags, example output, and a note that `pnpm --filter @settlegrid/cli smoke` runs the 3-repo smoke test.

**Files you may touch:**
- `packages/settlegrid-cli/scripts/**`
- `packages/settlegrid-cli/src/commands/add.ts` (only to add `--json` if missing)
- `packages/settlegrid-cli/package.json` (add `smoke` script + `tsx` devDep)
- `packages/settlegrid-cli/README.md`

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `apps/web/**`
- `open-source-servers/**`
- Any other workspace package

**External services touched:**
- GitHub (clone via giget at pinned commits)

### Implementation Steps
1. Research 3 stable, tiny MCP server repos (confirm each has a recent commit + MIT/Apache-2.0 license). Record their owner/repo/commit-SHA in `smoke-targets.json`.
2. If `src/commands/add.ts` lacks `--json`, add it: when flag set, suppress human prompts and emit a single JSON line with TransformOutput + detect result.
3. Implement `scripts/smoke.ts` per the flow above. Use `node:child_process.spawn` to run the built CLI. Use `node:fs` for tmp-dir cleanup. Fail fast per target with clear diffs.
4. Add `tsx` to devDeps and add `"smoke": "tsx scripts/smoke.ts"` script.
5. Run `pnpm --filter @settlegrid/cli build && pnpm --filter @settlegrid/cli smoke`. Iterate until all 3 targets pass.
6. Write `README.md` for the package.
7. Verify `pnpm -w typecheck` and `pnpm -w test` still green.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `smoke-targets.json` lists 3 real repos at pinned commit SHAs
- [ ] `pnpm --filter @settlegrid/cli smoke` exits 0
- [ ] All 3 targets have `expectedType` matched and changes > 0
- [ ] No file outside tmp dir mutated (stat assertion)
- [ ] README.md written and accurate
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes (smoke excluded by default)
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `packages/settlegrid-cli/scripts/` and `README.md`. Remove `smoke` script from package.json. No external state was persisted (tmp dirs cleaned).

### Commit Message Template
```
cli: smoke-test settlegrid add against 3 real MCP repos

Adds scripts/smoke.ts that fetches 3 pinned MCP server repos via giget,
runs `settlegrid add --dry-run --no-pr --json` against each, and asserts
expected detection + transformation. Invoked via `pnpm --filter
@settlegrid/cli smoke`, excluded from default test pipeline. Also adds
package README with install + usage.

Refs: P2.5
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.6 — Template metadata schema + validator

**Phase:** 2
**Depends on:** P1 exit gate
**Blocks:** P2.7, P2.8, P2.9, P2.13
**Estimated effort:** 4h, ~$70
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Every template in `open-source-servers/` and `packages/create-settlegrid-tool/templates/` needs a structured `template.json` manifest so the registry builder, gallery, CLI scaffolder, and quality gate CI can consume the same source of truth. This prompt defines the Zod schema and a validator that can be invoked from other packages. It does NOT populate template.json for all 1,022 templates — P2.8 handles the 20 canonical ones; the rest get a minimal auto-generated stub later.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/mcp/src/template-schema.ts` (to be created)
- `/Users/lex/settlegrid/packages/mcp/src/template-schema.test.ts` (to be created)
- `/Users/lex/settlegrid/packages/mcp/src/index.ts` (modified — re-export schema)
- `/Users/lex/settlegrid/packages/mcp/package.json` (modified — bump minor)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/src/index.ts` — current exports
- `/Users/lex/settlegrid/open-source-servers/` — sample 5 template folders to understand realistic fields
- `/Users/lex/settlegrid/CANONICAL_50.json` (P1 artifact) — list of 50 canonical templates with any existing metadata

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] `CANONICAL_50.json` exists at repo root (P1 artifact)
- [ ] `@settlegrid/mcp` public API stable

### Specification
Define and export a Zod schema `templateManifestSchema`:

```ts
export const templateManifestSchema = z.object({
  $schema: z.string().url().optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/),              // URL-safe id
  name: z.string().min(1).max(80),                     // human name
  description: z.string().min(1).max(400),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum([
    'ai', 'data', 'devtools', 'infra', 'productivity',
    'finance', 'commerce', 'media', 'research', 'other',
  ]),
  tags: z.array(z.string().min(1).max(30)).max(10),
  author: z.object({
    name: z.string(),
    url: z.string().url().optional(),
    github: z.string().optional(),
  }),
  repo: z.object({
    type: z.literal('git'),
    url: z.string().url(),
    directory: z.string().optional(),
  }),
  runtime: z.enum(['node', 'python', 'bun', 'deno']),
  languages: z.array(z.enum(['ts', 'js', 'py'])).min(1),
  entry: z.string(),                                    // relative path to entry file
  pricing: z.object({
    model: z.enum(['free', 'per-call', 'subscription', 'tiered']),
    perCallUsdCents: z.number().nonnegative().optional(),
    currency: z.literal('USD').default('USD'),
  }),
  quality: z.object({
    tests: z.boolean(),
    ciPassing: z.boolean().optional(),
    lastVerifiedAt: z.string().datetime().optional(),
  }),
  capabilities: z.array(z.string()).max(30),
  screenshots: z.array(z.object({
    url: z.string().url(),
    alt: z.string(),
  })).max(6).optional(),
  loomUrl: z.string().url().optional(),
  deployButton: z.object({
    provider: z.enum(['vercel', 'render', 'railway', 'fly']),
    url: z.string().url(),
  }).optional(),
  featured: z.boolean().default(false),
  trendingRank: z.number().int().positive().optional(),
});

export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export function validateTemplateManifest(json: unknown): TemplateManifest;
export function safeValidateTemplateManifest(json: unknown):
  { success: true; data: TemplateManifest } |
  { success: false; errors: string[] };
```

Also export a JSON Schema version generated from Zod (use `zod-to-json-schema`) and write it to `packages/mcp/schemas/template.schema.json` as a build step.

Tests: at least 12 cases covering valid manifest, each required field missing, tag limits, regex violations, enum violations, pricing per-call without amount, and round-trip parse.

**Files you may touch:**
- `packages/mcp/src/template-schema.ts`
- `packages/mcp/src/template-schema.test.ts`
- `packages/mcp/src/index.ts` (only to add re-export)
- `packages/mcp/schemas/template.schema.json` (generated)
- `packages/mcp/package.json` (bump to 0.2.0 only if exports change; add `zod-to-json-schema` devDep)
- `packages/mcp/tsup.config.ts` (only if needed to emit schemas dir)

**Files you MUST NOT touch:**
- `packages/mcp/src/index.ts` runtime logic
- `apps/web/**`
- `open-source-servers/**`
- `packages/settlegrid-cli/**`

**External services touched:**
- None

### Implementation Steps
1. Read `packages/mcp/src/index.ts` to confirm export patterns and version.
2. Create `src/template-schema.ts` with the schema, types, and validators.
3. Add a build-time hook (or `postbuild` script) that runs `zod-to-json-schema` and writes `schemas/template.schema.json`. Include the schemas dir in `files` in package.json.
4. Write 12+ vitest cases. Use inline fixtures; no disk I/O.
5. Re-export from `packages/mcp/src/index.ts` as `templateManifestSchema`, `validateTemplateManifest`, `safeValidateTemplateManifest`, `type TemplateManifest`.
6. Bump `@settlegrid/mcp` to `0.2.0` (minor — additive public API).
7. Run `pnpm --filter @settlegrid/mcp build && pnpm --filter @settlegrid/mcp test`.
8. Verify `pnpm -w typecheck` and `pnpm -w test` green.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Zod schema exported and validates sample manifests
- [ ] JSON Schema generated to `packages/mcp/schemas/template.schema.json`
- [ ] `@settlegrid/mcp` bumped to 0.2.0 in package.json
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥12 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Remove `packages/mcp/src/template-schema.ts`, the schemas/ dir, and the re-exports. Revert the version bump. `pnpm install`.

### Commit Message Template
```
mcp: add template manifest Zod schema + JSON Schema export

Adds templateManifestSchema covering slug, metadata, pricing, runtime,
capabilities, and media fields. Exports validators and a generated
JSON Schema at schemas/template.schema.json. Bumps @settlegrid/mcp
to 0.2.0 (additive).

Refs: P2.6
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.7 — Registry build script

**Phase:** 2
**Depends on:** P2.6
**Blocks:** P2.8, P2.9, P2.10, P2.13
**Estimated effort:** 5h, ~$85
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The gallery, CLI scaffolder, and quality gate all need a machine-readable registry of templates. This prompt creates `scripts/build-registry.ts` that walks `open-source-servers/*/template.json`, validates each via the P2.6 schema, and emits a single `apps/web/public/registry.json` plus per-template JSON files. The script is idempotent, fast (<10s on full repo), and fails loud on any invalid manifest.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/build-registry.ts` (to be created)
- `/Users/lex/settlegrid/scripts/build-registry.test.ts` (to be created)
- `/Users/lex/settlegrid/package.json` (modified — add workspace-root script `build:registry`)
- `/Users/lex/settlegrid/apps/web/public/registry.json` (emitted artifact)
- `/Users/lex/settlegrid/apps/web/public/templates/<slug>.json` (emitted artifacts)
- `/Users/lex/settlegrid/turbo.json` (possibly — add pipeline)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/src/template-schema.ts` — validator source
- `/Users/lex/settlegrid/scripts/gen/core.mjs` — existing 164-line generator, mirror its style
- `/Users/lex/settlegrid/apps/web/public/` — confirm current contents so we know what not to trample
- `/Users/lex/settlegrid/turbo.json` — pipeline conventions

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.6 audit log PASS (template schema available)
- [ ] `@settlegrid/mcp@0.2.0` built locally

### Specification
Script contract:
```ts
// pnpm build:registry [--strict] [--only <slug>]
```

Behavior:
1. Walk `open-source-servers/*/template.json` (and optionally `packages/create-settlegrid-tool/templates/*/template.json`).
2. For each file, parse + validate via `safeValidateTemplateManifest`.
3. On validation failure in `--strict` mode, exit 1 with an aggregated report. Without `--strict`, skip invalid manifests and log warnings (default: `--strict` on CI, off locally — controlled via `CI` env var).
4. Aggregate into a `RegistryJson`:
```ts
interface RegistryJson {
  version: number;            // increments on schema break
  generatedAt: string;        // ISO
  commit: string;             // git rev-parse HEAD (fallback 'unknown')
  totalTemplates: number;
  categories: Record<string, number>;
  templates: TemplateManifestPublic[]; // manifest minus any private fields (none currently — future-proof)
}
```
5. Write `apps/web/public/registry.json` (pretty-printed with stable key order for deterministic diffs) and per-slug `apps/web/public/templates/<slug>.json`.
6. Emit a summary to stdout: total, per-category counts, skipped count, duration.

Determinism: sort `templates` array by slug ascending. Sort categories object keys. Do not include any timestamp that would cause needless diffs except `generatedAt` and `commit` (which are expected to change).

Test coverage: use a tmp dir as a fake template root with 3 fixtures (1 valid, 1 invalid, 1 minimal). Assert (a) strict mode fails on invalid, (b) non-strict mode skips and returns 2 templates, (c) output files written + deterministic across two runs with the same input.

Wire into `package.json` workspace root:
```json
"scripts": {
  "build:registry": "tsx scripts/build-registry.ts"
}
```
And optionally into `turbo.json` as `build:registry` depending on nothing so it can run on demand.

**Files you may touch:**
- `scripts/build-registry.ts`
- `scripts/build-registry.test.ts`
- `package.json` (root — add script only)
- `turbo.json` (only to add pipeline if needed)
- `apps/web/public/registry.json` (generated — commit the initial output)
- `apps/web/public/templates/*.json` (generated — commit initial outputs for canonical 20 once P2.8 runs)

**Files you MUST NOT touch:**
- `packages/**` except reading `@settlegrid/mcp`
- `apps/web/src/**`
- `open-source-servers/**` content (read-only)

**External services touched:**
- None

### Implementation Steps
1. Read `scripts/gen/core.mjs` to mirror style (node-native, minimal deps).
2. Read `packages/mcp/src/template-schema.ts` for validator API.
3. Implement `scripts/build-registry.ts` using `fast-glob` + `node:fs/promises`. Add `tsx` to root devDeps if not already present.
4. Implement `scripts/build-registry.test.ts` with 3 fixtures in a tmp dir. Use vitest.
5. Add `build:registry` script to root package.json.
6. Run it against the real repo (no canonical templates yet, so output will be small). Commit the generated `apps/web/public/registry.json` placeholder.
7. Verify determinism: run twice, diff should be empty except `generatedAt` / `commit`.
8. Verify `pnpm -w typecheck` and `pnpm -w test` green.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `pnpm build:registry` exits 0 and emits `apps/web/public/registry.json`
- [ ] `--strict` mode fails on invalid manifests with aggregated report
- [ ] Output is deterministic across runs (ignoring generatedAt/commit)
- [ ] Per-template JSON files emitted under `apps/web/public/templates/`
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥5 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `apps/web/public/registry.json` and `apps/web/public/templates/`. Remove `build:registry` script from root package.json.

### Commit Message Template
```
scripts: add build-registry that emits public/registry.json

Walks open-source-servers/*/template.json, validates via
templateManifestSchema (P2.6), and emits a deterministic
apps/web/public/registry.json plus per-slug JSON files. Supports
--strict (CI) and --only <slug>. Includes tmp-dir fixture tests.

Refs: P2.7
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.8 — 20 canonical template polish

**Phase:** 2
**Depends on:** P2.6, P2.7
**Blocks:** P2.9, P2.10, P2.14
**Estimated effort:** 12h, ~$200
**Risk level:** Medium (content-heavy, many files touched)
**Rollback complexity:** Moderate (20 template dirs modified)

### Context
The gallery needs hand-polished content to be credible at launch. This prompt selects 20 templates from `CANONICAL_50.json` (P1 output) and upgrades each with a `template.json` manifest, rewritten README targeting a 30-second quickstart, one-click deploy button, monetization math, a Loom GIF embed placeholder, and a "How to remove SettleGrid" standalone-value section. The work is scriptable for scaffolding (batch-generate boilerplate) but requires per-template manual review to ensure quality. The prompt combines scripted generation with an explicit review checklist.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/CANONICAL_50.json` (P1 artifact — read-only)
- `/Users/lex/settlegrid/CANONICAL_20.json` (to be created — the picked subset)
- `/Users/lex/settlegrid/scripts/polish-canonical.ts` (to be created — batch scaffolder)
- `/Users/lex/settlegrid/scripts/polish-canonical.test.ts` (to be created)
- `/Users/lex/settlegrid/open-source-servers/<slug>/template.json` (20 files, created)
- `/Users/lex/settlegrid/open-source-servers/<slug>/README.md` (20 files, rewritten)
- `/Users/lex/settlegrid/open-source-servers/<slug>/monetization.md` (20 files, created)
- `/Users/lex/settlegrid/open-source-servers/<slug>/remove-settlegrid.md` (20 files, created)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/CANONICAL_50.json` — candidate pool
- `/Users/lex/settlegrid/packages/mcp/src/template-schema.ts` — manifest schema constraints
- `/Users/lex/settlegrid/packages/mcp/README.md` — SDK usage patterns for monetization math
- 3 sample existing templates under `open-source-servers/` to understand current README shape and folder layout

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.6 + P2.7 audit logs PASS
- [ ] `CANONICAL_50.json` exists and parses
- [ ] `pnpm build:registry` works against a single template

### Specification
1. **Selection**: pick 20 templates from `CANONICAL_50.json` optimizing for: category diversity (at least 2 per category), language mix (≥5 TS, ≥3 Python, ≥2 JS), obvious monetization potential, repo health (tests present, recent commits). Save the picked subset to `CANONICAL_20.json` with a `selectionRationale` field per entry.

2. **Scaffolder `polish-canonical.ts`**: for each selected slug, generate:
   - `template.json` validated by `templateManifestSchema`, with deterministic defaults (category from source file, tags derived from capabilities, pricing `{ model: 'per-call', perCallUsdCents: 1 }` as sensible default).
   - `README.md` replacing any existing one with a structured template: title, one-sentence pitch, 30-second quickstart code block, `npx create-settlegrid-tool --template <slug>` command, monetization section (link to `monetization.md`), deploy button (Vercel by default), Loom placeholder, standalone-value link, license footer. Preserve any original attribution at the bottom under "Original README".
   - `monetization.md`: short file with per-call pricing math (example: 10K calls/mo × $0.01 = $100/mo revenue, minus SettleGrid fee %).
   - `remove-settlegrid.md`: step-by-step guide to remove `@settlegrid/mcp` dependency and revert the `init`/`wrap` calls. Uses plain language. Reinforces "you can leave anytime" messaging.

3. **Manual review gate**: after scripted generation, the prompt body instructs the operator to review each of the 20 templates visually and make per-template edits as needed. Provide a review checklist (below) and require operator to check off each before marking P2.8 complete.

4. **Registry rebuild**: after polish, run `pnpm build:registry --strict` and confirm all 20 templates validate. Commit the generated `apps/web/public/registry.json` and per-template JSON files.

Review checklist (enforced in DoD):
- [ ] Title and pitch are accurate to the template's real function
- [ ] 30-second quickstart actually runs (operator sanity-check)
- [ ] Deploy button URL points to a working template fork
- [ ] Monetization math is realistic, not magical
- [ ] `remove-settlegrid.md` steps are correct
- [ ] License preserved and attribution to original author intact

**Files you may touch:**
- `CANONICAL_20.json`
- `scripts/polish-canonical.ts`
- `scripts/polish-canonical.test.ts`
- `open-source-servers/<slug>/*` for exactly the 20 picked slugs
- `apps/web/public/registry.json` (regenerated)
- `apps/web/public/templates/<slug>.json` (regenerated)

**Files you MUST NOT touch:**
- Non-picked templates under `open-source-servers/`
- `CANONICAL_50.json` (read-only)
- `packages/**`
- `apps/web/src/**`

**External services touched:**
- None (Loom URLs are placeholders the operator fills later)

### Implementation Steps
1. Read `CANONICAL_50.json` and draft the selection into `CANONICAL_20.json` applying the diversity rules. Commit the file in an intermediate step with a clear message.
2. Implement `scripts/polish-canonical.ts` that consumes `CANONICAL_20.json` and generates the 4 files per template using `node:fs/promises`. Use template literals for markdown. All generated files must validate against `templateManifestSchema` where applicable.
3. Write `scripts/polish-canonical.test.ts` covering (a) manifest generation for a fake slug, (b) README structure contains required sections, (c) idempotency (running twice is a no-op).
4. Run `tsx scripts/polish-canonical.ts` to populate all 20 templates.
5. Manually review each of the 20 templates. For each, edit the generated files as needed. Tick every checkbox in the review checklist per template.
6. Run `pnpm build:registry --strict`. Must exit 0.
7. Verify `pnpm -w typecheck` and `pnpm -w test` green.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `CANONICAL_20.json` exists with 20 entries and rationale
- [ ] All 20 templates have valid `template.json`, `README.md`, `monetization.md`, `remove-settlegrid.md`
- [ ] `pnpm build:registry --strict` passes and includes all 20 in `registry.json`
- [ ] Review checklist (6 items) ticked for all 20 templates
- [ ] Script is idempotent (rerun produces zero diff)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Use `git restore` on the 20 touched template directories and on `apps/web/public/registry.json`. Delete `CANONICAL_20.json` and `scripts/polish-canonical.*`. `pnpm build:registry` to regenerate the (now empty-of-canonical) registry.

### Commit Message Template
```
templates: polish 20 canonical templates for gallery launch

Selects 20 templates from CANONICAL_50 optimizing for category and
language diversity. Adds template.json manifests, rewrites READMEs
with 30-second quickstart + deploy button + Loom placeholder, and
adds monetization.md and remove-settlegrid.md per template.
Regenerates apps/web/public/registry.json.

Refs: P2.8
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.9 — Gallery page Next.js SSG

**Phase:** 2
**Depends on:** P2.6, P2.7, P2.8
**Blocks:** P2.10, P2.14
**Estimated effort:** 8h, ~$135
**Risk level:** Low
**Rollback complexity:** Trivial (feature-flagged)

### Context
With 20 polished templates and a registry.json, we can ship a static gallery at `/templates`. This prompt creates the index page, per-template detail pages, category tabs, and tag filters — all SSG-generated at build time from `registry.json`. Search is a stubbed input wired up in P2.10. The gallery must be feature-flagged via an environment variable so we can iterate without exposing incomplete UI.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/app/templates/page.tsx` (modified — currently stub)
- `/Users/lex/settlegrid/apps/web/src/app/templates/[slug]/page.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/app/templates/layout.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/lib/registry.ts` (to be created — typed registry reader)
- `/Users/lex/settlegrid/apps/web/src/components/templates/TemplateCard.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/components/templates/CategoryTabs.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/components/templates/TagFilter.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/components/templates/DeployButton.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/env.ts` (modified — add `NEXT_PUBLIC_GALLERY_ENABLED` flag)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/apps/web/src/app/templates/page.tsx` — current stub
- `/Users/lex/settlegrid/apps/web/public/registry.json` — data source
- `/Users/lex/settlegrid/apps/web/src/app/layout.tsx` — global providers and brand styles
- Existing shadcn/ui components in `apps/web/src/components/ui/` (if any) for consistent look

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.6, P2.7, P2.8 audit logs PASS
- [ ] `apps/web/public/registry.json` contains ≥20 templates

### Specification
1. **Registry reader** `lib/registry.ts`: reads `apps/web/public/registry.json` at build time (via `fs.readFile` inside a `cache()`-wrapped function since it's server-side). Exports `getRegistry()`, `getTemplateBySlug(slug)`, `listCategories()`, `listTags(category?)`. All pure and sync-after-cache.

2. **Index page** `app/templates/page.tsx`:
   - `export const dynamic = 'force-static'`
   - `generateMetadata` returns SEO-friendly title/description referencing "SettleGrid Templates"
   - Renders: hero with total-count, `CategoryTabs`, `TagFilter`, grid of `TemplateCard`. Sorted by `trendingRank` ascending then by name.
   - If `NEXT_PUBLIC_GALLERY_ENABLED !== 'true'`, render a "Coming soon" placeholder (still SSG, no 404).
   - Includes a search input stub (non-functional; wired in P2.10).

3. **Detail page** `app/templates/[slug]/page.tsx`:
   - `generateStaticParams` returns all slugs from registry
   - `generateMetadata` returns per-template title/description + OG image placeholder
   - Renders: title, pitch, `DeployButton`, quickstart code block, monetization section (read from `monetization.md` at build time), capabilities list, tags, author link, standalone-value section (from `remove-settlegrid.md`), license.

4. **Components**:
   - `TemplateCard`: accepts a manifest, renders name, description, category badge, tags, featured badge.
   - `CategoryTabs`: receives categories with counts; uses URL search params (client component) for interactivity.
   - `TagFilter`: multi-select (client component).
   - `DeployButton`: if manifest has `deployButton`, renders a provider-specific button; else a plain "Get started" CTA.

5. **Feature flag**: `env.ts` add `NEXT_PUBLIC_GALLERY_ENABLED: z.string().optional()`. Default to `'false'`.

6. **SSG verification**: `pnpm --filter web build` must produce static HTML for `/templates` and `/templates/<slug>` for every slug. Add a build-time check that fails if registry is empty.

Tests: component-level with @testing-library/react + jsdom (unit tests for `TemplateCard`, `CategoryTabs` interactivity, `registry.ts` reader). Integration: a small Playwright-less snapshot test asserting the index page renders N cards where N = registry.templates.length.

**Files you may touch:**
- `apps/web/src/app/templates/**`
- `apps/web/src/components/templates/**`
- `apps/web/src/lib/registry.ts`
- `apps/web/src/env.ts`
- `apps/web/package.json` (only if adding @testing-library/react for the first time)

**Files you MUST NOT touch:**
- `apps/web/src/app/mcp/**` (P2.12 territory)
- `packages/**`
- `open-source-servers/**`
- `apps/web/public/registry.json` (read-only)

**External services touched:**
- None (no Meilisearch yet — that's P2.10)

### Implementation Steps
1. Read the current stub `page.tsx` and `apps/web/src/app/layout.tsx` for conventions.
2. Implement `lib/registry.ts`. Add a vitest that reads a fake registry and asserts types.
3. Implement components under `components/templates/`. Use shadcn/ui primitives if available; otherwise plain Tailwind matching brand.
4. Implement `app/templates/page.tsx` (server component) and `[slug]/page.tsx`. Wire category filter via `searchParams`.
5. Add feature flag to `env.ts` and guard rendering.
6. Write unit + snapshot tests.
7. Build web: `pnpm --filter web build`. Verify `/templates` and each `/templates/<slug>.html` emitted under `.next/server/app/templates/`.
8. Start dev server and visually inspect at `http://localhost:3005/templates` with `NEXT_PUBLIC_GALLERY_ENABLED=true`.
9. Verify `pnpm -w typecheck` and `pnpm -w test` green.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `/templates` renders all 20 templates when flag on
- [ ] `/templates/<slug>` renders per-template detail for every slug
- [ ] SSG build emits static HTML for all pages (verified via `.next/` inspection)
- [ ] Feature flag default off renders "Coming soon"
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥6 new component tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Restore stub `page.tsx`. Remove `templates/` components and `lib/registry.ts`. Remove feature flag from `env.ts`. `pnpm --filter web build` to confirm clean build.

### Commit Message Template
```
web: ship /templates gallery SSG backed by registry.json

Adds SSG index + detail pages at /templates, with category tabs, tag
filter, and deploy buttons rendered from apps/web/public/registry.json.
Behind NEXT_PUBLIC_GALLERY_ENABLED feature flag. Search input is a
stub wired up in P2.10.

Refs: P2.9
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.10 — Gallery search with Meilisearch

**Phase:** 2
**Depends on:** P2.9
**Blocks:** P2.14
**Estimated effort:** 6h, ~$100
**Risk level:** Medium (external infra dependency)
**Rollback complexity:** Moderate (infra + code)

### Context
The gallery search input is currently a stub. This prompt wires a real search backend using self-hosted Meilisearch on Fly.io ($5/mo app). We index the registry on CI whenever `registry.json` changes, and the browser queries Meilisearch directly via its public search-only API key. Facets (category, tags, language) come free from Meilisearch. Trending sort uses `trendingRank` field.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/components/templates/SearchBar.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/lib/meilisearch-client.ts` (to be created)
- `/Users/lex/settlegrid/scripts/meilisearch/fly.toml` (to be created — deploy config)
- `/Users/lex/settlegrid/scripts/meilisearch/Dockerfile` (to be created)
- `/Users/lex/settlegrid/scripts/meilisearch/index-registry.ts` (to be created)
- `/Users/lex/settlegrid/scripts/meilisearch/README.md` (to be created — ops notes)
- `/Users/lex/settlegrid/.github/workflows/index-registry.yml` (to be created)
- `/Users/lex/settlegrid/apps/web/src/env.ts` (modified — add Meilisearch URL + public key)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/apps/web/src/components/templates/` — P2.9 components to extend
- `/Users/lex/settlegrid/apps/web/src/env.ts` — env conventions
- `/Users/lex/settlegrid/apps/web/public/registry.json` — fields to index

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.9 audit log PASS
- [ ] Fly.io account exists with billing active ($5/mo); auth token available in CI as `FLY_API_TOKEN`
- [ ] Meilisearch master key generated and stored in GitHub Secrets as `MEILI_MASTER_KEY`

### Specification
1. **Fly.io deployment** (`scripts/meilisearch/`):
   - `Dockerfile` using `getmeili/meilisearch:v1.8` as base
   - `fly.toml` with 256MB RAM, 1 shared CPU, persistent volume for `/meili_data`
   - Environment: `MEILI_MASTER_KEY` from Fly secret, `MEILI_ENV=production`, `MEILI_NO_ANALYTICS=true`
   - Documented in `README.md` with `fly launch` and first-time setup steps

2. **Indexing script** `scripts/meilisearch/index-registry.ts`:
   - Reads `apps/web/public/registry.json`
   - Connects to Meilisearch using `MEILI_URL` and `MEILI_MASTER_KEY` env vars
   - Creates/updates an index `templates` with primary key `slug`
   - Configures searchable attributes (`name`, `description`, `capabilities`, `tags`), filterable attributes (`category`, `tags`, `runtime`, `languages`), sortable attributes (`trendingRank`, `name`)
   - Batches documents, waits for index update, exits 0 on success
   - Writes a summary: docs indexed, tasks completed, duration

3. **CI workflow** `.github/workflows/index-registry.yml`:
   - Triggers on push to `main` when `apps/web/public/registry.json` changes
   - Runs indexing script with secrets
   - Fails the workflow if indexing fails

4. **Client `lib/meilisearch-client.ts`**:
   - Uses `meilisearch` JS package with the public search-only key
   - Exports `searchTemplates(query, filters)` returning typed results
   - Never exposes the master key — only the search-only key is embedded in client code

5. **SearchBar component** (`components/templates/SearchBar.tsx`):
   - Client component with debounced input (200ms)
   - Shows live results dropdown with highlighted matches
   - Integrates into existing `/templates` index page alongside the category/tag filters
   - Keyboard navigation (up/down/enter/esc)

6. **Env vars** (`env.ts`):
   - `NEXT_PUBLIC_MEILI_URL` — public
   - `NEXT_PUBLIC_MEILI_SEARCH_KEY` — public search-only key
   - Validated via Zod; required when `NEXT_PUBLIC_GALLERY_ENABLED=true`

Tests: mock Meilisearch client, assert `searchTemplates` passes correct filters; Playwright-less snapshot test for SearchBar rendering. Do not call real Meilisearch in tests.

**Files you may touch:**
- `apps/web/src/components/templates/SearchBar.tsx`
- `apps/web/src/lib/meilisearch-client.ts`
- `apps/web/src/env.ts`
- `apps/web/src/app/templates/page.tsx` (only to mount SearchBar)
- `scripts/meilisearch/**`
- `.github/workflows/index-registry.yml`
- `apps/web/package.json` (add `meilisearch` dep)

**Files you MUST NOT touch:**
- `apps/web/public/registry.json` (read-only)
- `packages/**`
- `open-source-servers/**`
- Non-gallery routes

**External services touched:**
- Fly.io (new app `settlegrid-meilisearch`)
- GitHub Actions
- Meilisearch instance

### Implementation Steps
1. Provision Meilisearch on Fly.io manually using `scripts/meilisearch/`. Record the public URL in 1Password or equivalent. Generate a search-only key via the Meilisearch admin API and store it as a GitHub Secret `MEILI_SEARCH_KEY`. Store `MEILI_URL` and `MEILI_MASTER_KEY` as secrets too.
2. Implement `scripts/meilisearch/index-registry.ts`. Run it locally against the Fly instance once to seed the index.
3. Implement `.github/workflows/index-registry.yml`. Push to a feature branch and verify the workflow runs on a test change.
4. Implement `lib/meilisearch-client.ts` and `SearchBar` component. Wire into `/templates/page.tsx`.
5. Add env vars to `env.ts` with Zod validation.
6. Add tests using mocked Meilisearch client.
7. Run `pnpm --filter web build` to confirm SSG still works; Meilisearch only used client-side.
8. Verify `pnpm -w typecheck` and `pnpm -w test` green.
9. Manually test the live search on dev server pointed at the Fly instance.
10. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Meilisearch instance deployed on Fly.io and reachable
- [ ] Index `templates` populated via `index-registry.ts`
- [ ] GitHub Actions workflow green on a test PR
- [ ] SearchBar functions in dev + prod build
- [ ] Only search-only key exposed to client (grep check: master key not in bundle)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥4 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit to remove SearchBar + client code. Optionally `fly apps destroy settlegrid-meilisearch` to tear down infra (or keep it idle — $5/mo). Delete `.github/workflows/index-registry.yml`. No data loss since registry.json is the source of truth.

### Commit Message Template
```
web: add Meilisearch-backed search to gallery

Deploys Meilisearch on Fly.io, adds index-registry.ts CI job that
reindexes on registry.json changes, and ships a debounced SearchBar
on /templates with live results, facets, and keyboard nav. Only the
search-only key is exposed to the client.

Refs: P2.10
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.11 — Shadow directory: Postgres schema + crawler

**Phase:** 2
**Depends on:** P1 exit gate
**Blocks:** P2.12, P2.14
**Estimated effort:** 8h, ~$135
**Risk level:** Medium (external crawlers, data volumes)
**Rollback complexity:** Moderate (migration + seed data)

### Context
The shadow directory is 12K+ long-tail SEO pages, one per MCP server on the web, aggregated from PulseMCP, Smithery, awesome-mcp lists, GitHub, npm, and PyPI. This prompt creates the Postgres schema via Drizzle migration and implements a crawler that ingests records from all sources into `mcp_shadow_index`. The crawler runs as a script (invokable via cron, wired to Inngest in a later phase). Target: ≥1,000 rows ingested by the end of this prompt, proving scale.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/db/schema/shadow-index.ts` (to be created)
- `/Users/lex/settlegrid/apps/web/src/db/migrations/<next>_mcp_shadow_index.sql` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/index.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/pulsemcp.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/smithery.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/awesome-mcp.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/github.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/npm.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/sources/pypi.ts` (to be created)
- `/Users/lex/settlegrid/scripts/shadow-crawler/index.test.ts` (to be created)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/apps/web/src/db/schema/**` — Drizzle conventions (table naming, timestamps, indexes)
- `/Users/lex/settlegrid/apps/web/src/db/index.ts` — DB client export
- `/Users/lex/settlegrid/apps/web/drizzle.config.ts` — migration pipeline
- Any existing migration in `apps/web/src/db/migrations/` for filename conventions

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] Docker PG 5433 running locally
- [ ] `DATABASE_URL` and `DATABASE_URL_DIRECT` set in `.env.local`
- [ ] Drizzle kit installed and `pnpm drizzle-kit` works

### Specification

**Schema** (`schema/shadow-index.ts`):
```ts
export const mcpShadowIndex = pgTable('mcp_shadow_index', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(), // 'pulsemcp' | 'smithery' | 'awesome-mcp' | 'github' | 'npm' | 'pypi'
  owner: text('owner').notNull(),
  repo: text('repo').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  tags: jsonb('tags').$type<string[]>(),
  stars: integer('stars'),
  downloads: integer('downloads'),
  lastUpdated: timestamp('last_updated', { withTimezone: true }),
  sourceUrl: text('source_url'),
  settlegridAvailable: boolean('settlegrid_available').default(true).notNull(),
  indexedAt: timestamp('indexed_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqSourceOwnerRepo: unique('uniq_source_owner_repo').on(t.source, t.owner, t.repo),
  idxCategory: index('idx_mcp_shadow_category').on(t.category),
  idxLastUpdated: index('idx_mcp_shadow_last_updated').on(t.lastUpdated.desc()),
}));
```

**Migration**: generate via `pnpm drizzle-kit generate` and commit the `.sql` file. Apply locally via `pnpm drizzle-kit migrate`.

**Crawler architecture**:
- `index.ts` main entry: `pnpm shadow:crawl [--source <name>] [--limit <n>] [--dry-run]`
- Per-source module exports `fetchSource(): AsyncIterable<ShadowRecord>`
- Main loop upserts via `onConflictDoUpdate` keyed on `(source, owner, repo)`, updating non-null fields
- Rate limits: PulseMCP/Smithery respect their public API rate limits; GitHub uses `GITHUB_TOKEN`; npm/PyPI use public registry endpoints with 10 req/s cap
- All HTTP with timeouts (10s) and retry (3x exp backoff)

**Source specifics**:
- **pulsemcp**: public API at `https://www.pulsemcp.com/api/servers` (confirm actual endpoint; fall back to static JSON scrape if no API)
- **smithery**: public API `https://api.smithery.ai/servers`
- **awesome-mcp**: GitHub repo `punkpeye/awesome-mcp-servers`; fetch the README, parse markdown for entries
- **github**: search API with query `topic:model-context-protocol`; paginate
- **npm**: registry search for packages matching `@modelcontextprotocol/*` or describing "mcp server"
- **pypi**: search for packages with topic classifier or name prefix

Each source module must be independently testable with a mocked HTTP client.

**Tests**:
- Unit tests per source with mocked fetch, asserting parsing correctness
- Integration test that runs the crawler against a test Postgres instance (or mocked db) with one fixture source and asserts rows inserted
- `--dry-run` test ensures no db writes

**Runtime target**: at least 1,000 distinct records ingested when run with real credentials. Document in the commit body which sources contributed how many.

**Files you may touch:**
- `apps/web/src/db/schema/shadow-index.ts`
- `apps/web/src/db/schema/index.ts` (only to re-export)
- `apps/web/src/db/migrations/**` (generated)
- `scripts/shadow-crawler/**`
- `package.json` (root — add `shadow:crawl` script)

**Files you MUST NOT touch:**
- Other schema files in `apps/web/src/db/schema/`
- `apps/web/src/app/**`
- `packages/**`
- `open-source-servers/**`

**External services touched:**
- PulseMCP, Smithery, GitHub, npm, PyPI
- Local Postgres

### Implementation Steps
1. Read existing Drizzle schema files for conventions.
2. Create `schema/shadow-index.ts`, export from schema barrel, run `pnpm drizzle-kit generate`, commit the `.sql` migration.
3. Apply migration to local Docker PG: `pnpm drizzle-kit migrate`. Verify with `\d mcp_shadow_index`.
4. Scaffold `scripts/shadow-crawler/index.ts` main loop with args parsing and upsert logic.
5. Implement each source module one at a time. Add mocked unit tests as you go.
6. Run `tsx scripts/shadow-crawler/index.ts --limit 50 --dry-run` to sanity-check.
7. Run full crawl `tsx scripts/shadow-crawler/index.ts`. Target ≥1,000 rows. Record per-source counts.
8. Verify `pnpm -w typecheck` and `pnpm -w test` green.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Migration applied cleanly on fresh db
- [ ] `mcp_shadow_index` has ≥1,000 rows after full crawl
- [ ] Per-source unit tests pass (one per source)
- [ ] `--dry-run` writes nothing (verified by row-count assertion)
- [ ] Secondary crawl run updates existing rows without duplicates (upsert correctness)
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥8 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
`pnpm drizzle-kit migrate --to <prior>` to revert the migration. Revert the commit. Drop the `mcp_shadow_index` table if needed (manual SQL). `pnpm install`.

### Commit Message Template
```
db,scripts: add mcp_shadow_index schema + multi-source crawler

Creates Postgres table mcp_shadow_index via Drizzle migration with
unique(source, owner, repo) + category/last_updated indexes. Adds
scripts/shadow-crawler/ with per-source modules for PulseMCP,
Smithery, awesome-mcp, GitHub, npm, and PyPI. Initial crawl seeded
N rows (PulseMCP: X, Smithery: Y, ...).

Refs: P2.11
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.12 — Shadow directory: SSG pages

**Phase:** 2
**Depends on:** P2.11
**Blocks:** P2.14
**Estimated effort:** 6h, ~$100
**Risk level:** Medium (SSG scale — 1000+ pages must build cleanly)
**Rollback complexity:** Trivial

### Context
With `mcp_shadow_index` populated, we can generate one landing page per record at `/mcp/[owner]/[repo]`. Each page is SEO-optimized with accurate metadata, a canonical URL pointing to the original source, a "Monetize this with SettleGrid" CTA, and a link to run `npx settlegrid add github:<owner>/<repo>`. The page is built statically via `generateStaticParams` reading from Postgres at build time. Must build ≥1,000 pages without error to satisfy the Phase 2 exit criterion.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/app/mcp/[owner]/[repo]/page.tsx` (to be created)
- `/Users/lex/settlegrid/apps/web/src/app/mcp/page.tsx` (to be created — index overview)
- `/Users/lex/settlegrid/apps/web/src/lib/shadow-index.ts` (to be created — typed reader)
- `/Users/lex/settlegrid/apps/web/src/app/sitemap.ts` (modified — add shadow URLs)
- `/Users/lex/settlegrid/apps/web/next.config.ts` (modified — verify ISR/SSG settings)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/apps/web/src/db/schema/shadow-index.ts` (P2.11)
- `/Users/lex/settlegrid/apps/web/src/db/index.ts` — DB client
- `/Users/lex/settlegrid/apps/web/src/app/layout.tsx` — global styles
- Existing `sitemap.ts` if present — extend it

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.11 audit log PASS
- [ ] `mcp_shadow_index` has ≥1,000 rows locally

### Specification

**Reader** `lib/shadow-index.ts`:
- `getAllShadowEntries()`: server-only, queries all rows ordered by stars desc
- `getShadowEntry(owner, repo)`: fetches a single row
- `listOwners()`: distinct owners for nav
- Uses the existing Drizzle client; no connection pooling tricks beyond the default

**Dynamic route** `app/mcp/[owner]/[repo]/page.tsx`:
- `export const dynamic = 'force-static'`
- `export const dynamicParams = false` — only prebuild what we know about
- `generateStaticParams` returns all `{ owner, repo }` pairs from `getAllShadowEntries()` capped at a configurable limit (`SHADOW_BUILD_LIMIT` env, default 2000)
- `generateMetadata` per-entry: title `"<name> — Monetize with SettleGrid"`, description from entry, canonical `sourceUrl`, OpenGraph + Twitter cards
- Renders: header with name + owner/repo link, description, tag chips, star/download counts, "Monetize this with SettleGrid" CTA block with the `npx settlegrid add github:<owner>/<repo>` command, "Why this works" 3-bullet explainer, link to the equivalent polished template if one exists (join on slug or capability match), footer with "Source: <source>" attribution

**Index page** `app/mcp/page.tsx`:
- Category/owner navigation
- Top 50 by stars
- Link to full gallery search

**Sitemap**: update or create `sitemap.ts` to include all shadow URLs (paginated if needed; Next.js supports sitemap index).

**Build safety**:
- If `SHADOW_BUILD_LIMIT` is unset, default 2000 to keep CI fast; production builds can raise it via env
- If the query returns 0 rows (fresh clone, empty db), emit a warning and generate a single placeholder page so the build doesn't fail
- SSG build must complete within Vercel's 45-minute function build timeout

**Canonical URL + noindex rules**:
- If `settlegridAvailable === false`, render `<meta name="robots" content="noindex">` on that page
- Canonical link always points to `sourceUrl`
- Structured data: `SoftwareApplication` JSON-LD

Tests: unit tests for the reader using a test db; snapshot test for a single shadow page using a fixture row; build-time check (vitest) asserting `generateStaticParams` dedupes.

**Files you may touch:**
- `apps/web/src/app/mcp/**`
- `apps/web/src/lib/shadow-index.ts`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/env.ts` (add `SHADOW_BUILD_LIMIT`)
- `apps/web/next.config.ts` (only for ISR/SSG tuning)

**Files you MUST NOT touch:**
- `apps/web/src/app/templates/**` (P2.9 territory)
- `packages/**`
- `open-source-servers/**`
- `apps/web/src/db/schema/**`

**External services touched:**
- Local Postgres (read-only)

### Implementation Steps
1. Read P2.11 schema and confirm query shapes.
2. Implement `lib/shadow-index.ts` with typed readers. Unit-test with a Drizzle-mock or against local Postgres.
3. Implement `app/mcp/[owner]/[repo]/page.tsx`. Keep the server component minimal and well-typed.
4. Implement `app/mcp/page.tsx` index overview.
5. Update `sitemap.ts`.
6. Run `pnpm --filter web build` with `SHADOW_BUILD_LIMIT=1000`. Confirm ≥1,000 pages emitted under `.next/server/app/mcp/`. Measure build time and record it.
7. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `pnpm --filter web build` emits ≥1,000 static shadow pages
- [ ] Build completes under 45 minutes locally
- [ ] Canonical URL on each page points to the source
- [ ] `noindex` applied when `settlegridAvailable=false`
- [ ] Sitemap lists all shadow URLs
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥6 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `apps/web/src/app/mcp/` and `lib/shadow-index.ts`. Remove `SHADOW_BUILD_LIMIT` from `env.ts`. Rebuild.

### Commit Message Template
```
web: ship /mcp/[owner]/[repo] shadow directory SSG

Generates one static landing page per mcp_shadow_index row with
per-entry metadata, canonical URL to source, JSON-LD, and a
"Monetize with SettleGrid" CTA. Build seeds ≥1,000 pages from local
crawl. Updates sitemap. noindex applied when settlegridAvailable
is false.

Refs: P2.12
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.13 — Quality gate CI workflow for templates

**Phase:** 2
**Depends on:** P2.6, P2.7, P2.8
**Blocks:** P2.14
**Estimated effort:** 4h, ~$70
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Templates must stay healthy as the gallery grows. This prompt adds a GitHub Actions workflow that runs `quality-gates.ts` (a Phase 1 artifact) on every PR touching `open-source-servers/**` or `packages/create-settlegrid-tool/templates/**`. The workflow blocks merges when gates fail. We also wire registry validation + schema round-trip to the same workflow.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/.github/workflows/template-quality.yml` (to be created)
- `/Users/lex/settlegrid/scripts/quality-gates.ts` (P1 artifact — verify exists)
- `/Users/lex/settlegrid/scripts/quality-gates.test.ts` (modified — add registry round-trip test)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/scripts/quality-gates.ts` — understand current signature and exit codes
- Any existing `.github/workflows/*.yml` — convention (cache keys, Node version, pnpm version)
- `/Users/lex/settlegrid/packages/mcp/src/template-schema.ts` — schema used in validation

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS, including quality-gates.ts
- [ ] P2.6, P2.7, P2.8 audit logs PASS
- [ ] `.github/workflows/` directory exists (create if not)

### Specification

**Workflow** `.github/workflows/template-quality.yml`:
- Triggers: `pull_request` with `paths` filter on `open-source-servers/**`, `packages/create-settlegrid-tool/templates/**`, `scripts/build-registry.ts`, and `packages/mcp/src/template-schema.ts`
- Concurrency: cancel in-progress runs on same PR
- Jobs:
  1. `validate-manifests`: checkout, setup pnpm, install, run `pnpm build:registry --strict` — fails if any template.json invalid
  2. `run-quality-gates`: checkout, setup, install, run `tsx scripts/quality-gates.ts --only-changed` — only runs gates on templates actually modified in the PR
  3. `schema-roundtrip`: confirms `packages/mcp/schemas/template.schema.json` in the PR matches what `zod-to-json-schema` produces; fails if out-of-date
- All jobs run on `ubuntu-latest` with Node 20 and pnpm 9
- Caches `~/.pnpm-store` keyed on `pnpm-lock.yaml`
- Posts a PR status check named `templates / quality-gate`

**quality-gates.ts changes**:
- Add `--only-changed` flag that uses `git diff --name-only origin/main...HEAD` to determine which templates to run
- If no templates changed, exit 0
- Emit a machine-readable summary at the end

**Tests**:
- Unit test for `--only-changed` logic using a fake git diff fixture
- Dry run workflow locally with `act` (optional — document in README)

**Files you may touch:**
- `.github/workflows/template-quality.yml`
- `scripts/quality-gates.ts`
- `scripts/quality-gates.test.ts`

**Files you MUST NOT touch:**
- Any other workflow file
- `packages/**` source
- Template contents
- `apps/web/**`

**External services touched:**
- GitHub Actions

### Implementation Steps
1. Read `scripts/quality-gates.ts` and existing workflows.
2. Add `--only-changed` flag handling to `quality-gates.ts`. Ensure git operations are safe in detached-HEAD CI environment (fall back to `origin/main` fetch if needed).
3. Write unit tests for the flag.
4. Create `.github/workflows/template-quality.yml` per spec.
5. Push to a test branch, open a PR that touches one template, confirm the workflow runs and all jobs pass.
6. Push a deliberately invalid change (bad template.json), confirm the workflow fails with a useful message. Revert the bad change.
7. Verify `pnpm -w typecheck` and `pnpm -w test` green.
8. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] Workflow exists and is triggered by template changes
- [ ] Green run on a PR that modifies one canonical template
- [ ] Red run (then reverted) on a deliberately invalid manifest
- [ ] `quality-gates.ts --only-changed` unit-tested
- [ ] Schema round-trip job catches out-of-date JSON Schema
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥3 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Delete `.github/workflows/template-quality.yml`. Revert the `--only-changed` additions to `quality-gates.ts`. `pnpm install`.

### Commit Message Template
```
ci: add template quality gate workflow

Adds .github/workflows/template-quality.yml that runs on PRs touching
open-source-servers/**, templates/**, or the template schema. Runs
three jobs: validate-manifests (build:registry --strict),
run-quality-gates (--only-changed), and schema-roundtrip. Adds
--only-changed flag to quality-gates.ts.

Refs: P2.13
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P2.14 — Phase 2 audit gate

**Phase:** 2
**Depends on:** P2.1 - P2.13 (all)
**Blocks:** Phase 3
**Estimated effort:** 4h, ~$70
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
The Phase 2 exit gate runs an end-to-end verification that every Phase 2 exit criterion is satisfied. This prompt produces a gate script + audit report that can be rerun idempotently. Until this gate PASSES, no Phase 3 work begins.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/phase-gates/phase-2.ts` (to be created)
- `/Users/lex/settlegrid/scripts/phase-gates/phase-2.test.ts` (to be created)
- `/Users/lex/settlegrid/AUDIT_LOG.md` (modified — append Phase 2 entries)

**Relevant existing code to read first:**
- Phase 1 gate script if any (under `scripts/phase-gates/`) — mirror its structure
- `AUDIT_LOG.md` — Phase 1 entries for format

**Prerequisites to verify:**
- [ ] Phase 1 audit log confirms all P1 prompts PASS
- [ ] P2.1 - P2.13 all have individual audit chain PASSES recorded

### Specification

**Gate script** `scripts/phase-gates/phase-2.ts` runs these checks in order and exits 1 on any failure:

1. **CLI installable**: spawn `node packages/settlegrid-cli/dist/index.js --version` and assert stdout matches semver; then `pnpm --filter @settlegrid/cli smoke` exits 0 (3 real repos pass).
2. **Registry present**: `apps/web/public/registry.json` exists, parses, schema-validates via P2.6 validator, contains ≥20 templates.
3. **Canonical templates polished**: for each slug in `CANONICAL_20.json`, verify `open-source-servers/<slug>/template.json`, `README.md`, `monetization.md`, `remove-settlegrid.md` exist and template.json validates.
4. **Shadow directory populated**: query `mcp_shadow_index` and assert row count ≥ 1000.
5. **SSG build passes**: run `pnpm --filter web build` with `NEXT_PUBLIC_GALLERY_ENABLED=true` and `SHADOW_BUILD_LIMIT=1000`; confirm (a) `/templates/index.html` exists, (b) each of the 20 canonical slugs has `/templates/<slug>.html`, (c) at least 1000 `/mcp/<owner>/<repo>.html` files emitted.
6. **Quality gate workflow green on main**: use `gh` CLI to fetch the latest `template-quality` workflow run on main and assert conclusion `success`.
7. **Meilisearch reachable**: HTTP GET against `NEXT_PUBLIC_MEILI_URL/health` returns 200 and responseBody.status === 'available'.
8. **Typecheck + tests green**: run `pnpm -w typecheck` and `pnpm -w test`.

Each check emits a line `✔ <name>` or `✖ <name>: <reason>`. Script writes a verdict block to `AUDIT_LOG.md` under a new `## Phase 2 Gate — <ISO timestamp>` section.

Test: unit test with mocked check functions asserting aggregate exit code behavior (any failure => exit 1).

**Files you may touch:**
- `scripts/phase-gates/phase-2.ts`
- `scripts/phase-gates/phase-2.test.ts`
- `AUDIT_LOG.md` (append only)
- `package.json` (root — add `gate:phase-2` script)

**Files you MUST NOT touch:**
- Any P2.1-P2.13 artifacts
- `packages/**`
- `apps/web/**`
- `open-source-servers/**`
- Phase 1 gate scripts

**External services touched:**
- Local Postgres (read-only)
- GitHub API (workflow status via `gh`)
- Meilisearch /health

### Implementation Steps
1. Read Phase 1 gate structure (if present) to mirror conventions.
2. Implement `phase-2.ts` with each check as a small async function returning `{ name, passed, details }`.
3. Implement aggregation + AUDIT_LOG append + exit code logic.
4. Write unit tests with mocked checks.
5. Add `gate:phase-2` script to root package.json.
6. Run `pnpm gate:phase-2`. If any check fails, fix the underlying prompt's gap before proceeding.
7. Once green, append the verdict block to `AUDIT_LOG.md` and commit.
8. Verify `pnpm -w typecheck` and `pnpm -w test` green.
9. Run {{AUDIT_CHAIN_TEMPLATE}}.

### Definition of Done
- [ ] `pnpm gate:phase-2` exits 0
- [ ] All 8 checks pass with clear output
- [ ] `AUDIT_LOG.md` has a new Phase 2 Gate section with the timestamp and per-check results
- [ ] Unit tests pass for aggregation logic
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test` passes, ≥4 new tests added
- [ ] Smoke test output matches spec
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
Revert the commit. Delete `scripts/phase-gates/phase-2.*`. Remove the Phase 2 section from `AUDIT_LOG.md`. Remove `gate:phase-2` script.

### Commit Message Template
```
gate: Phase 2 audit gate passes all 8 checks

Runs CLI smoke, registry validation, canonical templates presence,
shadow index row count, SSG build page count, template-quality
workflow status, Meilisearch health, and workspace typecheck/tests.
Records verdict block in AUDIT_LOG.md. Unblocks Phase 3.

Refs: P2.14
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

{{SHARED_CONTEXT}}
