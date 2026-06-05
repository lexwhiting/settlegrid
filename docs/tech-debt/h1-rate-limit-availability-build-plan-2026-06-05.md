# H1 — rate-limit availability hardening + processDataDeletion idempotency — BUILD PLAN (2026-06-05)

> Pre-build-audit-gated build plan. Read order: the post-B4 handoff
> (`next-chunk-handoff-2026-06-04-post-b4.md`) → THIS plan.
> Status: **DRAFT → pre-build audit pending.** No implementation code until the
> audit returns PLAN_READY (0 blocking) with all fixes applied.
> Chunk class: **OFF the funds spine** (no settlement/ledger/payout/pricing file is
> touched). Post-build gate is the **security/regression panel**, not a funds-SEAL.

---

## 1. Step-0 record (founder decisions, 2026-06-04) + verified ground truth

**Founder picked: (R) rate-limit availability hardening + (D) processDataDeletion
fix, BUNDLED** (publisher-keys DEBT #1 surgical core + DEBT #5), with fail-mode
policy: **fail-open + alert on ALL routes** (a `failMode` option hook ships so route
classes can flip to fail-closed later; no caller passes it in this chunk).

**Ground truth — every claim below re-verified live at `be43b501` (+ docs commit
`5fc24ee6`), 2026-06-04/05. The audit must re-verify each. Three handoff §3 claims
were CORRECTED during grounding — the corrections are part of the record:**

1. **The fail-mode gap is real (the core of (R)).**
   `apps/web/src/lib/rate-limit.ts:37` — `checkRateLimit` runs
   `await limiter.limit(identifier)` with **no try/catch**. `checkTieredRateLimit`
   (:115-131) funnels into `checkRateLimit` (:130) so one fix covers both — BUT its
   own direct `createRateLimiter` call (:126) sits OUTSIDE `checkRateLimit`'s body
   and can throw independently (see #3). ~211 non-test files / every rate-limited
   route depend on this single chokepoint.

2. **CORRECTION 1 — ephemeralCache is already ON.** The handoff's "no
   `ephemeralCache`" claim is FALSE at the installed `@upstash/ratelimit` v2.0.8:
   the package exports `RegionRatelimit as Ratelimit` (`dist/index.mjs:1836`), and
   the base-class constructor defaults `config.ephemeralCache === undefined` →
   `new Cache(new Map())` (`dist/index.js:782-784`). **Adding `ephemeralCache` is
   MOOT and is NOT in scope.** Note: the ephemeral cache only short-circuits
   identifiers already marked blocked; it is NOT an outage fallback.

3. **CORRECTION 2 — the throw window is narrower than the handoff implied, but
   real.** v2 races `limit()` against a built-in `timeout` (default 5000ms,
   `dist/index.js:766`) that resolves `{ success: true, …, reason: 'timeout' }`
   (`applyTimeout`, `dist/index.js` — a HANGING Redis already fails open after 5s).
   The unguarded path is the **rejection** path: connection refused / DNS / auth /
   Upstash 5xx rejects the raced promise → `limit()` throws → `checkRateLimit`
   propagates → the route 500s. Additionally `getRedis()` (`lib/redis.ts:6-16`) →
   `getRedisUrl()` = `requireEnv('REDIS_URL')` (`lib/env.ts:40-42`) **throws on
   missing env**; via the `lazyLimiter` Proxy (`rate-limit.ts:49-60`) that throw
   surfaces at the `.limit` property access — INSIDE `checkRateLimit`'s future try
   for pre-configured limiters, but at `:126` (outside it) for tiered limiters.
   In-repo precedent for the fix shape: `checkDemoRateLimit`
   (`lib/demo-rate-limit.ts:95-123`) — try/catch, structured log, synthetic
   success (fail-open), documented "anti-abuse, not auth".

4. **CORRECTION 3 — the "spoofable left-most XFF" claim is wrong for the deploy
   target.** Official Vercel docs (`vercel.com/docs/headers/request-headers`,
   fetched 2026-06-05): *"\[x-forwarded-for is\] The public IP address of the
   client that made the request. If you are trying to use Vercel behind a proxy,
   we currently overwrite the X-Forwarded-For header and **do not forward external
   IPs**. This restriction is in place to prevent IP spoofing."* (custom XFF
   passthrough = Enterprise "Trusted Proxy"; `x-real-ip` is documented
   "identical"). The in-repo P4.K1 trust model
   (`lib/demo-rate-limit.ts:51-72`, `extractClientIp`) is therefore CORRECT:
   left-most XFF + `x-real-ip` fallback + `'unknown-ip'` sentinel. The handoff's
   "rightmost-XFF / Vercel-trusted hop" fix direction would be WRONG on Vercel.
   Consequence: the shared helper is **consistency + portability hygiene, not an
   active-vulnerability fix**, and the ~218-caller migration is further
   deprioritized (documented follow-on, NOT this chunk). Call-site census at
   HEAD: 211 non-test files reference `x-forwarded-for` (94 lines split-style,
   rest whole-header/comments) — both styles resolve identically on Vercel.

5. **The 3 unprotected public routes are real.**
   - `api/tools/serve/[slug]/route.ts` — public by design (:7), GET+POST both
     funnel to `handle()` (:58, :126-132); executes `handlers[slug]` which call
     free external APIs / local compute (:8-9, :106); NO auth, NO rate limit
     (zero `rate-limit` imports). Unbounded compute + upstream-quota abuse.
   - `api/unsubscribe/route.ts` — public GET+POST; each call writes a
     **permanent, no-TTL Redis key** `unsub:outreach:<email>` (:23-24, :48);
     NO rate limit → unbounded permanent-key flood.
   - `api/mcp/route.ts` — POST/DELETE → `handleMcp` (:374-401), NO rate limit at
     its layer. **The handoff's "confirm inheritance" question is ANSWERED:
     inheritance is illusory.** Its `call_tool` fallback fetches
     `…/api/tools/serve/<slug>` internally (:229-235) — itself unprotected
     (nothing to inherit); its discovery tools fetch `…/api/v1/discover*`
     (rate-limited, `v1/discover/route.ts:49`) but server-side fetches arrive at
     the public edge with the **function egress IP** as the client IP, so ALL MCP
     users pool into one shared internal bucket. The mcp route needs its OWN
     direct limit; per-request it also does non-trivial work (fresh `McpServer` +
     transport + JSON-RPC parse) before any internal fetch.
   - Parentheticals verified: `cron/*` is CRON_SECRET fail-closed; `badge/*` +
     `developers/count` are cacheable GETs (`Cache-Control` present) — correctly
     out of scope.

6. **(D) is real and WORSE than the handoff stated.**
   `lib/settlement/compliance.ts:354-356` — `if (record.status !== 'pending')
   throw` — while the docstring (:333-335) CLAIMS idempotency. Consequences:
   (a) re-run after `completed` throws (handoff's claim); (b) a transiently
   `failed` run (catch at :516-524 sets `'failed'`) is **permanently wedged — no
   retry path** — on a GDPR Art. 17 flow with a statutory deadline; (c) a crashed
   `'processing'` run is equally wedged. **Failed-retry is provably SAFE to add:**
   all anonymization writes happen inside ONE `db.transaction` (:386-506) whose
   step 9 sets `status='completed'` INSIDE the txn (:484-505); the only statements
   between commit and return are `logger.info` + `return` (:508-515), which cannot
   throw in practice → `status='failed'` ⟹ the txn never committed ⟹ a retry sees
   pristine data. Pre-txn failures (dev lookup :368, toolIds :379) write nothing
   but the `'processing'` status flip.
   **Caller blast radius: ZERO.** `processDataDeletion` has no route/cron caller —
   only the barrel re-export (`lib/settlement/index.ts:32`); the data-export route
   calls `processDataExport` only. Semantics change affects tests + future callers.

7. **(D) test-failure root cause precisely diagnosed.** The known baseline fail
   (`settlement-moat.test.ts` → "processes a pending deletion and returns
   completed", expects `'completed'`, receives `'failed'`): the file's
   `vi.mock('@/lib/db/schema')` factory (:50-95) **omits `developerApiKeys`**
   (0 occurrences in the file), while the impl imports it (`compliance.ts:9`) and
   uses it in txn step 1b (:412-414, added by the publisher-keys chunk) —
   `eq(developerApiKeys.developerId, …)` reads `.developerId` off `undefined` →
   TypeError → caught (:516) → `'failed'`. One missing mock key.

8. **Baselines (run fresh this session, all matching the handoff):**
   apps/web `tsc` 0 · `vitest` **4222 pass / 1 fail** (the (D) fail) / 176 files ·
   `next build` 0 · packages/mcp **1896 pass / 1 skip**. No test anywhere expects
   `checkRateLimit` to throw (`rejects|toThrow` grep over `rate-limit.test.ts` +
   `tiered-rate-limit.test.ts`: zero hits) — the fail-open change is
   regression-safe at the test layer.

## 2. Scope — what ships (IN)

- **R1. Central fail-mode** in `lib/rate-limit.ts`: try/catch in `checkRateLimit`
  with founder-decided fail-open default + structured alert log + optional
  `failMode` hook; a creation-throw guard in `checkTieredRateLimit`.
- **R2. Shared trusted-IP helper**: promote the P4.K1 `extractClientIp` semantics
  to `getClientIp` in `lib/rate-limit.ts` (single source of truth + the
  Vercel-doc trust model); `demo-rate-limit.ts` delegates/re-exports (behavior
  byte-identical). Used by the 3 NEW route limits only.
- **R3. Direct rate limits on the 3 unprotected routes**:
  `tools/serve/[slug]` (sdkLimiter), `unsubscribe` (authLimiter, GET+POST),
  `mcp` (sdkLimiter, POST/DELETE via `handleMcp`).
- **D. `processDataDeletion`**: idempotent `completed` no-op + `failed` retry path
  + `processing` concurrency guard kept; docstring truth-restored; schema-mock fix
  + test rewrites/additions → the suite's perennial red goes GREEN.
- **Tests**: all offline (no live Redis/DB) — fail-mode units, tiered
  creation-throw unit, getClientIp delta units, 3 new route-limit test files,
  compliance test surgery.
- **Docs/registers (post-panel)**: capstone doc; debt-register updates (DEBT #1 →
  partially resolved, 218-caller migration recorded as the documented follow-on;
  DEBT #5 → closed); memory pointer. This plan committed alongside.

Net: **2 source lib files** (`rate-limit.ts` substantive; `demo-rate-limit.ts`
delegation-only), **3 route files** (one localized limit block each),
**1 settlement lib file** (`compliance.ts` — guard block + docstring ONLY; the
9-step anonymization body is untouched), **±7 test files** (3 new, 4 edited).
**NO migration. NO schema change. NO packages/mcp change. NO SDK rebuild.**

## 3. ⚠️ SCOPE GUARD (§6a — reject audit findings that grow scope)

**Byte-stable — do NOT modify:**
- The entire settlement spine: `lib/settlement/ledger.ts`, `reconcile.ts`,
  `payouts/process.ts`, `lib/pricing.ts`, the orchestrators
  (`x402/orchestrate.ts`, `circle-nano/settle.ts`), on-chain engines/verifiers,
  all 4 settlement writer call sites, `(from,nonce)` dedup,
  `developers.balanceCents` as the only authoritative balance, take model
  (`take_bps=0`), B4 semantic (`account_id` IS developer id). In
  `compliance.ts`: ONLY the :354-356 status-guard region + the function
  docstring change (the :346-352 not-found/wrong-type guards are preserved);
  **steps 1–9 of the anonymization transaction stay byte-identical**
  (financial-record retention list :500 included).
- `lib/rate-limit.ts` existing exports/signatures stay backward-compatible:
  `checkRateLimit` gains an OPTIONAL third param only (all ~218 two-arg callers
  compile unchanged); `createRateLimiter`, `lazyLimiter`, the three
  pre-configured limiters, `getTierLimits`, `TIER_LIMITS`, aliases — unchanged.
  NO limiter numbers are tuned (no new limiter configs; the 3 routes reuse
  `sdkLimiter`/`authLimiter`). The Upstash default `timeout` (5s) is NOT tuned.
- `demo-rate-limit.ts` behavior: `checkDemoRateLimit` untouched;
  `extractClientIp` resolves to byte-identical semantics (its 7 existing tests
  must pass UNEDITED).
- The 3 routes outside the inserted limit block: serve's health fast-path stays
  limit-free; mcp's OPTIONS (CORS preflight) and GET (static 405) stay
  limit-free; unsubscribe's validation/suppression logic untouched.

**Explicitly OUT of scope (deferred/documented, NOT this chunk):**
- The **~218-caller `getClientIp` migration** (THE scope-growth trap named by the
  handoff §6a) — documented follow-on; on Vercel both existing styles already
  resolve correctly (Ground truth #4).
- `badge/*` + `developers/count` limits (cacheable GETs); `cron/*`/`admin/*`
  (secret-gated); any unsubscribe TTL/HMAC-token redesign; per-handler upstream
  budgets on serve; Upstash `timeout`/`analytics` tuning; fail-closed adoption on
  any route (hook ships unused — founder decision);
  `processDataExport`'s identical `status!=='pending'` guard (:278 — symmetric
  wedge, **observed and recorded in the capstone, deliberately not chased**);
  recovery for crashed-`'processing'` deletions (manual runbook note);
  (A) ACP, (H) hop-route, (C) revenueSharePct (Step-0 non-picks).

**Any audit finding that adds the above is REJECT-with-rationale
(`severityFinal: 'rejected-scope-expansion'`), not auto-apply — unless it proves
a PLANNED change is itself wrong. Zero findings is a valid outcome.**

## 4. Change R1 — central fail-mode (`lib/rate-limit.ts`)

**R1a. `checkRateLimit` (replaces :33-45):**

```ts
export type RateLimitFailMode = 'open' | 'closed'

/**
 * Checks the rate limit for a given identifier.
 * Returns a normalized result object.
 *
 * Availability contract (H1, 2026-06-05): a rate-limit STORE failure must not
 * take the API down. The Upstash client already fails open on a HANGING store
 * (built-in 5s timeout race → success:true, reason:'timeout'); this guard
 * covers the REJECTION path (connection refused / DNS / auth / 5xx / missing
 * env via the lazy limiters). Default failMode 'open' (founder decision
 * 2026-06-04): log a structured operator alert and allow the request —
 * rate limiting here is anti-abuse, not authentication (same trust stance as
 * checkDemoRateLimit). Pass { failMode: 'closed' } for a route class where
 * blocking on store-failure is preferable (none do today; hook only).
 */
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string,
  options?: { failMode?: RateLimitFailMode }
): Promise<RateLimitResult> {
  const failMode = options?.failMode ?? 'open'
  try {
    const result = await limiter.limit(identifier)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (err) {
    logger.error(failMode === 'open' ? 'rate_limit.fail_open' : 'rate_limit.fail_closed', {
      identifier,
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: failMode === 'open', limit: 0, remaining: 0, reset: 0 }
  }
}
```

- New import: `import { logger } from './logger'` — no cycle (`logger.ts` imports
  only `@sentry/nextjs`; `demo-rate-limit.ts` already does the same pairing).
- Synthetic result `{limit:0, remaining:0, reset:0}` mirrors Upstash's own
  timeout-response convention (`reason:'timeout'` response shape) — callers that
  forward `x-ratelimit-*` headers degrade identically to the library's built-in
  fail-open.
- Log level **error** (not the demo's warn): this is the founder's "alert" —
  a store outage on the SHARED limiter is an operator incident; per-request
  emission during an outage is the signal, and `logger.error` is Sentry-wired.
- Event names mirror the demo precedent (`demo.rate_limit.fail_open`):
  `rate_limit.fail_open` / `rate_limit.fail_closed`. No identifier-content
  privacy issue: identifiers are `route:ip`-shaped, same as the demo's logged
  identifier.

**R1b. `checkTieredRateLimit` creation guard (edit :124-128 region):** the
`createRateLimiter(...)` call (:126) eagerly invokes `getRedis()` →
`requireEnv('REDIS_URL')` and can throw OUTSIDE `checkRateLimit`'s try. Wrap
exactly the creation:

```ts
  let limiter = tieredLimiterCache.get(cacheKey)
  if (!limiter) {
    try {
      limiter = createRateLimiter(requestsPerMin, '1 m')
    } catch (err) {
      logger.error('rate_limit.fail_open', {
        identifier,
        error: err instanceof Error ? err.message : String(err),
      })
      return { success: true, limit: 0, remaining: 0, reset: 0 }
    }
    tieredLimiterCache.set(cacheKey, limiter)
  }
  return checkRateLimit(limiter, identifier)
```

(Tiered routes are all api/sdk class = fail-open per the founder's decision;
no `failMode` plumbing added to the tiered path — YAGNI until a closed-class
tiered route exists.)

**Alternatives considered (recorded):** module-level wrapper fn (rejected —
touching 218 call sites is the named trap); Upstash `timeout` tuning (rejected —
out of scope, default 5s stands); fail-closed default (rejected by founder —
availability hole); two-arg overload keeping the old export + new fn (rejected —
optional param is strictly backward-compatible and keeps ONE chokepoint).

## 5. Change R2 — shared trusted-IP helper

**R2a. `lib/rate-limit.ts` — new export** (the P4.K1 semantics verbatim, now the
single source of truth; full trust-model docstring moves here):

```ts
/**
 * Best-effort client-IP extraction for rate-limit bucket keys.
 *
 * Trust model (verified against official Vercel docs, 2026-06-05 —
 * vercel.com/docs/headers/request-headers): Vercel OVERWRITES inbound
 * `x-forwarded-for` and "do[es] not forward external IPs … to prevent IP
 * spoofing", so on the deploy target the left-most entry IS the
 * edge-observed client IP and `x-real-ip` is documented identical. On a
 * non-Vercel host without that property a visitor could spoof the bucket
 * key — that degrades per-IP limiting to per-spoofed-IP limiting (still
 * anti-abuse); if this code ever moves off Vercel, revisit (see
 * docs/tech-debt/h1-* capstone).
 *
 * Returns 'unknown-ip' when neither header is usable — pooling anonymous
 * traffic into one conservative bucket.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first && first.length > 0) return first
  }
  const real = headers.get('x-real-ip')
  if (real && real.length > 0) return real.trim()
  return 'unknown-ip'
}
```

**R2b. `lib/demo-rate-limit.ts` — delegate** (behavior byte-identical; its 7
existing `extractClientIp` tests pass unedited):
- replace the `extractClientIp` function body/docstring with a pointer comment +
  `export { getClientIp as extractClientIp } from './rate-limit'`, and switch
  `checkDemoRateLimit`'s internal call to the imported `getClientIp` (add it to
  the existing `./rate-limit` import). Import direction demo→rate-limit already
  exists (:17) — no cycle.

**Applied at the 3 NEW call sites only** (§6). The repo-wide migration of ~218
existing callers is the documented follow-on (§3).

## 6. Change R3 — direct limits on the 3 routes

House style followed throughout: identifier `'<route-key>:' + ip`, existing
shared limiters, existing error helpers, 429 + code `RATE_LIMIT_EXCEEDED`.

**R3a. `api/tools/serve/[slug]/route.ts`** — in `handle()`, AFTER the health
fast-path (:62-70 — monitors stay limit-free; health does no handler work),
BEFORE the handler lookup (:73):

```ts
  const rl = await checkRateLimit(sdkLimiter, `tools-serve:${getClientIp(request.headers)}`)
  if (!rl.success) {
    return errorJson('Too many requests', 429)
  }
```

(+ imports `checkRateLimit, sdkLimiter, getClientIp` from `'@/lib/rate-limit'`.)
One choke point covers GET+POST (both delegate to `handle`). Limiter choice
**sdkLimiter (1000/min/IP)** — rationale: (i) it is the invocation-class limiter
(precedent: `sessions/[id]/hop` uses sdkLimiter for tool-call traffic);
(ii) the MCP server's `call_tool` fallback reaches this route via server-side
fetch where ALL MCP users share ONE egress-IP bucket — `apiLimiter` (100/min)
could starve legitimate aggregate MCP traffic; (iii) 1000/min/IP still converts
"unbounded" to "bounded" (≈16 rps/IP); per-handler upstream budgets are the
documented follow-on if a specific upstream needs tighter.

**R3b. `api/unsubscribe/route.ts`** — first statement inside BOTH handlers' `try`
(before any body parse / Redis write):

```ts
    const rl = await checkRateLimit(authLimiter, `unsubscribe:${getClientIp(request.headers)}`)
    if (!rl.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')
    }
```

Limiter choice **authLimiter (5/min/IP)** — strictest existing limiter; an
unsubscribe is a one-click action; this caps the permanent-no-TTL-key flood at
5 keys/min/IP without any new limiter config. Distinct bucket from auth routes
via the `unsubscribe:` identifier prefix (same limiter object ≠ same bucket).
Recorded trade-off: corporate mail-gateway link-scanners behind shared egress
IPs could burst past 5/min and see 429 on GET — acceptable (suppression is
idempotent; a re-click works; the email link remains valid), and preferable to
a new bespoke limiter config (scope).

**R3c. `api/mcp/route.ts`** — first statement of `handleMcp` (:382, covers
POST + DELETE), 429 as a JSON-RPC error with CORS headers (the route's GET-405
precedent shape :352-372):

```ts
  const rl = await checkRateLimit(sdkLimiter, `mcp:${getClientIp(request.headers)}`)
  if (!rl.success) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Too many requests' },
        id: null,
      }),
      { status: 429, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    )
  }
```

`OPTIONS` (CORS preflight, :333-335) and `GET` (static 405 JSON-RPC error, no
work performed, :352-372) deliberately stay limit-free — limiting them would
spend a Redis round-trip to protect zero compute and could break CORS preflight.
sdkLimiter (1000/min/IP): MCP clients legitimately batch tool calls; the
per-request work this bounds is server/transport construction + internal
fetches (whose targets keep their own limits).

## 7. Change D — `processDataDeletion` idempotency (`lib/settlement/compliance.ts`)

**D1. Impl — replace ONLY the :354-356 guard (the 9-step txn body is untouched):**

```ts
  if (record.status === 'completed') {
    // H1: idempotent no-op — the deletion already ran to completion.
    // Re-runs must not throw (GDPR Art. 17 processors retry).
    logger.info('compliance.data_deletion_already_completed', { exportId })
    return { status: 'completed' }
  }

  if (record.status === 'processing') {
    // Concurrency guard: another run is (or appears to be) in flight.
    // A run that crashed mid-flight needs a manual status reset — see the
    // H1 capstone runbook note.
    throw new Error(`Deletion already in progress: ${exportId}`)
  }

  // 'pending' (first run) and 'failed' (retry) both proceed. Retry safety:
  // all anonymization writes commit atomically in the transaction below and
  // 'completed' is set INSIDE it, so status 'failed' ⟹ the transaction never
  // committed ⟹ this retry sees pristine data.
```

**D2. Docstring (:327-336)** — replace the false "Idempotent: …" paragraph with
the real status machine: `pending → processing → completed | failed`;
`completed` re-run = no-op; `failed` = retryable; `processing` = guarded.
Financial-record retention statement (:330-331) kept verbatim.

**D3. `settlement-moat.test.ts` surgery:**
- **Root-cause fix:** add `developerApiKeys: { id: 'id', developerId:
  'developer_id' }` to the `@/lib/db/schema` mock factory — the happy-path test
  then passes as-written (Ground truth #7).
- **Strengthen the happy path:** hoist `txChain` so the test can assert
  `txChain.delete` called twice (`developer_api_keys` step 1b + `webhook_endpoints`
  step 6) — pinning step 1b so the mock can't silently drift again.
- **REWRITE (forced):** `'throws when deletion already processed'` (:721-729 —
  expects the OLD throw on `completed`) → `'returns completed as an idempotent
  no-op when already completed'`: same fixture, expect
  `{ status: 'completed' }`, assert `mockDbUpdate` NOT called (no `processing`
  flip on the no-op path).
- **NEW:** `'retries a failed deletion to completion'` — happy-path mock rig with
  fixture `status: 'failed'` → expect `{ status: 'completed' }`.
- **NEW:** `'throws when a deletion is already in progress'` — fixture
  `status: 'processing'` → `rejects.toThrow('already in progress')`.
- Existing `'throws when deletion not found'` (:705) and `'throws when record
  is not a data-deletion type'` (:711) tests pass unchanged (the :346-352
  guards above the edit are untouched).

## 8. Forced test edits — completeness statement

A literal follow of §§4-7 yields GREEN suites in BOTH packages:

| File | Action |
|---|---|
| `lib/__tests__/rate-limit.test.ts` | EXTEND: add `vi.mock('@/lib/logger')`; new tests — limiter rejects → fail-open `{success:true,limit:0,remaining:0,reset:0}` + `rate_limit.fail_open` logged; `{failMode:'closed'}` → `success:false` + `rate_limit.fail_closed`; success path returns real result un-altered (existing shape tests already cover; they keep passing — the shared module mock's `limit` resolves by default). `getClientIp` delta units: IPv6 entry, comma-only XFF→x-real-ip fallback ordering (the 7 P4.K1 cases stay in demo-rate-limit.test.ts, unedited, via the re-export). |
| `lib/__tests__/tiered-rate-limit.test.ts` | EXTEND: creation-throw test. The file today imports ONLY `getTierLimits` and mocks ONLY `@/lib/redis` — the new test must ADD `import { checkTieredRateLimit }`, `vi.mock('@/lib/logger')` (sibling-row pattern), and a throw-injection: `mockImplementationOnce` on the existing `getRedis` mock (valid — `createRateLimiter` evaluates `getRedis()` eagerly) or a throwing `@upstash/ratelimit` constructor mock → expect fail-open result + `rate_limit.fail_open` logged. Existing `getTierLimits` tests unaffected. |
| `lib/__tests__/demo-rate-limit.test.ts` | **ZERO edits** (the §3 guard: re-export keeps all 7 `extractClientIp` tests + `checkDemoRateLimit` tests green). |
| `app/api/tools/serve/[slug]/__tests__/route.test.ts` | NEW: mock `@/lib/rate-limit` (`checkRateLimit` controllable, `sdkLimiter` stub, `getClientIp` real-or-stub); limited → 429 `{error:'Too many requests'}`; allowed → handler executes; **health query bypasses the limiter** (checkRateLimit NOT called); identifier prefix `tools-serve:` pinned. Mock `./handlers` with a test slug. Mock `@/lib/redis` `tryRedis` (tracking no-ops). |
| `app/api/unsubscribe/__tests__/route.test.ts` | NEW: mock `@/lib/rate-limit` + `@/lib/redis` + `@/lib/logger`; GET and POST limited → 429 code `RATE_LIMIT_EXCEEDED` and **no Redis `set`**; allowed → suppression key written (existing behavior pinned); identifier prefix `unsubscribe:` pinned. |
| `app/api/mcp/__tests__/route.test.ts` | NEW: mock `@/lib/rate-limit`; POST limited → 429 JSON-RPC error body + CORS headers present; OPTIONS → 204 with **checkRateLimit NOT called**; GET → 405 with **checkRateLimit NOT called**. (Allowed-path POST through the real MCP SDK transport is NOT exercised — heavyweight; the limited-path + bypass pins are the route's contract under test. If the SDK import chain breaks vitest collection even when the limited path short-circuits first, mock `@modelcontextprotocol/sdk/*` modules wholesale.) |
| `lib/__tests__/settlement-moat.test.ts` | §7-D3 (root-cause mock key + happy-path pin + 1 rewrite + 2 new). |

- No other suite mocks or pins `checkRateLimit`'s arity/behavior in a way the
  optional third param breaks (route tests that `vi.mock('@/lib/rate-limit')`
  replace the module wholesale; the real function's signature change is additive).
  The audit must re-verify with `rg "checkRateLimit" apps/web/src --glob '**/__tests__/**'`.
- No suite asserts on the absence of `rate_limit.*` log events.
- packages/mcp: untouched, no SDK rebuild (run anyway per handoff §1: expect
  1896/1 skip).
- Expected post-change: apps/web **0 failed** / ≥4235 pass (4222 existing-pass
  + 1 converted fail + ~12-17 new) / 179 files (176 + 3 new); exact counts
  recorded at §10 time. **The known pre-existing fail is GONE — full green.**

## 9. No-regression invariants (correctness lens for an off-funds chunk)

- **No legitimate caller is newly limited:** the ONLY behavioral deltas for
  existing routes are in the STORE-FAILURE path (previously: throw→500; now:
  allow+alert). Success and limited paths return byte-identical results
  (`.limit()` result mapping unchanged). The 3 new limits gate previously
  UNLIMITED public routes at 1000/min/IP (serve, mcp) and 5/min/IP
  (unsubscribe) — generous vs. any legitimate single-client pattern, justified
  in §6.
- **Fail-open is not an abuse hole beyond its design:** it converts "Redis
  outage = full API outage (500s)" into "Redis outage = brief unlimited window
  with per-request operator alerts" — the founder-chosen posture; the Upstash
  client already had exactly this posture for the HANG case (5s timeout race),
  so the patched behavior is consistent rather than novel. Fail-closed hook
  exists for future sensitive classes.
- **No route loses protection:** no existing `checkRateLimit` call is removed or
  re-keyed; tiered limits unchanged; demo limiter unchanged.
- **No funds-spine file is touched** except `compliance.ts`'s :354-356
  status-guard + docstring — and that function moves no money (anonymization
  only; financial tables are in the RETAINED list :500, byte-stable).
  `git diff --stat` at panel time must show NO other `lib/settlement/*` file.
- **Idempotency + retention:** (D) makes `completed` re-runs no-ops and `failed`
  retryable with the §7 atomicity proof; retained-records list untouched.
- **CORS/preflight intact:** mcp OPTIONS unlimited; unsubscribe/serve responses
  keep their existing header shapes (only a new 429 branch added).
- **Privacy:** new logs carry `route:ip` identifiers (existing practice — demo
  limiter logs the same shape) and error messages; no email/PII added to logs
  (unsubscribe's masked-email logging untouched).

## 10. Verification gates (handoff §9)

`cd apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (**0 failed** — (D)
clears the known fail; ≥4233 pass) · `npx eslint <changed files>` (0) ·
`npx next build` (0; NOT concurrent with tsc). PLUS `cd packages/mcp && npx
vitest run` (1896/1 skip — untouched). No migration to generate or lint. No SDK
rebuild ((A) was not picked).

## 11. Post-build gate — security/regression panel (handoff §7, off-funds shape)

Adapt `.audit/b4-postbuild/seal-panel.mjs` → `.audit/h1-postbuild/` with lenses:
(a) does any legitimate caller now get wrongly limited (trace the 3 new gates +
the fail-open mapping); (b) does the fail-mode open an abuse hole (limits
silently disabled on a healthy store?) or an availability hole (any path where
the catch can't fire / re-throws); (c) does any route lose or weaken existing
protection (diff-audit all `checkRateLimit` call sites); (d) does `getClientIp`
mishandle proxy chains / IPv6 / missing-garbage headers, and is the Vercel
trust-model claim correctly cited; (e) is the deletion truly idempotent +
retry-safe with financial retention intact; (f) **scope-regression**: `git diff`
confined to the §2 file list; byte-stable surfaces (§3) untouched. Verdict
**PASS / 0 blocking** before the founder-gated, path-scoped LOCAL commit
(no push, no prod env, no migrations).
