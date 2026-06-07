# (F2) `sdk/meter` authentication — DISCOVERY TRACE (2026-06-06)

> **Phase-1 artifact** for the (F2) chunk (handoff: `f2-sdk-meter-auth-handoff-2026-06-06.md`).
> Every claim is grounded in `file:line` read THIS session at **HEAD `aa580355`**. The build plan
> (`f2-sdk-meter-auth-build-plan-2026-06-06.md`) is derived from this trace; do not write/plan past
> any unanswered question here.

## Pre-flight (verified)
- `git status -sb`: branch `main`, HEAD `aa580355` (the (N) local commit), tree clean except the new
  F2 handoff/trace docs (`.audit/` gitignored). Matches handoff §2.
- Baselines GREEN at this HEAD: `apps/web` `tsc` **0** · `next build` **0** · `vitest` **180 files /
  4256 passed / 0 fail**; `packages/mcp` `vitest` **52 files / 1896 passed / 1 skipped**. Any red is ours.

---

## Q1 — Reachability / trust model: **`/api/sdk/meter` is reachable by untrusted clients.**
- `meter/route.ts:45` `export const POST = withCors(...)`. `lib/middleware/cors.ts:17-18` sets
  `Access-Control-Allow-Origin: *` (+ allow-headers `Content-Type, Authorization, X-API-Key`). ⇒ any
  origin (browser) and any server can POST. The ONLY gate is the IP flat limit
  `checkRateLimit(sdkLimiter, \`sdk-meter:${ip}\`)` (`:51`, 1000/min) + a tiered limit keyed on the
  **client-supplied** `body.consumerId` (`:108`). No credential is required.
- **Every caller of `/api/sdk/meter` (full enumeration via repo-wide grep):**
  - **TS SDK** `@settlegrid/mcp`: `middleware.ts:416` `apiCall(config,'/meter',{…})`. Reached from
    `execute` (`middleware.ts:543`/`:547`), the public `sg.meter` (`index.ts:517`), and the dispatch
    `kernel` (`kernel.ts:621`).
  - **Python SDK** `settlegrid` (core): `client.py:208` (`meter`) / `:233` (`meter_async`) →
    `_http.request*('/meter', …)`. **6 framework wrappers** (`sdk-python-{crewai,smolagents,dspy,
    langchain,pydantic-ai,llamaindex}`) **delegate** to the core (`from settlegrid import SettleGrid`;
    `/meter` appears only in their *test mocks*, never in wrapper source) — runtime-inherited.
  - **Server-side `apps/web`:** the only in-repo server reference is the demo sandbox
    `demo/sandbox/[...path]/route.ts:123` — a **pure stub** (`meterStub`, no DB/payment imports;
    a vitest guard asserts it imports nothing from `@/lib/db|stripe|settlement`). NOT a real meter
    caller; out of the money path.
  - **No cron, no server lib** calls the real meter handler. `openapi.json/route.ts`, `app/api/route.ts`,
    docs pages reference it as documentation only.
- **Twin `/api/sdk/meter-with-metadata/route.ts:27`:** same `withCors` + IP-limit shape, **zero SDK/client
  callers** (refs only in docs + the file-exists smoke list + the source-scan billing guard). Reachable,
  but currently uncalled. Securing it is purely additive hardening.

## Q2 — Does the SDK already send the key? **NO — neither SDK does.**
- **TS:** `middleware.ts:416-424` body = `{toolSlug, consumerId, toolId, keyId, method, costCents,
  latencyMs}`; `apiCall` (`:152-157`) sets headers = `{'Content-Type':'application/json'}` only. The raw
  key lives in `execute(apiKey,…)`/`sg.meter(apiKey,…)`/`kernel ctx.identity.value` but is **never**
  forwarded to `/meter`.
- **Python:** `client.py:210-218` body = `{toolSlug, consumerId, toolId, keyId, method, costCents}`;
  `_http._ensure_*_client` headers = `Content-Type` + UA only. `_types.py:60-63` states it outright:
  *"`api_key` was previously sent on the wire but the meter endpoint's Zod schema doesn't accept it
  (Zod silently strips it); removed so the Python client matches the TS client's wire shape."*
  (`meterSchema` `route.ts:33-43` is non-`.strict()` → extra fields silently dropped.)
- **`keyId` is not a credential:** `api_keys.id` is a random UUID (`schema.ts:244`), returned by
  `validate-key`, stored on every invocation row, and not hashed. Proof-of-possession requires the raw
  `sg_live_…` key, which is absent from the meter request. ⇒ **A server-only fix is impossible; an SDK
  change is required** (this is the pivotal scoping finding).

## Q3 — Full effect inventory (the blast radius the fix must gate)
**`meter/route.ts` state effects off unauthenticated body fields:**
tiered-limit key `body.consumerId` (`:108`) · monthly-ops Redis counter `dev-ops:{developerId}`
(`:83-104`) · test-mode invocation insert + `tools.totalInvocations++` (`:128-149`) · zero-cost
invocation insert + `tools.totalInvocations++` (`:165-186`) · `detectFraud` (`:204`) · `checkBudget`
(`:261`) · **`deductCreditsRedis(consumerId,toolId,costCents)`** (`:271`) · **`recordInvocationAsync`**
(`:275`, DB balance-deduct + tool stats + `developers.balanceCents += costCents` + invocation insert) ·
`incrementPeriodSpend` (`:289`) · `markToolVerified` (`:292`/`:383`) · DB-fallback (`:303-380`):
`consumerToolBalances` deduct + tool stats + `developers.balanceCents += costCents` + invocation insert +
`creditReferralCommission`.
**`meter-with-metadata/route.ts`:** `consumerToolBalances` deduct (`:126`) + tool stats (`:148`) +
`developers.balanceCents += body.costCents` (`:158`) + invocation insert (`:167`). No fraud/test/redis.
**GROSS-writer invariant** (`proxy/[slug]/__tests__/billing-credits.test.ts:63-118`): a source-scan pins
**exactly 1** gross `developers.balanceCents` writer in each meter route (and 0 NET writers matching
`…balanceCents…revenueSharePct`). The fix adds **no** balance writer → counts stay 1 (must keep the auth
block clear of that regex — it is, it's a SELECT + equality checks).

## Q4 — Correct binding source
- `api_keys` (`schema.ts:241-266`): `uniqueIndex(key_hash)`; columns `id, consumerId, toolId, keyHash,
  status (default 'active'), isTestKey`. **Each key is bound to exactly one `(consumerId, toolId)`.**
- **Authoritative resolution:** `hashApiKey(rawKey)` (`lib/crypto.ts:37`, SHA-256) → row by `keyHash`.
  Derive `consumerId=row.consumerId`, `toolId=row.toolId`, `keyId=row.id`, `isTestKey=row.isTestKey`.
- **Mismatch rejection (no field leak):** if `row.id≠body.keyId || row.consumerId≠body.consumerId ||
  row.toolId≠body.toolId` → **one generic `403 KEY_BINDING_MISMATCH`**. Missing/short key → `401
  API_KEY_REQUIRED`; no row or `status≠'active'` → `401 INVALID_API_KEY`.
- **Model to mirror:** `proxy/[slug]/route.ts:121-185` (`x-api-key` → `hashApiKey` → row → status/slug
  checks) and `validate-key/route.ts:40-58` (body `apiKey` → `hash` → row). The hashing+lookup is
  identical regardless of transport.
- **Note:** `body.toolSlug` is **unused** by the server today — the tool lookup keys on `body.toolId`
  (`route.ts:67`). No need to validate the slug; leave it byte-stable.

## Q5 — Backward-compat
- Prod inventory (§0 of handoff): **0 live SDK traffic** (real_30d=0/real_7d=0), **0 funded balances**.
  A hard key requirement is therefore safe to land now and MUST land before any consumer funds a balance.
- Post-fix behavior for an un-updated client: no `x-api-key` → **401**. TS `meter` is fire-and-forget in
  non-debug mode (`middleware.ts:547 .catch(()=>{})`) → silent no-billing (**fail-safe**: under-collect,
  never mis-attribute/over-collect). Python `meter()` raises `InvalidKeyError`.
- **Smoke S17** (`scripts/smoke-test.sh:458-462`) posts a no-key malformed body and expects `422|400`.
  Auth runs **after `parseBody`**, so malformed bodies still 422 → S17 preserved.
- **Founder decision (2026-06-06):** scope = **server + TS SDK now**; the Python SDK family is left
  runtime-incompatible (meter→401) and tracked as an **immediate documented follow-up** chunk.

## Q6 — Test-mode path
- `meter/route.ts:118-159`: `body.isTestKey` gates entry → re-queries `apiKeys` by `body.keyId` for
  `isTestKey` → records a cost-0 invocation. After auth+binding (`body.keyId===row.id`), the re-query
  runs on the **bound** key; the gate still works and a real key falsely claiming test mode still
  re-verifies `isTestKey=false` and falls through to billing. **Not an auth bypass** (the request must
  first pass auth+binding). Keep this branch byte-stable; the auth block precedes it.

---

## Transport decision — `X-Api-Key` HEADER (not a body field)
Both transports close the gap; chose the header because: (1) it mirrors the canonical settlement-auth
path `proxy/[slug]` (the handoff's primary model) and keeps the secret out of the JSON data body;
(2) un-updated clients (incl. the deferred Python family) get a clean **401 "API key required"** instead
of a confusing 422, the correct "upgrade your SDK" signal; (3) the non-secret meter **body shape stays
byte-identical**, so the deferred Python SDK keeps sending the same body (just 401s for the missing
header) AND the existing TS `middleware.test.ts` meter assertions (which capture `body`, not headers) stay
green; (4) CORS already allows `X-API-Key`. Cost: one small additive optional-`extraHeaders` param on the
generic `apiCall` (existing `apiCall` tests pass it nothing → unaffected).

## Conclusion
Implement **Design A — full proof-of-possession auth + identity binding** on **both** meter routes
(server) and thread the raw key onto the TS SDK's meter call as an `X-Api-Key` header. Money semantics
(`deductCreditsRedis`/`recordInvocationAsync`/`incrementPeriodSpend`/balance authority/the DB-fallback
deduction/dev-credit) stay byte-stable — the fix only **gates** the existing flow. Python SDK family →
follow-up. Build plan + scope-guard + test plan: `f2-sdk-meter-auth-build-plan-2026-06-06.md`.
