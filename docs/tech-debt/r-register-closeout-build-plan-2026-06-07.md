# (R) Register close-out bundle — BUILD PLAN (2026-06-07)

> **Status: PLAN_READY — Phase-3 pre-build audit PASSED (R2 attempt 3, runId `wf_ce53b375-a41`):
> PLAN_READY / 0 blocking / NON-degraded (0 dead lenses, 0 null verdicts, 11 agents). R1
> (`wf_e9d96131-510`) returned 1 blocker (the dialog react-mock `ReferenceError` trap) + 4 nits,
> ALL fixed; R2 confirmed clean with one docs-only off-by-one (bootstrap warning 27-29 → 28-29),
> now fixed. Verdicts: `.audit/r-prebuild/round{1,2}-verdict.txt`. Cleared for single-writer build.**
> Companion trace (every claim grounded at HEAD `fe8dbdd5` this session):
> `docs/tech-debt/r-register-closeout-trace-2026-06-07.md`.

## 1. Goal + honest value framing

Drain the register's entire remaining non-gated tail in one zero-migration, zero-money-spine
bundle: **F3 + #2 + #4 + #7 + #8 + the F4 nevermined copy nit** (+ #6 as a register-disposition
note only). This is **hygiene, not heroics**: one dead export, one bounded self-affecting TOCTOU,
one client-invisible fast-fail, two email-template improvements, regression-guard tests, one copy
fix. Value = a clean steady state (the register holds only founder-gated items afterward) and the
founder's F2+F4 deploy bundle stays schema-clean. No item touches settlement, metering, pricing,
payouts, or rate limiting.

## 2. Per-file recipes (exact)

### (R)-1 — F3: delete dead `requireApiKey` (+ comment reword)

**`apps/web/src/lib/middleware/auth.ts`** (zero-reference proof: trace §1)
1. Delete `export async function requireApiKey(…)` — lines :155-200 — and its docblock :152-154.
2. Delete `export interface AuthenticatedApiKey {…}` :18-22 (zero external importers).
3. Trim now-unused imports: remove `createHash` from the `'crypto'` import (line :4 — the whole
   line goes; `createHash` has no other use in the file); remove `apiKeys` from the schema import
   (:6 → `import { developers, consumers } from '@/lib/db/schema'`).
4. Survivors untouched: `requireDeveloper`, `requireConsumer`, both other interfaces,
   `createSupabaseFromRequest`.

**`apps/web/src/app/api/proxy/[slug]/route.ts`** — COMMENT-ONLY (docblock :91-95):
- From: `* Unlike requireApiKey from auth middleware, this does NOT restrict to a specific toolId —`
- To:&nbsp;&nbsp; `* Does NOT restrict to a specific toolId —`
- (second comment line `* we match by slug instead so the proxy works across tools.` unchanged;
  first docblock line unchanged). NOTHING else in this file changes — it is money-spine.

### (R)-2 — #2: transactional active-key cap guard (NO migration)

**`apps/web/src/app/api/dashboard/developer/api-keys/route.ts`**
1. Extend the schema import (:5): `import { developerApiKeys, developers } from '@/lib/db/schema'`.
2. Replace the soft-check + generate + insert block (:100-131) with one txn (template:
   `lib/payouts/process.ts:205-220`; statement order inside the callback preserved):
   ```ts
   // Enforce the per-developer active-key cap atomically. The developer row
   // is the lock anchor: SELECT … FOR UPDATE serializes concurrent creates
   // for the same developer so the count-then-insert can no longer race past
   // the cap (register #2 TOCTOU). Lock is held for DB-only work (<ms).
   const result = await db.transaction(async (tx) => {
     await tx
       .select({ id: developers.id })
       .from(developers)
       .where(eq(developers.id, auth.id))
       .for('update')
       .limit(1)

     const activeKeys = await tx
       .select({ id: developerApiKeys.id })
       .from(developerApiKeys)
       .where(and(eq(developerApiKeys.developerId, auth.id), eq(developerApiKeys.status, 'active')))
       .limit(MAX_ACTIVE_KEYS + 1)

     if (activeKeys.length >= MAX_ACTIVE_KEYS) {
       return { capExceeded: true as const }
     }

     const { key, hash, prefix } = generatePublisherApiKey()

     const [created] = await tx
       .insert(developerApiKeys)
       .values({
         developerId: auth.id,
         keyHash: hash,
         keyPrefix: prefix,
         label: body.label ?? null,
       })
       .returning({
         id: developerApiKeys.id,
         keyPrefix: developerApiKeys.keyPrefix,
         label: developerApiKeys.label,
         status: developerApiKeys.status,
         createdAt: developerApiKeys.createdAt,
       })

     return { capExceeded: false as const, created, key, prefix }
   })

   if (result.capExceeded) {
     return errorResponse(
       `You have reached the maximum of ${MAX_ACTIVE_KEYS} active API keys. Revoke an existing key before creating a new one.`,
       422,
       'MAX_KEYS_EXCEEDED'
     )
   }
   const { created, key, prefix } = result
   ```
3. Downstream (:133-173) unchanged except it now reads `created`/`key`/`prefix` from `result`
   (audit log + notification email stay AFTER the txn — fire-and-forget, no lock held; response
   literals byte-identical).
4. The existing comment at :20 ("Soft guard against unbounded key creation") is updated to drop
   "Soft" ("Cap on active (non-revoked) publisher keys per developer; enforced atomically inside
   a transaction — see POST. Revoked keys do not count toward the limit.").
5. GET handler untouched. `[id]/route.ts` (DELETE) untouched.

**Why this closes the race:** both concurrent POSTs must lock the same `developers` row before
counting; the second blocks until the first commits its insert, then counts 10 → 422. Lock-order
analysis (trace §2, completed per R1 audit): all existing developers-row writers acquire that row
first (payout preflight FOR UPDATE; reconciler UPDATE; and the one existing two-table txn — the
GDPR deletion at `lib/settlement/compliance.ts:426-454` — locks `developers` (UPDATE :429-445)
THEN `developerApiKeys` (DELETE :452-454), the SAME forward order as the new guard) and all hold
locks for DB-only work (the Stripe transfer is Phase-2, outside the txn — verified
`process.ts:355-359`); the new txn introduces no reverse-order lock pair → no deadlock. Developer-row-vanished race: lock select returns 0 rows → insert fails FK →
rollback → 500, byte-identical to today's insert-FK failure (no new check, deliberately).

**`…/api-keys/__tests__/route.test.ts`** — forced edits (trace §2/§8):
1. mockDb gains `transaction: vi.fn(async (cb) => cb(mockDb))` and `for: vi.fn().mockReturnThis()`
   (declare in the hoisted object as `mockDb: {…}` currently is — note the hoisted literal can't
   self-reference, so `transaction` is assigned right after the literal or via getter; simplest:
   declare the object, then `mockDb.transaction = vi.fn(async (cb) => cb(mockDb))` before return).
2. beforeEach: re-assert `mockDb.for.mockReturnThis()` + the `mockDb.transaction` impl after
   `vi.clearAllMocks()`. (Verified vitest 2.1.9 semantics, R1 audit: `clearAllMocks` = mockClear —
   it clears calls/instances/results but PRESERVES implementations and once-queues; only
   `mockReset`/`resetAllMocks` wipe implementations. The re-application is therefore
   redundant-but-safe belt-and-braces, exactly mirroring the file's existing per-mock
   `.mockReturnThis()` re-assertions at :104-111. Keep `for`/`transaction` OUT of the
   `mockReset()` list — only `limit`/`returning` are reset there.)
3. Schema mock adds `developers: { id: 'id' }`.
4. "201" test: queue `mockDb.limit.mockResolvedValueOnce([{ id: 'dev-1' }])` (lock row) BEFORE the
   existing count `[]` queue.
5. "422 cap" test: same lock-row queue first, THEN the 10-key array; add
   `expect(mockDb.transaction).toHaveBeenCalledTimes(1)` (cap evaluated inside the txn).
6. NEW test — "POST serializes cap-check + insert inside one db.transaction locked on the
   developer row": success-path queues; asserts `mockDb.transaction` called once;
   `mockDb.for` called with `'update'`; the lock select's `.where` received
   `eq(developers.id, 'dev-1')` (the drizzle-orm mock's `eq` returns `{eq: [a,b]}` → assert
   `mockDb.where` first call arg deep-equals `{ eq: ['id', 'dev-1'] }` — note schema-mock
   `developers.id === 'id'`); insert + returning invoked; response 201 with `key` string.
**Honest race-test classification:** TRUE concurrency is not provable under the all-mock harness
(no real locks). These tests pin the transactional STRUCTURE (txn + FOR UPDATE + in-txn count) —
stated plainly here and in the capstone. **Fail-pre-fix:** pre-fix code never calls
`db.transaction`/`.for` → new test fails; the re-queued "422 cap" test ALSO fails pre-fix
(lock-row queue misroutes: count falls to default `[]` → insert proceeds → returning `[]` →
destructure crash → 500 ≠ 422). Proof recorded per §6.

### (R)-3 — #4: `sg_pub_` prefix fast-fail

**`apps/web/src/lib/crypto.ts`** — ONE WORD: `:4` `const` → `export const`
(`PUBLISHER_API_KEY_PREFIX`). `hashApiKey`, key formats, `API_KEY_PREFIX` (consumer): untouched.

**`apps/web/src/app/api/tools/publish/route.ts`**
1. Import: `import { PUBLISHER_API_KEY_PREFIX } from '@/lib/crypto'`.
2. In `authenticateDeveloperByApiKey`, after the length check (:158-160), before the hash (:162):
   ```ts
   if (!rawKey.startsWith(PUBLISHER_API_KEY_PREFIX)) {
     // Fast-fail before hashing: publisher keys always carry the sg_pub_
     // prefix (issued by generatePublisherApiKey). Deliberately the SAME
     // message as the hash-miss path below so the fast-fail is
     // client-invisible (register #4: clarity/fast-fail, not a security
     // gate — the hash lookup remains the real gate).
     throw new AuthError('Invalid API key.')
   }
   ```
3. Nothing else in the route changes (quality gates, upsert, responses untouched).

**Client-visible delta: NONE** — a non-prefixed 16+-char key today: hash → join-miss → 401
UNAUTHORIZED `'Invalid API key.'`; post-fix: same status, same code, same message, same shape.
(Trace §3: rejected alternative `'Invalid API key format.'` — would change the message for that
input class; "behaviorally indistinguishable" wins.) No legitimate client breaks: publisher keys
are the only keys in `developer_api_keys`, and `packages/publish-action` forwards real keys
verbatim.

**`…/publish/__tests__/route.test.ts`** — forced edit + new tests:
1. FORCED: fixture key `:113` `'sg_live_testkeyplaceholder123456789012'` →
   `'sg_pub_testkeyplaceholder123456789012'` (every existing test then flows exactly as before).
2. NEW: "fast-fails a non-sg_pub_ key with the same 401 body and NO db query" — request built with
   the LITERAL inline `'sg_live_testkeyplaceholder123456789012'` string (NOT the shared fixture,
   which is now sg_pub_); assert status 401, `data.code === 'UNAUTHORIZED'`,
   `data.error === 'Invalid API key.'`, and `expect(mockDb.select).not.toHaveBeenCalled()`.
   **Fails pre-fix** via the select assertion (pre-fix the route queries; status/body identical in
   both worlds — that IS the parity demonstration).
3. NEW: "sg_pub_ keys still reach the hash lookup (gate is prefix-only, not over-eager)" —
   default fixture, queue auth-miss `[]`; assert 401 AND `mockDb.select` WAS called.

### (R)-4 — #7: render the escaped `email` (+ (R)-5(c) XSS tests)

**`apps/web/src/lib/email.ts`** — two body lines (mirror `accountDeletedEmail` :733):
1. `:583` (created): `…was created on your SettleGrid account. Use it…` →
   `…was created on the SettleGrid account associated with <strong>${escapeHtml(email)}</strong>. Use it…`
2. `:612` (revoked): `…A publisher API key on your SettleGrid account has been revoked…` →
   `…A publisher API key on the SettleGrid account associated with <strong>${escapeHtml(email)}</strong> has been revoked…`
3. `escapeHtml` is in-module (:2483) — no import. Subjects/preheaders/other params untouched.

**`apps/web/src/lib/__tests__/email.test.ts`** — additive only (templates untested today):
- Import `publisherApiKeyCreatedEmail`, `publisherApiKeyRevokedEmail`.
- `describe('publisherApiKeyCreatedEmail')` — 6 tests: subject; **renders recipient email**
  (`toContain('user@test.com')` — FAILS pre-fix); **escapes hostile recipient email**
  (`'a<b@evil.com'` → `'a&lt;b@evil.com'` present AND raw absent — FAILS pre-fix); masked key
  prefix (`'sg_pub_abcd...'`); label rendered when provided; **label XSS escaped** (=(R)-5(c):
  `'<img src=x onerror=alert(1)>'` → escaped present, raw absent — regression guard).
- `describe('publisherApiKeyRevokedEmail')` — 5 tests: subject; renders recipient email
  (fail-pre-fix); escapes hostile recipient email (fail-pre-fix); masked key prefix; label XSS
  escaped.

### (R)-5 — #8: client tests (dialog + email; page-level documented)

**NEW `apps/web/src/components/__tests__/api-key-reveal-dialog.test.tsx`** — 7 tests,
component-as-function (real hooks throw outside a renderer so mock `react`'s `useState` →
`[init, vi.fn()]`, `useRef` → `{current: init}`, `useEffect` → noop; passthrough the rest via
`importActual`; mock `@/lib/clipboard` and `@/components/ui/toast`).
**⚠️ FORCED SETUP (R1 audit blocker, empirically verified):** the dialog returns JSX and imports
only named hooks; `tsconfig jsx: "preserve"` + no `@vitejs/plugin-react` + vitest env `node` →
esbuild applies the CLASSIC `React.createElement` transform, so once `react` is mocked there is NO
`React` binding in scope and every test ERRORs `ReferenceError: React is not defined`. The
test file MUST install a classic-runtime shim: inside the react mock factory, after
`const actual = await importActual('react')`, do `Object.assign(globalThis, { React: actual })`
(plus the same assignment at test-file top-level as belt-and-braces; use `Object.assign` — no
`as any` — to stay eslint-clean). The shim is test-file-local; do NOT touch vitest.config
(esbuild jsx overrides would perturb other .tsx transforms — rejected). Precedent honesty: the
emitters.test.tsx precedent proves component-as-function + hook-mocking ONLY for null-returning
components (they never construct JSX); the JSX-constructing case additionally needs this shim —
the R1 auditor ran the shimmed recipe against the real dialog and ALL named behaviors passed.
Avoid JSX syntax in the test file itself (call the component as a plain function; walk the
returned element objects) so the shim is exercised only by the component under test. Tests:
1. failed copy → error toast with the exact manual-copy message;
2. failed copy → `onClose` NOT called (the dialog is parent-controlled `open={Boolean(apiKey)}`;
   not closing ≡ the key stays on screen);
3. the full key renders inside the select-all `<code>` node (element-tree walk);
4. successful copy → success toast `'API key copied to clipboard.'`;
5. successful copy → `onClose` STILL not called (Copy decoupled from Dismiss);
6. `keyLabel` renders when provided;
7. `apiKey == null` → Dialog `open === false` (closed dialog state).
A tiny local `findInTree(node, predicate)` walks `props.children` (no DOM, no renderer).
**Classification (honest):** ALL (R)-5 tests are regression guards pinning EXISTING verified
behavior (trace §5) — fail-pre-fix applies to (R)-2/3/4 only. Spot-proof during build: flip the
copy mock's branch expectation locally to watch guards 1/2 trip; recorded in `.audit/r-build/`.
**Page-level case (b) — `loadApiKeys` failure → retry — DOCUMENTED-NOT-TESTABLE in-idiom:** the
behavior exists and was verified this session (page :520-534, :1706-1715); testing it requires
jsdom/@testing-library (infrastructure the repo explicitly declines — emitters.test.tsx header) or
a page refactor (scope growth). Founder note in capstone; NOT silent scope growth. Placement
deviation from the handoff (`components/__tests__/` not `settings/__tests__/`) is deliberate: the
artifact under test is the component; a settings dir would hold zero tests.

### (R)-6 — nevermined version copy (versionless)

**`apps/web/src/app/compare/nevermined/data.ts`** (real path — trace §6; NO `(marketing)` group):
1. `:169` `'…packages/sdk-python at v0.1.0 not yet published to PyPI'` →
   `'…packages/sdk-python not yet published to PyPI'`
2. `:264` `"…lives in packages/sdk-python at v0.1.0 but is not yet published."` →
   `"…lives in packages/sdk-python but is not yet published."`
- No reviewed-date bump (citation policy binds numeric counts, not version prose — trace §6).
- `integration-guides.ts:136` "0.1.0" is @langchain/core's peer-dep — UNTOUCHED.

**`apps/web/src/app/__tests__/compare-nevermined.test.ts`** — OPTIONAL comment-only alignment
(:438-439 "at v0.1.0" → versionless); assertions untouched (they pin `'packages/sdk-python'` +
`'not yet published'`, both still true). Audit may strike the comment edit; build follows verdict.

### (R)-7 — #6: NO code change

Warning already present in `apps/web/scripts/bootstrap__drizzle_migrations.sql` header (lines
28-29; line 27 is the mtime sentence). Register disposition only: "documented-wontfix".

## 3. Behavioral deltas (complete list)

| Item | Server behavior | Client-visible |
|---|---|---|
| (R)-1 | none (dead code removed) | none |
| (R)-2 | count+insert now atomic under a developers-row lock; cap strictly enforced under concurrency | none (statuses/messages/shapes byte-identical; +<1ms lock) |
| (R)-3 | non-prefixed keys short-circuit before hash+DB | none (byte-identical 401) |
| (R)-4 | email bodies now include escaped recipient email | YES — the intended email content improvement |
| (R)-5 | none (tests only) | none |
| (R)-6 | marketing copy drops stale version | copy text (the fix itself) |

## 4. Test plan + machine gates

**Planned new tests: 21** — route.test.ts(api-keys) +1; route.test.ts(publish) +2;
email.test.ts +11; api-key-reveal-dialog.test.tsx +7 (new file). Edited-not-added: 2 POST tests
re-queued (api-keys), 1 fixture line (publish), optional comment (nevermined).

- **Fail-pre-fix (behavior-changing items) — proven empirically** (write tests first against
  pristine source OR stash-prove; transcript to `.audit/r-build/fail-pre-fix-proof.txt`):
  - (R)-2: new txn-structure test + re-queued 422 test both fail pre-fix (trace §2 mechanics).
  - (R)-3: no-DB-query test fails pre-fix (select called).
  - (R)-4: renders-recipient-email + escapes-hostile-email tests fail pre-fix (×2 templates).
- **(R)-5 regression guards** pin existing behavior (spot-proof noted above) — stated honestly.
- **Machine gates (end-state):**
  - apps/web: `tsc --noEmit` **0** · `vitest run` **4282 passed / 181 files** (= 4261 + 21; if the
    build lands a different N, the panel verifies final arithmetic against the diff — no silent
    drift) · `next build` **0** · `eslint` on all changed files **0**.
  - packages/mcp: `vitest run` **1898 / 1 skip** re-run as the untouched-proof.
  - Python family + drizzle/ + packages/*: **`git diff --numstat` PAIRED WITH `git status
    --porcelain` shows ZERO hunks/entries** outside the §2 file list + docs/tech-debt/*.md
    (R1 audit: bare numstat is untracked-blind — the porcelain pairing catches NEW files; the
    one planned NEW untracked file is `src/components/__tests__/api-key-reveal-dialog.test.tsx`,
    which numstat alone would miss until staged). The full planned changed-file list (12 code/test
    files): auth.ts, proxy/[slug]/route.ts (comment), dashboard api-keys route + its test,
    crypto.ts (export), publish route + its test, email.ts + its test, NEW dialog test, nevermined
    data.ts (+ optional its test comment).
- **Rollout:** nothing deploys; prod runs origin/main; the founder's F2+F4 deploy bundle is
  unaffected and stays schema-clean (ZERO migrations in this chunk).

## 5. SCOPE GUARD (handoff §3, embedded VERBATIM)

- **In scope (the six items, exactly):** (1) delete `requireApiKey` (auth.ts) + reword the
  proxy contrast comment; (2) transactional active-key-cap guard in
  `dashboard/developer/api-keys/route.ts` (NO new column/index/migration; identical response
  contract); (3) `sg_pub_` prefix fast-fail in `tools/publish/route.ts`
  (`authenticateDeveloperByApiKey`), response-parity preserved; (4) render the escaped `email`
  in the two publisher key emails (mirror `accountDeletedEmail`); (5) NEW client tests:
  Settings API-keys section (clipboard-failure, load-failure/retry) + email-template
  label-XSS; (6) nevermined data.ts Python-SDK version-copy fix. Plus docs-only: register
  updates (F3/#2/#4/#7/#8 RESOLVED; #6 documented-wontfix; nevermined nit closed), capstone,
  next-chunk handoff, memory.
- **OUT of scope (byte-stable — the diff must not touch):** **the entire money spine**
  (`api/sdk/meter*`, `validate-key`, `proxy/[slug]` settlement logic, `lib/settlement/**`,
  `lib/metering.ts`, `lib/pricing.ts`, `lib/payouts/**`, x402/ap2/circle-nano/outcomes/
  settlements/cron, the reconciler + B4's guarded semantics); `lib/rate-limit.ts` and ALL
  rate-limit keying (DEBT #1 is CLOSED — re-keying anything = re-litigating N); `lib/crypto.ts
  hashApiKey` + key formats ((K) de-recommended — the #4 prefix check reads the constant, it
  does NOT change hashing); `revenueSharePct` anywhere (= chunk (C), post-deploy);
  **ALL of `packages/mcp`**; **ALL of `packages/sdk-python*`**; the DB schema + `drizzle/`
  (**ZERO migrations**); auth middleware beyond deleting the dead export; F2/F4/B4/N/M/H1
  settled designs. **When in doubt, the smaller change wins.**

(Plan-level note: the (R)-5 settings-page test placement and the page-level (b) disposition are
within the §3 item-5 scope as the honest maximum the harness supports — see trace §5.)
