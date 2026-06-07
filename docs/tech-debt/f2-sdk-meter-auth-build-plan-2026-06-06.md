# (F2) `sdk/meter` authentication + consumer-key binding — BUILD PLAN (2026-06-06)

> **STATUS: PLAN_READY** — Phase-3 pre-build audit R2 (run `wf_dd1ff8d9-6cb`) returned PLAN_READY / 0
> blocking / full coverage (0 dead lenses, 0 null verdicts); R1→R2 chain + 2 non-blocking §7 polish fixes
> applied (v3). Implementation authorized. Derived from `f2-sdk-meter-trace-2026-06-06.md` (read it first).
> Real-money surface → single-writer build, line-surgical, money semantics byte-stable.

## 1. Goal + honest value framing
Close the **only confirmed non-theoretical security defect** left: `POST /api/sdk/meter` (and its twin
`/api/sdk/meter-with-metadata`) act on a fully client-supplied `{consumerId,toolId,keyId,costCents}` with
**no authentication**, so an unauthenticated caller past the IP limit can deduct credits from / attribute
usage to / accrue developer revenue for arbitrary accounts. Fix = require the presented API key, resolve
it to its `api_keys` row, and **bind** the body's `keyId/consumerId/toolId` to that row **before any
effect**. Honest framing: impact is currently **bounded by dormancy** (0 funded balances, 0 live SDK
traffic) — this is hardening done in the safe window *before* real money flows, not an active-incident
fix. The fix only **gates** the existing flow; it changes **no** money math.

## 2. Trust-model conclusion (from the trace)
Untrusted-reachable (CORS `*`, IP-limit only). The raw key is **not** sent by either SDK today, and
`keyId` is a non-secret UUID → **a server-only fix is impossible; the TS SDK must send the key.** Founder
decision: **server + TS SDK now**; Python SDK family = documented immediate follow-up.

## 3. Fix design
**Transport:** `X-Api-Key` request header (rationale in trace §Transport). **Placement:** immediately
after `parseBody`, before any DB read/mutation (preserves the smoke-S17 422 for malformed bodies).
**Auth+binding block (IDENTICAL in both meter routes):**
```ts
// ── Authenticate + bind: require the presented API key and verify it owns the
//    (consumerId, toolId, keyId) the body claims, BEFORE any billing effect. ──
const rawKey = request.headers.get('x-api-key')
if (!rawKey || rawKey.length < 16) {
  return errorResponse('API key required. Provide x-api-key header.', 401, 'API_KEY_REQUIRED')
}
const [keyRow] = await db
  .select({
    id: apiKeys.id,
    consumerId: apiKeys.consumerId,
    toolId: apiKeys.toolId,
    status: apiKeys.status,
  })
  .from(apiKeys)
  .where(eq(apiKeys.keyHash, hashApiKey(rawKey)))
  .limit(1)
if (!keyRow || keyRow.status !== 'active') {
  return errorResponse('Invalid API key.', 401, 'INVALID_API_KEY')
}
if (
  keyRow.id !== body.keyId ||
  keyRow.consumerId !== body.consumerId ||
  keyRow.toolId !== body.toolId
) {
  // Single generic 403 — does NOT leak which field mismatched (handoff §1 Q4).
  return errorResponse('API key does not match the request.', 403, 'KEY_BINDING_MISMATCH')
}
```
After this gate, `body.keyId/consumerId/toolId` are proven `===` the authenticated row, so **every
downstream line stays byte-identical** (it keeps reading `body.*`, now provably equal to the key's
identity). Adapts the auth pattern of `proxy/[slug]:121-185` — a missing **or** malformed (`<16`) key
both return one `401 API_KEY_REQUIRED` (collapsed vs proxy's two 401 sub-codes; behaviorally identical
since the SDK maps any 401 → `InvalidKeyError`, `middleware.ts:202-204`, and no test asserts the short-key
code on meter). One added indexed SELECT on the hot path (same cost as proxy).

**SDK (TS):** thread the raw key (already in scope at every callsite) onto the meter HTTP call as an
`X-Api-Key` header via a small additive `extraHeaders` param on the generic `apiCall`.

## 4. Exact edit sites + per-file recipe (single-writer)

### Server — `apps/web`
1. **`src/app/api/sdk/meter/route.ts`**
   - Add import: `import { hashApiKey } from '@/lib/crypto'` (`apiKeys`, `eq`, `db`, `errorResponse`
     already imported).
   - Insert the auth+binding block **after** `const body = await parseBody(request, meterSchema)`
     (current `:56`), before the tool+dev lookup. Nothing else changes.
2. **`src/app/api/sdk/meter-with-metadata/route.ts`**
   - Add `apiKeys` to the `@/lib/db/schema` import (`:5`); add `import { hashApiKey } from '@/lib/crypto'`.
   - Insert the **same** auth+binding block after `const body = await parseBody(request,
     meterWithMetadataSchema)` (current `:35`).
3. **`src/app/api/openapi.json/route.ts`** — for `/api/sdk/meter` (`:62`) add a `parameters` entry
   documenting the required `X-Api-Key` header + a `401` response. (Doc honesty; `openapi.test.ts:48`
   only asserts the path exists → safe.)

### SDK — `packages/mcp` (TS only)
4. **`src/middleware.ts`**
   - `apiCall<T>(config, path, body, resilience?)` → add `extraHeaders?: Record<string, string>`;
     change the fetch headers to `{ 'Content-Type': 'application/json', ...(extraHeaders ?? {}) }`.
   - `async function meter(context: InvocationContext)` → `(context: InvocationContext, apiKey: string)`;
     pass `{ 'X-Api-Key': apiKey }` as the new 5th arg to `apiCall<MeterResponse>(…)`.
   - `execute`: update the two meter callsites (`:543` `await meter(context, apiKey)`, `:547`
     `meter(context, apiKey).catch(()=>{})`). `apiKey` is the `execute` param.
5. **`src/index.ts`** — `sg.meter` callsite (`:517`) → `middleware.meter({…}, apiKey)` (`apiKey` is the
   `meter(apiKey, method)` param). Bump `SDK_VERSION` `'0.2.0'` → `'0.3.0'`.
6. **`src/kernel.ts`** — meter callsite (`:621`) → `middleware.meter({…}, apiKey)` (`apiKey` =
   `ctx.identity.value`, `:571`).
7. **`package.json`** — `version` `0.2.0` → `0.3.0`. **`CHANGELOG.md`** — add a `0.3.0` entry (meter now
   authenticates via `X-Api-Key`; requires server with F2; note the breaking server coupling).
8. **`src/__tests__/sdk-validation.test.ts`** — REQUIRED forced edit (the version bump is a hard-pinned
   assertion; audit R1 empirically proved exactly 2 failures here): `:54` `expect(settlegrid.version)
   .toBe('0.2.0')` → `'0.3.0'`; `:80` `expect(SDK_VERSION).toBe('0.2.0')` → `'0.3.0'`; `:79` test title
   `(0.2.0)` → `(0.3.0)`. **Do NOT touch** `telemetry.test.ts` (input/echo, never imports the constant)
   or `exports.test.ts:25` (semver regex `/^\d+\.\d+\.\d+$/`) — both stay green at `0.3.0` and are not
   version-pinned.

> **InvocationContext is NOT modified** — the credential is a function param, not context data. The
> public `SettleGridInstance.meter(apiKey, method)` wrapper is unchanged. No public type break.

## 5. Byte-stable spine (DO NOT TOUCH — read-only)
`take_bps=0` model · `lib/pricing.ts` · `lib/metering.ts` (`deductCreditsRedis`, `recordInvocationAsync`,
`incrementPeriodSpend`, `checkBudget`, `creditReferralCommission`) · `developers.balanceCents` /
`consumers.global_balance_cents` authority · the DB-fallback deduction math in `meter/route.ts:303-380`
and `meter-with-metadata:126-180` · `(from,nonce)` dedup · B4 `account_id` · `proxy/[slug]` settlement
logic (read its auth pattern only) · `x402/* ap2/* circle-nano/* outcomes/* settlements/* cron/*` ·
`lib/rate-limit.ts` (no re-key/raise/lower of any limiter; `sdk-meter:${ip}` and the tiered
`sdk-meter:${body.consumerId}` keys stay as-is — N-chunk territory) · `lib/middleware/auth.ts` ·
`revenueSharePct`/overage logic (chunk C) · the test-mode branch logic (`meter:118-159`, byte-stable) ·
`meterSchema`/`meterWithMetadataSchema` Zod bodies (no new body field — key is a header). **Python SDK
family — untouched this chunk (follow-up).**

## 6. Behavioral deltas (the complete set)
- `/api/sdk/meter` and `/api/sdk/meter-with-metadata` now **require** `X-Api-Key`; missing/short →
  **401 `API_KEY_REQUIRED`**; unknown/revoked → **401 `INVALID_API_KEY`**; key valid but body identity
  ≠ key identity → **403 `KEY_BINDING_MISMATCH`** (newly-rejected request shape).
- Malformed body (no/!valid fields) still → **422** (auth is after `parseBody`). Smoke S17 preserved.
- TS SDK `@settlegrid/mcp` `0.3.0` now sends `X-Api-Key` on every meter call → continues to work against
  old (ignores header) and new (requires it) servers.
- **Known accepted residual (founder-gated):** un-updated TS `<0.3.0` and the entire Python SDK family
  call meter without the header → **401** → TS swallows (fire-and-forget, silent no-billing, fail-safe);
  Python raises `InvalidKeyError`. Safe under dormancy; Python fix is the next chunk.
- No money math changes; no new gross/net balance writer; no schema/migration.

## 7. Test plan (each new test must FAIL on pre-fix code)
**Server (`apps/web`):**
- `src/app/api/__tests__/sdk.test.ts` — Meter block (`:330-465`): extend `makeRequest` with an optional
  headers arg and pass `X-Api-Key` on the meter calls + **prepend** an auth-row mock as the FIRST
  `mockDb.limit` value, matching that block's fixed body UUIDs:
  `[{ id:'550e8400-e29b-41d4-a716-446655440002', consumerId:'…440000', toolId:'…440001',
  status:'active' }]` (consumerId `…440000` / toolId `…440001` / keyId `…440002`, per `:355-357`).
  `hashApiKey` is mocked to a constant (`sdk.test.ts:88-90`) and the mocked drizzle `eq`/`where`/`.limit`
  chain resolves **positionally**, so the auth SELECT consumes the prepended `mockDb.limit` row regardless
  of the hash — any ≥16-char `X-Api-Key` string works. Apply the prepend + header to **all four non-422
  meter tests**: happy (`:339`), 402-insufficient (`:371`), 402-no-balance (`:393`), zero-cost (`:412`);
  ⚠️ the zero-cost test mocks only ONE `.limit` (toolDev) today → after the prepend it must mock **two**
  (auth-row, then toolDev). Only the two **422** tests (`:443`, `:452`) stay unchanged. Update the
  now-stale `1st/2nd/3rd .limit` comments (`:340-342`). Add NEW: **401** (no
  `X-Api-Key`) and **403** (`KEY_BINDING_MISMATCH`: auth-row consumerId ≠ body). The existing **422**
  tests need no change (auth is post-`parseBody`).
- `src/app/api/__tests__/test-mode.test.ts` — Meter test-mode block (`:235-307`): this file has its **own
  file-local `makeRequest` (`:140`, no headers param)** — extend it (or inline headers) and pass
  `X-Api-Key` on **both meter tests** (`:244`, `:274`); prepend the auth-row matching its triple
  (consumerId `…440001` / toolId `…440002` / keyId `…440003`, per `:257-259`); update the stale `.limit`
  comments (`:247`, `:277-284`).
- **`meter-with-metadata`** (no behavioral test exists today → genuinely NEW file with its own
  `vi.mock` harness): add **401** (no key), **403** (mismatch), **200** (auth + matching body happy path).
**SDK (`packages/mcp`):**
- `src/__tests__/apiCall.test.ts` — new: `apiCall(…, {'X-Api-Key':'k'})` merges the header alongside
  `Content-Type` (and the no-`extraHeaders` calls still only set `Content-Type`).
- `src/__tests__/middleware.test.ts` — new/extended: the `execute`→meter fetch to `/api/sdk/meter`
  carries `X-Api-Key: <key>` (capture `init.headers`), and the meter **body** is unchanged.
- `src/__tests__/sdk-validation.test.ts` — REQUIRED: the §4 #8 edits (`:54`/`:80`→`'0.3.0'`, `:79` title).
  This is the forced edit the version bump demands; see §4 #8 for the do-not-touch list.

## 8. Machine gates (ground every claim in tool output)
- `apps/web`: `tsc --noEmit` **0** · `next build` **0** (not concurrent with tsc) · `vitest run`
  **all pass** (expect 4256 + new tests; record exact count).
- `packages/mcp`: `vitest run` **all pass** (expect 1896 + new) · `npm run build` (tsup, incl. DTS
  type-check) **0 errors** — this is the type-check that catches any missed meter callsite.
- `billing-credits.test.ts` GROSS-writer invariant: re-run, **1** writer each in `meter` /
  `meter-with-metadata` / `metering.ts`, **5** in proxy, **0** NET — unchanged.
- `git diff --numstat`: confined to exactly the files in §4 **plus the §7 test files** — server:
  `sdk.test.ts`, `test-mode.test.ts`, the new `meter-with-metadata` test; SDK: `apiCall.test.ts`,
  `middleware.test.ts`, `sdk-validation.test.ts` — (+ this plan/trace/capstone docs). No stray hunks;
  quote `[slug]`/`[id]` paths. (The §4 source list + these §7 test files are the complete write set; the
  §8 vitest-all-pass gate and this diff-scope gate are now consistent.)
- Self-grep: the auth block exists in both meter routes; no `revenueSharePct` token appears in either
  auth block; meter request body schema unchanged.

## 9. Rollout
LOCAL path-scoped commit only (Phase 6). **No push, no prod env, no migration** (none needed). Demo
sandbox unaffected (stub). After founder ack: capstone + register (F2 RESOLVED) + **Python-SDK follow-up
handoff** + memory.

## 10. ⚠️ SCOPE GUARD / OVER-AUDITING CLAUSE (embed verbatim; applies to build + both audit gates)
> Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows
> scope is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong.
> Hold the line against: changing the take model / pricing / `deductCreditsRedis` / ledger writes /
> `balanceCents` authority / dedup / B4; re-keying/raising/lowering any limiter or its prefix; migrating
> `revenueSharePct` or the overage logic (chunk C); touching `proxy/[slug]` settlement logic, `x402/ap2/
> circle-nano`, `cron/*`, `lib/rate-limit.ts`, `lib/middleware/auth.ts` beyond what the fix strictly
> needs; re-litigating H1/M/N-settled items (fail-open, left-most-XFF, `getClientIp`, `auth.id` keying)
> without a NEW trace. Re-opening a settled decision requires a concrete new trace. **Expanding to the
> Python SDK family is explicitly deferred by founder decision — flagging it is `rejected-scope-expansion`,
> not blocking.**
