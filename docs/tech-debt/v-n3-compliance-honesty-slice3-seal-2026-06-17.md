# V-N3 (compliance-honesty SLICE 3, RECOVERY build) — deletion-completeness scrub + the two ②-blocking HIGHs closed → SEALED (2026-06-17)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed** (push is a separate `/push-go` gate). Base = `main` @ `c3b78fce` (SLICE 2 sealed + ③
> RE-CERTIFIED + PUSHED); the SLICE-3 work is uncommitted on top. This is the RECOVERY build that
> closes the two sustained HIGH findings that BLOCKED the first SLICE-3 ② (F-1, F-2) while KEEPING the
> already-correct 4-scrub diff. Predecessors: `v-n3-compliance-honesty-slice3-handoff-2026-06-16.md`
> (① build + §7 plan-audit), `v-n3-compliance-honesty-slice3-RECOVERY-handoff-2026-06-17.md` (the
> recovery brief). DC-16 ledger: `.audit/defect-ledger/DC-16-public-claim-content-integrity.md`.

## Verdict
**SEALED** — gate green, zero high-severity findings open, reviewers' evidence supports it (5 lenses +
the integrator's own max core-invariant/census pass; F-1 + F-2 reproduced live fail-then-pass).

## What shipped (one line)
`processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts`) gains, all INSIDE the existing
`db.transaction`: the original 4 SLICE-3 scrubs (developer `notificationWebhooks: {}`; a normalized
`waitlist_signups` DELETE keyed on `lower(email)` with a row-count-gated disclosure; `audit_logs.details`
nulled; the `tools` infra trio `sourceRepoUrl/proxyEndpoint/crawlMetadata` nulled, name/slug PRESERVED)
**plus the two RECOVERY fixes** — **F-1** a census-backed broadening of the `audit_logs.details` scrub
to ALL three keying paths (step 5 `developerId`, step 5b `consumerId` gated on a consumer twin, step 5c
the cross-principal `and(inArray(resourceType,['developer','developer_signup']), eq(resourceId, developerId))`
that catches the admin chargeback-unpause leak), and **F-2** nulling the subject-authored
`tool_reviews.developer_response`/`developer_responded_at` keyed on `inArray(toolId, toolIds)` + a
`toolIds>0`-gated disclosure — and the disclosure now also discloses-as-retained the deferred consumer
financial/referral linkage (`consumers.stripe_customer_id`/`default_payment_method_id`/`referral_code`,
gated on a twin) and `organizations.billing_email`, with the org/consumer posture folded into the single
`retainedUnscrubbedNote` (no banned legal conclusion).

## Gate (re-verified clean isolated, this session — TWICE: at review and at seal time)
apps/web `tsc` 0 · `lint` 0 err (8 pre-existing `<img>`/hooks/unused-disable WARNINGS only, none in
touched files) · **`vitest` 4555 / 197 / 0** (baseline @ `c3b78fce` 4525 → delta = **+30** new SLICE-3
tests; the prior-② BLOCKED run was 4542, i.e. +13 added by the recovery's F-1/F-2/F-3-5 behavioral +
disclosure pins). packages/mcp UNTOUCHED (apps/web-only diff). The recovery build left NO
self-verification evidence in cadence-state (its `gate` field carried the stale prior-② `4542`); per the
cadence the green was treated as evidence-free and the gate **re-derived from scratch** — the authoritative
number is 4555.

## Review shape
5 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff (correctness/determinism ·
spec-conformance · SEAM · literal-execution/test-vacuity — via Agent-tool spawns) **+ the integrator's
own core-invariant / `audit_logs` PII census pass at `/effort max` in the main session**. **0 high · 0
sustained medium that is in-scope; the two MEDs that remain are a frozen-surface deferral and an accepted
unit-mock limitation (below).**

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) unavailable — no
`.claude/agents/` pool (and `~/.claude/agents`, `~/.claude-3/agents` both ABSENT) carries `effort:`
frontmatter, and a running agent cannot stand one up mid-run. A `max` core-invariant lens forces
Agent-tool Path-1 territory and a single workflow cannot host a mixed-effort fan-out, so the fan-out ran
as Agent-tool spawns; operator elected `/effort max` and the **integrator personally ran the decisive
census + the live F-1/F-2 reproduction in the confirmed-max main session** (ad-hoc spawn effort
self-reports are unreliable — all 4 reviewers reported `claude-opus-4-8`, effort treated as ≥high, not
credited as confirmed-max). Allowlist pre-flight GREEN (git/tsc/lint/vitest in caps; no MCP/WebFetch).
Env clean (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all unset).

## The two ②-blocking HIGHs — CLOSED + verified at source
- **F-1 (DC-16 "partial-fix-leaves-a-SIBLING", the 3rd V-N3 recurrence) — CLOSED, structurally airtight.**
  The unconditional `'audit_logs.details'` recorded claim is now backed across every keying path. The
  load-bearing census claim — *"`admin/chargeback-watch/unpause:145` is the ONLY writer that places the
  SUBJECT's PII into a foreign-keyed `audit_logs` row, always as the `developer`/`developer_signup`
  resource"* — was **independently re-derived four ways**: three reviewer censuses (33–35 sites) **plus
  the integrator's own** direct inspection of every cross-principal/admin/payout/consumer writer
  (`audit.ts` is the sole `db.insert(auditLogs)` sink; 33 `writeAuditLog` call-sites). Confirmed:
  `chargeback-watch/unpause:145` (`developerId=admin`, `resourceType='developer'`, `resourceId=subject`,
  `details.targetDeveloperEmail=subject email`) is reached by **step 5c**; `admin/reviews/[id]:114` is
  admin-keyed but `details={action,reason,previousStatus}` carries **no structured subject PII**;
  `admin/signup-followup:230` is subject-keyed (caught by step 5 AND 5c) with only the admin's collateral
  `actor_email` (acceptably over-scrubbed, DC-13 ruling). step 5c nulls ONLY `details` (the cross-principal
  row's ip/ua belong to the ACTING principal). **Integrator live reproduction:** removing step 5c → the two
  F-1 cross-principal tests go RED (`"a cross-principal audit scrub … must be issued: expected undefined to
  be defined"`); restore → byte-identical (`shasum` match), green.
- **F-2 (completeness miss) — CLOSED.** step 7b nulls `developerResponse`/`developerRespondedAt` keyed on
  `inArray(toolReviews.toolId, toolIds)` (columns exist: `schema.ts:550-551`), over-scrub-guarded
  (`rating`/`comment` are OTHER consumers' data, untouched), disclosed gated on `toolIds>0`. Distinct WHERE
  from step 7's consumer-`comment` scrub. Mutation-verified non-vacuous (revert → RED).

## Verified at source (load-bearing — ground-truthed, NOT inspected)
- **The moat invariant extends to F-1/F-2:** `completed` is written ONLY at the final step inside the txn;
  all new scrubs (2b, 5, 5b, 5c, 7b, 8) are INSIDE the same txn → atomic, and idempotent on a `failed`
  retry (null-set / DELETE / `.set()` re-runs are no-ops). `completed ⇒ (auth deleted ∧ DB anonymized ∧
  all scrubs applied/correctly-gated)` holds.
- **All 7 scrubs non-vacuous** — the literal-execution lens mutation-tested each (revert → RED, restore →
  green, baseline 114/114); the rig was upgraded with a `{vals,pred}` capture seam (the predicate the prior
  rig discarded — exactly what RECOVERY §1 F-1 point 4 demanded) so the 5/5b/5c predicates are pinned by
  shape, and a `deleteCalls`/`waitlistRowsRef` seam pins the waitlist DELETE target + the disclosure gate.
  The integrator independently reproduced the F-1 step-5c case live.
- **Disclosure honesty (DC-16/DC-11):** every new `anonymized`/`retainedUnscrubbed` entry is a column PATH
  string, never a row value; the org + consumer clauses fold into the SINGLE `retainedUnscrubbedNote` (the
  test slices that one note key); all 7 `BANNED_LEGAL_CONCLUSIONS` regexes clean over the note.
- **Reader null-safety** — readers of the nulled columns tolerate null/`{}` (`proxy/[slug]` guards
  `!proxyEndpoint`→404; `tools/[slug]/page.tsx:650` guards `developerRespondedAt`; `notifications.ts:148`
  `(dev.notificationWebhooks ?? {})`; audit `details` read with optional chaining / JSON-serialized).
- **Tool-infra safety** — no developer-owned `status='template'` write path exists (deleted tools are
  never a template-download target); `proxy/stats` only COUNTs the endpoint, never returns its value.

## Frozen-surface compliance
Diff = `compliance.ts` (the additive scrubs + docstring) + 3 test files only. Deletion status-machine
SHAPE (pending→processing→completed|failed), the idempotent-`completed` no-op, the `catch`→`failed`, the
SLICE-2 pre-txn auth-delete wiring, the consumer-twin lookup (step 2 `eq(consumers.email, dev.email)`),
and steps 1-9 beyond the additive scrubs — all UNCHANGED. `tools.name/slug` PRESERVED (over-scrub guard
test). The `ledger_entries` `retainedUnscrubbed` disclosure added-to, never reworded. No touch to
`organizations`/`organization_members`, the `data-retention` cron, or the legal-gated `ledger_entries`
payer scrub (V-N3-erasure). No deferred field was SCRUBBED — the consumer financial/referral + org email
are DISCLOSED-as-retained (a RECOVERY §2-sanctioned option, decision recorded).

## Open residuals (NON-BLOCKING → travel to ③ / the consumer-side normalization chunk)
- **MED → consumer-side normalization chunk (DC-16 disclosure-honesty travel; SHARPENED framing):** the
  consumer-twin lookup `eq(consumers.email, dev.email)` (the FROZEN/untouched step-2 surface) is byte-exact
  while `ask/capture:14-19` and `consumer/academic:70-75` store `email.toLowerCase().trim()` (and the
  diff's own step-2b waitlist DELETE normalizes) — a cross-path/mixed-case consumer twin is MISSED →
  `consumerRecord=null` → step 2 consumer-email anonymize, step 5b (consumer-twin audit scrub), step 7
  (consumer `comment` scrub) silently don't fire, and the consumer disclosures are honestly omitted.
  **Sharpened:** because the NEW unconditional `audit_logs.details` claim is partly backed by step 5b
  (gated on `consumerRecord`), a missed twin can falsify the **unconditional** `audit_logs.{ip_address,
  user_agent,details}` claims — elevating the prior "incompleteness travel" item to a **disclosure-honesty**
  one. RULING (NOT seal-blocking): (1) it sits entirely on a frozen surface RECOVERY §2 explicitly DEFERRED
  ("do NOT fix in this recovery unless the build's plan expands scope"); fixing it perturbs that surface and
  pulls in deferred consumer-side work. (2) The recovery did NOT introduce the fragility and IMPROVED it —
  step 5b now scrubs the twin's audit rows when found (never scrubbed pre-SLICE-3). (3) A missed twin leaks
  NO email via `details` (consumer-keyed `details` = IDs/amounts/key-prefixes — SEAM Finding 2, high conf),
  and the residual unconditional-claim edge is IDENTICAL-IN-KIND to the pre-existing `ip_address`/`user_agent`
  unconditional claims (predate this chunk). The coherent fix (a normalization-robust consumer-twin lookup)
  makes all three audit-column claims universally true together → routed to the consumer-side normalization
  chunk alongside the §7-H consumer financial-linkage family.
- **MED → ③ (accepted DC-05/DC-10 unit-mock limitation):** the drizzle/schema test doubles echo column-NAME
  strings (`eq=(a,b)=>({a,b})`, columns mapped to their own name), not generated SQL — so GREEN proves "the
  production code referenced the right schema FIELD" (genuinely distinguishes step 5 vs 5b vs 5c, mutation-
  verified), but NOT "the emitted Postgres SQL is correct." Mitigated for THIS diff by tsc 0 (the new column
  refs resolve against the real schema types) + the integrator's direct schema confirmation
  (`auditLogs.consumerId/resourceType/resourceId/details`, `toolReviews.toolId/developerResponse/
  developerRespondedAt` all exist). Inherent to the strategy, not introduced here.
- **LOW:** the step-5c comment says "38 writers" (actual ~33 call-sites; the substance *"the ONLY writer"*
  is TRUE — it is an internal CODE COMMENT, not the persisted `resultUrl`/public copy, so NOT a DC-16
  disclosure defect). NOT fixed under seal (cosmetic; touching it is needless churn). Optional comment-count
  tidy in ③.
- **LOW:** the test's `delete().where()` mock is a single dual-thenable object (`.returning()` + `then`),
  over-permissive vs real drizzle's two distinct thenables — latent, not exploited (production calls
  `.returning()`). One docstring wrapped-line length is cosmetic (lint green).

## Travel watch-items carried forward (rule each in its destination chunk)
- The consumer-side family (the MED above + the §7-H consumer financial-linkage). The diff DISCLOSES the
  consumer `stripe_customer_id`/`default_payment_method_id`/`referral_code` as retained (does not scrub).
- N4 — `cron/data-retention` hard-deletes `compliance_exports` rows 30d after `completedAt`, so the
  `resultUrl` disclosure artifact (the erasure proof this chunk invests in) is itself purged at 30d.
- Pre-existing: `processDataDeletion` has NO prod HTTP route caller (dormant); a future deletion route must
  derive entityId from `requireDeveloper→auth.id` (never client-supplied), branch on entityType, rate-limit.
- Pre-existing `completed` data-deletion rows are NOT re-scrubbed by the idempotent no-op (strong prior zero).

## Defect-class ledger
**DC-16** — the F-1 chargeback cross-principal false-claim (the 3rd V-N3 "partial-fix-leaves-a-sibling"
recurrence) → **CLOSED** (census-backed 5/5b/5c, predicate-pinned, integrator-reproduced live); F-2 the
subject-authored review-response completeness miss → **CLOSED** (scrubbed + disclosed). New sibling recorded:
the consumer-twin normalization-miss → a DC-16 disclosure-honesty TRAVEL item on a frozen surface (above).
Touchpoints: **DC-13** (the step-5c whole-`details` over-scrub of admin collateral — ruled ACCEPTED for GDPR
erasure; over-scrub guards on 5c/7b/8 are non-vacuous); **DC-17** (every new scrub idempotent on a `failed`
retry); **DC-05** (all 30 new tests non-vacuous, mutation-verified + integrator-reproduced); **DC-11**
(`resultUrl` paths-only, no row value); **DC-15** (docstring/disclosure kept in sync). **Process lesson
(reinforced):** the DC-16 partial-fix class on a multi-principal PII primitive is NOT diff-visible — closing
it required a census of ALL writers per keying path, asserted by tests that pin the scrub PREDICATE (not just
the disclosed path string). The recovery did exactly this; the predicate-capture seam is the durable guard.

## Next
HIGH-STAKES → **③ post-seal deep audit** (`v-n3-compliance-honesty-slice3-post-seal-deep-audit-handoff-2026-06-17.md`):
integrated-whole audit (the diff-scoped ② cannot see adjacent untouched surfaces — the SLICE-1/2 ③ census-miss
class), with a dedicated `/effort max` DC-16 claim-honesty + the consumer-twin disclosure-honesty lens, and a
collective-miss critic. Founder-close is a LOCAL commit (path-scoped, NEVER push); `/push-go` is a separate
explicit gate.
