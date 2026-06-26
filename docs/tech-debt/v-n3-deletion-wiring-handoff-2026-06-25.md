# ① BUILD HANDOFF — V-N3-deletion-wiring — 2026-06-25

**Chunk:** wire the developer GDPR account-deletion flow — an authenticated endpoint that activates
the now-correct-but-DORMANT `processDataDeletion`, with the F-B1 *deactivate-before-delete* guard,
and replace the front-end stub that currently tells users to email support.

**Tier: HIGH-STAKES** (see §8). **Base:** origin/main `7ec9adbe` (V-N3-deletion-cascade-correctness
②+③ shipped). This is the next chunk in the V-N3 compliance line; it has NO code yet.

> **Build agent — READ FIRST (step zero, before any code):**
> 1. THIS handoff (all sections).
> 2. `apps/web/src/lib/settlement/compliance.ts` — `requestDataDeletion` (:57), `processDataDeletion`
>    (:474), the pre-txn Supabase auth-delete (:567-588) and the api_key REVOKE steps 2-3 (:695-698,
>    :746-751). This is the SEALED function you are activating; understand its atomicity proof.
> 3. `apps/web/src/app/api/dashboard/developer/data-export/route.ts` — the WIRED sibling endpoint you mirror.
> 4. `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` — `handleDeleteAccount` (:987) the STUB
>    + the confirm UI (:2113-2160).
> 5. The deletion-cascade ③ record `docs/tech-debt/v-n3-deletion-cascade-correctness-post-seal-deep-audit-2026-06-25.md`
>    (§3 F-B1 — the binding precondition this chunk closes) and `.audit/defect-ledger/DC-13` (F-B1 entry).

## 0. Intent — why, who consumes it, what it enables
The V-N3 line built a correct, honest `processDataDeletion` over four chunks (log-redaction →
invocations-min → enable-disclosure → deletion-cascade-correctness). It is **fully inert**: NEITHER
`requestDataDeletion` NOR `processDataDeletion` has any caller, and there is no account-deletion
endpoint. A developer who clicks "Delete Account" in settings today gets a toast — *"Account deletion
request submitted. Contact support@settlegrid.ai to finalize"* — and nothing happens server-side.
**Consumer = the developer exercising GDPR Art. 17 erasure** via the existing settings UI. **This
chunk delivers the entire line's value**: self-service account deletion, correctly de-authenticated,
honestly disclosed. It also closes **F-B1** (DC-13), the deactivate-before-delete precondition the
deletion-cascade ③ recorded as binding "for whenever processDataDeletion is wired to a live caller" —
which is now.

## 1. Current state (verified at source 2026-06-25)
- `processDataDeletion(exportId)` (compliance.ts:474) — SEALED + ③-re-certified. Looks up the
  `compliance_exports` row, guards status (`completed`→idempotent no-op; `processing`→throws;
  `pending`/`failed`→proceed), marks `processing`, captures `dev` + matching consumers + `supabaseUserId`
  BEFORE the txn, **deletes the Supabase auth user(s) pre-txn** (:588, non-transactional, irreversible),
  then a single `db.transaction` does steps 1 (anonymize developer), 1b (delete developerApiKeys), 2
  (anonymize consumer twin + **REVOKE** consumerId-keyed apiKeys + scrub consumer PII), 2b (waitlist),
  3 (**REVOKE** toolId-keyed apiKeys), 4 (null own-tool `invocations.metadata`), 5/5b/5c (audit logs), 6
  (webhooks), 7 (reviews), 8 (anonymize tools), and sets `status='completed'` + the disclosure
  `resultUrl`. Retry-safe + idempotent (proven; the `completed` write is the sole arbiter, inside the txn).
- `requestDataDeletion('provider', developerId)` (compliance.ts:57) — inserts a `compliance_exports`
  row (`requestType:'data-deletion'`, `status:'pending'`), returns `{ id, status }`. WIRED to nothing.
- `data-export/route.ts` — the WIRED mirror: rate-limit (ip + uid) → `requireDeveloper(request)` →
  **tier-gate (`data_export` = Scale+)** → parse body → `requestDataExport` + `processDataExport` →
  email + audit-log → `successResponse`. `maxDuration = 60`.
- `settings/page.tsx:987` `handleDeleteAccount()` — STUB: requires `deleteConfirmText === 'DELETE'`,
  then `toast('… Contact support@settlegrid.ai to finalize')` and closes the modal. **Calls no endpoint.**
- `accountDeletedEmail(email, exportUrl?)` (email.ts:717) — EXISTS. Subject "Your SettleGrid account
  has been deleted"; body "personal data has been anonymized and your login permanently removed" +
  retention banner "Some data may be retained for **up to 30 days**…". (See §12 DC-16.)
- `requireDeveloper(request)` (middleware/auth.ts:45) → `AuthenticatedDeveloper` with `.id` + `.email`.
- `cron/data-retention/route.ts` does NOT process deletions (it purges old invocations + old completed
  exports). So there is no async deletion processor — **wire synchronously, mirroring export.**

## 2. Scope (single chunk — do NOT merge, do NOT split)
1. **Backend endpoint** — a new authenticated developer self-deletion route (recommend
   `DELETE /api/dashboard/developer/account`, or `POST /api/dashboard/developer/account/delete`;
   builder picks, note it). Orchestrates request → deactivate → process → email → audit → response.
2. **F-B1 deactivate-before-delete** (THE crux — §4.1) — close the concurrent-insert window.
3. **Front-end** — replace the `handleDeleteAccount` stub with a real call to the endpoint; on success
   sign the user out / redirect (their auth is gone); handle errors. Keep the `'DELETE'` confirmation.
4. **Tests** — endpoint unit tests + a real-PG (pglite) F-B1-closure test extending the existing
   `compliance-deletion-cascade.integration.test.ts` harness.

OUT OF SCOPE (do not pull in): consumer-side self-deletion (a distinct entity flow); the
counsel-pending `organizations.billing_email` member-deletion scrub and the on-chain-payer *erasure*
path (both legal-blocked); admin-deletes-arbitrary-account; any change to the sealed scrub steps 4-8
or the §4 disclosure beyond what F-B1 strictly requires.

## 3. The two LOAD-BEARING decisions (where audit judgment concentrates — most likely silently wrong)

### 3.1 F-B1 deactivate-before-delete — design + the in-flight residual
> **⚠ SUPERSEDED by §13 (plan-audit fold).** The recommended design below (api_key-revoke-only) is
> INCOMPLETE — it misses the protocol/MPP invocation paths. Read §13.1–§13.2 for the BINDING revised
> design (deactivate BOTH gates) before building. §3.1 is retained for context.
**The defect (DC-13, from the deletion-cascade ③):** invocations are inserted by the proxy/SDK meter
paths AFTER authenticating a consumer `apiKey` (`status='active'`). The sealed `processDataDeletion`
revokes those keys INSIDE its scrub txn (steps 2-3). A consumer request that read a key as `active`
just before the revoke commits can INSERT an invocation AFTER step 4's metadata-null — landing fresh
PII (the already-public on-chain payer + free-form metadata) that escapes the scrub. Under the OLD
(buggy) delete this insert would FK-fail; the correct revoke fix re-opened the window.

**Recommended design (RECOMMENDED, but the build must reproduce/justify it and the plan audit will
stress-test it):** add a **pre-committed deactivation** that revokes the SAME key sets steps 2-3 target
(`inArray(apiKeys.consumerId, ids)` for the matched-consumer set + `inArray(apiKeys.toolId, toolIds)`),
committed BEFORE the scrub txn — placed in `processDataDeletion` right AFTER the pre-txn Supabase
auth-delete and BEFORE `db.transaction(...)`, reusing the ALREADY-captured `ids`/`toolIds` (single
source of truth — do NOT re-derive them; that would be a DC-07 multi-surface drift). The in-txn steps
2-3 revoke then becomes an idempotent backstop (already proven idempotent). After the pre-commit, every
auth lookup reads `status='revoked'` → rejects, so no NEW request can create an invocation the scrub
misses. **Atomicity:** the deletion's proof ("`completed` ⇒ auth-user deleted ∧ DB anonymized") is
preserved; the NEW intermediate state on failure — *keys revoked (committed) but scrub incomplete,
`status='failed'`, retryable* — is DESIRABLE (a failed deletion leaves the account DEACTIVATED, not
live) and must be documented.
**The residual you must name + decide:** a request that authenticated BEFORE the pre-commit and inserts
in the ~ms between the pre-commit and the scrub txn snapshot is still possible (in-flight drain).
Decide and JUSTIFY one: (a) ACCEPT the bounded residual + ensure it is honestly covered by the existing
retained-un-scrubbed metadata disclosure (it is on the subject's own tool; metadata holds at most the
already-public payer) — lowest cost, must be DC-16-honest; or (b) add a bounded DRAIN between
deactivation and scrub (synchronous delay or a deferred/queued scrub) — closes it fully at a latency
cost. **Do not silently leave the window open and claim it is closed (DC-16/DC-08).**
*SEAM cues to grep before finalizing:* every `from(apiKeys)` auth path's `status` gate (the 5 paths:
proxy/[slug]:174, sdk/meter-with-metadata:55, sdk/validate-key:68, sdk/test-validate:60, sdk/meter:62);
whether any path caches a key's active-state across the request; the proxy request max lifetime
(bounds the residual).

### 3.2 NO tier gate on deletion (the easy silent compliance bug)
The export endpoint gates on `hasFeature(tier, 'data_export', …)` = **Scale+**. **Account deletion is a
GDPR Art. 17 right and MUST NOT be tier-gated.** Mirroring the export endpoint too faithfully (copy-paste
the tier gate) would unlawfully block erasure for free/lower tiers. The endpoint authenticates and
self-scopes, but applies NO `hasFeature` gate. State this in a comment so it isn't "helpfully" re-added.

## 4. Other correctness decisions (calibrated — pick reasonably, note them)
- **Self-only:** delete ONLY `auth.id`'s own account (`entityType:'provider'`, `entityId = auth.id`).
  No body-supplied target id. (DC-03 — a destructive endpoint must be authenticated + self-scoped.)
- **Confirmation:** require the same `'DELETE'` confirmation the UI already collects — send it in the
  body (e.g. `{ confirm: 'DELETE' }`) and reject otherwise (422/400). Defense-in-depth vs the client check.
- **Sync vs async:** SYNCHRONOUS (mirror export; set `maxDuration`). No async processor exists.
- **Email:** capture `auth.email` BEFORE the deletion (step 1 anonymizes it), call
  `accountDeletedEmail(email)` WITHOUT an `exportUrl` (the deletion `resultUrl` is raw JSON, NOT served —
  the `data-export/[id]` route 500s on a non-base64 URL; do not offer a download link).
- **Idempotency / double-submit:** `processDataDeletion` is idempotent on `completed` and guards
  `processing`. Decide the endpoint's response when a request is already in-flight/done (DC-17 — don't
  surface a raw 500 for a benign re-submit; map `processing`/`completed` to a sane status).
- **Audit log:** the deletion scrubs the developer's own `audit_logs` (step 5). Writing
  `privacy.account_deletion_requested` is fine but will itself be scrubbed in the same run — that's
  acceptable (the `compliance_exports` row is the durable record); don't depend on the audit row surviving.
- **Rate-limit:** mirror export's ip + uid limiters (a destructive endpoint should be rate-limited).

## 5. Frozen / existing surfaces
- The sealed scrub txn steps **1, 1b, 2(scrub/anonymize), 2b, 4, 5, 5b, 5c, 6, 7, 8** and the **§4
  disclosure** — DO NOT perturb. The ONLY authorized change to `processDataDeletion` is the F-B1
  pre-committed revoke of §3.1 (which reuses captured `ids`/`toolIds` and leaves in-txn 2-3 as an
  idempotent backstop). `invocations.api_key_id` stays `ON DELETE CASCADE`.
- The honesty pins in `compliance-honesty-regression.test.ts` and the disclosure buckets — unchanged.
- The settings UI's overall layout — change ONLY `handleDeleteAccount` + its success/error handling.

## 6. Tests (build them; gate must stay green)
- **Endpoint unit tests** (mirror the export route's test style + the deletion-auth mock suite):
  401 without auth; 422/400 without `confirm:'DELETE'`; **NO tier gate** (a free-tier developer
  succeeds — pin this, it guards §3.2); self-scope (cannot target another id); success → `completed`
  + email sent + audit attempted; double-submit / `processing` → sane mapped response (not a raw 500);
  the deactivation runs BEFORE the scrub (ordering pin).
- **F-B1 real-PG closure test** (extend `compliance-deletion-cascade.integration.test.ts`): seed an
  active key + tool + dev; assert that after the deactivation phase commits, a key is `revoked` such
  that a subsequent insert path would be rejected (assert the gate, per the established "assert the
  gate" pattern); and that the pre-commit + scrub leaves no own-tool invocation with un-nulled
  metadata for keys revoked pre-scrub. Make it NON-VACUOUS (mutation: remove the pre-commit → a
  test that distinguishes pre-commit-closed from in-txn-only must go RED).
- Keep the full suite green (currently 208 files / 4755).

## 7. Tier — HIGH-STAKES, triggers (initial; ② re-confirms, may escalate)
- Opens a **NEW untrusted-input boundary**: a destructive, irreversible, user-reachable deletion endpoint.
- **Security/PII/auth boundary** (DC-03): a forgeable or mis-scoped deletion = catastrophic.
- **Activates a dormant invariant in prod** (DC-13 dormant→live — the highest-consequence spring;
  closes F-B1).
- **Published-claim surface** (DC-16): the settings UI copy + the deletion email + the "your data is
  deleted" framing vs the anonymize-not-delete reality + retained financial records (§12).
- Touches the SEALED `processDataDeletion` (frozen surface, even if additively).

## 8. Defect-class lenses to fold into the pre-build plan audit
- **DC-13** (latent-springs-on-wiring) — THIS is the wiring; verify the now-live function under real
  callers + concurrency; F-B1 closure correct.
- **DC-16** (public-claim integrity) — the retention-claim inconsistency (§12) + the F-B1 residual
  disclosure honesty.
- **DC-03** (unauthenticated/forgeable mutation) — auth + self-scope on a destructive route.
- **DC-08** (wrong fail-mode) — deactivation commits but scrub fails: the partial state must be
  safe + retryable, never fail-open.
- **DC-17** (non-idempotent re-run) — double-submit / `processing` mapping.
- **DC-07** (multi-surface drift) — the F-B1 revoke key-sets MUST be the single captured
  `ids`/`toolIds`, not a re-derivation.
- **DC-05** (mock-vs-real) — the F-B1 closure needs a real-PG/ordering test, not just mocks.
- **DC-15** (plan/contract drift) — the UI stub→endpoint contract match; UI copy vs realized behavior.

## 9. DC-16 retention-claim reconciliation (do NOT worsen; reconcile if cheap)
THREE different retention claims exist today and the chunk's email + UI touch two of them:
- `accountDeletedEmail` banner: "retained for **up to 30 days**".
- settings UI (:2155): "duration of your account **plus 90 days** after deletion".
- GDPR FAQ (pinned in `compliance-honesty-regression.test.ts`): financial records "retained for **7
  years**".
The deletion ACTUALLY anonymizes (not deletes) and retains financial/ledger records long-term. The
chunk MUST keep whatever copy it touches honest with the realized behavior; flag the inconsistency for
the founder if a single correct number isn't obvious (do NOT invent a legal retention period — that is
counsel territory; prefer accurate qualitative framing "anonymized; some records retained for legal/
compliance purposes" over a specific wrong number).

## 10. Gate (run clean from `apps/web`)
`npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0-err · vitest all green (≥ 208
files / 4755 + the new tests). Confirm the new pglite F-B1 test executes non-vacuously. All gate
commands are session-allowlisted (tsc/vitest/lint/git in settings.local.json).

## 11. Lifecycle
scope-confirm (done — operator chose this chunk) → THIS handoff + pre-build plan audit (runs in the
orchestrator session, closes before any build code) → build (fresh single-writer agent) → executable
gate → ② seal-gating review → seal + bookkeeping → (HIGH-STAKES) ③ post-seal deep audit. Claude does
NOT self-commit; the build ends flagging ② readiness with gate evidence.

## 13. PLAN-AUDIT FINDINGS — FOLDED (BINDING; supersedes §3.1 design where they conflict)
Pre-build plan audit = 5 lens-distinct Opus-4.8 reviewers @ xhigh (design-soundness · SEAM ·
literal-execution · scope/recurrence · security). All findings below are BINDING and source-confirmed.

### 13.1 [CRITICAL→design] F-B1 must deactivate BOTH gates, not just api_keys — REVISED DESIGN
The api_key revoke ALONE does NOT close the window. The proxy protocol/MPP/x402 inserts —
`recordProtocolInvocation` (sentinel apiKeyId `…0002`, writes `metadata.payerIdentifier`) and
`recordMppInvocation` (sentinel `…0001`, writes `metadata.mppPayerCustomerId`) — BYPASS `api_keys`
entirely (verified at proxy/[slug]/route.ts ~:1447, ~:1559) and are gated ONLY by `tool.status==='active'`
via `lookupToolBySlug` ("no API key required"; gates at proxy:1225/:1498). They write PAYER-BEARING
metadata to the subject's OWN tool. The only thing stopping them is step 8's `tools.status='deleted'`
(compliance.ts:871) — INSIDE the scrub txn. The SDK meter paths, conversely, gate on KEY status. So
**BOTH gates must be pre-committed.**
REVISED pre-commit — place AFTER the `toolIds` capture (compliance.ts:606) and BEFORE `db.transaction`
(:608) [NOT "right after the Supabase delete" — `toolIds` isn't in scope until :606], using module-level
`db`, reusing the captured `ids`/`toolIds`, in ONE small `db.transaction` (atomic for the two writes),
with the SAME guards the in-txn steps use:
  - `if (consumerMatched)` → `db.update(apiKeys).set({status:'revoked', ipAllowlist:null}).where(inArray(apiKeys.consumerId, ids))`
  - `if (toolIds.length>0)` → BOTH: `db.update(apiKeys).set({status:'revoked', ipAllowlist:null}).where(inArray(apiKeys.toolId, toolIds))`
    AND `db.update(tools).set({status:'deleted'}).where(inArray(tools.id, toolIds))` (status ONLY — leave PII-null to step 8).
In-txn steps 2-3 + step 8 become idempotent backstops. `apiKeys`/`tools`/`inArray` are already imported.

### 13.2 [HIGH→honesty] The in-flight residual is ~90s, and §3.1(a) "covered by existing disclosure" is FALSE
Even with both gates pre-committed, a request authed BEFORE the pre-commit can insert for up to ~90s
(proxy `maxDuration=90`, route.ts:63) — NOT "~ms". Such a residual lands an OWN-tool invocation with
un-nulled metadata AFTER step 4. The disclosure lists own-tool `invocations.metadata` ONLY under
`anonymized` (compliance.ts:928 — a positive "nulled" claim); there is NO own-tool retained bucket, so a
residual row FALSIFIES the `anonymized` claim (DC-16). It is NOT covered by the `retainedUnscrubbed` note
(FOREIGN-tool only). MPP `mppPayerCustomerId` is a Stripe customer id, NOT on-chain-public — so "at most
the already-public payer" is also wrong. RESOLUTION (BINDING — do NOT ship §3.1(a) as written; pick one):
  - **(A) RECOMMENDED — accept the bounded residual + a SCOPED, founder/counsel-flagged disclosure +
    docstring amendment.** This chunk is entitled to re-scope the §5 disclosure freeze FOR F-B1. Amend the
    `anonymized` metadata claim to be residual-honest ("api_keys revoked + tools deactivated BEFORE the
    scrub ⇒ no NEW request creates un-nulled metadata; a request in flight at deletion (≤~90s) may persist
    one final own-tool row whose metadata is retained until purged by retention"); RE-PIN the honesty test
    to the amended claim. Flag wording for founder/counsel.
  - **(B) HARDENING — deferred re-scrub.** Re-run step-4 metadata-null for the subject's toolIds after a
    ≥90s drain via the EXISTING `cron/data-retention` job (NO new queue exists). Keeps `anonymized` literally
    true; more infra. Only if (A)'s amendment is rejected.
  A synchronous in-request drain is INFEASIBLE (~90s breaks the endpoint) — do NOT propose it.

### 13.3 [MED→honesty/frozen] The pre-commit makes the sealed atomicity docstring FALSE — amend it (authorized)
processDataDeletion's docstring (~:458-468) says "two writes … 'failed' implies the txn never committed and
a retry sees PRISTINE DB data." After a committed pre-commit, on 'failed' the DB is NOT pristine (keys
revoked + tools deactivated). BEHAVIOR is safe + retryable + DESIRABLE (failed ⇒ deactivated); the docstring
TEXT must be amended ("pristine except the idempotent, intended pre-commit deactivation"). §5's docstring
freeze is RE-SCOPED for this required honesty edit. Do the two pre-commit updates in one `db.transaction`.

### 13.4 [MED-HIGH→correctness] The endpoint idempotency guard is DEAD CODE as planned — find-or-reuse the row
`requestDataDeletion` ALWAYS INSERTs a fresh `pending` row, so processDataDeletion's `processing`/`completed`
guards (keyed on exportId) NEVER fire via the endpoint — concurrent calls create distinct rows and run TWO
full scrubs (safe only via row-idempotency, NOT the guard). FIX: before creating, the endpoint FINDS an
existing non-`failed` `data-deletion` row for `entityId=auth.id` and REUSES its id (insert only if none) →
the guard becomes real AND the §6 double-submit test faithful.

### 13.5 [MED→correctness] Status mapping: `processing` THROWS, `completed` RETURNS — map explicitly
processDataDeletion RETURNS `{status:'completed'}` (:491) but THROWS "Deletion already in progress:
<exportId>" on processing (:497-500). A catch-all `internalErrorResponse(error)` → raw 500 (DC-17) AND
leaks the exportId UUID (info-leak). FIX: pre-read status via `getExportStatus` (or catch+match) → map
processing/completed → 409/200 with a FIXED user-facing string; never echo the raw throw.

### 13.6 [MED-HIGH→test] The §6 non-vacuity mutation is VACUOUS on success — use the FAILURE mode
On success, the pre-commit revoke and the in-txn revoke yield IDENTICAL end-state and the single-connection
pglite harness can't observe mid-txn ordering, so "remove pre-commit → RED" stays GREEN. FIX: force a txn
ROLLBACK so the pre-commit's independent commit is observable — seed a SECOND developer whose email is
already `deleted-<DEV_SUBJECT>@deleted.settlegrid.ai` so step 1's anonymize trips the `developers.email`
UNIQUE → whole-txn rollback → processDataDeletion catches → returns `{status:'failed'}` (:1037-1044, no
re-throw). Assert: status `failed` AND api_keys STILL `revoked` AND tools STILL `deleted` (pre-commit
committed independently). Removing the pre-commit → rollback reverts the in-txn revoke → keys `active` → RED.

### 13.7 [HIGH→fail-mode] Timeout-wedge + no recovery actor — add alerting + a re-driver
Synchronous design + IRREVERSIBLE pre-txn `deleteSupabaseAuthUser` (:588) + `maxDuration` ⇒ a serverless
TIMEOUT mid-scrub kills the function before the `catch` → row wedges at `status='processing'`, auth user
already deleted → user LOCKED OUT + erasure INCOMPLETE, recoverable only by manual DB surgery, NO alert
(no async processor exists). FIX (BINDING): (a) ALERT on `status='failed'` AND on `processing` rows older
than `maxDuration` (page/Sentry); (b) a RECOVERY actor — extend `cron/data-retention` (or a small admin
re-driver) to RETRY `failed` + RESET stale `processing` (the docstring already notes a crashed `processing`
"needs a manual status reset"); (c) ensure a normal account's scrub fits within `maxDuration`.

### 13.8 [MED→security] CSRF + step-up re-auth on a destructive irreversible op
(a) CSRF: defended ONLY by the implicit `@supabase/ssr` `sameSite:'lax'` cookie default (no explicit origin
check anywhere). Add an explicit `Origin`/`Sec-Fetch-Site: same-origin` check + regression test; method MUST
be DELETE/POST, NEVER GET (Lax sends cookies on top-level GET → deletion-by-link). (b) `confirm:'DELETE'` is
client-supplied, NOT a security control — require a FRESH re-auth (Supabase reauthentication / password, or
MFA re-check for enrolled accounts) before deletion; keep `confirm:'DELETE'` as UX friction only.

### 13.9 [MED→DC-16] Wiring ACTIVATES a false retention claim in the email — reword it (mandatory)
`accountDeletedEmail` banner (email.ts:735) says "retained for up to 30 days … before being permanently
removed" — contradicts the PINNED 7-year financial FAQ (compliance-honesty-regression.test.ts:273) and the
retained-forever anonymized rows. The stub sends nothing today; wiring makes it LIVE. FIX: reword the email
banner qualitatively (NO invented number) — e.g. "some records, including financial records required by law,
are retained; see the Privacy Policy." email.ts is editable. Do NOT touch the already-honest settings copy
(90d general + 7yr financial) or the pinned FAQ.

### 13.10 [MED→DC-16] Census the docs FAQ; record the "api_keys deleted"→"revoked" drift
docs/page.tsx:615/635 says "your API keys … are deleted" — but the cascade chunk changed api_keys to REVOKE
(kept). Wiring makes this user-visible. Add the docs FAQ to the DC-16 census; RECORD the "deleted"→"revoked"
drift as a seal residual (full reconciliation may defer). docs:607/652 "delete through the API" is RESOLVED
by this chunk creating the route — verify the route shape matches.

### 13.11 [LOW-MED→scope] Fold DC-19 (rate-limit keying) + tighten the limiter
Mirroring export's read-only `apiLimiter` (100/min) onto a destructive irreversible route is a DC-19
risk-profile mismatch (amplifies the double-submit race). Use a TIGHTER dedicated limiter (~3-5/min, like
`authLimiter`); keep the IP limit BEFORE `requireDeveloper`.

### 13.12 [LOW→DC-15] Re-derive the enable-runbook citations
The pre-commit shifts step-4's lines; `v-n3-erasure-enable-runbook-2026-06-20.md` cites step 4 at `:716-722`
(lines 37/42). Re-derive or convert to semantic anchors at build/seal.

### 13.13 Confirmed SOUND (no change): NO tier gate (GDPR Art.17; `data_deletion` feature doesn't exist,
wouldn't typecheck); self-scope on `auth.id` (DC-03 IDOR-safe — no body/path target, no GET); captured
`ids`/`toolIds` reuse is single-source (DC-07 holds); no deferred-work pull-in; `accountDeletedEmail(email)`
one-arg correct (deletion resultUrl not served — do not offer a download link).

### 13.14 Build sequencing (single chunk, internally ordered): prove the F-B1 BOTH-gate closure (the
forced-rollback non-vacuity test, §13.6) FIRST → then the endpoint (auth/self-scope/idempotency-reuse/
status-mapping/CSRF-origin/step-up-re-auth/dedicated-rate-limit/fail-mode-alerting) → then the UI wire
(real fetch + try/catch sign-out via `window.location.href='/login'` — `useRouter` not imported, use the
established `window.location` idiom; do NOT make a further authenticated call after success) + the email
reword. Do NOT split the chunk; do NOT build a job queue (none exists) or an admin surface.
