# V-N3-enable-disclosure — make the invocations on-chain-payer ERASURE explicit + regression-guarded in the deletion-export disclosure — 2026-06-20 (RE-SCOPED)

> **⚠ RE-SCOPED 2026-06-20 after the pre-build plan audit.** The original plan (mirror the ledger:
> add `invocations.metadata.*` payer paths to `minimized`/`retainedUnscrubbed`, flag-gated) was found
> to be **FALSE/contradictory** and was discarded. A 5-lens plan audit + adversarial refuter
> (all `claude-opus-4-8[1m]`, session xhigh) proved: `processDataDeletion` **step 4** already nulls the
> ENTIRE `invocations.metadata` (payer included) for the subject's tools, and `invocations.metadata`
> is ALREADY disclosed under `anonymized`. So the invocations payer is **ERASED on deletion regardless
> of the minimizer flag** — adding it to `minimized` would contradict the `anonymized` claim. The
> ledger differs ONLY because `ledger_entries` is a RETAINED financial record the deletion never
> touches (genuinely retained→minimized). Operator chose: **honest hardening** (this handoff).

> **Chunk:** make the (already-honest) invocations on-chain-payer erasure in `processDataDeletion`
> EXPLICIT in the code contract, and REGRESSION-GUARD it so a future refactor of step 4 cannot
> silently make the `anonymized: ['invocations.metadata']` claim false. **The user-facing disclosure
> JSON stays BYTE-IDENTICAL.** No flag, no new disclosure field, no `isInvocationsPayerMinimizeEnabled`
> reference in `compliance.ts`. Plus a runbook gate-② correction (done by the orchestrator — see §10).

## 0. Authoritative inputs (read first)
- **THIS file** (the binding spec).
- `apps/web/src/lib/settlement/compliance.ts`:
  - `processDataDeletion` **step 4** at `:704-708`: `if (toolIds.length > 0) { tx.update(invocations).set({ metadata: null }).where(inArray(invocations.toolId, toolIds)) }` — the unconditional full-null this chunk documents + guards.
  - `toolIds` construction at `:571-576` (full set of the subject's tools).
  - the `anonymized` array at `:832-887`, esp. the existing `...(toolIds.length > 0 ? ['invocations.metadata'] : [])` at `:865` — the entry whose coverage we make explicit.
  - the **docstring** "KNOWN GAP / MINIMIZATION" block at `:381-393` (currently ledger-only) — extend it to contrast invocations (nulled) vs ledger (retained→minimized).
  - the ledger disclosure object at `:888-925` — **FROZEN reference only**; do NOT touch it.
- Provenance proof (read-only): `apps/web/src/app/api/proxy/[slug]/route.ts` `recordProtocolInvocation` (`:1561` writes `toolId = the subject's tool`, `consumerId = PROTOCOL_SENTINEL_ID`) — why step 4 catches protocol rows.
- Tests to extend: `apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts` (behavioral: `seed()` / `completedResultUrl()` / the captured `updateCalls`) and `apps/web/src/lib/__tests__/compliance-honesty-regression.test.ts` (source-text pins: `region()`, the docstring surface A/B at `:78-83`, the resultUrl surface C, `BANNED_LEGAL_CONCLUSIONS` `:143`, `BANNED_COMPREHENSIVE_SCRUB` `:162`).
- Defect ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md` (honesty parent); DC-23 (the drain `paymentId` provenance — context only; the deletion nulls the WHOLE metadata, so per-key enumeration is NOT needed here).
- Repo `/Users/lex/settlegrid`; gate from `apps/web`. **Base = LOCAL `f84a942b`** (NOT pushed). `origin/main` = `bc7abc3e`.

## 1. Intent — why, who consumes, what it enables
The developer deletion-export (`processDataDeletion`) returns a disclosure object stating, per the DC-16
honesty charter, what data is erased / retained / minimized. The invocations on-chain payer SettleGrid
captures into `invocations.metadata` (x402/circle-nano/drain) is **already ERASED** for a deletion subject:
step 4 nulls the entire `invocations.metadata` column for the subject's tools, and the object discloses
this as `anonymized: ['invocations.metadata']`. This is honest TODAY and is **independent of the
`INVOCATIONS_PAYER_MINIMIZE_ENABLED` flag** (the flag governs the platform-wide write-path/backfill on
rows that are NOT subject to a deletion).

**This chunk** (a) makes that erasure EXPLICIT in the code's documented contract (the docstring + a
co-located comment on the `anonymized` entry), and (b) adds a REGRESSION GUARD so that if a future
refactor removed or narrowed step 4, the now-false `anonymized: ['invocations.metadata']` claim would
FAIL a test rather than ship silently (the canonical DC-16 anti-regression). **Consumer:** the DC-16
honesty posture + the V-N3-erasure ENABLE-RUNBOOK (its gate ② is corrected — see §10). **Enables:** the
invocations minimizer flip becomes a pure platform-data operation that needs **no** deletion-export
disclosure change, simplifying the runbook.

## 2. Tier — HIGH-STAKES (low complexity)
Triggers: it touches the DC-16 **public-claim** surface (the deletion-export disclosure + its pinned
honesty surfaces). The complexity is LOW (no behavioral change, no flag, no JSON-shape change) but the
*surface* is a published compliance claim, so the honesty bar is high. Uncertain → HIGH-STAKES. ② re-confirms.

## 3. Scope
**IN:**
- (a) **compliance.ts docstring** (`:381-393`, the "KNOWN GAP / MINIMIZATION" block): extend it to state,
  accurately, that UNLIKE `ledger_entries` (a retained financial record the deletion does not touch, hence
  minimized over time), `invocations.metadata` IS nulled by THIS deletion (step 4, when the subject owns
  tools), which removes the SettleGrid-captured on-chain payer (and all other metadata) from the subject's
  tools' invocation rows — so it is disclosed under `anonymized`, not retained/minimized. The on-chain
  payer remains permanently public ON-CHAIN regardless. No lawful-basis conclusion; no banned phrases.
- (b) **compliance.ts comment on the `anonymized` entry** (`:865`): add an explanatory comment (matching the
  style of the sibling entries at `:861-864`, `:866-868`, etc.) noting that nulling `invocations.metadata`
  also removes the SettleGrid-captured on-chain payer on the subject's tools' protocol-invocation rows.
- (c) **Behavioral regression pin** (`compliance-deletion-auth.test.ts`): assert that `processDataDeletion`
  on a developer who owns tools (with at least one protocol-invocation row bearing payer metadata) (i) issues
  the step-4 update that sets `invocations.metadata = null` scoped to the subject's tool ids, and (ii) the
  resultUrl `anonymized` array CONTAINS `'invocations.metadata'`. **Non-vacuous:** the assertion must FAIL
  if step 4 is removed/narrowed. Use the existing `seed()` / `completedResultUrl()` / `updateCalls` harness.
- (d) **Source-text honesty pin** (`compliance-honesty-regression.test.ts`): pin that the docstring (surface
  A/B) now states the invocations-metadata erasure / on-chain-payer coverage; that the resultUrl region keeps
  `'invocations.metadata'` in `anonymized`; that the new docstring text matches NONE of
  `BANNED_LEGAL_CONCLUSIONS` / `BANNED_COMPREHENSIVE_SCRUB`. **Non-vacuous** (RED if the new sentence is removed
  or a banned phrase is introduced). Preserve every EXISTING pin verbatim (the ledger sentences are frozen).

**EXCLUDED (the discarded false design + runbook acts):**
- The flag-gated `minimized`/`retainedUnscrubbed` invocations entries (the FALSE design F1 caught). **Do NOT
  add them.** **Do NOT import `isInvocationsPayerMinimizeEnabled` into `compliance.ts`** (it must keep 0 refs).
- ANY change to the user-facing resultUrl JSON shape/values — it stays BYTE-IDENTICAL (§4).
- The ledger disclosure object (`:888-925`) — FROZEN, byte-untouched.
- The flag flip, the backfill RUN, `vercel.json` cron wiring — the runbook's (now-corrected) job.
- The public-docs FAQ (surface D) — verified to make no on-chain-payer claim; untouched.

## 4. Zero-behavioral-change constraint (precise)
**The resultUrl JSON returned by `processDataDeletion` is BYTE-IDENTICAL to today** in every state — the
ONLY source changes are (i) the docstring prose, (ii) a code COMMENT on the `:865` entry, (iii) the two new
tests. No flag, no new field, no money/control/DB-write change. The full existing suite stays green (the
baseline is **tsc 0 / lint 0-err / vitest 207 files · 4736 tests pass**, confirmed on `f84a942b`); the only
additions are the two new pins (§3c, §3d).

## 5. Load-bearing decisions (where ② concentrates — plan-audit RESOLVED; builder MUST honor)
1. **LB1 — the user-facing JSON stays byte-identical; invocations payer paths must NOT enter
   `minimized`/`retainedUnscrubbed`.** This is the corrected core: step 4 ERASES `invocations.metadata`
   (→ `anonymized` at `:865`); listing the same column's paths as retained/minimized would be a
   self-contradictory FALSE claim (the F1 finding). The hardening is documentation + a regression guard
   ONLY. (Refuter `refuted=false`: no subject-attributable retained invocations-payer subset exists — the
   payer is an un-account-linkable third-party address; the schema has no developer/consumer↔payer linkage.)
2. **LB2 — the regression pin MUST be NON-VACUOUS; the BEHAVIORAL clause is the real guard.** The
   `anonymized: ['invocations.metadata']` entry (`:865`) gates on `toolIds.length > 0`, NOT on step 4
   executing — so asserting the `anonymized` STRING alone is **VACUOUS** (it stays GREEN even if step 4 were
   deleted, leaving the claim FALSE). The pin MUST assert the **captured step-4 update** via the existing
   harness (`updateCalls`/`updatePreds` capture `.set()`+`.where()`; `findUpdate :304`, `isInArrayOn :289`,
   `InArrayPred :285`, `completedResultUrl :262` all EXIST): find the update whose `vals.metadata === null`
   **AND** whose predicate is `inArray(invocations.toolId, <seeded ids>)`; assert it is defined, `vals`
   deep-equals `{ metadata: null }`, and the predicate id-list equals the seeded toolIds; PLUS assert
   `anonymized` contains `'invocations.metadata'`. **Key the predicate on `toolId`** (NOT bare
   `metadata===null`) so it does not alias the consumerId-keyed `conversion_events.metadata` scrub (`:743`).
   **Seed `toolIds: [{ id: 'tool-1' }]`** (default seed is `[]` → step 4 never fires). **Do NOT seed a fake
   invocations ROW** (step 4 is a blind read-free update; the mock resolves regardless; a fake row shifts the
   seed-queue slots and breaks the seed contract — the real-row-with-payer scenario is construction-pinned only,
   mirror the SLICE-5 caveat at `:826-828`). **No flag mocking** (step 4 is flag-independent). Confirm RED by
   mentally deleting step 4. (This is the DC-16 anti-regression the cadence prizes.)
3. **LB3 — docstring/comment honesty + banned-phrase + PLACEMENT (BINDING wording guardrails).**
   - **Verb:** "step 4 **nulls** the entire `invocations.metadata` column for the subject's tools" — use
     "nulls/nulled" (the codebase's own term, `:703`). AVOID `wiped|purged|erased|scrubbed` collocated with
     `all|every` + `rows/tables/columns` (trips `BANNED_COMPREHENSIVE_SCRUB`, `:162-168`). "removes … and all
     other metadata" is SAFE.
   - **No lawful-basis conclusion** (trips `BANNED_LEGAL_CONCLUSIONS`, `:143-151`): contrast the ledger as
     "a retained financial record (7-yr IRS/Stripe bookkeeping)", NEVER "permitted/entitled/lawful basis to retain".
   - **Owns-tools qualifier:** every new sentence keeps "for the subject's tools" / "when the subject owns
     tools" (step 4 + the `:865` entry are both `toolIds.length > 0`-gated; an unconditional claim over-states
     for a no-tools developer).
   - **Flag-independence WITHOUT naming the flag:** state the erasure is unconditional on deletion (e.g.
     "independent of any platform-wide minimization schedule") — do NOT write `INVOCATIONS_PAYER_MINIMIZE_ENABLED`
     in `compliance.ts` (keep 0 refs, §7), and do NOT blur it with the ledger flag.
   - **On-chain anchor generic:** "the payer address remains permanently public on-chain via the settlement
     transaction and its EIP-3009 authorization event" — do NOT assert an `invocations.external_ref` column
     (that anchor is the ledger's; verify before naming any column).
   - **C1 (HIGH) — PLACEMENT:** the §3b comment at `:865` lands INSIDE the honesty test's `anonymizedArray`
     source slice (`region(resultUrl,'anonymized: [','retained:')`), which has `.not.toMatch(/ledger_entries/)`
     (`:235`) AND is `BANNED_LEGAL_CONCLUSIONS`-scanned (`:252`). So the `:865` comment must contain NO
     `ledger_entries` substring and NO lawful-basis phrasing — mention ONLY invocations/payer. Put the
     invocations-vs-ledger CONTRAST in the **docstring** (§3a, OUTSIDE the resultUrl slice).
   - **C3:** §3b is a CODE COMMENT, never a string element of the `anonymized` array (else byte-identity + the
     DC-11 path-shape loop `:508-534` break).
   - The step-4 null applies to the WHOLE metadata column — NO per-key/per-rail enumeration (that is the
     minimizer's concern; DC-23 is context-only).

## 6. Exact change locations
- `compliance.ts:381-393` — extend docstring (add the invocations contrast paragraph).
- `compliance.ts:865` — add explanatory comment above/beside the `'invocations.metadata'` anonymized entry.
- `compliance-deletion-auth.test.ts` — append the behavioral non-vacuous pin (§3c).
- `compliance-honesty-regression.test.ts` — append the source-text honesty pin (§3d); preserve all existing pins.

## 7. Frozen / what NOT to touch
FROZEN byte-untouched: the resultUrl JSON shape + values (the disclosure object `:826-927`); the ledger
disclosure (`:888-925`) and its `minimizedNote`/`retainedUnscrubbedNote` text; step-4 logic itself
(we DOCUMENT + GUARD it, we do not change it); `env.ts` (no new flag; `compliance.ts` keeps 0 invocations-flag
refs); the minimizer module; the proxy; the schema; the public FAQ (surface D). Preserve EVERY existing
regression pin verbatim — the ledger OFF/ON note sentences are pinned (`compliance-honesty-regression.test.ts`
`:245` / `:456`).

## 8. Test plan (concrete — from the re-audit)
- **Behavioral (non-vacuous, §3c)** — `compliance-deletion-auth.test.ts`: `seed({ …, toolIds: [{ id: 'tool-1' }] })`
  → `await processDataDeletion('exp-1')` → `const scrub = findUpdate(u => u.vals?.metadata === null &&
  isInArrayOn(u.pred, 'toolId'))`; assert `scrub` defined, `scrub.vals` deep-equals `{ metadata: null }`,
  `(scrub.pred as InArrayPred).inArray[1]` equals `['tool-1']`; AND `completedResultUrl()?.anonymized` contains
  `'invocations.metadata'`. No flag mocking; NO fake invocations row. Confirm RED by removing step 4.
- **Source-text honesty (non-vacuous, §3d)** — `compliance-honesty-regression.test.ts`: pin the docstring region
  (`:79-83`, covers `:381-393`) matches a phrase UNIQUE to the new invocations paragraph (e.g. `/invocations\.metadata/`
  + a `null`/erasure token NOT shared with the frozen ledger text); ADD a new resultUrl-region pin
  `region(resultUrl,'anonymized: [','retained:')` → `toMatch(/'invocations\.metadata'/)` (no such pin exists today).
  The new docstring prose must trip NO banned regex (the existing whole-region banned scans enforce this → RED on a
  banned phrase). Preserve EVERY existing pin verbatim. (Both source-text clauses are static guards; the real step-4
  coupling is the §3c behavioral clause.)
- **Existing suite UNCHANGED-green** (byte-identical JSON ⇒ existing behavioral + regression pins untouched;
  baseline = 207 files / 4736 tests + the 2 new).

## 9. Gate (re-run clean from `apps/web`)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (pre-existing warns
only) · vitest green: the two new pins PASS; the rest UNCHANGED-green (207 files / 4736 tests + the 2 new).
All gate commands are session-allowlisted.

## 10. Sequencing / lifecycle + runbook gate-② correction
- **Runbook gate-② correction (orchestrator does this in the re-scope, NOT the build agent):** the
  enable-runbook (`docs/tech-debt/v-n3-erasure-enable-runbook-2026-06-20.md`) gate ② and §5.4 are corrected to
  state that the invocations deletion-export disclosure is ALREADY honest (step 4 erases → `anonymized`,
  flag-independent), so flipping `INVOCATIONS_PAYER_MINIMIZE_ENABLED` needs NO deletion-export disclosure
  change and is NOT blocked on a disclosure chunk. This chunk (honesty hardening) does NOT gate the PROD flip.
- **Lifecycle:** scope-confirm ✓ → THIS (re-scoped) handoff + re-run plan audit (closed in the orchestrator
  session) → BUILD (fresh single-writer agent; byte-identical JSON, docstring + comment + 2 pins; do NOT
  commit/push — ② commits at seal, /push-go gates push) → executable gate + interval self-verify → ② seal-gating
  review → seal + bookkeeping → ③ post-seal deep audit.
