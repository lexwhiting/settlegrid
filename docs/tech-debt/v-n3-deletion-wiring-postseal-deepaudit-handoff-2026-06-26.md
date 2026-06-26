# ③ POST-SEAL DEEP-AUDIT HANDOFF — V-N3-deletion-wiring — 2026-06-26

**Tier: HIGH-STAKES → ③ warranted.** ② sealed clean (record:
`docs/tech-debt/v-n3-deletion-wiring-seal-record-2026-06-26.md`). This handoff scopes the post-seal deep
audit of the **integrated whole** — the now-LIVE GDPR self-service deletion flow under real callers +
concurrency + the recovery actor. The seal's hard moat (no PII escape, no fail-open, data fully erased,
self-scope sound) was CONFIRMED at `effort=maximum`; ③ goes after the residuals the seal consciously
deferred and anything the integrated system surfaces that a single-chunk lens could not.

## What shipped (the surface ③ audits)
`DELETE /api/dashboard/developer/account` (auth + self-scope + CSRF same-origin + step-up re-auth +
dedicated rate-limit) activates `processDataDeletion`, which pre-commits an F-B1 deactivation (revoke
api_keys for `consumerId∈ids` AND `toolId∈toolIds`, mark the subject's `tools.status='deleted'`) in its
OWN txn before the scrub txn. `cron/data-retention` re-drives `failed`/stale-`processing` deletions. The
settings UI wires a real fetch + a step-up password field + a sign-out redirect.

## 1. PRIMARY ③ TARGET — re-run disclosure under-disclosure (accepted MED at ②, DC-13/DC-16/DC-17)
**The defect.** `processDataDeletion` derives `consumerMatched` and `deletedAuthUser` from the LIVE
`developers` row every call (`dev.email` → matching-consumers query → `ids`; `supabaseUserIds`). A re-run
that observes an ALREADY-anonymized developer (email = `deleted-<id>@deleted.settlegrid.ai`) matches zero
consumers → `consumerMatched=false` (and likely `deletedAuthUser=false`) → the persisted `resultUrl` OMITS
every `consumerMatched`/`deletedAuthUser`-gated entry, including the `retainedUnscrubbed` foreign-tool
clause. That clause discloses pseudonymized linkage (`invocations.consumer_id/api_key_id/session_id/
referral_code` on OTHER developers' tools) that GENUINELY persists (revoke-not-delete keeps those rows).
So the re-run persists a record-of-processing that **under-discloses retained personal data** (DC-16), and
the non-idempotence is a re-run/status-machine defect the wiring activated (DC-13/DC-17).

**Reachability (why it's not just theoretical).**
- *Dual-row (realistic):* row A fails at an EARLY step (dev-lookup / twin-capture, BEFORE the irreversible
  auth-delete — so the user can still authenticate) → A=`failed`, dev pristine. User retries; find-or-reuse
  EXCLUDES `failed` (`ne(status,'failed')`) → creates row B → B reads the pristine dev → `consumerMatched=true`
  → completes with the CORRECT disclosure + anonymizes the dev. Later the daily cron re-drives leftover
  A=`failed` → A reads the NOW-anonymized dev → degraded disclosure persisted on A. Net: two `completed`
  rows for one developer; A under-discloses.
- *Single-row (rare):* a reused long-stranded `pending` row keeps an OLD `createdAt`; the endpoint flips it
  to `processing` and scrubs; the cron's staleness predicate keys on `createdAt` (not processing-start) →
  classifies the LIVE run stale → CAS-resets `processing`→`failed` (the CAS succeeds — it IS `processing`) →
  re-drives the SAME exportId concurrently → if the cron reads the dev after the endpoint committed step 1,
  the SOLE record is overwritten degraded. Astronomically rare (daily cron × ≤60s live window) but real.

**Why ② did not fix it.** The complete/robust fix touches the SEALED `processDataDeletion` disclosure logic
(a frozen surface this chunk was authorized to change ONLY for the F-B1 pre-commit + the §13.2A/§13.3
docstring-and-note honesty edits), and it introduces NEW idempotency semantics that deserve their own fresh
review — not a seal-time mechanical patch. ② FIX 4 (cron compare-and-set) closes only the `completed`→`failed`
revert sub-path, NOT this root. Operator consciously accepted + ledgered to ③.

**Candidate remedies for ③ to weigh (design + adversarially verify before applying — touches sealed logic):**
- (a) **Developer-level already-erased idempotency guard** in `processDataDeletion`: right after loading
  `dev`, if `dev.email === deleted-<developerId>@deleted.settlegrid.ai`, treat as idempotent-complete —
  do NOT re-run the scrub and do NOT overwrite the existing `resultUrl` (preserve the disclosure the run
  that actually erased the developer wrote). Cleanest root fix; must preserve/copy the authoritative
  disclosure (a `completed` row with a NULL `resultUrl` is its own honesty wart) and be proven idempotent.
- (b) **Stable-capture** of `consumerMatched`/`deletedAuthUser` (and the disclosure inputs) at request
  creation, persisted on the `compliance_exports` row, so a re-run reuses them instead of recomputing from
  the mutated dev. Larger schema/contract change.
- (c) **Cron-side reconciliation:** before re-driving a wedged row, skip if the same `entityId` already has
  a `completed` deletion sibling (closes the dual-row path in NEW code; does NOT close the single-row path,
  and leaves the duplicate row's record ambiguous). Smaller blast radius, partial.
- Also fold the related LOW: the `catch`-without-CAS at the `status='failed'` handler can flip a genuinely
  `completed` row to `failed` (add `ne(status,'completed')`), which otherwise re-feeds this same loop.
**Non-vacuity for ③:** the pglite harness can reproduce this directly — seed a dev + twin, run
`processDataDeletion` to completion (full disclosure), then run it AGAIN on a fresh export row for the
now-anonymized dev and assert the second `resultUrl` OMITS the foreign-tool clause (RED) → fix → GREEN.

## 2. OPERATOR DECISION ③ MUST RESOLVE — OAuth-only step-up (DC-03, self-disclosed §13.8b)
The step-up re-auth is implemented for password accounts (a throwaway `signInWithPassword` re-verify) but
**pure-OAuth accounts get NO fresh re-auth** — deletion proceeds on the ambient live session + CSRF
same-origin + typed `DELETE`. The build flagged this as a deferred enhancement. ③ must either (i) the
operator/founder consciously ACCEPTS the residual (an attacker needs a live same-origin session — the same
exposure as any sensitive action on a hijacked session), or (ii) ③ designs the OAuth re-consent redirect /
TOTP re-challenge step-up. This is a security-posture call on an irreversible op; do not let it stay
implicitly deferred.

## 3. LOW residuals routed to ③ (verify each against the integrated system; fix or consciously accept)
- **Recovery re-driver has ZERO test coverage** — the DC-08 safety net (reset stale `processing`, re-drive
  `failed`, idempotent re-run, cap) is unexercised. Add a pglite wedge+recover test (this also exercises the
  primary-target re-run path).
- **Daily-cron recovery latency** (`0 3 * * *`) → up to ~24h lockout-with-incomplete-erasure on a wedge.
  Eventually completes (not fail-open; within GDPR 30-day SLA). Weigh a more-frequent recovery tick.
- **Cron staleness keyed on `createdAt`** not processing-start — feeds the single-row primary-target path.
  Full fix = a `processingStartedAt`/`updatedAt` column (schema change).
- **Recovered-by-cron deletions skip** the user `accountDeletedEmail` + the `privacy.account_deletion_completed`
  audit row — a notification + GDPR-evidence gap for exactly the failure cases.
- **Poison-pill starvation:** permanently-`failed` (or non-`provider`) data-deletion rows are re-selected +
  re-alerted every cron run with no per-row attempt cap → >50 can starve `RECOVERY_CAP` (DC-09). Add an
  attempt counter / alert-on-Nth / terminal state.
- **True-concurrent double-submit** → N scrubs + N emails (§13.4-accepted; bounded by the 5/min uid limiter).
- **Rate-limiter fail-open** on Redis outage for the destructive endpoint (bounded by find-or-reuse + self-scope).
- **Step-up orphaned Supabase refresh token** + GoTrue sign-in-budget spend per attempt.
- **email closing line** "contact support within 30 days if a mistake" implies recoverability of an
  irreversible op (LOW DC-16; §13.9 scoped only the banner) — reword or consciously keep.
- Pre-existing **stale "90 days"** framings in settings/docs (not changed by this diff) — reconcile if cheap.

## 4. Frozen / confirmed-sound (③ should NOT re-litigate without cause)
- F-B1 BOTH-gate pre-commit design (api_key revoke + `tools.status='deleted'`) — CONFIRMED necessary +
  sufficient at source (SDK paths gate on `api_key.status`; proxy protocol/MPP/x402 sentinel-id paths gate
  ONLY on `tool.status==='active'` at `lookupToolBySlug` proxy:1225/:1498). `apiKeys.consumerId`/`toolId`
  NOT NULL → no null-consumerId escape.
- The ≤~90s in-flight residual bound is honest (proxy `maxDuration=90`; all insert paths capped ≤90s).
- `completed` set ONLY inside the scrub txn → no "success-while-data-remains" fail-open.
- Self-scope on `auth.id` (no body/path target); CSRF same-origin (DELETE-only, never GET); info-leak clean
  (no UUID / raw error / stack in any response body).
- The audit-IP/UA HIGH is FIXED (completion row carries no PII).

## 5. ③ method (recommended)
Integrated-whole audit. A `max` core-invariant lens already ran at ② on the fixed code (moat confirmed) —
③'s marginal value is (a) the primary-target re-run fix designed + adversarially verified, (b) the OAuth
decision, (c) a finder pass over the integrated recovery loop + concurrency that a single-chunk lens
under-weights, (d) the LOW residual sweep. A large integrated audit is a candidate for the **workflow** path
(off-context findings + schema-validated retry) — recommend opting in if ③ fans out wide.
