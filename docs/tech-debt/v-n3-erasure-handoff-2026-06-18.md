# V-N3-erasure — `ledger_entries` payer-PII minimization — ① BUILD HANDOFF (2026-06-18)

> Standalone build handoff. READ THIS FIRST (step zero), before any code. Read alongside it:
> `v-n3-erasure-decision-brief-2026-06-18.md` (the greenlit decision package, Option B) and
> `v-n3-ledger-entries-gdpr-retention-gap-2026-06-14.md` (the surface census). Repo
> `/Users/lex/settlegrid`; gate from `apps/web`. Base = `main` @ `b40a0a4a` (DC-03 pushed).
> **Greenlit posture: build NOW, counsel-gate the irreversible steps** — code lands DARK behind a
> disabled flag; the backfill run, the flag enable, and any privacy-notice publish stay gated on
> counsel's lawful-basis sign-off. **Reframed (operator-greenlit): this is data-MINIMIZATION, not
> absolute erasure** — see §4.

## 1. Intent — why, who consumes, what it enables
Every settlement row in `ledger_entries` persists the anonymous on-chain payer's raw EVM address in
two columns: `operation_id` (= `{rail}:{network}:{payer}:{nonce}`, the replay/idempotency key) and
`metadata.payer`. There is **zero deletion/scrub of these tree-wide**; the `data-retention` cron skips
`ledger_entries` entirely. `compliance.ts` now *honestly* discloses this as a KNOWN GAP (the V-N3
honesty SLICEs fixed the earlier false "scrubbed" claim — do NOT re-fix that). **This chunk builds the
data-minimization path:** a retention job + one-time backfill that, on **fully-terminal, credit-resolved,
aged** rows, replaces the raw payer (and nonce) in `operation_id` with an opaque token and nulls
`metadata.payer` — removing the raw address from SettleGrid's queryable surfaces (internal queries,
the `operation_id` index, future compliance exports). **Consumer:** the compliance/retention posture
(reduced direct PII footprint) + counsel's lawful-basis determination. **Enables:** an honest
"we minimize our direct retention of the payer address after N days" posture, replacing today's
"retained un-scrubbed (known gap)".

## 2. Tier — HIGH-STAKES
Triggers: mutates the **money-rail dedup/idempotency key** (`operation_id`) — even if only on terminal
rows; touches **PII**; changes a **compliance claim/disclosure**; the backfill is an **irreversible**
data transform. Uncertain edges resolve to high-stakes. ② re-confirms.

## 3. Scope — Option B only (state the merge decision explicitly)
**IN:** (a) one shared anonymization transform + a **safe-to-anonymize predicate** (§6.1); (b) a daily
**cron job** (mirror `cron/data-retention`, reuse `verifyCronAuth`) that anonymizes rows crossing the
retention window; (c) a **one-time backfill** (same transform/predicate, re-runnable, batched) over
existing eligible rows; (d) **both gated behind a disabled env flag** (`§7`); (e) update
`compliance.ts`'s disclosure (`:373-391`, the `retainedUnscrubbed` result) to reflect the
minimization + the on-chain residual honestly; (f) a config constant for the retention window.

**EXCLUDED (do NOT merge — keep the heavy audit on the terminal-row seam):**
- **Option A (write-time pseudonymization of `operation_id` going forward)** — mutates the LIVE key on
  every settlement; high money-path regression risk. Separate, separately-audited follow-up; the brief
  ruled it out of the first chunk. Do not touch `x402OperationId`/`circleNanoOperationId`.
- **The privacy-notice publish** (counsel-gated, separate; this chunk ships no user-facing language).
- **P9 credit-finality**, the `middleware.ts` gate-cookie, any other backlog item.
- Do NOT touch `external_ref` (the on-chain tx hash — the retained money trail; see §4), the PK `id`
  (§6.2), `getCronSecret`/`verifyCronAuth` (reuse as-is), the live settlement write path, or
  `x402OperationId`/`circleNanoOperationId`.

## 4. The PII surfaces + the on-chain residual (the honesty constraint)
Persisted payer-address surfaces (the minimization targets): **`ledger_entries.operation_id`** and
**`ledger_entries.metadata.payer`** (`= authorization.from`). Confirmed CLEAN: no payer address in any
log/Sentry sink. **On-chain residual (load-bearing for the disclosure):** the settlement is an on-chain
USDC `transferWithAuthorization`; `external_ref` stores its tx hash, which we **retain** (the financial
record). The on-chain transfer's `from` is the payer and the EIP-3009 nonce is in the on-chain
`AuthorizationUsed` event — so the payer address (and nonce) are **permanently public on-chain**.
**Therefore: DB anonymization is data-MINIMIZATION, not absolute erasure.** The `compliance.ts`
disclosure and any future counsel/privacy language MUST say "minimize our direct retention" and MUST
NOT claim "erased"/"scrubbed-to-unknowable" — claiming erasure of an on-chain-public address would be a
NEW DC-16 false claim. This honesty is part of the build's done-definition.

> **③ POST-SEAL CENSUS CORRECTION (2026-06-19) — this §4 census is INCOMPLETE.** The deep audit found
> the raw payer address ALSO persists in two further surfaces this §4 did not name, neither addressed by
> this Option-B build: (1) the indexed jsonb **`invocations.metadata.payer` + `.payerIdentifier`** (proxy
> `route.ts:1550`/`:2168`, from `proof.authorization.from`; purged only if a developer's
> `logRetentionDays>0`, `0=keep forever`), and (2) **settlement LOGS → stdout+Sentry** — `reconcile.ts:704-710`
> logs raw `from` + `nonce` + the un-anonymized `operation_id` at ERROR level (mirrored to Sentry), plus
> ~32 op_id-logging sites (op_id = payer+nonce). The claim "Confirmed CLEAN: no payer address in any
> log/Sentry sink" is RETRACTED. The `ledger_entries` de-identification invariant still HOLDS (the nonce is
> in `operation_id` only; `authorization_signals`/`authorization_artifact` are NULL for these rows). The
> consequence is a flag-ON DC-16 over-statement risk that BLOCKS enable until resolved — see
> `v-n3-erasure-post-seal-deep-audit-2026-06-19.md` (HARDENED ENABLE-RUNBOOK) and DC-16 ledger.

## 5. The design (Option B)
### 5a. The anonymization transform (one function, used by both the cron and the backfill)
For an eligible row, in a single UPDATE:
- Rewrite `operation_id` → remove BOTH the payer and the nonce segments, replacing them with an opaque,
  uniqueness-preserving token: e.g. `{rail}:{network}:anon:{row_id}` (the row's own PK `id` is already a
  hash and is unique → guarantees no collision; OR a fresh random token). **Removing the nonce too is
  required** so the PK `id` (= `sha256("settlement:"+operation_id)`) is no longer brute-forceable from
  the stored row (the nonce was the only remaining non-enumerable preimage segment — §6.2).
- Null `metadata.payer` (preserve every other `metadata` key — surgical jsonb update, do NOT clobber the
  object).
- Do NOT touch `id`, `external_ref`, `amount_cents`, `settled_at`, `credited_at`, status, or any
  financial column.

### 5b. The cron job (`apps/web/src/app/api/cron/<name>/route.ts`)
Mirror `cron/data-retention` EXACTLY for the harness: rate-limit (`getClientIp` + `checkRateLimit`) →
`verifyCronAuth(request.headers)` with the verbatim no-secret-500 / unauthorized-401 mapping →
`maxDuration = 300`, batched (`BATCH_SIZE` ~1000), idempotent. **Guarded by the disabled flag (§7):**
if the flag is off, return a 200 no-op (`{ anonymized: 0, enabled: false }`) — never anonymize while
dark. Select rows matching the predicate (§6.1) where `created_at < now - window`, anonymize in
batches, log counts (NO payer address in logs). Register the schedule in `vercel.json` only when the
flag is enabled (or register it disabled-by-flag — operator decision; default: add the route, gate by
flag, do not wire the schedule until enable).

### 5c. The one-time backfill
Same transform + predicate, no window lower bound issue (it targets ALL existing eligible rows). A
script or a flag-gated admin route; re-runnable (anonymizing an already-anon row is a no-op — the
predicate excludes `operation_id LIKE '%:anon:%'`/null-payer rows); batched; **dark-flag-gated**;
emits a manifest (counts, batch progress) and NEVER runs until counsel sign-off flips the flag.

## 6. Load-bearing decisions (where ② concentrates — most likely to be SILENTLY WRONG)
1. **The safe-to-anonymize PREDICATE (THE decision).** A row is safe to anonymize ONLY when no live
   reader will ever look it up by `operation_id` again. The traps:
   - **`reconcile.ts:963` `uncredited_settled` sweep** reads `operation_id` on `settled` rows with
     **`credited_at IS NULL`** (open credit-resolution incidents) and logs them as the operator's
     runbook closure keys. Anonymizing such a row destroys the operator's ability to close the incident.
     → predicate MUST require **`credited_at IS NOT NULL`** for settled reconcilable-rail rows.
   - **In-flight rows:** `markSettlementSettled/Failed/Broadcast` + `findSettlementRow` (`ledger.ts`) and
     the reconciler all `eq(operationId)` on `pending`/non-terminal rows. → predicate MUST require a
     **terminal** `settlement_status` (`settled`/`failed`/`voided`/`reversed`), NEVER `pending`.
   - **Aged:** `created_at < now - RETENTION_WINDOW`.
   - Net predicate (≈): `settlement_status IN ('settled','failed','voided','reversed') AND created_at <
     now - W AND NOT (settlement_status='settled' AND rail is reconcilable AND credited_at IS NULL) AND
     operation_id NOT already-anonymized`. The build agent MUST re-derive this against the LIVE readers
     (grep every `eq(ledgerEntries.operationId, …)` and every `metadata.payer` reader) and pin it with
     tests. A too-eager predicate breaks money/ops; a too-timid one just anonymizes less (safe).
2. **Remove the NONCE too, and LEAVE the PK `id`.** `id = sha256("settlement:"+operation_id)` encodes
   the payer as a hash. If `operation_id` keeps the nonce, an attacker with the row can brute-force the
   payer (enumerable address space) and match `id` → re-identification WITHOUT the chain. Removing BOTH
   payer and nonce from `operation_id` makes the `id` preimage contain a now-unstored 32-byte nonce →
   brute-force infeasible → leaving the PK `id` is acceptable (and rewriting a PK is high-risk; confirm
   nothing FKs to `ledger_entries.id`). Silently-wrong failure: anonymizing the payer but keeping the
   nonce (re-identifiable), or rewriting `id` and orphaning the row.
3. **Backfill irreversibility + dark-gating.** The transform is irreversible. It must be impossible to
   run while the flag is off, impossible to touch a non-predicate row, idempotent/re-runnable, and
   batched so it can't lock the table. Silently-wrong failure: a backfill that runs on flag-default-on,
   or whose batch txn touches a live row.

## 6.5 Plan-audit fixes — FOLDED (binding amendments to §3–§9; the 5-lens pre-build audit found these)
The pre-build plan audit (5 lenses + integrator ground-truth, 2026-06-18) confirmed the core safety
argument (the EIP-3009 nonce is stored ONLY inside `operation_id` — no other column/metadata/table —
so removing payer+nonce genuinely de-identifies the PK `id`; nothing FKs `ledger_entries.id`). It also
found these SUSTAINED gaps. **All are binding; the build re-confirms each live before folding.**

**MUST-FIX (load-bearing):**
- **F1 — RAIL-SCOPE the transform/predicate to the two payer-bearing rails.** Only `x402OperationId`
  and `circleNanoOperationId` embed the EVM payer+nonce (`{rail}:{network}:0x<40>:0x<64>`). The other
  5 rails (ap2, mcp, acp, ucp, mastercard-vi) write a DIFFERENT opid shape with no payer PII. §6.1's
  predicate as written (terminal+aged+credited-carve-out) would match THEIR terminal rows too and
  needlessly mutate their dedup keys. **Add `rail IN ('x402','circle-nano')` to the predicate**
  (== `RECONCILABLE_RAILS`, `rails.ts:18`). §9 pin: a non-payer-rail (e.g. ap2) terminal aged row is
  NEVER anonymized. (Also excludes legacy `rail IS NULL` / `operation_id IS NULL` double-entry rows.)
- **F2 — HARD FLOOR on the retention window.** The safety of anonymizing TERMINAL rows rests on the
  window exceeding the replay window: terminal idempotency readers (`orchestrate.ts:409` `alreadySettled`,
  `circle-nano/settle.ts:304` `PREVIOUSLY_FAILED`, and the in-request `findSettlementRow(operationId)`
  re-read after `ensurePendingRow`) read `operation_id` on settled/failed rows for **≤ `MAX_VALIDBEFORE_WINDOW_SECONDS`
  = 3600s** after `created_at` (V-N1 caps `validBefore ≤ now+3600`; verify rejects EXPIRED before the
  idempotency read). A too-short window would anonymize a still-replayable settled row → a buyer's
  idempotent retry misses `alreadySettled` → **double-forward to upstream / double-credit**. **Validate
  the window config `≥ MAX_VALIDBEFORE_WINDOW_SECONDS + reconciler olderThanMs + skew` (floor ≥ 1 day);**
  assert it in code (throw on a sub-floor value) + test it. §9 pin: a terminal row whose `created_at` is
  INSIDE the replay window (e.g. `now-30min`) is NOT anonymized even though terminal. Default 2555d is
  safe; counsel choosing "shorter for PII" must not cross the floor.
- **F3 — the one-time backfill is the FLAG-GATED ADMIN ROUTE ONLY, never a standalone script.** A CLI
  script cannot be protected by `verifyCronAuth` (HTTP-header auth) and its only guard would be an
  honor-system `if(!flag)` that `LEDGER_PAYER_ANONYMIZE_ENABLED=true npx tsx …` defeats — an irreversible
  transform must not be runnable by a per-shell env var. The backfill route inherits HTTP `verifyCronAuth`
  + the deployed-env runtime flag (flipping the flag IS the counsel-gated act). Amend §3(c)/§5c: forbid
  the script form.
- **F4 — `compliance.ts`: update BOTH disclosure surfaces, and the line-refs in §3(e)/§8 are WRONG.**
  The file is `apps/web/src/lib/settlement/compliance.ts`. `:373-391` is only the JSDoc; the RUNTIME
  disclosure the build must make honest is the `retainedUnscrubbed:` array (`:876`) + `retainedUnscrubbedNote`
  (`:884`) returned by `processDataDeletion`. Editing the docstring alone leaves the machine-emitted claim
  stale. Note: `:829-830` already has a `retainedUnscrubbed → anonymized` pattern to align with.

**SHOULD-FIX (robustness / non-vacuity):**
- **F5 — metadata = SURGICAL key-removal (`metadata - 'payer'`), never object-overwrite.** Settlement-row
  `metadata` carries load-bearing keys read by the credit/reconcile/expiry paths: `validBefore`
  (`reconcile.ts:634`), `settledValueBaseUnits` (`reconcile.ts:210`, the credit amount), `toolId`
  (`reconcile.ts:200`, credit attribution), `expiryClass`/`expiredTerminalized`/`chainTs` (expiry pass),
  `authorizedValueBaseUnits`. A whole-object overwrite clobbers them (DC-01/DC-06). §9 pin: every non-payer
  metadata key is byte-intact after anonymization.
- **F6 — DC-05 NON-VACUITY: the predicate test is a REVERT PROOF.** Sabotage the predicate (drop the
  `credited_at IS NOT NULL` carve-out) and assert the uncredited-sweep row (`settled`+`credited_at IS NULL`)
  FLIPS to anonymized → RED; assert that row's `operation_id` is BYTE-UNCHANGED after a full transform pass
  over a mixed batch (so the `reconcile.ts:963` runbook closure key survives). A "a row wasn't touched" pin
  is the vacuous DC-05 face — pin the EXACT protected `operation_id`.
- **F7 — regex-reject + reconciler-isolation pin.** Pin that the anon form `{rail}:{network}:anon:{id}`
  FAILS `CIRCLE_NANO_OPID`/`X402_OPID` (`reconcile.ts:107-108`) so an anonymized row can never be parsed,
  AND that no terminal-status row reaches `parseSettlementOperationId`'s callers (they select `pending`
  only). Belt-and-suspenders for the terminal-only predicate.
- **F8 — single-statement atomic UPDATE** (op_id rewrite + `metadata - 'payer'` in ONE UPDATE) so no torn
  row (op_id done, payer not) can exist; pin atomicity. The "already-anonymized" exclusion should be robust
  to a torn row (re-qualify if `metadata->>'payer' IS NOT NULL`).

**CORRECTIONS (low, no behavior change):**
- **F9 — §6.2 wording:** the PK is `settlementEntryId(invocationId) = sha256("settlement:"+invocationId)`
  (`ledger.ts:396`), and `invocationId === operation_id` for x402/circle-nano (`orchestrate.ts:158`,
  `settle.ts:106`). The brute-force argument holds, but state it bound to `invocationId` (re-assert the
  identity for these rails), not structurally to `operation_id`.
- **F10 — do NOT add a UNIQUE constraint on `operation_id`** (`schema.ts:939` is a plain index; dedup is
  PK-`id` `ON CONFLICT DO NOTHING`). Adding one risks a DC-14 destructive failure. The anon token's
  uniqueness (the row's own PK `id`) is defense-in-depth, not a DB requirement.
- **F11 — import `verifyCronAuth` from `@/lib/cron-auth`** (the DC-21 extraction), not inline.
- **F12 — `'voided'`/`'reversed'` are dead terminal arms** (no writer sets them; only `pending`/`settled`/
  `failed` are written). Harmless; the real terminal set is `settled`/`failed`. Keep or drop.

## 7. The DARK flag + counsel gates (the irreversible steps stay gated)
- New env gate in `apps/web/src/lib/env.ts`, default OFF, mirroring the existing
  `X_ENABLED === 'true'` pattern (e.g. `isLedgerPayerAnonymizeEnabled()` ← `LEDGER_PAYER_ANONYMIZE_ENABLED === 'true'`).
- Retention window: a config constant (e.g. `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS`), **default = the
  documented financial-retention period (7 years / 2555 days)**; counsel may choose shorter for PII
  minimization. The cron + backfill both no-op when the flag is off.
- **Gated on counsel sign-off (NOT in this code chunk):** flipping the flag on, running the backfill,
  and publishing any privacy-notice language. The build SHIPS the capability dark; the founder enables
  it post-counsel.

## 8. Frozen / unchanged (assert, do not edit)
`x402OperationId` / `circleNanoOperationId` (the live key builders — Option A is excluded); the live
settlement write/flip path (`recordSettlementEntry`, `markSettlement*`, `findSettlementRow`); `external_ref`;
the PK `id` + `settlementEntryId`; `getCronSecret` / `verifyCronAuth`; the `data-retention` cron;
every financial column (`amount_cents`, `take_*`, `settled_at`, `credited_at`, status); the
already-honest `compliance.ts` KNOWN-GAP disclosure wording EXCEPT the one update in §3(e). No new deps,
no schema/migration (operate on existing columns), no DB constraint changes.

## 9. Test plan
- **Predicate pins (the load-bearing part):** a settled+`credited_at`-NULL reconcilable row is NEVER
  anonymized (the uncredited-sweep key survives); a `pending` row is NEVER anonymized; a
  settled+credited aged row IS; a failed aged row IS; a row inside the window is NOT.
- **Transform pins:** after anonymization `operation_id` has no payer and no nonce (regex: matches the
  anon shape), `metadata.payer` is null, EVERY other `metadata` key is intact, `id`/`external_ref`/
  financial columns are byte-unchanged. Re-running the transform is a no-op (idempotent).
- **Dark-flag pins:** with the flag OFF the cron + backfill anonymize ZERO rows and return the no-op
  shape; only with the flag ON do they act.
- **Auth pins:** the new cron reuses `verifyCronAuth` (no-secret 500, bad-token 401, fail-closed) — add
  the route to the cron-auth census/tests if applicable.
- **No-PII-in-logs pin:** the job logs counts only, never a payer address.
- Existing settlement/reconcile suites stay green (equivalence — the live path is untouched).

## 10. Gate (re-run clean from `apps/web`)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (8 pre-existing
warns) · vitest green + the net-new V-N3 pins. Run from `apps/web`, not repo root.

## 11. Lifecycle
scope-confirm ✓ → THIS handoff + pre-build plan audit (runs in the orchestrator session, closes before
build) → BUILD (fresh agent, dark) → executable gate + interval self-verify → ② seal-gating review →
seal + bookkeeping → founder-close. **Enable + backfill + publish are SEPARATE post-counsel gates, not
part of the build's done-definition.**
