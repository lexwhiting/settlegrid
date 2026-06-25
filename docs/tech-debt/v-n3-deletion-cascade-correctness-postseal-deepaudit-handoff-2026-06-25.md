# ③ POST-SEAL DEEP-AUDIT HANDOFF — V-N3-deletion-cascade-correctness — 2026-06-25

**Tier: HIGH-STAKES** → ③ warranted. ② sealed clean (see `v-n3-deletion-cascade-correctness-seal-record-2026-06-25.md`). This audit is the integrated-whole, post-seal hostile pass on the SEALED commit. Doc-of-record for intent: the build handoff `v-n3-deletion-invocations-cascade-correctness-handoff-2026-06-25.md` (§0–§11).

## 0. What shipped (the sealed change)
`processDataDeletion` (DORMANT — zero prod callers) steps 2-3 changed from `tx.delete(apiKeys)` to `tx.update(apiKeys).set({ status:'revoked', ipAllowlist:null })`, so the `invocations.api_key_id` NOT-NULL ON DELETE CASCADE never fires → invocation rows (own-tool + foreign-tool) survive; step 4 nulls own-tool metadata. Plus: a pglite cascade-faithful integration test (keystone), mock-suite revoke conversion (3 surfaces), and an honest `retainedUnscrubbed`/`retainedUnscrubbedNote` disclosure of the now-retained pseudonymous foreign-tool linkage incl. (added at ②) the foreign-tool `invocations.metadata` retention.

## 1. ③ must carry the MAX-tier core-invariant pass (deferred from ②)
Per operator choice at ②, the `max`-effort core-invariant lens was NOT run at ② (Path 1 unavailable; ② ran it at xhigh + proved the invariant by live mutation). **③ is its designated home.** Run the core-invariant lens (data integrity: "invocations survive deletion; a revoked credential cannot authenticate anywhere; no cross-principal over-deletion") at **`max`** — realize via a Path-1 `effort: max` named subagent if a pool is stood up, else a Path-2 operator `/effort max` pass or Path-3 dedicated process. Concentrate on: the three cascade vectors into `invocations`; the F5 pushSchema-vs-migrations residual (does building from schema.ts mask any prod-DDL divergence on the cascade — DC-14); de-auth completeness across ALL apiKey consumers (re-grep, don't trust the 5+1 list).

## 2. Open LOW findings from ② to resolve or formally accept
- **F1** (note/array gating asymmetry): the `retainedUnscrubbedNote` invocation+metadata prose is unconditional, but the `retainedUnscrubbed` array entries are gated on `consumerMatched`. For a no-twin subject the persisted note describes foreign-tool retention + a step-2 pseudonymization that did not occur (conservative over-disclosure, no false erasure). Decide: gate the note clause on `consumerMatched`, general-phrase it, or formally accept (it parallels the unconditional `organizations.billing_email` note treatment). Frozen-surface caution: the note carries the verbatim-pinned ledger-payer sentence (`compliance-honesty-regression.test.ts:245`) and runtime pins — any edit must preserve them.
- **F2** (flag-conditioning): the metadata clause's "may hold the captured on-chain payer" is not conditioned on `INVOCATIONS_PAYER_MINIMIZE_ENABLED` (live in prod). The "may" hedge keeps it accurate; decide whether to mirror the ledger clause's flag-split or accept the hedge.

## 3. Noted-no-fix items to re-confirm at the integrated level
- Integration test de-auth assertion is data-state-only ("assert the gate", per F2) — the auth-path rejection rests on the manual audit; ③ should re-verify the 5+ paths against the integrated route surface.
- Integration test doesn't isolate step 3 (KEY_OWN also consumerId-keyed); step-3 covered at the mock level. Consider whether a dedicated non-twin foreign-caller seed strengthens the keystone.
- `apiKeys.status` is `text` not pgEnum (typo-tolerant); schema migration is OUT of scope here — but ③ may record the global CASCADE footgun (FK→SET NULL hardening) + the status-enum as DEFERRED hardening candidates (do NOT pull in).

## 4. Staging / hygiene (verify on the sealed commit — see `git log`)
The seal commit staged: `compliance.ts` + the 4 test files + the new integration test + `package.json` + `package-lock.json` + the 3 docs/tech-debt artifacts (10 files, +718/−47). EXCLUDED: `tools/page.tsx` (slugify carry-forward, still in the working tree), `.claude/` (untracked), `.audit/` (gitignored — DC-16 ledger stays local). **`package-lock.json` WAS included on purpose** — verified at `/seal-go` to be the pglite addition + a drift-correction re-syncing the lock to the ALREADY-COMMITTED workspace versions (`settlegrid` 0.2.0 / `@settlegrid/mcp` 0.3.0 in HEAD; `packages/*` package.json unmodified), required for `npm ci` consistency — NOT carry-forward. ③ should still sanity-check the committed lock matches `npm ci`. Repin the config-dir model `opus[1m]` → `claude-opus-4-8` (SessionStart WARN; restart-downgrade hazard). **Not pushed — `/push-go` gates push.**

## 5. Frozen surfaces (do not perturb without re-scoping)
All `processDataDeletion` steps except 2-3 + the §4 disclosure; the ledger-payer `retainedUnscrubbed`/`minimized`/notes incl. the verbatim payer sentence; step-4 metadata-null logic; the single-bucket invariant (each column PATH in exactly one bucket array; metadata is `anonymized`-only, foreign-tool retention is prose-only). `invocations.api_key_id` stays ON DELETE CASCADE (the FK migration is DEFERRED).

## 6. Gate (re-run clean from `apps/web`)
`npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err · 208 files / 4753 tests; confirm the pglite integration test actually executes (non-vacuous, ~3-7s). All gate commands session-allowlisted.

## 7. Defect-class ledger pointers
DC-16 (new ② instance — partial-scrub-vs-bucket-claim; SEAM string-uniqueness ≠ substantive honesty), DC-15 (comment drift, corrected), DC-05/DC-14 (the mock-vs-real cascade blind spot this chunk closed; F5 residual), DC-13 (dormant-springs-on-wired-caller). See `.audit/defect-ledger/`.
