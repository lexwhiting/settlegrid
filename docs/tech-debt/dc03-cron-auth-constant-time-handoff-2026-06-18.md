# DC-03 — cron-auth constant-time compare + secret normalization — ① BUILD HANDOFF (2026-06-18)

> Standalone build handoff. READ THIS FIRST (step zero), before any code. The pre-build plan
> audit has CLOSED (4 lens reviewers — crypto · behavioral-equivalence · SEAM · literal-execution
> — all `claude-opus-4-8[1m]`, coverage mode, converged; findings folded below). The design here
> is the HARDENED design; build to it. Repo: `/Users/lex/settlegrid` (npm monorepo; gate from
> `apps/web`). Base = `main` @ `4e833519` (DC-18 pushed). `tools/page.tsx` is an unrelated
> uncommitted out-of-scope carry-forward — leave it untouched, EXCLUDE it at founder-close.

## 1. Intent — why this is built, who consumes it, what it enables
SettleGrid's ~32 cron/admin endpoints authenticate with a shared `CRON_SECRET` bearer token. The
check is copy-pasted inline as `if (authHeader !== \`Bearer ${cronSecret}\`)` at every site. Three
problems, all registered: **DC-03** — `!==` is a NON-constant-time string compare, a timing
side-channel on the bearer token (S-D15); **S-D17** — `getCronSecret()` does no whitespace
normalization, so an env value with a stray newline behaves inconsistently across callers; **a
DC-07 face** — the same security gate is drifted across ~32 sites (no single source of truth), so a
fix or audit must touch them all and they have quietly diverged (different log keys, some log
bad-token, some don't, 3 collapse no-secret into the 401).

**Consumer:** the Vercel cron scheduler (18 scheduled jobs incl. the money-rail crons
`settlement-reconcile` and `process-payouts`) which calls these endpoints with
`Authorization: Bearer $CRON_SECRET` (Vercel injects the raw env value); plus manual operator
triggers and a few admin/github/indexnow callers. **Enables:** a single hardened, constant-time,
whitespace-robust cron-auth primitive — closing the timing side-channel and the multi-surface
drift so future cron routes inherit the correct check instead of copy-pasting a vulnerable one.

## 2. Tier — HIGH-STAKES
Triggers: touches a SECURITY/AUTH boundary (the sole gate on ~32 endpoints, incl. money rails);
changes a GATE across many surfaces; the in-repo precedent (`github/scan`) already got the
constant-time compare WRONG (length-leak), so silent-wrong is demonstrated. ② re-confirms and may
re-tier. (The DIFF is focused, but the boundary it touches makes it high-stakes.)

## 3. Scope — MERGED chunk (one seam: the cron-auth gate)
Merge rationale: DC-03 (constant-time compare) + S-D17 (whitespace normalization) + the DC-07 face
(centralization) all act on the SAME primitive — the `CRON_SECRET` bearer check — and a single spec
states "done" for all three. The 32 sites (verified census; all read `getCronSecret`, all Node
runtime, all use `request.headers.get('authorization')` vs the full `Bearer <secret>` string, no
alt header/scheme/query-param, no middleware backstop — route-level is the SOLE gate):
- **28 cron `route.ts`:** `apps/web/src/app/api/cron/{abandoned-checkout, aggregate-usage,
  alert-check, anomaly-detection, claim-follow-up, claim-outreach, consumer-digest,
  consumer-schedules, crawl-registry, crawl-services, data-retention, ecosystem-metrics,
  expire-sessions, gas-balance-check, gridbot, health-checks, monitor-github-issues,
  monitor-github-repos, monitor-reddit, monitor-stackoverflow, monthly-summary, newsletter,
  onboarding-drip, process-payouts, quality-check, settlement-reconcile, webhook-retry,
  weekly-report}/route.ts`
- **4 non-cron:** `admin/setup-proxy-endpoints`, `admin/gridbot`, `github/scan`, `indexnow`.

**EXCLUDED / out of scope:** any non-CRON_SECRET auth (telemetry/kernel `KERNEL_TELEMETRY_AUTH_TOKEN`
fail-open-by-design; `/api/settlement/reconcile` `SETTLEGRID_ADMIN_KEY`; the gate middleware). Do
NOT touch `env.ts`'s crypto-free surface, edge routes (`og`/`opengraph-image`), `packages/mcp`, or
add deps/migrations. `tools/page.tsx` stays untouched + excluded.

## 4. The HARDENED design (build to THIS — the audit reshaped the naive version)
### 4a. New `apps/web/src/lib/cron-auth.ts` — ALL crypto lives HERE, never in `env.ts`
> SEAM-6: `env.ts` is imported by the **Edge** `middleware.ts`; `node:crypto` must NOT enter that
> import graph. Keep `getCronSecret()` RAW (do not edit it) and put trim + crypto in this new file.

```ts
import { timingSafeEqual, createHash } from 'node:crypto'
import { getCronSecret } from '@/lib/env'

// DC-11: cap the untrusted header BEFORE hashing. The cap is a CONSTANT — it leaks
// nothing about the secret (unlike a length-vs-secret pre-check). Platform header
// limits (~16KB) already bound this; the cap is explicit defense-in-depth.
const MAX_AUTH_HEADER_LEN = 4096

export type CronAuthResult = 'ok' | 'no-secret' | 'unauthorized'

// SHA-256 both operands to fixed 32-byte digests so timingSafeEqual never throws on a
// length mismatch (RangeError) AND the byte-length side-channel is gone. Plain SHA-256
// (NOT HMAC): used only to equalize length for a constant-time EQUALITY check, never as
// a MAC — do not "upgrade" this to HMAC.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** Constant-time CRON_SECRET bearer check. Returns an enum; the CALLER owns the
 *  response + logging (so each route preserves its existing contract). Never throws. */
export function verifyCronAuth(headers: Headers): CronAuthResult {
  const secret = getCronSecret()?.trim()
  if (!secret) return 'no-secret'                  // unset/empty/whitespace-only → fail-closed (DC-08)
  const raw = headers.get('authorization') ?? ''   // '' on missing header → 'unauthorized', never null→throw
  if (raw.length > MAX_AUTH_HEADER_LEN) return 'unauthorized'
  const authHeader = raw.trim()                    // SYMMETRIC trim (see LB note) — no Vercel lockout
  return safeEqual(authHeader, `Bearer ${secret}`) ? 'ok' : 'unauthorized'
}
```
- **Compare shape:** the FULL `Bearer <secret>` string (case-sensitive, single space) — do NOT
  inherit `telemetry/kernel`'s lenient token-slice/lowercase (SEAM-5). Matches Vercel's literal
  injection exactly.
- **`getCronSecret()` is NOT edited** — stays `return process.env.CRON_SECRET`. The trim lives in
  the helper. (This bounds blast radius: any non-migrated reader / existing `@/lib/env` test mock
  is unaffected; LE-02 + LE-01 + SEAM-6 all resolved by this.)

### 4b. Per-route refactor — VERBATIM preservation, NOT a uniform template
Replace ONLY the existing `if (!cronSecret) {…} if (authHeader !== \`Bearer ${cronSecret}\`) {…}`
block (or the collapsed single-line form) **in place** — never hoisted above a preceding step
(rate-limit on 30/32 sites, `getClientIp`, body-parse). Map the enum to **each route's EXACT
existing response + log, copied verbatim** (read each file; do NOT template-generate keys):

```ts
const auth = verifyCronAuth(request.headers)
if (auth === 'no-secret')    { /* the route's EXISTING no-secret branch, verbatim */ }
if (auth === 'unauthorized') { /* the route's EXISTING bad-token branch, verbatim */ }
// ...proceed
```
**Every branch MUST `return`** (LE-09 — a bare `errorResponse(...)` without `return` falls through
to the protected handler = fail-OPEN). The three site classes:

| Class | Sites | no-secret → | unauthorized → |
|---|---|---|---|
| **Separate-block (25)** | the bare cron routes | `logger.error('<EXACT existing key>.no_secret', <exact existing meta>)` **only if it logs today** + `return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')` | `return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')` — **NO log** (these are silent on bad-token today; do NOT add one) |
| **settlement-reconcile** | 1 | same 500 + `cron.settlement_reconcile.no_secret`{msg} | 401 **+ keep** `logger.error('cron.settlement_reconcile.unauthorized', { ip, userAgent: request.headers.get('user-agent') ?? null })` (TEST-PINNED — route.test.ts asserts it; `ip` from `getClientIp`) |
| **github/scan** | 1 | `logger.error('github.scan.no_cron_secret')` (NO meta arg) + `return errorResponse('Endpoint not configured', 500, 'CONFIG_ERROR')` (DIFFERENT message — preserve verbatim; UNTESTED → manual diff) | `return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')` |
| **indexnow** | 1 | `logger.error('indexnow.no_secret', {msg})` + 500 | 401 |
| **expire-sessions** | 1 | 500 with **NO log** (asymmetric — it has no no-secret log today) | 401 |
| **Collapsed (3)**: cron/gridbot, admin/gridbot, admin/setup-proxy-endpoints | 3 | `if (auth !== 'ok') return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')` — BOTH no-secret and unauthorized → the SINGLE 401, **NO 500, NO log** (preserve exact current behavior) | (same single 401) |

> The EXACT `no_secret` log keys diverge from the directory name (e.g.
> `cron.github_issues.no_secret`, `cron.github.no_secret`, `cron.reddit.no_secret`,
> `cron.stackoverflow.no_secret`, `cron.gas_balance.no_secret`, `cron.anomaly.no_secret`). CAPTURE
> EACH FROM THE FILE — never synthesize from the path (BE-2). Logging stays in the ROUTE; the helper
> never logs or builds a response (BE-5 / SEAM-2).

## 5. The two LOAD-BEARING decisions (where ② will concentrate — get these exactly right)
- **LB-1 — the constant-time compare must hash-to-fixed-length, never raw-buffer-compare.**
  `crypto.timingSafeEqual` THROWS `RangeError` on unequal-length buffers (probed). The in-repo
  precedent `github/scan/route.ts:64-68` "fixes" that with `authHeader.length !== expectedToken.length`
  — which RE-INTRODUCES a length side-channel. The SHA-256-both-sides→32-byte-digest pattern is the
  correct fix: never throws (so no 500-on-short-token regression, BE-4), no length leak. This chunk
  REPLACES the github/scan length-precheck with the helper. **Silently-wrong failure:** any
  length-vs-secret pre-check, or a raw-buffer `timingSafeEqual` that throws.
- **LB-2 — behavioral equivalence: the helper centralizes ONLY the compare; every route keeps its
  verbatim response + log + check order.** The naive "uniform template" would (a) add bad-token
  ERROR logs to ~28 silent routes (alert/page pollution), (b) mis-derive divergent `no_secret`
  keys, (c) flip the 3 collapsed routes' 401-on-unset to 500, (d) drop github/scan's distinct
  message + settlement-reconcile's test-pinned `{ip,userAgent}`. **Silently-wrong failure:** any
  observable drift in status / code / body message / log key / log fields / check ordering at any
  of the 32 sites.

### The trim is a SYMMETRIC, intentional behavior change — flag for ②
`getCronSecret()?.trim()` + `raw.trim()` makes the compare whitespace-insensitive on BOTH sides.
This is deliberate (closes S-D17) and AVOIDS the lockout that trimming the secret alone would cause
(Vercel injects the RAW env value; trimming only the expected side would 401 every cron if
`CRON_SECRET` has stray whitespace — LB1-TRIM-ASYMMETRY/SEAM-3, probed). Net effect: a correct
token with surrounding whitespace is now ACCEPTED where the old exact-match rejected it — a minor,
intentional broadening (whitespace is not secret entropy). PIN it with a test and FLAG it to ② as a
conscious behavior change, not a pure refactor. (If ② judges the broadening unwanted, the fallback
is: keep the constant-time compare, drop the trim, and validate `CRON_SECRET` whitespace at startup
instead — but the symmetric trim is the recommended design.)

## 6. Plan-audit findings folded (4 lenses, converged — cross-lens convergence = the verification)
| Finding (lens) | Disposition in this plan |
|---|---|
| Trim lockout (L1 LB1-TRIM-ASYMMETRY + L3 SEAM-3) | FIXED — symmetric trim in the helper; getCronSecret raw |
| Contract drift: added unauthorized logs / mis-derived keys / collapsed-route 401-vs-500 / github message / settlement `{ip,userAgent}` (L2 BE-1/2/6/7, L3 SEAM-1/2) | FIXED — verbatim per-route mapping table §4b; enum-only helper; logging in route |
| timingSafeEqual throws → 500 on short token (L2 BE-4) | FIXED — hashed-digest never throws (LB-1) |
| Fail-open if branch omits `return` (L4 LE-09) | FIXED — §4b mandates `return` + a regression test §7 |
| Unbounded header → sync SHA-256 (L1 DC-11) | FIXED — `MAX_AUTH_HEADER_LEN` cap |
| Test-double getCronSecret untrimmed (L4 LE-01, L3 SEAM-4, DC-05) | RESOLVED — trim is in the helper, not getCronSecret, so existing `@/lib/env` mocks stay valid; add a whitespace-secret test |
| node:crypto must not enter Edge graph (L3 SEAM-6) | FIXED — crypto only in cron-auth.ts; env.ts untouched |
| Compare shape (L3 SEAM-5) | FIXED — full `Bearer <secret>`, not token-slice |
| Plain SHA-256 vs HMAC, full-string compare, fail-closed (L1 info) | CONFIRMED sound — comment added "not a MAC" |

## 7. Test plan (the build adds these; existing tests must stay green = equivalence proof)
- **New `apps/web/src/lib/__tests__/cron-auth.test.ts`** (unit, real `node:crypto`): `ok` (exact
  token) · `unauthorized` (wrong token) · `no-secret` (unset) · empty-secret → no-secret ·
  whitespace-only secret → no-secret · **whitespace-PADDED secret authenticates after trim** (the
  S-D17 + no-lockout pin) · missing header → unauthorized (no throw) · wrong-LENGTH token →
  unauthorized (no throw — proves RangeError is gone) · over-`MAX_AUTH_HEADER_LEN` header →
  unauthorized.
- **Behavioral-equivalence (existing suites MUST stay green):** `cron-fail-closed.test.ts`
  (500/CONFIG_ERROR on unset for the routes it covers), `settlement-reconcile` route.test.ts (the
  `cron.settlement_reconcile.unauthorized` `{ip}` assertion), `process-payouts`, `gas-balance-check`,
  `abandoned-checkout`, `alert-check`, `webhook-retry`, `health-checks` route tests.
- **Fail-open regression (LE-09):** for one representative route, assert a `no-secret` AND a
  bad-token request never reach the handler body (the protected work is not invoked).
- **The 3 collapsed routes + github/scan are UNTESTED today** — add a minimal auth test for each
  (401 on unset + 401 on bad token; github/scan: 500 "Endpoint not configured" on unset), OR at
  minimum do a mandatory manual before/after diff of their auth block. State which you did.

## 8. Frozen / unchanged (assert, do not edit)
Every route's business logic, response status codes, error codes, body messages, log keys + fields,
and the ORDER of checks (rate-limit before auth on the 30 rate-limited routes; `getClientIp`;
`isGitHubAppConfigured`/body-parse AFTER auth on github/scan). `getCronSecret()` body (stays raw).
`env.ts` (no crypto import). `middleware.ts`. Edge routes. No new deps, no migration, no DB/KV.

## 9. Gate (re-run clean from `apps/web`; baseline at HEAD `4e833519`)
`cd apps/web && npx tsc --noEmit && npm run lint && npx vitest run` → tsc 0 · lint 0 err (8
pre-existing warns) · vitest **197 files / 4576 tests / 0 failed** + the net-new cron-auth pins.
Run from `apps/web`, NOT repo root (repo-root vitest fails collection on `@/lib/env`).

## 10. Lifecycle
scope-confirm ✓ → plan audit ✓ (this doc) → BUILD (fresh agent) → executable gate + interval
self-verify evidence → ② seal-gating review → seal + bookkeeping → founder-close → /push-go.
