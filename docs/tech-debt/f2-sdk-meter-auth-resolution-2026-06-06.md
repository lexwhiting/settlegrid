# (F2) `sdk/meter` authentication + consumer-key binding — RESOLUTION CAPSTONE (2026-06-06)

> **CERTIFIED.** Closes the only confirmed non-theoretical security/integrity defect left on the money
> surface. Handoff: `f2-sdk-meter-auth-handoff-2026-06-06.md` · trace: `f2-sdk-meter-trace-2026-06-06.md`
> · plan: `f2-sdk-meter-auth-build-plan-2026-06-06.md`. LOCAL commit only — **not pushed** (founder-gated;
> no prod-env change, no migration).

## What was broken
`POST /api/sdk/meter` (and its twin `POST /api/sdk/meter-with-metadata`) acted on a fully client-supplied
body `{consumerId, toolId, keyId, costCents, …}` with **no authentication** — only an IP rate limit. The
`keyId` was used only to read `is_test_key`/timestamps, never to prove possession. So any caller past the
1000/min IP limit could deduct credits from / attribute usage to / accrue developer revenue for **arbitrary
accounts**. Impact was bounded only by dormancy (0 funded balances, 0 live SDK traffic). The twin route was
worse — it never looked up `api_keys` at all.

## What shipped
**Server (both meter routes) — identical auth+binding gate, inserted right after `parseBody`, before any
mutation:**
1. Require the consumer API key as an `X-Api-Key` header (`< 16` chars or missing → `401 API_KEY_REQUIRED`).
2. `hashApiKey(rawKey)` → look up the `api_keys` row by unique `key_hash` (no row / `status != 'active'` →
   `401 INVALID_API_KEY`).
3. Bind: if `keyRow.id/consumerId/toolId` ≠ the body's `keyId/consumerId/toolId` → **one generic
   `403 KEY_BINDING_MISMATCH`** (no field leak).
4. Everything downstream is unchanged — it keeps reading `body.*`, now provably `==` the key row, so the
   money path is **byte-identical**. Mirrors `proxy/[slug]` `authenticateProxyRequest`.
   - `meter/route.ts`: +30/−0 (gate + `hashApiKey` import). `meter-with-metadata/route.ts`: +31/−1 (gate +
     `apiKeys`/`hashApiKey` imports). `openapi.json/route.ts`: documents the `X-Api-Key` header + 401/403.

**SDK (`@settlegrid/mcp` 0.2.0 → 0.3.0):** the metering call now sends the key. `apiCall` gained an optional
`extraHeaders` param (merged into the fetch headers, `Content-Type` preserved); `meter(context, apiKey)`
sends `{ 'X-Api-Key': apiKey }`; all **4** internal meter callsites thread the key (execute debug/non-debug
`middleware.ts`, `sg.meter` `index.ts`, kernel `kernel.ts`) — each with the raw key already in scope. The
public `InvocationContext` type and `sg.meter(apiKey, method)` signature are unchanged. CHANGELOG + the
version-pinned `sdk-validation.test.ts` assertions updated.

## Why this framing (vs. the register's original F2)
The register's F2 was a narrow *observation* — the tiered limit at `sdk/meter` keyed on an unvalidated
`body.consumerId`. The deep study + read-only prod inventory (handoff §0) reframed F2 as the real
**unauthenticated-metering** defect. This fix resolves **both**: the gate runs *before* the tiered limit, so
by the time `checkTieredRateLimit(\`sdk-meter:${body.consumerId}\`)` runs, `body.consumerId` has been proven
`==` the authenticated key's consumerId.

## Honest value framing
Hardening done in the **safe window before real money flows** (dormant platform), not an active-incident
fix. It changes **no** money math — it only *gates* the existing flow. It must land before any consumer
funds a balance, which it now has.

## Audit chain (the founder's hard gates)
- **Pre-build (PLAN_READY required):** R1 `wf_e68d35f1-0a7` → `PLAN_NEEDS_FIXES` (1 blocking: the
  `0.2.0→0.3.0` bump breaks `sdk-validation.test.ts:54/:80`, + a self-contradictory §8 scope gate) → all
  fixes + 2 §7 polish folds applied → R2 `wf_dd1ff8d9-6cb` → **PLAN_READY / 0 blocking / full coverage**.
  (The 1st R2 `wf_a2c77439-38b` died wholesale on the account session limit; the audit script was hardened
  with a null-guard + inline degraded fallback before the successful re-run. Verdicts:
  `.audit/f2-prebuild/round{1,2}-verdict.txt` + `CHECKPOINT.md`.)
- **Post-build funds-SEAL (0 blocking required before any commit):** `wf_f4de24f2-36d` → **CERTIFIED /
  0 blocking / 0 findings / full coverage** (5 lenses: gap-closure, money byte-stability, no-new-bypass,
  SDK/backcompat, test integrity). Verdicts: `.audit/f2-postbuild/seal-verdict.txt` +
  `.audit/f2-certify/cert-verdict.txt`.

## Machine gates (all green at close-out)
- `apps/web`: tsc **0** · vitest **4261** (4256 + 5 new) · next build **0**.
- `packages/mcp`: vitest **1898 / 1 skip** (1896 + 2 new) · tsup + DTS **0**.
- GROSS-writer invariant (`billing-credits.test.ts`): **1/1/1/5/0** — unchanged.
- `git diff`: confined to exactly **13** files (+248/−33); `dist`/`schemas`/`.audit` gitignored & undrifted.

## New tests (each fails on pre-fix code)
Server: `sdk.test.ts` 401 (no key) + 403 (binding mismatch) + a `meter-with-metadata` describe
(401/403/200); `test-mode.test.ts` auth-row prepends (both meter tests). SDK: `apiCall.test.ts`
extraHeaders merge; `middleware.test.ts` end-to-end `X-Api-Key` on meter.

## Residual / follow-ups
- **F4 (founder-deferred, opened by this chunk):** the **Python SDK family** (`packages/sdk-python` core +
  6 framework wrappers) still omits `X-Api-Key` → **401 on `/meter` at runtime** against an F2 server. TS
  meter is fire-and-forget (silent no-billing, fail-safe under-collect); Python `meter()` raises
  `InvalidKeyError`. Safe now (0 live traffic / 0 funded balances), documented in CHANGELOG 0.3.0. Do
  before any Python consumer onboards: re-add `apiKey` to the core meter call (it was literally removed
  once — see `_types.py` comment), update the 6 wrappers' test assertions, bump the Python SDK.
- **Non-blocking nits (no action):** meter's test-mode branch re-queries `isTestKey` instead of reusing the
  gate's `keyRow` (safe — `body.keyId == keyRow.id`; perf-only). `meter-with-metadata`'s `developerShareCents`
  credit name vs `meter`'s `body.costCents` is pre-existing/gross (GROSS-writer test byte-stable).
- **Still open (unrelated):** F1 (NAT-fairness IP-raise) · F3 (`requireApiKey` dead-export removal).

## Deploy note (founder-gated)
The server change is a **wire-contract break**: an F2-deployed server requires `X-Api-Key` on `/meter`.
Deploy the server and the `@settlegrid/mcp` 0.3.0 publish together (or server-first, since old TS SDKs
fail-safe). NOT pushed/deployed by this chunk.
