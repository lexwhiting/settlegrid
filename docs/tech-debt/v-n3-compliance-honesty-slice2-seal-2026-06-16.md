# V-N3 (compliance-honesty SLICE 2) — actually delete the Supabase auth user + reword overstatements → SEALED (2026-06-16)

> ② seal-gating review PASSED; operator `/seal-go` confirmed → cadence phase `sealed`. LOCAL only,
> **NOT pushed** (push is a separate `/push-go` gate). Base = `main` @ `9fa0bdbb` (SLICE 1 sealed + ③
> RE-CERTIFIED). Closes the LIVE DC-16 false claim that the public docs FAQ (`docs/page.tsx:635`)
> asserts "your … Supabase auth records are deleted" while `processDataDeletion` only NULLed
> `developers.supabaseUserId` and never deleted the `auth.users` row (email/login identity survived).
> This was the HIGH finding the SLICE-1 ③ deep audit routed OUT; SLICE 2 closes it **behaviorally**
> (the founder chose fix-behavior over document-the-gap) and softens two adjacent overstatements. The
> on-chain **payer-address** erasure remains the legal-gated **V-N3-erasure** chunk (counsel pending).

## Verdict
**SEALED** — gate green, zero high-severity findings open, reviewers' evidence supports it.

## What shipped (one line)
A new server-only Supabase ADMIN client (`apps/web/src/lib/supabase/admin.ts`, exporting only
`deleteSupabaseAuthUser` — fail-closed on missing service-role key, idempotent on a 404 not-found,
HARD delete with no soft-delete arg, no-secret static throw) is wired into `processDataDeletion`
**BEFORE** the atomic DB transaction, so a deletion reaching `completed` now implies the Supabase auth
user was hard-deleted **AND** the DB was anonymized; the previously-FALSE `docs:635` "auth records are
deleted" is now TRUE, and three adjacent overstatements were softened to honesty (`docs:615`
"wherever it appears" dropped; `email.ts` "permanently deleted" → "deleted … login permanently
removed"; `settings:2117` "all associated data" → "your account and personal data. Financial records
… retained but anonymized."), all pinned by 17 new non-vacuous tests.

## Gate (re-verified clean isolated, this session)
apps/web `tsc` 0 · `lint` 0 err (pre-existing warns only, none in touched files) · **`vitest` 4523 /
197 / 0, exit 0** (baseline @ `9fa0bdbb` 4506/195 → delta = exactly **+17** new tests across +2 files:
`supabase-admin.test.ts` +5, `compliance-deletion-auth.test.ts` +5, `compliance-honesty-regression`
+7; nothing else moved). packages/mcp UNTOUCHED (apps/web-only diff; `git status` confirms).

## Review shape
5 fresh-context, lens-distinct Opus-4.8 reviewers on the real diff (correctness/determinism ·
spec-conformance · **DC-16 core-invariant: data-integrity & claim-honesty** · SEAM · literal-execution
/test-vacuity) + integrator live reproduction. **0 high · 0 sustained medium; all findings LOW.**

**Effort/orchestration note (policy):** PATH 1 (effort-bearing named subagents) unavailable — no
`.claude/agents/` pool carries `effort: max/xhigh` frontmatter, and a running agent cannot stand one
up mid-run. Operator chose "xhigh, one switch" and ran `/effort xhigh` before the spawn; the 5
reviewers nonetheless **self-reported `effort=high`**. Subagent effort introspection is unreliable (no
labeled signal; 5/5 defaulting to the documented Opus-4.8 "high"), so per the report-back guard they
are **NOT credited as confirmed-xhigh** — recorded as ran-at-≥high (the decisive-role floor;
policy-acceptable). The integrator compensated by **personally re-driving the core-invariant lens +
the live LB-1 reproduction in the confirmed-xhigh main session.** Allowlist pre-flight GREEN (gate/repro
caps present); reviewers read-only except the literal-execution lens's revert-confirmed RED/GREEN
experiments. The preferred per-agent `max` DC-16 lens is routed to ③.

## Verified at source (load-bearing — ground-truthed, NOT inspected)
- **The moat invariant holds on every path:** `completed` is written ONLY inside the txn; the
  auth-delete loop runs BEFORE the txn; any throw (missing key / non-404 admin error / malformed-UUID
  / txn failure) lands in the function `catch` → `status='failed'` (retryable), never `completed` with
  the auth user alive. **Reproduced LIVE by the integrator:** swallowing the auth-delete error (the
  LB-1(c) forbidden mode) makes the run reach `completed` → the fail-closed test goes RED (`expected
  'completed' to be 'failed'`); reverting → GREEN. The guard is genuinely non-vacuous.
- **Idempotency keyed on `error.status === 404`** (numeric, top-level) — verified against the
  INSTALLED `@supabase/auth-js@2.99.2`: `deleteUser` RETURNS `{ data, error }` for an AuthError (incl.
  404, does not throw), and calls `validateUUID(id)` FIRST which THROWS a plain Error on a non-UUID
  (propagates → `failed`; safe direction).
- **HARD delete** — `deleteUser(userId)` single arg, no `shouldSoftDelete` (a soft delete would retain
  the row and re-introduce the false claim); test pins `mock.calls[0]` arity === 1.
- **FAIL-CLOSED + no-secret leak** — `getAdminClient` reads the key lazily per-call and throws the
  STATIC `'SUPABASE_SERVICE_ROLE_KEY is not set'` (no key/`process.env` interpolation; the deletion
  catch logs to stdout+Sentry). The admin-client constructor is module-PRIVATE; only
  `deleteSupabaseAuthUser` is exported (no god-mode client handed to callers — DC-11).
- **Pre-txn capture is necessary** — txn step 1 NULLs `developers.supabaseUserId` and step 2 NULLs the
  consumer's, so both ids are captured before the txn; `dev.email` is still RAW at the consumer lookup
  (read before step 1 anonymizes it); `consumers.email` is unique → at most one twin row; the dev+twin
  ids are de-duped via `Set` → one `deleteUser` for the shared `auth.users.id`.
- **Server-only discipline** — no `server-only` import (matches the `rails.ts` precedent: it breaks
  vitest); banner + lazy fail-fast; swept every `'use client'` chain — none reaches `admin.ts`.
- **Claim honesty across all surfaces** — every reworded claim is TRUE vs realized behavior and
  non-absolute; cross-checked against the `retained`/`retainedUnscrubbed` sets in the `resultUrl`.
- **Disclosure sync** — the `resultUrl.anonymized` array records `'supabase_auth_user'` gated on an id
  actually being present; the docstring retry-safety proof retargeted to the `'failed': RETRYABLE`
  block with the `H1, 2026-06-05` literal preserved.

## §G census disposition record (each live deletion-claim surface ruled on — recorded so it does not repeat the SLICE-1 ③ "silent omission")
| Surface | Disposition |
|---|---|
| `docs/page.tsx:635` "Supabase auth records are deleted" | now **TRUE** via the hard-delete — left/verified |
| `docs/page.tsx:615` "wherever it appears" | **softened** → "across your developer profile and the records that reference you" (non-absolute; pinned substrings `referencing only your anonymized account` + `retained for 7 years` intact) |
| `email.ts:733`+`:738` "permanently deleted" | **softened** to honest copy ("login permanently removed") |
| `email.ts:734` retention banner "permanently removed" | **LEFT** (true re: 30-day retention) |
| `settings/page.tsx:2117` "all associated data" | **softened** (+ a retention-disclosure sentence — see residual spec-3) |
| `app/privacy/page.tsx:138-164` | **reviewed, LEFT AS-IS** (generic + true; zero diff confirmed) |

## Frozen-surface compliance
Diff = `admin.ts` (new) + `compliance.ts` (capture `supabaseUserId`, pre-txn consumer read, pre-txn
auth-delete loop, gated `anonymized` entry, docstring) + 3 copy surfaces + 5 test files. Deletion
status-machine SHAPE (pending→processing→completed|failed) and the idempotent-completed no-op
UNCHANGED; txn steps 1-9 unchanged beyond the capture; **no** touch to `organizations`/
`organization_members` (N3), the `data-retention` cron (N4), the `anonymized`→`pseudonymized` rename
(N5), or the `ledger_entries` payer scrub (V-N3-erasure). No legal-gated work pulled in.

## Open residuals (NON-BLOCKING → ③; build correct + verified)
- **LOW (spec-3 / DC-15):** `settings:2117` added a sentence beyond the minimal §7-G softening —
  "Financial records required for tax compliance are retained but anonymized." TRUTHFUL and consistent
  with `docs:635/615`, arguably more honest, but a NEW live DC-16 claim surface. Surfaced for founder:
  keep vs. revert to the minimal softening. Not false, not a blocker.
- **LOW (corr-1 / DC-13 latent):** a throw between the txn commit and the `return` would clobber a
  committed `completed`→`failed` (and the retry's manifest would omit `supabase_auth_user`).
  UNREACHABLE today (only `logger.info` runs there; its `meta` is all primitives → can't throw).
  Fixing would touch the frozen status-machine catch — record as future-hardening, do not fix here.
- **LOW (corr-4 / seam-4 forward):** idempotency relies on the deployed GoTrue emitting HTTP 404 for an
  already-gone user; the `validateUUID`-throws path is verified vs SDK source but not unit-exercised.
  Optional: confirm vs deployed GoTrue + add an unmocked non-UUID test.
- **LOW (moat-1 / DC-16):** `docs:615` "the records that reference you" could be soft-over-read vs the
  routed-out `organizations.billing_email` (N3). Defensible (absolute removed, financial retention
  carved out, scope enumerated). Optional counsel tightening.
- **LOW (moat-2 / moat-3 forward):** `processDataDeletion` does not branch on `entityType` (a
  consumer-only deletion would throw "Developer not found" → never completes, safe direction); a
  non-UUID stored `supabaseUserId` makes an account un-deletable (liveness, safe direction). Both fold
  into precondition #3 (future deletion-route).
- **LOW (lit-6 / DC-05):** the docstring retry-safety regression test matches its tokens against the
  whole docstring region, not the `'failed'` bullet specifically — non-vacuous today, but would not
  catch a drift that moved the idempotency reasoning to another bullet. Optional test tightening.

## ⚠ Three operator/infra preconditions (forward — none block this build; the code is correct and dormant)
1. **`SUPABASE_SERVICE_ROLE_KEY` prod provisioning** — code fail-closes when absent; the feature is
   INERT in any env lacking it. Provision in Vercel before a deletion route is wired. (Secret not
   read/printed.)
2. **Zero pre-existing `status='completed' ∧ request_type='data-deletion'` rows** — UNVERIFIED (no DB
   access). Strong prior it's zero (`processDataDeletion` has no HTTP route caller → effectively never
   run in prod). If any exist, the completed no-op won't retro-cover them → one-off
   `deleteSupabaseAuthUser` backfill. Operator must confirm before shipping.
3. **Future deletion-route authz** — any route activating this now-irreversible `auth.admin.deleteUser`
   MUST derive the subject from `requireDeveloper(request)→auth.id`, never trust a client-supplied id,
   branch on `entityType` (moat-2), and rate-limit. No auto-retry driver for `failed` deletions vs the
   GDPR clock — acceptable while dormant.

## Defect-class ledger
**DC-16** — the LIVE false `docs:635` auth-deletion claim (the SLICE-1 ③ HIGH routed-out finding) →
**CLOSED behaviorally** (the auth user is now hard-deleted); the SLICE-1 ③ MED routed-out findings (the
email "permanently deleted" overstatement + the `docs:615` "wherever it appears" completeness
over-claim) → **CLOSED by reword** (recorded). Touchpoints: **DC-08** (the FAIL-CLOSED-on-missing-key
fail-mode chosen correctly, not a silent no-op — verified live); **DC-17** (the pre-txn auth-delete is
idempotent on a 404, so `failed` is retry-safe and `completed` is never re-run unsafely — verified);
**DC-11** (the service-role admin sink is narrowly scoped — only `deleteSupabaseAuthUser` exported,
constructor module-private); **DC-05** (all 17 new tests non-vacuous, integrator-reproduced live);
**DC-15** (docstring/disclosure kept in sync with the new behavior; the spec-3 settings expansion is
the only mild plan-drift, non-false).

## Next
HIGH-STAKES → ③ post-seal deep audit
(`v-n3-compliance-honesty-slice2-post-seal-deep-audit-handoff-2026-06-16.md`); run the DC-16
core-invariant / claim-honesty lens at `/effort max` (the one tier ② could not realize — Path-2
operator switch or Path-3 process), and verify the integrated whole: does the now-irreversible
auth-delete have any reachable caller, and do the reworded claims hold against the full schema
(esp. moat-1's `organizations.billing_email`). Founder-close is a LOCAL commit (path-scoped, NEVER
push); `/push-go` is a separate explicit gate.
