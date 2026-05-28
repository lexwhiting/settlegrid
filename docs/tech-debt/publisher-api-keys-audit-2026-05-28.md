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
