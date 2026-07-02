# containment-hardening — ③ post-seal deep audit — 2026-07-02

> **Chunk:** `containment-hardening` (G4-3 auth limiters fail-closed + G4-4 money-column drift tripwire) · **Tier:** HIGH-STAKES · **Sealed:** ② `35c6b177` (UNPUSHED).
> **Scope of THIS phase:** the INTEGRATED WHOLE on the committed tree — latent defects, cross-chunk seams, and defect-class recurrences a diff-scoped ② review structurally could not reach.
> **VERDICT: 🟡 RE-CERTIFIED (HARDENED).** The G4-4 tripwire — the chunk's central new correctness guard — was **DEAD-ON-ARRIVAL in prod** (it threw on every real execution and silently never ran). Fixed + 5 more findings closed, all with live fail-then-pass. G4-3 (the five fail-closed flips) was independently confirmed SOUND. **The ③ hardening (6 files) MUST be committed before `/push-go` — do not push the dead G4-4.**

---

## 0. High-stakes confirmation (one line)

Confirmed HIGH-STAKES per the seal record §Tier: security boundary (auth brute-force fail-mode) + a new money-correctness guard on the no-rollback `drizzle-kit push` substrate + Art.17 legal-correctness. This phase is warranted.

## 1. Method

- **Mechanical pre-flight (integrator, this session):** full gate clean from `apps/web` (tsc 0 / lint 0 / vitest 225f·5143p·0f — matches seal); independent re-derivation of all 13 manifest columns + both CHECKs vs `schema.ts` (exact match); migration SQL confirmed (`drizzle/0005` CHECKs, `drizzle/0010_payouts_index_includes_unknown` predicate `WHERE "status" IN ('processing','unknown')`); driver = `drizzle-orm/postgres-js` (RowList); `isProduction()===NODE_ENV==='production'` (env.ts:120); exactly 5 `failMode:'closed'` call-sites (grep); auth-surface secret-compare sweep. Env traps unset.
- **Fan-out:** **workflow** (operator-opted), 6 lens-distinct `claude-opus-4-8[1m]` reviewers at session **xhigh** (G4-3 fail-mode/completeness · G4-4 drift-correctness · SEAM · LITERAL-EXECUTION · integration/substrate/prod-gap · test-teeth), then a **collective-miss critic** at xhigh (max bump not taken — operator chose xhigh-throughout; noted). All Read/Grep only; the gate + all reproductions ran in the main session. 7/7 agents returned, 0 empty. ~626k reviewer tokens.
- **Integration/seal stayed in the main session:** every sustained finding reproduced live (fail-then-pass) before its fix landed.

## 2. Findings & dispositions

### 🔴 HIGH-1 — G4-4 drift checker was DEAD-ON-ARRIVAL in prod (DC-14 / INTEGRATION) — FIXED
`money-schema-check.ts` built all three introspection queries as `… = ANY(${jsArray}::text[])`. Interpolating a **JS array** into a drizzle `sql` template renders it as a **`($1, $2, …)` RECORD tuple**, and `(…)::text[]` casts a *record* to `text[]` — Postgres rejects it at parse-analysis: **`cannot cast type record to text[]`**. So the FIRST query threw on every real prod execution → caught by `runMoneySchemaCheck`'s try/catch → routed to `logger.warn('schema.check_unavailable')` (deliberately **not** in `MONEY_LOSS_KEYS`, warn-level, not mirrored to Sentry). **Net: on every warm-instance cold start the check inertly failed; a later `drizzle-kit push` dropping `developers.balance_cents DEFAULT 0`, flipping a NOT NULL, weakening `amount_cents > 0`, or recreating the payout mutex without `'unknown'` would be detected by NOTHING and page NOTHING.** The commit's central `drift → logger.error → pages` claim was false in prod. The mocked-`execute` unit tests never exercised the real drizzle render, which is exactly why ② (diff-scoped, byte-verifying the *downstream* RowList/normalization logic that is never reached) missed it.
- **Confirmed two independent ways:** integrator drove `PgDialect.sqlToQuery` → `… = ANY(($1, $2, $3)::text[])`; the workflow critic executed it against live **Postgres 17** → `ERROR: cannot cast type record to text[]`.
- **FIX:** a `textArray()` helper renders `= ANY(ARRAY[$1, $2, …]::text[])` (a genuine `text[]`), applied to all three queries.
- **NEW TEETH (the class ② couldn't have):** `money-schema.test.ts` "query-render teeth" drives `verifyMoneySchema`, captures the `SQL` objects handed to `db.execute`, renders each via `PgDialect`, and asserts **none** is a `ANY(($…` record-tuple cast and **each** is `ANY(ARRAY[$…`. RED against shipped bytes → GREEN after fix.

### 🔴 HIGH-2 — payout-mutex index check asserted the predicate but NOT UNIQUE-ness / key column (DC-24) — FIXED
(Integrator pre-flagged as INT-1; independently found by the G4-4 lens.) The index check sliced to the `WHERE` predicate and matched `'processing'`/`'unknown'`, but **never asserted the index is `UNIQUE` or keyed on `developer_id`** — yet the partial-UNIQUE property *is* the mutex. A same-named **non-unique** index (`CREATE INDEX …`, e.g. from an incident DROP+CREATE runbook or a future raw migration) — or one re-keyed onto a trivially-unique column (`… (id) …`) — keeps name+predicate → **zero drift reported**, while two concurrent `'processing'` payouts for one dev both insert with no unique violation → **silent double-pay**. Same defect *class* as the ② HIGH (a mutex-integrity control that passes a broken mutex), on the uniqueness dimension.
- **FIX:** manifest `MoneyIndexSpec` gains `unique` + `keyColumn`; the checker asserts `CREATE UNIQUE INDEX` + `(developer_id)` against the un-sliced **header** (before `WHERE`), emitting a new `index_definition_mismatch` drift. Predicate check unchanged (still WHERE-scoped).
- **TEETH:** non-unique same-named index → drift; re-keyed (`id`) index → drift. RED→GREEN.

### 🟠 MED-1 — `normalizeLiveDefault` took the FIRST integer anywhere in `column_default` (DC-14) — FIXED
`/-?\d+/.exec(raw)` grabbed the leading digit-run, so an expression default whose text begins with the expected value false-passed: `tax_cents` (expected default 0) drifting to `(0 + 500)` → `exec` matched `0` → `0 === 0` → **no drift**, while every non-tax ledger row now silently defaults to 500 → reconciliation over-remits tax. Realism is bounded (a bare-integer drift like `DEFAULT 5` was already caught; this needs a live-DB expression default that `drizzle-kit push` doesn't emit for these columns — a manual-DDL scenario), but it is precisely the substrate-drift the guard exists for.
- **FIX:** accept ONLY a pure integer literal (optionally stripping one `::int/…/bigint` cast and surrounding quotes); any expression/function default on a money column normalizes to `NaN` → itself a drift. Healthy `0` / `0::integer` still accepted (guard test added).
- **TEETH:** `(0 + 500)` on `tax_cents` → `default_mismatch`; `0::integer` on a healthy column → NO drift. RED→GREEN.

### 🟠 MED-2 — CHECK-constraint query scoped by `conname` only (DC-14 / SEAM) — FIXED
`SELECT … FROM pg_constraint WHERE conname = ANY(…)` had **no `contype='c'` and no namespace filter** — asymmetric with the column/index queries (which scope `public`). A same-named constraint in a second schema (staging/shadow) could satisfy `definitionContains` while the real `public.ledger_entries` positivity CHECK was dropped → GREEN while negative-amount rows become writable.
- **FIX:** `WHERE contype='c' AND connamespace='public'::regnamespace AND conname = ANY(…)`.
- **TEETH:** render-teeth assert the query contains `contype = 'c'` + `connamespace = 'public'::regnamespace`. RED→GREEN.

### 🟠 MED-3 — only 3 of the 5 G4-3 flips were guarded (DC-24 / DC-08) — FIXED (test-only)
The `credential-limiters-fail-closed` teeth exercised only the three **ip** buckets; the two **uid** buckets (`mfa-verify:uid`, `tools-claim:uid`) were unreachable (the ip 429 or an unmocked `requireDeveloper` 401 returned first), so reverting `failMode:'closed'` on those two post-auth credential-brute-force sites shipped GREEN — the exact DC-08 regression the chunk prevents, on 2 of 5 surfaces.
- **FIX:** two uid-bucket tests — `requireDeveloper` mocked to succeed, ip bucket let through, uid bucket rejects → 429. Verified: reverting either uid flip → 500 ≠ 429 → RED (reproduced live), restored.

### 🟡 SEAM hardening — paging-teeth `it.each` was a hand-maintained list that had already drifted — FIXED
`logger.test.ts`'s money-loss `it.each` was a hardcoded copy of `MONEY_LOSS_KEYS` and **already omitted `proxy.idempotency_gate_unavailable`** — so a paging-wiring regression on any member (incl. this chunk's new key and every future key) could escape. **FIX:** `export const MONEY_LOSS_KEYS` and iterate `[...MONEY_LOSS_KEYS]` — self-maintaining teeth; plus an explicit guard that `schema.money_column_drift` is IN and `schema.check_unavailable` is OUT (the G4-4 paging design). (`logger.ts` was already in-scope; export-only, zero behavior change.) 4th-consecutive SEAM/comment-truth recurrence in this cadence — filed.

### Dispositioned WITHOUT a code change (documented — proportionate, no active defect)
- **LOW — teeth-A does not bind `spec.col` to `spec.table`** (3 columns share the name `balance_cents`; a mis-wired same-shape `col` reference could pass): the **live** check keys by `table.column` and is unaffected — `spec.col` feeds only the manifest↔schema.ts teeth, and the current references are correct. Latent-only → **§P/roadmap** (already noted at ②).
- **INFO — instrumentation hardcodes `NODE_ENV==='production'` vs `isProduction()`**: provably identical today (env.ts:120); changing it adds an edge-compiled import for zero behavior gain → **accepted, no change**.
- **INFO/LOW — gate hang residual, availability inversion, missing-Upstash-env partial-breakage**: all DISCLOSED/intended (`failMode:'closed'` is env-dependent by design; the seal documents the hang residual + per-surface backstops). The missing-env case (the 5 fail-closed surfaces hard-429 while ~100 fail-open co-tenants stay green, so a bad deploy is non-uniformly broken) → **§P operational note**.
- **LOW — `schema.check_unavailable` is warn-level → a PERSISTENT introspection failure leaves the DC-14 control non-functional with no proactive page**: this is by design (a transient boot blip must not false-page money-loss). Given HIGH-1 meant the check *was* persistently failing unseen, the **§P live-prod verification item is now load-bearing** (see §3). Changing the paging semantics is a monitoring-policy decision beyond this chunk's scope → **§P**, not a code change here.
- **INFO — `settlement/reconcile` has no rate limiter** (admin key, high-entropy): pre-existing, correctly OUT of G4-3.

### Load-bearing confirmations (moats HOLD)
- **G4-3 is SOUND:** `failMode` is strictly per-call (never mutates the shared `Ratelimit`), so no bleed to fail-open co-tenants (account-delete Art.17 safe); no bucket-key collisions (every prefix distinct); block behavior correct on all three store outcomes (healthy/reject/hang); the LBD-2 hang residual is accurate for this Upstash config (no `timeout` set → 5s race resolves `success:true` inside `limiter.limit()`); `{mfa-verify, tools-claim, gate}` is the complete set of app-side-limited low-entropy credential surfaces (ap2/circle/telemetry compares = machine credentials; account step-up = Art.17-frozen; login = client-side GoTrue, no app limiter).
- **G4-4 (post-fix):** detects the full realistic drift space (column drop/rename/retype/nullability/default; CHECK drop/weaken; index drop/predicate-drop/**non-unique**/**re-key**) with correct normalization; the downstream renderings (`pg_get_constraintdef`, `pg_indexes.indexdef`, `column_default`) match the fixtures (critic-verified vs live pg 17); zero-drift-on-healthy holds; the fire-and-forget wiring never throws (terminal try/catch); paging wiring byte-exact.

## 3. Residuals → §P / roadmap (NOT code-closeable here)

- **§P (now load-bearing) — live-prod verification:** the unit tests MOCK `execute`; confirm the FIXED `verifyMoneySchema` runs CLEAN against live prod on first boot (all 13 columns + both CHECKs + the UNIQUE index-with-predicate present) — HIGH-1 means it has produced ZERO real signal to date, so nothing about prod schema state has actually been asserted by this control yet. It only PAGES (never blocks); a first-boot false-page is loud+recoverable.
- **§P — `SENTRY_DSN` set in prod** (else a real drift logs stderr but never pages) · **`GATE_PASSWORD` prod state** (gate flip's value) · **Supabase-Auth rate-limit note** (F7) · **missing-Upstash-env → 5-surface hard-429** operational awareness.
- **Roadmap:** teeth-A `col↔table` binding; consider whether a persistent `schema.check_unavailable` should escalate to a (deduped) page; `settlement/reconcile` limiter.

## 4. Defect-class ledger (recurrences filed LOCAL)

- **DC-14 (schema-db divergence):** HIGH-1 (dead-on-arrival query), MED-1 (first-integer default), MED-2 (unscoped CHECK query). New cue: **a DB-introspection control must be executed against a real engine (or its exact query rendered) at least once — a mocked `execute` cannot catch a query-GENERATION defect.**
- **DC-24 (toothless control):** HIGH-2 (index shape unasserted), MED-3 (uid flips unguarded), the paging-teeth drift. Cue reinforced: **a control that asserts a *fragment* (predicate) of a compound invariant (a UNIQUE partial index) is toothless on the un-asserted dimensions; and teeth must reach EVERY guarded call-site, not just the first one on the path.**
- **SEAM (standing):** hand-maintained `MONEY_LOSS_KEYS` copy drifted → enumerate the source. **4th consecutive SEAM recurrence** in this cadence — standing pre-seal comment/enumeration-truth pass remains warranted.
- **LITERAL-EXECUTION (standing):** `= ANY(${jsArray}…)` does *literally* what drizzle renders (a record tuple), not what it reads like; `normalizeLiveDefault`'s `/-?\d+/` literally grabs the first digit-run. Cue: **render/execute the interface, don't read its intent.**
- **DC-08 (fail-mode):** CONFIRMED CLEAN (G4-3 flips land on exactly the right surfaces).

## 5. Evidence

- **Full gate, hardened tree, clean `apps/web`:** `tsc 0 · lint 0 · vitest 225 files / 5154 passed / 0 skip / 0 fail`. Reconc: 5143 (② seal) → +7 money-schema (2 render + 2 index-shape + 1 expr-default + 1 default-cast-accept + 1 take_cents-weaken) + 2 credential uid + 2 logger (enumerate delta + guard) = **5154**. No migration (`schema.ts`/`drizzle/` untouched).
- **Fail-then-pass reproduced live** for HIGH-1 (render), HIGH-2 (×2 index shape), MED-1 (expr default), MED-2 (CHECK scoping) — 5 tests RED vs stashed shipped source → GREEN with fixes; MED-3 uid teeth RED on flip-revert → GREEN restored.
- **HIGH-1 double-confirmed:** integrator `PgDialect` render (`ANY(($1,$2,$3)::text[])`) + critic live pg-17 (`cannot cast type record to text[]`).

## 6. ③ hardening diff (explicit pathspec — MUST be committed before `/push-go`)

**INCLUDE (6 files, all under `apps/web/src`):**
`lib/db/money-schema-check.ts` · `lib/db/money-schema-manifest.ts` · `lib/db/__tests__/money-schema.test.ts` · `app/api/__tests__/credential-limiters-fail-closed.test.ts` · `lib/logger.ts` · `lib/__tests__/logger.test.ts` · (+ this record).
**EXCLUDE (pre-existing, dirty at session start — leave untouched):** `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-*`, `.claude/`, other `*-deepaudit-*.md`, `launch-gate-queue.md`, `v-n3-*`, `mfa-delete-smoke.sh`.

## 7. Verdict

**🟡 RE-CERTIFIED (HARDENED).** G4-3 stands as sealed (moats independently confirmed). G4-4 was non-functional in prod at seal time (dead-on-arrival) and is now functional, hardened against the full realistic drift space, and covered by executability-level teeth the mocked design lacked. Gate GREEN, zero HIGH/MED open. **The ③ hardening must be committed before push** (do not `/push-go` the dead G4-4). No frozen surface perturbed; no deferred work pulled in; no migration.
