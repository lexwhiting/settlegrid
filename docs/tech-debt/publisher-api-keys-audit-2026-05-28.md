# Tech-Debt Register — Publisher API Keys (audit 2026-05-28)

> **Canonical, version-controlled record.** Produced by the manual 3-part audit
> chain run over the publisher-API-keys feature (commits `55d4c0f6..c2790860`).
> Future agents touching `api-keys` routes, `lib/rate-limit.ts`, `lib/crypto.ts`,
> or `lib/settlement/compliance.ts` should read this first.

## Status of the feature
**Shipped (code-complete, audited, locally committed; NOT pushed; migration `0013` NOT yet applied to prod).** tsc clean · 104 tests pass · eslint clean · `next build` passes. Two audit passes (sub-agent Phase-7 + manual 3-ring chain). Overall verdict: **PASS**.

## Already fixed (do NOT re-report)
- **One-time key data-loss** (was a BLOCKER): `Copy & Dismiss` now awaits `navigator.clipboard.writeText`, keeps the banner + offers an explicit Dismiss on failure. `settings/page.tsx`.
- Generate locked while an undismissed key is shown; `loadApiKeys` failure shows a distinct retry state (not a misleading empty list); revoke updates the row optimistically; one-time banner is `role="status"`. `settings/page.tsx`.
- Revoke email → `eventKey: 'api_key_revoked'` + `critical: true` (always-send security signal). `api-keys/[id]/route.ts`.
- Rate-limit IP parsing normalized to `.split(',')[0].trim()` (matches publish route). `api-keys/*`.
- Migration `0013` registered in `scripts/bootstrap__drizzle_migrations.sql`.
- GDPR deletion erases `developer_api_keys` rows in-transaction (anonymize-not-delete means the FK cascade never fires). `compliance.ts`.

## DEBT register (deferred — NOT blocking; ranked)

| # | Severity | Item | Location | Why deferred / fix sketch |
|---|---|---|---|---|
| 1 | **HIGH** (repo-wide) | Rate limiter fails on Redis outage (no fail-static/`ephemeralCache`) **and** keys on spoofable left-most `x-forwarded-for` | `apps/web/src/lib/rate-limit.ts` + **every** route handler | Not specific to this feature — the whole app shares `checkRateLimit`. Fix centrally: (a) `ephemeralCache: new Map()` or `tryRedis` wrap with explicit fail-closed `503`; (b) derive client IP from the platform-trusted value (Vercel) not raw XFF; (c) for authenticated routes, key on `auth.id` after auth. Do as a dedicated hardening PR across all routes. |
| 2 | LOW | Active-key cap (10) is a TOCTOU soft guard — concurrent POSTs can exceed it | `api-keys/route.ts` (`MAX_ACTIVE_KEYS` check) | Self-affecting only (a dev over-provisioning their own keys); not cross-tenant; bounded. Fix if desired: `db.transaction` + `SELECT … FOR UPDATE`, or a partial unique index. Comment already labels it "soft guard." |
| 3 | LOW (arch) | Unsalted shared SHA-256 keyspace across consumer (`sg_live_`) + publisher (`sg_pub_`) keys; no pepper/HMAC, no domain tag | `apps/web/src/lib/crypto.ts` (`hashApiKey`) | Negligible collision risk (256-bit), so not exploitable today. No defense-in-depth if DB disclosed. Fix: `HMAC-SHA256(serverPepper, "pub:"+key)` for new keys (needs dual-read/migration for existing). Affects consumer keys too. |
| 4 | LOW | Publish auth checks `rawKey.length >= 16` but not the `sg_pub_` prefix before hashing | `tools/publish/route.ts` (`authenticateDeveloperByApiKey`) | Hash lookup is the real gate (not a bypass). Optional fast-fail/clarity: assert prefix. |
| 5 | LOW (pre-existing) | `processDataDeletion` "Idempotent" docstring overstates — `status !== 'pending'` guard **throws** on re-run; consumer cross-anonymize uses the post-rewrite developer email | `compliance.ts` (`processDataDeletion`) | Pre-existing (not introduced here). Fix: treat `completed` as a success no-op; look up the consumer before rewriting the developer email. |
| 6 | NIT (pre-existing) | Bootstrap `created_at` non-monotonic for `0002–0007` | `scripts/bootstrap__drizzle_migrations.sql` | Harmless (migrator reads MAX only). Don't let future migrations depend on per-row ordering. |
| 7 | NIT | Unused `email` param in `publisherApiKeyCreated/RevokedEmail` (consistent w/ consumer templates) | `apps/web/src/lib/email.ts` | Optionally render "on the account associated with {email}" like `accountDeletedEmail`. |
| 8 | Gap | No client tests for the Settings UI section or the two publisher email templates | `settings/page.tsx`, `email.ts` (no test files) | Routes are well-tested; UI/email are not. Highest-value: clipboard-failure keeps key visible; `loadApiKeys` failure → retry state; email escapes a malicious `label` (XSS). |

## Notes
- Items **1, 5, 6** are pre-existing/repo-wide — they predate or are orthogonal to this feature; listed for completeness, owned by a future cross-cutting hardening pass, not by this feature.
- Items **2, 3, 4, 7, 8** are this-feature-adjacent but accepted as non-blocking for ship.
- Full audit reasoning is in the session transcript that produced commits `55d4c0f6..c2790860`.

## UPDATE 2026-06-07 — (C) chunk (see `c-revenuesharepct-reconciliation-resolution-2026-06-07.md`)

The legacy **`revenueSharePct` flat take model** reconciled and retired — reframed at Step-0 from "legacy
cleanup hygiene" to a **money-spine funds-correctness** fix (it had one LIVE divergent consumer). LOCAL
commit (NOT pushed); migration **generated NOT applied** (founder-gated).

- **Funds bug fixed (the centerpiece).** `lib/settlement/sessions.ts` `finalizeSession` deferred/atomic
  branch took a **flat 15% session fee** (live DB default 85) and credited the post-fee amount, then
  payout took **progressively on top** — a structural **double-take** vs the progressive payout model.
  Now sessions credit the **FULL** amount (`platformFeeCents: 0`); the single take happens once at payout
  (`calculateTakeCents`) — meter-parity. Re-derived math: a $60k/mo earner was double-taken ~1,023,000c,
  now a single 168,000c. **Latent today** (immediate-only sessions + unwired `processSettlementBatch` +
  dormant prod = no active loss), fixed before sessions carry real money. +2 new fail-pre-fix tests.
- **Dead `revenueSharePct` refs removed (behavior-neutral):** the meter free-tier overage block (a
  100→100 no-op feeding an already-ignored param, + its self-contained `dev-ops:` counter);
  meter-with-metadata + proxy (3 chains) dead selects + their now-orphaned `developers` joins
  (non-filtering: `tools.developerId` is `notNull().references`); the `recordInvocationAsync` legacy
  param; the auth/me + settings + email display refs (UI/email already on progressive copy).
- **Schema/DB drift resolved by DROP.** Schema said `.default(100)`; the only DDL (`0000`) had `DEFAULT
  85`, never ALTERed → live rows carried 85 (12×85, 3×95, 0×100), feeding no money math. NEW hand-written
  `drizzle/0014_drop_revenue_share_pct.sql` (`DROP COLUMN IF EXISTS`) + bootstrap hash row (sha256
  `e720ecaa…`); `schema.ts` + `seed-admin.ts` (typed insert) updated. **drizzle-kit `generate` is
  unusable** here (partial meta) — hand-written per the 0002-0013 convention. **Deploy-ordering:** ship
  with the current bundle, apply 0014 **after** deploy (expand/contract).
- **Gates:** pre-build R1 PLAN_NEEDS_FIXES (3 RED-gate blockers — unused-const eslint ×2 + a missed typed
  seed insert; all fixed + re-verified) → R2 **PLAN_READY / 0 blocking**; post-build **FUNDS-SEAL
  CERTIFIED / 0 blocking** incl. migration-safety + zero-out-of-spine-diff lenses. apps/web tsc 0 /
  vitest **4283** (4282 − 1 + 2) / build 0 / eslint 0; packages/mcp **1898/1** unchanged; zero
  `packages/sdk-python*` / pricing-rate / payout-logic / meter-credit / rate-limit / crypto hunks.

## UPDATE 2026-06-07 — (R) chunk (see `r-register-closeout-resolution-2026-06-07.md`)

The register's entire remaining **non-gated** tail, drained in one **zero-migration, zero-money-spine**
bundle. After this chunk the register holds only founder-gated items ((K) de-recommended, (A) BD-gated,
(H)+F1 demand-gated) plus the post-deploy (C) lead. LOCAL commit (NOT pushed).

- **DEBT #2 → RESOLVED (no migration).** The active-key cap (10) TOCTOU is closed: the cap count + key
  insert in `dashboard/developer/api-keys/route.ts` POST now run inside one `db.transaction` with the
  **developer row locked `SELECT … FOR UPDATE`** as the serializer (idiom per `lib/payouts/process.ts`;
  deadlock-free vs payouts/reconciler/GDPR-deletion, all of which lock the developer row first).
  Response contract byte-identical (422 `MAX_KEYS_EXCEEDED`; 201 shape). No column/index/migration.
  +1 structural regression test (proven failing pre-fix).
- **DEBT #4 → RESOLVED.** `tools/publish/route.ts` `authenticateDeveloperByApiKey` fast-fails a
  non-`sg_pub_` key **before** hashing (reads the now-exported `PUBLISHER_API_KEY_PREFIX` from
  `lib/crypto.ts`; `hashApiKey`/key formats untouched). Throws the **same** message as the hash-miss
  path → 401 byte-identical for every input class (clarity/fast-fail, not a security change). +2 tests
  (no-DB-query fast-fail proven failing pre-fix; positive companion).
- **DEBT #7 → RESOLVED.** `publisherApiKeyCreatedEmail` / `publisherApiKeyRevokedEmail` now render the
  escaped recipient (`the SettleGrid account associated with <strong>{escapeHtml(email)}</strong>`,
  mirroring `accountDeletedEmail`). +11 email tests (recipient render + escaped hostile recipient + the
  label-XSS guards that double as #8's email case).
- **DEBT #8 → RESOLVED (highest-value cases).** NEW client tests:
  `components/__tests__/api-key-reveal-dialog.test.tsx` (7) pins the clipboard-failure-keeps-key-visible
  guard + success-decoupled-from-dismiss; the email label-XSS guards live with #7's tests. **Residual
  (documented):** the page-level `loadApiKeys`-failure→retry case is not testable in this repo's idiom
  (vitest `node` env; no jsdom/@testing-library by standing decision; behavior exists + verified). The
  GET-failure server half is already route-tested.
- **F3 → RESOLVED.** Dead `requireApiKey` export + `AuthenticatedApiKey` interface + their unique
  imports removed from `lib/middleware/auth.ts`; the `proxy/[slug]:93` contrast comment reworded
  (comment-only; no proxy code). Zero remaining references (grep-proven).
- **DEBT #6 → documented-wontfix.** Bootstrap `created_at` non-monotonic — harmless (drizzle-kit reads
  `MAX` only); the per-row-ordering warning already lives in
  `apps/web/scripts/bootstrap__drizzle_migrations.sql` (header, lines 28-29). No code change.
- **F4's nevermined nit → CLOSED.** `compare/nevermined/data.ts` dropped the stale "at v0.1.0" (Python
  SDK is 0.2.0) → versionless phrasing; gating test stays green.
- **Gates:** pre-build R1 PLAN_NEEDS_FIXES (1 blocker — the dialog react-mock `ReferenceError` trap,
  caught + fixed) → R2 **PLAN_READY / 0 blocking**; post-build panel **CERTIFIED / 0 blocking** incl.
  the mandatory **ZERO-SPINE-DIFF** lens. apps/web tsc 0 / vitest **4282** (4261 + 21) / build 0 /
  eslint 0; packages/mcp **1898/1** unchanged; zero `packages/sdk-python*` / `drizzle/` / money-spine
  hunks. LOCAL commit (NOT pushed; no migration; no publish).

## UPDATE 2026-06-06 — (N) chunk (see `n-authid-keying-resolution-2026-06-06.md`)

- **DEBT #1 → FULLY CLOSED (all three sketch parts now shipped: a=H1 fail-open, b=M getClientIp,
  c=N auth.id keying).** Sub-part **#1c** — *"for authenticated routes, key on `auth.id` after auth"* —
  is now done: a post-auth, identity-keyed rate-limit layer added at **122 guard sites across 95
  session-authenticated route files** (the two-layer model: pre-auth IP limit untouched + post-auth
  per-user cap, each reusing the handler's existing limiter — `apiLimiter`, or `authLimiter` for
  `tools/claim`). D1 scope = session-auth routes only (rails / SDK / `proxy/[slug]` / `cron/*` OUT;
  `tools/[id]/health` excluded as optional-auth/anonymous-bypassable). Insert-only (sole modified line:
  the `auth/mfa` POST hoist+capture). Pre-build PLAN_READY (R1→R2, 0 blocking) → machine gates G1–G6 →
  post-build panel **PASS / 0 blocking / 0 findings** → certification **CERTIFIED / 0 defects**;
  apps/web tsc 0 / vitest **4256** / next build 0 / eslint 0; packages/mcp untouched 1896/1; local
  commit (NOT pushed). **Fixes** distributed-authenticated-abuser IP-rotation evasion + per-user
  accountability; **does NOT fix** shared-NAT collective throttling (the IP layer keeps its numbers →
  follow-up **F1**).
- **New tracked follow-ups (docs-only, opened by this chunk):**
  - **F1 (deferred)** — NAT-fairness IP-raise on session routes. Costed: new limiter export →
    ~84-test-file mock sweep + a deliberate flood-posture loosening. Do as its own chunk if NAT
    throttling is observed.
  - **F2 — RESOLVED 2026-06-06** (see `f2-sdk-meter-auth-resolution-2026-06-06.md`). The (F2) chunk
    authenticated the `sdk/meter` + `meter-with-metadata` metering call: it now requires the consumer API
    key as an `X-Api-Key` header, hashes it, looks up the active `api_keys` row, and **rejects** any
    `keyId`/`consumerId`/`toolId` not belonging to the presented key — *before any credit/record/revenue
    effect*. Closes the confirmed unauthenticated metering/credit-attribution gap AND the original narrow
    observation (the gate runs before the tiered limit, so `body.consumerId` is proven == the key's
    consumerId). TS SDK `@settlegrid/mcp` 0.2.0→0.3.0 sends the header. Pre-build R1→R2 PLAN_READY
    (0 blocking) → post-build funds-SEAL **CERTIFIED / 0 blocking / 0 findings**. apps/web tsc 0 / vitest
    **4261** / build 0; packages/mcp **1898/1** + tsup 0; GROSS-writer 1/1/1/5/0. LOCAL commit (NOT pushed).
  - **F3 (hygiene candidate)** — `lib/middleware/auth.ts:155 requireApiKey` has zero route callers (dead
    export; the `proxy/[slug]:93` comment references it as a contrast). Removal is a separate decision.
  - **F4 → RESOLVED 2026-06-06** (see `f4-python-sdk-meter-auth-resolution-2026-06-06.md`) — the
    **Python SDK family** (`packages/sdk-python` core + the 6 framework wrappers) now sends `X-Api-Key`
    on `/meter` (additive `extra_headers` on `_http.request*`, mirroring the TS `apiCall` design). The
    chunk ABSORBED two pre-handoff findings that made F4 bigger than registered: a **PHANTOM validate
    path** (`/api/sdk/keys/validate` never existed; real route `/validate-key` — the family had NEVER
    worked against the deployed server) and **response-model strictness** (`KeyValidationResult`
    rejected BOTH real validate shapes incl. failure-as-HTTP-200 `{valid:false,reason}`; `MeterResult`
    rejected 3 of 4 real meter shapes incl. the Redis fast path that omits `invocationId`). Core
    `settlegrid` 0.1.0→**0.2.0**; wrappers stay 0.1.0 (test-only edits). 18 new wire-contract tests
    (18/18 proven failing pre-fix); core 394 / wrappers 17/15/15/30/15/17; mypy+ruff clean. Pre-build
    audit R1 **PLAN_READY / 0 blocking** (one round — no blockers found) → post-build panel
    **CERTIFIED / 0 blocking / 0 findings** incl. the mandatory ZERO-SERVER-DIFF lens (zero `apps/web`
    / `packages/mcp` hunks; TS baselines byte-identical: tsc 0 / vitest 4261 / build 0 / mcp 1898+1 /
    tsup 0). Compat: new SDK works against BOTH server generations (validate-key pre-exists F2;
    pre-F2 meter ignores the extra header) → safe independent of the F2 deploy. LOCAL commit (NOT
    pushed; NO PyPI). The F2+F4 deploy/publish bundle is now founder-actionable.

    *Original entry (opened by F2 2026-06-06, founder-deferred): the family did NOT send `X-Api-Key`
    on `/meter` and would 401 at runtime against an F2-deployed server; safe to defer (0 live SDK
    traffic, 0 funded balances); do before any Python consumer onboards.*

## UPDATE 2026-06-05 — (M)+(E) chunk (see `m-getclientip-migration-resolution-2026-06-05.md`)

- **DEBT #1 → CLOSED.** The H1 follow-on shipped: all **208** inline `x-forwarded-for` rate-limit
  derivations migrated to the shared `getClientIp` helper (single source of truth; the three sentinels
  `'unknown'`/`'anonymous'`/`'unknown-ip'` unified to `'unknown-ip'` everywhere — incl. a now-corrected
  stale guard at `api-keys/route.ts:137`). + (E) `processDataExport` symmetric status guard. Pre-build
  PLAN_READY + post-build panel **PASS / 0 blocking**; apps/web tsc 0 / vitest 4250 / next build 0 /
  eslint 0; local commit (NOT pushed). The optional `auth.id` keying for authenticated routes is a
  SEPARATE, deliberately-deferred item (never part of DEBT #1's mechanical scope).

## UPDATE 2026-06-05 — H1 chunk (see `h1-rate-limit-availability-resolution-2026-06-05.md`)

- **DEBT #1 → PARTIALLY RESOLVED (surgical core shipped; follow-on documented).**
  Shipped: central store-failure fail-mode in `checkRateLimit` (fail-open + operator
  alert, founder-decided; optional `failMode:'closed'` hook) + the same guard on
  `checkTieredRateLimit`'s creation path; shared `getClientIp` helper (single source of
  truth); direct IP-keyed limits on the 3 genuinely-unprotected public routes
  (`tools/serve/[slug]`, `unsubscribe`, `mcp`). TWO of this row's premises were
  CORRECTED during grounding: (a) `ephemeralCache` is already ON by default in the
  installed `@upstash/ratelimit` v2.0.8 (the "add ephemeralCache" sketch is moot);
  (b) left-most XFF is NOT spoofable on Vercel — official docs: Vercel overwrites XFF
  and does not forward external IPs precisely to prevent spoofing (the "platform-trusted
  value" IS the left-most entry; sketch (b) as written would have been wrong).
  REMAINING (follow-on, not started): the ~218-caller `getClientIp` consistency
  migration + optional `auth.id` keying for authenticated routes (sketch (c)).
- **DEBT #5 → RESOLVED.** `processDataDeletion` now: `completed` → idempotent no-op;
  `failed` → retryable (atomicity proof in the capstone §3); `processing` → concurrency
  guard. The perennial baseline test fail is fixed (root cause: the settlement-moat
  schema mock omitted `developerApiKeys`, added by THIS feature's step 1b — the mock now
  carries it plus a `tx.delete`-count pin). The row's second sub-claim ("consumer
  cross-anonymize uses the post-rewrite developer email") was verified STALE/incorrect
  at current code: the developer email is captured PRE-transaction and step 2 uses that
  captured value — no fix needed.
