# V-N1 (+V-N3) — validBefore upper-bound cap — ① PREP / KICKOFF-FOR-FRESH-SESSION (2026-06-14)

> Founder chose V-N1 (+V-N3 bundle) as the next chunk (2026-06-14, after V-N4 ③ RE-CERTIFIED + pushed). This stub
> captures the decision + the grounding already done so a FRESH session can run the full ① (investigate → resolve
> the founder policy → comprehensive handoff → pre-build plan audit → kickoff) WITHOUT re-deriving. Written because
> the V-N1 ① is HIGH-STAKES money/contract work best done with fresh context, not at the tail of the long
> V-N4-③/commit/push session. Founder-gated throughout (V-N4+W are now PUSHED to origin/main as of this session;
> V-N1 reverts to the standard local-build cadence — never push without explicit founder say-so).

## Decision + tier
- **Chunk: V-N1 (cap `validBefore`) + V-N3 (GDPR erasure for `ledger_entries`) bundled** (the register says
  "bundle with V-N1"; V-N1's cap bounds the attacker-inflatable PII surface V-N3 must erase).
- **Tier: HIGH-STAKES.** Triggers: adds a BUYER-FACING contract (a new 402 reject code at both verifiers);
  touches a correctness/anti-abuse boundary (unbounded `validBefore` → immortal `pending` rows); V-N3 touches a
  PII/compliance boundary (`ledger_entries` retention/erasure). ② may re-confirm/escalate.
- **Source-of-truth:** `docs/tech-debt/s-deep-audit-register-2026-06-10.md` lines 136 (V-N1), 153 (V-N3), 135
  (priority order). Both were tagged FOUNDER-decision in the register — now greenlit to build (pending the two
  policy answers below).

## What V-N1 fixes (the problem, grounded)
Both verifiers reject EXPIRED authorizations but DO NOT cap a far-FUTURE `validBefore`:
- `apps/web/src/lib/settlement/circle-nano/verify.ts:181` — `if (nowSec > validBefore) reject('expired')`; no upper cap.
- `apps/web/src/lib/settlement/x402/verify.ts` — same shape (rejects expired only).
A buyer can mint a ref-NULL `pending` row with `validBefore` = year 2099 that NEVER wall-expires → permanent
`pending_overdue` / `noTxhashCount` inflation (the alarm-fatigue (V) set out to kill, only HALF-closed) AND permanent
indexed payer-PII in `operation_id` + `metadata.payer` (the V-N3 surface). Rate limits bound the RATE; nothing bounds
ACCUMULATION. Fix: reject `validBefore > now + MAX_WINDOW` with a NEW buyer-facing 402 code, at BOTH verifiers.

## ⚠ The two LOAD-BEARING decisions most likely to be silently wrong (concentrate audit here)
1. **The MAX_WINDOW cap VALUE.** Too SHORT → rejects LEGITIMATE slow settlements: a real payment must stay valid
   across broadcast→confirm + the reconciler's safe-head lag (Base `safe` trails `latest` ~5–10 min) +
   `EXPIRY_MARGIN_SECONDS=300` + retries + clock skew. Too LONG → leaves the immortal-row surface open. MUST be
   grounded in the ACTUAL legitimate `validBefore` range — investigate first (do NOT guess):
   - Where does the buyer/SDK SET `validBefore`? Grep `packages/mcp` + the x402 facilitator path + any
     CircleNanoProof construction for the default window (the fresh session MUST find this before recommending a cap).
   - Cross-check the x402 protocol norm and the settlement timing constants (`RECEIPT_TIMEOUT_MS=30s`,
     reconciler cron `*/15`, `EXPIRY_MARGIN_SECONDS=300`, safe-head lag).
   - STRAWMAN to validate, NOT to adopt blindly: a cap on the order of 1–6 h comfortably covers legit latency while
     killing the 2099 abuse — but VERIFY against the real SDK default before proposing.
2. **Retroactivity — existing immortal rows.** The verify-time cap stops NEW abuse but does NOT clean rows ALREADY in
   the DB with `validBefore` years out. "Root fix of the immortal-row cluster" implies handling existing rows too
   (a one-time quarantine/backfill, or letting the reconciler's expiry pass treat over-cap rows as a new quarantine
   class). Decide explicitly: verify-time-only (new rows) vs verify-time + a backfill for existing rows. A
   verify-only fix that LEAVES the existing 2099 rows would not actually close the alarm-inflation it targets.

## Founder POLICY answers needed before a buildable handoff (collect at kickoff)
- **V-N1 Q1:** the MAX_WINDOW cap value (after the fresh session grounds it in the SDK default + settlement timing
  and brings a recommendation).
- **V-N1 Q2:** retroactive cleanup of existing over-cap rows — in scope or deferred? (see decision 2 above).
- **V-N1 Q3:** the new 402 error code name + buyer-facing message (a naming choice — the fresh session may propose
  and the founder ratify; lower-stakes than Q1/Q2).
- **V-N3 Q:** GDPR posture for `ledger_entries` — the `data-retention` cron deletes 6 tables but NOT
  `ledger_entries` (zero `delete(ledgerEntries)` tree-wide); the payer EVM addr is indexed in `operation_id` +
  `metadata.payer`. Decide: add an erasure/retention path for anonymous x402 payer rows vs document a financial-
  retention exemption. (Register line 153–158; ledger DC-16-adjacent.)

## Frozen / careful surfaces (the build must not perturb without authorization)
- The EIP-3009 domain / signature verify logic (only ADD the upper-bound check alongside the existing expiry check).
- The credit path (V-N2 territory — NOT this chunk).
- The on-chain readers + `runExpiryPass` (V-N4-sealed; this chunk is verify-side, not reconciler-side — but if Q2
  picks "reconciler quarantines over-cap rows," that touches `runExpiryPass` and RAISES the audit focus there).

## Defect-class ledger lenses to charge (from `.audit/defect-ledger/INDEX.md`)
DC-09 (immortal/unconfirmable rows — the core), DC-18 (alarm-fatigue/detector truthfulness — the inflation),
DC-16-adjacent (V-N3 PII/retention), DC-12 (incomplete boundary guard — the new cap must be total: integer parse,
overflow, the `validAfter < validBefore` interplay), DC-07 (the cap must match at BOTH verifiers — multi-surface
drift), DC-15 (any doc/contract claim the cap changes).

## Cadence for the fresh session
scope-confirm (this stub + register) → ground the cap (investigate SDK default + timing) → collect the founder
policy answers → draft plan → **pre-build plan audit (HIGH-STAKES full lens set, this-session, closes before build
code)** → build → gate → ② seal-gating review → seal. Run the plan audit as a workflow if the operator says
`ultracode`/"run as a workflow"; else Agent-tool spawns (all reviewers `claude-opus-4-8`, xhigh). Effort: xhigh for
the build; recommend `/effort max` only for a genuinely hard stretch.
