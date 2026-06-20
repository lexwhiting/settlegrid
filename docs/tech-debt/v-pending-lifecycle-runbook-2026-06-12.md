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
Payload: `{operationId, rail, validBefore}` where **(V-N3) `operationId` is the
de-identified PK row `id`** (`settlementEntryId`), NOT the raw payer-bearing
`operation_id` — and the raw `from`/`nonce` are no longer in the log / Sentry
payload. They are recovered from the row below: these quarantined rows are NOT
anonymized (the payer-minimizer only touches TERMINAL rows, and a quarantined row
stays `pending`), so the row's `operation_id` `{rail}:{net}:{from}:{nonce}` is intact.

**FIRST, resolve the row BY id + rule out a stale classification (③ findings
[3]/[19] — the alert can false-fire):**
1. Re-read the row: `SELECT operation_id, rail, settlement_status, external_ref,
   account_id, amount_cents, metadata FROM ledger_entries WHERE id=$id;` (`$id` =
   the alert's `operationId` field). **Parse `(from,nonce,net)` from the returned
   `operation_id`** for the steps below. If the row is now `settled` or carries an
   `external_ref` (a concurrent/in-flight tx settled it after the pass read), this was a
   **stale classification, NOT a loss** — close it (clear the marker if desired) and stop.
2. Check the **sibling rail** for the same (from,nonce) — the identical authorization can be
   presented on both rails (the false-page cross-rail case [3]); `$net`/`$from`/`$nonce`
   are parsed from the resolved row's `operation_id` (step 1): `SELECT rail, external_ref,
   settlement_status FROM ledger_entries WHERE operation_id IN
   ('circle-nano:'||$net||':'||$from||':'||$nonce, 'x402:'||$net||':'||$from||':'||$nonce);`
   If the sibling row is `settled` with an `external_ref`, the funds ARE tracked there —
   close this row as a duplicate-presentation artifact, no loss.

**If still genuinely untracked, attribute on chain** (the (from,nonce) parsed from the
resolved row's `operation_id` in step 1):
- `eth_getLogs` on the USDC contract for `AuthorizationUsed(authorizer indexed=from,
  nonce indexed=nonce)` vs `AuthorizationCanceled(authorizer, nonce)`:
  - **AuthorizationUsed** present → funds moved via an untracked tx. Find the tx, confirm it
    paid the platform recipient, then **credit the developer** (amount = the row's
    `amount_cents`, developer = `account_id`) following the §3 credit-first-mark-last
    discipline of `t-credited-at-runbook`, adapted: the row is pending/ref-NULL, so after
    crediting, terminalize it with the same CAS guard the writer uses —
    `UPDATE ledger_entries SET settlement_status='settled', settled_at=now(), credited_at=now()
    WHERE id=$id AND settlement_status='pending' AND
    external_ref IS NULL;` (`$id` = the alert's PK id; set `external_ref` to the untracked tx hash in the same UPDATE).
  - **AuthorizationCanceled** (or neither) → the payer canceled; NO credit owed. Terminalize:
    `UPDATE ledger_entries SET settlement_status='failed' WHERE id=$id AND
    settlement_status='pending' AND external_ref IS NULL;`.

### 2b. `legacy-no-validbefore` / `unparseable` / `unsupported-network` (error → Sentry, one-shot)
Payload: `{operationId, rail, expiryClass}` where **(V-N3) `operationId` is the
de-identified PK row `id`** (one-shot per row — see the Sentry note below).
These rows cannot be proven dead by code (no recoverable validBefore, or an undecidable
opid/network). Resolve manually: first re-read the row BY id (`SELECT operation_id,
metadata FROM ledger_entries WHERE id=$id;`), then read the nonce state yourself
(`authorizationState(from,nonce)` against the prod RPC, if the row's `operation_id`
yields a from/nonce),
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
| `reconcile.expiry_anchor_degraded` | error | **YES — arm every-event** (DC-18 de-mask, 2026-06-18; ③ [L1-1]). The PER-NETWORK same-run stall page. Its `msg`/`logKey` is the SAME constant for every network and every 15-min pass, and the `network` attribution lives only in `extra` (NOT the Sentry grouping key), so default grouping collapses recurrent per-network stalls into ONE non-renotifying issue — a persistent anchor/nonce outage then pages once and goes page-silent. Capped at ≤ the canonical-network count (2 today) per pass, so every-event cannot flood. Without this rule the de-mask's same-run signal degrades to the ≤6h `pending_overdue` backstop only. |

Verify Sentry quota headroom for these five keys in the founder's existing Sentry
rules/quota live-verification block (the (U) capstone pattern). `expiry_pass_failed`'s
worst case (a stuck DB) adds ≤1 error line/15 min = 96/day; `expiry_anchor_degraded`'s
worst case (both canonical networks degraded every pass) adds ≤2 lines/15 min = ≤192/day —
both within quota.

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

This is the SUSTAINED (cross-run) human cue and it stays the load-bearing one. The
per-run `unknown` is now SPLIT into two attributing counters — `unknownAnchor` (the
safe-head `eth_getBlockByNumber("safe")` read returned null) and `unknownNonce` (the
block-pinned USDC `authorizationState(from, nonce)` read — a `readContract` eth_call at
block N, NOT `eth_getTransactionCount` — could not serve that block) — and
the feed carries a `byNetwork` breakdown, so the same cue reads per network: a degraded
`unknownAnchor` points at safe-tag support, a degraded `unknownNonce` at a pruned/lagging
backend whose tip < N.

**SAME-RUN pager — `reconcile.expiry_anchor_degraded` (DC-18 de-mask, 2026-06-18).** This
error-level page is now **PER NETWORK** (was pass-global, with no network field — any single
terminalize/quarantine anywhere in the pass masked it). It fires one line per degraded
network on the predicate:

> **page network N iff `terminalized_N === 0 && quarantined_N === 0 && (unknownAnchor_N +
> unknownNonce_N) > 0`** — i.e. that network made ZERO terminalization/quarantine progress
> this pass AND ≥1 of its reads degraded. The payload carries `{ network, unknownAnchor,
> unknownNonce, unknown, terminalized: 0, quarantined: 0 }`; triage by the network +
> whichever split is non-zero (anchor → safe-tag; nonce → block-N pin / backend tip).

It is a within-pass signal only (no cross-pass state — the 15-min cron is stateless) and is
capped at ≤2 lines/pass (the 2 canonical networks), so it does not re-fatigue. A masked or
missed page is bounded ≤6h by `pending_overdue`; the SUSTAINED judgment lives in the
`reconcile.expiry_pass` info feed above. Network-less / non-canonical quarantines
(unparseable / unsupported-network rows) are deliberately NOT attributed to any network and
cannot mask a real network's degradation.

**"No same-run page for network N" does NOT mean "N is healthy" (③ [L2-3]/[L3-1]/[L6-1] —
two bounded masking modes, both by design, both money-safe, both caught within ≤6h by
`pending_overdue`; the `reconcile.expiry_pass` info feed always carries N's
`unknownAnchor`/`unknownNonce` even when the page is suppressed):**
- **Intra-network progress (the no-progress gate).** If N made ANY terminalize OR quarantine
  progress this pass (`terminalized_N > 0` OR `quarantined_N > 0`), N does NOT page even if
  some of N's reads degraded — that is the (V) alert-fatigue cure, not a bug. Under a
  SUSTAINED inflow of quarantine-bound rows on N (new legacy / malformed-vb /
  nonce-consumed rows arriving every pass), `quarantined_N > 0` can persist indefinitely, so
  a real anchor/nonce outage on N may never surface on the SAME-RUN page. (The per-row
  `expiryClass` drain only bounds a FINITE quarantine set, NOT this sustained-arrival case —
  the real bound is the ≤6h `pending_overdue` backstop, which counts N's stalled
  ref-NULL rows regardless of the quarantine baseline.)
- **Budget truncation (LIMIT 3 / 14s).** A pass that hits its row/time budget surfaces ONLY
  the networks examined before the cut. Under a simultaneous MULTI-network RPC outage (the
  worst case — reads slow enough to trip the 14s sub-budget after one row), one network may
  page while a second is page-silent THIS pass; the un-examined rows keep their queue slot
  (mark-before-examine, the FIFO `COALESCE(last_reconciled_at, created_at)` ordering) and
  surface on the next pass (≤1–2 passes) or via `pending_overdue` ≤6h. So a single-network
  page during a known broad RPC outage does NOT certify the other network healthy. (This
  truncation path is not exercised by the synchronous-mock test pins — a known rig limit.)

The expiry pass reports ONLY via these log keys (no cron-summary/HTTP-body field — summary
identity is frozen): `reconcile.expiry_pass` (info, the per-run {examined, terminalized,
quarantined, unknown, unknownAnchor, unknownNonce, byNetwork} feed), `reconcile.expiry_anchor_degraded`
(error, the same-run per-network degradation page above), `reconcile.expired_terminalized`
(info), and the three error keys above. To reconstruct "what did the pass do this run," read
these — not the cron `done` summary (③ [35]).
