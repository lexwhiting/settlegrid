# (K) HMAC-pepper — SCOPE-CONFIRM DISCOVERY TRACE (2026-06-08)

> Phase 1 of the (K) ARC. Every §0–§4 claim in the handoff re-derived against LIVE code, each grounded
> in a `file:line` read THIS session. The point of this document is to **prove the verify-site and
> creation-site sets are COMPLETE** (so the dual-read can't miss one) and to settle the two load-bearing
> judged calls (LB-1 dual-read shape, LB-2 pepper fail-mode) with evidence, before any build code.
>
> **Verdict: scope CONFIRMED. Pure dual-read, NO migration, NO schema change. 16 edited files (2 core + 6
> verify sites + vitest env + 2 crypto test files + 4 route-test mock-fixes [R1-folded] + 1 new test file).**
> Authoritative edit-set in §I; detail below.

---

## 0. Ground state (verified this session)

- `git log -3 --oneline`: `ede13b8b` (the (H)+(F1) local commit) atop `origin/main 839455fb` (deployed,
  not pushed). `git status -sb`: clean except the untracked handoff `k-hmac-pepper-handoff-2026-06-08.md`.
  → (K) is a fresh local commit atop `ede13b8b`, exactly as the handoff states. ✓
- Baseline anchored: `cd apps/web && npx tsc --noEmit` → **exit 0** (this session). Full
  vitest/build/mcp gates re-run in Phase-3 mechanical-first (which is still pre-edit, so it doubles as
  the pre-edit baseline).

---

## A. THE VERIFY-SITE SET — proven COMPLETE (the LB-1 trap)

**Method:** grepped `hashApiKey` (every caller) + `createHash` (every inlined hash) + `createHmac` (any
keyed hash) across `apps/web/src` and `packages`. Every site that turns a presented API key into a
`key_hash` for a DB lookup is enumerated below; every other `createHash`/`createHmac` hit is classified
as NON-key and excluded with its reason.

### A.1 — The 6 verify sites (the dual-read target set)

| # | Site (`file:line`) | Path | Reads table | Domain | Today |
|---|---|---|---|---|---|
| 1 | `app/api/proxy/[slug]/route.ts:136` (`authenticateProxyRequest`) | **MONEY proxy** | `api_keys` | `live` | `hashApiKey(rawKey)` → `eq(apiKeys.keyHash, keyHash)` :158 |
| 2 | `app/api/sdk/meter/route.ts:60` | SDK meter (billing) | `api_keys` | `live` | `eq(apiKeys.keyHash, hashApiKey(rawKey))` |
| 3 | `app/api/sdk/meter-with-metadata/route.ts:53` | SDK meter+meta | `api_keys` | `live` | `eq(apiKeys.keyHash, hashApiKey(rawKey))` |
| 4 | `app/api/sdk/validate-key/route.ts:40` → `:57` | SDK validate | `api_keys` | `live` | `hashApiKey(body.apiKey)` → `eq(apiKeys.keyHash, keyHash)` |
| 5 | `app/api/sdk/test-validate/route.ts:36` → `:51` | SDK test-validate | `api_keys` | `live` | `hashApiKey(body.apiKey)` → `eq(apiKeys.keyHash, keyHash)` |
| 6 | `app/api/tools/publish/route.ts:172` → `:178` (`authenticateDeveloperByApiKey`) | **Publisher publish (INLINED — the trap)** | `developer_api_keys` | `pub` | `createHash('sha256').update(rawKey).digest('hex')` → `and(eq(developerApiKeys.keyHash, keyHash), eq(status,'active'))` |

Sites 1–5 call the shared `hashApiKey`. Site 6 **does NOT** — it inlines `createHash('sha256')` (the
`(R)` chunk de-inlined the publisher *prefix* check at `:163-170` but **left the hash inlined**, per the
handoff §6 note). This is the easy-miss site; the plan **de-inlines it** through the shared candidate
helper.

### A.2 — Proof there are NO other key-hash sites

Every `createHash` hit in `apps/web/src`, classified:
- `lib/crypto.ts:38` — the `hashApiKey` helper itself (the legacy hasher; KEPT). ✓ in scope (core).
- `tools/publish/route.ts:172` — site 6 above. ✓ in scope.
- `proxy/[slug]/route.ts:68` (`hashBody`) — hashes the **request body** for cache keying
  (`.slice(0,24)`), NOT a key. **Out of scope; do not touch.**
- `lib/settlement/identity.ts:45`, `lib/settlement/ledger.ts:394` — settlement identity / `settlement:${invocationId}` hashing. Non-key. Out of scope (spine).
- `app/api/telemetry/kernel/route.ts:119-120` — constant-time compare of a telemetry secret. Non-key. Out.
- `packages/**` (mcp/client) — adapter/SDK hashing. **`packages/mcp`/`packages/sdk-python*` are byte-stable spine; out of scope** (server-side keyspace hashing is `apps/web`-only).

Every `createHmac` hit is a SIGNATURE verifier (webhooks `:136`, github `:73`, gate `:49`, ap2 credentials,
mcp adapters l402/kyapay/ap2/tool-secret) — **none hashes an API key.** → There is **no existing HMAC over
an API key anywhere**; the keyspace is purely bare SHA-256 today. The verify-site set above is COMPLETE.

---

## B. THE CREATION-SITE SET — proven COMPLETE

**Method:** grepped `.insert(apiKeys|developerApiKeys)`, `keyHash:` (column writes), `sg_test_`,
`isTestKey: true`.

| Creation site (`file:line`) | Generator | Writes | Stored hash today |
|---|---|---|---|
| `app/api/consumer/keys/route.ts:122` → insert `:125`, `keyHash: hash` `:129` | `generateApiKey()` | `api_keys` (`sg_live_`) | `hashApiKey(key)` (SHA) |
| `app/api/dashboard/developer/api-keys/route.ts:124` → insert `:127`, `keyHash: hash` `:130` | `generatePublisherApiKey()` | `developer_api_keys` (`sg_pub_`) | `hashApiKey(key)` (SHA) |

These are the **only two** `.insert()` into the key tables; every other `keyHash:` occurrence is a TEST
mock or the `schema.ts` column definition (`:250`, `:292`). Both creation sites call the exported
generators and **need NO edit** — the scheme change lives entirely inside `generateApiKey` /
`generatePublisherApiKey` (which flip from `hashApiKey` → `hashApiKeyHmac(key, 'live'|'pub')`).

### B.1 — The `sg_test_` keys: no creation site → legacy-only (resolves the domain question)

`test-validate:32` gates on `body.apiKey.startsWith('sg_test_')` and looks the key up in `api_keys`. But
**no production code ever creates a `sg_test_` key**: `isTestKey: true` in non-test code appears ONLY at
`validate-key:121` as a *response* field (`successResponse({ valid: true, …, isTestKey: true })`), never an
`insert`. `generateApiKey()` hard-codes the `sg_live_` prefix (`crypto.ts:12`), so it cannot mint a
`sg_test_` key. Therefore any `sg_test_` rows in prod are **legacy SHA-256** (created out-of-band) and are
matched by the **SHA branch** of dual-read; no HMAC generator emits `sg_test_`. → All five consumer verify
sites (which read `api_keys`) use one uniform domain: **`live`**. `sg_test_` keys keep working because the
SHA candidate is domain-less and matches their existing rows.

---

## C. LB-1 — DUAL-READ DECISION: pure dual-read (chosen) vs lazy-upgrade

**Decision: PURE DUAL-READ.** At each verify site compute BOTH candidate hashes and look up
`keyHash IN (sha, hmac)`; no writes; legacy SHA-256 rows persist.

**Why not lazy-upgrade-on-verify** (UPDATE the row to HMAC on a successful legacy verify):
- It adds a **WRITE on the `proxy/[slug]` hot read path** (the on-chain settlement gate) and on every SDK
  meter — turning a pure read into a read+write under request load.
- **Concurrency/unique-index hazard:** two in-flight requests with the same legacy key would both try to
  UPDATE `keyHash` to the same HMAC; on the `api_keys_key_hash_idx` / `developer_api_keys_key_hash_idx`
  unique indexes this is at best redundant churn and at worst an update-conflict to handle on the money
  path. A funds-path side effect for zero functional gain on *that* request.
- **Zero security gain over pure dual-read for what matters:** the DB-disclosure posture for NEW keys is
  identical either way (new keys are HMAC). Existing keys are *already* SHA-256 today (status quo); leaving
  them is **not a regression** — it simply means the hardening applies going forward. Lazy-upgrade's only
  benefit is eventually retiring legacy rows, which buys nothing the threat model cares about.
- **Smaller change wins** (spine-safeguard): pure dual-read is behavior-neutral on the hot path, no new
  failure mode, no migration. Lazy-upgrade is strictly more risk on the money path.

**Dual-read query shape (worked):** current `eq(table.keyHash, h)` → `inArray(table.keyHash, [sha, hmac])`.
`inArray` is a standard drizzle operator already used in-repo (`lib/settlement/compliance.ts:478`
`inArray(apiKeys.toolId, …)`, `lib/gridbot.ts:330`). The candidate array is **always exactly 2 elements**
(never empty → no `inArray([])` edge). The `keyHash` unique index guarantees at most ONE row matches: a
given raw key exists under exactly one scheme (legacy SHA *or* new HMAC, never both — the key is generated
once), and `sha256(key) ≠ hmac(pepper,'live:'+key)`, so the two candidates are disjoint values and only one
can be present. Existing per-site filters are preserved (proxy/test-validate do the `status='active'` check
*after* fetch; publish keeps `and(…, eq(status,'active'))`).

---

## D. LB-2 — PEPPER: source, fail-CLOSED, domain tag (at generate AND verify)

**Source:** a new env secret `API_KEY_PEPPER`, read via a `requireEnv`-backed accessor `getApiKeyPepper()`
added to `lib/env.ts` (the existing `getDatabaseUrl`/`getRedisUrl` pattern at `env.ts:36-42`). `env.ts`
imports nothing, so `crypto.ts → env.ts` is a clean one-way edge (no import cycle). The getter is called
only inside `hashApiKeyHmac`, called only inside the generators/verify sites — all **lazy at call time**,
never at module load → `next build` (which evaluates modules but not handler bodies) does NOT require the
pepper. Confirmed: no module-scope call to the generators/hashers exists.

**Fail-CLOSED (the silent-wrong crux):** `getApiKeyPepper()` = `requireEnv('API_KEY_PEPPER')`, which throws
on missing/empty (`env.ts:3-12`: `if (!value) throw`). A missing pepper therefore makes `hashApiKeyHmac`
**throw**, which propagates to each route's `try/catch` → `internalErrorResponse` (500) / auth failure. It
**never** falls back to unkeyed SHA-256. This is deliberately **fail-closed**, NOT H1's fail-open: auth is
correctness, not anti-abuse, so an absent/misconfigured pepper is a **deploy error**, not a soft-degrade. A
silent SHA fallback would (i) defeat the security goal and (ii) compute the *legacy* hash for a *new* key →
mismatch → a confusing partial outage anyway. Fail-closed is the safe failure.
- **Convention symmetry (why no bespoke length floor):** every other required secret in `env.ts`
  (`STRIPE_SECRET_KEY`, `GATE_SECRET`, `DATABASE_URL`) uses plain `requireEnv` with no length/entropy
  assertion. Adding a pepper-only length floor would be inconsistent and is beyond LB-2's literal
  requirement (fail-closed on *missing/empty*, which `requireEnv` already does). A "present-but-wrong"
  *value* is undetectable by construction (any non-empty string is a valid HMAC key). → Keep plain
  `requireEnv`; document the **operator residual**: use a high-entropy value (≥32 bytes recommended). The
  audit may pressure-test this; the floor is trivially addable if it disagrees, but the minimal,
  convention-consistent choice is the default.

**Domain separation:** `hashApiKeyHmac(key, domain)` = `HMAC-SHA256(pepper, domain + ':' + key)` hex, with
`domain: 'live' | 'pub'` (a TS union — a typo'd domain is a compile error, not a silent class-wide auth
break). Applied identically at generate and verify:
- generate consumer (`generateApiKey`) → `'live'`; verify sites 1–5 → `'live'`.
- generate publisher (`generatePublisherApiKey`) → `'pub'`; verify site 6 → `'pub'`.
- **CRITICAL:** the **SHA candidate is domain-LESS** (`hashApiKey(key)` exactly), because legacy rows were
  written as bare `sha256(key)` with no domain — tagging the SHA branch would stop it matching legacy rows.
  Only the HMAC candidate carries the domain. (A probe in Phase-3 mechanical-first proves: legacy-SHA row
  AND new-HMAC row both match; wrong-pepper / wrong-domain key matches NEITHER.)
- Domain separation is defense-in-depth layered on the **existing table separation** (consumer keys live in
  `api_keys`, publisher in `developer_api_keys`; each verify site reads one table) — it makes the hash
  VALUES disjoint across classes too, so a hash computed for one class can never collide into the other.

**Rotation:** OUT of scope. Rotating the pepper invalidates every HMAC key (needs a 2nd dual-read dimension
or forced re-issue). The scheme does not preclude it (a future `getApiKeyPepperPrevious()` could add a 3rd
candidate). Documented as a residual; **not implemented.**

---

## E. MIGRATION — NOT needed (pure dual-read), justified

Pure dual-read distinguishes schemes by **trying both hashes**, never by reading a column, so **no
`hash_scheme`/`hash_version` column is required**. The keyspace tables are unchanged:
- `api_keys`: `keyHash text NOT NULL` (`schema.ts:250`), unique `api_keys_key_hash_idx` (`:263`).
- `developer_api_keys`: `keyHash text NOT NULL` (`:292`), unique `developer_api_keys_key_hash_idx` (`:302`).
HMAC-SHA256 hex is **64 chars** — identical width to SHA-256 hex — so `text` + the unique index are
unaffected; a new HMAC value is just another 64-hex string. → **No migration file. No schema change.** (A
scheme-tag column would only serve lazy-upgrade or analytics, both out of scope.)

---

## F. TEST SWEEP — exact files, forced edits vs behavior pins, the test-env pepper seam

**The pepper test-env seam (must-fix):** `vitest.config.ts` has **no `env` block and no `setupFiles`** (read
in full), so `API_KEY_PEPPER` is unset under test. Once `generateApiKey`/`generatePublisherApiKey` emit HMAC
(fail-closed), every UNMOCKED call to them throws without a pepper. → **Add `test.env = { API_KEY_PEPPER:
'<deterministic non-prod test value>' }` to `vitest.config.ts`.** This is required and in-scope.

**Test impact has THREE categories (R1-audit CORRECTED — the original "route tests unaffected (mocks return
fixed rows)" claim was FALSE: it conflated the mocked `.where()` RETURN value with the argument-EVALUATION
that precedes it; `inArray`/`apiKeyHashCandidates` are omitted from those factories, so the CALL throws
before `.where()` ever runs):**

**(A) Tests exercising REAL crypto → need the `test.env` pepper (all covered by the ONE global injection):**
- `lib/__tests__/crypto.test.ts` + `lib/__tests__/crypto.extended.test.ts` — call `generateApiKey()`/
  `hashApiKey()` unmocked.
- the NEW `lib/__tests__/crypto.hmac.test.ts` — real `hashApiKeyHmac`/`apiKeyHashCandidates`/generators.
- `dashboard/developer/api-keys/__tests__/route.test.ts` — does NOT mock crypto → calls the real
  `generatePublisherApiKey()` (now pepper-dependent); never references `inArray` → otherwise unaffected.
- the proxy tests `proxy/[slug]/__tests__/billing-credits.test.ts` + `lib/__tests__/proxy-equivalence.test.ts`
  — mock NEITHER `drizzle-orm` NOR `@/lib/crypto` → real `apiKeyHashCandidates` (pepper) + real `inArray`.
- `tools/publish/__tests__/route.test.ts` — does NOT mock crypto → real `apiKeyHashCandidates` (pepper).
  (It DOES mock `drizzle-orm` without `inArray` → also in (B).)

**(B) ⚠️ R1-BLOCKER (folded): tests that MOCK `drizzle-orm`/`@/lib/crypto` AND import a verify route.** The
post-edit route calls `inArray(...)` / `apiKeyHashCandidates(...)`, which are OMITTED from the full-
replacement `vi.mock` factories. In **vitest 2.1.9** (confirmed) accessing an omitted factory export THROWS
(`[vitest] No "inArray" export is defined on the "drizzle-orm" mock`; and even if it returned `undefined`,
`undefined(...)` is a TypeError) → the call throws inside the handler try/catch → `internalErrorResponse(500)`
→ every auth-reaching success test goes RED. The affected set is EXACTLY **four** (independently re-derived:
verify-route importers × incomplete factory; the 3 creation-route crypto-mockers are NOT here — see (C)).
Each needs mock-export additions (test-only, count-neutral, matching the in-repo convention at
`settlement-moat.test.ts:119` / `reconcile.test.ts:59` / `attribution.test.ts:33`):
- `app/api/__tests__/sdk.test.ts` — drizzle `:100` `{eq,and,sql}` → add `inArray`; crypto `:88` `{hashApiKey}`
  → add `apiKeyHashCandidates`. (imports validate-key/meter/meter-with-metadata; success `:185`→200.)
- `app/api/__tests__/sandbox.test.ts` — drizzle `:69` `{eq,and}` → add `inArray`; crypto `:58` `{hashApiKey}`
  → add `apiKeyHashCandidates`. (imports test-validate; `sg_test_` success `:120`→200.)
- `app/api/__tests__/test-mode.test.ts` — drizzle `:134` `{eq,and,sql}` → add `inArray`; crypto `:100`
  `{hashApiKey:mockHashApiKey}` → add `apiKeyHashCandidates`. (imports validate-key+meter; success →200.)
- `app/api/tools/publish/__tests__/route.test.ts` — drizzle `:67` `{eq,and}` → add `inArray` ONLY (no crypto
  mock → real `apiKeyHashCandidates`, pepper-saved). (`sg_pub_` success `:116`→201; the non-AuthError
  re-throw `route.ts:229`→outer catch→`internalErrorResponse` `:448` is the 500 path.)
- **Assertion-safe (verified):** NO test asserts on the args of a CHANGED symbol — the arg-assertions present
  (`publish:164` `mockValidate`, `:341` `checkRateLimit`) target UNCHANGED mocks; the `sg_live_`
  select-not-called pin (`publish:311`) fast-fails at the publisher prefix gate (`route.ts:163`) BEFORE the
  rewritten lookup, and the `sg_pub_` test reaches `.select()` either way; the db `.limit` mock returns fixed
  rows regardless of the lookup arg, so the success paths pass once the exports exist. Leaving the now-unused
  `hashApiKey` mock is harmless (the route no longer calls it; vitest does not error on an unused mock export).

**(C) Genuinely unaffected:** `smoke.test.ts:948-949` (`typeof` only, no call); `integration.test.ts` (no
crypto); the CREATION-route mockers `consumer.test.ts` / `consumer-api.test.ts` / `audit-logging.test.ts`
(mock `generateApiKey` → real generator never runs (no pepper) and the creation route uses `eq`/`and`, never
`inArray`, and never verifies). `ip-restrict.test.ts` mocks drizzle but imports no verify route.

**Forced edits (assertions that BREAK because `generateApiKey().hash` is now HMAC, not `hashApiKey(key)`):**
- `crypto.test.ts:41-44` `'hash matches hashApiKey output for same key'`: `expect(hashApiKey(key)).toBe(hash)`
  → becomes `expect(hashApiKeyHmac(key, 'live')).toBe(hash)`.
- `crypto.extended.test.ts:44-47` `'hash matches hashApiKey of the key'`: same fix.

**Behavior PINS that still PASS (not forced, optionally relabeled for honesty):**
- `crypto.test.ts:35-39` / `crypto.extended.test.ts:16-20` assert the generated hash is 64-char lowercase
  hex. HMAC-SHA256 hex is also 64-char lowercase hex → **still pass.** Their NAMES say "SHA-256", which is
  now inaccurate for the *generated* hash. Plan: minimally relabel these two names/comments to "HMAC-SHA256
  (64-char hex)" for content-accuracy (the founder runs a content-accuracy guard); this is a string-only
  edit, no logic change.
- The pure-`hashApiKey` tests (deterministic, different-input, 64-hex, empty, long, special-chars,
  case-sensitive) all assert against the UNCHANGED legacy `hashApiKey` → **all still pass**, untouched.

**New behavior-change tests (FAIL pre-fix; Phase-4 proves empirically) — new file
`lib/__tests__/crypto.hmac.test.ts`:**
1. `generateApiKey().hash === hashApiKeyHmac(key, 'live')` and `!== hashApiKey(key)` — new keys are HMAC,
   not SHA. (Fails pre-fix: pre-fix `hash === hashApiKey(key)`.)
2. `generatePublisherApiKey().hash === hashApiKeyHmac(key, 'pub')`.
3. `hashApiKeyHmac` domain separation: `hashApiKeyHmac(k,'live') !== hashApiKeyHmac(k,'pub')`; both 64-hex;
   pepper-dependent (`vi.stubEnv` a different pepper → different output).
4. **Fail-closed:** with `vi.stubEnv('API_KEY_PEPPER','')` (or deleted), `hashApiKeyHmac(...)` **throws**
   (does NOT return a SHA). (Fails pre-fix: function doesn't exist.)
5. `apiKeyHashCandidates(key,'live')` = `[hashApiKey(key), hashApiKeyHmac(key,'live')]` — SHA branch is
   **domain-less** (equals legacy), HMAC branch is domain-tagged, the two are distinct.
6. **Legacy regression:** a value equal to `hashApiKey(key)` is present in the candidate set (proves a
   pre-(K) row still matches under dual-read).

`N_new = 12` (the new file: `hashApiKeyHmac`×6 + `apiKeyHashCandidates`×4 + generators×2); the two forced-edit
assertions + the 4 route-test mock-adds are *count-neutral*. End-state gate: `vitest 4301 + 12 = 4313` pass /
185 files.

---

## G. KEY FORMATS — untouched (byte-stable)

- Prefixes: `API_KEY_PREFIX='sg_live_'` (`crypto.ts:3`), `PUBLISHER_API_KEY_PREFIX='sg_pub_'` (`:4`).
- Lengths: consumer `sg_live_`+64hex = 72 chars; display prefix `key.slice(0,8)` (`:14`). Publisher
  `sg_pub_`+64hex; display prefix `key.slice(0,11)` (`:29`). `keyPrefix varchar(12)` fits both (`schema.ts:251,293`).
- Only the **hash COMPUTATION** changes; the key STRING the user receives, its prefix, length, and the
  `keyPrefix`/`keyHash` column shapes are byte-identical. The `crypto.test.ts:17-21,30-33` /
  `crypto.extended.test.ts:5-14,22-26,49-53` format assertions (length 72, `sg_live_` prefix, slice(0,8))
  all still pass untouched.

---

## H. SDK / mcp / python — untouched (server-side hashing only)

Hashing is **server-side only**. The TS SDK `@settlegrid/mcp` and `packages/client` send an `X-Api-Key`
header (F2) but never hash it; `packages/sdk-python*` likewise. No `hashApiKey`/`createHash`-over-key exists
in `packages/**` (grepped — all `packages` `createHash`/`createHmac` are adapter/signature code). →
`packages/mcp` (gate 1898/1) + `packages/sdk-python*` are **byte-stable**; confirm via `git diff --numstat`
(must be empty for those trees) in the gate.

---

## I. THE EDIT SET (line-surgical) — derived, for the plan

Core (2):
1. `lib/crypto.ts` — import `createHmac`; import `getApiKeyPepper` from `./env`; add
   `type ApiKeyDomain='live'|'pub'`, `hashApiKeyHmac(key,domain)`, `apiKeyHashCandidates(key,domain)`; flip
   `generateApiKey`→`hashApiKeyHmac(key,'live')`, `generatePublisherApiKey`→`hashApiKeyHmac(key,'pub')`.
   **Keep `hashApiKey` (legacy SHA) verbatim.**
2. `lib/env.ts` — add `getApiKeyPepper()` = `requireEnv('API_KEY_PEPPER')`.

Verify sites (6) — each: import-swap `hashApiKey`→`apiKeyHashCandidates`, add `inArray` to the drizzle
import, `eq(keyHash,h)`→`inArray(keyHash, apiKeyHashCandidates(raw, domain))`:
3. `proxy/[slug]/route.ts` (:7 import, :136 compute, :158 where; **keep** the `createHash` import — still
   used by `hashBody` :68; drizzle import :3 `eq,and,sql`→add `inArray`). domain `'live'`.
4. `sdk/meter/route.ts` (:7, :60; :3 `eq,and,sql`→`inArray`). `'live'`.
5. `sdk/meter-with-metadata/route.ts` (:7, :53; :3 `eq,and,sql`→`inArray`). `'live'`.
6. `sdk/validate-key/route.ts` (:6, :40/:57; :3 `eq,and`→`inArray`). `'live'`.
7. `sdk/test-validate/route.ts` (:6, :36/:51; :3 `eq`→`eq,inArray`). `'live'`.
8. `tools/publish/route.ts` — **de-inline** :172, :178 where → `inArray`; **remove** the now-unused
   `createHash` import (:4); add `apiKeyHashCandidates` to the `@/lib/crypto` import (:13, currently
   `PUBLISHER_API_KEY_PREFIX`); add `inArray` (:3 `eq,and`→`inArray`). domain `'pub'`.

Tests/config (7):
9. `vitest.config.ts` — `test.env.API_KEY_PEPPER`.
10. `lib/__tests__/crypto.test.ts` — fix :41-44 forced assertion (+ relabel :35-39 name); import `hashApiKeyHmac`.
11. `lib/__tests__/crypto.extended.test.ts` — fix :44-47 forced assertion (+ relabel :16-20 name); import `hashApiKeyHmac`.
12. **NEW** `lib/__tests__/crypto.hmac.test.ts` — the 6 behavior-change/regression tests (F above).
13–16. **(R1-folded) mock-export additions** so the verify-route rewrite doesn't 500 the route tests (§F-B):
    `app/api/__tests__/sdk.test.ts` (+`inArray` to drizzle, +`apiKeyHashCandidates` to crypto);
    `app/api/__tests__/sandbox.test.ts` (+both); `app/api/__tests__/test-mode.test.ts` (+both);
    `app/api/tools/publish/__tests__/route.test.ts` (+`inArray` only — no crypto mock). Test-only.

**Edit-set total = 16 files** (2 core + 6 verify + vitest.config + 2 crypto suites + 1 NEW crypto.hmac + 4
route-test mock-fixes) + docs/.audit. The **git numstat / modified-file count is 16**; the **vitest
test-count is unchanged at 4313 pass / 185 files** — the 4 route files are MODIFIED (not new), the only NEW
file is `crypto.hmac.test.ts` (+12), and the mock additions + the 3 forced-assertion edits are all
count-neutral. No edit to the 2 creation sites (the generators carry the change). No migration. No `packages/**`.

---

## J. SCOPE GUARD (byte-stable spine — reject any change to these)

Key **formats** (`sg_live_`/`sg_pub_`, lengths, prefix slices); the auth GATES' contract (same 401/200, same
lookup semantics — only the hash computation changes); pepper **rotation** + key **re-issue**; applying any
migration / setting prod env (founder-gated); settlement/ledger/reconciler incl. (H)-guard + (C)-take;
`lib/rate-limit.ts` incl. (F1) `sessionLimiter`; `lib/pricing.ts`; `lib/payouts/**`; the meter CREDIT path;
`deductCreditsRedis`/balance/dedup/B4 `account_id`; x402/ap2/circle-nano adapters; **all** `packages/mcp` +
`packages/sdk-python*`; F1/F2/F3/F4/N/M/H1/R/(C)/(H) settled designs. The ONLY behavior change shipped by (K)
is the hash scheme (new keys HMAC; existing keys matched by dual-read). `proxy/[slug]:68 hashBody` is a
body-cache hash, NOT a key — do not touch.

---

## K. MECHANICAL EVIDENCE LOG (this session)

- `git log -3 --oneline && git status -sb` → HEAD `ede13b8b`, clean+untracked handoff. ✓
- `rg hashApiKey | createHash | createHmac` over `apps/web/src` + `packages` → verify-site set (§A) complete;
  only key-hash sites are the 6 + the `crypto.ts` helper; all other hits classified non-key. ✓
- `rg '.insert(apiKeys|developerApiKeys)' / keyHash: / sg_test_ / isTestKey:\s*true` → creation set (§B)
  = 2 sites; no `sg_test_` creation path. ✓
- `rg inArray src` → operator used in-repo (compliance/gridbot); safe import. ✓
- `rg crypto in integration.test.ts` → none; only crypto.test/extended need the test pepper. ✓
- `npx tsc --noEmit` → exit 0 (pre-edit baseline anchored). ✓
- (Phase-3 mechanical-first will add: full vitest 4301/184 + build 0 + mcp 1898/1 pre-edit; the
  dual-read correctness probe; the verify-site-set equality probe; key-format-unchanged probe.)

**→ Proceed to Phase 2 (build plan).** No open scope questions; LB-1 = pure dual-read; LB-2 = fail-closed
`requireEnv` pepper + `live`/`pub` domain tag, SHA candidate domain-less; no migration.
</content>
</invoke>
