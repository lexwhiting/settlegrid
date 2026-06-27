# V-N3-deletion-wiring — ③ POST-SEAL DEEP-AUDIT RECORD — 2026-06-26

**Verdict: RE-CERTIFIED (hardened).** Tier HIGH-STAKES (confirmed — new destructive user-facing
boundary went live + touched the sealed `processDataDeletion` + new "invocations survive deletion"
invariant + DC-16 disclosure surface). The integrated whole was audited on the committed tree
(base ② `7d5b7f23`, ③ handoff `1603df8c`); the seal's hard moat (no PII escape, no fail-open, data
fully erased, self-scope sound) **stands**, and the consciously-deferred **primary target (re-run
disclosure under-disclosure) is now CLOSED** at the root, fix reproduced live RED→GREEN.

Claude does NOT self-commit — these ③ hardening edits sit in the working tree awaiting the operator's
path-scoped commit (+ bundled push with ②, per cadence). One operator decision is routed out (OAuth
step-up build-venue, §6).

---

## 1. Method
Integrated-whole audit via **Agent-tool spawns** (not a workflow — the loud-pause edge was moot:
reviewers needed only allowlisted caps Read/Grep/Glob + tsc/vitest/git; concise final messages kept
the integrator context clean). **6 lens-distinct reviewers + 1 collective-miss critic**, all
`claude-opus-4-8[1m]`, session effort **xhigh** (the critic ran at xhigh — no Path-1 `effort:max`
definition pre-existed and the phase ran autonomously; the `max` bump is optional and was not taken,
noted on the Policy line). Env clean (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all unset).

Lenses: SEAM · LITERAL-EXECUTION · disclosure-idempotency (primary-target finder) · cross-chunk
integration/data-lifecycle · DC-16 disclosure-honesty · security/destructive-boundary. Critic ran
JOB-A (collective blind spots) + JOB-B (adversarially verify the planned primary-target fix BEFORE
it landed).

## 2. Mechanical pre-flight (scripted; handed to reviewers so none re-derived checkable facts)
- **Gate GREEN on the committed tree:** `tsc --noEmit` 0; `vitest run` 209 files / 4780 pass; the
  pglite cascade-faithful integration test genuinely executes real wasm-Postgres (~1.7 s, non-vacuous).
- **Invariant re-derivation:** every `invocations` INSERT path enumerated (proxy 714/783/1004/1447/
  1559/2678; sdk/meter 111/148/343; sdk/meter-with-metadata 82/196; lib/metering 361); SDK paths gate
  on `api_key.status==='active'` (meter:62, meter-with-metadata:55); proxy protocol/MPP/x402 gate on
  `tool.status==='active'` (lookupToolBySlug proxy:1225/:1498). The `api_key→invocation` FK is
  `ON DELETE CASCADE` — proven structurally AND behaviorally by the pglite test (so revoke-not-delete
  is load-bearing). Proxy `maxDuration=90` confirms the "≤~90s in-flight residual" claim.
- **Hostile-input / boundary read** of the DELETE endpoint: CSRF header matrix, find-or-reuse status
  mapping, step-up classification, info-leak — all traced.

## 3. Findings — FIXED (in scope; authorized surfaces; each reproduced live)

### F-1 (PRIMARY TARGET) — re-run disclosure under-disclosure — FIXED + RED→GREEN — DC-13/DC-16/DC-17
`processDataDeletion` recomputed `consumerMatched`/`deletedAuthUser` from the LIVE developer row every
call; a re-run on an already-anonymized developer (cron re-driving a leftover `failed`/stale row after
a retry's row completed the scrub) matched zero consumers → persisted a **degraded resultUrl** OMITTING
the `consumerMatched`-gated `retainedUnscrubbed` foreign-tool linkage
(`invocations.consumer_id/api_key_id/session_id/referral_code`) which genuinely persists
(revoke-not-delete keeps those rows) → an under-disclosing GDPR record-of-processing. **Reproduced live**
in pglite (run #2's `retainedUnscrubbed` = `[ledger_entries.operation_id, …payer, organizations.billing_email]`,
omitting `invocations.consumer_id`).
- **Fix (root, remedy (a) — already-erased idempotency guard, in `processDataDeletion` right after the
  `dev` load):** if `dev.email === deleted-${developerId}@deleted.settlegrid.ai` (the deterministic
  sentinel step 1 writes, keyed to the server-generated id — not guessable/collidable), short-circuit
  WITHOUT re-scrubbing and persist the **authoritative** disclosure instead of a recompute: prefer this
  row's own `resultUrl`; else copy the **earliest** data-deletion **sibling** carrying a `resultUrl`
  (the row whose txn actually erased the dev). Sibling query is **scoped to `requestType='data-deletion'`**
  (+entityType+entityId, excluding self) — never a data-export row, whose `resultUrl` is a base64 PII
  blob (critic JOB-B amendment 1, the one that would have been BROKEN if dropped). All writes CAS on
  `status != 'completed'`; the row's current state is re-read (the top-of-fn `record` may be stale under
  a concurrent same-exportId re-drive). If the authoritative row was purged by the 30-day cron, NO
  degraded recompute is persisted (a null `resultUrl` honestly records the absence).
- **Critic verdict on the fix: SOUND-WITH-AMENDMENTS** — "anonymized dev ⇒ a same-txn completed sibling
  with resultUrl" verified TRUE (step 1 anonymize + step 9 completed+resultUrl are the same txn);
  detection cannot false-positive a live dev (sentinel keyed to own id) and the single-row endpoint+cron
  race is correct under READ-COMMITTED + the CAS. All 4 amendments folded (data-deletion-only sibling;
  earliest-not-most-recent; prefer own resultUrl; include `failed`-with-resultUrl siblings via the
  `resultUrl IS NOT NULL` key). No prod backfill needed — the feature is not yet pushed, so no degraded
  rows exist.
- **Regression pin (RED→GREEN):** `compliance-deletion-cascade.integration.test.ts` "RE-RUN ON
  ALREADY-ERASED DEV" — runs `processDataDeletion` twice; run #2 must copy the authoritative disclosure
  (`d2.retainedUnscrubbed` contains `invocations.consumer_id`; `d2` deep-equals `d1`; `resultUrl` is not
  a base64 blob). RED without the guard (mutation-proven), GREEN with it.

### F-2 — `catch` flips a committed `completed`→`failed` (the re-run enabler) — FIXED — DC-17
The function's `catch` set `status='failed'` UNCONDITIONALLY; a throw AFTER the scrub txn committed but
before return (lost commit-ack / post-commit throw) reverts a genuinely-completed deletion to `failed`,
which the endpoint's `ne(status,'failed')` find-or-reuse then re-creates and the cron re-drives — the
linchpin manufacturing F-1's "already-anonymized + needs-another-run" state. **Fix:** compare-and-set
`where(and(eq(id), ne(status,'completed')))`, mirroring the cron reset's CAS. (`deletionsRecovered`
over-count is mooted — a reconciled row no longer counts a spurious re-scrub.)

### F-3 — account-deleted email implied a 30-day recovery window for an irreversible op — FIXED — DC-16
`email.ts accountDeletedEmail`: "If you believe this was a mistake, contact support@…**within 30 days**."
(a vestige of the suppressed export-link expiry) contradicted the synchronous hard-delete, the same
email's "permanently removed", and the settings UI's "This action cannot be undone." Converged across the
DC-16, literal-execution, and security lenses. **Fix:** reworded to "This action is permanent and cannot
be undone. If you did not request this deletion, contact … right away so we can investigate." The
`email.test.ts` pin that asserted the false "30 days" claim was corrected to pin the honest wording.

### F-4 (minor) — docstring overstatement — FIXED — LITERAL-EXECUTION/DC-16
The terse status-machine line "'completed' ⇒ (auth user deleted ∧ DB anonymized)" overstated on the
no-linked-auth-user path (seed/API-key-only dev via cron → `deletedAuthUser=false` yet completed; the
fuller §9 disclosure already relaxes this). Reworded to "deleted **or absent**" + a one-line note that
the already-erased guard is the third `completed` path.

## 4. Findings — REPORTED + ROUTED (pre-existing / frozen-surface / scope-disciplined — NOT fixed here)
These are genuine integrated-whole findings a diff-scoped review structurally could not see, but fixing
them would perturb surfaces this chunk was NOT authorized to touch or pull in deferred work. Scope
resolved by source probe (see notes):

- **integ-1 (MED) — public tool-badge serves a DELETED tool's name + lifetime usage count permanently.**
  `badge/tool/[slug]/route.ts` has no `status` filter (only greys the badge for non-active). **Pre-existing**
  — `tools.status='deleted'` is reachable independent of this chunk via `DELETE /api/tools/[id]:361`
  (single-tool delete). Recommend a follow-up: treat `status!=='active'` as not-found on the badge (and
  the same on `activity` integ-2 ~1h slug leak + `marketplace/stats` integ-12 aggregate count).
- **integ-3 (MED) — stale statically-rendered `/dev/[slug]` serves a deleted developer's name/bio/avatar
  until redeploy.** The page is SSG (no `revalidate`) and `processDataDeletion` issues no
  `revalidatePath`. **Pre-existing revalidation gap** (any `publicProfile` toggle has it), worse for
  erasure. Recommend a follow-up: capture the slug pre-step-1 and `revalidatePath('/dev/<slug>')` after
  the scrub commits (+ companion `badge/dev/[slug]` integ-4 ≤5-min echo).
- **integ-5 (LOW-MED) — the 30-day completed-export purge (cron §3, pre-existing, not in this chunk's
  diff) also purges completed DATA-DELETION records-of-processing.** This chunk merely makes deletion
  records exist to flow through it. This is a GDPR record-retention **policy fork** (Art. 30 accountability
  vs. data-minimization), not a clear bug → operator decides whether to scope §3 to `data-export`. The
  primary-target fix is made robust to a purged sibling rather than depending on §3 being changed.
- **miss-1 (operational, HIGH-if-true / LOW-likelihood) — prod DDL provisioning unverified vs stale
  migrations.** The deletion reads columns (`supabaseUserId`, `notification_webhooks`, `tools.source_repo_url`)
  absent from the checked-in `drizzle/*.sql`; if prod were bootstrapped from migrations (not `drizzle-kit
  push` from schema.ts) every deletion would throw → `failed`. **Mitigant:** the same schema.ts columns
  are used app-wide, so a migration-built prod would have the whole app broken — i.e. prod is demonstrably
  on `drizzle-kit push`. This is the prior-chunk DC-14 drift re-surfaced. Recommend a cheap CI/startup
  assertion that the load-bearing columns exist (fail-loud-not-silent-failed-deletions). Not a code fix
  for this chunk.
- **sec-4 — OAuth-only step-up gap** → operator decision, §6 below (design + threat model delivered).
- **NOTES (LOW, no fix):** literal-3 waitlist column-trim asymmetry and literal-4 empty-email — both
  **non-live** (the only waitlist writer `api/waitlist:149` always `.toLowerCase().trim()`s and emails
  are `z.string().email()`-validated, so no untrimmed/empty stored rows exist; the disclosure is not
  actually falsified). sec-3a `isPasswordUser` fail-open default + literal-2 step-up-uses-developers.email
  → fold into the sec-4 verifyStepUp redesign (operator). literal-5 concurrent double-submit (§13.4-accepted,
  bounded by 5/min). integ-10/11 (mcp_shadow_index GitHub handle, agent_identities) + miss-3 (`accounts.label`)
  — retained data with no FK/key for the deletion to scrub; confirm no subject-PII writer. settings-UI never
  calls `supabase.auth.signOut()` (cosmetic; hard-redirect to /login + the auth user is hard-deleted).

## 5. Verified-CLEAN (the moat held — re-confirmed at source, NOT re-litigated without cause)
api_key status-gate on all 5 keyHash auth paths reject `revoked`; tool.status gate on every
invocation-insert + every discovery/MCP/marketplace/sitemap listing reader excludes `deleted`; F-B1
both-gate pre-commit; revoke-not-delete keeps the FK target (pglite-proven); `completed` set only inside
the scrub txn (no fail-open); self-scope on `auth.id` (IDOR-safe); CSRF same-origin matrix; info-leak
clean (no UUID/raw-error/stack in any response body); the completion audit row carries no IP/UA/details
(the ② HIGH stays fixed); the resultUrl `anonymized/retained/retainedUnscrubbed/minimized` gate-mapping is
honest (every gate matches its scrub's gate); the in-flight-residual `anonymizedNote` claim is TRUE (the
per-developer purge loop purges the surviving own-tool metadata at `logRetentionDays`); webhook_deliveries
cascade-cleaned; auth-user hard-delete cascades only within the `auth` schema; retained financial tables
hold no denormalized name/email.

## 6. OPERATOR DECISION ROUTED OUT — OAuth step-up build-venue (sec-4; handoff §2)
Design + threat model delivered (the ③ deliverable). The destructive boundary is well-built; the one
substantive gap is **pure-OAuth, no-MFA accounts get no fresh re-auth** before irreversible erasure
(deletion rests on the live same-origin session + typed confirm — vulnerable to a hijacked live
same-origin session: XSS in the dashboard origin, shared/stolen device, token theft). It is self-scoped
(medium, not high) and already the MOST-protected destructive op in an app where **no other operation
steps up at all** (data-export, key create/rotate, webhooks, even MFA-unenroll are session-only).

Provider-agnostic design (GDPR Art. 17 guardrail: every path FORCES re-auth via an always-completable
fallback, never BLOCKS erasure, never mandates pre-enrolled MFA):
1. Password-capable → fresh `signInWithPassword` (**built**).
2. MFA-enrolled (any provider) → fresh AAL2 challenge — **in-tree primitives** (`auth/mfa/route.ts`
   challenge/verify/getAAL); feasible **inline now**; biggest risk-reduction per unit effort.
3. Pure-OAuth no-MFA → force fresh IdP auth (OIDC `prompt=login`/`max_age`, NOT silent re-consent) +
   a signed short-TTL "deletion-sudo" marker — needs a **small dedicated build chunk** (redirect round-trip).

**Recommended:** CLOSE path 2 inline (cheap, in-tree) + the sec-3a fail-open hardening; ACCEPT-and-defer
path 3 to a dedicated chunk; track MFA-unenroll-session-only alongside. The full-ACCEPT option remains
defensible (self-scoped; already above the platform baseline). This is a UX-security feature (scope beyond
audit-hardening) → the operator owns the build-venue call.

**OPERATOR DECISION (2026-06-26, AskUserQuestion): CLOSE MFA/AAL2 inline + defer OAuth-no-MFA.** Build a
fresh-AAL2 step-up branch in `verifyStepUp` using the in-tree `auth/mfa` primitives (challenge/verify/
getAAL) as a SMALL dedicated build chunk (+ the sec-3a fail-open hardening: treat an unresolvable
provider as "require fresh proof", subject to the Art. 17 guardrail), covering every MFA-enrolled user
incl. OAuth. ACCEPT-and-defer the pure-OAuth-no-MFA forced-IdP-reauth (path 3 — needs the redirect/
sudo-marker chunk). Track MFA-unenroll-session-only alongside. → A NEW ① build chunk (NOT this ③); the
threat model + design above are the binding input.

## 7. Defect-class ledger
DC-13 (latent-in-prod-logic): the re-run under-disclosure that sprang on the wiring is CLOSED (already-
erased guard). DC-16 (public-claim-content-integrity): the under-disclosing re-run record + the email
recovery-window claim FIXED. DC-17 (status-machine non-idempotent re-run): the catch CAS closes the
completed→failed flip. **No NEW defect class.** SEAM / LITERAL-EXECUTION: no new recurrence beyond the
F-4 docstring honesty nit (folds into DC-16). The integ-1/3 public-reader-serves-erased-entity items are
PRE-EXISTING (reachable via single-tool-delete) and routed, not a class this chunk introduced.

## 8. Gate (post-③, clean isolated re-run)
`tsc --noEmit` 0 · `npm run lint` 0 errors (pre-existing unused-disable warnings only) · `vitest run`
**209 files / 4781 tests pass** (4780 → 4781: the new RE-RUN regression pin; the pglite suite non-vacuous).

**→ Operator: commit the ③ hardening path-scoped** (`apps/web/src/lib/settlement/compliance.ts`,
`apps/web/src/lib/email.ts`, `apps/web/src/lib/__tests__/compliance-deletion-cascade.integration.test.ts`,
`apps/web/src/lib/__tests__/compliance-deletion-auth.test.ts`, `apps/web/src/lib/__tests__/email.test.ts`,
this record) **EXCLUDING** the `tools/page.tsx` carry-forward + local `.claude/`/`.audit/`; then bundle
the push with ② (`7d5b7f23`) per cadence. Resolve §6 (OAuth step-up venue) — design is ready.
