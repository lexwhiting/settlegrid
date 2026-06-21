# V-N3-enable-disclosure — ② SEAL-GATING REVIEW record — 2026-06-20

> **Result: CLOSED CLEAN → SEAL (awaiting operator `/seal-go` to commit).**
> Tier RE-CONFIRMED **HIGH-STAKES (low complexity)**, not escalated. Zero high, zero
> medium findings across 5 fresh-context lenses + integrator. One LOW fixed in-session
> (F1, comment accuracy), one pre-existing LOW deferred (F2, harness coverage gap).

## Chunk
Make the (already-honest) invocations on-chain-payer ERASURE in `processDataDeletion`
EXPLICIT in the code contract and REGRESSION-GUARD it, so a future refactor of step 4
cannot silently make the `anonymized: ['invocations.metadata']` claim false. **User-facing
resultUrl JSON stays BYTE-IDENTICAL.** No flag, no new disclosure field, 0 references to
`isInvocationsPayerMinimizeEnabled` in `compliance.ts`.

Realized diff (3 in-scope files):
- `apps/web/src/lib/settlement/compliance.ts` (+20 / −0) — docstring contrast paragraph
  (`:395-406`) + a `//` code comment (`:878-884`) above the pre-existing
  `...(toolIds.length > 0 ? ['invocations.metadata'] : [])` entry (`:885`). **Comment-only
  at runtime** — every added line is a `*`/`//` comment.
- `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` (+40 / −0) — behavioral
  non-vacuous pin (the load-bearing guard) + a negative-gate test.
- `apps/web/src/lib/__tests__/compliance-honesty-regression.test.ts` (+30 / −0) — source-text
  honesty pins (docstring A/B + resultUrl C). (+2 lines vs the build's 28 from the F1 reword.)

EXCLUDED from the seal: `tools/page.tsx` (unrelated carry-forward), `.claude/`, `.audit/`.

## Gate (my own clean isolated runs — build emitted no self-verification evidence, so treated
as RED and re-run from scratch)
- Pre-fix: `npx tsc --noEmit` 0 · `npm run lint` 0 · `npx vitest run` 0 → **207 files / 4740
  tests pass** (baseline 4736 + the 4 new pins).
- Post-F1-fix (the sealed state): `tsc` 0 · `lint` 0 · `vitest` 0 → **207 files / 4740 tests
  pass**, 0 TS errors, 0 FAIL. (Comment reword left the count unchanged.)

## Orchestration / policy
- Env clean: `CLAUDE_CODE_FORK_SUBAGENT` / `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_EFFORT_LEVEL`
  all **UNSET**. No silent model/effort override.
- Session effort **xhigh** (`~/.claude-3/settings.json effortLevel`); no model pin → Opus 4.8.
- Path-1 effort-bearing subagent defs **ABSENT** (no `.claude/agents/`). Operator opt-in (asked
  + waited): **Agent-tool spawns** (bypassPermissions moots the workflow loud-pause; small
  comment-only diff) at **xhigh + live reproduction**; the `max` core-invariant bump NOT taken
  (the invariant is fully live-reproducible). Allowlist GREEN (git/tsc/vitest/lint present;
  reviewers read-only + gate Bash; no MCP/WebFetch needed).
- 5 lens-distinct fresh-context reviewers, each pinned `model: opus` (Opus 4.8), inheriting
  session xhigh. Integrator triage + live reproduction in the main session.

## Lenses (coverage mode) and verdicts
1. **Correctness / determinism** — CLEAN (0). Proved resultUrl JSON byte-identical (slice +
   strip-comments + diff → IDENTICAL). Enumerated all `tx.update()` in `processDataDeletion`:
   step 4 is the unique `metadata:null` + `inArray-on-toolId` update; near-aliases excluded
   (conversion_events.metadata is consumerId-keyed; step 7b is toolId-keyed but sets
   `developerResponse`; step 8 sets `crawlMetadata` and keys on `tools.id`). No seed-queue or
   mock-isolation hazard.
2. **Spec-conformance** — PASS. §3 (a–d) present; §3 EXCLUDED clean (no flag import, no
   minimized/retainedUnscrubbed invocations entry, ledger object frozen); §4 byte-identical;
   §5 LB1/LB2/LB3 + C1/C3 honored; §6/§7 conform. `tools/page.tsx` confirmed unrelated → kept
   out of seal.
3. **Core-invariant (DC-16 honesty / non-vacuity / byte-identity)** — PASS. 7 mutations in a
   throwaway worktree all turn the targeted assertion RED. Every new docstring/comment sentence
   verified TRUE against `schema.ts` (`invocations.metadata` is one jsonb column) and
   `invocations-payer-min.ts`; on-chain anchor stated generically (no invented column); owns-tools
   qualifier honest. Banned-scan green confirmed GENUINE by injection (inject "exempt" /
   "across all tables" → scans go RED). Two LOW findings (F1, F2 below).
4. **SEAM** — SEAL STANDS. Payer capture is complete inside `invocations.metadata` for ALL rails
   (x402 / circle-nano / drain / mpp) — confirmed against `recordProtocolInvocation`,
   `recordMppInvocation`, and the drain path; **including the DC-23 drain `paymentId` (== raw EVM
   channel address)**, which step 4's whole-column null erases. No payer field lives outside
   `metadata`. `region()` markers unique (no aliasing with `processDataExport`). Read-after-null
   safe (the export path doesn't select `metadata`).
5. **Literal-execution** — No defect. The drizzle test-mock represents columns as their own
   name-string, so `isInArrayOn(pred,'toolId')` genuinely discriminates step 4; `inArray[1]`
   really is `['tool-1']` and `vals` really is `{metadata:null}`; `completedResultUrl()?.` throws
   (not silently passes) on null; all three honesty regions slice non-empty and pin text unique to
   the new edits.

## Integrator live reproduction (the seal filter)
Re-keyed step 4 `inArray(invocations.toolId, …)` → `inArray(invocations.consumerId, …)` in the
MAIN tree → behavioral pin **RED** (`step 4 must issue update(invocations)…: expected undefined
to be defined`; 1 failed | 41 passed). Restored → **GREEN** (42 passed). Tree byte-clean
afterward (20/40/30). The disclosure clause stayed green under the break (it gates on
`toolIds>0`, not on step 4) — exactly the vacuity the behavioral clause exists to catch.

## Findings disposition
- **F1 [LOW, fixed in-session]** — the new honesty block-comment claimed the resultUrl
  `'invocations.metadata'` ENTRY "exist[s] ONLY after this chunk." Inaccurate: the entry
  **pre-existed** (handoff §0 — "the existing entry whose coverage we make explicit"); only the
  docstring paragraph, the code comment, and the source-text PIN are new. The test is functionally
  sound (it correctly guards the load-bearing pre-existing disclosure entry; removing it → RED).
  Corrected to a precise reword (comment-only; no assertion changed; gate re-run GREEN). In-scope
  (the chunk's own new, non-frozen comment) and thematically right for a DC-16 honesty chunk.
- **F2 [LOW, DEFERRED]** — pre-existing harness coverage gap: `BANNED_COMPREHENSIVE_SCRUB` is run
  over the `docstring`/FAQ/email regions but NOT over the `resultUrl` region, so a future
  comprehensive-scrub paraphrase added as a resultUrl COMMENT could pass the gate. **Pre-existing,
  not introduced by this chunk.** Fixing it = adding a scan to the frozen honesty harness = scope
  creep beyond the handoff → deferred (DC-16 honesty-harness hardening candidate, alongside the
  prior chunk's deferred census-lexer item). The current real `:885` comment is clean.

No new defect class. No SEAM/LITERAL-EXECUTION recurrence to file (both lenses clean).

## Frozen-surface integrity
Ledger disclosure object + `minimizedNote`/`retainedUnscrubbedNote`, step-4 logic, `env.ts`, the
minimizer module, the proxy, the schema, the public FAQ — all byte-untouched. `compliance.ts`
keeps **0** invocations-flag references. Every existing regression pin preserved (test diffs are
pure appends; zero `-` lines).

## What `/seal-go` commits (operator gate — Claude does not self-commit)
`apps/web/src/lib/settlement/compliance.ts`, the two `__tests__` files, this seal-record, and
`docs/tech-debt/v-n3-enable-disclosure-handoff-2026-06-20.md` (+ the orchestrator's
runbook gate-② correction `v-n3-erasure-enable-runbook-2026-06-20.md` per handoff §10).
**EXCLUDE** `tools/page.tsx`, `.claude/`, `.audit/`. Push remains the separate `/push-go` gate.

## Next
HIGH-STAKES → **③ post-seal deep audit** (`/p3`). Base after `/seal-go` = the new local commit;
parent = `f84a942b` (V-N3-invocations-min ②+③); `origin/main` = `bc7abc3e`.
