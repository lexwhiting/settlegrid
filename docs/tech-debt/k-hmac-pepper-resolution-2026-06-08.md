# (K) HMAC-pepper for the API keyspace — RESOLUTION / CAPSTONE (2026-06-08)

> Closes register **DEBT #3** (`publisher-api-keys-audit-2026-05-28.md`). Pairs with the chunk's
> trace (`k-hmac-pepper-trace-2026-06-08.md`), build-plan (`k-hmac-pepper-build-plan-2026-06-08.md`),
> and handoff (`k-hmac-pepper-handoff-2026-06-08.md`). **TIER: HIGH-STAKES** (auth/crypto boundary on
> the money path; a deliberate edit to the frozen `lib/crypto.ts hashApiKey` spine).
>
> **State: SHIPPED + LIVE** — pushed as `origin/main @ 23663006`, deployed + smoke-tested
> 2026-06-09 (the founder prerequisite — `API_KEY_PEPPER` in Vercel prod — was satisfied first).
> *(Status line updated 2026-06-10 as the (G)-chunk docs-tidy rider; this doc previously read
> "PUSH HELD".)*

## What (K) is
Hardened the API-keyspace hash from bare `SHA-256(key)` → **`HMAC-SHA256(serverPepper, domain + ':' + key)`**
so a DB-only disclosure of `key_hash` is useless without the server-held pepper. Defense-in-depth, **not** a
live-exploit fix (256-bit keys are already collision/preimage-infeasible) — so the change-risk (breaking auth
on the money path) dominated the risk it mitigates, and the bar was *provably auth-neutral for existing keys +
HMAC-only for new keys, at every verify site*.

## What shipped (16 files; the only behavior change is the hash scheme)
- **`lib/crypto.ts`** — added `hashApiKeyHmac(key, domain)` (`HMAC-SHA256(getApiKeyPepper(), domain+':'+key)`
  hex), `apiKeyHashCandidates(key, domain) = [hashApiKey(key) /* domain-LESS legacy */, hashApiKeyHmac(key,
  domain)]`, and `type ApiKeyDomain = 'live' | 'pub'`. The generators emit the HMAC (`'live'` / `'pub'`).
  **`hashApiKey` (bare SHA-256) kept verbatim** as the legacy dual-read branch — existing rows can NEVER be
  re-hashed (the raw key is not stored), so verification **dual-reads** (`key_hash IN [sha, hmac]`).
- **`lib/env.ts`** — `getApiKeyPepper() = requireEnv('API_KEY_PEPPER')`, **fail-CLOSED**: a missing/empty
  pepper throws (loud deploy error) — never a silent degrade to unkeyed SHA. (Auth is correctness, not
  anti-abuse — unlike H1's fail-open.) The accessor is lazy (no module-scope call → build-safe without the var).
- **Dual-read at all 6 verify sites** — `proxy/[slug]:136/158` (the money proxy), `sdk/meter:60`,
  `sdk/meter-with-metadata:53`, `sdk/validate-key:40/57`, `sdk/test-validate:36/51` (domain `'live'`,
  `api_keys`); **`tools/publish:171/177`** (domain `'pub'`, `developer_api_keys`) — **de-inlined** (the old
  inline `createHash('sha256')` removed + its import deleted), routed through the shared helper so no site can
  diverge. Each site preserves its existing filters (status/slug/tool gating, joins, `limit(1)`).
- **Tests/config (8)** — `vitest.config.ts` injects a non-prod test pepper; the 2 crypto suites get 2
  forced-edit assertion fixes (`hashApiKey(key)` → `hashApiKeyHmac(key,'live')`) + 2 stale `SHA-256`→`HMAC`
  relabels; **NEW `crypto.hmac.test.ts`** (12 tests); 4 route-test `vi.mock` factories gain
  `inArray` / `apiKeyHashCandidates` stubs (the R1 blocker — see below).
- **Key FORMATS byte-stable** (`sg_live_`/`sg_pub_` prefixes, lengths, display slices). **NO migration / NO
  schema change** — HMAC hex is 64 chars = SHA width, so `key_hash text` + the unique index are unaffected;
  pure dual-read distinguishes schemes by trying both, not by a column.

## The two load-bearing calls (resolved)
- **LB-1 — PURE DUAL-READ** (not lazy-upgrade-on-verify, which would add a write + a unique-index race on the
  proxy hot money path for zero threat-model gain). The SHA candidate is **domain-LESS** (legacy rows are bare
  `sha256(key)`); only the HMAC candidate carries the domain — proven by probe against the real shipped code.
- **LB-2 — FAIL-CLOSED pepper + `live`/`pub` domain tag** bound into the HMAC at generate AND verify, so a
  consumer key can't be replayed against the publisher table (defense-in-depth atop the existing table
  separation). No length/entropy floor (symmetric with every other `requireEnv` secret; a present-but-weak
  value is undetectable by construction). Rotation is **OUT** (documented residual; the scheme leaves room for
  a future previous-pepper candidate).

## Gate discipline (every phase full-coverage; the protocol earned its cost)
- **Pre-build audit** (dynamic Workflow, 7 lenses, mechanical-first): **R1 PLAN_NEEDS_FIXES** — caught a real
  blocker the green suite masked: the verify-route rewrite (`inArray`/`apiKeyHashCandidates`) would 500 four
  route-test files whose `vi.mock` factories omitted those symbols (vitest 2.1.9 throws on an omitted factory
  export). Folded all fixes + live-re-confirmed → **R2 PLAN_READY / 0 blocking**.
- **Executable gate:** tsc 0 · vitest **4313 / 185** (= 4301 + 12) · next build 0 (pepper UNSET → lazy/
  build-safe proven) · eslint 0 · packages/mcp 1898 / 1 · `packages/sdk-python*` byte-stable.
- **Empirical fail→fix** (`.audit/k-build/`): the behavior-change crypto tests go RED on pre-(K) SHA
  generators; the R1 blocker reproduced 30 route-test failures → 40 pass after the mock-fixes.
- **Seal-gating review** (security-posture, 6 lenses): R1 degraded by **transient** server-side rate-limiting
  (3 lenses died) → **rejected as a seal** (degraded ≠ pass) → backed off + resumed → **R2 CERTIFIED, full
  coverage, 0 blocking** (the seal ran its own 24/24 live forge probe).
- **Post-seal deep audit** (integrated whole, 5 lenses + completeness critic): **SEAL_STANDS, full coverage,
  0 blocking.** Whole-repo sweep proved the verify/creation site set is complete repo-wide (the only other
  `key_hash` writer is a demo seed using random `fakeKeyHash`, not an auth seam); cross-chunk seams clean
  (nothing downstream re-hashes or assumes SHA; the (H)/(F1)/(C)/(R)/(N) stack is byte-stable); mock-omission
  class closed; the critic's own forge probe 8/8. Its lone finding — the operator `env-var-checklist.md`
  omitted `API_KEY_PEPPER` — was non-blocking and closed (that file is gitignored/local; the row is on disk).

Audit records (gitignored, on disk): `.audit/k-prebuild/`, `.audit/k-build/`, `.audit/k-postbuild/`,
`.audit/k-deepaudit/` (round verdicts + probes + the SEAL/DEEPAUDIT verdicts).

## ⚠️ Deploy ordering (founder-gated — the push is HELD on this)
1. **Set `API_KEY_PEPPER` in Vercel prod FIRST** (Production; ideally Preview + Development too) — a high-
   entropy ≥32-byte value. Confirmed **NOT set** as of this writing (`vercel env ls` shows it absent).
   **If (K) deploys without it, fail-closed = every auth path 500s** (proxy + metering + publish, existing AND
   new keys — `apiKeyHashCandidates` throws building the HMAC candidate before any lookup). Pepper-first is
   mandatory.
2. Then push `main` → the Vercel prod deploy ships **(H)+(F1)** (the held `ede13b8b`) **and (K)** together.
   Existing keys keep working via the dual-read SHA branch; new keys issue under HMAC.
3. **No migration to apply** (pure dual-read). No schema change.
- **Rollback residual:** once (K) is live and a new key is issued (HMAC), reverting to SHA-only would orphan
  that key — an emergency rollback must keep the dual-read. Inherent to any hash-scheme change.

## Residuals (documented, out of scope)
Pepper **rotation** unimplemented (rotating invalidates all HMAC keys; scheme doesn't preclude a future
previous-pepper candidate). Operator-entropy of the pepper value is undetectable by construction. `sg_test_`
keys are legacy-SHA-only (no production HMAC creation path) — matched by the domain-less SHA branch.
