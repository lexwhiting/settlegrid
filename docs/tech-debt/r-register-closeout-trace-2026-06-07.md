# (R) Register close-out bundle — DISCOVERY TRACE (2026-06-07)

> Phase-1 artifact per `r-register-closeout-bundle-handoff-2026-06-07.md` §4.
> Every claim below is grounded in a file:line read **this session** at HEAD `fe8dbdd5`.
> Status: COMPLETE — feeds the Phase-2 build plan.

## 0. Ground state (verified this session)

- **HEAD = `fe8dbdd5`** ("docs(hardening): (R) register close-out bundle chunk handoff…"), tree clean,
  branch `main`. The handoff body cited HEAD `fa7b7dbb` — that was pre-handoff-commit; `fe8dbdd5` is
  the handoff commit itself sitting on top of `fa7b7dbb` (F4). Matches the kickoff prompt exactly.
- **Origin drift (non-blocking ground-state note):** `origin/main` = `9d22fd2e` ("feat(web): finish
  DEBT #1 — getClientIp call-site migration (208 files) + (E) processDataExport guard"), NOT
  `93767508` as handoff §2 stated. `93767508` is an ancestor of `9d22fd2e` — the earlier part of the
  stack (incl. B4 `be43b501`) has been pushed since the handoff snapshot. The local UNPUSHED stack is
  the 9 commits `d1b0297f..fe8dbdd5` (incl. N `aa580355`, F2 `2b479a3e`, F4 `fa7b7dbb`). Nothing in
  this chunk pushes anything; no impact.
- **Baselines re-run GREEN this session** (logs in `.audit/r-prebuild/baselines/`):
  - apps/web: `npx tsc --noEmit` exit 0, 0 lines · `npx vitest run` **4261 passed / 180 files**
    (exit 0) · `npx next build` exit 0, "Compiled successfully in 50s" (the dynamic-server-usage
    stderr entries are benign — API routes opting into dynamic rendering).
  - packages/mcp: `npx vitest run` **1898 passed / 1 skipped (52 files)**, exit 0.
  - Python family: no suite runs (byte-stable scope); `git diff --numstat` will be the proof.
- **DB driver** (`apps/web/src/lib/db/index.ts:1-39`): `drizzle-orm/postgres-js` over the `postgres`
  client (lazy Proxy init, `prepare: false`). postgres.js implements real interactive transactions
  (drizzle `db.transaction` → `sql.begin()`, single reserved connection); `prepare:false` is
  pgbouncer-compat and does not affect txn support. The Proxy binds methods to the real db —
  `db.transaction(cb)` works (and is already used in prod code, see (R)-2 precedents).

## 1. (R)-1 — F3 dead `requireApiKey` export

- Definition: `apps/web/src/lib/middleware/auth.ts:155-200` (`export async function requireApiKey`).
  File is 201 lines; also exports `requireDeveloper` (:52), `requireConsumer` (:105) — both heavily
  used; NOT touched.
- **Zero-reference proof (repo-wide grep, all of .ts/.tsx/.js/.mjs/.py/.md/.json, node_modules/.next
  excluded):** code references = the definition itself + ONE prose contrast comment at
  `apps/web/src/app/api/proxy/[slug]/route.ts:93`. All other hits are docs/tech-debt history.
  `scripts/gen/batch3e3.mjs:57` defines its OWN local `requireApiKey(): string` (self-contained
  generator helper; defines at :57, calls at :82/:97/:106; no import from middleware/auth) — same
  name, different symbol, unaffected.
- **Unique dependencies to remove with the function:**
  - `createHash` import (auth.ts:4) — only used at :168 inside requireApiKey.
  - `apiKeys` in the schema import (:6) — only used at :170-191 inside requireApiKey
    (`developers`/`consumers` stay).
  - `AuthenticatedApiKey` interface (:18-22) — only used at :157 (its return type); zero external
    importers (repo-wide grep: definition + :157 only). Remove.
  - `NextRequest`, `eq`, `db` — used by the surviving functions; stay.
- **No test references the export** (grep over all *.test.* = zero hits) → zero forced test edits.
- **Proxy comment rewording** (`proxy/[slug]/route.ts:91-95`, docblock of
  `authenticateProxyRequest`): current text "Unlike requireApiKey from auth middleware, this does
  NOT restrict to a specific toolId — we match by slug instead so the proxy works across tools."
  → drop the dead-symbol contrast, keep the semantics: "Does NOT restrict to a specific toolId —
  we match by slug instead so the proxy works across tools." Comment-only edit in that file
  (explicitly allowed by handoff §3).

## 2. (R)-2 — #2 active-key cap TOCTOU → transactional guard (NO migration)

- **Verified route:** `apps/web/src/app/api/dashboard/developer/api-keys/route.ts` (178 lines).
  `MAX_ACTIVE_KEYS = 10` at :21 ✓. The soft check spans **:100-113** (handoff's ":105-109" drifted):
  select `.limit(MAX_ACTIVE_KEYS + 1)` at :101-105, count compare + early-return at :107-113.
  Insert at :117-131 (`.values(...).returning(...)`). Key generation `generatePublisherApiKey()` at
  :115 (between check and insert).
- **Response contracts to preserve byte-identical:**
  - cap-exceeded: `errorResponse("You have reached the maximum of ${MAX_ACTIVE_KEYS} active API
    keys. Revoke an existing key before creating a new one.", 422, 'MAX_KEYS_EXCEEDED')` (:108-112).
  - success: `successResponse({ key, apiKey: {id, keyPrefix, label, status, createdAt} }, 201)`
    (:161-173).
  - errors: txn-thrown → outer catch (:174-176) → `internalErrorResponse` → 500 INTERNAL_ERROR —
    same as today's insert-failure path. `parseBody` 422 VALIDATION_ERROR path (lib/api.ts:101-102)
    is BEFORE the txn — unperturbed.
- **Auth context:** `requireDeveloper(request)` → `{id, email}`; the route itself never queries
  `developers` (auth.ts does internally). The txn therefore adds a NEW lock-anchor select.
- **Lock anchor decision — the developer row via `SELECT … FOR UPDATE`:** exact in-repo template at
  `apps/web/src/lib/payouts/process.ts:205-220`: `db.transaction(async (tx) => { const [developer]
  = await tx.select({...}).from(developers).where(eq(developers.id, developerId)).for('update')
  .limit(1); … })` with a discriminated-union return mapped to HTTP outside. Second precedent
  `apps/web/src/lib/settlement/reconcile.ts:221-243` (db.transaction, throw→rollback semantics).
- **Deadlock analysis (completed per R1 audit):** all existing developer-row writers acquire the
  developers row FIRST (payouts preflight: SELECT FOR UPDATE :206-220; reconciler: UPDATE
  developers :222-226 then tools :237-242; the GDPR-deletion txn
  `lib/settlement/compliance.ts:426-454`: UPDATE developers :429-445 THEN DELETE developerApiKeys
  :452-454 — same forward order). The new txn locks developers first, then touches only
  developerApiKeys; no txn anywhere locks developerApiKeys-then-developers. Single-anchor
  consistent ordering → no new deadlock cycle.
- **Lock-row-not-found semantics:** if the developer row vanished between auth and txn (account
  deletion race), the lock select returns 0 rows (no lock), count proceeds, insert fails on FK →
  rollback → 500 — IDENTICAL to today's insert-FK-failure behavior. No new check needed (and adding
  one would change the response contract).
- **Shape decision:** keep statement order inside the callback identical to today (lock → count →
  cap-check → generate → insert), return `{capExceeded: true} | {capExceeded: false, created, key,
  prefix}`; audit-log + notification email stay AFTER the txn (fire-and-forget; don't hold the lock).
- **Existing tests + forced edits** (`api-keys/__tests__/route.test.ts`, 232 lines, covers GET/POST
  + [id] DELETE):
  - Mock harness: flat chainable `mockDb` (:13-29) — `select/from/where/orderBy/limit/insert/
    values/returning/update/set`; `limit` and `returning` are the resolving terminals. beforeEach
    (:102-117) `mockReset().mockResolvedValue([])`s `limit` (default `[]`).
  - **Forced edit 1:** `mockDb.transaction: vi.fn(async (cb) => cb(mockDb))` must be added (tx ≡
    mockDb so all existing chain mocks keep working; rejections propagate naturally).
  - **Forced edit 2:** `for: vi.fn().mockReturnThis()` must be added (lock select chains
    `.for('update')` before `.limit(1)`, mirroring payouts).
  - **Forced edit 3:** schema mock (:33-45) only stubs `developerApiKeys` → must add a `developers`
    stub (`{id: 'id'}` suffices) or `eq(developers.id, …)` throws TypeError.
  - **Forced edit 4:** the lock select consumes the FIRST `mockDb.limit` resolution in POST. The
    "201" test (:146-160, queues count `[]` at :147) and the "422 cap" test (:162-169, queues the
    10-key array at :163) must queue the lock-row result `[{id:'dev-1'}]` FIRST, count second.
    (Without the edit the 422 test would mis-route its queue: lock eats the 10-key array, count
    falls to default `[]` → insert proceeds → returning default `[]` → destructure crash → 500 —
    i.e. it FAILS, proving the edit is forced, not cosmetic.) GET/DELETE tests unaffected (GET's
    list-select still consumes its own first limit; DELETE handlers untouched).
  - drizzle-orm mock (:47-51) already provides `eq`/`and`/`desc` — the lock select needs only `eq`.
    No edit.
- **Race regression test design (honest):** TRUE concurrency is NOT testable under this all-mock
  harness (no real locks). Per handoff: pin the transactional STRUCTURE instead and say so:
  (a) cap check + insert execute inside ONE `db.transaction` (assert `mockDb.transaction` called
  once; insert/returning invoked within the callback); (b) the serializer is real (assert
  `mockDb.for` called with `'update'` and the lock select targeted `developers` by `auth.id`);
  (c) cap-exceeded inside the txn → 422 MAX_KEYS_EXCEEDED, exact message, NO insert.
  **Fail-pre-fix property is genuine:** on pre-fix code `db.transaction` and `.for` are never
  invoked → assertions (a)/(b) fail; (c)'s "inside-the-txn" form also fails pre-fix (transaction
  never called).

## 3. (R)-3 — #4 `sg_pub_` prefix fast-fail in publish auth

- **Verified:** `apps/web/src/app/api/tools/publish/route.ts` — `authenticateDeveloperByApiKey`
  :149-184. Checks: missing key :154-156 → `AuthError('API key required. Provide x-api-key
  header.')`; `rawKey.length < 16` :158-160 → `AuthError('Invalid API key format.')`; inline
  sha256 :162 (does NOT import from lib/crypto.ts); join lookup :164-169; miss :171-173 →
  `AuthError('Invalid API key.')`. ALL AuthErrors map at :216-218 → `errorResponse(message, 401,
  'UNAUTHORIZED', requestId)`. The handoff's ":158" held.
- **Prefix constant:** `apps/web/src/lib/crypto.ts:4` `const PUBLISHER_API_KEY_PREFIX = 'sg_pub_'`
  — **module-private (not exported)**. `sg_pub_` appears in NO other non-test source file
  (repo-grep) → exporting the constant preserves the single source of truth. Decision: add
  `export` (one word) + import in the publish route. This does NOT touch `hashApiKey` (:37-39) or
  any key format — handoff §3 explicitly anticipates "the #4 prefix check reads the constant".
  (Alternative — inline the literal — carried in the plan as rejected: it duplicates the constant.)
- **Response parity decision:** today a 16+-char NON-prefixed key → hash-miss → 401 UNAUTHORIZED
  `'Invalid API key.'`. The fast-fail will throw `AuthError('Invalid API key.')` — the SAME message
  as the hash-miss path — so the response is **byte-identical for every input class**; the only
  observable deltas are timing and no DB query. (Rejected alternative: `'Invalid API key format.'`
  — semantically apt but changes the message for that input class; the handoff's "behaviorally
  indistinguishable to clients" wins.) A code comment will record why the message matches.
- **Placement:** after the length check (:158-160), before the hash (:162) — a third standalone
  `if`, matching the existing sequential-ifs style.
- **Existing tests + forced edits** (`tools/publish/__tests__/route.test.ts`, 306 lines):
  - **Forced edit (the F2-lesson catch):** the shared fixture `makeRequest()` sends
    `'x-api-key': 'sg_live_testkeyplaceholder123456789012'` (:113) — a CONSUMER-prefixed key.
    Post-fix, EVERY test would 401 at the prefix gate before reaching publish logic. Fix: change
    the fixture to `'sg_pub_testkeyplaceholder123456789012'` (38 chars, passes length+prefix; the
    mocked join then behaves exactly as before). One line; no assertion changes.
  - The auth docblock :119-126 ("first mockDb.limit call resolve to a row") stays true post-fix.
  - No other test file references the endpoint (repo-grep). Non-test references are marketing/docs
    prose + a comment in compliance.ts:451 — none send keys.
- **New fast-fail test (fails pre-fix):** request with a 16+-char non-`sg_pub_` key (e.g. the old
  `sg_live_…` fixture), queue the auth-miss `[]`; assert 401 + `data.error === 'Invalid API key.'`
  (byte-parity demonstrated) **and `mockDb.select` never called** (DB untouched). Pre-fix the
  select-assertion fails (route queries the DB); post-fix it passes. Also a positive companion:
  an `sg_pub_` key still reaches the join (select called) — guards against an over-eager gate.
- **Client-compat note:** any client sending a non-`sg_pub_` key to publish ALREADY fails (publisher
  keys live in `developer_api_keys`; `sg_live_` keys hash-miss). `packages/publish-action` passes
  the user's key straight through (src/index.ts:39,110 — no fixtures, no prefix logic). The
  fast-fail cannot break a working client.

## 4. (R)-4 — #7 render the `email` param in the two publisher key emails

- **Verified:** `apps/web/src/lib/email.ts` — `publisherApiKeyCreatedEmail(email, keyPrefix,
  options)` :562-597; `publisherApiKeyRevokedEmail(email, keyPrefix, options)` :599-625. Both
  accept `email` and never render it. Precedent `accountDeletedEmail` :717-741 renders
  "Your SettleGrid account associated with `<strong>${escapeHtml(email)}</strong>` has been…" (:733).
- **Fix shape (mirror precedent, escaped):**
  - Created (:583): "A new publisher API key was created on **the SettleGrid account associated
    with `<strong>${escapeHtml(email)}</strong>`**. Use it to publish tools programmatically via…"
  - Revoked (:612): "A publisher API key on **the SettleGrid account associated with
    `<strong>${escapeHtml(email)}</strong>`** has been revoked and will no longer authenticate
    tool publishing."
- **`escapeHtml`** is defined+exported in email.ts itself :2483-2490 (5-entity replace incl.
  quotes) — in-module, no import needed. Repo rule honored: every user-influenced string in these
  templates already goes through it (`label` :568/:605, `keyPrefix` :586/:615, `ip` :574, UA :575).
- **Existing email tests:** `src/lib/__tests__/email.test.ts` (395 tests, per-template describe
  blocks, string-contains style, e.g. `apiKeyCreatedEmail` :767-831 incl. an XSS case :790-793
  passing `'<img src=x>'` and asserting `'&lt;img src=x&gt;'`). **Neither publisher template is
  imported/tested anywhere** (only mocked in the route test) → ZERO forced edits; new coverage is
  purely additive describe blocks in email.test.ts.
- **New assertions (fail-pre-fix):** rendered html `toContain('user@test.com')` (and the escaped
  form for a hostile email like `'a<b@evil.com'` → `'a&lt;b@evil.com'`) — both FAIL on pre-fix
  templates (email never rendered). The (R)-5(c) label-XSS test joins these same describe blocks
  (one place, no duplication): malicious `label` `'<img src=x onerror=alert(1)>'` → html contains
  the escaped form and NOT the raw form (regression guard pinning EXISTING escaping).

## 5. (R)-5 — #8 client tests: Settings API-keys UI + email templates

- **Settings page:** `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx` — 2168 lines,
  `'use client'`, single monolithic `SettingsPage` (~30 useState hooks; IntersectionObserver
  scroll-spy :497-516; next/navigation; toast context). API-keys section :1664-1763:
  - state :336-343 (`apiKeys`, `apiKeysLoading`, `keyLabel`, `creatingKey`, `newlyCreatedKey`,
    `newlyCreatedKeyLabel`, `revokingKeyId`, `apiKeysError`);
  - `loadApiKeys` :520-534 — fetch → `!res.ok` throws → catch `setApiKeysError(true)` (comment:
    an empty list must never masquerade as "no keys" on transient error); finally clears loading.
  - **Retry state EXISTS** :1706-1715 — error branch renders "Couldn't load your API keys." + a
    Retry button wired `onClick={() => { setApiKeysLoading(true); loadApiKeys() }}`. Register
    assumption (b) HOLDS — no behavior gap, no finding.
  - `createApiKey` :540-562 → `setNewlyCreatedKey(data.key)` → `<ApiKeyRevealDialog>` :1676-1680.
- **Reveal dialog:** `src/components/api-key-reveal-dialog.tsx` (160 lines) — **keeps-key-visible
  behavior EXISTS**: `handleCopy` :64-81 calls `copyToClipboard(apiKey)`; on `false` → error toast
  "Could not copy automatically — select the key and copy it manually before closing." and does NOT
  call `onClose`; the key stays rendered in a `select-all` `<code>` :122-128; dialog open state is
  parent-controlled (`open={Boolean(apiKey)}` :85); outside-click dismissal suppressed :96-97.
  Register assumption (a) HOLDS.
- **`copyToClipboard`** (`src/lib/clipboard.ts`) — never-throws contract, false on failure;
  **already tested** (`src/lib/__tests__/clipboard.test.ts` exists). No new lib tests needed.
- **Test-harness reality (decisive):** vitest `environment: 'node'` (vitest.config.ts);
  **no jsdom / no @testing-library/react anywhere** (grep of both package.json files). The repo's
  documented stance (`src/components/telemetry/__tests__/emitters.test.tsx` header): "Tested
  without @testing-library/react or jsdom — those deps aren't in the web project and adding them
  would be infrastructure, not a test." Established idioms: (i) test exported helpers directly
  (`button.test.ts` → buttonVariants; `demo-response-viewer.test.ts` → buildTranscript);
  (ii) component-as-function with react hooks mocked (emitters.test.tsx mocks `useEffect` to fire
  synchronously and calls components as plain functions).
- **What is testable in-idiom:**
  - **(a) clipboard-failure keeps key visible → YES**, against `ApiKeyRevealDialog` as-function:
    mock `@/lib/clipboard` (`copyToClipboard` → false), `@/components/ui/toast` (`useToast` →
    captured `toast` spy), and `react` (`useState` → `[init, vi.fn()]`, `useRef` → `{current:
    init}`, `useEffect` → noop; real hooks throw outside a renderer). **R1-audit correction
    (blocker, fixed in plan):** the dialog RETURNS JSX while importing only named hooks; with
    `jsx: "preserve"` + no vite react plugin, esbuild compiles JSX to the CLASSIC
    `React.createElement` form → mocking `react` leaves no `React` binding and every test throws
    `ReferenceError: React is not defined`. The recipe therefore MUST add a test-file-local
    classic-runtime shim (`Object.assign(globalThis, { React: actual })` inside the mock factory,
    + top-level belt-and-braces). The emitters precedent proves the hook-mocking technique only
    for null-returning components (no JSX construction) — it does NOT cover this case; the R1
    auditor empirically verified the shimmed recipe passes all named behaviors. Call
    `ApiKeyRevealDialog({apiKey, keyLabel, onClose})`, walk the returned element tree to the Copy
    button, invoke its `onClick`: assert error-toast fired with the exact manual-copy message,
    `onClose` NOT called (≡ dialog not dismissed ≡ key not lost), and the `<code>` node renders
    the full key. Success-path companion: `copyToClipboard` → true → success toast, `onClose`
    still not called (copy decoupled from dismiss). Placement:
    `src/components/__tests__/api-key-reveal-dialog.test.tsx` (mirrors the existing
    components/__tests__ home; deviation from the handoff's suggested
    `settings/__tests__/` placement is deliberate — the artifact under test is the component, and
    the page-level dir would otherwise hold zero tests, see next bullet).
  - **(c) email label-XSS → YES** — folded into (R)-4's email.test.ts blocks (decided there).
  - **(b) `loadApiKeys` failure → retry → NOT testable in-idiom (honest finding):** the state
    machine lives inline in the 2168-line page component; function-calling it in node env would
    require mocking ~30 ordered useState hooks + next/navigation + toast context +
    IntersectionObserver + window/document — a fake-renderer reimplementation, brittle and far
    outside "line-surgical". The behavior EXISTS and is correct (verified :520-534/:1706-1715 this
    session). Disposition for the plan: document-as-is + founder note naming the real enabler
    (jsdom + @testing-library devDeps = an infrastructure decision the repo has explicitly
    declined so far, emitters.test.tsx header). NOT silent scope growth; NOT a skipped register
    item — #8's risk intent is covered at its two highest-value points ((a) secret-loss, (c) XSS),
    and (b)'s server half (GET failure → non-ok) is already pinned by the route tests.
- **Classification honesty:** all (R)-5 tests are REGRESSION GUARDS pinning existing behavior —
  the fail-pre-fix rule applies to (R)-2/3/4 only. Spot-proof for (a) where cheap: locally invert
  the `ok` branch (or point copyToClipboard mock true→false expectations) to watch the guard trip;
  recorded in `.audit/r-build/` during Phase 4.

## 6. (R)-6 — F4 residual: nevermined "v0.1.0" copy

- **Real path:** `apps/web/src/app/compare/nevermined/data.ts` — there is NO `(marketing)` route
  group; the handoff §1/§6 path `app/(marketing)/compare/nevermined/data.ts` DRIFTED (route-group
  decoration that doesn't exist on disk). Same file, corrected path. Gating test likewise lives at
  `src/app/__tests__/compare-nevermined.test.ts` (not nevermined-local).
- **The two strings (line numbers held):**
  - :169 `'@settlegrid/mcp + ai-sdk + mastra + langchain + n8n + cursor on npm; packages/sdk-python
    at v0.1.0 not yet published to PyPI'`
  - :264 `"payments-py is published to PyPI. SettleGrid's settlegrid Python SDK lives in
    packages/sdk-python at v0.1.0 but is not yet published."`
- **Repo truth:** `packages/sdk-python/pyproject.toml:7` `version = "0.2.0"`.
- **Sweep:** app-wide non-test grep for `0.1.0` → only these two + `src/lib/integration-guides.ts:136`
  which is **@langchain/core's peer-dep version** (unrelated; untouched).
- **Phrasing decision — versionless** (handoff preference; never needs re-editing at publish time
  or next bump): :169 → `…packages/sdk-python not yet published to PyPI`; :264 → `…lives in
  packages/sdk-python but is not yet published.` Both tolerate versionless cleanly.
- **Gating test stays green:** `compare-nevermined.test.ts:437-442` asserts only
  `toContain('packages/sdk-python')` + `toContain('not yet published')` — both still true. The
  :438-439 comment mentions "at v0.1.0" — comment-only; plan proposes dropping the version from the
  comment in the same spirit (1 line, keeps the test's prose honest; audit may strike).
- **Citation-policy check (data.ts header :15-23):** the "update the reviewed date" convention
  binds NUMERIC COUNTS (templates/adapters), not SDK-version prose — no reviewed-date bump; this
  is a stale-qualifier removal, not a count refresh.

## 7. (R)-7 — #6 bootstrap `created_at` (disposition only)

- **Real path:** `apps/web/scripts/bootstrap__drizzle_migrations.sql` (120 lines; register's
  `scripts/…` is apps/web-relative).
- **The warning the handoff conditioned on IS ALREADY PRESENT** — header lines 28-29: "Note: only
  MAX(created_at) is consulted by drizzle-kit migrate's skip logic; per-row ordering of older
  entries is not consulted." → **ZERO code/comment changes**; pure register disposition
  ("documented-wontfix") at close-out.

## 8. Consolidated forced-test-edit inventory (the F2 lesson)

| Item | File | Forced edit |
|---|---|---|
| (R)-2 | `api-keys/__tests__/route.test.ts` | add `transaction` + `for` to mockDb; add `developers` to schema mock; re-queue `limit` Onces in the two POST tests (lock-row first) |
| (R)-3 | `tools/publish/__tests__/route.test.ts` | fixture key `sg_live_…` → `sg_pub_…` (one line, :113) |
| (R)-4 | `src/lib/__tests__/email.test.ts` | none forced (templates untested today); additive describes only |
| (R)-5 | new `src/components/__tests__/api-key-reveal-dialog.test.tsx` | new file; no existing-file edits |
| (R)-6 | `src/app/__tests__/compare-nevermined.test.ts` | none forced (assertions hold); optional 1-line comment alignment |
| (R)-1/7 | — | none (zero test references) |

## 9. Handoff/register drift corrections recorded

1. Handoff §2 "origin/main = 93767508" → origin moved to `9d22fd2e` (B4 + getClientIp pushed).
2. Handoff §1 (R)-2 ":105-109" → soft check actually :100-113 (same code, drifted lines).
3. Handoff §1/§6 nevermined path `(marketing)/compare/…` → real `src/app/compare/nevermined/…`;
   gating test at `src/app/__tests__/compare-nevermined.test.ts`.
4. Handoff §1 (R)-5 suggested test placement `settings/__tests__/` → superseded by harness reality
   (components/__tests__ + no page-level tests possible in-idiom; see §5).
5. Register #2 location "api-keys/route.ts" was already corrected by the handoff to the full
   dashboard path — re-confirmed this session.

## 10. Scope-boundary pre-checks

- `sg_pub_` has ZERO footprint in `packages/mcp` and `packages/sdk-python` (grep exit 1) — the
  fast-fail cannot interact with byte-stable packages. `packages/publish-action` forwards the
  user's key verbatim (no fixtures) — unaffected, stays byte-stable.
- No item touches: meter/validate-key/proxy settlement logic (the (R)-1 proxy edit is a docblock
  comment only), lib/settlement/**, metering/pricing/payouts, rate-limit keying, `hashApiKey`,
  `revenueSharePct`, drizzle/ (ZERO migrations), or any Python file.
