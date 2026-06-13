# (V) pending-row lifecycle — founder/operator runbook addendum (2026-06-12)

> Founder-facing. Extends `t-credited-at-runbook-2026-06-10.md` (the credited_at sweep +
> the terminal-failed-row keys) with the (V) chunk's expiry pass: the four quarantine
> classes, the new alert keys + their Sentry-arming decisions, and the corrected
> `pending_overdue` "actionable" posture. Authored at the (V) ③ deep-audit close; the
> claims trace to the ③ VERDICT (`.audit/v-deep/VERDICT.md`) and the sealed code
> (`reconcile.ts` runExpiryPass / quarantineClassify; `ledger.ts` markSettlementExpiredNoBroadcast).

## 1. What the expiry pass does (operator mental model)

Every reconcile cron run (`*/15`), AFTER the two detectors and BEFORE the window loop, a
bounded pass (LIMIT 3 rows / 14s sub-budget inside the shared 40s envelope) examines
**never-broadcast** pending rows (`external_ref IS NULL`, reconcilable rail, `created_at`
older than the run cutoff, not already classified). For each it proves liveness on chain:

- **provably dead** (wall-expired AND the safe-head block timestamp is past the stored
  `validBefore` AND the EIP-3009 nonce reads **unconsumed** on chain) → terminalize
  `'failed'` via the evidence-CAS writer → `logger.info('reconcile.expired_terminalized')`.
  These rows EXIT `pending` and therefore exit the overdue count.
- **nonce CONSUMED** on chain (funds may have moved via an untracked tx, OR the payer ran
  `cancelAuthorization`) → **quarantine-classify** `nonce-consumed-untracked`, the row
  STAYS `pending` → `logger.error('reconcile.expired_nonce_consumed_quarantined')`. THE
  P8(b) detection win — never `'failed'`.
- **unprovable** (opid unparseable / non-canonical network / no stored validBefore / a
  malformed validBefore) → quarantine-classify the matching class, row STAYS `pending` →
  one-shot `logger.error('reconcile.expiry_unprovable')`.
- **incomplete evidence** (safe-head read null/lagging, or the nonce read `unknown`) → no
  classification, row stays pending, retried next run; counted as `unknown` in the
  `reconcile.expiry_pass` info line.

Quarantine = a `metadata.expiryClass` marker (the status CHECK is frozen — quarantine is
NOT a status). A classified row drops out of the candidate SELECT (it is not re-examined)
but REMAINS `pending` and therefore REMAINS counted by `pending_overdue` (standing
visibility by design — §DELIBERATE 2).

## 2. The four quarantine classes — operator close-out procedures

A quarantined row is resolved MANUALLY (by design). The (③) procedures:

### 2a. `nonce-consumed-untracked` (error → Sentry; the P8(b) loss detector)
Payload: `{operationId, rail, from, nonce, validBefore}`.

**FIRST, rule out a stale classification (③ findings [3]/[19] — the alert can false-fire):**
1. Re-read the row: `SELECT settlement_status, external_ref, metadata FROM ledger_entries
   WHERE operation_id=$op AND rail=$rail;`. If it is now `settled` or carries an
   `external_ref` (a concurrent/in-flight tx settled it after the pass read), this was a
   **stale classification, NOT a loss** — close it (clear the marker if desired) and stop.
2. Check the **sibling rail** for the same (from,nonce) — the identical authorization can be
   presented on both rails (the false-page cross-rail case [3]): `SELECT rail, external_ref,
   settlement_status FROM ledger_entries WHERE operation_id IN
   ('circle-nano:'||$net||':'||$from||':'||$nonce, 'x402:'||$net||':'||$from||':'||$nonce);`
   If the sibling row is `settled` with an `external_ref`, the funds ARE tracked there —
   close this row as a duplicate-presentation artifact, no loss.

**If still genuinely untracked, attribute on chain** (the (from,nonce) in the payload):
- `eth_getLogs` on the USDC contract for `AuthorizationUsed(authorizer indexed=from,
  nonce indexed=nonce)` vs `AuthorizationCanceled(authorizer, nonce)`:
  - **AuthorizationUsed** present → funds moved via an untracked tx. Find the tx, confirm it
    paid the platform recipient, then **credit the developer** (amount = the row's
    `amount_cents`, developer = `account_id`) following the §3 credit-first-mark-last
    discipline of `t-credited-at-runbook`, adapted: the row is pending/ref-NULL, so after
    crediting, terminalize it with the same CAS guard the writer uses —
    `UPDATE ledger_entries SET settlement_status='settled', settled_at=now(), credited_at=now()
    WHERE operation_id=$op AND rail=$rail AND settlement_status='pending' AND
    external_ref IS NULL;` (set `external_ref` to the untracked tx hash in the same UPDATE).
  - **AuthorizationCanceled** (or neither) → the payer canceled; NO credit owed. Terminalize:
    `UPDATE ledger_entries SET settlement_status='failed' WHERE operation_id=$op AND
    rail=$rail AND settlement_status='pending' AND external_ref IS NULL;`.

### 2b. `legacy-no-validbefore` / `unparseable` / `unsupported-network` (error → Sentry, one-shot)
Payload: `{operationId, rail, expiryClass}` (one-shot per row — see the Sentry note below).
These rows cannot be proven dead by code (no recoverable validBefore, or an undecidable
opid/network). Resolve manually: read the nonce state yourself
(`authorizationState(from,nonce)` against the prod RPC, if the opid yields a from/nonce),
then either credit+terminalize (if consumed and funds tracked) or terminalize `failed`
(if unconsumed and the authorization is genuinely abandoned). For a truly opaque legacy hop
row, founder judgment. The class name describes WHY it could not be auto-proven:
`unparseable` covers BOTH an opid that does not parse AND a present-but-malformed stored
validBefore (③ [36] — when triaging `unparseable`, first check whether the opid parses; if
it does, the defect is the stored `metadata.validBefore` value).

## 3. The new alert keys + Sentry-arming decisions (③ [29]/[38] — close-list item)

`@/lib/logger` mirrors **error-level only** to Sentry; Sentry default rules notify on NEW
issues and collapse recurring identical events (see `t-close-checklist` §3). Decisions:

| Key | Level | Arm an every-event rule? |
|---|---|---|
| `reconcile.expired_nonce_consumed_quarantined` | error | **YES — arm every-event.** One-shot per row (the class exclusion stops re-selection), so without an every-event rule, occurrences #2..N collapse into one non-renotifying issue and a real P8(b) loss after the first goes page-silent. This is the one alert guarding untracked-funds losses. |
| `settlement.credit_tool_stat_unmatched` | error | **YES — arm every-event** (rare; every-event is safe; a stat gap per occurrence wants a page). |
| `reconcile.expiry_unprovable` | error | **Founder's call:** one-shot per row; arm every-event OR treat the first occurrence as standing inventory. Low volume (finite legacy/unparseable backlog). |
| `reconcile.expiry_pass_failed` | error | **DO NOT arm every-event.** Recurs every 15 min while a DB outage persists (the `overdue_examined` precedent) — an every-event rule recreates alarm fatigue. The first-issue notification suffices; resolution clears it. |

Verify Sentry quota headroom for these four keys in the founder's existing Sentry
rules/quota live-verification block (the (U) capstone pattern). `expiry_pass_failed`'s
worst case (a stuck DB) adds ≤1 error line/15 min = 96/day — within quota.

## 4. `pending_overdue` is "actionable" again — but read it correctly (③ [31]/[32])

The (U)-era expectation "pending_overdue becomes actionable again after (V)" is delivered
**only with this correction**: (V) terminalizes the provably-dead subset, but
**quarantined rows and not-yet-expired rows REMAIN counted** in `overdueCount`/
`noTxhashCount` forever (the overdue WHERE is (S)-frozen — it carries no expiryClass
exclusion). So `overdueCount` is NOT a clean "stuck rows" number. The actionable rule:

```
actionable_overdue ≈ overdueCount − (standing quarantine baseline)
```

Baseline query (run it to establish the standing count, re-run to spot a NEW stuck row):
```sql
SELECT metadata->>'expiryClass' AS class, count(*)
FROM ledger_entries
WHERE settlement_status='pending' AND rail IN ('circle-nano','x402')
  AND metadata->>'expiryClass' IS NOT NULL
GROUP BY 1;
```
A `noTxhashCount` that climbs while `uncredited` stays 0 and the quarantine baseline is
flat is the **hostile-mint / buggy-retry signature** (③ [9]/[23] — far-future-validBefore
or insufficient-balance ref-NULL rows accumulating); triage by payer/IP, and note the
register item to cap `validBefore` at acceptance (see the register). Far-future ref-NULL
rows are operator-closable by the manual `failed` terminalize UPDATE in §2a (with the
`external_ref IS NULL AND settlement_status='pending'` guard) once confirmed abandoned.

**Deploy-day forecast (capstone pre-announcement):** the FIRST runs after the (V) deploy
hit the existing aged null-ref backlog. Expect a **quarantine wave** (≈3 rows terminalized
or classified per 15-min run, total ≈ the pre-deploy inventory count — run the §g inventory
query before deploy to know it). `overdueCount` will NOT drop instantly — provably-dead
rows drain at ≤3/run and quarantined rows stay counted. This is expected, not a regression.

## 5. Anchor-degradation cue (③ [17]/[34] — corrected)

The drafted cue "`unknown===examined` across consecutive runs ⇒ the chain-time anchor is
degraded" FALSE-NEGATIVES when wall-filter skips inflate `examined` (a within-margin row is
counted examined but never reaches the anchor read). Use instead:

> **`unknown > 0` persistently with `terminalized + quarantined === 0` across consecutive
> `reconcile.expiry_pass` lines ⇒ the safe-head anchor and/or the nonce read is degraded.**
> Check the prod RPC's `eth_getBlockByNumber("safe", false)` support and the provider's
> health. (The founder safe-tag curl is in the close checklist.)

The expiry pass reports ONLY via these log keys (no cron-summary/HTTP-body field — summary
identity is frozen): `reconcile.expiry_pass` (info, the per-run {examined, terminalized,
quarantined, unknown} feed), `reconcile.expired_terminalized` (info), and the three error
keys above. To reconstruct "what did the pass do this run," read these — not the cron
`done` summary (③ [35]).
