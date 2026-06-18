# V-N3 compliance-honesty SLICE 4 — ③ POST-SEAL DEEP AUDIT RECORD → SEAL STANDS (2026-06-18)

> Integrated-whole post-seal deep audit of the SEALED SLICE-4 chunk (the consumer-side
> normalization + financial-linkage erasure slice). LOCAL only — NOT committed, NOT pushed.
> Base = `main` @ `075115d7`; SLICE-4 work uncommitted on top. Seal record:
> `v-n3-compliance-honesty-slice4-seal-2026-06-18.md`. ③ handoff:
> `v-n3-compliance-honesty-slice4-post-seal-deep-audit-handoff-2026-06-18.md`.
> DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

## Verdict
**SEAL STANDS — re-certified AS-IS, no hardening folded, no finding escalated.** The integrated
whole on the committed-as-sealed tree is air-tight and to-spec (A–F of the hardened plan). Six
decorrelated passes (4 fresh-context lens-distinct Opus-4.8 reviewers + a collective-miss critic +
the integrator's own source-level DC-16 / core-invariant ground-truth) found **zero sustained
findings** of any severity that are new, blocking, or in-scope. Every item surfaced is pre-existing,
non-blocking, dormant, or out-of-scope, and the tests were re-confirmed non-vacuous — so there was
no test-vacuity gap to fix (the only fix-class ③ is authorized to fold) and no production-surface
change is warranted or authorized. `compliance.ts` shasum `724e1a2719b01043e50c8c2ac8aa805a1344dd9f`
**UNCHANGED** through the entire audit (read-only reviewers; quiescence re-verified at the end).

## Mechanical pre-flight (handed to the reviewers; none re-derived these)
- **Gate GREEN, clean isolated run:** `tsc` exit 0 (0 errors) · `lint` 0 err (8 pre-existing
  `<img>`/react-hooks/unused-disable WARNINGS only) · `vitest` **197/197 files · 4566/4566 tests ·
  0 failed/0 skipped**. Matches the seal baseline exactly.
- **Tree quiescent:** `compliance.ts` shasum `724e1a2…` matched the seal digest at audit start AND
  at audit end (the read-only reviewers did not perturb the tree). git status identical to seal.
- **Env clean:** `CLAUDE_CODE_FORK_SUBAGENT` / `CLAUDE_CODE_SUBAGENT_MODEL` / `CLAUDE_CODE_EFFORT_LEVEL`
  all UNSET. Allowlist GREEN (git/tsc/lint/vitest/npm-test + `settlegrid-discovery` MCP). HEAD `075115d7`.

## The six passes and what each concluded

### (A) DC-16 CROSS-SURFACE claim census — CLEAN (no contradiction)
Re-walked the COMPLETE deletion-claim surface set — `app/docs/page.tsx` (FAQ family),
`app/privacy/page.tsx`, `app/(dashboard)/dashboard/settings/page.tsx`, `lib/email.ts
accountDeletedEmail` — claim by claim. **No surface names the consumer twin, its Stripe/payment/
referral linkage, schedules, conversion metadata, or consumer API keys**, so SLICE-4's new
*disclosed-as-anonymized* consumer fields can falsify no public claim; the removed "referral_code
retained" sentence lived ONLY in the in-code JSON manifest, never on a public surface. Every live
deletion claim is CONSISTENT or a benign UNDER-CLAIM (the code now erases strictly more than any
surface promises — the safe direction). The only flags are PRE-EXISTING STALE-DRIFT on FROZEN
surfaces, unchanged since the SLICE-3 ③ log (`docs:607/652` "delete through the API" with no
deletion route; the `email:734`/`settings:2155` "30-/90-day permanently removed" hedge vs the 7-yr
financial retention) — travel items, NOT SLICE-4 regressions. The SLICE-1/2/3 census-miss class did
NOT recur.

### (B) COMPLETE consumer-keyed-PII deletion-surface census — EXHAUSTIVE, no silent miss
Independently enumerated every consumer-keyed table and ruled each. **Integrator-confirmed at source:**
exactly **9** `references(() => consumers.id)` FKs exist in `schema.ts` (lines 204/246/324/375/508/547/
615/647/1268); `outcome_verifications.consumer_id` carries only an `index(...)` (line 1230), **no FK**
— so its NO-ACTION ruling is sound (a `consumers.id`-keyed scrub would no-op; disclosing it would be a
false claim). The only consumer-subject email columns are `consumers.email` (anonymized) and
`waitlist_signups.email` (deleted); `consumerAlerts.channel='email'` is a type enum, not an address.
**Write-surface closure:** the entire `api/consumer/*` insert surface targets exactly the six tables
already in the census — there is no seventh consumer-keyed table. Every free-form consumer column
(`consumer_schedules.payload`, `conversion_events.metadata`, `tool_reviews.comment`, `audit_logs.details`,
`invocations.metadata`) is scrubbed; `outcome_verifications.dispute_reason` is correctly excluded with
the independently-verified opaque-id rationale. **handoff §2C is EXHAUSTIVE — no un-enumerated
consumer-keyed PII table neither scrubbed nor disclosed.** The two retained-PII items
(`ledger_entries.operation_id`/`metadata.payer`; `organizations.billing_email`) are DISCLOSED, not silent.

### (C) Correctness / determinism / idempotency / reader null-safety — all CONFIRMED
Both twin lookups (pre-txn auth `:507-512`, step-2 anonymize `:580-585`) are byte-identical in
predicate + ORDER BY — WHERE binds the NORMALIZED value, ORDER BY binds the RAW value; a TOTAL order
over the NOT-NULL uuid PK that cannot tie → both resolve the same physical row. All four new consumer
scrubs are INSIDE the txn; `status:'completed'` is written only at the final step (`:791`); every new
write is idempotent on a `failed` retry. `.set()` nulls are literal `null` (not `undefined`). `api_keys`
emitted EXACTLY ONCE in `anonymized` (the `toolIds>0 || consumerRecord` OR-gate). **Reader null-safety:
every reader of the four newly-nulled columns** (`consumers.stripe_customer_id`,
`consumers.default_payment_method_id`, `consumers.referral_code`, `conversion_events.metadata`) is
null-safe — `if (!customerId)` guards on the Stripe paths, a `WHERE referralCode=?` that simply fails
to match a nulled code, metadata readers that only serialize it. No latent NPE/500.

### (D) SEAM + LITERAL-EXECUTION + the F-1/F-2/F-3 ruling — all PASS
- **SEAM:** every email writer's storage form (OAuth/newsletter RAW; ask-capture/academic/waitlist
  lower+trim) is matched by the `lower()` lookup — no writer is missed on case. `deleteSupabaseAuthUser`
  confirmed idempotent on 404. **Complete `consumers.referralCode` reader census (integrator-confirmed
  at source):** the ONLY behavioral resolver is `consumer/referral/apply:82`; every commission path keys
  off `body`/`invocations`/`referrals.referralCode`, never `consumers.referralCode` — nulling is safe and
  the removed "anchors attribution" rationale was genuinely false. **DC-14:** no functional `lower(email)`
  index exists in any migration → case-variant rows can coexist (the F-premise).
- **LITERAL-EXECUTION:** the `sql\`...\`` fragments execute as Postgres `lower(email)=$1` / byte-exact-
  first `(email=$2) DESC` exactly as commented.
- **F-1/F-2/F-3 ruling — "pre-existing + not-worsened" INDEPENDENTLY CONFIRMED TRUE.** Scenario-by-
  scenario OLD (`git show 075115d7`, `eq(email,dev.email) LIMIT 1`) vs NEW: S0 identical; S1a identical;
  **S1b (lowercased-only twin) NEW finds 1, OLD missed → strictly better; S2 (two coexisting variants,
  byte-exact present) NEW scrubs the SAME row OLD did and leaves the SAME sibling → identical count;
  S2′ (no byte-exact) NEW finds 1, OLD missed both → strictly better.** In NO scenario does NEW scrub
  fewer rows or make S2 worse. The all-rows fix (`inArray` over ALL `lower(email)` matches) is correctly
  a FOLLOW-UP; **no escalation to BLOCKING.**

### (E) Collective-miss completeness critic — no material findings
- **Data-export path is structurally immune:** `collectDeveloperData` (`:127-254`) reads only
  developer/tool-keyed tables, never `consumers` — a consumer twin's PII cannot leak into a developer
  export, before or after SLICE-4. `exportVersion`/`categories` honest.
- **Tests non-vacuous:** the new SLICE-4 assertions in `compliance-deletion-auth.test.ts:611-789`
  genuinely pin behavior — financial-scrub presence on the captured `.set()`, sibling deletes
  disambiguated by **table identity** (not a mock echo), the negative `outcome_verifications`
  forbidden-state test, and a real determinism pin on literal SQL text — each goes RED if the behavior
  is reverted. `settlement-moat.test.ts` seeds no twin BY DESIGN (the dedicated auth-test file covers
  the twin path).
- **Cross-chunk seams clean:** the `cron/data-retention` purge of `compliance_exports` and the
  `conversion_events` 180-day purge have no ordering hazard with the new scrubs; the idempotent-`completed`
  no-op short-circuits before any consumer work; the only `resultUrl` reader (the export-download
  endpoint) streams it verbatim and never parses the manifest arrays. `processDataDeletion` has **zero
  non-test callers** (DORMANT — re-confirmed independently).

### (Integrator) DC-16 core-invariant ground-truth — ZERO disclose-without-scrub
Verified directly against the manifest in `compliance.ts:792-846`: every entry in the `anonymized`
array is backed by a scrub under the LITERALLY identical gate (`consumers.*` ↔ step-2 `.set()`;
`consumer_schedules` ↔ the delete; `conversion_events.metadata` ↔ the null; `api_keys` once under the
OR-gate; the developer/tool/audit paths ↔ their steps). The two `retainedUnscrubbed` items are honestly
disclosed with the note. No false or incomplete public claim in S0/S1.

## Findings ledger (all NON-BLOCKING; nothing fixed under ③)
1. **SEAM micro-observation — column-side `lower()` without `trim()`** (LOW, NEW observation, confidence
   med). The twin lookup's WHERE is `lower(consumers.email) = dev.email.toLowerCase().trim()` — the LHS
   is not trimmed. A stored consumer email with surrounding whitespace would be MISSED. Dormant in
   practice (Supabase normalizes auth emails; zod `.email()` rejects surrounding whitespace;
   ask/capture/academic store `lower+trim`) and **NOT introduced by SLICE-4** — OLD trimmed neither side,
   so NEW is strictly better. Touches the FROZEN production lookup → out of ③'s fix bounds → **folded into
   the all-rows consumer-twin erasure follow-up** (the symmetric `lower(trim(email))` fix lands there
   alongside F-1/F-2/F-3 and the F-4 empty-email guard).
2. **F-1/F-2/F-3 — single-row `LIMIT 1` under-deletes a coexisting case-variant sibling** (MED,
   PRE-EXISTING, not-worsened — independently confirmed above). Correctly routed to the all-rows
   consumer-twin erasure follow-up chunk.
3. **DC-14 schema/migration drift** (INFORMATIONAL): migrations frozen at `0000`; live schema is
   drizzle-kit-push-managed. Pre-existing, repo-wide, already logged. The code correctly does not rely on
   any DB-enforced constraint the migrations omit.
4. **SEAM gating-uniformity** (LOW): consumer paths disclosed gated on twin EXISTENCE, not rows-MATCHED —
   non-false under the "column PATHS only" contract (matches the `tool_reviews`/`invocations.metadata`
   precedent). Optional uniformity hardening → follow-up.
5. **Pre-existing copy stale-drift** (docs "delete through the API"; email/settings "30/90-day removed"
   hedge) — FROZEN surfaces, travel items, unchanged from SLICE-3 ③.
6. **Structural notes (pre-existing, unreachable/benign):** the export-download endpoint does not filter
   on `requestType`; the 30-day purge of `compliance_exports` erases the `resultUrl` erasure-proof (N4).
   Untouched by SLICE-4.

## Defect classes
No NEW defect class. The standing **SEAM** and **LITERAL-EXECUTION** classes recurred only as clean
passes / one LOW nit (the whitespace asymmetry, routed forward). DC-16 SLICE-4 claim-honesty surfaces
remain CLOSED (every anonymized path backed; cross-surface census clean; consumer-keyed-PII census
exhaustive). Touchpoints unchanged from the seal: DC-11 (paths-only), DC-13 (over-scrub guard /
`outcome_verifications` NO-ACTION), DC-14 (drift, not relied on), DC-15 (docstring/note/test sync),
DC-17 (idempotent retry), DC-05/DC-10 (accepted non-evaluating-mock limitation; the durable two-row
RESOLUTION guard remains a real-Postgres integration test).

## Policy / orchestration
PATH 1 unavailable (no `.claude/agents/` effort-bearing pool). The `xhigh` baseline fan-out ran as
Agent-tool spawns (operator-elected; allowlist GREEN mooted a workflow's loud-pause edge). The decisive
DC-16 core-invariant / collective-miss adjudication ran in-session as the integrator's source-level
ground-truth pass. **Effort coverage note:** the reviewers self-reported mixed effort — lenses A/B/C and
the collective-miss critic at `high`, lens D (the F-1/F-2/F-3 ruling, the one carrying the actual
scoped-forward risk) at `xhigh`. The below-`xhigh` runs are recorded as a coverage note (not a blocker);
the convergent clean findings across six decorrelated passes, the integrator's source-level
ground-truthing of every load-bearing claim, and the green gate support the re-certification. Env clean;
all reviewers self-reported `claude-opus-4-8[1m]`.

## Founder-close (the gated next step — NOT performed here)
A single path-scoped LOCAL commit of `apps/web/src/lib/settlement/compliance.ts` + the 2 test files +
the slice-4 docs (handoff, build report, seal, ③ handoff, this ③ record). **EXCLUDE
`apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`** (out-of-scope `slugify` UI change). `/push-go`
is a separate explicit gate — do NOT push.
