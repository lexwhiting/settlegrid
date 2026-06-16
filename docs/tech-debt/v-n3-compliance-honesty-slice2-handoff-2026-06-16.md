# V-N3 compliance-honesty SLICE 2 — delete the Supabase auth user on deletion + reword overstatements — ① BUILDABLE HANDOFF (2026-06-16)

> Standalone handoff for the FRESH build session. READ THIS FIRST, before any code. Repo:
> `/Users/lex/settlegrid` (npm monorepo: `apps/web` + `packages/mcp`; use **npm**). Build base =
> `main` @ `9fa0bdbb` (SLICE 1 sealed + ③ RE-CERTIFIED + pushed). Source-of-truth register:
> `docs/tech-debt/s-deep-audit-register-2026-06-10.md` (V-N3 entry). This chunk closes findings the
> SLICE-1 ③ post-seal deep audit surfaced and routed out — see
> `docs/tech-debt/v-n3-compliance-honesty-post-seal-deep-audit-2026-06-16.md` (findings **N1**, N2)
> and the DC-16 ledger `.audit/defect-ledger/DC-16-public-claim-content-integrity.md` (③ entry).
> **This handoff folds the ① pre-build plan-audit findings — build from it as written.**

---

## 0. Decision, tier, intent

- **Chunk:** Make the public GDPR-deletion claim **"your … Supabase auth records are deleted"
  (`docs/page.tsx:635`) TRUE by actually deleting the Supabase auth user** during account deletion
  (today the deletion only sets `developers.supabaseUserId = null` — the Supabase `auth.users` record,
  which holds the email, is **never deleted**; there is no `auth.admin.deleteUser` anywhere
  tree-wide). Then **soften two remaining cosmetic overstatements** to honesty.
- **Tier: HIGH-STAKES.** Triggers: changes the **account-deletion behavior** (a PII/erasure/security
  boundary), introduces a **new external-service side effect** (Supabase admin API) into the deletion
  flow, and corrects **published compliance claims**. Low-to-moderate code complexity; the
  GDPR/trust + external-API failure-mode surface make it HIGH-STAKES.
- **Intent (WHY / who consumes / what it enables):** A developer exercising GDPR erasure is TOLD (public
  docs FAQ `:635`) their "Supabase auth records are deleted." Today that is FALSE — their Supabase auth
  identity (email) survives, so a re-login or an auth-side data request would still surface them. This
  chunk makes the deletion actually remove the auth user, closing a LIVE DC-16 false public claim
  **behaviorally** (the founder chose fix-behavior over document-the-gap), and tightens two adjacent
  overstatements so every deletion claim is truthful. It is the auth-identity half of "right to
  erasure"; the on-chain **payer-address** erasure remains the legal-gated **V-N3-erasure** chunk.

## 1. Scope — exactly what to build (and what NOT to)

**BUILD:**

1. **New server-only Supabase ADMIN client** — `apps/web/src/lib/supabase/admin.ts` (does NOT exist
   today; `client.ts` + `server.ts` are anon-key only). Use `createClient` from
   **`@supabase/supabase-js`** (installed, `^2.99.2`) with `getSupabaseUrl()` +
   `getSupabaseServiceRoleKey()` and `{ auth: { autoRefreshToken: false, persistSession: false } }`.
   Export one narrow function:
   ```ts
   /** Delete a Supabase auth user. Idempotent: a not-found user is treated as already-deleted
    *  (success). Throws if the service-role key is unset (FAIL-CLOSED — never silently no-op) or on
    *  any other admin error. */
   export async function deleteSupabaseAuthUser(userId: string): Promise<void>
   ```
   - The service-role key (`getSupabaseServiceRoleKey()` → `process.env.SUPABASE_SERVICE_ROLE_KEY`) is
     typed `string | undefined` and is currently UNUSED tree-wide. **FAIL-CLOSED:** if it is undefined,
     `deleteSupabaseAuthUser` MUST throw (so the deletion goes `failed`/retryable) — it must NEVER let
     `processDataDeletion` reach `completed` with the auth user still alive (that would silently
     re-introduce the exact false claim). **The client must be lazily constructed inside the function
     (or behind a getter), NOT at module top-level**, so importing the module never throws at load and
     so the missing-key path is reachable per-call. ⚠ **OPERATOR/INFRA PRECONDITION (see §6):** confirm
     `SUPABASE_SERVICE_ROLE_KEY` is provisioned in the production (Vercel) environment, or provision it
     — otherwise prod deletions fail-closed.
   - `auth.admin.deleteUser(userId)` returns `{ data, error }`. Treat an error whose status is 404 /
     message indicates "user not found" as **idempotent success**; re-throw every other error.

2. **`processDataDeletion` (`apps/web/src/lib/settlement/compliance.ts:381-591`)** — wire the
   auth-user deletion in **BEFORE** the atomic DB transaction (the LOAD-BEARING ordering, §2):
   - In the initial developer lookup (`:422-426`), ALSO select `supabaseUserId`. The deletion txn step 1
     (`:450`) NULLs it, so it MUST be captured before the txn.
   - Capture the consumer-twin's `supabaseUserId` too (read the consumer by `dev.email` BEFORE the txn —
     the current consumer lookup is INSIDE the txn at `:471-475`; either hoist a read before the txn or
     add a pre-txn read). Collect the **distinct, non-null** set of `{dev.supabaseUserId,
     consumer.supabaseUserId}`. (Normally identical — both rows store the same `auth.users.id`; capture
     both defensively in case a dev/consumer twin linked different auth users.)
   - **Before `db.transaction(...)`** (still inside the existing `try`): for each captured id,
     `await deleteSupabaseAuthUser(id)`. A null/absent id (e.g. an API-key-only developer who never
     linked Supabase auth) is simply skipped — nothing to delete.
   - The existing txn (steps 1-9, sets `completed` inside it) is UNCHANGED in structure. A throw from
     the auth-delete OR the txn lands in the existing `catch` → `status='failed'` (retryable). On retry,
     the auth-delete is idempotent (already-gone → success) and the txn re-runs on pristine data.
   - **Record it in the disclosure:** add `'supabase_auth_user'` (or `'auth.users'`) to the resultUrl
     `anonymized` array (`:543-553`) — gated on whether any id was actually present/deleted — and update
     the docstring (`:354-357`) so the human + machine records state the auth user is deleted (not just
     `supabaseUserId` nulled). Keep the existing `retainedUnscrubbed`/`retainedUnscrubbedNote` UNCHANGED
     (the payer-address gap is unaffected).

3. **Cosmetic rewording (claim honesty):**
   - **`docs/page.tsx:635`** — now that the auth user IS deleted, "Your API keys, webhook endpoints,
     and Supabase auth records are deleted" is TRUE. **Verify the wording matches the realized behavior;
     change only if needed** for precision (e.g. it remains accurate as-is). Do NOT alter the "90 days"
     clause (the 30-day cron purge is N4, routed OUT).
   - **`docs/page.tsx:615`** (the SLICE-1 FAQ) — soften "anonymize the personal data that identifies you
     **wherever it appears**": "wherever it appears" over-claims completeness (the on-chain payer address
     and `organizations.billing_email` are retained). Scope it (e.g. "across your developer profile and
     the records that identify you" / drop the absolute "wherever it appears"). ⚠ PUBLIC copy — factual,
     no new legal claim.
   - **`accountDeletedEmail` (`apps/web/src/lib/email.ts:717-740`)** — "Your SettleGrid account …
     has been **permanently deleted**" (body `:733` + preheader `:738`). The account ROW persists
     (anonymized, UUID + deterministic `deleted-<id>@` preserved for FK integrity), so "permanently
     deleted" is slightly strong. Soften to a defensible truth, e.g. "has been deleted — your personal
     data has been anonymized and your login permanently removed." Keep it warm/short; this is
     transactional email copy.

4. **Tests** — see §5 (a BEHAVIORAL test for the auth-delete + a source-text honesty pin; the SLICE-1
   regression test must stay GREEN or be updated in lock-step).

**Re-run a census** before declaring done: `git grep -niE 'supabase auth|auth record|permanently delet|wherever it appears|account.*delet' -- 'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx'` and consciously
decide each hit is consistent with the realized behavior.

**DO NOT build (reject scope creep — routed to follow-ups):**
- **N3 — `organizations.billing_email` / org-member data scrubbing on developer deletion.** A separate
  data-subject question (an org is arguably a distinct entity; other members may remain). → deletion-
  completeness follow-up. Do NOT touch `organizations`/`organization_members` here.
- **N4 — the `data-retention` cron purging completed data-DELETION records at 30 days** (no
  `requestType` filter, `api/cron/data-retention/route.ts:247-262`) vs the "90 days" claim. → backlog
  (scope that purge to `request_type='data-export'`). Do NOT touch the cron here.
- **N5 — "anonymized" vs "pseudonymized" framing** (preserved UUID + deterministic email). Legal/counsel
  terminology call. Do NOT re-word "anonymized" across surfaces.
- **The payer-address erasure / `ledger_entries` `operation_id`+`metadata.payer` scrub** — legal-gated
  **V-N3-erasure**. Leave the SLICE-1 `retainedUnscrubbed` disclosure exactly as-is.
- Do NOT change the deletion status-machine SHAPE (pending→processing→completed|failed), the idempotent
  completed no-op, or any of steps 1-9 beyond capturing `supabaseUserId` and adding the auth-delete call.

## 2. ⚠ THE LOAD-BEARING DECISIONS (where audit judgment concentrates — most likely to be silently wrong)

**LB-1 — the non-transactional auth-delete ordering + idempotency + failure semantics.** The DB
anonymization is ONE atomic `db.transaction` whose retry-safety proof is "all writes commit atomically,
`completed` is set INSIDE the txn, so `failed` ⇒ the txn never committed ⇒ retry sees pristine data"
(docstring `:371-379`). The Supabase auth-delete is an **external network call that CANNOT be inside
the DB transaction.** It MUST go **before** the txn so that the only `completed` write happens AFTER a
successful (or idempotent-already-done) auth-delete — i.e. **`completed` ⇒ auth user deleted AND DB
anonymized.** Three ways this is silently wrong:
- (a) **auth-delete AFTER `completed`** → a deleteUser failure leaves `status='completed'` with the auth
  user alive; the completed-no-op (`:398-402`) means it NEVER retries → the false claim is back, now with
  a "completed" record asserting it. FORBIDDEN.
- (b) **not idempotent on retry** → a `failed` retry re-calls deleteUser on an already-deleted user; if a
  404/not-found is treated as an error, the deletion can never reach `completed`. Must treat not-found as
  success.
- (c) **swallowing the auth-delete error** (catch-and-continue) → `completed` with auth alive. The error
  MUST propagate to the function's `catch` → `failed`.
- Accept the transient window: auth deleted, DB pristine, `status='failed'` (the txn failed after the
  auth-delete). This resolves on retry and is the safer direction (erasure removed auth eagerly). State
  it; do not try to make the two atomic (you can't).

**LB-2 — service-role key provisioning + fail-closed-when-absent.** `getSupabaseServiceRoleKey()` is
`string | undefined` and currently UNUSED. If absent at runtime, the admin client cannot authenticate.
Decision (FAIL-CLOSED): `deleteSupabaseAuthUser` throws when the key is undefined → deletion goes
`failed` (retryable once provisioned) — it must NEVER silently complete with the auth user alive. The
client must be constructed lazily (per-call / behind a getter), never at module top-level (so a missing
key doesn't crash unrelated imports and the per-call fail-closed path is reachable). **PRECONDITION:**
`SUPABASE_SERVICE_ROLE_KEY` must be provisioned in prod (operator/infra, §6).

## 3. Frozen / existing surfaces + mechanical facts (pre-flight — already run; do NOT re-derive, but DO re-run the §1 census)

- **Supabase clients today:** `apps/web/src/lib/supabase/client.ts` (browser, anon) + `server.ts`
  (SSR cookie, anon). **No admin/service-role client exists.** `@supabase/supabase-js@^2.99.2` and
  `@supabase/ssr@^0.9.0` installed. `getSupabaseServiceRoleKey()` at `env.ts:87-89` (optional, unused).
- **`supabaseUserId` linkage:** set on BOTH `developers` (`auth/callback/route.ts:154,166`) and
  `consumers` (`:230,235`) to the SAME authenticated `user.id` — one Supabase auth user per email, so a
  single `deleteUser` covers a dev+consumer twin. Columns: `developers.supabase_user_id` (`schema.ts:24`,
  unique), `consumers.supabase_user_id` (`:167`, unique). A row may have `supabaseUserId = null`
  (API-key-only / seed) → nothing to delete, skip.
- **`processDataDeletion` shape (`compliance.ts:381-591`):** marks `processing` (outside txn, `:415-418`);
  `try { lookup dev (:422); toolIds (:433); db.transaction(steps 1-9, sets completed :538-569) } catch
  { set failed (:583-586) }`. Step 1 (`:442-459`) NULLs `developers.supabaseUserId`. Step 2 (`:471-486`)
  anonymizes the consumer twin (looked up INSIDE the txn). The resultUrl `anonymized` array is at
  `:543-553`; `retained`/`retainedUnscrubbed` at `:554-564`.
- **The deletion has NO HTTP route caller today** (grep: `processDataDeletion`/`requestDataDeletion` are
  exercised only by tests + re-exported in `settlement/index.ts`). So the behavioral change is dormant in
  prod until a deletion trigger ships — but it MUST be correct now (a future route activates it).
- **Gate baseline @ `9fa0bdbb`:** `cd apps/web && npx tsc --noEmit && npm run lint && npm test` →
  tsc 0 · lint 0 err (12 pre-existing warns) · vitest **4506 / 195 / 0**. `packages/mcp` untouched (you
  touch only `apps/web`). Re-run the FULL gate after the change; vitest should be 4506 + your new tests.
- **Supabase JS admin API:** `const admin = createClient(url, serviceRoleKey, { auth: {
  autoRefreshToken:false, persistSession:false }}); const { error } = await
  admin.auth.admin.deleteUser(userId)`. Not-found → `error` with `status === 404`. (Confirm the exact
  shape against the installed `@supabase/supabase-js@2.99.2` in `node_modules` during the build.)

## 4. Lifecycle + defect classes

- **Lifecycle:** scope-confirm → draft plan → **pre-build plan audit (DONE this ① session — folded
  above)** → build → executable gate → ② seal-gating review → seal + bookkeeping. Founder-close (LOCAL
  commit; push only on explicit founder say-so).
- **Defect classes** (`.audit/defect-ledger/`): **DC-16** (public/recorded-claim integrity — the core:
  make `:635` true, don't introduce a new false claim in the reword). **DC-17** (status-machine
  non-idempotent rerun — the auth-delete idempotency + completed/failed semantics). **DC-08** (implicit
  wrong fail-mode — the FAIL-CLOSED-on-missing-key decision; don't default to a silent no-op). **DC-15**
  (keep the corrected docstring/disclosure in sync with the new behavior). **DC-05** (the new tests must
  be non-vacuous). **DC-11/DC-03**-adjacent (the service-role admin client is a powerful new sink — keep
  it narrowly scoped to deleteUser; never expose it client-side).

## 5. Tests — strategy

Two test concerns; the SLICE-1 source-text test must remain GREEN (or be updated in lock-step).

1. **BEHAVIORAL — the auth-delete (NEW).** Assert `processDataDeletion` deletes the Supabase auth user.
   The existing `compliance.test.ts` mock harness lacks `transaction`/`delete`/`inArray`/most schema
   tables (per SLICE-1 §3), so the cheapest robust seam is to make `deleteSupabaseAuthUser` (or the admin
   module) **mockable** (e.g. `vi.mock('@/lib/supabase/admin')`) and assert:
   - it is called with the captured `supabaseUserId` (and NOT called when the id is null);
   - **idempotency:** a mocked 404/not-found resolves to success → deletion still reaches `completed`;
   - **fail-closed:** a mocked admin error (or unset key) → the deletion ends `failed` and `completed`
     is NOT written (assert ordering: the failure happens before the txn commits `completed`).
   If wiring the full `processDataDeletion` harness is disproportionate, at minimum unit-test
   `deleteSupabaseAuthUser` directly (idempotent-404, throw-on-other-error, throw-on-missing-key) AND
   add a focused assertion that the deletion flow calls it before the completion write. Decide the
   lightest seam that genuinely pins LB-1 — and **prove non-vacuity** (revert the wiring → RED).
2. **SOURCE-TEXT honesty (extend SLICE-1's `compliance-honesty-regression.test.ts`).** Pin: the email no
   longer says "permanently deleted" (or says the softened honest version); `:615` no longer says
   "wherever it appears"; the docstring/resultUrl record the auth-user deletion. Mirror the SLICE-1
   region-slice + class-banned style; keep every assertion non-vacuous (revert each edit → RED).
   ⚠ The SLICE-1 test pins `:635`/`:615` content — if you touch `:615`, update its assertions in
   lock-step so they pin the NEW honest copy, not the old.

## 6. Operator / infra precondition (surface, do not silently assume)
- **`SUPABASE_SERVICE_ROLE_KEY` must be provisioned in the production (Vercel) environment.** It is read
  by `getSupabaseServiceRoleKey()` but never used today, so its prod presence is UNVERIFIED. The build
  can proceed (the code fail-closes when absent), but the FEATURE is inert in any env lacking the key —
  flag this for the founder to confirm/provision before the deletion path is wired to a route. The build
  agent should NOT attempt to read or print the secret; just confirm the env var NAME is wired and note
  the precondition. (It is already whitelisted in `turbo.json` env passthrough — provisioning is a
  Vercel-env value-set, not a config-wiring task.)
- **Pre-existing `completed` data-deletion rows (the no-op backfill gap).** The `completed` idempotent
  no-op (`compliance.ts:398-402`) never re-runs — so any deletion row that reached `completed` UNDER THE
  OLD CODE has its auth user still alive, and after this ships its record falsely asserts "auth deleted."
  **Confirm zero pre-existing `status='completed' AND request_type='data-deletion'` rows exist** before
  shipping (almost certainly true — the deletion has no HTTP route caller, so it has effectively never
  run in prod); if any exist, they need a one-off `deleteSupabaseAuthUser` backfill — the no-op will not
  retro-cover them. State this as a verified precondition, do not silently assume it.
- **Future deletion-route authorization (forward precondition — NOT built here).** `processDataDeletion`
  does NO authz; it trusts `record.entityId`. There is no HTTP route caller today, so the now-IRREVERSIBLE
  `auth.admin.deleteUser` is dormant. Whatever route eventually activates it MUST (mirroring
  `data-export/route.ts`) derive the subject solely from `requireDeveloper(request)` → `auth.id`, NEVER
  accept a client-supplied target id, and rate-limit — else this becomes an arbitrary/mass auth-user-delete
  primitive. Record this constraint so it travels with the feature.
- **Operational: no auto-retry driver.** Fail-closed is correct, but there is no cron/route that re-drives
  `failed` deletions — a sustained Supabase-admin outage stalls erasure in `failed` with no auto-recovery
  (against the GDPR one-month clock). Acceptable while dormant; note it for whoever wires the route.

## 7. PLAN-AUDIT FINDINGS — FOLDED (the build MUST honor these; they refine/override §1-§6 where more specific)

The ① pre-build plan audit (5 lens-distinct Opus-4.8 reviewers @ xhigh — correctness/ordering · SEAM ·
literal-execution · completeness/scope · security/PII — coverage mode) found the plan's CORE sound
(ordering, idempotency, fail-closed, scope-bounding all correct) and surfaced these concrete refinements,
all verified at source:

**A. `admin.ts` server-only enforcement (the repo has NO `server-only` package — it breaks vitest).**
Do **NOT** add `import 'server-only'` — `rails.ts:15-20` documents that it breaks vitest's node env and the
convention is "enforced by code review + lazy fail-fast at first call." Mirror that precedent exactly:
(1) a prominent `// SERVER-ONLY` header banner; (2) the service-role key read **lazily per-call** (never at
module top-level); (3) the admin-client constructor **module-private (NOT exported)** — export ONLY
`deleteSupabaseAuthUser`, so no caller can obtain a general god-mode client (DC-11). `compliance.ts` is
imported only by server route handlers today (no `'use client'` importer) — keep it that way.

**B. `deleteUser` idempotency keys on `error.status === 404`, and a malformed id THROWS.** Verified against
`@supabase/auth-js@2.99.2` (`GoTrueAdminApi.deleteUser`): for any `AuthError` (incl. a 404 not-found) the
SDK **RETURNS `{ data, error }`** (does not throw) → key idempotency on **`error.status === 404`**, not a
message substring. BUT `deleteUser` calls `validateUUID(id)` FIRST, which **throws a plain `Error`** for a
non-UUID id (propagates raw → lands in the deletion `catch` → `failed`; acceptable fail-closed, but know the
404-return is not the only failure mode). Refines LB-1(b).

**C. HARD delete is load-bearing.** Call `auth.admin.deleteUser(userId)` with NO second arg —
`shouldSoftDelete` defaults to `false` (hard delete; removes the `auth.users` row and cascades MFA
factors/identities/sessions within the `auth` schema, so no separate MFA cleanup needed). A soft-delete
RETAINS the row → re-introduces the false claim. Do NOT pass `shouldSoftDelete: true`.

**D. No-secret-logging discipline.** The deletion `catch` logs `err.message`/`err.stack` to stdout AND
Sentry (`logger.ts:45-46,67`). The fail-closed missing-key throw MUST carry a STATIC message (e.g.
`"SUPABASE_SERVICE_ROLE_KEY is not set"`) — never interpolate the key value or `process.env` contents.
`deleteSupabaseAuthUser` must never log the key, the admin client, or the full admin response object (only
`userId`/`exportId` are safe). The client-facing path already returns a static "Internal server error" — no
key reaches the browser; keep it that way.

**E. Re-target the docstring edit to the RETRY-SAFETY PROOF block, not the scope paragraph.** §1.2 pointed
the docstring update at `:354-357` (scope), but the load-bearing invariant lives at the `'failed':
RETRYABLE …` bullet (`compliance.ts:376-379`): *"'failed' implies the transaction never committed and a
retry sees pristine data."* After inserting the pre-txn auth-delete, that is incomplete — a `failed` retry
may find the auth user ALREADY deleted (DB pristine, external state not). Restate it: the pre-txn auth-delete
is **idempotent**, so `failed` is still retry-safe, and the only `completed` write is inside the txn, so
`completed` ⇒ (auth deleted ∧ DB anonymized). Also update the crash-runbook note (`:379-381`) to say a
crashed-mid-flight row may have the auth user already deleted (safe to retry). **LOCK-STEP:** the SLICE-1
test pins `/Status machine \(H1, 2026-06-05\)/` (`compliance-honesty-regression.test.ts:146`) — keep that
literal substring intact when editing the block.

**F. Test lock-step the plan §5 MISSED — `email.test.ts:1226` is a hard gate-breaker.**
`apps/web/src/lib/__tests__/email.test.ts:1226` asserts `expect(result.html).toContain('permanently
deleted')`. Softening the email turns this RED — and it is in a file §5 did not name, so a builder could miss
it OR keep the overstatement to satisfy the stale test. **Add `email.test.ts:1224-1227` to the lock-step
edit list** (update it to assert the NEW honest copy). The subject pin `:1194` (`'account has been deleted'`)
and the 30-day notice survive (keep those phrasings). For the SLICE-1 `:615` reword, the must-PRESERVE
literal substrings are **`referencing only your anonymized account`** and **`retained for 7 years`** (pinned
at `compliance-honesty-regression.test.ts:237-238`) — dropping "wherever it appears" is free; do not
collateral-damage those two.

**G. Census ALL live deletion-claim surfaces — fix-or-justify each, don't whack-a-mole.** The ③ audit's N2
was a census-target defect (LIVE `.tsx` vs draft `.md`). Enumerate and consciously rule on EACH:
| Surface | Disposition |
|---|---|
| `docs/page.tsx:635` "Supabase auth records are deleted" | becomes TRUE via the behavioral fix → leave/verify |
| `docs/page.tsx:615` "wherever it appears" | soften (drop the absolute); preserve the two pinned substrings |
| `email.ts:733` + `:738` "permanently deleted" | soften to honest; lock-step `email.test.ts:1226` |
| `email.ts:734` banner "permanently removed" (30-day retention) | likely LEAVE (true re: retention) — but rule explicitly; the §1 census `permanently delet` grep WON'T catch "removed" |
| `app/(dashboard)/dashboard/settings/page.tsx:2117` "Permanently delete your account and **all associated data**. This action cannot be undone." | LIVE overstatement ("all associated data" — financial/payer retained) → soften "all associated data" → "your account and personal data"; "cannot be undone" is true (keep) |
| `app/privacy/page.tsx:138-164` (retention/rights) | generic-and-true → NO change, but RECORD "reviewed, left as-is" (do not silently omit — that repeats N2) |

**H. `:615` reword must not re-introduce a "complete/all" implication.** Scoping it to "across your developer
profile and the records that identify you" is fine; if it re-asserts completeness ("all", "everywhere"), the
routed-out N3 (`organizations.billing_email`) + payer address become hidden dependencies. Keep it
non-absolute.
