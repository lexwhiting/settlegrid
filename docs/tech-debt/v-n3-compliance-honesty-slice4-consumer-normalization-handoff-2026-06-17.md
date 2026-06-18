# V-N3 compliance-honesty SLICE 4 — consumer-side normalization + financial-linkage erasure — ① BUILD HANDOFF (2026-06-17)

> Standalone handoff for the FRESH build agent. READ THIS FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). This chunk closes the
> consumer-twin disclosure-honesty MED routed forward from the SLICE-3 ③ post-seal deep audit. Base = `main`
> @ `075115d7` (SLICE-3 sealed + ③ RE-CERTIFIED + PUSHED). The pre-build PLAN audit (5 lenses + adversarial
> verify, run as a workflow) has ALREADY RUN in the ① session — its sustained findings are folded into the
> plan below; you build the HARDENED plan, not the naive one. DC-16 ledger:
> `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`; DC-05 (test fidelity), DC-11 (paths-only),
> DC-14 (schema/migration divergence), DC-15 (docstring/disclosure sync), DC-17 (idempotent retry).

## 0. Intent, tier, lifecycle
- **WHY:** SLICE-3 made `processDataDeletion`'s `audit_logs.{ip_address,user_agent,details}` disclosure
  UNCONDITIONAL, but its backing consumer-twin scrubs (step 5b) only fire when the twin is FOUND — and the
  twin lookup is byte-exact (`eq(consumers.email, dev.email)`) while consumer emails are stored heterogeneously
  (raw via OAuth/newsletter, lowercased via ask/capture/academic). A cross-path mixed-case twin is MISSED, so
  the unconditional claim can be false. SLICE-3 also DEFERRED the consumer financial/referral linkage
  (`stripe_customer_id`, `default_payment_method_id`, `referral_code`) as disclosed-as-retained. This chunk
  makes the twin lookup reliable AND completes the consumer-side erasure so the disclosure is universally honest.
- **WHO CONSUMES IT:** `processDataDeletion` is the GDPR Art-17 erasure path (still DORMANT — no prod HTTP
  caller; a future deletion route will call it). The persisted `resultUrl` is the erasure-proof artifact.
- **TIER: HIGH-STAKES.** PII/financial erasure boundary; deliberately OPENS the consumer-twin lookup SLICE-3
  froze; changes published disclosure claims; DC-16/DC-11/DC-14 recurrence-prone.
- **Lifecycle:** scope-confirm → (this handoff) → pre-build plan audit [DONE, ① session] → BUILD → executable
  gate → ② seal-gating review → seal + bookkeeping. Founder-close is a LOCAL commit; push only on `/push-go`.

## 1. The subject + the two load-bearing decisions (RESOLVED by the plan audit — build them as resolved)

**Subject:** `apps/web/src/lib/settlement/compliance.ts`, `processDataDeletion` (~lines 421-810). All new
scrubs go INSIDE the existing `db.transaction`, gated on `consumerRecord` where they touch the twin.

### LOAD-BEARING DECISION #1 — `referral_code`: **SCRUB it** (do NOT retain).
The SLICE-3 seal's rationale *"referral_code anchors referral attribution"* is a **category error** and is
FALSE for the column in question. Trace (verified 3 lenses): there are TWO disjoint referral systems —
(1) DEVELOPER commission keys off `referrals.referralCode` (`metering.ts:266`) + the denormalized
`invocations.referralCode` (written from request `body.referralCode`, NEVER from `consumers.referralCode`);
(2) CONSUMER peer-to-peer invite uses `consumers.referralCode` + `consumers.referredByConsumerId`. The ONLY
resolver of `consumers.referralCode` is `consumer/referral/apply:82` (a NEW referee redeeming an inbound code).
Already-granted credits live immutably in OTHER consumers' `globalBalanceCents` + their `referredByConsumerId`
back-link (an **id**, not the code). Nulling this deleted twin's `referralCode` breaks nothing — it only
prevents a brand-new referee from redeeming a deleted account's code (correct). `consumers.referralCode` is
UNIQUE but the index permits multiple NULLs, so nulling is allowed. **→ null it in step 2's `.set()`; move
`consumers.referral_code` retainedUnscrubbed→anonymized; DELETE the "referral_code anchors referral
attribution" clause from the docstring (`compliance.ts:396`) and the `retainedUnscrubbedNote` (`:785`).**

### LOAD-BEARING DECISION #2 — the normalized twin lookup MUST be **byte-exact-first deterministic**.
The naive plan ("change `:486` + `:555` to `lower(consumers.email)=lower(trim(dev.email))` with `.limit(1)`")
is **UNSAFE — it introduces a non-deterministic wrong-row hazard worse than today's fail-safe miss.** Facts:
`consumers.email` UNIQUE is on the RAW value (`drizzle/0000_polite_moonstone.sql:62`); there is **NO functional
`lower(email)` index** anywhere (grep of all migrations + schema = empty). Writers are heterogeneous
(`auth/callback:128` + `newsletter/subscribe:14` store RAW; `ask/capture` + `consumer/academic` lowercase), so
case-variant rows (`Bob@X.com` and `bob@x.com`) CAN coexist. `lower()=lower()` matches BOTH; bare `.limit(1)`
with no `ORDER BY` returns an unspecified row. Realized harms (on a destructive GDPR op): (a) `.limit(1)` at
`:555` anonymizes ONE case-variant row and **leaves the sibling → re-breaks the very unconditional disclosure
this chunk fixes**; (b) `:486` and `:555` are SEPARATE queries that can each pick a DIFFERENT row → the
Supabase auth-user delete and the DB anonymize split across two consumer rows; (c) if the picked row is the
NULL-`supabaseUserId` variant, the real twin's auth user is never captured/deleted (auth-user survival).
*Correction the audit made:* both case-variant rows share the SUBJECT's email, so this is under-deletion /
left-behind-sibling / split-auth, **not** third-party deletion (severity MED, real but conditional).

**→ BUILD THIS:** match normalized BUT with a **byte-exact-first deterministic tie-break**, applied
**IDENTICALLY** to `:486` and `:555` so they cannot diverge. Recommended shape (drizzle):
```
.where(sql`lower(${consumers.email}) = ${dev.email.toLowerCase().trim()}`)
.orderBy(sql`(${consumers.email} = ${dev.email}) DESC`)   // byte-exact twin first, then a stable key
.limit(1)
```
Use the IDENTICAL predicate+order in both lookups. Optionally also prefer
`consumers.supabaseUserId = dev.supabaseUserId` when present, but note: a cross-path ask/capture twin (the
case this chunk fixes) has `supabaseUserId = NULL`, so supabaseUserId alone does NOT find it — the normalized
email match is required; supabaseUserId is only a secondary disambiguator for the rare two-OAuth-users case.
**DC-14 CAVEAT:** `consumers.supabase_user_id` is declared `.unique()` in `schema.ts:167` but **no migration
applies that UNIQUE constraint** (migrations only enforce `clerk_user_id` UNIQUE) — do NOT rely on a
DB-enforced `UNIQUE(supabase_user_id)` for disambiguation without confirming the live constraint. The
**build test MUST seed two case-variant consumer rows and assert the TRUE (byte-exact) twin is the one
captured/anonymized**, and MUST pin the `ORDER BY`/`lower()` SQL literal (not just the bound value) — per the
DC-05/DC-10 SLICE-3 ③ lesson (a value-only assertion misses a `lower→upper`/`=→<>`/dropped-ordering regression).

## 2. Build scope (the hardened plan — A/B/C/D)

**(A) Normalization-robust, byte-exact-first twin lookup** — `:486` (pre-txn auth lookup capturing the twin's
`supabaseUserId`) AND `:555` (step-2 anonymize lookup), identical predicate + `ORDER BY` + `.limit(1)` (per §1 #2).

**(B) Financial-linkage scrub** — extend step 2's `.set()` (currently nulls only email/supabaseUserId/
passwordHash) to ALSO null `stripeCustomerId`, `defaultPaymentMethodId`, `referralCode`. (All nullable text;
confirmed safe — no consumer-side reader keys off stripe/payment for the subject; the developer's own
`stripeCustomerId` is already nulled by step 1.)

**(C) Consumer-keyed completeness — DELETE the credential/PII siblings; RULE the rest (explicit census table):**
- **`apiKeys` (consumerId-keyed) — HIGH, DELETE.** Consumers own their own keys (`consumer/keys:127,142`
  insert with `consumerId=auth.id`); step 3 only deletes by `toolId` (the developer's tools), so a deleted
  twin's keys SURVIVE and still authenticate + bill (the SDK meter). Inside the txn, gated on `consumerRecord`,
  add `tx.delete(apiKeys).where(eq(apiKeys.consumerId, consumerRecord.id))` (mirror of developer step 1b). A
  live credential, NOT tax-retained → delete. **The test mock schemas MUST gain `consumerId`:**
  `compliance-deletion-auth.test.ts:127` (`apiKeys: tbl(['id','toolId'])`) and `settlement-moat.test.ts:86`
  (`apiKeys: { id, toolId }`) — else the `eq()` echo dereferences `undefined` (DC-05 mock-surface).
- **`consumerSchedules` (consumerId-keyed) — HIGH, DELETE.** `payload` jsonb is unvalidated free-form (can
  embed consumer PII); a cron job with no financial-retention basis (mirror `webhook_endpoints` step 6 /
  waitlist step 2b which DELETE). Gated on `consumerRecord`:
  `tx.delete(consumerSchedules).where(eq(consumerSchedules.consumerId, consumerRecord.id))`.
- **RULE explicitly (don't silently omit):** `conversionEvents.metadata` (jsonb, free-form — scrub-or-disclose),
  `outcomeVerifications.disputeReason` (free text — scrub-or-disclose). Inspect the writer; if it can carry
  consumer PII and has no retention basis, scrub/null it (or DELETE the row if consumer-keyed and unretained);
  else add a `retainedUnscrubbed` column-PATH entry. Document the ruling in the build report.
- **No-action (record in the census, do NOT scrub — over-scrub/product-breaking):** `consumerToolBalances`
  (numbers), `consumerAlerts` (channel is a TYPE, no email column), `purchases`/`invocations` (financial,
  tax-retained, FROZEN), `referredByConsumerId` (internal id — leave; it's other consumers' back-link).

**(D) Disclosure + docstring sync (DC-16/DC-11/DC-15):**
- Move `consumers.stripe_customer_id`, `consumers.default_payment_method_id`, `consumers.referral_code` from
  `retainedUnscrubbed`→`anonymized` (consumerRecord-gated, IDENTICALLY to their scrubs). Add `consumer_api_keys`
  (or a distinct path — note `api_keys` is currently `toolIds>0`-gated for the developer's tools; use a DISTINCT
  consumerRecord-gated entry like `api_keys` broadened or a new path) and `consumer_schedules` to `anonymized`.
- Every `resultUrl` entry stays a column PATH, never a row value (DC-11).
- Update the docstring DEFERRED notes (`compliance.ts:392-398`) — remove the now-scrubbed consumer fields from
  the "DEFERRED" block; DELETE the false "referral_code anchors referral attribution" rationale from `:396` and
  the `retainedUnscrubbedNote` (`:785`). Keep the org/ledger sentences (those stay deferred). Banned-legal-
  conclusion class stays clean.
- **Rewrite the existing test block** `compliance-deletion-auth.test.ts:581-615` (`V-N3 SLICE 3 RECOVERY
  (F-3/4/5): consumer financial/referral disclosed-as-retained`): it HARD-pins the three fields in
  `retainedUnscrubbed` (`L594/595/596`), `not.toContain` in `anonymized` (`L599`), and the note pin
  `/referral_code anchors referral attribution/i` (`L601`) — ALL go RED on the scrub. Rewrite to assert the
  fields now appear in `anonymized`, the `.set()` nulls them, and DROP the note pin. (`compliance-honesty-
  regression.test.ts` does NOT pin these — its note pins cover only `organizations.billing_email` + the ledger
  sentence, which this chunk FREEZES; leave it, but update the stale "survives" comment if one names these.)

## 3. Frozen / unchanged (do NOT perturb)
The developer-side steps (1, 1b, 3-8 except the consumer-twin-gated additions), the status machine
(pending→processing→completed|failed), the idempotent-`completed` no-op, the `catch`→`failed`, the
atomicity/idempotency contract (`completed` set only at the end inside the txn; all new scrubs idempotent on a
`failed` retry), `tools.name/slug` (RETAIN), `organizations`/`organization_members` (still DEFERRED + disclosed),
the `ledger_entries` payer scrub (legal-gated → V-N3-erasure), the `data-retention` cron. `packages/mcp` UNTOUCHED.
The audit CONFIRMED these are correctly left alone.

## 4. Gate + the two named "silently-wrong" risks
- **Gate:** `cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → must end `tsc` 0 · `lint` 0
  err (8 pre-existing warns) · `vitest` ALL-pass. Baseline @ `075115d7` = **4557/197/0**; this chunk ADDS tests
  (new lookup-determinism + apiKeys/consumerSchedules deletes + rewritten F-3/4/5 block). `${PIPESTATUS}` is
  empty under zsh — read the `Test Files`/`Tests` summary lines.
- **The two decisions most likely silently wrong** (audit judgment concentrated here): #1 the byte-exact-first
  DETERMINISM of the twin lookup (a value-only test passes a non-deterministic lookup); #2 whether `referral_code`
  is truly safe to scrub (it is — but the build must DELETE the stale retain-rationale, or the disclosure stays
  dishonest). Both are RESOLVED above — build them as resolved, and pin them with the determinism test + the
  sql.strings pin.

## 5. Defect classes in play
DC-16 (claim integrity — the unconditional disclosure becomes universally true once the twin is reliably found +
fully scrubbed), DC-11 (resultUrl paths-only), DC-13 (over-scrub — do NOT blanket-delete financial/product
tables), DC-14 (the unapplied `supabase_user_id` UNIQUE — do not rely on it), DC-15 (docstring/note/test sync),
DC-17 (idempotent retry — all new deletes/null-sets are no-ops on re-run), DC-05/DC-10 (mock schemas must gain
`consumerId`; tests pin the predicate shape AND the `lower()`/`ORDER BY` sql literal, per the SLICE-3 ③ lesson).
SEAM + LITERAL-EXECUTION standing.
