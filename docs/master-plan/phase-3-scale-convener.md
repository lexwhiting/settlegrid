# Phase 3 — Scale + Convener (Weeks 5-6)

*Generated as part of SettleGrid Quantum Leap Master Plan (MP-QL-001)*

---

Good, I have everything I need. Here is the Phase 3 document.

---

# SettleGrid Quantum Leap — Phase 3 Execution Prompts
## Weeks 5-6: Scale + Convener

### Phase Goal

Phase 3 converts the Phase 1 Templater agent and Phase 2 shadow directory into meaningful ecosystem presence: 75-150 new templates, convener emails for an MCP Billing Interop Working Group, 5 canonical Academy lessons, and 10+ directory submissions. Exit state is a SettleGrid ecosystem footprint large enough that Phase 4 (paid acquisition + first customer) has organic gravity pulling on it.

### Prompt Sequence Overview

- **P3.1** — Templater scale run configuration (budget wiring, category list, spec generator)
- **P3.2** — Templater scale run execution (the actual $300-capped run)
- **P3.3** — Quality gate tuning from Templater telemetry
- **P3.4** — Templater cost + quality dashboard at `/admin/templater`
- **P3.5** — MCP Billing Interop WG research briefs (8 target companies)
- **P3.6** — MCP SEP community feedback incorporation + formal PR
- **P3.7** — Directory submission packet builder (10+ directories)
- **P3.8** — Monetization Academy lesson 1: "How to price your MCP server"
- **P3.9** — Monetization Academy lessons 2-5 (batched)
- **P3.10** — Academy landing page + RSS feed
- **P3.11** — Template CI pipeline: Renovate + codemods + auto-PR
- **P3.12** — Phase 3 audit gate (verifies all exit criteria)

### Expected Artifacts at End of Phase

1. 75-150 new template directories under `open-source-servers/` with valid `server.json`, `README.md`, `settlegrid.config.ts`, and passing quality-gates
2. Tuned `agents/shared/quality-gates.ts` with Templater-specific failure-mode catches and documented rationale
3. Live admin dashboard at `apps/web/src/app/admin/templater/page.tsx` showing cost, reject rate, failure modes, cumulative spend
4. 8 research brief markdown files at `/Users/lex/settlegrid-agents/data/wg-outreach/<company>.md`
5. Formal MCP SEP PR filed against `modelcontextprotocol/specification` (post-feedback revision)
6. Directory submission packets (one markdown per directory) at `/Users/lex/settlegrid/scripts/directory-submissions/` ready for the founder to execute
7. 5 published Academy lessons at `apps/web/src/app/learn/academy/<slug>/` (3000-5000 words each)
8. Academy landing page + RSS feed live at `settlegrid.ai/learn/academy` and `/learn/academy/rss.xml`
9. GitHub Actions workflow `.github/workflows/template-ci.yml` running weekly with Renovate + codemods
10. `phase-3-audit-log.md` with PASS verdicts for every P3 prompt

### Estimated Total Hours and Cost

- **Engineering hours:** 48-62 hours across the 2-week phase
- **Claude API cost:** $420 hard ceiling
  - Templater scale run: $300 (hardest cap)
  - Academy lesson drafting (human-in-loop): $40
  - WG research briefs: $25
  - Dashboard + tuning + CI: $55
- **Third-party costs:** $0 (all directory submissions free)

### Critical Budget / Risk Notes

- **Templater $300 cap is Phase 3's highest risk.** If the run produces <75 templates before the cap, Phase 3 cannot exit. Mitigations: P3.1 enforces per-template cost estimation, P3.2 kills the run on cap hit, P3.3 runs mid-phase (not end) so gates can be tuned with runway remaining.
- **Directory submissions are human-gated** — agents prepare packets, founder executes. This is intentional; auto-submission risks bans on Glama/Smithery/LobeHub.
- **WG outreach emails are written by the founder.** Agents produce research + talking points only. Do not automate the send.
- **Academy SEO posts must pass the same human-review bar as blog posts.** LLM drafting is allowed, but the founder signs off before publish.
- **All prompts depend on Phase 2 audit log showing PASS.** P3.12 is the gate into Phase 4.

---

## P3.1 — Templater scale run configuration

**Phase:** 3
**Depends on:** P2.12 (Phase 2 audit gate)
**Blocks:** P3.2, P3.3, P3.4
**Estimated effort:** 4 hours, ~$5
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
The Phase 1 Templater can produce one template at a time from a seed spec. Phase 3 needs to run it across 75-150 targets with a hard $300 Claude budget. Before running, we must wire cost telemetry, rate limiting, a curated category list of 15-25 AI tool verticals, and a spec generator that converts public API docs into Templater input specs. This prompt is the pre-flight — no templates are produced yet.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/templater/` (Phase 1 scaffold)
- `/Users/lex/settlegrid-agents/agents/shared/config.ts`
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts`
- `/Users/lex/settlegrid-agents/orchestrator/scheduler.ts`
- `/Users/lex/settlegrid-agents/data/templater/` (create)

**Relevant existing code to read first:**
- `agents/templater/index.ts` — understand current single-run entry point
- `agents/shared/config.ts` — see how env vars and budgets are surfaced
- `orchestrator/scheduler.ts` — see templater registration from P1

**Prerequisites to verify:**
- [ ] Phase 2 audit log confirms all P2 prompts PASS
- [ ] ANTHROPIC_API_KEY resolves via getConfig()
- [ ] Phase 1 templater tests still pass (`pnpm -w test --filter templater`)

### Specification
Add scale-run infrastructure to the templater agent. Implement: (1) a JSON-serializable `ScaleRunConfig` type with budget cap, category list, concurrency, and per-template cost ceiling; (2) a `BudgetTracker` class in `agents/shared/budget.ts` that records token usage + USD cost per invocation and aborts when cap is reached; (3) a curated `data/templater/categories.json` with 15-25 AI tool categories (RAG, vector DBs, agent frameworks, LLM gateways, eval tools, observability, fine-tuning, embedding services, image gen, speech, translation, code analysis, scraping, browser automation, data pipelines, etc.); (4) a `specGenerator.ts` module that accepts `{ category, apiDocsUrl, toolName }` and produces a Templater input spec via a constrained Claude call; (5) rate-limiting middleware capping concurrency at 4 and requests at 20/min to respect Anthropic tier limits.

**Files you may touch:**
- `agents/templater/scale-run.ts` (new)
- `agents/templater/spec-generator.ts` (new)
- `agents/shared/budget.ts` (new)
- `agents/shared/config.ts` (add TEMPLATER_BUDGET_USD, TEMPLATER_CONCURRENCY)
- `data/templater/categories.json` (new)
- `agents/templater/__tests__/scale-run.test.ts` (new)
- `agents/shared/__tests__/budget.test.ts` (new)

**Files you MUST NOT touch:**
- `open-source-servers/**`
- `apps/web/**`
- `packages/**`

**External services touched:**
- None in this prompt (Claude calls stubbed in tests)

**Budget constraints:**
- Hard cap: $5 in API costs for this prompt (config-only; no production runs)
- Abort if cap reached

### Implementation Steps
1. Create `agents/shared/budget.ts` with `BudgetTracker` exposing `record(tokensIn, tokensOut, model)`, `cumulative()`, `remaining()`, `abortIfExceeded()`. Use Anthropic published per-token prices keyed by model ID.
2. Write unit tests covering cap enforcement, model price lookup, and mid-batch abort behavior.
3. Create `data/templater/categories.json` with 20 categories; each entry has `{ slug, displayName, targetCount, seedQueries[] }`.
4. Create `agents/templater/spec-generator.ts` exposing `generateSpec({ category, toolName, apiDocsUrl? })`. Use a small Claude call (Haiku) with structured output. Validate against the Phase 1 Templater input schema.
5. Create `agents/templater/scale-run.ts` that accepts `ScaleRunConfig`, orchestrates spec generation then template generation across the category list, respects budget + concurrency, emits JSONL telemetry to `data/templater/runs/<timestamp>.jsonl`.
6. Wire `TEMPLATER_BUDGET_USD` and `TEMPLATER_CONCURRENCY` env vars into `agents/shared/config.ts` with Zod validation and defaults (300, 4).
7. Add tests for scale-run under `agents/templater/__tests__/scale-run.test.ts` using mocked Claude responses.
8. Run the audit chain (`{{AUDIT_CHAIN_TEMPLATE}}` against `{{SHARED_CONTEXT}}`).

### Definition of Done
- [ ] `BudgetTracker` enforces cap with unit tests covering edge cases
- [ ] `data/templater/categories.json` has 15-25 categories totaling 75-150 target templates
- [ ] `specGenerator` produces valid Templater input specs for sample input
- [ ] `scale-run.ts` emits JSONL telemetry with tokens, cost, category, verdict
- [ ] `pnpm -w typecheck` passes
- [ ] `pnpm -w test --filter @settlegrid-agents/templater` passes with new tests
- [ ] Dry-run with `TEMPLATER_BUDGET_USD=0.50` aborts cleanly after one template
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Paste all three verdict blocks before committing.

### Rollback Instructions
`git rm agents/templater/scale-run.ts agents/templater/spec-generator.ts agents/shared/budget.ts data/templater/categories.json` and delete new tests. Revert `config.ts` changes. No external state to unwind.

### Commit Message Template
```
templater: add scale-run config, budget tracker, spec generator

Adds BudgetTracker enforcing Anthropic USD cap, categories.json
with 20 AI tool verticals, spec-generator using Haiku for input
expansion, and scale-run orchestrator with rate limiting.

Refs: P3.1
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.2 — Templater scale run execution

**Phase:** 3
**Depends on:** P3.1
**Blocks:** P3.3, P3.4, P3.12
**Estimated effort:** 3 hours supervised + 4-6 hours runtime, ~$300
**Risk level:** High
**Rollback complexity:** Moderate

### Context
This is the expensive prompt. Execute the configured scale run, producing 75-150 templates under `open-source-servers/`. Budget is hard-capped at $300; the run must abort cleanly if cost telemetry exceeds it. Every template produced must pass Phase 1 quality gates. Failures are recorded but don't block the run. Supervision is manual: the operator watches the JSONL stream and kills the run if reject rate exceeds 60% in the first 15 templates.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/templater/scale-run.ts` (from P3.1)
- `/Users/lex/settlegrid-agents/data/templater/runs/` (output JSONL)
- `/Users/lex/settlegrid/open-source-servers/` (template output)
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts`

**Relevant existing code to read first:**
- `agents/templater/scale-run.ts` — understand the orchestrator from P3.1
- `agents/shared/quality-gates.ts` — understand pass/fail criteria
- `open-source-servers/<existing>/` — look at 2-3 P1 templates to understand expected output shape

**Prerequisites to verify:**
- [ ] P3.1 audit log PASS
- [ ] `TEMPLATER_BUDGET_USD=300` exported
- [ ] `open-source-servers/` is clean (no half-written templates from prior aborted runs)
- [ ] Disk has ≥500MB free
- [ ] Anthropic API key has ≥$350 credit available

### Specification
Run `pnpm --filter @settlegrid-agents/templater scale-run` with production config. The run executes the category list serially category-by-category with internal concurrency 4. Each template goes: spec generation → template generation → quality-gates → write-to-disk if PASS, log-and-skip if FAIL. On completion, print a summary: templates produced, templates rejected, total cost, cost per successful template, top 5 failure reasons. All output from this run lives under `open-source-servers/<category>-<tool>/` directories. The operator is expected to babysit the first 20 minutes.

**Files you may touch:**
- `open-source-servers/**` (write new template directories only)
- `data/templater/runs/<timestamp>.jsonl` (new)
- `data/templater/runs/<timestamp>-summary.json` (new)

**Files you MUST NOT touch:**
- `agents/**` (use existing code from P3.1, do not patch mid-run)
- `apps/web/**`
- `packages/**`
- Any existing P1 template directory

**External services touched:**
- Anthropic API (heavy usage — $300 ceiling)

**Budget constraints:**
- Hard cap: $300 in API costs for this prompt
- Abort if cap reached — non-negotiable, do not raise the cap mid-run
- If operator observes >60% reject rate in first 15 templates, kill the run, do not continue

### Implementation Steps
1. Clean `open-source-servers/` of any stale scratch directories from prior runs (git status check).
2. Export env: `ANTHROPIC_API_KEY`, `TEMPLATER_BUDGET_USD=300`, `TEMPLATER_CONCURRENCY=4`, `TEMPLATER_OUTPUT_DIR=/Users/lex/settlegrid/open-source-servers`.
3. Start the run: `pnpm --filter @settlegrid-agents/templater scale-run 2>&1 | tee data/templater/runs/$(date +%s).log`.
4. Monitor the first 15 templates. If reject rate >60%, SIGINT and switch to P3.3 for gate tuning before resuming.
5. If the run completes normally, inspect the summary JSON. Verify: templates produced ≥75, cost ≤$300, reject rate <30% (target) or <40% (acceptable — P3.3 will tune).
6. Stage new template directories: `git -C /Users/lex/settlegrid add open-source-servers/`.
7. Run `pnpm --filter @settlegrid/web build` to confirm the new templates don't break registry builds.
8. Run audit chain against the run summary and staged templates.

### Definition of Done
- [ ] ≥75 templates written to `open-source-servers/`
- [ ] Total Claude cost ≤$300 (check summary JSON)
- [ ] Every written template has `server.json`, `README.md`, `settlegrid.config.ts`
- [ ] Every written template passes current quality-gates
- [ ] Summary JSON saved at `data/templater/runs/<timestamp>-summary.json`
- [ ] `pnpm --filter @settlegrid/web build` succeeds with new templates
- [ ] No files modified outside `open-source-servers/` and `data/templater/runs/`
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created with template additions

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Additional hostile check: pick 3 random new templates and verify they install + match their declared API surface via `sg-cli verify`. Paste all verdict blocks before committing.

### Rollback Instructions
If the run produces garbage templates: `git -C /Users/lex/settlegrid checkout -- open-source-servers/ && git -C /Users/lex/settlegrid clean -fd open-source-servers/`. The JSONL telemetry under `data/templater/runs/` stays for forensics. API cost is not refundable — treat it as a learning loss and jump to P3.3 for gate tuning before retrying.

### Commit Message Template
```
open-source-servers: add N templates from Templater scale run

Produced N templates across M categories via Templater agent scale
run. Total cost $X.XX, reject rate Y%. All templates pass Phase 1
quality gates.

Refs: P3.2
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.3 — Quality gate tuning from Templater results

**Phase:** 3
**Depends on:** P3.2
**Blocks:** P3.4, P3.12
**Estimated effort:** 5 hours, ~$15
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
The P3.2 run telemetry exposes the real-world failure modes of the Templater agent. Phase 3 exit requires reject rate <30%. This prompt analyzes the JSONL failure log, clusters failure modes, updates `quality-gates.ts` to catch true-positive bugs earlier (cheaper) and relax false-positive rejections, then re-runs any rejected templates to backfill up to the 75-template floor.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/agents/shared/quality-gates.ts`
- `/Users/lex/settlegrid-agents/data/templater/runs/<timestamp>.jsonl`
- `/Users/lex/settlegrid-agents/data/templater/runs/<timestamp>-summary.json`
- `/Users/lex/settlegrid-agents/agents/templater/retry-rejected.ts` (new)

**Relevant existing code to read first:**
- `agents/shared/quality-gates.ts` — current gate implementations
- `agents/shared/__tests__/quality-gates.test.ts` — existing test coverage
- P3.2 summary JSON — the actual failure modes to tune against

**Prerequisites to verify:**
- [ ] P3.2 audit log PASS
- [ ] P3.2 summary JSON exists and lists failure modes
- [ ] Current reject rate documented (baseline for measuring tuning impact)

### Specification
Build a gate tuning loop: (1) parse the P3.2 JSONL telemetry, cluster failures by error message and category; (2) categorize each cluster as "true positive" (gate correctly rejected broken template) or "false positive" (gate over-rejected salvageable template); (3) patch `quality-gates.ts` with new rules for true positives and relaxations for false positives, each change annotated with the cluster ID and sample template; (4) add unit tests fixing the new rules; (5) build `retry-rejected.ts` that re-runs the Templater spec→template pipeline only against entries in the failure log, using tuned gates; (6) cap retry cost at $50 additional. After the retry, the global reject rate must be <30%.

**Files you may touch:**
- `agents/shared/quality-gates.ts`
- `agents/shared/__tests__/quality-gates.test.ts`
- `agents/templater/retry-rejected.ts` (new)
- `agents/templater/__tests__/retry-rejected.test.ts` (new)
- `data/templater/gate-tuning-analysis.md` (new)
- `open-source-servers/**` (only to add templates salvaged by retry)

**Files you MUST NOT touch:**
- Existing passing templates (no rewrites)
- `apps/web/**`
- `packages/**`

**External services touched:**
- Anthropic API (retry run — $50 ceiling)

**Budget constraints:**
- Hard cap: $50 additional Claude spend for this prompt
- Cumulative Phase 3 Templater cost (P3.2 + P3.3) must stay ≤$350

### Implementation Steps
1. Write a scratch script `scripts/analyze-templater-run.ts` (can live under `agents/templater/scripts/`) that reads the P3.2 JSONL and emits a clustered failure report.
2. Manually review clusters. Write `data/templater/gate-tuning-analysis.md` documenting each cluster, verdict (TP/FP), and proposed gate change.
3. Implement gate changes in `quality-gates.ts`. Each new/modified rule must reference its cluster ID in a JSDoc comment.
4. Write tests for every new/modified rule, including a negative test that the prior-version gate would have produced the wrong verdict.
5. Implement `retry-rejected.ts` reusing the P3.1 scale-run infrastructure but limited to the rejected entries list, with its own $50 budget tracker instance.
6. Run the retry with `TEMPLATER_BUDGET_USD=50` and tuned gates. Monitor output.
7. Recompute global reject rate across P3.2 + P3.3 outputs. Assert <30%.
8. Run audit chain on gate changes + new templates.

### Definition of Done
- [ ] `gate-tuning-analysis.md` documents ≥5 failure clusters with verdicts
- [ ] `quality-gates.ts` has new/relaxed rules annotated with cluster IDs
- [ ] All new rules have passing tests; prior rule tests still pass
- [ ] `retry-rejected.ts` runs within $50 budget
- [ ] Post-retry global Templater reject rate <30%
- [ ] Total Phase 3 Templater spend ≤$350
- [ ] `pnpm -w typecheck` passes, `pnpm -w test` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must specifically check for over-relaxed gates that would accept broken templates — pick 3 tuned gates and test that they still reject an obviously broken template.

### Rollback Instructions
`git revert` the gate-tuning commit. Delete any templates produced by the retry. The analysis markdown stays as documentation.

### Commit Message Template
```
quality-gates: tune from Templater scale run telemetry

Analyzed N failure clusters from P3.2 run. Added K new rules for
true-positive bugs, relaxed J over-aggressive rules. Retry run
salvaged M rejected templates. Global reject rate now X%.

Refs: P3.3
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.4 — Templater cost + quality dashboard

**Phase:** 3
**Depends on:** P3.2, P3.3
**Blocks:** P3.12
**Estimated effort:** 5 hours, ~$3
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Phase 4 will want to resume templater runs periodically. A live dashboard makes supervision practical and forces the agent's telemetry to stay clean. This prompt builds `/admin/templater` at `apps/web/src/app/admin/templater/page.tsx`. It reads Templater JSONL telemetry from the agents repo (or an exported snapshot copied into the web repo's data dir) and displays key metrics.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/app/admin/` (create `templater/` subroute)
- `/Users/lex/settlegrid/apps/web/src/app/admin/page.tsx` (existing admin landing)
- `/Users/lex/settlegrid/apps/web/src/lib/admin-auth.ts` (if present, reuse)
- `/Users/lex/settlegrid/apps/web/src/data/templater-runs/` (new, committed snapshots)
- `/Users/lex/settlegrid-agents/data/templater/runs/` (source of truth)

**Relevant existing code to read first:**
- `apps/web/src/app/admin/page.tsx` — see how admin pages are auth-gated
- `apps/web/src/lib/` — find the existing auth/session helper used by admin routes
- `data/templater/runs/<timestamp>-summary.json` — understand available fields

**Prerequisites to verify:**
- [ ] P3.3 audit log PASS
- [ ] At least one run summary exists in `settlegrid-agents/data/templater/runs/`
- [ ] Existing admin auth pattern identified

### Specification
Create a new admin route showing Templater runs. Build: (1) a server component page at `apps/web/src/app/admin/templater/page.tsx` guarded by the same auth as the existing admin landing; (2) a data loader `apps/web/src/lib/templater-runs.ts` that reads JSON snapshots from `apps/web/src/data/templater-runs/*.json`; (3) a sync script `scripts/sync-templater-runs.ts` that copies summaries from the agents repo into `apps/web/src/data/templater-runs/` (committed JSON, not live FS reads, so deploys are deterministic); (4) dashboard UI showing per-run cards with templates-produced, reject-rate, cost, cost-per-template, top-5 failure modes, plus a cumulative spend chart across all runs. Use existing `apps/web/src/components/ui/` primitives.

**Files you may touch:**
- `apps/web/src/app/admin/templater/page.tsx` (new)
- `apps/web/src/app/admin/templater/loading.tsx` (new)
- `apps/web/src/app/admin/templater/error.tsx` (new)
- `apps/web/src/lib/templater-runs.ts` (new)
- `apps/web/src/data/templater-runs/*.json` (new, committed)
- `apps/web/src/lib/__tests__/templater-runs.test.ts` (new)
- `scripts/sync-templater-runs.ts` (new)
- `apps/web/src/components/admin/TemplaterRunCard.tsx` (new)

**Files you MUST NOT touch:**
- Other admin pages
- `apps/web/src/app/learn/**`
- `packages/**`
- `open-source-servers/**`

**External services touched:**
- None

**Budget constraints:**
- Hard cap: $3 (all tooling-level work)

### Implementation Steps
1. Read `apps/web/src/app/admin/page.tsx` to understand the existing admin auth guard. Reuse it verbatim in the new route.
2. Define a TypeScript type for `TemplaterRunSnapshot` matching the agents repo summary JSON schema.
3. Implement `lib/templater-runs.ts` with `loadAllRuns()`, `cumulativeSpend()`, `aggregateFailureModes()`. Pure functions, unit-tested.
4. Write `scripts/sync-templater-runs.ts` that copies files from `/Users/lex/settlegrid-agents/data/templater/runs/*-summary.json` → `apps/web/src/data/templater-runs/` and normalizes filenames.
5. Run the sync script to commit current P3.2 + P3.3 snapshots.
6. Build `TemplaterRunCard` component + the page layout.
7. Add `loading.tsx` and `error.tsx` boundaries per the hardening standard.
8. Write unit tests for the loader + aggregator helpers.
9. Run `pnpm -C apps/web build` to verify the route compiles in a production build.
10. Run audit chain.

### Definition of Done
- [ ] `/admin/templater` loads for admin users, 401s for others
- [ ] Cards show: templates produced, reject rate %, cost, cost-per-template, top failure modes
- [ ] Cumulative spend chart aggregates across all committed snapshots
- [ ] Sync script idempotent; committed snapshots match source
- [ ] `loading.tsx` + `error.tsx` present
- [ ] `pnpm -C apps/web typecheck` passes
- [ ] Unit tests for `templater-runs.ts` pass
- [ ] `pnpm -C apps/web build` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must confirm: (a) unauthenticated access returns 401, not 200; (b) malformed snapshot JSON doesn't crash the page (error boundary catches).

### Rollback Instructions
`git rm -r apps/web/src/app/admin/templater apps/web/src/data/templater-runs apps/web/src/lib/templater-runs.ts apps/web/src/components/admin/TemplaterRunCard.tsx scripts/sync-templater-runs.ts` and revert tests.

### Commit Message Template
```
admin: add Templater cost + quality dashboard

New /admin/templater route showing per-run cards (templates, reject
rate, cost, cost-per-template, failure modes) and cumulative spend.
Dashboard reads committed JSON snapshots synced from agents repo
via scripts/sync-templater-runs.ts.

Refs: P3.4
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.5 — MCP Billing Interop WG research briefs

**Phase:** 3
**Depends on:** P2.12
**Blocks:** P3.12
**Estimated effort:** 6 hours, ~$25
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Convening an MCP Billing Interop Working Group requires 8 personalized outreach emails that the founder writes and sends. Agents produce research briefs only — the actual send is human. Target companies: Stripe, Coinbase, Cloudflare, Anthropic, Smithery, PulseMCP, Zuplo, Neon. Each brief must surface the target's current billing stance, named contacts who have publicly engaged with MCP or payment standards, a proposed meeting topic aligned with the target's strategic interest, and 3-5 talking points.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/data/wg-outreach/` (new)
- `/Users/lex/settlegrid-agents/agents/researcher/` (if Phase 1 built one; else use ad-hoc WebFetch)

**Relevant existing code to read first:**
- Any Phase 1 research agent under `agents/` (check for `researcher/` or `analyst/`)
- `agents/shared/config.ts` — for Claude access

**Prerequisites to verify:**
- [ ] Phase 2 audit log PASS
- [ ] WebFetch tool available in agent runtime
- [ ] Target list confirmed (8 companies above)

### Specification
For each of the 8 target companies, produce a markdown brief at `data/wg-outreach/<company-slug>.md` with sections: (1) **Current billing stance** — 2-3 paragraphs summarizing the target's current position on MCP, payments, or agent economics, sourced from public blog posts, docs, tweets, and GitHub issues; (2) **Named contacts** — a table of 3-5 people at the target who have publicly engaged with MCP or payment standards, with their role, public handle, and a citation link for each; (3) **Proposed meeting topic** — a single sentence framing why a 30-min call benefits the target, not SettleGrid; (4) **Talking points** — 3-5 bullets the founder can riff from; (5) **Do-not-say list** — 2-3 items to avoid (competitive sensitivities). Every factual claim cites a URL. Briefs are for the founder's eyes only — not published, not shipped to production.

**Files you may touch:**
- `data/wg-outreach/stripe.md` (new)
- `data/wg-outreach/coinbase.md` (new)
- `data/wg-outreach/cloudflare.md` (new)
- `data/wg-outreach/anthropic.md` (new)
- `data/wg-outreach/smithery.md` (new)
- `data/wg-outreach/pulsemcp.md` (new)
- `data/wg-outreach/zuplo.md` (new)
- `data/wg-outreach/neon.md` (new)
- `data/wg-outreach/README.md` (index, new)

**Files you MUST NOT touch:**
- Anything outside `data/wg-outreach/`
- No code changes in this prompt
- No outbound emails — briefs only

**External services touched:**
- WebFetch / WebSearch for public source gathering
- Anthropic API (Sonnet for brief synthesis)

**Budget constraints:**
- Hard cap: $25 Claude spend across all 8 briefs (~$3/brief)

### Implementation Steps
1. For each company, run WebSearch for: `"<company>" MCP billing`, `"<company>" model context protocol`, `"<company>" agent payments`. Collect top 10 URLs.
2. WebFetch the top 5 relevant URLs and the company's MCP-related GitHub repos (if any).
3. Draft the brief in markdown using a template: current stance → contacts → meeting topic → talking points → do-not-say. Every claim footnoted with citation.
4. Review for accuracy. Strip any guessed facts; only keep what's sourced.
5. Write `data/wg-outreach/README.md` as an index listing the 8 briefs with one-line summaries and priority order for the founder's outreach sequence.
6. Run audit chain — light tests only (doc-existence, citation presence via grep).

### Definition of Done
- [ ] 8 brief markdown files exist under `data/wg-outreach/`
- [ ] Each brief has all 5 required sections
- [ ] Every factual claim has a citation URL
- [ ] Named contacts table has ≥3 real people per brief
- [ ] Index README with priority order exists
- [ ] No factual claim without a citation (grep check)
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must verify: (a) no fabricated names — every person in a contacts table has a cited public URL; (b) no confidential info leaking into briefs; (c) tone is neutral research, not sales pitch.

### Rollback Instructions
`git rm -r data/wg-outreach/`. No external state.

### Commit Message Template
```
wg-outreach: add research briefs for 8 target companies

Briefs covering current billing stance, named contacts, meeting
topic, talking points, and do-not-say list for Stripe, Coinbase,
Cloudflare, Anthropic, Smithery, PulseMCP, Zuplo, Neon. Founder
writes and sends actual outreach emails.

Refs: P3.5
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.6 — MCP SEP community feedback incorporation

**Phase:** 3
**Depends on:** P1.10 (SEP draft from Phase 1)
**Blocks:** P3.12
**Estimated effort:** 4 hours, ~$8
**Risk level:** Medium
**Rollback complexity:** Hard (external PR visible publicly)

### Context
Phase 1 (P1.10) drafted an MCP SEP (Standards Enhancement Proposal) for billing metadata. This prompt posts the draft to MCP discussions, gathers community feedback over 48-72 hours, incorporates accepted feedback, and submits the formal SEP PR against `modelcontextprotocol/specification`. This is high-visibility work — every word is read by the MCP community, so drafting is human-led with agent assistance.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid-agents/data/sep-drafts/billing-metadata.md` (from P1.10)
- `/Users/lex/settlegrid-agents/data/sep-drafts/feedback-log.md` (new)
- `/Users/lex/settlegrid-agents/data/sep-drafts/final-sep.md` (new)

**Relevant existing code to read first:**
- P1.10 SEP draft
- `modelcontextprotocol/specification` repo conventions (via WebFetch)
- Any prior SEPs merged to understand tone and structure

**Prerequisites to verify:**
- [ ] P1.10 audit log PASS
- [ ] SEP draft exists and is current
- [ ] GitHub access to file a PR against `modelcontextprotocol/specification`
- [ ] Founder is available to post the discussion and field comments

### Specification
Execute: (1) prepare the SEP draft for community discussion — agent produces a polished discussion post version with a clear "what I'm asking for feedback on" framing; (2) founder posts to `modelcontextprotocol/specification` Discussions; (3) agent monitors the thread for 48-72 hours via WebFetch polling and summarizes all comments into `feedback-log.md` with a verdict column (accept / reject with rationale / defer); (4) agent revises the SEP based on accepted feedback into `final-sep.md`; (5) founder reviews, signs off, and the agent prepares a PR branch and description; (6) founder files the PR. Only the discussion-posting and PR-filing are human steps — everything else is agent work.

**Files you may touch:**
- `data/sep-drafts/discussion-post.md` (new)
- `data/sep-drafts/feedback-log.md` (new)
- `data/sep-drafts/final-sep.md` (new)
- `data/sep-drafts/pr-description.md` (new)

**Files you MUST NOT touch:**
- P1.10 original draft (keep as historical record)
- External MCP repos directly — only via PR from a fork

**External services touched:**
- GitHub (discussions read, PR write)
- Anthropic API (feedback synthesis)

**Budget constraints:**
- Hard cap: $8 Claude spend

### Implementation Steps
1. Read the P1.10 SEP draft. Produce `discussion-post.md` — a lighter-weight version with 2-3 explicit open questions to elicit feedback.
2. Founder posts the discussion. Capture the discussion URL.
3. Agent polls the discussion via WebFetch every 6 hours for 72 hours. Store raw comments in `feedback-log.md` with timestamps.
4. After the feedback window, agent writes verdicts for each comment (accept / reject+rationale / defer) and summarizes themes.
5. Agent revises the SEP into `final-sep.md` incorporating accepted feedback. Diff against P1.10 draft shown in `pr-description.md`.
6. Founder reviews `final-sep.md` and signs off.
7. Agent prepares a fork branch `sep-mcp-billing-metadata`, places `final-sep.md` at the correct path in the `specification` repo structure, and produces the PR description.
8. Founder files the PR and captures the URL.
9. Record the PR URL in `data/sep-drafts/README.md`.
10. Run audit chain.

### Definition of Done
- [ ] Discussion posted with URL recorded
- [ ] `feedback-log.md` contains all comments received with verdicts
- [ ] `final-sep.md` exists and incorporates accepted feedback
- [ ] Diff from P1.10 draft documented in `pr-description.md`
- [ ] PR filed against `modelcontextprotocol/specification` with URL recorded
- [ ] `data/sep-drafts/README.md` updated with PR URL
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must specifically check: (a) every rejected comment has a defensible rationale; (b) no fabricated feedback in the log; (c) PR description is honest about what changed vs the draft.

### Rollback Instructions
The PR can be closed but not un-filed. If critical issues surface post-submission, file a revision PR — do not try to rewrite history.

### Commit Message Template
```
sep-drafts: finalize MCP billing metadata SEP from community feedback

Incorporated N accepted comments from discussion thread, rejected
M with documented rationale. Final SEP filed as PR #XXX against
modelcontextprotocol/specification.

Refs: P3.6
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.7 — Directory submission packet builder

**Phase:** 3
**Depends on:** P2.12, P3.2
**Blocks:** P3.12
**Estimated effort:** 5 hours, ~$6
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
SettleGrid needs to be listed in 10+ MCP directories to seed organic discovery. Each directory has different submission formats: PR to a repo (awesome lists), form submission (Glama, Smithery, LobeHub), Vercel template gallery submission, or PulseMCP intake. Auto-submission risks bans. This prompt builds a packet builder: the script produces per-directory submission content (title, description, tags, links, screenshots) in the correct format, the founder copy-pastes or files each.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/scripts/directory-submissions/` (new)
- `/Users/lex/settlegrid/scripts/directory-submissions/packets/` (generated output)
- `/Users/lex/settlegrid/scripts/directory-submissions/build.ts` (new)
- `/Users/lex/settlegrid/scripts/directory-submissions/directories.json` (new)

**Relevant existing code to read first:**
- `scripts/build-registry.ts` — from P2, understand registry metadata shape
- `apps/web/src/app/mcp/[owner]/[repo]/` — see how the shadow directory links

**Prerequisites to verify:**
- [ ] P3.2 audit log PASS (templates exist to submit)
- [ ] Directory list confirmed: Cline MCP Marketplace, PulseMCP, Smithery, Glama, MCPMarket, LobeHub, awesome-mcp-servers (wong2, appcypher, habitoai, PipedreamHQ), Vercel Templates Gallery

### Specification
Build a packet generator: (1) `directories.json` catalogs 10+ targets with submission type, URL, required fields, format constraints (character limits, tag format, logo size); (2) `build.ts` reads directories.json + repo metadata and emits one markdown packet per directory under `packets/<directory-slug>.md`; (3) each packet contains the exact text to paste + step-by-step submission instructions + screenshots to upload (referenced by path in the repo); (4) a top-level `packets/README.md` is the founder's checklist with status column (not-sent / sent / accepted / rejected) per directory; (5) for awesome-list PRs, the packet includes the exact git diff the founder should commit to their fork.

**Files you may touch:**
- `scripts/directory-submissions/build.ts` (new)
- `scripts/directory-submissions/directories.json` (new)
- `scripts/directory-submissions/packets/*.md` (generated)
- `scripts/directory-submissions/packets/README.md` (new)
- `scripts/directory-submissions/__tests__/build.test.ts` (new)

**Files you MUST NOT touch:**
- `apps/web/**`
- `packages/**`
- External directory repos — no direct writes

**External services touched:**
- None in this prompt (founder executes submissions)

**Budget constraints:**
- Hard cap: $6 Claude spend (used for crafting per-directory description variants)

### Implementation Steps
1. Populate `directories.json` with 10+ entries: `{ slug, name, url, submissionType (pr|form|email|gallery), requiredFields, charLimits, logoSize, instructions }`.
2. Write `build.ts` that reads repo metadata (name, description, tags, URL, logo), generates per-directory content adapted to each format, and writes packets.
3. For PR-based directories, the packet includes the exact markdown/JSON diff to add to the target repo.
4. Write tests verifying each packet's character limits are respected and all required fields are populated.
5. Generate all packets. Manually review 3 for quality.
6. Write `packets/README.md` as the founder's submission checklist.
7. Run audit chain.

### Definition of Done
- [ ] `directories.json` has ≥10 entries with complete metadata
- [ ] `build.ts` generates one packet per directory
- [ ] Each packet respects declared character limits (tested)
- [ ] PR-format packets include exact diff snippets
- [ ] `packets/README.md` is a working checklist
- [ ] Tests pass for packet generation
- [ ] `pnpm -w typecheck` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must confirm: (a) no fabricated directory URLs; (b) character limits are accurate (cross-check 3 directories manually); (c) generated content is honest (no keyword stuffing or hype).

### Rollback Instructions
`git rm -r scripts/directory-submissions/`. Founder has not yet submitted, so no external cleanup needed. If submissions are already in flight, leave them; they're unlikely to be reverted.

### Commit Message Template
```
scripts: add directory submission packet builder

Generates per-directory submission content for 10+ MCP directories
(Cline, PulseMCP, Smithery, Glama, MCPMarket, LobeHub, 4 awesome
lists, Vercel Gallery). Founder executes submissions using packets
as the canonical paste-able content.

Refs: P3.7
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.8 — Monetization Academy lesson 1: pricing your MCP server

**Phase:** 3
**Depends on:** P2.12
**Blocks:** P3.9, P3.10, P3.12
**Estimated effort:** 6 hours, ~$10
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
Academy is SettleGrid's SEO content moat. Phase 3 launches with 5 lessons; this prompt produces lesson 1: "How to price your MCP server". It must be 3000-5000 words, LLM-readable, SEO-optimized around pricing keywords, and follow the existing blog post pattern at `apps/web/src/app/learn/blog/[slug]/page.tsx` which serves markdown bodies from `apps/web/src/lib/blog-bodies/*.md` via `blog-posts.ts`. Academy lessons follow the same pattern under a new path.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/app/learn/blog/[slug]/page.tsx` (pattern)
- `/Users/lex/settlegrid/apps/web/src/lib/blog-posts.ts` (pattern)
- `/Users/lex/settlegrid/apps/web/src/lib/blog-bodies/` (pattern)
- `/Users/lex/settlegrid/apps/web/src/app/learn/academy/` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/academy-lessons.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/lib/academy-bodies/` (new)

**Relevant existing code to read first:**
- `apps/web/src/lib/blog-posts.ts` — registration pattern
- `apps/web/src/app/learn/blog/[slug]/page.tsx` — rendering pattern
- `apps/web/src/lib/blog-bodies/mcp-billing-comparison-2026.md` — content tone reference
- `apps/web/src/lib/blog-bodies/mcp-server-free-tier-usage-limits.md` — SEO structure reference

**Prerequisites to verify:**
- [ ] Phase 2 audit log PASS
- [ ] Existing blog post pattern understood
- [ ] SEO target keywords confirmed: "how to price mcp server", "mcp server pricing", "ai tool pricing"

### Specification
Create the Academy routing infrastructure + lesson 1. Implement: (1) `apps/web/src/app/learn/academy/[slug]/page.tsx` mirroring the blog route pattern but reading from `academy-lessons.ts` / `academy-bodies/`; (2) `academy-lessons.ts` registry mapping slugs to `{ title, summary, author, publishedAt, readingTime, bodyModule, ogImage, keywords[], canonicalUrl }`; (3) `academy-bodies/pricing-your-mcp-server.md` — 3000-5000 words covering: intro (why pricing matters for MCP), cost floors (token cost, infrastructure), pricing models (per-call, subscription, usage tiers, freemium), competitive benchmarking (what OpenAI, Anthropic, Stripe charge), pricing psychology for AI buyers, dynamic pricing, case studies, closing + CTA to SettleGrid; (4) OpenGraph metadata, JSON-LD article schema, proper h1-h3 structure, internal links to blog posts and shadow directory; (5) loading.tsx + error.tsx boundaries.

**Files you may touch:**
- `apps/web/src/app/learn/academy/[slug]/page.tsx` (new)
- `apps/web/src/app/learn/academy/[slug]/loading.tsx` (new)
- `apps/web/src/app/learn/academy/[slug]/error.tsx` (new)
- `apps/web/src/lib/academy-lessons.ts` (new)
- `apps/web/src/lib/academy-bodies/pricing-your-mcp-server.md` (new)
- `apps/web/src/lib/__tests__/academy-lessons.test.ts` (new)

**Files you MUST NOT touch:**
- `apps/web/src/lib/blog-posts.ts` (parallel pattern, not modified)
- `apps/web/src/app/learn/blog/**`
- `packages/**`

**External services touched:**
- Anthropic API (Sonnet for draft, Opus for polish pass)

**Budget constraints:**
- Hard cap: $10 Claude spend for drafting + polish

### Implementation Steps
1. Read the blog post pattern thoroughly.
2. Scaffold `apps/web/src/app/learn/academy/[slug]/page.tsx` with the same structure as the blog route.
3. Create `academy-lessons.ts` registry with a single entry for `pricing-your-mcp-server`.
4. Agent drafts the markdown body in 3 passes: outline → expansion → polish. Founder reviews and edits.
5. Ensure word count 3000-5000 (check with `wc -w`).
6. Add JSON-LD article schema, proper metadata (title, description, og), canonical URL.
7. Add internal links to ≥3 existing blog posts and the shadow directory.
8. Add tests: lesson registry returns lesson, body file exists and is non-empty, metadata fields populated.
9. `pnpm -C apps/web build` to verify.
10. Run audit chain.

### Definition of Done
- [ ] `/learn/academy/pricing-your-mcp-server` renders with lesson content
- [ ] Word count 3000-5000
- [ ] JSON-LD article schema present
- [ ] OpenGraph metadata complete
- [ ] ≥3 internal links to blog posts or shadow directory
- [ ] Loading + error boundaries present
- [ ] Tests pass
- [ ] `pnpm -C apps/web build` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must verify: (a) no hallucinated pricing from real competitors — every benchmark has a citation link; (b) no keyword stuffing; (c) the CTA feels earned, not forced.

### Rollback Instructions
`git rm -r apps/web/src/app/learn/academy apps/web/src/lib/academy-lessons.ts apps/web/src/lib/academy-bodies apps/web/src/lib/__tests__/academy-lessons.test.ts`.

### Commit Message Template
```
learn: launch Academy with lesson 1 - pricing your MCP server

New /learn/academy route mirroring the blog pattern with lesson
registry + markdown bodies. Lesson 1 is 3000-5000 words covering
cost floors, pricing models, competitive benchmarks, and psychology
for pricing MCP servers. JSON-LD article schema + OG metadata.

Refs: P3.8
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.9 — Monetization Academy lessons 2-5

**Phase:** 3
**Depends on:** P3.8
**Blocks:** P3.10, P3.12
**Estimated effort:** 10 hours, ~$30
**Risk level:** Medium
**Rollback complexity:** Trivial

### Context
With the Academy infrastructure live from P3.8, this prompt produces the remaining 4 lessons in a batch. Each follows the same 3000-5000 word spec, SEO structure, and quality bar. Lessons: (2) "Per-call vs subscription for AI tools", (3) "Stripe MCP vs SettleGrid vs x402: pick the right payment rail", (4) "The economics of tool calling", (5) "How to calculate margin on an AI API". Lesson 3 is the most politically sensitive (comparative content) — it must be fair and defensible.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/lib/academy-lessons.ts` (extend)
- `/Users/lex/settlegrid/apps/web/src/lib/academy-bodies/` (add 4 files)

**Relevant existing code to read first:**
- P3.8 lesson 1 — established structure and tone
- `apps/web/src/app/learn/blog/` — check if there's an existing Stripe/x402 comparison post to reference

**Prerequisites to verify:**
- [ ] P3.8 audit log PASS
- [ ] Academy infrastructure live
- [ ] SEO targets for each lesson confirmed

### Specification
Produce 4 more lessons following P3.8's exact structure. Each lesson has: (a) markdown body 3000-5000 words; (b) registry entry in `academy-lessons.ts`; (c) JSON-LD + OG metadata; (d) ≥3 internal links. Lesson 3 ("Stripe MCP vs SettleGrid vs x402") must be factually accurate and fair — every claim about a competitor is cited from their public docs. Lessons 2 and 4 are educational foundation content. Lesson 5 is a practical how-to with worked examples.

**Files you may touch:**
- `apps/web/src/lib/academy-lessons.ts` (extend registry)
- `apps/web/src/lib/academy-bodies/per-call-vs-subscription.md` (new)
- `apps/web/src/lib/academy-bodies/stripe-vs-settlegrid-vs-x402.md` (new)
- `apps/web/src/lib/academy-bodies/economics-of-tool-calling.md` (new)
- `apps/web/src/lib/academy-bodies/calculate-margin-on-ai-api.md` (new)
- `apps/web/src/lib/__tests__/academy-lessons.test.ts` (extend)

**Files you MUST NOT touch:**
- Lesson 1 body or registry entry
- Blog posts
- `packages/**`

**External services touched:**
- Anthropic API (Sonnet/Opus)

**Budget constraints:**
- Hard cap: $30 Claude spend across all 4 lessons (~$7.50/lesson)

### Implementation Steps
1. For each lesson, draft outline → expansion → polish using the P3.8 pattern.
2. Lesson 3 requires extra caution: every claim about Stripe MCP, x402, or other competitors must cite a public URL. If a claim can't be cited, drop it.
3. Add each lesson to the registry.
4. Verify word counts (3000-5000) for each.
5. Add internal links: lessons link to each other and to ≥2 blog posts.
6. Extend tests to cover new lessons.
7. `pnpm -C apps/web build` to verify.
8. Founder reviews all 4 before committing — sensitive content.
9. Run audit chain.

### Definition of Done
- [ ] 4 new lesson markdown files exist
- [ ] Each lesson is 3000-5000 words
- [ ] Registry lists all 5 lessons
- [ ] Lesson 3 has competitor citations for every factual claim
- [ ] Each lesson has ≥3 internal links
- [ ] JSON-LD + OG metadata present on all
- [ ] Founder reviewed and signed off on lesson 3 specifically
- [ ] Tests pass
- [ ] `pnpm -C apps/web build` passes
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review of lesson 3 is mandatory: the reviewer must try to identify any claim that could embarrass SettleGrid if quoted by a competitor. Every such claim must either be cited or removed.

### Rollback Instructions
`git rm apps/web/src/lib/academy-bodies/<lesson>.md` and revert registry entries. Lesson 1 stays live.

### Commit Message Template
```
learn: add Academy lessons 2-5

Four new lessons: per-call vs subscription, Stripe/SettleGrid/x402
comparison, economics of tool calling, margin calculation for AI
APIs. Each 3000-5000 words with competitor citations where needed
and internal cross-linking.

Refs: P3.9
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.10 — Academy landing page + RSS feed

**Phase:** 3
**Depends on:** P3.9
**Blocks:** P3.12
**Estimated effort:** 3 hours, ~$2
**Risk level:** Low
**Rollback complexity:** Trivial

### Context
Lessons 1-5 exist at individual URLs from P3.8 + P3.9. Discovery needs a landing page listing all Academy lessons at `/learn/academy` and an RSS feed at `/learn/academy/rss.xml` so subscribers can follow new lessons without polling. This is straightforward Next.js routing.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/apps/web/src/app/learn/academy/page.tsx` (new)
- `/Users/lex/settlegrid/apps/web/src/app/learn/academy/rss.xml/route.ts` (new)
- `/Users/lex/settlegrid/apps/web/src/app/learn/page.tsx` (link to Academy from learn landing)

**Relevant existing code to read first:**
- `apps/web/src/app/learn/page.tsx` — existing learn landing layout
- `apps/web/src/app/learn/blog/page.tsx` if it exists — blog landing reference
- Check if a blog RSS feed already exists to mirror the pattern

**Prerequisites to verify:**
- [ ] P3.9 audit log PASS
- [ ] 5 lessons in the registry
- [ ] Existing learn landing pattern understood

### Specification
Build: (1) `apps/web/src/app/learn/academy/page.tsx` — server component listing all lessons from the registry, sorted by publishedAt desc, with title, summary, reading time, author, publish date, and link to each; (2) `apps/web/src/app/learn/academy/rss.xml/route.ts` — route handler emitting valid RSS 2.0 XML with all lesson entries, proper Content-Type header, cached via `export const revalidate = 3600`; (3) update `apps/web/src/app/learn/page.tsx` to link to the Academy section prominently; (4) loading + error boundaries for the landing page; (5) tests for the RSS feed output.

**Files you may touch:**
- `apps/web/src/app/learn/academy/page.tsx` (new)
- `apps/web/src/app/learn/academy/loading.tsx` (new)
- `apps/web/src/app/learn/academy/error.tsx` (new)
- `apps/web/src/app/learn/academy/rss.xml/route.ts` (new)
- `apps/web/src/app/learn/academy/__tests__/rss.test.ts` (new)
- `apps/web/src/app/learn/page.tsx` (small link addition only)

**Files you MUST NOT touch:**
- `apps/web/src/app/learn/blog/**`
- Academy lesson bodies or registry
- `packages/**`

**External services touched:**
- None

**Budget constraints:**
- Hard cap: $2 Claude spend

### Implementation Steps
1. Read the learn landing page + any existing RSS route.
2. Build the Academy landing page using the registry from P3.8/P3.9.
3. Build the RSS route handler. XML must validate against RSS 2.0. Include `lastBuildDate`, `channel/item` entries with `title`, `link`, `description`, `pubDate`, `guid`.
4. Add loading + error boundaries.
5. Add a small, honest link from `/learn/page.tsx` to Academy.
6. Write a test parsing the RSS XML and asserting all 5 lessons are present.
7. `pnpm -C apps/web build` to verify.
8. Run audit chain.

### Definition of Done
- [ ] `/learn/academy` lists all 5 lessons with metadata
- [ ] `/learn/academy/rss.xml` serves valid RSS 2.0 with correct Content-Type
- [ ] Learn landing page links to Academy
- [ ] Loading + error boundaries present
- [ ] RSS test parses and validates output
- [ ] `pnpm -C apps/web typecheck` + build pass
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must verify: (a) RSS XML actually validates (paste through an RSS validator); (b) Content-Type header is `application/rss+xml`; (c) no unescaped HTML entities in XML output.

### Rollback Instructions
`git rm -r apps/web/src/app/learn/academy/page.tsx apps/web/src/app/learn/academy/rss.xml apps/web/src/app/learn/academy/loading.tsx apps/web/src/app/learn/academy/error.tsx apps/web/src/app/learn/academy/__tests__` and revert the small edit in `learn/page.tsx`.

### Commit Message Template
```
learn: add Academy landing page and RSS feed

Landing page lists all Academy lessons from the registry sorted by
publish date. RSS 2.0 feed at /learn/academy/rss.xml for
subscribers. Learn landing links to Academy prominently.

Refs: P3.10
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.11 — Template CI pipeline with Renovate + codemods

**Phase:** 3
**Depends on:** P3.2
**Blocks:** P3.12
**Estimated effort:** 5 hours, ~$4
**Risk level:** Medium
**Rollback complexity:** Moderate

### Context
With 75-150 templates under `open-source-servers/`, SDK upgrades and breaking changes will rot templates silently. Phase 3 needs automation: Renovate batches dependency updates weekly, the Phase 1 codemod framework handles known breaking changes, and a GitHub Action auto-opens PRs for both. The founder only reviews the auto-PRs, not every template.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/.github/workflows/template-ci.yml` (new)
- `/Users/lex/settlegrid/renovate.json` (new or extend)
- `/Users/lex/settlegrid/scripts/codemods/` (from P1)
- `/Users/lex/settlegrid/scripts/codemods/run-all.ts` (new)
- `/Users/lex/settlegrid/scripts/codemods/sdk-breaking-changes.ts` (new)

**Relevant existing code to read first:**
- `scripts/codemods/` — existing P1 framework foundation
- `.github/workflows/` — existing workflows for patterns
- Any existing `renovate.json` — don't stomp it

**Prerequisites to verify:**
- [ ] P3.2 audit log PASS (templates exist)
- [ ] GitHub Actions enabled on the repo
- [ ] Renovate GitHub App installed on the repo (or note that the founder must install it)
- [ ] P1 codemod framework exists and is usable

### Specification
Build: (1) `renovate.json` config that batches dependency updates across all `open-source-servers/*/package.json`, runs weekly Sundays, groups by major version bumps, auto-merges patches but PRs minors/majors; (2) `scripts/codemods/sdk-breaking-changes.ts` with concrete transforms for known `@settlegrid/mcp` breaking changes (import path changes, renamed exports, removed methods) — each transform tested; (3) `scripts/codemods/run-all.ts` that runs all codemods against `open-source-servers/*` and reports modified files; (4) `.github/workflows/template-ci.yml` that runs weekly on cron, invokes Renovate + codemods, creates a single PR per week with both dependency and codemod changes, labels it `template-ci`, and assigns the founder; (5) smoke tests for 5 random templates after codemod application to verify they still typecheck.

**Files you may touch:**
- `.github/workflows/template-ci.yml` (new)
- `renovate.json` (new or extend)
- `scripts/codemods/run-all.ts` (new)
- `scripts/codemods/sdk-breaking-changes.ts` (new)
- `scripts/codemods/__tests__/sdk-breaking-changes.test.ts` (new)
- `scripts/codemods/README.md` (new or extend)

**Files you MUST NOT touch:**
- `open-source-servers/**` (codemods operate on these, but this prompt does not hand-edit them)
- `apps/web/**`
- `packages/**`

**External services touched:**
- GitHub Actions (execution)
- Renovate bot (if installed)

**Budget constraints:**
- Hard cap: $4 Claude spend

### Implementation Steps
1. Read the P1 codemod framework to understand its transform API.
2. Write `sdk-breaking-changes.ts` with 3-5 concrete transforms for known or anticipated `@settlegrid/mcp` breaking changes. Each transform is a pure function `(ast) => ast` with unit tests.
3. Write `run-all.ts` that walks `open-source-servers/*`, applies all codemods, reports modified files, and exits non-zero if any template fails post-transform typecheck.
4. Write `renovate.json` with the batching + grouping config. Study Renovate docs; don't guess field names.
5. Write the GitHub Actions workflow: weekly cron, checkout, install deps, run Renovate (or rely on the GitHub App if installed), run codemods, create a single PR via `peter-evans/create-pull-request`.
6. Dry-run the workflow locally with `act` or by manually dispatching it in GitHub.
7. Run audit chain.

### Definition of Done
- [ ] `renovate.json` valid (schema check passes)
- [ ] `sdk-breaking-changes.ts` has ≥3 transforms with passing tests
- [ ] `run-all.ts` walks templates and reports results
- [ ] GitHub Actions workflow runs on manual dispatch without errors
- [ ] Workflow creates a PR labeled `template-ci` assigned to founder
- [ ] Codemod-applied templates still typecheck
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must confirm: (a) the workflow cannot push to main directly — only via PR; (b) the Renovate config doesn't auto-merge majors; (c) codemods are idempotent (running twice produces the same result).

### Rollback Instructions
Disable the workflow: `gh workflow disable template-ci.yml`. Revert files: `git revert` the commit. Any in-flight PRs from the bot can be closed.

### Commit Message Template
```
ci: add template CI pipeline with Renovate + codemods

Weekly GitHub Actions workflow runs Renovate and SDK breaking-
change codemods against open-source-servers/, creating a single
consolidated PR per week labeled template-ci. Codemods are
idempotent, transform-based, and individually tested.

Refs: P3.11
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## P3.12 — Phase 3 audit gate

**Phase:** 3
**Depends on:** P3.1, P3.2, P3.3, P3.4, P3.5, P3.6, P3.7, P3.8, P3.9, P3.10, P3.11
**Blocks:** Phase 4 kickoff
**Estimated effort:** 3 hours, ~$3
**Risk level:** Low (process)
**Rollback complexity:** Trivial

### Context
Phase 3 exit criteria are hard gates into Phase 4. This prompt runs a mechanical verification against every exit criterion, producing a verdict report. If any criterion fails, Phase 4 does not start — the failing prompt is re-executed or a remediation sub-prompt is spun up.

**Relevant file paths (absolute):**
- `/Users/lex/settlegrid/phase-3-audit-log.md` (new)
- All P3 prompt outputs across both repos

**Relevant existing code to read first:**
- Phase 2 audit gate output (for format reference)
- P3.2 run summary JSON
- P3.3 post-tuning reject rate
- `data/wg-outreach/README.md`
- `scripts/directory-submissions/packets/README.md`
- `apps/web/src/lib/academy-lessons.ts`
- `.github/workflows/template-ci.yml`

**Prerequisites to verify:**
- [ ] All P3.1–P3.11 audit logs PASS
- [ ] No uncommitted changes in either repo
- [ ] Templater spend accounted for across both P3.2 + P3.3

### Specification
Produce `phase-3-audit-log.md` with a checklist-style verdict against every Phase 3 exit criterion:
1. ≥75 new templates in `open-source-servers/` (count via script, PASS/FAIL)
2. Templater total cost ≤$300 (check summary JSON + retry log, PASS/FAIL)
3. Templater reject rate <30% (compute global rate across P3.2 + P3.3, PASS/FAIL)
4. ≥2 WG outreach replies logged (check `data/wg-outreach/replies.md`, PASS/FAIL — manually verified by founder)
5. ≥5 directory submissions sent (check `scripts/directory-submissions/packets/README.md` status column, PASS/FAIL)
6. Academy lessons 1-5 published at `/learn/academy` (check registry + build output, PASS/FAIL)
7. Template CI pipeline running weekly (check GitHub Actions run history, PASS/FAIL)
8. `pnpm -w typecheck` passes across all repos (PASS/FAIL)
9. `pnpm -w test` passes across all repos (PASS/FAIL)
10. All P3.1–P3.11 audit chains PASS (cross-reference audit logs, PASS/FAIL)

For each criterion, the log records: criterion text, verification method, evidence (URL/file path/command output), verdict. If any item is FAIL, the report ends with a "REMEDIATION" section naming the specific prompts to re-run.

**Files you may touch:**
- `phase-3-audit-log.md` (new)
- `scripts/phase-3-verify.ts` (new, mechanical verification helpers)

**Files you MUST NOT touch:**
- Anything else — this is read-only verification

**External services touched:**
- GitHub API (check Actions run history)
- File system reads only

**Budget constraints:**
- Hard cap: $3 Claude spend (synthesis only)

### Implementation Steps
1. Write `scripts/phase-3-verify.ts` with one function per criterion returning `{ criterion, method, evidence, verdict }`.
2. Run the script and capture the output.
3. Founder manually verifies WG reply count and directory submission status (items 4 and 5 require human eyes).
4. Compose `phase-3-audit-log.md` with all 10 verdicts.
5. If any FAIL: write the REMEDIATION section naming specific prompts to re-run and why. Do not start Phase 4.
6. If all PASS: commit the audit log and tag `phase-3-complete`.
7. Run audit chain on the verification script + audit log.

### Definition of Done
- [ ] `phase-3-audit-log.md` exists with all 10 verdicts
- [ ] Each verdict has evidence (file path, URL, or command output)
- [ ] All 10 verdicts are PASS (if any FAIL, remediation section is present)
- [ ] `scripts/phase-3-verify.ts` is runnable and deterministic
- [ ] Git tag `phase-3-complete` created if all PASS
- [ ] {{AUDIT_CHAIN_TEMPLATE}} all three parts PASS
- [ ] Commit created

### Audit Chain
Execute {{AUDIT_CHAIN_TEMPLATE}}. Hostile review must confirm: (a) every PASS verdict has real evidence, not hand-waving; (b) the verification script genuinely checks what it claims; (c) no criterion was silently dropped.

### Rollback Instructions
If the audit gate fails: do not revert anything. The failed prompts are re-executed per the remediation section. Phase 4 does not start until every criterion is PASS. If the audit log itself is wrong: `git rm phase-3-audit-log.md` and re-run this prompt.

### Commit Message Template
```
phase-3: audit gate - all exit criteria verified PASS

Verified all 10 Phase 3 exit criteria: templates >=75, cost <=$300,
reject rate <30%, WG replies >=2, directory submissions >=5,
Academy lessons 1-5 live, template CI running, typecheck/tests
clean. Phase 4 unblocked.

Refs: P3.12
Audits: spec-diff PASS, hostile PASS, tests PASS
```

---

## Report

Produced the complete Phase 3 document: 12 prompts (P3.1–P3.12) covering Templater scale run (config, execution, tuning, dashboard), WG outreach briefs, MCP SEP incorporation, directory submission builder, Academy lessons 1-5 + landing/RSS, template CI pipeline, and the exit audit gate.

Key design decisions:
- **Templater budget split**: P3.2 hard-capped at $300; P3.3 retry budget of $50 to stay under a $350 Phase 3 Templater ceiling, giving runway for gate tuning without blowing the headline cap.
- **Human-gated steps preserved**: WG emails (P3.5), directory submissions (P3.7), MCP SEP discussion+PR (P3.6) all have agents producing artifacts but founder executing externally — matches the "written by founder, not AI" and "auto-submission risks bans" constraints.
- **Academy pattern reuse**: P3.8 mirrors the existing blog post infrastructure at `/Users/lex/settlegrid/apps/web/src/lib/blog-posts.ts` + `blog-bodies/*.md` under a parallel `academy-lessons.ts` + `academy-bodies/`, matching the "same pattern under a new path" guidance.
- **Audit gate as mechanical verification**: P3.12 uses a script-based verifier so Phase 4 cannot start on hand-waving.

Repo observations that shaped the prompts:
- `/Users/lex/settlegrid/apps/web/src/app/learn/` exists with `blog/`, `page.tsx`, and topical subroutes — Academy goes alongside as `academy/`.
- `/Users/lex/settlegrid/apps/web/src/app/admin/` exists with `page.tsx`, `loading.tsx`, `error.tsx` — new `templater/` subroute follows that pattern.
- `/Users/lex/settlegrid/apps/web/src/app/templates/` exists from Phase 2.
- Existing blog bodies under `/Users/lex/settlegrid/apps/web/src/lib/blog-bodies/` confirm the markdown + registry pattern.
- `/Users/lex/settlegrid-agents/` has `agents/`, `orchestrator/`, `dashboard/`, `data/`, `scripts/` at root — P3.1–P3.3 paths use this layout. The agents repo root was confirmed but the specific `templater/` subdirectory wasn't visible in the top-level listing; prompts treat it as canonical per the user's spec and fall back to inspecting whatever Phase 1 actually produced.
- `{{AUDIT_CHAIN_TEMPLATE}}` and `{{SHARED_CONTEXT}}` placeholders used throughout — never rewritten per instructions.

Total estimated Phase 3 effort: 48-62 engineering hours, $420 Claude API ceiling with the Templater run ($300+$50 retry) as the dominant risk item.
