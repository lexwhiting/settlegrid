# gdpr-access-consumer-erase — ③ POST-SEAL DEEP AUDIT — 2026-07-02

> **Chunk:** `gdpr-access-consumer-erase` · **Closes:** G5-2 (Art.15/20 developer export un-paywalled) + G5-3 (consumer Art.17 erasure door). · **Tier:** HIGH-STAKES (③ warranted). · **Base:** `origin/main` = `0a28d9de`; sealed ② = `da9e2a84`.
> **Verdict: 🔧 RE-CERTIFIED (HARDENED).** One HIGH latent defect the diff-scoped ② review structurally could not see was found in the INTEGRATED WHOLE, live-reproduced, and closed in-scope (consumer door). Its deeper FROZEN-surface root is ESCALATED (below) — NOT code-closeable in this chunk.
> Scope = the integrated whole on the committed tree, distinct from ②'s diff scope. Seal record: `gdpr-access-consumer-erase-seal-record-2026-07-02.md`.

---

## 1. High-stakes confirmation (one line)
Warranted: a consumer DOOR onto the ③-certified `processDataDeletion` deletion cascade (PII / irreversible-erasure boundary; Art.15/17/20 legal-correctness; published /privacy + /pricing claims; academic $500 money path). ③ runs.

## 2. Mechanical pre-flight (clean run, cwd apps/web = web-ci) — handed to every reviewer
- `npx tsc -p tsconfig.json --noEmit` → **exit 0**
- `npm run lint` → **0 errors** (pre-existing warnings only)
- `npx vitest run` → **227 files / 5167 passed / 0 skip / 0 fail** (reproduced the sealed digest exactly)
- 10 invariants re-derived + a hostile-input battery (the shipped integration tests exercise CSRF·401·422·cross-identity-409·step-up-REAUTH, all pass). Full pre-flight: scratchpad `p3-preflight-gdpr.md`.

## 3. Fan-out — 5 lens-distinct reviewers @ xhigh + 1 collective-miss critic @ max (all `claude-opus-4-8[1m]`, Agent-tool spawns, Read/Grep-only; gate + all repros foreground main session)
Policy report-back: session switched to `/effort xhigh` before the 5-lens fan-out (operator-confirmed) and to `/effort max` before the collective-miss critic (operator-confirmed). Env traps unset (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL); no model pin. Path-1 pool absent → Agent-tool Path-2; allowlist GREEN (git/tsc/vitest/lint).

| Lens | Effort | Verdict |
|---|---|---|
| A core-invariant erase | xhigh | **1 HIGH (A-1)** + 1 MED (empty-email false-200) + 2 LOW; SEAM-β / F-3 / auth-orphan verified clean |
| B G5-2 un-gate scope + copy | xhigh | No un-gate seal-blocker; scope + pruned-imports CLEAN; 3 fast-follows (B1/B2/C1) |
| C SEAM / extraction / relink root | xhigh | Extraction byte-identical (git-verified); SEAM-α CONFIRMED but correctly deferred; invariants CLEAN |
| D literal-exec + test-teeth (DC-24) | xhigh | Doors sound; 4 load-bearing tests have genuine revert-RED teeth; MFA arm covered by the dev door's own test |
| E security boundary + completeness | xhigh | Boundary IDOR-safe / CSRF-sound / non-leaking / idempotent; sharpened relink + empty-email; academic "no new faucet" TRUE |
| **Collective-miss critic** | **max** | **YES — collective missed material scope:** corrected the A-1 fix shape (system-principal identity, not owns-tools; and it is a shared-root, not consumer-door-only) |

## 4. The one HIGH finding — A-1 — FIXED in-scope + live-reproduced (fail-then-pass)

**A-1 [HIGH] — over-erasure via NULL-link adoption of the SYSTEM catalog principal.** The crawler/scan system developer (`email 'system@settlegrid.com'`, `slug 'settlegrid-system'`, **NULL `supabaseUserId`**, created by `cron/crawl-registry|crawl-services` + `webhooks/github/scan-impl` `ensureSystemDeveloper`) **owns every crawled/unclaimed tool**. The ② cross-identity guard (`DeveloperTwinConflictError`, fires only on a **non-null DIFFERENT** link) treats a NULL link as "safe to adopt", so the consumer door's `resolveOrCreateDeveloperId` would relink + drive `processDataDeletion(systemDevId)` → the entire catalog scrubbed (tools → `status:'deleted'`, keys revoked, metadata nulled). Reachable by an auth user whose email is `system@settlegrid.com` — via the byEmail branch (FOLD-6 window) OR the bySupabase early-return after an `auth/callback` login-relink.

- **Live RED (shipped code, both paths):** the two new guard tests returned **200 — system developer adopted + its tool marked deleted** (`expect(409)` failed).
- **Fix (in-scope, NEW consumer door only — 2 files, no frozen surface):** `resolveOrCreateDeveloperId` now selects `email`+`slug` on BOTH resolution paths and throws a typed `SystemPrincipalDeletionError` when the resolved developer is the system principal (`isSystemPrincipal`: `email === SYSTEM_DEVELOPER_EMAIL || slug === SYSTEM_DEVELOPER_SLUG`); the door maps it to the safe **409 `ACCOUNT_RESOLUTION_CONFLICT`** (→ privacy@ manual runbook — the caller's OWN Art.17 erasure is still honored there) and logs `compliance.consumer_account_deletion.system_principal_blocked` for ops alerting. **Discriminator choice (per the max critic):** system-principal IDENTITY, NOT "owns tools" — an owns-tools guard would 409 a legitimate null-linked owns-tools developer's own erasure in the FOLD-6 window (violates the FOLD-2 never-block invariant). Identity is zero-false-positive (a real subject's row is never the system principal).
- **Live GREEN (after fix):** 409 / system developer + tool untouched / no auth-user delete. +2 DC-27 teeth (byEmail/FOLD-6 path + bySupabase/post-relink path) in the pglite integration test.

## 5. 🚨 ESCALATION (was: operator action / frozen surfaces) → ✅ REMEDIATED post-③ (operator-directed) — see §11

The consumer-door guard closes the surface THIS chunk introduced, but **A-1's root is a pre-existing FROZEN-surface vulnerability the ③ audit surfaced, and the in-scope guard does NOT close it:**

- **The DEV door shares the vector.** `auth/callback:154-159` **unconditionally** relinks a by-email-matched developer row (including the system principal) to any new auth user. After that login-relink, `requireDeveloper` resolves the system dev on the **developer** door (`DELETE /api/dashboard/developer/account`) too — a frozen surface. No consumer-door guard closes this.
- **It is a catalog-TAKEOVER primitive, not merely erasure.** An attacker relinked to the system principal owns every crawled tool → can mutate `proxyEndpoint` / pricing / payout routing with **no erasure at all** (superset of A-1, missed by the SEAM-α "erasure deep-fix" framing).
- **Reachability must NOT be discounted as "config-unreachable."** The precondition is a Supabase email-collision (email-confirmation disabled / an IdP asserting an unverified email so an attacker signs up as `system@settlegrid.com` with no mailbox). The codebase ITSELF treats this config as live: the academic route carries an `emailAutoConfirmSuspected` money-loss tripwire (`consumer/academic/route.ts:221`) budgeting for exactly it — for $500. Here the same misconfig risks the **whole catalog**, and neither erasure door nor the relink has any equivalent tripwire. **Operator: confirm `system@settlegrid.com` is a mailbox you control (the system dev is on `settlegrid.com`; operational domain is `settlegrid.ai`) AND that email-confirmation is ON in prod.**
- **Recommended complete fix (frozen — operator-authorized fast-follow / new launch-gate blocker):**
  1. **Chokepoint guard** — refuse the `settlegrid-system` principal inside `processDataDeletion` (compliance.ts). One place; covers ALL THREE callers (dev door, consumer door, cron re-driver) with zero false-positive (the system dev is never a data subject).
  2. **Guard the `auth/callback` relink** — do not unconditionally relink a substantive / system-slug row (closes the takeover primitive itself).
  3. Consider a `emailAutoConfirmSuspected`-style tripwire on the deletion doors.

## 6. Residual ledger (documented → fast-follow; none block the RE-CERTIFY)
1. **[MED, LOW-reach] Empty-email consumer under-erasure behind a false 200** (E-2 / A-2 / D-F5, sharpens ②-residual #1). `norm===''` ⇒ `consumerMatched=false` ⇒ the requester's OWN consumer row (PII + active API keys) is not scrubbed, yet the auth user is deleted and the door returns "your account has been deleted." Inherited from the pipeline's F-4 guard (both doors). Fast-follow: the door refuses an email-less erasure (route to privacy@) OR scrubs by `consumer.id`. *Deferred at ②; ③ sharpens the framing but does not pull deferred work in.*
2. **[HIGH-frozen] SEAM-α / ②-residual #8 framing correction** — the ② door guard is DEAD on the primary takeover→destroy path (the login-relink pre-empts it); do NOT represent it as closing the cross-identity issue. Superseded by §5 (A-1 is the same root with a larger blast radius).
3. **[MED] B1** Builder-tier "CSV export" false claim persists on `docs/page.tsx:442/594` + `llms.txt`/`llms-full.txt` (pre-existing; the copy pass left the narrative internally inconsistent).
4. **[MED] B2** dashboard "Data Export" card (`dashboard/page.tsx`) POSTs the GDPR endpoint + saves its JSON ack as `.csv` — a pre-existing card bug the un-gate makes **newly reachable at free tier** (403→200). Out-of-diff file; cosmetic (small JSON renamed .csv). Fast-follow: point the card at `stats/export` or the settings-page pattern.
5. **[LOW-MED] C1** free-tier storage amplification; the route comment "bounded by rate limits" overstates protection (no per-account export quota/TTL).
6. **[LOW] A-3** two consumer tables (`consumer_tool_balances`, `consumer_alerts`) absent from the deletion resultUrl census (retained-pseudonymous, not a direct-PII leak; frozen `compliance.ts`).
7. **[LOW] A-4 / D-F6** concurrent double-submit → duplicate account-deleted email (inherited; scrub idempotent, no corruption).
8. **[MED] E-3** MFA-unenroll → step-up downgrade AND the unenroll route (`api/auth/mfa` DELETE) itself lacks a CSRF check (`docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md` — recommended next chunk).
9. **[LOW] E-4** step-up brute-force backstop is an external ops co-requisite (GoTrue server-side MFA lockout); the local `authLimiter` is `failMode:'open'`. Ops-runbook assertion.
10. **[LOW] E-10 / D-F1** `signInWithPassword` unwrapped → raw 500 on the Art.17 path (fail-CLOSED, no leak; inherited byte-identical from the certified dev door).
11. **Academic $500 recycle** — genuinely live but PRE-EXISTING + equal-friction (no new faucet — VERIFIED by the critic on both the deletion and export sides); the erasure-surviving grant-hash key remains the operator-approved consumer-abuse fast-follow.

**Confirmed CLEAN by the critic (collective was complete here):** cross-door idempotency; FOLD-6 stranded-row-on-timeout; the free data-export leaks no consumer/foreign PII (developer-self-scoped); email/audit fan-out (invariant #10 holds); no other code-path NULL-linked owns-tools principal (seed tools attach to the linked founder row; seed `dev@acmecorp.io`-style rows are NULL-linked *consumers* owning no tools). **Ops caveat (not source-reproducible):** `internal-accounts.ts` records a prod audit found ~7/16 developers were seed/internal — if any manually-created prod dev row is null-linked, owns tools, AND has a registrable email, it is an additional A-1 target; worth an ops check.

## 7. Defect-class ledger update
- **NEW CLASS — DC-27 "over-erasure via NULL-link identity adoption"** (a self-serve deletion door adopts a NULL-linked shared/system principal and drives its irreversible erasure). Sibling to the ② cross-identity relink over-erasure (DC-24 instance) and the V-N3 erasure-completeness class. Guard = refuse to resolve a system/substantive principal as a deletion subject; durable form = a chokepoint guard in the deletion engine. Two revert-RED teeth added.
- **No new SEAM or LITERAL-EXECUTION recurrence in the shipped diff** (Lens C: extraction byte-clean, no invariant contradiction; Lens D: no paper-imperatives beyond the inherited fail-closed signInWithPassword). The SEAM manifests in a FROZEN adjacent surface (auth/callback relink) — escalated, not a diff defect.

## 8. Gate evidence (hardened tree, clean run, cwd apps/web = web-ci)
- `npx tsc -p tsconfig.json --noEmit` → **exit 0**
- `npm run lint` → **0 errors**
- `npx vitest run` → **exit 0 — 227 files / 5169 passed / 0 skip / 0 fail**
- Reconciliation: sealed 227 files / 5167 → ③ fix **+2 tests** (both DC-27 guard paths; same file, no new file) = **5169**. **NO migration.** Frozen/paid surfaces byte-untouched (compliance.ts, auth/callback, dev door, account-deletion.ts, schema, tier-config, stats/export).

## 9. Commit manifest (explicit pathspec — RE-CERTIFY)
```
apps/web/src/app/api/consumer/account/route.ts                          (A-1 system-principal guard)
apps/web/src/app/api/consumer/account/__tests__/route.integration.test.ts (+2 DC-27 revert-RED teeth)
docs/tech-debt/gdpr-access-consumer-erase-postseal-deepaudit-2026-07-02.md (this record)
```
EXCLUDE (pre-existing / gitignored / other chunks): `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-*`, `.claude/`, roadmap/queue, other chunks' docs.

## 10. Verdict
**🔧 RE-CERTIFIED (HARDENED).** The shipped ② diff is internally correct and correctly scoped (un-gate precise, extraction byte-identical, boundary sound). ③ found + closed one HIGH latent defect (A-1, DC-27) that ②'s diff scope structurally could not see, in-scope with a live fail-then-pass repro + teeth, touching no frozen surface. The deeper frozen-surface root (catalog-takeover via the `auth/callback` relink + the dev door) is ESCALATED (§5) as an operator/launch-gate item. Push remains gated on `/push-go`.

## 11. A-1 ROOT REMEDIATION (operator-directed, post-③ — 2026-07-02)
The operator authorized the escalated frozen-surface fix (chose "Implement Steps 1+3, then 2") and disclosed a fact that materially changed the risk framing:

**⚠ NEW FINDING (the pivot): `settlegrid.com` is a THIRD-PARTY domain the company does NOT own** — a live Gulf-region debt-settlement platform ("XoBot"). The company owns `settlegrid.ai`. The system catalog principal's email `system@settlegrid.com` is therefore an **attacker-obtainable mailbox on someone else's domain**. Consequences:
- A-1 is **not** misconfig-gated — its precondition (an auth user controlling the system principal's email) is **reachable under standard Supabase config** by anyone who can receive mail at `system@settlegrid.com`. This **confirms A-1 HIGH** (removes the "config-unreachable/LOW" mitigation the ③ writeup floated) and makes the root fix urgent, not deferrable.
- **Second finding (`internal-accounts.ts`):** `INTERNAL_EMAIL_DOMAINS` trusted `settlegrid.com` as an internal org domain → any `@settlegrid.com` signup was silently excluded from traction metrics (and would inherit trust once the planned `developers.isInternal` flag backfills from that list). A third-party-controlled domain must never be a trust anchor.

**Fixes landed (all guards key on the stable, company-owned SLUG `settlegrid-system`, so they protect the EXISTING prod row regardless of its current email):**
1. **`lib/system-principal.ts` (NEW, shared)** — single source for the system identity: `SYSTEM_DEVELOPER_{SLUG,EMAIL,NAME}` (EMAIL migrated to `system@settlegrid.ai`) + `isSystemPrincipal(row)` (slug-primary; matches new + legacy email as belt-and-suspenders until the prod row is migrated). Kills the duplicated-constant SEAM (§7 DC-27 / Lens-C).
2. **CHOKEPOINT guard in `processDataDeletion` (`compliance.ts`)** — refuses the system principal BEFORE any scrub (sets export `failed`, logs `compliance.data_deletion.system_principal_refused`). This is the DURABLE fix: it covers **all three callers** (consumer door, developer door, cron re-driver) — the consumer-door-only ③ guard could not.
3. **`auth/callback` relink guard (Step 2)** — the takeover-primitive root: the unconditional by-email relink now SKIPS + ALERTS (`auth.system_principal_relink_blocked`) when the by-email row is the system principal, so no login can ADOPT it (adoption = own every crawled tool's proxy/pricing/payout, a superset of the erasure vector).
4. **`internal-accounts.ts`** — removed `settlegrid.com` from `INTERNAL_EMAIL_DOMAINS`; the one legit internal account on that domain (the system principal) is now listed EXPLICITLY (`INTERNAL_DEVELOPER_EMAILS`) with a migrate-then-drop note.
5. **Refactor** — consumer door + the 3 crawl/scan routes (`cron/crawl-registry`, `cron/crawl-services`, `webhooks/github/scan-impl`) now import from `lib/system-principal`; FUTURE system rows are created with the safe `.ai` email.

**Teeth (live fail-then-pass):**
- **Chokepoint revert-RED** in `compliance-deletion-cascade.integration.test.ts` (pglite real-FK): guard neutralized → `processDataDeletion` returns `completed` and erases the system principal + its catalog (RED); guard restored → `failed`, principal + tool untouched (GREEN).
- **`system-principal.test.ts` (NEW)** — unit teeth on the discriminator (slug match; new + legacy + case-insensitive email; zero false-positive on real subjects; regression guard that `SYSTEM_DEVELOPER_EMAIL` is NOT on `settlegrid.com`).

**Gate (hardened tree, cwd apps/web):** `tsc` exit 0 · `lint` 0 errors · `vitest` **228 files / 5174 passed / 0 skip / 0 fail** (5169 → +1 chokepoint + 4 unit). **NO migration.**

**Commit manifest (explicit pathspec — A-1 root remediation, 10 files):**
```
apps/web/src/lib/system-principal.ts                                      (NEW — shared identity)
apps/web/src/lib/settlement/compliance.ts                                 (chokepoint guard)
apps/web/src/app/auth/callback/route.ts                                   (relink guard)
apps/web/src/lib/internal-accounts.ts                                     (drop settlegrid.com trust)
apps/web/src/app/api/consumer/account/route.ts                            (refactor → shared)
apps/web/src/app/api/cron/crawl-registry/route.ts                         (refactor → shared)
apps/web/src/app/api/cron/crawl-services/route.ts                         (refactor → shared)
apps/web/src/app/api/webhooks/github/scan-impl.ts                         (refactor → shared)
apps/web/src/lib/__tests__/compliance-deletion-cascade.integration.test.ts (+1 chokepoint revert-RED)
apps/web/src/lib/__tests__/system-principal.test.ts                       (NEW — unit teeth)
```

**REMAINING — operator / prod actions (NOT code-closeable):**
- **P1 — prod exploitation check (URGENT):** does a Supabase auth user exist with email `system@settlegrid.com`? Has the system developer row (`slug='settlegrid-system'`) been relinked (non-null `supabaseUserId`)? Is the crawled catalog intact (tool count sane, none `status='deleted'`)? The code guards stop FUTURE exploitation but cannot detect PAST adoption.
- **P2 — prod-data migration:** `UPDATE developers SET email='system@settlegrid.ai' WHERE slug='settlegrid-system'` — moves the existing row off the third-party domain, after which the legacy-email arm of `isSystemPrincipal` + the explicit `internal-accounts` entry can be dropped.
- **P3 — coverage gap (disclosed):** the `auth/callback` relink guard has NO integration test (no callback test harness exists in the repo); it is a simple skip keyed on the unit-tested `isSystemPrincipal`, and the load-bearing protection (erasure refusal) is the chokepoint, which IS tested. A callback harness is a fast-follow.
- **P4 — launch gate:** the third-party-domain exposure + prod checks warrant a launch-gate blocker entry.
