# Phase 1 — Foundation (Weeks 1-2)

*Generated as part of SettleGrid Quantum Leap Master Plan (MP-QL-001)*

---

# SettleGrid Quantum Leap — Phase 1 Execution Prompts (Weeks 1-2: Foundation)

## Phase 1 Summary

**Phase goal:** Stand up the Templater agent (4th autonomous agent) alongside the shared quality-gate infrastructure, publish the first community-facing artifacts (Anthropic Skill, Cursor rule, MCP SEP draft), and select the CANONICAL_50 template seed from the existing 1,022 open-source-servers. At the end of Phase 1 the platform has a self-service monetization Skill published, a compiled Templater agent ready to produce new MCP servers on a cron, and a community-review-ready SEP for native payment capability in the MCP protocol.

**Prompt sequence overview:**

- **P1.1** — Templater agent scaffold (index.ts, graph.ts, prompts.ts, stub tools.ts, stub tests)
- **P1.2** — Templater tools + Claude spec→server pipeline
- **P1.3** — Templater vitest suite (≥57 tests)
- **P1.4** — Shared quality-gates module (`agents/shared/quality-gates.ts`)
- **P1.5** — Orchestrator registration + end-to-end dry run
- **P1.6** — CANONICAL_50 audit of 1,022 open-source-servers
- **P1.7** — `@settlegrid/skill` package scaffold (SKILL.md + examples dir)
- **P1.8** — Skill content: `monetize-this-mcp` body
- **P1.9** — Cursor rule variant of the Skill
- **P1.10** — MCP SEP draft for `experimental/payment` capability
- **P1.11** — Codemod framework foundation (jscodeshift + SDK bump codemod)
- **P1.12** — Phase 1 audit gate + Phase 1 completion commit

**Expected artifacts at end of phase:**

- `/Users/lex/settlegrid-agents/agents/templater/{index.ts,graph.ts,tools.ts,prompts.ts,__tests__/templater.test.ts}`
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts` + tests
- Updated `/Users/lex/settlegrid-agents/orchestrator/scheduler.ts` with `templater` registered
- `/Users/lex/settlegrid/docs/audit-failures/.gitkeep` (tracked dir)
- `/Users/lex/settlegrid/scripts/audit/canonical-50.mjs` + `/Users/lex/settlegrid/CANONICAL_50.json`
- `/Users/lex/settlegrid/packages/settlegrid-skill/{package.json,SKILL.md,examples/,cursor/.cursorrules}`
- `/Users/lex/settlegrid/docs/seps/experimental-payment-draft.md`
- `/Users/lex/settlegrid/scripts/codemods/{README.md,sdk-version-bump.js,__tests__/}`

**Phase 1 estimates:** ~52-68 founder hours. API cost ~$45 (Templater dry run + CANONICAL_50 audit Claude calls + 3 audit chains × 12 prompts @ ~$0.30 each).

---

## P1.1 — Templater agent scaffold

**Phase:** 1
**Depends on:** none
**Blocks:** P1.2, P1.3, P1.5
**Estimated effort:** 5 founder hours, ~$1 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

SettleGrid already has three LangGraph-based agents (beacon, protocol, indexer) in `/Users/lex/settlegrid-agents/agents/`, each following a strict five-file pattern. The Quantum Leap plan adds a fourth agent, "templater," whose job is to generate new MCP server templates from third-party API documentation and feed them into `/Users/lex/settlegrid/open-source-servers/`. This prompt builds the skeleton files only — compiling, importable, testable — with stubbed LLM behavior so that P1.2 can slot real tools in without refactoring the shell. We are matching the existing pattern exactly so the orchestrator's `resolveAgentScript` path-switch works without surprises.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/templater/index.ts` (create)
- `/Users/lex/settlegrid-agents/agents/templater/graph.ts` (create)
- `/Users/lex/settlegrid-agents/agents/templater/tools.ts` (create, stub)
- `/Users/lex/settlegrid-agents/agents/templater/prompts.ts` (create)
- `/Users/lex/settlegrid-agents/agents/templater/__tests__/templater.test.ts` (create, skeleton)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid-agents/agents/beacon/index.ts` — CLI entry pattern, `require.main === module` gate, `BEACON_SCHEDULE` export
- `/Users/lex/settlegrid-agents/agents/beacon/graph.ts` — LangGraph state shape, error accumulation pattern
- `/Users/lex/settlegrid-agents/agents/protocol/index.ts` and `indexer/index.ts` — confirm schedule export naming
- `/Users/lex/settlegrid-agents/agents/shared/observability.ts` — `traceAgent` signature
- `/Users/lex/settlegrid-agents/agents/shared/memory.ts` — `updateAgentState` signature

**Prerequisites to verify:**
- [ ] `pnpm -C /Users/lex/settlegrid-agents install` succeeds
- [ ] `pnpm -C /Users/lex/settlegrid-agents typecheck` passes on main before you start
- [ ] No pre-existing `agents/templater/` directory

### Specification

Create a compile-clean Templater agent scaffold exporting `TEMPLATER_SCHEDULE` and a `runTemplaterGraph(command)` function that returns `Promise<TemplaterState>`.

State shape:

```ts
export interface TemplaterState {
  command: 'generate' | 'audit' | 'full-cycle';
  sourceSpec: { apiName: string; docUrl: string } | null;
  generatedTemplate: { slug: string; files: Record<string, string> } | null;
  qualityReport: { tscPass: boolean; testsPass: boolean; smokePass: boolean } | null;
  hitlRequestId: string | null;
  report: string | null;
  errors: string[];
}
```

Schedule:

```ts
export const TEMPLATER_SCHEDULE = {
  generate: { interval: '0 3 * * 2,4' }, // 3 AM Tue/Thu
  audit:    { interval: '0 9 * * 6' },   // 9 AM Saturday
};
```

`index.ts` must match beacon's pattern verbatim (command parse, traceAgent wrap, updateAgentState, require.main gate, process.exit on error). `graph.ts` must import from `./tools.js` and `./prompts.js`. `tools.ts` exports four stubbed functions (`fetchApiDocs`, `synthesizeTemplate`, `runQualityGates`, `submitForReview`) that all `throw new Error('NOT_IMPLEMENTED — see P1.2')`. `prompts.ts` exports `TEMPLATER_SYSTEM_PROMPT` (empty template) and `TEMPLATE_GENERATION_EXAMPLES` (empty array).

Test file must contain exactly three smoke tests: (1) `runTemplaterGraph('generate')` resolves and returns state with `errors.length > 0` (because tools throw), (2) `TEMPLATER_SCHEDULE` has two entries with valid cron expressions, (3) importing index.ts does not execute main.

**Files you may touch:**
- `/Users/lex/settlegrid-agents/agents/templater/**`

**Files you MUST NOT touch:**
- Any existing `agents/beacon/**`, `agents/protocol/**`, `agents/indexer/**`, `agents/shared/**`
- `orchestrator/scheduler.ts` (P1.5 handles this)
- `package.json` (no new deps this prompt)

**External services touched:** none (all stubbed)

### Implementation Steps

1. Read beacon/index.ts, beacon/graph.ts, beacon/prompts.ts in full.
2. Create `agents/templater/prompts.ts` with the two empty exports.
3. Create `agents/templater/tools.ts` with four throwing stubs and their TypeScript signatures.
4. Create `agents/templater/graph.ts` with `TemplaterState` interface and `runTemplaterGraph` wired to swallow the stub errors into `state.errors`.
5. Create `agents/templater/index.ts` mirroring beacon/index.ts exactly, only renaming identifiers.
6. Create `agents/templater/__tests__/templater.test.ts` with the three smoke tests.
7. Run `pnpm -C /Users/lex/settlegrid-agents typecheck` and `pnpm -C /Users/lex/settlegrid-agents vitest run agents/templater`.
8. Run the audit chain.

### Definition of Done

- [ ] All five files exist and compile
- [ ] `pnpm -C /Users/lex/settlegrid-agents typecheck` passes
- [ ] `pnpm -C /Users/lex/settlegrid-agents vitest run agents/templater` passes (3 tests)
- [ ] `TEMPLATER_SCHEDULE` is exported and importable from orchestrator path
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf /Users/lex/settlegrid-agents/agents/templater && git status` — no other files were touched, so no other cleanup needed. The orchestrator still has no reference to templater at this stage.

### Commit Message Template

```
templater: scaffold agent skeleton matching beacon pattern

Create five-file LangGraph shell (index/graph/tools/prompts/tests) with
stubbed tool functions and three smoke tests. Exports TEMPLATER_SCHEDULE
but is not yet registered with the orchestrator.

Refs: P1.1
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.2 — Templater tools + Claude spec-to-server pipeline

**Phase:** 1
**Depends on:** P1.1
**Blocks:** P1.3, P1.5
**Estimated effort:** 8 founder hours, ~$6 API cost
**Risk level:** Medium
**Rollback complexity:** Moderate

### Context

With the scaffold in place, this prompt replaces the four throwing stubs in `agents/templater/tools.ts` with real implementations that read an API documentation URL, synthesize a template spec, generate the on-disk file tree, and invoke the quality gates. The output must be byte-compatible with the 1,022 existing templates in `/Users/lex/settlegrid/open-source-servers/` so the discovery crawler, SDK middleware, and `create-settlegrid-tool` scaffolder don't need any changes. We reuse `scripts/gen/core.mjs` as the generator — this tool only produces the spec input for that generator, it does not reinvent file layout.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/templater/tools.ts` (replace stubs)
- `/Users/lex/settlegrid-agents/agents/templater/prompts.ts` (add real prompt content)
- `/Users/lex/settlegrid-agents/agents/templater/graph.ts` (wire real tools)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/scripts/gen/core.mjs` — understand the spec object shape the generator expects
- `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/{package.json,src/server.ts}` — confirm output shape
- `/Users/lex/settlegrid-agents/agents/beacon/tools.ts` — pattern for Anthropic + Exa + Firecrawl wrappers
- `/Users/lex/settlegrid-agents/agents/shared/guardrails.ts` — `sanitizeForExternal` and `checkContentQuality` for LLM output

**Prerequisites to verify:**
- [ ] P1.1 is merged
- [ ] `ANTHROPIC_API_KEY`, `EXA_API_KEY`, `FIRECRAWL_API_KEY` present in `.env`
- [ ] `scripts/gen/core.mjs` exposes an importable generator function (if it only has a CLI, wrap it in P1.2)

### Specification

Implement four tool functions in `agents/templater/tools.ts`:

1. `fetchApiDocs(docUrl: string): Promise<{ markdown: string; endpoints: EndpointInfo[] }>` — uses Firecrawl to scrape the URL, then uses Claude Sonnet to extract a structured endpoint list. Zod-validate the Claude output.
2. `synthesizeTemplate(apiName: string, docs: ApiDocs): Promise<TemplateSpec>` — uses Claude Sonnet with `TEMPLATER_SYSTEM_PROMPT` to produce a TemplateSpec (slug, description, categories, tools, envVars, baseUrl, auth). Zod-validate.
3. `generateTemplateFiles(spec: TemplateSpec): Promise<Record<string, string>>` — imports the generator from `scripts/gen/core.mjs` (node-resolve via `createRequire`), calls it with an in-memory output adapter so files are returned in a map rather than written to disk.
4. `submitForReview(state: TemplaterState): Promise<{ hitlRequestId: string }>` — calls `getHITLManager().requestApproval(...)` Tier 2 (the agent is generating code that will be published).

Update `graph.ts` to call these in order: fetchApiDocs → synthesizeTemplate → generateTemplateFiles → runQualityGates (imported from the stub introduced by P1.4, OR inline for this prompt as a no-op that sets all three flags true with a TODO) → submitForReview. On error, push to `state.errors` and stop the pipeline.

Prompts:
- `TEMPLATER_SYSTEM_PROMPT` — a 400-600 word system prompt telling Claude it generates MCP server specs, enforces the required fields, and MUST reject APIs that don't have clear rate limits or auth documentation.
- `TEMPLATE_GENERATION_EXAMPLES` — exactly two few-shot examples (one REST API, one GraphQL API) with input docs → output TemplateSpec.

**Files you may touch:**
- `/Users/lex/settlegrid-agents/agents/templater/tools.ts`
- `/Users/lex/settlegrid-agents/agents/templater/graph.ts`
- `/Users/lex/settlegrid-agents/agents/templater/prompts.ts`
- `/Users/lex/settlegrid/scripts/gen/core.mjs` — only if you need to add an `export function generateFromSpec(spec)` wrapper; do not change existing behavior

**Files you MUST NOT touch:**
- Any file in `/Users/lex/settlegrid/open-source-servers/` (this prompt generates in-memory only)
- `orchestrator/scheduler.ts`
- `agents/shared/` (use as-is)

**External services touched:** Anthropic (Claude Sonnet), Exa (optional), Firecrawl, Langfuse via `traceToolCall`

### Implementation Steps

1. Inspect `scripts/gen/core.mjs`. If it is CLI-only, append a named export `generateFromSpec(spec, { writeFile })` that delegates to the existing logic with an injectable write function, leaving the default behavior unchanged.
2. Implement `fetchApiDocs` — Firecrawl scrape → Claude extraction → Zod validate.
3. Implement `synthesizeTemplate` — Claude call with system prompt + few-shots → Zod validate. Pass through `sanitizeForExternal`.
4. Implement `generateTemplateFiles` using `createRequire` to import the mjs generator, supplying an in-memory write adapter.
5. Implement `submitForReview` using `getHITLManager()` at Tier 2.
6. Wire graph.ts to call tools in sequence; accumulate errors.
7. Dry run against the Cat Facts API (`https://catfact.ninja`) with env var `TEMPLATER_DRY_RUN=1` so submitForReview is skipped.
8. Run the audit chain.

### Definition of Done

- [ ] `pnpm -C /Users/lex/settlegrid-agents typecheck` passes
- [ ] Dry run against Cat Facts API produces a valid TemplateSpec and ≥5 file entries including `package.json`, `src/server.ts`, `Dockerfile`, `vercel.json`, `README.md`
- [ ] All four tools emit Langfuse traces
- [ ] Zod validation fires on malformed Claude output (unit-forced in tests in P1.3)
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`git restore agents/templater/tools.ts agents/templater/graph.ts agents/templater/prompts.ts scripts/gen/core.mjs` — scaffold from P1.1 will remain intact.

### Commit Message Template

```
templater: implement API-docs-to-MCP-server pipeline

Replace stubbed tools with Firecrawl scrape, Claude Sonnet
synthesis, Zod-validated TemplateSpec, and in-memory generator
adapter over scripts/gen/core.mjs. HITL Tier 2 submission for
every generation. Dry run verified against catfact.ninja.

Refs: P1.2
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.3 — Templater vitest suite (≥57 tests)

**Phase:** 1
**Depends on:** P1.2
**Blocks:** P1.5, P1.12
**Estimated effort:** 6 founder hours, ~$0 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

The existing agents carry 57-400 tests each. Templater must clear the 57 minimum and exercise every branch introduced in P1.1 and P1.2. All external services (Anthropic, Firecrawl, Exa, filesystem writes, HITL) must be mocked — zero network I/O during `vitest run`. This prompt also establishes the mock fixtures that P1.5 (scheduler registration) and P1.12 (phase gate) will reuse.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/templater/__tests__/templater.test.ts` (expand)
- `/Users/lex/settlegrid-agents/agents/templater/__tests__/fixtures/` (create)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid-agents/agents/beacon/__tests__/beacon.test.ts` — mocking patterns for Anthropic, Exa, Firecrawl
- `/Users/lex/settlegrid-agents/vitest.config.ts` — globals and setup
- `/Users/lex/settlegrid-agents/agents/shared/__tests__/` — shared test utilities

**Prerequisites to verify:**
- [ ] P1.2 merged
- [ ] Vitest currently green on main
- [ ] `vi.mock('@anthropic-ai/sdk', ...)` pattern works in existing beacon tests

### Specification

Write at least **57** vitest tests grouped as follows (exact counts may vary, but total ≥ 57):

- `describe('TEMPLATER_SCHEDULE')` — 3 tests (both entries present, valid cron, intervals non-overlapping)
- `describe('fetchApiDocs')` — 10 tests (happy path, 404, Firecrawl timeout, malformed markdown, zero endpoints extracted, Claude returns invalid JSON, Zod failure, rate-limit retry, langfuse trace emitted, guardrails applied)
- `describe('synthesizeTemplate')` — 12 tests (happy path REST, happy path GraphQL, missing auth rejected, missing rate-limits rejected, slug collision with existing open-source-servers, Claude hallucination detected, too-many-tools > 50 rejected, prompt includes few-shots, zod schema enforced, sanitizeForExternal applied, token limit respected, error propagates to state.errors)
- `describe('generateTemplateFiles')` — 8 tests (in-memory writer captures files, required files present, package.json has correct name, Dockerfile has PORT envvar, vercel.json has rewrites, README has SDK install snippet, spec with no tools returns early, generator import resolves)
- `describe('submitForReview')` — 6 tests (HITL Tier 2 called, request payload has slug + file list, dry-run flag skips HITL, error is caught, hitlRequestId persisted, approval timeout surfaced)
- `describe('runTemplaterGraph')` — 12 tests (full happy path, each tool failure short-circuits, errors accumulate, state immutability, command=generate only runs generate nodes, command=audit only runs audit node, command=full-cycle runs both, report string non-empty on success, report mentions slug, zero network calls with mocks, traceAgent wrap preserved, returns promise)
- `describe('fixtures')` — 6 tests for shape guarantees on fixture files

Add `fixtures/cat-facts-docs.md`, `fixtures/cat-facts-spec.json`, `fixtures/stripe-docs.md`, `fixtures/stripe-spec.json` for the deterministic tests. Tests must run in under 10 seconds total. Use `vi.mock` module-level to replace Anthropic/Firecrawl. HITL manager mock must match the shared interface.

**Files you may touch:**
- `/Users/lex/settlegrid-agents/agents/templater/__tests__/**`

**Files you MUST NOT touch:**
- `agents/templater/index.ts`, `graph.ts`, `tools.ts`, `prompts.ts` (frozen after P1.2 unless a genuine defect is found — if so, document in commit body)
- `agents/shared/**`
- Anything under `/Users/lex/settlegrid/`

**External services touched:** none (all mocked)

### Implementation Steps

1. Study beacon test mocks for Anthropic and Firecrawl patterns.
2. Create `fixtures/` directory with the four fixture files.
3. Write the `TEMPLATER_SCHEDULE` tests first (confirms module import side-effects are clean).
4. Write `fetchApiDocs` tests with `vi.mocked(FirecrawlApp.prototype.scrapeUrl)`.
5. Write `synthesizeTemplate` tests with `vi.mocked(Anthropic.prototype.messages.create)` returning fixture text.
6. Write `generateTemplateFiles` tests using a real core.mjs import but with a fake write adapter.
7. Write `submitForReview` tests mocking `getHITLManager`.
8. Write `runTemplaterGraph` orchestration tests that compose mocks.
9. Run `pnpm -C /Users/lex/settlegrid-agents vitest run agents/templater --reporter=verbose` and confirm ≥57 tests.
10. Run the audit chain.

### Definition of Done

- [ ] `vitest run agents/templater` shows ≥ 57 tests, 0 failures, 0 skips
- [ ] Test suite completes in < 10s
- [ ] Zero outbound network calls (verified by `nock.disableNetConnect()` helper or equivalent)
- [ ] `pnpm -C /Users/lex/settlegrid-agents typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf agents/templater/__tests__/fixtures agents/templater/__tests__/templater.test.ts && git checkout agents/templater/__tests__/templater.test.ts` — restores the three-test skeleton from P1.1.

### Commit Message Template

```
templater: add 57+ vitest suite with fixtures

Mock Anthropic, Firecrawl, HITL and filesystem. Four fixture
API docs (REST + GraphQL variants) exercise happy path and
branching error modes. Zero network I/O; < 10s runtime.

Refs: P1.3
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.4 — Shared quality-gates infrastructure

**Phase:** 1
**Depends on:** none (parallelizable with P1.1/P1.2/P1.3)
**Blocks:** P1.5, P1.6, P1.12
**Estimated effort:** 6 founder hours, ~$0 API cost
**Risk level:** Medium
**Rollback complexity:** Moderate

### Context

Every generated template and every existing template needs to pass the same quality bar before it can be published to the gallery or be returned by the discovery server. This prompt introduces `agents/shared/quality-gates.ts` — a pure TypeScript module that accepts an in-memory file tree (or directory path) and runs three gates: (1) typescript compile gate via a programmatic tsc invocation, (2) smoke scaffold gate that runs `create-settlegrid-tool` against the output and asserts the server boots on a free port, (3) security lint gate that greps for unsafe patterns (`child_process.exec` with user input, unpinned deps, `rm -rf` in Dockerfile). The module is consumed by Templater (P1.2→P1.5 wire-up) and by the CANONICAL_50 audit script (P1.6).

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts` (create)
- `/Users/lex/settlegrid-agents/agents/shared/__tests__/quality-gates.test.ts` (create)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid-agents/agents/shared/guardrails.ts` — existing shared module style
- `/Users/lex/settlegrid/packages/mcp/src/` — SDK middleware for reference to what a passing smoke boot looks like
- `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/src/server.ts` — canonical passing template

**Prerequisites to verify:**
- [ ] `typescript` installed as devDependency in settlegrid-agents
- [ ] `get-port` or equivalent installed (add if missing)

### Specification

Export the following from `agents/shared/quality-gates.ts`:

```ts
export interface QualityGateInput {
  slug: string;
  files: Record<string, string>; // path -> content, relative to template root
  sourcePath?: string;             // optional: if files live on disk already
}

export interface QualityGateResult {
  slug: string;
  tscPass: boolean;
  tscErrors: string[];
  smokePass: boolean;
  smokeOutput: string;
  securityPass: boolean;
  securityFindings: Array<{ file: string; line: number; rule: string; snippet: string }>;
  overallPass: boolean;
  durationMs: number;
}

export async function runQualityGates(input: QualityGateInput, opts?: { skipSmoke?: boolean; timeoutMs?: number }): Promise<QualityGateResult>;
export async function runTscGate(files: Record<string, string>): Promise<{ pass: boolean; errors: string[] }>;
export async function runSmokeGate(slug: string, files: Record<string, string>, timeoutMs: number): Promise<{ pass: boolean; output: string }>;
export async function runSecurityGate(files: Record<string, string>): Promise<{ pass: boolean; findings: QualityGateResult['securityFindings'] }>;
```

The tsc gate uses `ts.createProgram` against an in-memory `CompilerHost` (no tmpdir write). The smoke gate writes files to `os.tmpdir()/settlegrid-qg-<random>`, runs `node --experimental-vm-modules src/server.ts` with a sanitized env (no secrets), waits up to `timeoutMs` (default 15000) for a stdout line matching `/listening on|server started|ready on port/i`, kills the child, and cleans the tmpdir. The security gate uses a static pattern list (defined as a `SECURITY_RULES` constant at the top of the file, minimum 10 rules) and walks every `.ts`/`.js`/`.json`/`Dockerfile` file.

On overall failure, `runQualityGates` must append a structured log entry to `/Users/lex/settlegrid/docs/audit-failures/<YYYY-MM-DD>-<slug>.json`. If `docs/audit-failures/` does not exist, create it (this prompt is also responsible for the `docs/audit-failures/.gitkeep` file).

**Files you may touch:**
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts`
- `/Users/lex/settlegrid-agents/agents/shared/__tests__/quality-gates.test.ts`
- `/Users/lex/settlegrid-agents/package.json` (only to add `get-port`, `typescript` if missing)
- `/Users/lex/settlegrid/docs/audit-failures/.gitkeep` (create)

**Files you MUST NOT touch:**
- `agents/templater/**` (P1.5 wires the consumer)
- Any template in `open-source-servers/`
- `agents/shared/` modules other than the new one

**External services touched:** spawns node child process locally, no network

### Implementation Steps

1. Add `typescript` as devDep if not present. Add `get-port`.
2. Create `docs/audit-failures/.gitkeep` in the main repo and commit as part of this prompt.
3. Implement `runTscGate` with in-memory CompilerHost.
4. Implement `SECURITY_RULES` constant (10+ rules: `exec\s*\(`, `eval\s*\(`, `__dirname.*\.\./\.\./\.\.`, unpinned `"version": "\\*"`, `rm -rf \$` in Dockerfile, missing HEALTHCHECK, etc.).
5. Implement `runSecurityGate` walking files and matching rules, capturing line numbers.
6. Implement `runSmokeGate` with tmpdir, child_process spawn, port detection, and cleanup guard in `finally`.
7. Implement `runQualityGates` orchestrator that short-circuits on first failure unless `opts.continueOnFailure === true`.
8. Add the audit-failure log writer.
9. Write ≥30 tests covering each gate, the orchestrator, and the failure-log writer (fake-fs or real tmpdir).
10. Run the audit chain.

### Definition of Done

- [ ] `pnpm typecheck` passes
- [ ] `vitest run agents/shared/__tests__/quality-gates` passes with ≥ 30 tests
- [ ] Running the gate against `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/` returns `overallPass: true`
- [ ] Running it against a deliberately broken fixture returns `overallPass: false` and writes a file under `docs/audit-failures/`
- [ ] Smoke gate always kills child process (verified via leak test)
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm agents/shared/quality-gates.ts agents/shared/__tests__/quality-gates.test.ts docs/audit-failures/.gitkeep && git restore package.json` then `pnpm install`.

### Commit Message Template

```
shared: add quality-gates module (tsc + smoke + security)

Programmatic tsc compile gate, child-process smoke boot gate
with 15s timeout and tmpdir cleanup, static security rule
lint with 10+ rules. Writes structured failure logs to
docs/audit-failures/. 30+ tests.

Refs: P1.4
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.5 — Templater orchestrator registration + end-to-end dry run

**Phase:** 1
**Depends on:** P1.3, P1.4
**Blocks:** P1.12
**Estimated effort:** 4 founder hours, ~$3 API cost
**Risk level:** Medium
**Rollback complexity:** Moderate

### Context

Templater exists as a library but the cron orchestrator has no knowledge of it. This prompt registers the agent in `orchestrator/scheduler.ts`, wires the real `runQualityGates` from P1.4 into `agents/templater/graph.ts` (replacing the no-op TODO from P1.2), adds npm scripts, and performs a single end-to-end dry run against a small public API (`https://catfact.ninja`) to verify the whole pipeline. This is the first moment the four pieces — scaffold, tools, tests, quality gates — are all simultaneously loaded in one process.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/orchestrator/scheduler.ts` (edit)
- `/Users/lex/settlegrid-agents/agents/templater/graph.ts` (edit — wire quality gates)
- `/Users/lex/settlegrid-agents/package.json` (edit — add scripts)
- `/Users/lex/settlegrid-agents/orchestrator/__tests__/scheduler.test.ts` (edit — add templater coverage)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid-agents/orchestrator/scheduler.ts` lines 13-62 (SCHEDULE + resolveAgentScript)
- `/Users/lex/settlegrid-agents/orchestrator/__tests__/` — existing scheduler test style
- `/Users/lex/settlegrid-agents/package.json` — existing npm scripts (`agent:beacon`, `agent:protocol`, etc.)

**Prerequisites to verify:**
- [ ] P1.3 and P1.4 merged
- [ ] `pnpm typecheck` green
- [ ] `TEMPLATER_DRY_RUN=1` env support implemented in P1.2

### Specification

1. Add three entries to the `SCHEDULE` constant in `orchestrator/scheduler.ts`:
   - `templater_generate: { interval: '0 3 * * 2,4', agent: 'templater', command: 'generate' }`
   - `templater_audit: { interval: '0 9 * * 6', agent: 'templater', command: 'audit' }`
2. Extend `resolveAgentScript` to return `path.resolve(__dirname, '../agents/templater/index.ts')` for `agent === 'templater'`.
3. Wire `runQualityGates` into `agents/templater/graph.ts` replacing the no-op, with a 90-second timeout and `continueOnFailure: false`.
4. Add npm scripts to `package.json`:
   - `"agent:templater": "tsx agents/templater/index.ts"`
   - `"agent:templater:generate": "tsx agents/templater/index.ts generate"`
   - `"agent:templater:dry-run": "TEMPLATER_DRY_RUN=1 tsx agents/templater/index.ts generate"`
5. Extend `orchestrator/__tests__/scheduler.test.ts` with tests asserting: (a) templater is in SCHEDULE, (b) `resolveAgentScript('templater', 'generate')` returns a path whose file exists, (c) disabling templater via `isAgentDisabled` still works, (d) error-count threshold applies.
6. Run `pnpm agent:templater:dry-run` locally and capture the output to confirm the pipeline executes end-to-end with the real P1.4 gates (the smoke gate will succeed against the generated template).
7. Run the audit chain.

**Files you may touch:**
- `orchestrator/scheduler.ts`
- `orchestrator/__tests__/scheduler.test.ts`
- `agents/templater/graph.ts`
- `package.json`

**Files you MUST NOT touch:**
- `agents/beacon/**`, `agents/protocol/**`, `agents/indexer/**`
- `agents/shared/quality-gates.ts` (already frozen by P1.4)
- `agents/templater/tools.ts`, `prompts.ts`, `index.ts`

**External services touched:** Anthropic, Firecrawl, Langfuse — but dry run flag prevents HITL spam and prevents file writes to `open-source-servers/`

### Implementation Steps

1. Read the current scheduler.ts top-to-bottom.
2. Edit SCHEDULE and resolveAgentScript.
3. Wire quality gates into graph.ts using the `runQualityGates` import.
4. Add npm scripts.
5. Add scheduler tests.
6. Run `pnpm -C /Users/lex/settlegrid-agents typecheck`.
7. Run `pnpm vitest run orchestrator`.
8. Run `pnpm vitest run agents/templater` (should still pass).
9. Run `pnpm agent:templater:dry-run` and save stdout/stderr to `/tmp/templater-dry-run.log`. Verify: (a) Firecrawl call succeeded, (b) synthesizeTemplate returned a valid spec, (c) generateTemplateFiles returned ≥ 5 files, (d) quality gate overallPass true, (e) HITL NOT called (dry run), (f) process exits 0.
10. Run the audit chain.

### Definition of Done

- [ ] `pnpm typecheck` passes
- [ ] All vitest suites green (templater ≥ 57, scheduler + new tests, quality-gates ≥ 30)
- [ ] `pnpm agent:templater:dry-run` exits 0 and log shows all 6 steps above
- [ ] `/tmp/templater-dry-run.log` attached to commit body (first 50 lines)
- [ ] `resolveAgentScript('templater', 'generate')` points to an existing file
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`git restore orchestrator/scheduler.ts orchestrator/__tests__/scheduler.test.ts agents/templater/graph.ts package.json && pnpm install` — templater continues to exist as a library with no schedule.

### Commit Message Template

```
orchestrator: register templater agent + e2e dry run

Add templater_generate and templater_audit cron entries, extend
resolveAgentScript, wire quality-gates into graph, add npm
scripts. Dry run against catfact.ninja produces valid template
with all three gates passing.

Refs: P1.5
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.6 — CANONICAL_50 audit of 1,022 open-source-servers

**Phase:** 1
**Depends on:** P1.4
**Blocks:** P1.12
**Estimated effort:** 7 founder hours, ~$12 API cost
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context

`/Users/lex/settlegrid/open-source-servers/` holds 1,022 MCP server templates produced by the batch generator. Not all of them are gallery-worthy. This prompt builds an audit script that scores every template on a deterministic rubric, uses Claude Sonnet sparingly for tiebreak only, and emits `CANONICAL_50.json` — the 50-template seed set for the gallery launch. The scoring rubric must be reproducible (same input → same output, except for the optional Claude tiebreaker which must be deterministic-temperature-0).

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/audit/canonical-50.mjs` (create)
- `/Users/lex/settlegrid/scripts/audit/rubric.mjs` (create)
- `/Users/lex/settlegrid/CANONICAL_50.json` (create)
- `/Users/lex/settlegrid/docs/audit-failures/canonical-50-rejected.json` (create — rejection reasons for the other 972)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/` — example layout
- `/Users/lex/settlegrid/scripts/gen/batch3a.mjs` — understand what batch specs were used
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts` — reuse for per-template scoring
- `/Users/lex/settlegrid/packages/mcp/` — SDK surface to verify every template imports from

**Prerequisites to verify:**
- [ ] P1.4 merged and quality-gates importable from the main repo (via a relative path `../settlegrid-agents/agents/shared/quality-gates.ts`, or package via `pnpm link`)
- [ ] `ANTHROPIC_API_KEY` in env

### Specification

Scoring rubric (100 points total):

- **README completeness** (15 pts): headings present, SDK snippet present, envvars documented, example request/response
- **Tool count** (10 pts): ≥3 tools scores full, 1-2 scores half, 0 scores zero
- **Schema completeness** (15 pts): every tool has input schema + description
- **Quality gates pass** (25 pts): runs P1.4 `runQualityGates` in `skipSmoke: false` mode, 25 if all three pass, partial credit for 2/3
- **Dependency freshness** (10 pts): no `*` versions, no deprecated packages, `@settlegrid/mcp` on current version
- **Dockerfile + vercel.json** (10 pts): present, multi-stage, PORT env, HEALTHCHECK
- **Category + discoverability** (5 pts): `package.json` has `keywords`, categories non-empty
- **Novelty** (10 pts): category is NOT over-represented (e.g. if 300 templates already cover weather APIs, 301st weather template scores 0)

The Novelty scoring must cluster the 1,022 templates first by category and penalize categories with > 20 existing entries. Tie-breaks (when many templates share the same score) are resolved via a batched Claude Sonnet call that receives 5 template READMEs at a time with temperature 0 and returns a 1-5 ranking.

Output `CANONICAL_50.json` shape:

```json
{
  "version": 1,
  "generatedAt": "2026-04-07T00:00:00Z",
  "rubricHash": "sha256:...",
  "templates": [
    {
      "slug": "settlegrid-stripe",
      "score": 94,
      "breakdown": { "readme": 15, "tools": 10, "schema": 15, "gates": 25, "deps": 10, "docker": 10, "category": 5, "novelty": 4 },
      "categoryTag": "payments"
    }
  ],
  "rejected": 972
}
```

Rejected templates have their reasons recorded in `docs/audit-failures/canonical-50-rejected.json` keyed by slug.

The script must be re-runnable: `node scripts/audit/canonical-50.mjs` produces deterministic output except for `generatedAt`. Claude calls are cached to disk at `scripts/audit/.cache/<hash>.json` to keep cost low on re-runs.

**Files you may touch:**
- `/Users/lex/settlegrid/scripts/audit/**`
- `/Users/lex/settlegrid/CANONICAL_50.json`
- `/Users/lex/settlegrid/docs/audit-failures/canonical-50-rejected.json`
- `/Users/lex/settlegrid/package.json` — add `audit:canonical-50` script only

**Files you MUST NOT touch:**
- Any file under `open-source-servers/` (read-only)
- `packages/mcp/**`
- `apps/web/**`
- `agents/shared/quality-gates.ts` (consume only)

**External services touched:** Anthropic (Claude Sonnet, cached)

### Implementation Steps

1. Write `scripts/audit/rubric.mjs` with pure functions for each rubric dimension (no I/O, testable).
2. Write 15+ unit tests for the rubric in `scripts/audit/__tests__/rubric.test.mjs`.
3. Write `scripts/audit/canonical-50.mjs` that: walks `open-source-servers/`, scores each template, clusters by category, computes novelty, calls Claude tiebreaker in batches of 5 where needed, writes outputs.
4. Add disk cache helper for Claude calls.
5. Run `node scripts/audit/canonical-50.mjs`. First run ~ $10-12 Claude cost. Inspect output for reasonableness.
6. Re-run to verify cache hit: second run should be $0 and produce byte-identical output (except timestamp).
7. Spot-check 5 top-10 templates and 5 rejected templates by hand.
8. Run the audit chain.

### Definition of Done

- [ ] `CANONICAL_50.json` exists with exactly 50 entries
- [ ] Sum of top-50 scores ≥ 3500 (avg 70+)
- [ ] Rejection file exists with 972 entries
- [ ] Re-run produces identical output (except timestamp) within $0.01
- [ ] `pnpm test scripts/audit` passes (rubric tests ≥ 15)
- [ ] Categories represented ≥ 10 distinct
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm CANONICAL_50.json docs/audit-failures/canonical-50-rejected.json && rm -rf scripts/audit && git restore package.json` — the open-source-servers directory is untouched.

### Commit Message Template

```
audit: produce CANONICAL_50 seed from 1022 templates

Deterministic 100-point rubric scoring README, tools, schemas,
quality gates, deps, Docker, discoverability, novelty. Claude
Sonnet tiebreaker batched and disk-cached. 50 templates
selected across 10+ categories; 972 rejected with reasons.

Refs: P1.6
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.7 — `@settlegrid/skill` package scaffold

**Phase:** 1
**Depends on:** none (parallelizable)
**Blocks:** P1.8, P1.9, P1.12
**Estimated effort:** 3 founder hours, ~$0 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

Anthropic's Agent Skills spec defines a portable format (SKILL.md + metadata + examples/) that LLM agents can load to acquire new capabilities. We're going to publish a Skill called `monetize-this-mcp` so that any Claude Desktop / API user can say "monetize this MCP server" and have the agent drop in our SDK. This prompt creates the package shell with a valid SKILL.md header but placeholder body — P1.8 writes the real instructions, P1.9 forks it to the Cursor variant. The package is an npm-publishable artifact.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-skill/package.json`
- `/Users/lex/settlegrid/packages/settlegrid-skill/SKILL.md`
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/` (dir with .gitkeep)
- `/Users/lex/settlegrid/packages/settlegrid-skill/README.md`
- `/Users/lex/settlegrid/packages/settlegrid-skill/tsconfig.json` (minimal, for editor support)
- `/Users/lex/settlegrid/pnpm-workspace.yaml` (edit if needed)
- `/Users/lex/settlegrid/package.json` (edit if needed — add workspace)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/create-settlegrid-tool/package.json` — existing published package shape
- `/Users/lex/settlegrid/packages/mcp/package.json` — version, author, license conventions
- `/Users/lex/settlegrid/turbo.json` — verify `packages/*` glob includes the new package

**Prerequisites to verify:**
- [ ] Anthropic Skills spec v1 reviewed (SKILL.md frontmatter fields: `name`, `description`, `when_to_use`, `inputs`, `version`)
- [ ] No existing `packages/settlegrid-skill/` directory
- [ ] pnpm workspaces recognize the new package after creation

### Specification

1. `package.json` fields:
   - `name`: `@settlegrid/skill`
   - `version`: `0.1.0`
   - `description`: "Anthropic Skill for monetizing any MCP server with SettleGrid"
   - `license`: `MIT`
   - `files`: `["SKILL.md", "examples/", "README.md", "cursor/"]`
   - `keywords`: `["mcp", "anthropic", "skill", "monetization", "settlegrid"]`
   - `repository`: GitHub URL
   - No dependencies (it's a content package)

2. `SKILL.md` with valid frontmatter (YAML):
   ```yaml
   ---
   name: monetize-this-mcp
   description: Wraps a user's existing MCP server with the SettleGrid SDK to enable pay-per-call billing in under 60 seconds.
   when_to_use: User asks to "monetize", "add billing to", "charge for", or "add payment to" their MCP server, or shows an MCP server file and asks how to make money from it.
   version: 0.1.0
   inputs:
     - name: server_file_path
       description: Path to the MCP server entry file (usually src/server.ts or index.ts)
       required: true
     - name: pricing_cents
       description: Default price per call in cents
       required: false
       default: 1
   ---
   ```
   Body is a placeholder `<!-- P1.8 will fill this in -->`.

3. `README.md` at package root explains install (`npm install @settlegrid/skill`), what a Skill is, and how to load it in Claude Desktop.

4. `examples/` directory with `.gitkeep` and a short `README.md` explaining that P1.8 will populate it.

5. Register in `pnpm-workspace.yaml` if it doesn't already glob `packages/*`.

6. `turbo.json` should already pick up the package; verify with `pnpm turbo build --filter @settlegrid/skill --dry-run`.

**Files you may touch:**
- `/Users/lex/settlegrid/packages/settlegrid-skill/**`
- `/Users/lex/settlegrid/pnpm-workspace.yaml` (only to add the glob if missing)
- `/Users/lex/settlegrid/package.json` (only if needed to register workspace)

**Files you MUST NOT touch:**
- `packages/mcp/**`, `packages/create-settlegrid-tool/**`, `packages/discovery-server/**`, other packages
- `apps/web/**`
- `open-source-servers/**`

**External services touched:** none

### Implementation Steps

1. Create directory and all files per spec.
2. Validate SKILL.md frontmatter with a simple YAML parse check (add a dev dep `yaml` if you want a test).
3. Run `pnpm install` at repo root to register the workspace.
4. Run `pnpm turbo build --filter @settlegrid/skill --dry-run` — should succeed with nothing to do.
5. `pnpm typecheck` at root — should still pass unchanged.
6. Run the audit chain.

### Definition of Done

- [ ] `packages/settlegrid-skill/` exists with package.json, SKILL.md, README.md, examples/.gitkeep
- [ ] `pnpm -w list --depth 0` shows `@settlegrid/skill`
- [ ] SKILL.md frontmatter parses as valid YAML with all required fields
- [ ] `pnpm typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf packages/settlegrid-skill && git restore pnpm-workspace.yaml package.json && pnpm install`.

### Commit Message Template

```
skill: scaffold @settlegrid/skill package

Create Anthropic Skills v1 compliant package shell with valid
SKILL.md frontmatter (name, description, when_to_use, version,
inputs), examples/ placeholder, and README. Body content will
be filled by P1.8.

Refs: P1.7
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.8 — Skill content: `monetize-this-mcp` body

**Phase:** 1
**Depends on:** P1.7
**Blocks:** P1.9, P1.12
**Estimated effort:** 5 founder hours, ~$0 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

P1.7 produced a valid SKILL.md shell. This prompt writes the actual instructions a Claude agent will read when the user asks to "monetize my MCP server." The content must be concrete, byte-level accurate against `@settlegrid/mcp` v0.1.1, give the agent a rigid playbook (not vibes), and include three worked examples covering common starting points. The Skill must also tell the agent how to create a SettleGrid account and obtain an API key, because a user who's never heard of SettleGrid will ask Claude to do this.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-skill/SKILL.md` (replace body)
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/rest-wrapper.md`
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/fastmcp-wrapper.md`
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/typescript-sdk-wrapper.md`

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/src/index.ts` — exact exports
- `/Users/lex/settlegrid/packages/mcp/src/settlegrid.ts` — `init` + `wrap` signatures
- `/Users/lex/settlegrid/packages/mcp/README.md` — public-facing phrasing
- `/Users/lex/settlegrid/apps/web/src/app/(dashboard)/onboarding/` — account creation flow to reference in the Skill

**Prerequisites to verify:**
- [ ] P1.7 merged
- [ ] Current published version of `@settlegrid/mcp` is 0.1.1 (grep package.json)
- [ ] The four exports named in the master plan shared context (`settlegrid.init`, `settlegridMiddleware`, `createPaymentCapability`, `generateServerCard`) all exist in current SDK source

### Specification

`SKILL.md` body (replacing the `<!-- P1.8 will fill this in -->` placeholder) must contain these sections in this order:

1. **Goal** (1 paragraph, ≤ 80 words)
2. **Inputs** — restate the frontmatter inputs in prose
3. **Preflight checks** — step-by-step (6 numbered checks: file exists, has MCP server pattern, user has Node ≥ 18, user has an `@settlegrid/mcp` API key OR a clear path to get one, server uses either `@modelcontextprotocol/sdk` or `fastmcp`, file is not already wrapped)
4. **Step-by-step playbook** — numbered (8-12 steps):
   1. Read the server file
   2. Identify tool handlers
   3. Install `@settlegrid/mcp` via pnpm/npm/yarn (detect package manager from lockfile)
   4. Insert `import { settlegrid } from '@settlegrid/mcp'` at top
   5. Insert `const sg = settlegrid.init({ toolSlug, pricing })` right after imports
   6. Wrap each tool handler via `sg.wrap(handler, { method })`
   7. Export via `settlegridMiddleware` if using Express/Hono
   8. Add `SETTLEGRID_API_KEY` to `.env.example`
   9. Run `generateServerCard()` and write the output to `.well-known/settlegrid.json`
   10. Test with `curl -H "x-api-key: sg_test_..." ...`
   11. Print the exact command the user should run to verify
   12. Print a summary + link to dashboard
5. **Onboarding path (if user has no API key)** — exact URL `https://settlegrid.ai/signup`, what fields to fill, where they find the key, how much the free tier allows
6. **Anti-patterns** — 5 things the agent must NOT do (e.g. do not wrap without confirming the tool slug is unique, do not hardcode the API key)
7. **Worked examples** — reference the three files in `examples/`

Each `examples/*.md` file:
- **Before** (starting server file as-is)
- **After** (fully wrapped, with diff callouts)
- **Dashboard screenshot description** (1 paragraph, no image — the Skill is text-only)
- **Expected revenue math** (3 lines: calls/day × cents/call × days = projected monthly)

Three examples:
- `rest-wrapper.md`: a 40-line MCP server using `@modelcontextprotocol/sdk` wrapping a public REST API
- `fastmcp-wrapper.md`: a fastmcp server with 3 tools
- `typescript-sdk-wrapper.md`: a raw TypeScript file with plain functions being promoted to MCP tools and monetized

Every code block in every file must be copy-paste-runnable (no `// ...`). Total SKILL.md length 800-1500 words. Each example 400-700 words.

**Files you may touch:**
- `/Users/lex/settlegrid/packages/settlegrid-skill/SKILL.md`
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/*.md`

**Files you MUST NOT touch:**
- `package.json`, `README.md` in the skill package (frozen by P1.7)
- `packages/mcp/**`
- Anything else in the repo

**External services touched:** none

### Implementation Steps

1. Read the SDK source fully to confirm exact export names and signatures.
2. Draft SKILL.md body with all seven sections.
3. Draft the three example files.
4. Lint every code block by copy-pasting into a tmp folder and running `tsc --noEmit` against a minimal tsconfig to catch typos.
5. Verify total word counts against spec.
6. Run the audit chain.

### Definition of Done

- [ ] SKILL.md has all 7 sections, 800-1500 words
- [ ] Three examples exist, each 400-700 words
- [ ] Every code snippet in every file compiles against `@settlegrid/mcp@0.1.1`
- [ ] No placeholder `// ...` or TODO in any file
- [ ] Frontmatter still valid YAML (did not get clobbered)
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`git restore packages/settlegrid-skill/SKILL.md && rm packages/settlegrid-skill/examples/{rest-wrapper,fastmcp-wrapper,typescript-sdk-wrapper}.md` — restores the P1.7 placeholder.

### Commit Message Template

```
skill: write monetize-this-mcp body + three examples

Full SKILL.md body with goal, preflight checks, 12-step playbook,
onboarding path for new users, anti-patterns. Three worked examples
(REST, fastmcp, raw TS) with before/after and revenue math. Every
code block tsc-verified against @settlegrid/mcp@0.1.1.

Refs: P1.8
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.9 — Cursor rule variant

**Phase:** 1
**Depends on:** P1.8
**Blocks:** P1.12
**Estimated effort:** 2 founder hours, ~$0 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

Cursor IDE uses `.cursorrules` as its format for project-level agent instructions. It is not compatible with Anthropic Skills format (no YAML frontmatter, no `examples/` directory — just a plaintext file at the project root). This prompt ports the Skill content from P1.8 into a Cursor rule file inside the same package, so users of either ecosystem can pick up the monetization playbook.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/packages/settlegrid-skill/cursor/.cursorrules` (create)
- `/Users/lex/settlegrid/packages/settlegrid-skill/cursor/README.md` (create)
- `/Users/lex/settlegrid/packages/settlegrid-skill/package.json` (edit — add `cursor/` to `files`)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/settlegrid-skill/SKILL.md` (from P1.8 — source of truth)
- `/Users/lex/settlegrid/packages/settlegrid-skill/examples/*.md`
- Cursor documentation for `.cursorrules` format (no frontmatter, plain markdown-ish)

**Prerequisites to verify:**
- [ ] P1.8 merged
- [ ] `cursor/` directory does not yet exist

### Specification

1. Create `cursor/.cursorrules` containing the SKILL.md body converted to Cursor format:
   - No YAML frontmatter
   - Start with a single `# SettleGrid Monetization Rules` heading
   - Include a "When to activate" section referencing phrases (since Cursor doesn't have `when_to_use` metadata, it must be prose)
   - Include the full 12-step playbook verbatim
   - Inline all three examples (no external links — Cursor reads one file)
   - Maximum 3500 words (Cursor has context limits)
2. `cursor/README.md` explains how to use the rule: copy to your project root, rename, restart Cursor, invoke via "@settlegrid monetize this."
3. Update `package.json` `files` array to include `cursor/`.

Content must not diverge semantically from SKILL.md. If at any point the playbook steps differ between the two files, that's a bug.

**Files you may touch:**
- `/Users/lex/settlegrid/packages/settlegrid-skill/cursor/**`
- `/Users/lex/settlegrid/packages/settlegrid-skill/package.json`

**Files you MUST NOT touch:**
- `SKILL.md` (frozen by P1.8)
- `examples/` (frozen by P1.8)
- Other packages

**External services touched:** none

### Implementation Steps

1. Read SKILL.md and all three examples into memory.
2. Write `.cursorrules` adapting the content (drop YAML, inline examples, compress whitespace).
3. Run a diff of step numbers and step bodies against SKILL.md — must be identical.
4. Write `cursor/README.md`.
5. Update `package.json` `files` array.
6. `pnpm typecheck` at root.
7. Run the audit chain.

### Definition of Done

- [ ] `cursor/.cursorrules` exists, < 3500 words
- [ ] Semantic diff against SKILL.md shows identical steps and anti-patterns
- [ ] `cursor/README.md` exists
- [ ] `package.json` `files` includes `cursor/`
- [ ] `pnpm pack --filter @settlegrid/skill` produces a tarball that contains `cursor/.cursorrules`
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf packages/settlegrid-skill/cursor && git restore packages/settlegrid-skill/package.json`.

### Commit Message Template

```
skill: add Cursor rule variant at cursor/.cursorrules

Port SKILL.md content to Cursor format (no YAML frontmatter,
inline examples, < 3500 words for context window). Semantic
parity verified against the Anthropic Skill source.

Refs: P1.9
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.10 — MCP SEP draft for `experimental/payment`

**Phase:** 1
**Depends on:** none (parallelizable)
**Blocks:** P1.12
**Estimated effort:** 8 founder hours, ~$1 API cost
**Risk level:** Low
**Rollback complexity:** Trivial

### Context

The Model Context Protocol currently has no native capability for monetized tools. Servers charge out-of-band (via API keys + headers). We want to propose an `experimental/payment` capability to the MCP spec so that future clients negotiate payment during the initialization handshake, reducing friction and establishing SettleGrid as the reference implementation. This prompt produces a markdown SEP (Spec Enhancement Proposal) draft at publish-ready quality — motivation, specification, rationale, backwards compatibility, reference implementation plan — so we can post to the MCP GitHub discussion and link it from our docs.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/docs/seps/experimental-payment-draft.md` (create)
- `/Users/lex/settlegrid/docs/seps/README.md` (create — index)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/packages/mcp/src/` — existing payment capability helpers (`createPaymentCapability`)
- `/Users/lex/settlegrid/packages/mcp/README.md` — how we currently document the out-of-band flow
- The MCP 2025-03-26 spec (public, on modelcontextprotocol.io) — especially `initialize` handshake and `capabilities` object — for conformance to existing SEP style

**Prerequisites to verify:**
- [ ] `docs/seps/` does not yet exist
- [ ] Familiarity with the MCP `initialize` handshake

### Specification

`docs/seps/experimental-payment-draft.md` must follow the RFC-like structure used by the MCP project:

**Header:**
```
# SEP-XXXX: experimental/payment capability

- **Status:** Draft (pre-submission)
- **Author:** SettleGrid Team
- **Created:** 2026-04-07
- **Discussion:** (TBD — filed after publication)
- **Compatibility:** MCP 2025-03-26+
```

**Sections:**

1. **Abstract** — 150 word summary
2. **Motivation** — why monetized tools need this. Concrete failure modes of out-of-band approaches (discoverability, trust signals, cross-client compatibility, telemetry gaps). 3-5 paragraphs.
3. **Specification**
   - New capability key: `experimental.payment` (version-namespaced)
   - Handshake additions: server declares `{ payment: { supported: ['pay-per-call', 'subscription'], minAmountCents: 1, currency: 'USD', processor: 'https://<url>' } }`
   - Client response: `{ payment: { accepted: 'pay-per-call', apiKey: '<opaque>' } }` OR `{ payment: { declined: true, reason: 'no-funds' } }`
   - New JSON-RPC method: `payment/quote` — client asks "what will this tool call cost" before invocation
   - New JSON-RPC method: `payment/receipt` — server returns receipt ID after successful paid call
   - Error codes: -32010 through -32013 (`PAYMENT_REQUIRED`, `PAYMENT_INVALID_KEY`, `PAYMENT_INSUFFICIENT_FUNDS`, `PAYMENT_PROCESSOR_DOWN`)
   - Schema blocks in TypeScript + JSON Schema inline
4. **Rationale** — why these design choices. Compare with HTTP 402, Lightning BOLT-12, etc. 3-4 paragraphs.
5. **Backwards compatibility** — section must state clearly: clients not advertising `experimental.payment` MUST continue to work via out-of-band API keys. The capability is purely additive.
6. **Security considerations** — key leakage, replay attacks, processor trust model, audit trail requirement, SSRF in `processor` URL
7. **Reference implementation plan** — pointer to `@settlegrid/mcp` SDK, link to `createPaymentCapability`, timeline for reference client + server, SEP → PR path
8. **Open questions** — numbered list, 5-10 items (currency support, micropayment batching, custodial vs non-custodial, privacy of amounts, receipt verification, etc.)
9. **Appendix A**: full example handshake (JSON-RPC request + response pair)
10. **Appendix B**: Migration guide for existing SettleGrid users

Total length: 3000-5000 words. Every JSON example must be valid JSON (lint with `jq empty`).

`docs/seps/README.md` is a one-screen index listing the SEP with status and link.

**Files you may touch:**
- `/Users/lex/settlegrid/docs/seps/**`

**Files you MUST NOT touch:**
- `packages/mcp/**`
- `apps/web/**`
- Any other doc file

**External services touched:** none (optional: Claude Sonnet for polish pass)

### Implementation Steps

1. Read `packages/mcp/src/` to confirm current payment helper API so Section 3 reflects actual code.
2. Draft Abstract + Motivation.
3. Draft Specification section with JSON Schema + TypeScript definitions.
4. Validate every JSON example with `jq empty`.
5. Draft Rationale, Backwards Compatibility, Security Considerations.
6. Draft Reference Implementation Plan and Open Questions.
7. Draft Appendices.
8. Create `docs/seps/README.md` index.
9. Word-count check: 3000-5000 total.
10. Run the audit chain.

### Definition of Done

- [ ] `docs/seps/experimental-payment-draft.md` exists, 3000-5000 words
- [ ] Every JSON block validates with `jq empty`
- [ ] Every TypeScript block compiles in isolation (`tsc --noEmit` against tmp file)
- [ ] All 10 sections present
- [ ] Open questions list has 5-10 items
- [ ] `docs/seps/README.md` exists and links the draft
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf docs/seps/`.

### Commit Message Template

```
docs: draft SEP for experimental/payment MCP capability

Full RFC-style proposal for native payment negotiation in the MCP
initialize handshake. Covers motivation, spec (capability object,
payment/quote + payment/receipt methods, -32010 error codes),
rationale, backwards compat, security, reference implementation,
and 10 open questions. 4200 words.

Refs: P1.10
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.11 — Codemod framework foundation

**Phase:** 1
**Depends on:** none (parallelizable)
**Blocks:** P1.12
**Estimated effort:** 5 founder hours, ~$0 API cost
**Risk level:** Medium
**Rollback complexity:** Moderate

### Context

The 1,022 templates in `open-source-servers/` all depend on `@settlegrid/mcp`. When we bump the SDK version, breaking changes must propagate automatically — a manual migration across 1,022 repos is impossible for a solo founder. This prompt installs jscodeshift and builds the first codemod: a version bump that rewrites `package.json` dependencies and fixes any trivial API deltas. The codemod framework must be extensible: future phases will add codemods for schema migrations, new capability flags, etc. Codemods are idempotent and dry-run by default.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/codemods/README.md` (create)
- `/Users/lex/settlegrid/scripts/codemods/runner.mjs` (create — framework entry)
- `/Users/lex/settlegrid/scripts/codemods/sdk-version-bump.js` (create — first codemod)
- `/Users/lex/settlegrid/scripts/codemods/__tests__/sdk-version-bump.test.mjs` (create)
- `/Users/lex/settlegrid/scripts/codemods/fixtures/` (create — before/after pairs)
- `/Users/lex/settlegrid/package.json` (edit — add `codemod` script + jscodeshift devDep)

**Relevant existing code to read first:**
- `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/package.json` — shape of the dependency block
- `/Users/lex/settlegrid/open-source-servers/settlegrid-500px/src/server.ts` — shape of SDK imports
- jscodeshift documentation (public)

**Prerequisites to verify:**
- [ ] jscodeshift is a reasonable tool for js/json transforms (it is — but we need `jscodeshift` + `json-jscodeshift` or a custom JSON handler)
- [ ] No existing `scripts/codemods/` directory

### Specification

1. **Framework (`runner.mjs`)**:
   - Usage: `node scripts/codemods/runner.mjs <codemod-name> [--target glob] [--apply]`
   - Default target glob: `open-source-servers/*`
   - Default mode: dry-run (prints unified diff, no writes)
   - `--apply` flag: writes changes
   - Tracks per-template success/failure in `scripts/codemods/.last-run.json`
   - On any template failing to parse, logs to `docs/audit-failures/codemod-<name>-<date>.json` and continues

2. **First codemod (`sdk-version-bump.js`)**:
   - Accepts CLI args: `--from 0.1.1 --to 0.2.0`
   - Transforms `package.json`: bumps `dependencies["@settlegrid/mcp"]` from `from` to `to`, leaves other deps alone
   - Transforms `src/server.ts`: rewrites any deprecated imports (configurable via a rename map embedded in the codemod; for 0.1.1→0.2.0 the map is empty since no breaking changes yet but the mechanism is tested)
   - Idempotent: running twice is a no-op on the second run
   - Returns structured result `{ filesTouched: string[]; skipped: string[]; errors: [] }`

3. **Tests (`__tests__/sdk-version-bump.test.mjs`)**:
   - ≥ 12 tests using fixture pairs
   - Fixtures: `fixtures/before/*.json`, `fixtures/before/*.ts`, `fixtures/after/*.json`, `fixtures/after/*.ts`
   - Test: dry run produces expected diff, apply mode writes expected bytes, idempotency, unknown `from` version is a warning not an error, transforms a malformed package.json gracefully, rename map transform applies, non-settlegrid deps untouched, only `.ts` files under `src/` considered, rollback on error, diff format stable

4. **Documentation** (`README.md`): explains framework, how to write a new codemod, how to run it, how to add tests, the dry-run-default invariant.

5. **npm script**: `"codemod": "node scripts/codemods/runner.mjs"` and `"codemod:sdk-bump": "node scripts/codemods/runner.mjs sdk-version-bump"`

**Files you may touch:**
- `/Users/lex/settlegrid/scripts/codemods/**`
- `/Users/lex/settlegrid/package.json` (scripts + devDep only)

**Files you MUST NOT touch:**
- Any template in `open-source-servers/` (codemod runs in dry-run mode only during this prompt)
- `packages/**`
- `apps/**`

**External services touched:** none

### Implementation Steps

1. Install jscodeshift as devDependency.
2. Create the runner, codemod, fixtures, tests, README in parallel.
3. Run the test suite — all green.
4. Execute `pnpm codemod:sdk-bump --from 0.1.1 --to 0.1.1 --target "open-source-servers/settlegrid-500px"` (dry run, no-op source) and verify 0 files changed.
5. Execute `pnpm codemod:sdk-bump --from 0.1.1 --to 0.2.0 --target "open-source-servers/settlegrid-500px"` (dry run only — does NOT apply) and verify the diff shows the version bump.
6. Verify no actual writes to `open-source-servers/` (git status clean for that dir).
7. Run the audit chain.

### Definition of Done

- [ ] `scripts/codemods/` contains runner, codemod, fixtures, README, tests
- [ ] `pnpm vitest run scripts/codemods` passes with ≥ 12 tests
- [ ] Dry run against a real template produces correct diff
- [ ] No files in `open-source-servers/` modified
- [ ] `pnpm typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`rm -rf scripts/codemods && git restore package.json && pnpm install`.

### Commit Message Template

```
scripts: add codemod framework + sdk-version-bump

jscodeshift-based runner with dry-run default, glob targeting,
per-template success tracking, failure logging to
docs/audit-failures/. First codemod bumps @settlegrid/mcp
version in package.json and rewrites deprecated imports via
an embedded rename map. 12+ tests with before/after fixtures.

Refs: P1.11
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P1.12 — Phase 1 audit gate + completion commit

**Phase:** 1
**Depends on:** P1.1, P1.2, P1.3, P1.4, P1.5, P1.6, P1.7, P1.8, P1.9, P1.10, P1.11
**Blocks:** Phase 2 entry
**Estimated effort:** 3 founder hours, ~$3 API cost
**Risk level:** Low
**Rollback complexity:** Trivial (this prompt writes only a summary file and commit)

### Context

Phase 1 has six hard exit criteria. This final prompt verifies each one with a machine-verifiable check, produces a `PHASE_1_SUMMARY.md` artifact listing every P1.N, its commit hash, its three audit verdicts, and a final go/no-go verdict. If any check fails, this prompt STOPS and logs the failure — it does NOT patch the failing piece (that's a re-run of the relevant P1.N). This is the gate between Foundation and Phase 2.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/scripts/phase-1-gate.mjs` (create — runner for the gate)
- `/Users/lex/settlegrid/docs/phase-reports/PHASE_1_SUMMARY.md` (create)
- `/Users/lex/settlegrid/docs/phase-reports/.gitkeep` (create)

**Relevant existing code to read first:**
- All 11 previous prompt commit messages via `git log --grep "Refs: P1\\."`
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts` (P1.4)
- `/Users/lex/settlegrid/CANONICAL_50.json` (P1.6)

**Prerequisites to verify:**
- [ ] P1.1 through P1.11 all merged
- [ ] `git log --grep "Refs: P1\\."` returns 11 commits
- [ ] Working tree clean

### Specification

Create `scripts/phase-1-gate.mjs` that runs the following checks in order. Each check prints `[PASS]` or `[FAIL: <reason>]`. Any FAIL aborts with exit 1.

1. **Templater compiles** — `pnpm -C /Users/lex/settlegrid-agents typecheck` exits 0
2. **Templater tests** — `pnpm -C /Users/lex/settlegrid-agents vitest run agents/templater --reporter=json` parses and test count ≥ 57, failures = 0
3. **Quality gates module** — file exists + tests pass
4. **Scheduler registration** — grep scheduler.ts for `templater_generate` and `templater_audit`
5. **CANONICAL_50.json** — file exists, JSON parses, `templates.length === 50`, sum of scores ≥ 3500
6. **Skill package** — `@settlegrid/skill` appears in `pnpm -w list`, SKILL.md frontmatter parses YAML, examples/ has 3 files
7. **Cursor rule** — `cursor/.cursorrules` exists, word count < 3500
8. **SEP draft** — `docs/seps/experimental-payment-draft.md` exists, word count 3000-5000, all JSON blocks validate with `jq empty`
9. **Codemod framework** — `scripts/codemods/runner.mjs` + `sdk-version-bump.js` exist, codemod tests pass
10. **Audit failure log dir** — `docs/audit-failures/` exists and is git-tracked (`.gitkeep` present)
11. **All P1.N commits present** — `git log --grep "Refs: P1\\." --format=%H` returns exactly 11 hashes
12. **Every P1.N commit has `Audits: spec-diff PASS, hostile PASS, tests PASS` trailer** — grep each commit message

Write a summary file `docs/phase-reports/PHASE_1_SUMMARY.md` with:
- Section "Phase 1 Exit Criteria" — each criterion with PASS/FAIL status
- Section "Commit Ledger" — table of P1.N, subject, short-sha, date, audit verdicts
- Section "Artifacts Produced" — absolute paths to every deliverable
- Section "Next Phase Readiness" — "Ready: YES" or "Ready: NO" with reasons
- Section "Estimated Actuals" — total hours and API cost rolled up from each commit

Create the final commit containing only the summary file, with message template below.

**Files you may touch:**
- `/Users/lex/settlegrid-agents/scripts/phase-1-gate.mjs`
- `/Users/lex/settlegrid/docs/phase-reports/**`

**Files you MUST NOT touch:**
- Anything else. This prompt is read-only except for the summary and gate script.

**External services touched:** none

### Implementation Steps

1. Write `scripts/phase-1-gate.mjs` with the 12 checks.
2. Run it. If any check fails, STOP and log which P1.N needs re-running. Do not attempt to fix.
3. Parse git log to build the Commit Ledger.
4. Compute rolled-up hours and cost estimates from each commit's original prompt card.
5. Write `PHASE_1_SUMMARY.md`.
6. Create the `.gitkeep` and the summary file, stage them, and commit.
7. Run the audit chain one final time on the summary commit itself.

### Definition of Done

- [ ] `node scripts/phase-1-gate.mjs` exits 0 with all 12 checks PASS
- [ ] `PHASE_1_SUMMARY.md` exists and contains all 5 sections
- [ ] Commit ledger has exactly 12 rows (P1.1 through P1.12)
- [ ] Next Phase Readiness = "Ready: YES"
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS on this commit
- [ ] Commit created

### Audit Chain

Execute {{AUDIT_CHAIN_TEMPLATE}} from Master Plan §3. Paste all three verdict blocks before committing.

### Rollback Instructions

`git revert HEAD` — this commit adds only the summary and gate script, so revert is safe and leaves Phase 1 deliverables intact.

### Commit Message Template

```
phase: Phase 1 Foundation complete — gate PASS

All 12 P1.N prompts merged, quality gates, templater agent,
Skill package, Cursor rule, SEP draft, CANONICAL_50, codemod
framework in place. Phase 1 gate script all 12 checks PASS.
Phase 2 entry unblocked.

Refs: P1.12
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## Phase 1 Close-out Notes

- All 12 prompts reference `{{AUDIT_CHAIN_TEMPLATE}}` and `{{SHARED_CONTEXT}}` so they remain valid after the Master Plan's canonical blocks evolve.
- The critical path is **P1.1 → P1.2 → P1.3 → P1.5 → P1.12**. P1.4 is parallelizable with P1.1-P1.3 but must land before P1.5. P1.6 depends only on P1.4. P1.7-P1.9 are a sequential mini-chain. P1.10 and P1.11 are fully parallel with everything.
- Phase 1 tolerates three reworks before founder should escalate. Any P1.N failing audit chain twice is a signal the prompt itself needs editing, not the implementation.
- The `docs/audit-failures/` directory created by P1.4 is the single source of truth for any gate failure across the whole Phase 1 runtime — no failure silently disappears.
