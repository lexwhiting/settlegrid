# V-N3-invocations-min — `invocations.metadata` EVM-payer minimization (DARK, flag-gated) — ① BUILD HANDOFF (2026-06-20, plan-audited)

> Standalone build handoff. READ THIS FIRST (step zero), before any code. Read alongside it:
> `v-n3-log-redaction-handoff-2026-06-19.md` §11 (this chunk's scope rider) and
> `v-n3-erasure-post-seal-deep-audit-2026-06-19.md` §93-168 (the DC-16 enable blocker that names
> this surface); the sibling TEMPLATE `apps/web/src/lib/settlement/anonymize-payer.ts` +
> `apps/web/src/app/api/cron/payer-anonymize/route.ts` + `.../admin/payer-anonymize-backfill/route.ts`
> (mirror their LIFECYCLE, NOT their retention machinery — see §7); the DC-16 ledger
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`. Repo `/Users/lex/settlegrid`;
> gate from `apps/web`. Base = `main` @ `bc7abc3e` (V-N3-log-redaction ②+③, pushed to origin/main).
> **A 5-lens pre-build plan audit + 2 refuters folded the findings below — they are BINDING.**

## 1. Intent — why, who consumes, what it enables
The `invocations.metadata` jsonb column persists the raw EVM on-chain payer address that SettleGrid
CAPTURES while settling a protocol payment (x402 / circle-nano / drain) — written by the proxy at
`recordProtocolInvocation`. This is the SECOND of the two DC-16 "census" surfaces that block the
V-N3-erasure ENABLE (the first — settlement-log + Sentry redaction — shipped at `bc7abc3e`). While
this surface still retains the raw payer, flipping the counsel-gated payer-minimization enable
(which drives the `compliance.ts` disclosure "SettleGrid minimizes its retention of the anonymous
on-chain payer's raw EVM address") would be a **NEW DC-16 over-statement**. **This chunk builds the
flag-gated MECHANISM** (write-path minimize + backfill) **to minimize the EVM payer in
`invocations.metadata`, DARK by default**, so that the enable-runbook can flip the posture honestly
across BOTH surfaces. **Consumer:** the DC-16 honesty posture + the V-N3-erasure ENABLE gate.
**Enables:** with this landed (alongside the already-landed log-redaction), the V-N3-erasure enable
becomes unblockable (the enable-runbook is a SEPARATE counsel-gated act — see §11).

## 2. Tier — HIGH-STAKES
PII minimization + a DB write-path INSIDE the money-rail proxy (`recordProtocolInvocation`) + a new
feature flag + a disclosed-honesty-claim gate (DC-16). Uncertain → high-stakes. ② re-confirms.

## 3. Scope
**IN:**
- (a) **A pure, EXTRACTED minimizer** — new module (suggest `apps/web/src/lib/settlement/invocations-payer-min.ts`,
  sibling to `anonymize-payer.ts`): `minimizeInvocationMetadata(meta: Record<string, unknown>): Record<string, unknown>`.
  It **RAIL-GATES** off `meta.paymentMethod` (see §6 for the key census + §5#1 for WHY rail-gate, not
  value-shape). Pure, idempotent, returns a SHALLOW COPY (NEVER mutates its argument). Export it (so the
  guard + unit pins can test it — `recordProtocolInvocation` is NOT exported, §5#5).
- (b) **CHANNEL — write-path**: in `recordProtocolInvocation` (route.ts:1520), when the flag (§3d) is ON,
  apply the minimizer to the **fully-MERGED** metadata object (i.e. AFTER the `...params.extraMetadata`
  spread at :1555 — minimizing the pre-spread literal would let the rail-injected `payer`/`payerAddress`/
  `drainNonce`/`drainChannelId` bypass it). Gate INSIDE the helper (one gate covers BOTH callers :1681 +
  :1821 AND the upstream-error path that still writes `payerIdentifier`). OFF → byte-unchanged (dark).
- (c) **Backfill** — a flag-gated cron + admin route over EXISTING rows (mirror `cron/payer-anonymize` +
  `admin/payer-anonymize-backfill`). The jsonb rewrite MUST be **SQL surgical key-subtraction (F5 — never
  an object-overwrite)** — see §5#3 + §6. Dark (no-op while OFF; NOT wired into `vercel.json`).
- (d) **A NEW dedicated flag** `isInvocationsPayerMinimizeEnabled()` in `apps/web/src/lib/env.ts`
  (strict `=== 'true'`, default OFF; mirror `isLedgerPayerAnonymizeEnabled` env.ts:412). NOT a reuse of
  the ledger flag (see §5#4 + §11 for the enable coupling).
- (e) **An anti-regression CENSUS GUARD test + minimizer unit pins** (§9) — the durable DC-16
  anti-regression for this surface.

**EXCLUDED → enable-runbook (a SEPARATE counsel-gated act, NOT this chunk — DC-16 ledger explicitly
"carry to the enable-runbook, NOT this dark merge"):** the flag flip; the backfill RUN; the
`compliance.ts` disclosure amendment (extend `minimized`/`minimizedNote` to enumerate the invocations
payer paths) + the `compliance-honesty-regression.test.ts` extension + a flag-ON regression pin;
`vercel.json` cron wiring. **§11 carries the coupling requirements the runbook MUST honor** — record
them in the handoff so the runbook author doesn't flip the surfaces independently.

**EXCLUDED — genuinely out of the census (R2 / different data class):**
- **Non-EVM `payerIdentifier`s** (ap2 `consumerId`, ucp `paymentHandler`, acp `customerId`, l402
  `preimageHash`, mastercard `intentId` [503 stub], alipay `agentId`, kyapay `principalId`, emvco
  `tokenRef`, visa-tap `tokenReferenceId`) — opaque protocol ids, NOT EVM addresses; the rail-gate
  (§5#1) leaves them untouched. Over-minimizing them would break attribution.
- **`recordMppInvocation` (route.ts:1427) — the SECOND invocations writer** — writes
  `mppPayerCustomerId` (a Stripe `cus_…` id, non-EVM). Deliberately RETAINED (R2). The guard (§9) MUST
  enumerate this writer so it neither misses it nor false-flags the Stripe id; the write-path minimizer
  (§3b) does NOT wrap it.
- **`sdk/meter-with-metadata`** developer-supplied free-form `invocations.metadata` — the DEVELOPER's own
  metering data (real developer consumerId, no settlement, no SettleGrid-captured payer). The documented
  self-hoster carve-out analogue (`sanitizing-adapter-logger.ts:15`). Out of the DC-16 settlement-captured-payer
  census; the sentinel-scoped backfill never touches it. NOT a defect this chunk addresses.
- The wholesale GDPR deletion scrub (`compliance.ts:703-709`, full-null) + the retention purge
  (`cron/data-retention`) — unchanged (order-independent with minimization, §5#3). No schema change / no
  GIN index (gold-plating — `metadata` is not indexed; do NOT add one).

## 4. Zero-behavioral-change constraint
Money/control flow of the proxy is byte-unchanged. The ONLY production change is: (i) the metadata
OBJECT passed to `db.insert(invocations)` inside `recordProtocolInvocation`, gated by the new flag
(OFF → identical to today); (ii) the new flag helper; (iii) the new minimizer module; (iv) the new
backfill cron+admin routes (dark, unwired). The FULL existing suite stays green; the only new tests are
the minimizer pins + the census guard (§9). Any OTHER behavioral change is a regression.

## 5. Load-bearing decisions (where ② concentrates — most likely SILENTLY WRONG; plan-audit RESOLVED, builder MUST honor)
1. **RAIL-GATE `payerIdentifier`, NEVER a value-shape test (the convergent finding — refuter STANDS, could
   not break).** `payerIdentifier` is a UNION key: a raw EVM address for {x402, circle-nano, drain} and an
   opaque non-EVM id for the other rails. A value-shape test is wrong in BOTH directions: viem `isAddress`
   defaults to STRICT EIP-55 → REJECTS an attacker-cased mixed-case address (the stored `from`/`payerAddress`
   is VERBATIM-unnormalized — x402.ts:98/440, circle-nano/verify.ts:265 [case-folded equality only],
   drain.ts:594 [`EVM_ADDRESS_RE` is case-INsensitive]), so a non-checksum payer EVADES removal → **raw payer
   persists with the flag ON**; and `{strict:false}` accepts ANY 40-hex → OVER-minimizes live caller-supplied
   non-EVM ids (kyapay `principalId`=JWT sub, visa-tap `tokenReferenceId`=raw token, both can be 40-hex).
   **FIX (binding): remove `payerIdentifier` IFF `paymentMethod ∈ {'x402','circle-nano','drain'}`** — value-shape
   independent, immune to both failure modes. `paymentMethod` is written on 100% of protocol rows
   (route.ts:1550) and that set is EXACTLY the EVM-address rails (verified against the `PaymentMethod` type
   route.ts:1476). The gate MUST also fire on the upstream-error write path (route.ts:~1690, which still writes
   `payerIdentifier` for these rails) — gating INSIDE the helper (§3b) achieves this.
2. **Unconditional KEY-removal (by name) for the four keys `{payer, payerAddress, drainNonce, drainChannelId}`
   — NOT a value test.** `drainNonce` is a JS **number** at runtime (drain.ts:596), not a string. A value-shape
   redaction would mishandle it (the chunk-1 B1 seam: a non-string value escapes a string redactor). Remove these
   keys by NAME unconditionally (they are EVM-only keys — `payer`/`payerAddress` only on circle-nano,
   `drainChannelId`/`drainNonce` only on drain; no non-EVM collision). NOTE: **x402 writes NO fixed `payer` key**
   — its entire EVM-payer coverage rests on the rail-gated `payerIdentifier` arm (§5#1), so that arm is NOT
   optional. (`drainNonce` is a small channel counter, NOT the EIP-3009 256-bit nonce — do NOT justify its
   removal with the ledger's PK-brute-force rationale; it is channel-correlation minimization.)
3. **Backfill = SQL surgical `-` subtraction, NEVER an object-overwrite (the F5 lesson — anonymize-payer.ts:271
   "NEVER an object-overwrite").** A Drizzle `.set({ metadata: <js-minimizer-output> })` would CLOBBER every
   RETAINED key (`proxy`, `paymentMethod`, `paymentId`, `toolSlug`, `upstreamStatus`, `network`, `amountUsdc`,
   `drainAmountUsdc`, …). Use `metadata - 'payer' - 'payerAddress' - 'drainNonce' - 'drainChannelId'` (or
   `metadata - '{payer,payerAddress,drainNonce,drainChannelId}'::text[]`) plus a rail-gated conditional for
   `payerIdentifier`: `CASE WHEN metadata->>'paymentMethod' IN ('x402','circle-nano','drain') THEN <…> - 'payerIdentifier' ELSE <…> END`.
   **Predicate (binding):** `consumer_id = '00000000-0000-0000-0000-000000000002'` (the PROTOCOL sentinel — EXCLUDES
   the mpp sentinel `…0001` AND the sdk/meter developer rows) AND `jsonb_typeof(metadata) = 'object'` (defense vs
   the 22023 "cannot delete from scalar" wedge — invocations metadata is developer-influenced, so unlike the
   rigidly-shaped ledger row the object-or-null guarantee does NOT hold; though the sentinel scope makes the
   rows object-or-null in practice, KEEP the guard) AND `metadata ?| array['payer','payerAddress','drainNonce','drainChannelId','payerIdentifier']`
   (so clean/non-candidate rows drop out → idempotent re-run converges to zero scanned). The write-path (§3b)
   uses the JS minimizer (it owns the fresh object); the backfill uses the SQL form — they are TWO mechanisms
   for the same key-set, kept consistent via the shared key constant (§9).
4. **A NEW dedicated flag (not a reuse), and the ENABLE coupling (DC-15 — handoff CARRIES it).** A separate
   `isInvocationsPayerMinimizeEnabled` is architecturally correct (the V-N3-erasure gate is "both surfaces
   LANDED", not "one flip"; `compliance.ts` is keyed to the LEDGER flag and never asserts an invocations
   minimization, so a separate OFF flag creates NO false claim from `compliance.ts` itself). BUT the public
   ENABLE posture can over-state cross-surface if the ledger flag flips while the invocations backfill hasn't
   run. So §11 records the runbook coupling REQUIREMENT (flip both + backfill both + amend the disclosure to
   enumerate invocations paths). Chunk 2 stays DARK; the disclosure work is the runbook's.
5. **Extract the minimizer + a NON-VACUOUS census guard (DC-05).** `recordProtocolInvocation` is NOT exported
   (route.ts:1520) → the minimizer must live in its own exported module so the guard + unit pins can test it.
   The guard must be a STATIC source scan (per the chunk-1 `log-redaction-guard.test.ts` pattern + the
   `credit-writer-census.test.ts` / `verifier-exactamount-census.test.ts` analogs) that enumerates the per-rail
   `extraMetadata` builders + the `recordProtocolInvocation` + `recordMppInvocation` metadata literals FROM
   SOURCE and FAILS if a NEW EVM-payer-shaped metadata key appears outside the minimizer's coverage (this is how
   `drainChannelId` was originally missed — a vacuous "the 5 known keys are removed" guard would NOT catch a 6th).

## 6. The EVM-payer key census (audit-corrected; RE-GREP live — the guard is the bar, not these numbers)
Writer `recordProtocolInvocation` (route.ts:1520): `metadata` literal :1548-1556 = `payerIdentifier` (always,
:1552) + `...extraMetadata` (:1555). Per-rail keys carrying a raw EVM payer:

| Rail | `payerIdentifier` (route.ts) | extra EVM keys | minimizer action |
|---|---|---|---|
| x402 paid | `authorization.from` (:2014) | — (none) | rail-gated remove `payerIdentifier` |
| x402 free | `x402Result.payerAddress` (:1950) | — | rail-gated remove `payerIdentifier` |
| circle-nano paid | `proof.authorization.from` (:2171) | `payer` (:2175) | rail-gated `payerIdentifier` + drop `payer` |
| circle-nano free | `validation.payerAddress` (:2108) | `payerAddress` (:2110) | rail-gated `payerIdentifier` + drop `payerAddress` |
| drain | `result.payerAddress` (:2453) | `drainChannelId`(EVM contract) + `drainNonce`(NUMBER) (:2461) | rail-gated `payerIdentifier` + drop `drainChannelId`,`drainNonce` |
| ap2/ucp/acp/l402/alipay/kyapay/emvco/visa-tap/mastercard | a NON-EVM id | own-prefixed non-EVM keys | NONE (rail-gate skips; keys not in the set) |
| **mpp (recordMppInvocation :1427)** | n/a (`mppPayerCustomerId`=Stripe id) | — | NONE (R2, deliberately retained; guard enumerates it) |

**Minimizer key set:** unconditional-remove `{payer, payerAddress, drainNonce, drainChannelId}` (by name) +
rail-gated-remove `payerIdentifier` when `paymentMethod ∈ {x402, circle-nano, drain}`. Keep a single
source-of-truth constant for this set, consumed by BOTH the JS minimizer AND the guard. (Note: the
`sanitizing-adapter-logger.ts` `PAYER_META_KEYS` list is a DIFFERENT surface — its key is `channelId`, here it
is `drainChannelId` — do NOT share that constant; the divergence is correct, but the guard should note it.)

## 7. Frozen / unchanged + what NOT to copy from the ledger sibling
FROZEN: proxy money/control flow; `recordMppInvocation`; the deletion scrub + retention purge; the ledger
anonymizer (`anonymize-payer.ts`); `compliance.ts` (enable-runbook, not this chunk); the schema. **DO copy from
the sibling:** the dark-flag gate shape, the verifyCronAuth on BOTH the cron + admin route (the DC-03/DC-21
constant-time bearer seam — used across all 32 cron/admin sites; copy the three-branch `no-secret`→500 /
`unauthorized`→401 / `ok` block verbatim, do NOT collapse `no-secret` into `unauthorized` per DC-08), the
batched keyset cursor on `(created_at, id)` WITH the microsecond `::text` cursor caveat (the postgres.js
JS-Date millisecond-truncation bug — anonymize-payer.ts:168-189), the budget/`MAX_BATCHES` cap, counts-only
logging, idempotent re-run. **DO NOT copy (would be wrong/over-built — invocations has NO money-path/replay
coupling, NO operation_id, ZERO in-app readers):** the retention-window / `ANONYMIZE_WINDOW_FLOOR_SECONDS` /
`isAnonymizationEligible` predicate, the terminal-status filter, the operation_id rewrite, the
optimistic-concurrency WHERE keyed on the payer value. The invocations backfill is a straight sentinel-scoped
+ key-presence row scan + surgical jsonb subtraction.

## 8. Design (direction — build refines)
- `invocations-payer-min.ts`: `export const INVOCATIONS_EVM_PAYER_KEYS` (the unconditional set) +
  `export const EVM_PAYER_RAILS = ['x402','circle-nano','drain']`; `export function minimizeInvocationMetadata(meta)`
  → shallow-copy, delete the unconditional keys, delete `payerIdentifier` iff `EVM_PAYER_RAILS.includes(meta.paymentMethod)`;
  pure, idempotent, input unmutated.
- `env.ts`: `export function isInvocationsPayerMinimizeEnabled(): boolean { return process.env.INVOCATIONS_PAYER_MINIMIZE_ENABLED === 'true' }`.
- `recordProtocolInvocation`: build the merged metadata object, then `const md = isInvocationsPayerMinimizeEnabled() ? minimizeInvocationMetadata(merged) : merged` before `.values({ metadata: md })`.
- `cron/invocations-payer-min/route.ts` + `admin/invocations-payer-min-backfill/route.ts`: mirror the sibling
  routes' auth + batching; the UPDATE per §5#3.
- Guard: a vitest that `readFileSync`-scans route.ts, asserts the set of EVM-payer-shaped metadata keys across
  BOTH writers ⊆ (minimizer set ∪ rail-gated `payerIdentifier`); RED on a synthetic injected 6th key.

## 9. Test plan
- **minimizer unit pins** (the extracted helper): EVM `payerIdentifier` removed for EACH of x402/circle-nano/drain;
  NON-EVM `payerIdentifier` KEPT (ap2/ucp/kyapay/visa-tap fixtures); all four keys removed incl. a **number**
  `drainNonce`; non-payer keys (`proxy`,`paymentMethod`,`toolSlug`,`amountUsdc`,…) preserved; idempotent;
  input object NOT mutated; OFF-flag → identity.
- **write-path pin**: a `recordProtocolInvocation`-shaped metadata (merged, per rail) → flag ON yields no EVM
  payer key + keeps correlation keys; flag OFF → unchanged. (Mock the flag + the db insert; assert the object
  handed to `.values`.)
- **census guard** (§5#5): non-vacuous (RED on a synthetic raw EVM key added to a writer literal; GREEN on the
  current source); scans real route.ts; enumerates BOTH writers; asserts mpp's `mppPayerCustomerId` is the
  documented retained exception (not flagged).
- **backfill pin**: a fixture row set (EVM rails + a non-EVM row + an already-clean row + a null-metadata row +
  the mpp sentinel row) → after backfill: EVM payer keys gone, non-EVM `payerIdentifier` + mpp row + retained
  keys intact, idempotent re-run no-ops. (Use the project's DB-test harness if present; else assert the SQL
  expression builds + a dry-run predicate.)
- Existing suite UNCHANGED-green (behavioral equivalence; flag default OFF).

## 10. Gate (re-run clean from `apps/web`)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (12 pre-existing warns)
· vitest green: the new minimizer/guard/write-path/backfill pins PASS; the rest of the suite UNCHANGED-green.

## 11. Sequencing + the ENABLE-RUNBOOK coupling (carry — DC-15)
- This chunk ships DARK. AFTER it lands, the V-N3-erasure ENABLE becomes unblockable (BOTH census surfaces now
  have a minimization mechanism). **The enable-runbook (a SEPARATE counsel-gated act) MUST:** (1) flip BOTH
  `LEDGER_PAYER_ANONYMIZE_ENABLED` AND `INVOCATIONS_PAYER_MINIMIZE_ENABLED`; (2) RUN both backfills (ledger +
  invocations) to completion BEFORE amending the disclosure; (3) amend `compliance.ts` so the `minimized`
  array + `minimizedNote` ALSO enumerate the invocations payer paths (`invocations.metadata.payer` /
  `.payerIdentifier` / …) — today it lists only `ledger_entries.*`; (4) add a flag-ON regression pin asserting
  the conjunction. **Do NOT do any of (1)-(4) in this chunk.** (Alternative the runbook may choose: gate the
  `compliance.ts` `minimized` branch on BOTH flags so the broadened claim can never appear with one surface
  live — runbook's call.) Without these, flipping the ledger flag alone re-opens the DC-16 over-statement.

## 12. Lifecycle
scope-confirm ✓ → THIS handoff + the 5-lens plan audit + 2 refuters (closed in the orchestrator session) →
BUILD (fresh single-writer agent; ships DARK behind the default-OFF flag) → executable gate + interval
self-verify → ② seal-gating review → seal + bookkeeping → founder-close. Then the V-N3-erasure ENABLE-RUNBOOK
(separate, §11).
