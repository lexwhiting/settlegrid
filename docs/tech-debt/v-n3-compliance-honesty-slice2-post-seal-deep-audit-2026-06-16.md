# V-N3 (compliance-honesty SLICE 2) — ③ POST-SEAL DEEP AUDIT → RE-CERTIFIED (hardened) (2026-06-16)

> ② SEALED → operator `/seal-go` → ③ post-seal deep audit (HIGH-STAKES, re-confirmed). Scope = the
> INTEGRATED WHOLE on the working tree atop `main@9fa0bdbb` (V-N3 SLICE 2, uncommitted). LOCAL only,
> NOT pushed (`/push-go` is a separate gate). Input handoff:
> `v-n3-compliance-honesty-slice2-post-seal-deep-audit-handoff-2026-06-16.md`. ② record:
> `v-n3-compliance-honesty-slice2-seal-2026-06-16.md`. Ledger: `.audit/defect-ledger/DC-16-…md`.

## Verdict
**RE-CERTIFIED (hardened).** The shipped behavioral slice is correct and to-spec; **0 sustained HIGH
defects in the shipped code.** The integrated-whole re-census caught a DC-16 *partial-fix-leaves-a-sibling*
recurrence (two absolute sibling FAQ claims the diff-scoped seal could not see); **fixed under seal,
copy-only**, with live RED→GREEN non-vacuity proof. The behavioral deletion-completeness scrub is BUILD
work, correctly routed OUT (N3 / deletion-completeness follow-up). Gate green: **tsc 0 · lint 0 err ·
vitest 4525/197/0**.

## Method (policy)
- **Effort:** xhigh baseline fan-out. PATH 1 (effort-bearing named subagents) UNAVAILABLE (no
  `.claude/agents/` pool; a running agent cannot stand one up mid-run). Reviewers were Agent-tool spawns
  inheriting the session (operator-affirmed xhigh); all 6 **self-reported effort=high** → credited
  **ran-at-≥high** per the report-back guard (subagent effort introspection is unreliable — same as ②).
  The operator elected a Path-2 `/effort max` collective-miss critic; per the phase rule that the max
  bump "is never a required pause and must not stall the run," the collective-miss critic ran at the
  session floor (no-stall path) and the `/effort max` re-run was offered NON-BLOCKING. **Allowlist
  pre-flight GREEN** (gate/repro Bash present; env clean: no `CLAUDE_CODE_EFFORT_LEVEL` /
  `_SUBAGENT_MODEL` / `_FORK_SUBAGENT`).
- **Orchestration:** Agent-tool spawns (operator choice; clean env + GREEN allowlist make a workflow's
  loud-pause edge moot). Model pinned `claude-opus-4-8` per spawn; all reviewers confirmed
  `model=claude-opus-4-8[1m]`.
- **6 lens-distinct reviewers** (coverage mode): correctness/determinism · SEAM · literal-execution &
  test-vacuity · DC-16 claim-honesty integrated-whole census · defect-class recurrence (DC-01…20) ·
  cross-chunk integration & security/PII reachability. **+ a collective-miss critic** (collective-miss
  sweep + adversarial check on the integrator's verdict + the definitive moat-1 ruling).
- **Mechanical pre-flight (integrator, scripted, handed to reviewers):** full gate clean; moat invariant
  re-derived; hostile-input reasoning over `deleteSupabaseAuthUser`/`processDataDeletion`; seam-3
  (no HTTP caller) and corr-1 (unreachable) re-confirmed; moat-1 schema facts ground-truthed at source.

## What was VERIFIED (load-bearing — ground-truthed, not inspected)
- **Moat invariant holds:** `'completed'` is written ONLY inside the txn (step 9), AFTER the pre-txn
  auth-delete loop; every throw (missing key / non-404 / non-UUID / txn failure) → function `catch` →
  `'failed'`. Reproduced live at ②; re-derived here.
- **`deleteSupabaseAuthUser` contract** matches the INSTALLED `@supabase/auth-js@2.99.2`
  (`GoTrueAdminApi.deleteUser`): returns `{data,error}` for an `AuthError` (numeric top-level `status`),
  `validateUUID` throws before the network call, single-arg ⇒ HARD delete. Fail-closed static no-secret
  throw on a missing key; module-private constructor; only `deleteSupabaseAuthUser` exported (DC-11).
- **Service-role sink is provably server-only** — traced every importer of `admin.ts`→`compliance.ts`;
  no `'use client'` / page-bundle chain; key has no `NEXT_PUBLIC_` prefix; no dynamic import.
- **The irreversible `auth.admin.deleteUser` is dormant** — NO prod caller of `processDataDeletion`
  (crons, webhooks, server actions, middleware, scripts all searched); only tests + `settlement/index.ts`
  re-export.
- **Tests non-vacuous** — `supabase-admin.test.ts` + `compliance-deletion-auth.test.ts` revert→RED
  confirmed; `region()` slicer THROWS on a missing marker (no silent-empty vacuity); the
  `settlement-moat.test.ts` mock additions do not vacuum-out the moat invariant (auth-path non-vacuity
  correctly delegated to `compliance-deletion-auth.test.ts`).
- **moat-1 schema facts** (the deletion-completeness gap, ground-truthed): `organizations.billing_email`
  (raw user-supplied email, NOT NULL) untouched; `developers.notification_webhooks` untouched (step 1
  resets only `notificationPreferences`); `tools.name`/`tools.slug` (notNull) survive on `'deleted'`
  rows (step 8 nulls only `description`/`healthEndpoint`); `waitlist_signups.email` untouched.

## Hardening folded under THIS seal (fix-first, COPY/COMMENT-ONLY, gate re-run, non-vacuity reproduced live)
1. **DC-16 sibling-absolute softening (the one substantive finding).** SLICE 2 precised `docs:615` but
   left two ABSOLUTE sibling claims in the same FAQ list — the textbook DC-16 "partial fix leaves a
   sibling," sharpened by the `docs:615` edit:
   - `docs/page.tsx:635` "all personally identifiable information (name, email, bio, avatar) is
     immediately anonymized" → **"the personal data that identifies you (name, email, bio, avatar) is
     immediately anonymized"** (matches `docs:615`'s framing).
   - `docs/page.tsx:639` "your PII will no longer exist in any backup" → **"the profile data anonymized
     on deletion (name, email, bio, avatar) is no longer present in any backup"** (scoped to the fields
     the deletion actually anonymizes; does not claim the surviving PII rotates out).
   - Pinned by 2 new non-vacuous assertions in `compliance-honesty-regression.test.ts` (new `backupsFaq`
     region + `.not.toMatch` the old absolute & `.toMatch` the scoped framing). **Proven live: RED
     against the shipped copy → GREEN after the reword.**
2. **Comment-precision** on the `resultUrl 'supabase_auth_user'` gate in `compliance.ts` — now states it
   records the END STATE "no live auth user for this identity" (gated on a linked auth-user *id*), not
   which run performed the delete (the already-404-gone idempotent path). Comment-only.

## RULED (claim-honesty)
- **`docs:615` — KEEP (honest-to-ship).** "anonymize the personal data that identifies you across your
  developer profile and the records that reference you … your Supabase auth login is deleted" is
  NON-absolute (the over-claiming "wherever it appears" was dropped), the enumerated specifics are all
  TRUE, and "the records that reference you" describes propagation without promising exhaustiveness. The
  collective-miss critic concurred (the over-read lives at `:635`/`:639`, now fixed, not at `:615`).
- **email + `settings:2117` — clean** (all reviewers): honest, scoped, consistent with realized behavior.

## ROUTED OUT (NOT this seal — BUILD / legal-gated, per the ① handoff scope)
- **Deletion-COMPLETENESS behavioral scrub** of `organizations.billing_email` (N3) ·
  `developers.notification_webhooks` · `tools.name`/`slug` · `waitlist_signups.email` → the
  deletion-completeness follow-up. (Copy is now honest about scope; the behavioral gap is the live
  watch-item.)
- **`resultUrl.retainedUnscrubbed` column enumeration** of the surviving developer-PII — defer with the
  scrub (piecemeal expansion now would create new cross-surface drift).
- **No self-serve deletion trigger** — the settings "Delete Account" button shows a "contact support"
  toast; no route fires `processDataDeletion`/`accountDeletedEmail`. Pre-existing product gap; the public
  copy describes the support-processed flow.
- **N4** (cron 30d vs "90 days") · **N5** (anonymized vs pseudonymized) · **V-N3-erasure** (on-chain
  payer address) — unchanged routing.

## FORWARD / latent (recorded, none blocking)
- **Precondition #3 (future deletion route) UNDER-SPECIFIED** (enriched): a landing route MUST derive the
  subject from `requireDeveloper(request)→auth.id` (NEVER a client-supplied id), branch on `entityType`
  (consumer vs provider — `processDataDeletion` today always treats `entityId` as a `developers.id`),
  rate-limit, and forbid batch — else the now-irreversible delete becomes an IDOR / mass-delete primitive.
- **Non-UUID stored `supabaseUserId`** → `validateUUID` throws → never converges, but FAIL-CLOSED (= the
  known residual **moat-3**, safe direction). A "skip-malformed" fix would be **REGRESSIVE** (could let
  `completed` happen with a live auth user) — do NOT apply.
- **TOCTOU** on the FROZEN `processing` guard (concurrent runs; the catch's unconditional `failed` write
  could clobber a `completed`) — pre-existing frozen status-machine, no live trigger; folds with corr-1.
- Settlement barrel re-export client-leak hazard; deletion does not cancel the Stripe-side
  subscription/Connect account; `organization_members` (developer.id, non-PII) + prior `compliance_exports`
  export-row PII (≤30d) survive — all → V-N3-erasure / follow-ups.

## Defect-class ledger
**DC-16** updated (the ③ SLICE-2 entry: the sibling-absolute recurrence fixed under seal; surfaces CLOSED;
behavioral completeness gap is the follow-up watch-item). **No NEW defect class.** Standing **SEAM** and
**LITERAL-EXECUTION** classes recurred only as clean / nits (SDK contract verified; `region()` fails loud;
comment precision folded). DC-05/08/11/13/15/17/20 re-checked CLEAN on the integrated whole.

## Gate (re-verified clean, this phase — hardened tree)
`tsc 0 · lint 0 err (pre-existing warns only) · vitest 4525 / 197 / 0` (baseline 4523/197 + **2** new
sibling-absolute pins). The fold did not disturb any region-slice marker or pinned substring.

## Next
**Founder-close = LOCAL commit (path-scoped, NEVER push).** `/push-go` is a separate explicit gate. The
deletion-completeness behavioral scrub + the no-self-serve-trigger product gap open as the follow-up.
