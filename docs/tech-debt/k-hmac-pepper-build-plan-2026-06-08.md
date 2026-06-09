# (K) HMAC-pepper for the API keyspace — BUILD PLAN

> **Status: DRAFT** (not implementable until the Phase-3 pre-build audit returns PLAN_READY / 0 blocking
> with all fixes folded). Pairs with the Phase-1 trace `k-hmac-pepper-trace-2026-06-08.md` (completeness
> proofs) — this doc is the EXACT, mechanical HOW + gates + rollout. **TIER: HIGH-STAKES** (security/crypto
> boundary on the money path; a deliberate edit to the frozen `lib/crypto.ts hashApiKey` spine).

## 1. Goal + honest framing
Harden the API-keyspace hash from bare `SHA-256(key)` to `HMAC-SHA256(pepper, domain+':'+key)` so a
DB-only disclosure of `key_hash` is useless without the server-held pepper (register DEBT #3). This is
**defense-in-depth, not a live-exploit fix** — keys are 256-bit random, so preimage/collision is already
infeasible; the value is purely the DB-disclosure posture. **The change-risk DOMINATES the risk it
mitigates:** a wrong dual-read = a 401/500 auth outage on the on-chain settlement proxy + all SDK metering +
publisher publishing — the exact harm we're hardening against. The bar: *provably auth-neutral for existing
keys + HMAC-only for new keys, at every verify site.*

## 2. Resolved load-bearing calls (proofs in the trace §C/§D)
- **LB-1 = PURE DUAL-READ, no migration.** Each verify site looks up `key_hash IN (sha256(key),
  hmac(pepper,domain+':'+key))`. No writes on the hot path; no `hash_scheme` column. Legacy SHA rows persist
  and match via the SHA candidate (not a regression — existing keys keep their status-quo posture; the
  hardening applies to new keys). Lazy-upgrade rejected (adds a write + unique-index race on the money path
  for zero threat-model gain). Centralized in ONE helper `apiKeyHashCandidates` so no site diverges.
- **LB-2 = FAIL-CLOSED pepper + domain tag.** `getApiKeyPepper()=requireEnv('API_KEY_PEPPER')` → throws on
  missing/empty (never silent SHA fallback). Domain `'live'|'pub'` (TS union) bound into the HMAC at
  generate AND verify; the **SHA candidate stays domain-LESS** (legacy rows are bare `sha256(key)`).
  Rotation OUT (documented residual; scheme doesn't preclude a future previous-pepper candidate).

## 3. EXACT per-file recipes

### 3.1 `apps/web/src/lib/crypto.ts` (CORE — full replacement body)
```ts
import { createHash, createHmac, randomBytes } from 'crypto'
import { getApiKeyPepper } from './env'

const API_KEY_PREFIX = 'sg_live_'
export const PUBLISHER_API_KEY_PREFIX = 'sg_pub_'

/**
 * The key class bound into the HMAC so a consumer key can never be replayed
 * against the publisher keyspace or vice-versa. 'live' = consumer (sg_live_,
 * api_keys); 'pub' = publisher (sg_pub_, developer_api_keys).
 */
export type ApiKeyDomain = 'live' | 'pub'

/**
 * Generates a new API key with the sg_live_ prefix, its keyed HMAC hash, and a
 * display prefix. The full key is returned once and should never be stored in
 * plaintext. (K): the stored hash is HMAC-SHA256(pepper, 'live:'+key) — see
 * hashApiKeyHmac — not bare SHA-256.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${API_KEY_PREFIX}${random}`
  const hash = hashApiKeyHmac(key, 'live')
  const prefix = key.slice(0, 8)

  return { key, hash, prefix }
}

/**
 * Generates a new publisher API key with the sg_pub_ prefix, its keyed HMAC
 * hash, and a display prefix. Used for programmatic tool publishing via
 * PUT /api/tools/publish — distinct from the consumer-side sg_live_ keys.
 * The full key is returned once and should never be stored in plaintext.
 * (K): the stored hash is HMAC-SHA256(pepper, 'pub:'+key).
 */
export function generatePublisherApiKey(): { key: string; hash: string; prefix: string } {
  const random = randomBytes(32).toString('hex')
  const key = `${PUBLISHER_API_KEY_PREFIX}${random}`
  const hash = hashApiKeyHmac(key, 'pub')
  const prefix = key.slice(0, 11) // 'sg_pub_' + first 4 hex chars

  return { key, hash, prefix }
}

/**
 * Returns the bare SHA-256 hex digest of an API key string. LEGACY (pre-(K)):
 * existing key_hash rows were written with this, and the raw key is never
 * stored, so they can NEVER be re-hashed to HMAC — dual-read matches them via
 * this function. Kept verbatim. Do NOT domain-tag it: legacy rows are bare
 * sha256(key) with no domain.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Returns HMAC-SHA256(serverPepper, domain + ':' + key) as hex — the keyed,
 * domain-separated hash for keys issued at/after (K). The pepper is a
 * FAIL-CLOSED server secret (getApiKeyPepper throws if API_KEY_PEPPER is unset),
 * so a missing pepper can never silently degrade to the unkeyed legacy hash. A
 * DB-only disclosure of key_hash is useless without the pepper.
 */
export function hashApiKeyHmac(key: string, domain: ApiKeyDomain): string {
  return createHmac('sha256', getApiKeyPepper()).update(`${domain}:${key}`).digest('hex')
}

/**
 * The set of stored key_hash values a presented key may legitimately match
 * under dual-read: the legacy bare SHA-256 (domain-less — matches pre-(K) rows)
 * AND the new domain-separated HMAC (matches rows issued at/after (K)). Verify
 * sites look up `key_hash IN (candidates)`. Centralizes the dual-read scheme so
 * no verify site can diverge (e.g. the formerly-inlined publisher hash).
 */
export function apiKeyHashCandidates(key: string, domain: ApiKeyDomain): string[] {
  return [hashApiKey(key), hashApiKeyHmac(key, domain)]
}
```
(Function declarations are hoisted, so `generateApiKey` calling `hashApiKeyHmac` declared later is valid.)

### 3.2 `apps/web/src/lib/env.ts` — add the accessor (after `getGateSecret`, line 33)
```ts
// API key pepper — server secret keying the HMAC over API keys ((K) / DEBT #3).
// FAIL-CLOSED: required in EVERY environment (local/preview/prod). requireEnv
// throws on missing/empty, so a misconfigured pepper is a loud deploy error,
// never a silent degrade to the unkeyed legacy SHA-256 (auth is correctness,
// not anti-abuse — unlike the H1 rate-limiter's fail-open). Must be set in prod
// BEFORE the (K) code deploys: existing keys keep working via dual-read; new
// keys issue under HMAC. Operator residual: use a high-entropy value (>=32 bytes).
export function getApiKeyPepper(): string {
  return requireEnv('API_KEY_PEPPER')
}
```

### 3.3 Verify sites — line-surgical dual-read (before → after)
Each: swap the `hashApiKey` import for `apiKeyHashCandidates`, add `inArray` to the drizzle import, and turn
the single-hash `eq` into a dual-candidate `inArray`. Domain `'live'` for the 5 consumer sites, `'pub'` for
publish.

**(a) `proxy/[slug]/route.ts`** — keep the `createHash` import (still used by `hashBody`:68).
- `:3` `import { eq, and, sql } from 'drizzle-orm'` → `import { eq, and, sql, inArray } from 'drizzle-orm'`
- `:7` `import { hashApiKey } from '@/lib/crypto'` → `import { apiKeyHashCandidates } from '@/lib/crypto'`
- `:136` `const keyHash = hashApiKey(rawKey)` → `const keyHashes = apiKeyHashCandidates(rawKey, 'live')`
- `:158` `.where(eq(apiKeys.keyHash, keyHash))` → `.where(inArray(apiKeys.keyHash, keyHashes))`

**(b) `sdk/meter/route.ts`**
- `:3` `eq, and, sql` → `+ inArray`
- `:7` `hashApiKey` → `apiKeyHashCandidates`
- `:60` `.where(eq(apiKeys.keyHash, hashApiKey(rawKey)))` → `.where(inArray(apiKeys.keyHash, apiKeyHashCandidates(rawKey, 'live')))`

**(c) `sdk/meter-with-metadata/route.ts`**
- `:3` `eq, and, sql` → `+ inArray`
- `:7` `hashApiKey` → `apiKeyHashCandidates`
- `:53` `.where(eq(apiKeys.keyHash, hashApiKey(rawKey)))` → `.where(inArray(apiKeys.keyHash, apiKeyHashCandidates(rawKey, 'live')))`

**(d) `sdk/validate-key/route.ts`**
- `:3` `import { eq, and } from 'drizzle-orm'` → `+ inArray`
- `:6` `hashApiKey` → `apiKeyHashCandidates`
- `:40` `const keyHash = hashApiKey(body.apiKey)` → `const keyHashes = apiKeyHashCandidates(body.apiKey, 'live')`
- `:57` `.where(eq(apiKeys.keyHash, keyHash))` → `.where(inArray(apiKeys.keyHash, keyHashes))`

**(e) `sdk/test-validate/route.ts`**
- `:3` `import { eq } from 'drizzle-orm'` → `import { eq, inArray } from 'drizzle-orm'`
- `:6` `hashApiKey` → `apiKeyHashCandidates`
- `:36` `const keyHash = hashApiKey(body.apiKey)` → `const keyHashes = apiKeyHashCandidates(body.apiKey, 'live')`
- `:51` `.where(eq(apiKeys.keyHash, keyHash))` → `.where(inArray(apiKeys.keyHash, keyHashes))`

**(f) `tools/publish/route.ts`** — DE-INLINE the hash + remove the now-unused `createHash` import.
- `:3` `import { eq, and } from 'drizzle-orm'` → `+ inArray`
- `:4` `import { createHash } from 'crypto'` → **DELETE** (no other use in this file — confirmed by grep)
- `:13` `import { PUBLISHER_API_KEY_PREFIX } from '@/lib/crypto'` → `import { PUBLISHER_API_KEY_PREFIX, apiKeyHashCandidates } from '@/lib/crypto'`
- `:172` `const keyHash = createHash('sha256').update(rawKey).digest('hex')` → `const keyHashes = apiKeyHashCandidates(rawKey, 'pub')`
- `:178` `.where(and(eq(developerApiKeys.keyHash, keyHash), eq(developerApiKeys.status, 'active')))` → `.where(and(inArray(developerApiKeys.keyHash, keyHashes), eq(developerApiKeys.status, 'active')))`

The `:163-170` publisher prefix fast-fail (sg_pub_ check, from (R)) is UNCHANGED.

**Creation sites need NO edit** — `consumer/keys:122` (`generateApiKey()`) and
`dashboard/developer/api-keys:124` (`generatePublisherApiKey()`) inherit the HMAC via the generators.

### 3.4 The dual-read verify flow (worked — what the probe proves)
Let `K` = a presented raw key, `P` = the pepper.
- **Legacy consumer key** (row written pre-(K) as `sha256(K)`): `apiKeyHashCandidates(K,'live') =
  [sha256(K), hmac(P,'live:'+K)]`; `inArray` matches the row on the FIRST candidate. ✓ authenticates.
- **New consumer key** (row written post-(K) as `hmac(P,'live:'+K)`): matches on the SECOND candidate. ✓
- **Wrong pepper** `P'≠P`: candidate `hmac(P','live:'+K)` ≠ the stored `hmac(P,'live:'+K)`, and `sha256(K)`
  ≠ the stored HMAC → **no match** → 401. ✓ (DB-disclosure attacker without the pepper cannot forge.)
- **Wrong domain** (a `sg_pub_` key presented to a consumer site): `hmac(P,'live:'+K)` ≠ stored
  `hmac(P,'pub:'+K)`; SHA differs too → no match. ✓ cross-class replay blocked.
Publisher (`tools/publish`, domain `'pub'`, table `developer_api_keys`) is symmetric.

### 3.5 Tests + config
**`vitest.config.ts`** — add to the `test:` block (the pepper is fail-closed; the real generators throw
without it):
```ts
    env: {
      // (K): API-key hashing is fail-closed HMAC — generateApiKey / hashApiKeyHmac
      // throw without a pepper. Inject a deterministic NON-PROD pepper so the
      // crypto suites (which call the real generators) run. Never a real pepper.
      API_KEY_PEPPER: 'test_pepper_not_for_production_use_only',
    },
```
**`lib/__tests__/crypto.test.ts`** — import `hashApiKeyHmac`; fix the forced assertion `:41-44`
(`expect(hashApiKeyHmac(key, 'live')).toBe(hash)`); relabel `:35` name to
`'hash is a 64-char hex digest (HMAC-SHA256)'` (assertion unchanged: `length===64` + hex).
**`lib/__tests__/crypto.extended.test.ts`** — import `hashApiKeyHmac`; fix `:44-47`
(`expect(hashApiKeyHmac(key, 'live')).toBe(hash)`); relabel `:16` name to `'... (HMAC-SHA256)'`.
**NEW `lib/__tests__/crypto.hmac.test.ts`** — 12 tests (the §F set): `hashApiKeyHmac` (6: ≠legacy SHA;
64-hex; deterministic; live≠pub domain separation; pepper-dependent via `vi.stubEnv`; **fail-closed throw**
on empty pepper), `apiKeyHashCandidates` (4: returns `[sha,hmac]` distinct + SHA branch domain-less; legacy
SHA row in set; new HMAC row in set; wrong-domain not in set), generators emit HMAC (2: consumer/publisher
`hash===hmac(domain)` and `!==sha`). **`N_new = 12`.**

**Mock-export additions (R1-FOLDED — REQUIRED; without them the verify-route rewrite 500s these tests; trace
§F-B).** The post-edit routes call `inArray(...)`/`apiKeyHashCandidates(...)`; four test files use
full-replacement `vi.mock` factories that OMIT those symbols, and **vitest 2.1.9 THROWS on an omitted factory
export** → the call throws inside the handler try/catch → `internalErrorResponse(500)` → auth-reaching success
tests go RED. Add (matching the in-repo convention `settlement-moat.test.ts:119` /`reconcile.test.ts:59`:
`inArray: vi.fn().mockImplementation((a, b) => ({ inArray: [a, b] }))` and `apiKeyHashCandidates: vi.fn()
.mockReturnValue(['sha-stub', 'hmac-stub'])`):
- `app/api/__tests__/sdk.test.ts` — `inArray` → drizzle factory `:100`; `apiKeyHashCandidates` → crypto factory `:88`.
- `app/api/__tests__/sandbox.test.ts` — `inArray` `:69`; `apiKeyHashCandidates` `:58`.
- `app/api/__tests__/test-mode.test.ts` — `inArray` `:134`; `apiKeyHashCandidates` `:100`.
- `app/api/tools/publish/__tests__/route.test.ts` — `inArray` `:67` ONLY (no crypto mock → real `apiKeyHashCandidates`, pepper-saved).
Count-neutral + assertion-safe (verified: NO test asserts on the args of a CHANGED symbol — the arg-assertions
present, `publish:164` `mockValidate` + `:341` `checkRateLimit`, target UNCHANGED mocks; the `sg_live_`
select-not-called pin `publish:311` fast-fails at the publisher prefix gate `route.ts:163` BEFORE the rewritten
lookup; each db `.limit` mock returns fixed rows regardless of the lookup arg). →
**Edit-set = 16 files** (was 12); the vitest test-count is unchanged at **4313 / 185**.

## 4. Behavior-change (FAIL pre-fix) vs behavior-neutral (regression pins)
- **FAIL pre-fix** (Phase-4 proves empirically, recorded to `.audit/k-build/`): the 2 generator-emit-HMAC
  tests (pre-fix `generateApiKey().hash === hashApiKey(key)`, so `=== hashApiKeyHmac` fails) + the
  fail-closed throw (pre-fix the fn doesn't exist). Method: stash the crypto.ts generator change, run the
  new file, capture the failures, restore.
- **Behavior-neutral PINS (must stay green)**: all format tests (length 72, prefixes, slices); all pure
  `hashApiKey` tests (legacy unchanged); the legacy-regression candidate test (a pre-(K) SHA value is in the
  set). **R1-CORRECTED:** four route-test files (sdk/sandbox/test-mode/publish) are NOT auto-unaffected — the
  verify-route rewrite 500s them unless their `vi.mock` factories gain the omitted `inArray`/
  `apiKeyHashCandidates` exports (§3.5); with those additions they go green. Every OTHER route test (mocked,
  importing no verify route — or real-crypto saved by the test.env pepper) is genuinely unaffected.

## 5. Byte-stable spine + SCOPE GUARD (verbatim from trace §J)
Key **formats**; the auth gates' 401/200 contract + lookup semantics (only the hash COMPUTATION changes);
pepper **rotation** + key **re-issue**; migration apply / prod-env set (founder-gated); settlement / ledger
/ reconciler incl. (H)-guard + (C)-take; `lib/rate-limit.ts` incl. (F1); `lib/pricing.ts`; `lib/payouts/**`;
meter CREDIT path; `deductCreditsRedis` / balance / dedup / B4 `account_id`; x402/ap2/circle-nano adapters;
**all** `packages/mcp` + `packages/sdk-python*`; F1/F2/F3/F4/N/M/H1/R/(C)/(H). `proxy:68 hashBody` =
body-cache hash, NOT a key — untouched. **Reject scope creep / gold-plating / deferred-work / rotation-impl
/ key-format change.**

## 6. Machine gates (end-state)
- `cd apps/web`: `npx tsc --noEmit` → **0** · `npx vitest run` → **4313 pass / 185 files**
  (= baseline 4301/184 **+ 12** new tests in **+1** new file; 0 fail) · `npx next build` → **0**
  (build does NOT need the pepper — no module-scope generator call; confirm empirically) ·
  `npx eslint <changed files>` → **0** (esp. the removed `createHash` import in publish).
- `cd packages/mcp`: `npx vitest run` → **1898 pass / 1 skip** (byte-stable).
- `git diff --numstat` / `git status --porcelain` confined to the **16** planned files (incl. the 4 route-test
  mock-fixes; `git add -N` the 1 new file so numstat sees it); `packages/sdk-python*` + `packages/mcp` = **empty**.
- Probes (Phase-3 mechanical-first, re-run post-build): verify-site-set equality (grep == planned set);
  dual-read correctness (legacy-SHA row + new-HMAC row both match; wrong-pepper/wrong-domain match neither);
  key-format-unchanged.

## 7. Deploy / rollout note (founder-gated; ordering is load-bearing)
1. **Set `API_KEY_PEPPER` FIRST** in Vercel prod (+ preview + local `.env.local`) — a high-entropy secret —
   **before** deploying (K). If unset at deploy, fail-closed = ALL auth 500s (loud, safe — not a silent
   downgrade). Pepper-first is mandatory.
2. Deploy (K) code. Existing keys → dual-read SHA branch (keep working). New keys → HMAC.
3. **No migration to apply** (pure dual-read). No schema change.
4. **Rollback caveat (residual, non-blocking):** once (K) is live and any new key is issued (HMAC), reverting
   the code to SHA-only would break those new keys (their HMAC row won't match a SHA lookup). The dual-read
   is forward-safe; an emergency rollback after new-key issuance must keep the dual-read. Inherent to any
   hash-scheme change; documented, not mitigated further (out of scope).
5. **Pepper rotation** is unimplemented; rotating invalidates all HMAC keys. Residual.

## 8. Implementation order (single-writer, keep each batch green)
1. `lib/env.ts` `getApiKeyPepper` → 2. `lib/crypto.ts` (helpers + generators) → 3. `vitest.config.ts` env →
4. new `crypto.hmac.test.ts` + fix the 2 crypto suites → run the 3 crypto files green (proves the core +
test-env) → 5. the 6 verify sites (one at a time, `tsc` + that route's test after each); **alongside, add the
omitted mock exports to the 4 route-test files (§3.5) and re-run those 4 GREEN** — for the R1-blocker,
empirically capture ONE route test RED (route edited, mock not yet) then GREEN (mock added) to
`.audit/k-build/` → 6. full gate (§6). Prove fail-pre-fix for the behavior-change tests before/at step 4.
</content>
