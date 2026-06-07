# (R) Register close-out bundle — RESOLUTION / CAPSTONE (2026-06-07)

> Capstone for the (R) chunk. Drains the publisher-API-keys register's entire remaining **non-gated**
> tail in one **zero-migration, zero-money-spine** bundle. Companion docs: handoff
> `r-register-closeout-bundle-handoff-2026-06-07.md`, trace `r-register-closeout-trace-2026-06-07.md`,
> build plan `r-register-closeout-build-plan-2026-06-07.md`, register
> `publisher-api-keys-audit-2026-05-28.md`. Audit artifacts under `.audit/r-*`.

## Honest framing

This is **hygiene, not heroics** — and deliberately so. Six small, off-spine items closed together so
the register holds only founder-gated items afterward and the founder's F2+F4 deploy/publish bundle
stays schema-clean. No settlement, metering, pricing, payout, or rate-limit code was touched. The one
item with real correctness weight (#2) is a bounded, self-affecting TOCTOU; the rest are a dead-code
removal, a client-invisible fast-fail, two email-template renders, regression-guard tests, and a copy
fix. The value is a clean steady state, not new capability.

## What shipped, per item

- **(R)-1 / F3 — RESOLVED.** Deleted the dead `requireApiKey` export + the now-orphaned
  `AuthenticatedApiKey` interface from `apps/web/src/lib/middleware/auth.ts`, and trimmed the imports
  that were unique to it (`createHash` from `crypto`; `apiKeys` from the schema import). Reworded the
  one contrast comment that named it (`apps/web/src/app/api/proxy/[slug]/route.ts` docblock — **comment
  only**; no proxy code touched). Zero-reference proof re-derived (grep: the export had no static/
  dynamic/string/test references; the `scripts/gen/batch3e3.mjs` token is a different local function).
- **(R)-2 / #2 — RESOLVED (no migration).** The active-key-cap check + key insert in
  `apps/web/src/app/api/dashboard/developer/api-keys/route.ts` POST now run inside one `db.transaction`,
  with the **developer row locked `FOR UPDATE`** as the serializer before the count. Two concurrent
  creates for the same developer can no longer both pass the cap (TOCTOU closed). Idiom mirrors the
  in-repo precedent `lib/payouts/process.ts:205-220`; deadlock-free (all developers-row writers —
  payouts, reconciler, GDPR-deletion `lib/settlement/compliance.ts:426-454` — acquire that row first).
  **Response contract byte-identical** (422 `MAX_KEYS_EXCEEDED` exact message; 201 `{key, apiKey{…}}`;
  txn-throw → existing 500 path). **No column/index/migration.**
- **(R)-3 / #4 — RESOLVED.** `authenticateDeveloperByApiKey` in
  `apps/web/src/app/api/tools/publish/route.ts` now fast-fails a non-`sg_pub_` key **before** hashing.
  The prefix constant `PUBLISHER_API_KEY_PREFIX` is now exported from `lib/crypto.ts` (one keyword;
  `hashApiKey` + key formats untouched) and read by the route. The throw uses the **same** message as
  the hash-miss path, so the 401 is **byte-identical for every input class** — clarity/fast-fail, not a
  security change (the hash lookup remains the real gate).
- **(R)-4 / #7 — RESOLVED.** `publisherApiKeyCreatedEmail` and `publisherApiKeyRevokedEmail`
  (`apps/web/src/lib/email.ts`) now render the recipient via
  `the SettleGrid account associated with <strong>${escapeHtml(email)}</strong>`, mirroring
  `accountDeletedEmail`. The previously-unused `email` param is now consumed; interpolation is escaped.
- **(R)-5 / #8 — RESOLVED (highest-value cases).** NEW
  `apps/web/src/components/__tests__/api-key-reveal-dialog.test.tsx` (7 tests) pins the
  unrecoverable-secret guard: a **failed clipboard copy shows the manual-copy toast and does NOT
  dismiss** the dialog (the key stays on screen), success is decoupled from dismissal, the key renders
  in the select-all `<code>`, label renders, null→closed. `email.test.ts` gained 11 tests (recipient
  render + escaped hostile recipient + **label XSS** guards for both publisher templates).
  - **Documented residual (honest):** the page-level `loadApiKeys`-failure→retry case (#8's middle
    case) is **not testable in this repo's idiom** — the behavior exists and is correct (settings page
    `loadApiKeys` + the Retry button), but the project runs vitest in `environment: 'node'` with **no
    jsdom / @testing-library** (a standing infrastructure decision — see
    `src/components/telemetry/__tests__/emitters.test.tsx` header), and the state machine lives inside a
    2168-line client component. Testing it would require new devDependencies or a page refactor — both
    out of this chunk's scope. The server half (GET failure → non-ok) is already pinned by the route
    tests. Disposition: documented, not silently dropped.
- **(R)-6 / nevermined nit — CLOSED.** `apps/web/src/app/compare/nevermined/data.ts` dropped the stale
  "at v0.1.0" from two strings (real Python-SDK version is 0.2.0; chose **versionless** phrasing so it
  needs no re-edit at publish time or next bump). The gating test
  `apps/web/src/app/__tests__/compare-nevermined.test.ts` stays green (it pins only
  `packages/sdk-python` + `not yet published`); its comment was aligned (comment-only).
- **(R)-7 / #6 — documented-wontfix.** No code change: the bootstrap script's per-row-ordering warning
  already exists (`apps/web/scripts/bootstrap__drizzle_migrations.sql` lines 28-29). Harmless
  (drizzle-kit reads `MAX(created_at)` only).

## Audit chain (the founder's hard gates)

- **Pre-build audit** (`.audit/r-prebuild/prebuild-audit.mjs`, 5 lenses → adversarial verify →
  guarded synthesis):
  - **R1** (`wf_e9d96131-510`): **PLAN_NEEDS_FIXES — 1 blocking** + 4 nits, NON-degraded (14 agents).
    The blocker was real and F2-class: the dialog-test react-mock recipe as first written would throw
    `ReferenceError: React is not defined` (the project compiles JSX classic — `jsx: 'preserve'` + no
    `@vitejs/plugin-react`; mocking `react` removes the `React` binding). The auditor empirically
    reproduced it and verified the fix (a test-file-local `globalThis.React` shim). All 5 fixes applied
    to the plan + trace.
  - **R2** (`wf_ce53b375-a41`, after two transient-throttle deaths the degraded-guard correctly
    rejected): **PLAN_READY — 0 blocking — NON-degraded** (11 agents, ~1M tokens). One confirmed-real
    docs-only nit (bootstrap warning cited 27-29 → 28-29; fixed). Verdicts:
    `.audit/r-prebuild/round{1,2}-verdict.txt`.
- **Post-build panel + certification** (`.audit/r-postbuild/panel.mjs`, 5 lenses incl. the mandatory
  **ZERO-SPINE-DIFF** lens, `wf_c17a05c8-bc5`): **CERTIFIED — 0 blocking — NON-degraded** (7 agents).
  Sole finding = a self-refuted cosmetic nit on an internal build-summary wording (fixed). Verdict:
  `.audit/r-certify/certification-verdict.txt`.

## Machine gates (end state)

- apps/web: `tsc --noEmit` **0** · `vitest` **4282 passed / 181 files** (= 4261 baseline + **21** new:
  1 api-keys + 2 publish + 11 email + 7 dialog) · `next build` **0** · `eslint` **0** on all 12 changed
  files.
- packages/mcp: `vitest` **1898 passed / 1 skipped** — UNCHANGED (untouched-proof).
- Python family / `drizzle/` / `packages/*`: **zero hunks** (`git diff --numstat` + `git status
  --porcelain`: 11 tracked apps/web files + 1 untracked test + 2 untracked docs only).
- **Fail-pre-fix proven empirically** (`.audit/r-build/`): (R)-2 (txn-structure test + re-queued 422 →
  fail pre-fix), (R)-3 (no-DB-query fast-fail → fail pre-fix), (R)-4 (4 behavior-change recipient
  tests → fail pre-fix; 7 regression guards correctly pass pre-fix). (R)-5 regression guards
  spot-proven (injecting a dismiss-on-failure regression trips the guard).

## Scope (byte-stable spine held)

Zero hunks in: the money spine (`api/sdk/meter*`, `validate-key`, `proxy/[slug]` settlement logic —
only its docblock comment changed, `lib/settlement/**`, `metering`/`pricing`/`payouts`,
x402/ap2/circle-nano/outcomes/settlements/cron, the reconciler + B4 semantics); `lib/rate-limit.ts` +
all limiter keying; `lib/crypto.ts hashApiKey` + key formats; `revenueSharePct`; all of `packages/mcp`;
all of `packages/sdk-python*`; the DB schema + `drizzle/` (**zero migrations**).

## Residuals / what this chunk did NOT do

- Register **#1** (CLOSED earlier via H1+M+N), **#3** (HMAC-pepper — (K), de-recommended), **#5**
  (CLOSED in M+E) are not this chunk. **#6** is documented-wontfix (above).
- (R)-5(b) page-level retry test — documented-not-testable (above).
- **Nothing deployed / pushed / published / migrated.** Prod runs `origin/main`; the local stack
  (now incl. this chunk's commit, once founder-approved) is NOT pushed. The F2+F4 deploy/publish
  bundle remains founder-actionable and schema-clean.

## Next chunk

Per Step-0: **(C) `revenueSharePct` legacy cleanup** is the natural **first post-deploy chunk** (it
wants a migration → keep the deploy bundle schema-clean). See
`next-chunk-handoff-2026-06-07-post-r.md`.
