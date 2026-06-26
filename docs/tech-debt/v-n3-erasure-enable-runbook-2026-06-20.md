# V-N3-erasure ENABLE-RUNBOOK — payer-minimization go-live (BOTH census surfaces) — 2026-06-20

> Operational procedure (supervised execution) to ENABLE the V-N3 payer minimization across BOTH DC-16 census
> surfaces — the ledger (`ledger_entries`, V-N3-erasure @769ab9c0) and the invocations
> (`invocations.metadata`, V-N3-invocations-min @f84a942b, drain `paymentId` hardened at ③/DC-23). This is the
> SEPARATE counsel-gated act the three sealed chunks deferred to (handoff §11 / DC-15).
>
> **This is NOT a `/p1` build chunk.** It is a runbook: read-only pre-flight → an isolated-copy DRY-RUN →
> supervised PROD execution → verification → abort path. The one code/config change it carries (`vercel.json`
> cron wiring) is a tiny commit, noted inline.
>
> **IRREVERSIBLE.** The backfill permanently removes the raw EVM payer/channel values from the queryable
> columns. MINIMIZATION, not erasure — the addresses remain permanently public ON-CHAIN — but there is **NO
> restore** of the removed column data. "Rollback" (§7) means STOP-further-minimization only.

> ## ⚠️ SAFETY BANNER — read before touching any environment (2026-06-20 investigation)
> The DB layer has **NO per-environment branching** (`getDatabaseUrl()` = flat `process.env.DATABASE_URL`,
> `env.ts:47-49`). The only `DATABASE_URL`s in the repo — **production AND local dev** — are the **same Supabase
> host** (`db.ncqjvmpruutwhilldcjp.supabase.co`). Therefore:
> - **Local dev currently talks to the PROD database.** Do NOT run any `scripts/seed-*.ts`, `drizzle-kit`, or the
>   backfill **locally** — they would write to production.
> - **A Vercel Preview deployment inherits the project `DATABASE_URL`** unless you have set a Preview-scoped
>   override in the dashboard → an un-verified "staging" preview would **hit prod**. There is **no provisioned
>   staging environment** in this repo.
> - **Before ANY mutation in §4, you MUST prove the target is an isolated copy, not prod** (§4 step 5). Running
>   this IRREVERSIBLE backfill against anything sharing the prod `DATABASE_URL` would mutate production.

## 0. Authoritative inputs (read first)
- `docs/tech-debt/v-n3-invocations-min-handoff-2026-06-20.md` §11 (coupling) + `…-post-seal-deep-audit-2026-06-20.md` (the ③ drain `paymentId` fix).
- `docs/tech-debt/v-n3-erasure-handoff-2026-06-18.md` + `…-post-seal-deep-audit-2026-06-19.md` (ledger side).
- `.audit/defect-ledger/DC-16-*` (honesty parent), `DC-23-*` (value-provenance class).

## 1. Gates / prerequisites
| # | Gate | State (2026-06-20) |
|---|---|---|
| ① | **Counsel sign-off** on lawful basis + minimization posture | **✅ CLEARED** |
| ② | ~~`V-N3-enable-disclosure` chunk SEALED + DEPLOYED, dark~~ **CORRECTED 2026-06-20 — does NOT gate the flip** | **N/A.** The pre-build plan audit (5 lenses + adversarial refuter) proved the deletion-export ALREADY erases the invocations payer: `processDataDeletion` step 4 (`compliance.ts` step 4 — the `── 4. Null PII metadata on invocations` block (was `:716-722`; line shifted by the V-N3-deletion-wiring F-B1 pre-commit — use the semantic anchor)) nulls the WHOLE `invocations.metadata` for the subject's tools → disclosed under `anonymized`, flag-INdependent. So flipping `INVOCATIONS_PAYER_MINIMIZE_ENABLED` needs NO deletion-export disclosure change. `V-N3-enable-disclosure` was re-scoped to an honesty-hardening (docstring + regression pin; user-facing JSON byte-identical) that does NOT block §5. |
| ③ | Prod deploy access + `CRON_SECRET` (for §5); a **read-only DB console** + `pg_dump` access to prod (for §3 + the §4 copy); **Docker locally** (recommended §4 method) — or Supabase project admin (cloud fallback) | operator to confirm |
| ④ | **An isolated, populated copy** of `invocations` + `ledger_entries` for the dry-run | **❌ DOES NOT EXIST** — no staging env, no `.env.staging`, no per-env DB. **Created in §4** (LOCAL PG 17.6 Docker copy, recommended; cloud throwaway fallback). Needs Docker + `pg_dump`/`psql` locally. |

> **No invocations disclosure blocker (CORRECTED 2026-06-20).** The deletion-export erases the invocations
> on-chain payer regardless of the flag — `processDataDeletion` step 4 (`compliance.ts` step 4 — the `── 4. Null PII metadata on invocations` block (was `:716-722`; line shifted by the V-N3-deletion-wiring F-B1 pre-commit — use the semantic anchor)) nulls the
> whole `invocations.metadata` for the subject's tools, disclosed under `anonymized`. There is therefore NO
> under-disclosure risk from flipping the invocations flag before any disclosure chunk: the flip changes only
> PLATFORM-WIDE write-path/backfill behavior on rows NOT subject to a deletion, not the deletion-export claim.
> (The LEDGER side still drives its own flag-gated `minimized` disclosure — handled by V-N3-erasure @769ab9c0.)
> **§4 (dry-run) and §5 (PROD) are gated on ① ✅ + §4 GREEN, NOT on any invocations disclosure chunk.**

## 2. What flips, exactly
- Env flags (Vercel project env, per environment): `LEDGER_PAYER_ANONYMIZE_ENABLED=true` and
  `INVOCATIONS_PAYER_MINIMIZE_ENABLED=true` (both strict `=== 'true'`, default OFF).
- **⚠️ Retention-window asymmetry (counsel lever — decide before the ledger flip).** The two surfaces do NOT
  minimize the same rows:
  - **Invocations** has NO retention window — the backfill minimizes ALL candidate rows immediately.
  - **Ledger** is gated by `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS` (`anonymize-payer.ts:80-93`,
    `isAnonymizationEligible:141` → `created_at < now − window`), **default 2555d (7y)**, hard floor ≈1 day
    (`ANONYMIZE_WINDOW_FLOOR_SECONDS`, throws if set below — replay/reconcile safety). On a 2026-new dataset the
    **default 7y window ⇒ the ledger backfill minimizes ≈0 rows.** To minimize recent ledger payer data, counsel
    must set a SHORTER `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS` (≥ floor). Pick this value in §5 step 1; Phase 0 (§3 H)
    shows how many rows each candidate window would touch.
- Effect at flip: the **write-path** minimizes NEW rows immediately; the **backfill** routes
  (`/api/admin/*-backfill`, `/api/cron/*`) stop returning `enabled:false` and mutate EXISTING rows.
- **Flip→backfill window (LEDGER claim only):** the LEDGER flag flips the `minimized` disclosure claim the
  instant it is on, but EXISTING ledger rows aren't minimized until the backfill completes. Keep the window to
  minutes — backfill IMMEDIATELY after each flip, at low traffic. (The ledger claim's wording is window-tolerant
  per the sealed V-N3-erasure chunk.) The INVOCATIONS flip makes NO deletion-export claim (gate ②) — so it has
  no disclosure-window concern; just backfill promptly to minimize the platform rows.

## 3. PHASE 0 — PRE-FLIGHT (read-only; run on PROD now — ZERO risk, no writes)
Run via the read-only DB console. Records the baseline + de-risks the SQL against real data **with no mutation**.
This satisfies the ② seal's concern ("the SQL has never run against populated tables") without touching a row.

> **RESULT (2026-06-20):** PROD is EMPTY on both surfaces — `invocations` protocol-sentinel rows = 0
> (`protocol_rows_total=0`, metadata-type distribution returned no rows), all invocations candidate/guard counts = 0,
> `ledger_payer_terminal_rows = 0`, and the ledger window gate (#8) = 0/0/0/0 (nothing aged past even the 1-day
> floor). ⇒ **both backfills are verified 0-row no-ops on current data; the retention-window counsel lever is moot
> until ledger data exists.** The candidate predicate + `jsonb_typeof` guard executed on the real prod engine
> without error (0 rows matched).

```sql
-- (A) metadata-type distribution on the protocol sentinel (the jsonb_typeof='object' guard sanity check;
--     reveals any scalar/null rows that the candidate guard must EXCLUDE — the 22023 "delete from scalar" risk).
SELECT jsonb_typeof(metadata) AS metadata_type, count(*)
FROM invocations WHERE consumer_id = '00000000-0000-0000-0000-000000000002' GROUP BY 1;

-- (B) INVOCATIONS — remaining candidate rows (the backfill's EXACT candidate predicate, incl. the ③ drain paymentId arm).
SELECT count(*) AS invocations_candidates
FROM invocations
WHERE consumer_id = '00000000-0000-0000-0000-000000000002'
  AND jsonb_typeof(metadata) = 'object'
  AND ( metadata ? 'payer' OR metadata ? 'payerAddress' OR metadata ? 'drainNonce' OR metadata ? 'drainChannelId'
     OR (metadata->>'paymentMethod' IN ('x402','circle-nano','drain') AND metadata ? 'payerIdentifier')
     OR (metadata->>'paymentMethod' = 'drain' AND metadata ? 'paymentId') );

-- (C) INVOCATIONS — drain paymentId specifically (the ③ fix; baseline now, must be 0 after backfill).
SELECT count(*) AS drain_paymentid_remaining
FROM invocations WHERE consumer_id = '00000000-0000-0000-0000-000000000002'
  AND metadata->>'paymentMethod' = 'drain' AND metadata ? 'paymentId';

-- (D) NO-OVER-MINIMIZATION guard: non-EVM rails retaining payerIdentifier (must be UNCHANGED after).
SELECT count(*) AS nonevm_payeridentifier_retained
FROM invocations WHERE consumer_id = '00000000-0000-0000-0000-000000000002'
  AND metadata->>'paymentMethod' NOT IN ('x402','circle-nano','drain') AND metadata ? 'payerIdentifier';

-- (E) mpp R2 retention guard (sentinel …0001 is out of backfill scope; must be UNCHANGED).
SELECT count(*) AS mpp_customerid_retained
FROM invocations WHERE consumer_id = '00000000-0000-0000-0000-000000000001' AND metadata ? 'mppPayerCustomerId';

-- (F) TRANSFORM PREVIEW (read-only) — mirrors minimizeRow EXACTLY; eyeball `before` vs `after` on real rows.
SELECT id, metadata->>'paymentMethod' AS rail, metadata AS before,
  CASE
    WHEN metadata->>'paymentMethod' = 'drain'
      THEN ((metadata - 'payer' - 'payerAddress' - 'drainNonce' - 'drainChannelId') - 'payerIdentifier') - 'paymentId'
    WHEN metadata->>'paymentMethod' IN ('x402','circle-nano')
      THEN  (metadata - 'payer' - 'payerAddress' - 'drainNonce' - 'drainChannelId') - 'payerIdentifier'
    ELSE     metadata - 'payer' - 'payerAddress' - 'drainNonce' - 'drainChannelId'
  END AS after
FROM invocations
WHERE consumer_id = '00000000-0000-0000-0000-000000000002' AND jsonb_typeof(metadata) = 'object'
  AND ( metadata ? 'payer' OR metadata ? 'payerAddress' OR metadata ? 'drainNonce' OR metadata ? 'drainChannelId'
        OR (metadata->>'paymentMethod' IN ('x402','circle-nano','drain') AND metadata ? 'payerIdentifier')
        OR (metadata->>'paymentMethod' = 'drain' AND metadata ? 'paymentId') )
LIMIT 50;

-- (G) LEDGER baseline — payer-bearing reconcilable terminal rows (the universe the ledger backfill draws from).
--     COARSE payer-presence (the authoritative op_id-parse is TS isAnonymizationEligible; this is an upper bound).
SELECT count(*) AS ledger_payer_terminal_rows
FROM ledger_entries
WHERE rail IN ('x402','circle-nano') AND settlement_status IN ('settled','failed')
  AND NOT (settlement_status = 'settled' AND credited_at IS NULL) AND operation_id IS NOT NULL
  AND ((metadata ->> 'payer') IS NOT NULL OR operation_id IS NOT NULL);

-- (H) LEDGER — how the RETENTION WINDOW gates the above (the §2 counsel lever). Shows eligible counts per
--     candidate LEDGER_PAYER_ANONYMIZE_AFTER_DAYS. `aged_past_default_7y` will be ~0 on a 2026-new dataset.
SELECT
  count(*) FILTER (WHERE created_at < now() - interval '2555 days') AS aged_past_default_7y,
  count(*) FILTER (WHERE created_at < now() - interval '90 days')   AS aged_past_90d,
  count(*) FILTER (WHERE created_at < now() - interval '30 days')   AS aged_past_30d,
  count(*) FILTER (WHERE created_at < now() - interval '1 day')     AS aged_past_1d_floor
FROM ledger_entries
WHERE rail IN ('x402','circle-nano') AND settlement_status IN ('settled','failed')
  AND NOT (settlement_status = 'settled' AND credited_at IS NULL) AND operation_id IS NOT NULL
  AND ((metadata ->> 'payer') IS NOT NULL OR operation_id IS NOT NULL);
```
**GO/NO-GO:** record (A)–(E)+(G); confirm (F) removes exactly the EVM payer/channel keys and retains `proxy`/
`paymentMethod`/`toolSlug`/`*AmountUsdc`/non-EVM ids/tx-hash `paymentId`. No SQL error ⇒ the guard + operators are
valid on PG 17.6. Proceed to §4.

## 4. DRY-RUN on an ISOLATED COPY (robust path — LOCAL Postgres 17.6, recommended)
Full code-path validation (keyset pagination, budget loop, flag gate, the real `UPDATE`+`RETURNING`+convergence)
against POPULATED data. Higher fidelity than the §3 read-only preview; both are run (§3 first, cheap; §4 for robustness).

> **RESULT (2026-06-20) — copy-of-prod MOOT (prod empty), substituted by a SYNTHETIC local smoke that PASSED.**
> Since prod has 0 rows (§3 RESULT), copying it would yield empty tables. Instead, a throwaway local PG 17
> (Docker) was seeded with synthetic rows of EVERY rail shape + edge cases (x402, x402-null-payerId, circle-nano,
> drain, drain-null-payerId, ap2, kyapay-40hex, clean, scalar, JSON-null, SQL-null, mpp-sentinel) and the EXACT
> shipped candidate predicate + `minimizeRow` UPDATE were run: `candidates_before=5 → UPDATE 5 → candidates_after=0`
> (convergent); all assertions `t` — drain `paymentId`/channel/nonce/payerIdentifier removed + `drainAmountUsdc`
> kept; x402/circle-nano payer keys gone + `paymentId`(txhash) kept; non-EVM `payerIdentifier` RETAINED (no
> over-min); mpp `mppPayerCustomerId` RETAINED; scalar/JSON-null/SQL-null untouched (no 22023); idempotent re-run
> changed 0 rows. No prod, no PII (synthetic), container destroyed. **⇒ the backfill SQL is validated on real PG
> rows; the §4 prod-copy dry-run is satisfied for go-live.** A populated copy/route-run is only warranted later if
> a real backlog accumulates before the flag is flipped.

**Method choice (decided by the 2026-06-20 study).** Use a **LOCAL Postgres 17.6 (Docker)** copy — strongest
isolation (localhost cannot be prod), best PII teardown (ephemeral; dies with the container), free, and it
sidesteps this project's broken migration journal (build the schema with `drizzle-kit push`, NOT `migrate`).
**Supabase Branching is NOT used:** no `supabase/` CLI project exists; the manually-bootstrapped migration history
(`bootstrap__drizzle_migrations.sql`; journal holds 3 of 18) fails replay; it needs a paid plan + GH integration
and is schema-only by default. **Fallback if you can't run Docker:** `pg_dump` → a throwaway Supabase project
(verify isolation in step 5; DELETE it in step 7 — it holds prod PII).

1. **Stand up the isolated copy (local):**
   ```bash
   docker run -d --name sg-dryrun -e POSTGRES_PASSWORD=dryrun -p 5433:5432 postgres:17.6   # or postgres:17
   export COPY_DATABASE_URL="postgresql://postgres:dryrun@localhost:5433/postgres"
   # build the EXACT current app schema from schema.ts (bypasses the broken migration journal):
   cd apps/web && DATABASE_URL="$COPY_DATABASE_URL" npx drizzle-kit push
   # load prod DATA only (schema already built); --disable-triggers avoids FK-order pain:
   pg_dump "$PROD_DATABASE_URL" --data-only --no-owner --no-acl --disable-triggers \
           -t public.invocations -t public.ledger_entries \
           -t public.tools -t public.consumers -t public.developers \
     | psql "$COPY_DATABASE_URL"
   ```
   (Add `-t public.<table>` for any other FK parent the restore complains about, or do a full `--data-only` dump —
   it's all local + ephemeral. The copy holds real PII but never leaves your machine and is destroyed in step 7.)
2. (the connection string is `COPY_DATABASE_URL` from step 1.)
3. **Execution surface — run the ACTUAL admin route against the local copy (full code path):**
   ```bash
   cd apps/web
   DATABASE_URL="$COPY_DATABASE_URL" CRON_SECRET=dryrun \
   LEDGER_PAYER_ANONYMIZE_ENABLED=true INVOCATIONS_PAYER_MINIMIZE_ENABLED=true \
   LEDGER_PAYER_ANONYMIZE_AFTER_DAYS=<counsel window> npm run dev   # COPY_BASE = http://localhost:3000
   ```
   (Lighter alternative: run §3 (B)/(F) + the actual surgical `UPDATE` directly against `COPY_DATABASE_URL`,
   committed — it's a throwaway — then re-check for convergence. Skips the route loop, which is JS-tested.)
4. Run §3 (A)–(H) against the COPY → baseline.
5. **⚠️ ISOLATION GATE (before any mutation).** Confirm the target is the local copy, NOT prod:
   `psql "$COPY_DATABASE_URL" -c "SELECT current_database(), inet_server_addr();"` → expect a LOCAL/container
   address. With the local method `$COPY_DATABASE_URL` is `localhost:5433` by construction; **if you used the cloud
   fallback, explicitly diff the host against the prod value.** Any doubt ⇒ STOP.
6. Drive both backfills to completion (re-POST until `completed:true`; each call drains within the ~250s budget):
   ```bash
   export COPY_BASE=http://localhost:3000 COPY_CRON_SECRET=dryrun   # local method (step 3)
   curl -sS -X POST "$COPY_BASE/api/admin/invocations-payer-min-backfill" \
        -H "Authorization: Bearer $COPY_CRON_SECRET" | jq '{enabled,minimized,scanned,skipped,batches,completed,message}'
   curl -sS -X POST "$COPY_BASE/api/admin/payer-anonymize-backfill" \
        -H "Authorization: Bearer $COPY_CRON_SECRET" | jq '{enabled,anonymized,scanned,skipped,batches,completed,message}'
   ```
7. **Verify on the COPY:**
   - §3 (B) `invocations_candidates` → **0**; (C) `drain_paymentid_remaining` → **0**.
   - §3 (D) `nonevm_payeridentifier_retained` + (E) `mpp_customerid_retained` → **UNCHANGED** vs the copy baseline.
   - Spot-check a minimized **drain** row → no `payer*`/`drainChannelId`/`drainNonce`/`paymentId`; `drainAmountUsdc`/`toolSlug`/`paymentMethod`/`proxy`/`upstreamStatus` retained.
   - Spot-check **x402**/**circle-nano** → `payerIdentifier`(+`payer`/`payerAddress`) gone, `paymentId`(txHash) RETAINED.
   - **Idempotency:** re-POST both → `completed:true`, `scanned:0`, `minimized/anonymized:0`.
   - Ledger: anonymized op_id shape `{rail}:{network}`, no payer/nonce, on a sample.
   - **Then DESTROY the copy** (it holds prod PII): local → `docker rm -f -v sg-dryrun`; cloud fallback → delete the
     throwaway Supabase project; shred any dump file (`shred -u /tmp/sg.dump` or `rm`).
8. **GO/NO-GO.** Any non-zero (B)/(C), any change to (D)/(E), any SQL error, any non-idempotent re-run → **ABORT**;
   capture the failing rows; do NOT touch prod.

## 5. PROD execution (supervised — gate on ① ✅ + §4 GREEN)
Do the surfaces **sequentially** (ledger first, then invocations). The LEDGER `minimized` disclosure goes true
when its flag flips; the INVOCATIONS flip makes NO deletion-export claim (gate ②, corrected). At a low-traffic window.
1. **Ledger:** FIRST set `LEDGER_PAYER_ANONYMIZE_AFTER_DAYS` to the counsel-chosen window (≥1-day floor; default
   2555d minimizes ≈0 recent rows — see §2 + §3 H) → set `LEDGER_PAYER_ANONYMIZE_ENABLED=true` in prod →
   redeploy/restart → IMMEDIATELY re-POST `/api/admin/payer-anonymize-backfill` until `completed:true` → verify the
   manifest `anonymized`/`scanned` matches the §3 (H) expectation for the chosen window + ledger sample shape.
2. **Invocations** — prod is EMPTY (§3 RESULT) → the backfill is a verified 0-row no-op, and flipping BEFORE
   traffic means a backlog never forms (the clean timing). Concrete commands:
   ```bash
   cd apps/web
   printf 'true' | vercel env add INVOCATIONS_PAYER_MINIMIZE_ENABLED production && vercel --prod   # flip + redeploy
   curl -sS -X POST "https://settlegrid.ai/api/admin/invocations-payer-min-backfill" \
        -H "Authorization: Bearer $CRON_SECRET" | jq '{enabled,minimized,scanned,completed}'      # expect enabled:true, 0, 0, true
   ```
   Post-flip, as the FIRST real settlement rows arrive: re-run §3 (B) (candidates must STAY 0 — new rows written
   already-minimized) + eyeball the newest 20 rows (drain: no channel/payer keys; x402/circle-nano: `paymentId`
   txhash kept, no payer). Rollback if anything looks off: flag → `false` + redeploy (§7).
3. **Wire the recurring crons** (a tiny `apps/web/vercel.json` commit — both routes are currently UNWIRED):
   ```jsonc
   { "path": "/api/cron/payer-anonymize",       "schedule": "0 3 * * *" },
   { "path": "/api/cron/invocations-payer-min", "schedule": "0 4 * * *" }
   ```
   No-ops if the flags are ever off; catches any row the write-path missed.
4. **Confirm honesty post-flip.** (a) **Ledger:** with `LEDGER_PAYER_ANONYMIZE_ENABLED` on, `compliance.ts`
   surfaces the LEDGER payer paths under `minimized`/`minimizedNote` (the sealed V-N3-erasure disclosure) —
   trigger a test-account deletion-export and confirm the ledger claim matches the now-minimized reality.
   (b) **Invocations:** the deletion-export ALREADY discloses `invocations.metadata` under `anonymized` (step 4
   erases it, flag-independent) — there is NO invocations disclosure to flip; instead confirm the BACKFILL
   minimized the platform rows (§3 (B)=0, (C)=0). DC-16 honest across both surfaces.

## 6. (removed — folded into §3/§4)

## 7. ABORT / rollback (know the limits)
- **STOP further minimization:** set the flag(s) back to `false` + redeploy → write-path reverts to byte-identical
  retention for NEW rows; backfill routes return `enabled:false`; crons no-op; the flag-gated disclosure claim reverts off.
- **NO data restore.** Already-minimized rows lost the payer/channel column data permanently (public on-chain only).
  The PROD flip+backfill is a one-way door — which is why §3 (read-only) + §4 (isolated copy) are mandatory first.
- Mid-prod verification failure ((B)≠0 stuck, (D) changed): STOP, flip flags OFF, capture rows, escalate — do NOT loop blindly.

## 8. Post-run
- Record final manifests + §3 deltas here. Confirm backfill logs are counts-only (no payer in logs).
- Update `.claude/cadence-state.json` `next`. The V-N3 line is then CLOSED: both surfaces minimized + disclosed honestly.

## 9. Roles
- **Claude (me):** authored/maintains this doc; prepares the exact commands + read-only SQL; interprets manifests +
  query results you paste back; gates each GO/NO-GO. **Does NOT** create the Supabase copy, flip flags, run the
  backfill, or deploy (no prod/Supabase access; irreversible; supervised-execution by design).
- **Operator:** creates + destroys the isolated copy; executes the flips, curls, deploys; runs the read-only SQL;
  owns the GO/NO-GO calls and the isolation gate (§4.5).
