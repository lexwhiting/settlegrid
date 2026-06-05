# (M)+(E) `getClientIp` call-site migration + `processDataExport` guard — RESOLUTION (2026-06-05)

> **Status: SHIPPED (local, founder-gated commit) — post-build panel PASS / 0 blocking.** Finishes
> publisher-keys **DEBT #1** (capstone §5.1) + the symmetric §5.2 follow-on. OFF the funds spine.
> Read-with: the build plan (`m-getclientip-migration-build-plan-2026-06-05.md`, PLAN_READY) and the
> implementation handoff (`m-getclientip-migration-IMPLEMENT-handoff-2026-06-05.md`).

## 1. What shipped

**(M) The migration — all 208 inline `x-forwarded-for` rate-limit derivations** replaced with the
single source of truth `const <var> = getClientIp(<receiver>.headers)` (rate-limit.ts:194-203, shipped
by H1: left-most XFF → x-real-ip → `'unknown-ip'`), `getClientIp` added to each file's existing
`@/lib/rate-limit` import. 225 single-line derivations + 9 multi-line shapes + 8 pattern classes
(U1/U2 uniform, U3 2-line wraps, U4 split-in-identifier, U5 `req`-named, N1 proxy, N2 `firstHopIp`
helper, N3 3-line). The 3 sentinels (`'unknown'`/`'anonymous'`/`'unknown-ip'`) are now unified to
`'unknown-ip'` everywhere.

**(E) `processDataExport` symmetric status guard** (`lib/settlement/compliance.ts`): `completed` →
idempotent no-op returning the stored `resultUrl`; `processing` → throws `Export already in progress`;
`pending`/`failed` → proceed (failed = retry). Docstring rewritten to the real status machine + a
**re-derived** retry-safety proof: `processDataExport` uses **NO `db.transaction`** (3 standalone
`db.update`s), `collectDeveloperData` is read-only, so a `failed` record persisted nothing and a retry
re-collects fresh — a proof that legitimately DIFFERS from `processDataDeletion`'s transactional-atomicity
proof. + 3 `settlement-moat.test.ts` cases driving the REAL function (no-op asserts `mockDbUpdate` not
called; failed-retry reaches `completed` with a `resultUrl`; processing rejects).

**2 forced sentinel test edits**: `tools/[id]/listed-in-marketplace` route test + `x402-facilitator`
test, `:unknown` → `:unknown-ip`.

## 2. Two findings beyond the audited plan — both addressed

**(a) Test-mock plan/pre-build-audit GAP (caught by the post-build suite).** 84 route test files
`vi.mock('@/lib/rate-limit')`; the 80 whose routes now call `getClientIp` returned **500** (the mock
lacked the export → `undefined(...)` → TypeError) — **892 test failures**. The pre-build audit (38
agents, 2 rounds) verified the *identifier-pinning* census correctly but never checked that route
**module mocks expose every newly-used export**. Fixed by injecting a real-logic `getClientIp`
(`h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip'`) into
each factory — NOT `importActual` (rate-limit.ts imports `@upstash/ratelimit` + `./redis` at module
level, which those tests mock precisely to avoid). The injected impl faithfully reproduces the real
helper, so identifier-pinning tests still pass for the right reason. 4 files already exposed it (H1's
serve/unsubscribe/mcp + a prototype). **Lesson: future migration audits must add a "do all module mocks
of the changed module expose every newly-used export?" check.**

**(b) Stale sentinel guard at `api-keys/route.ts:137` (caught by the post-build panel — the SOLE
finding, low/non-blocking).** `ip: ip !== 'unknown' ? ip : undefined` (the API-key-created security
email) compared against the OLD sentinel; post-migration `ip` is `'unknown-ip'` header-less, so the
email rendered `IP address: unknown-ip` instead of omitting the line. Prod NO-OP on Vercel (XFF always
set → real IP → guard passes identically), and the **sole** `(===|!==) '(unknown|anonymous)'` comparison
across all 208 migrated files (verified by grep). Founder elected to **fix** it (`'unknown'` →
`'unknown-ip'`) — it restores the guard's intent (omit the sentinel) and completes the migration's
stated "single sentinel everywhere / safe off-Vercel" goal. `publisherApiKeyCreatedEmail` is mocked in
the api-keys test, so no test assertion was affected.

## 3. Verification (a green suite is NOT sufficient — the panel is the gate)

- **Gates GREEN**: apps/web `tsc` 0 · `next build` 0 · `vitest` **4250 pass / 0 failed / 179 files**
  (4248 baseline + 2 (E) cases) · `eslint` 0 errors on all changed files; `packages/mcp` 1896 / 1 skip
  (untouched, no SDK rebuild). 2 pre-existing `no-control-regex` warnings in cron/crawl-{registry,services}
  are NOT from this chunk (their `eslint-disable` lines are not in any hunk) — left as-is (out of scope).
- **Done-checks**: PRIMARY derivation-grep `rg "= (request|req)\.headers\.get('x-forwarded-for')"
  --glob '!**/__tests__/**'` = **EMPTY**. SECONDARY broad grep = **16 legitimate keepers only**
  (rate-limit.ts {183,195}, the 9 `?? undefined` ipAddress captures, demo/kernel {56,67},
  demo-rate-limit.ts:9, proxy:433 + waitlist:136 comments). All 9 `ipAddress:` audit captures
  byte-identical. The 6 U5 files use `getClientIp(req.headers)`. `firstHopIp` fully removed + call site
  repointed.
- **Pre-build audit** (`.audit/m-prebuild/`): round 1 → 2 blocking fixed; round 2 → **PLAN_READY (0
  blocking)**, all improvements/nits applied.
- **Post-build panel** (`.audit/m-postbuild/security-panel.mjs`, 6 lenses → adversarial verify →
  synth, over-auditing guard applied; run `wf_9dde6968-7c8`): **PASS / 0 blocking** (1 finding = the
  api-keys:137 nit above, now fixed). Independently corroborated: 291 files all under apps/web/src;
  settlement spine (ledger/reconcile/payouts/pricing/orchestrators) untouched; only `compliance.ts`
  among `lib/settlement/*`; both U4 residual-splits byte-identical; no drizzle migration; packages/mcp
  clean. Manual spine-line spot-check on 8 settlement-surface files confirmed only ip+import lines changed.

## 4. Scope held (settled — do NOT re-litigate)

Byte-stable + untouched: the settlement spine, take model (`take_bps=0`), B4 (`account_id` IS developer
id), `developers.balanceCents` authority, `(from,nonce)` dedup, the 9 `ipAddress:` audit captures, the
H1 standing decisions (fail-open posture, left-most-XFF correctness, `'unknown-ip'` sentinel). NOT done
(deferred / out of scope, as planned): keying authenticated routes on `auth.id`; any limiter add/remove/
tune; (A) ACP, (H) hop-route, (C) `revenueSharePct`, (K) HMAC-pepper.

## 5. Follow-ons
- **publisher-keys DEBT #1 → CLOSED** (`publisher-api-keys-audit-2026-05-28.md`).
- post-H1 handoff `next-chunk-handoff-2026-06-05-post-h1.md` §5.1 (DEBT #1) + §5.2 (processDataExport
  symmetry) → **RESOLVED**.
- Push + any prod action remain **FOUNDER-GATED** (this is a LOCAL commit only).
- Tooling (gitignored, regenerable): `.audit/m-codemod/{migrate,fix-test-mocks}.mjs`,
  `.audit/m-postbuild/security-panel.mjs`.
