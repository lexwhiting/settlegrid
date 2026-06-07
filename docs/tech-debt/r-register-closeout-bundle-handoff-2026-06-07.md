# (R) Register close-out bundle — CHUNK HANDOFF (2026-06-07)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a
> verification facilitator) → use `/effort max`. This chunk is **deliberately OFF the money
> spine** (auth-adjacent key management, email templates, client tests, one copy fix) — but the
> repo's full gate discipline applies regardless: **discovery trace FIRST → build plan → deep
> independent PRE-BUILD AUDIT (PLAN_READY, 0 blocking, ALL fixes applied) BEFORE any
> implementation → single-writer build → post-build panel + certification (0 blocking) →
> founder-gated LOCAL commit.** NOTHING ships (push / prod-env / **migration** / PyPI/npm
> publish) without the founder's explicit word — and this chunk is **ZERO-MIGRATION by scope
> decision** (see §3).

---

## 0. Why this chunk (Step-0 scope study, founder-decided 2026-06-07)

**⚠️ STALE-CARRY CORRECTION (do not re-propagate):** the post-F4 menu
(`next-chunk-handoff-2026-06-06-post-f4.md`) named **B4 as the lead** — that was WRONG. B4 was
**already RESOLVED 2026-06-04** at commit `be43b501` (founder Step-0 option (B): settlement-row
`account_id` IS the developer id, permanent + guard-tested; pre-build PLAN_READY
`wf_9fa4246a-acc` + funds-SEAL `wf_cb0ad2b9-cc0`, both 0 blocking; capstone
`b4-account-attribution-resolution-2026-06-04.md`). The F2 handoff carried a pre-B4 framing in
error and it propagated through F4. The post-F4 menu now carries a superseded banner. **B4 is
closed; do not re-open it.**

**The real remaining menu at HEAD `fa7b7dbb`** (DEBT #1 closed H1→M→N; #5, F2, F4, B4 closed):
- **(R) — THIS CHUNK (founder pick 2026-06-07):** drain the register's entire remaining
  non-gated tail in one tightly-scoped, **zero-migration, zero-money-spine** bundle: **F3 +
  #2 + #4 + #7 + #8 + the F4 nevermined copy nit** (+ #6 as a register-disposition note only).
  After (R), the menu is purely founder-gated items — a clean steady state going into the
  founder's F2+F4 deploy/publish bundle, which stays **schema-clean**.
- **(C) revenueSharePct legacy cleanup** — the last MED item (26 files reference it; the meter
  route still computes + writes `effectiveRevenueSharePct` per-invocation while payout ignores
  it — a B4-class "two take models" latent hazard). Needs a migration + funds-SEAL → decided
  as the **natural FIRST POST-DEPLOY chunk**, not now.
- (K) HMAC-pepper — stays DE-recommended (F2 handoff §0: 256-bit keys are preimage-safe
  unsalted; all-keys lockout blast radius). (A) ACP-dark — BD-gated. (H) hop extension —
  demand-gated (+ documented reconciler-starvation trap). F1 NAT-raise — demand-gated.

## 1. CONFIRMED facts (verified 2026-06-07 at HEAD `fa7b7dbb`) vs. what the TRACE must establish

All paths re-verified THIS date — but line numbers DRIFT; the trace re-derives everything.
Register source of truth: `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` (table at
:19-31 + UPDATE sections).

**(R)-1 — F3: remove the dead `requireApiKey` export.**
- CONFIRMED: `apps/web/src/lib/middleware/auth.ts:155 export async function requireApiKey(` —
  zero route callers; the only other mention is a CONTRAST comment at
  `apps/web/src/app/api/proxy/[slug]/route.ts:93` ("Unlike requireApiKey from auth
  middleware…") which should be reworded or anchored once the export is gone.
- TRACE MUST: prove zero static/dynamic/string references repo-wide (incl. tests, packages/*,
  scripts); enumerate what the function body uniquely imports (remove now-unused imports);
  decide the proxy-comment rewording; confirm eslint/tsc stay clean after removal.

**(R)-2 — #2: active-key cap (10) TOCTOU race → transactional guard (NO migration).**
- CONFIRMED: `apps/web/src/app/api/dashboard/developer/api-keys/route.ts` — `:21
  const MAX_ACTIVE_KEYS = 10`; the soft check at `:105-109` (`.limit(MAX_ACTIVE_KEYS + 1)` →
  count compare → error). ⚠️ The register's location ("api-keys/route.ts") had DRIFTED — this
  is the verified real path. Concurrent POSTs can both pass the check and exceed the cap
  (self-affecting only; bounded; not cross-tenant).
- DECIDED SHAPE (scope): the **no-migration** variant — `db.transaction` + row-lock anchor +
  count + insert inside the txn. Both idioms are already in-repo: `db.transaction` at
  `lib/settlement/reconcile.ts:221`; drizzle `.for('update')` at `lib/payouts/process.ts:219`.
  (The register's alternative — a partial unique index — needs a migration → REJECTED for this
  chunk.)
- TRACE MUST: read the whole route (auth context, response shapes, the key-insert statement);
  pick the lock anchor (the developer row via `SELECT … FOR UPDATE` is the natural serializer
  — verify the developers table query pattern in this route); confirm the repo's db driver
  executes real transactions (reconcile.ts precedent suggests yes — verify the db client
  construction in `lib/db/index.ts` or equivalent); preserve EXACT response shapes/status for
  the cap-exceeded path; enumerate the existing route tests (mock harness shape — will the txn
  wrapper force mock updates? the F2/F4 lesson: enumerate EVERY forced test edit up front);
  design the race regression test (two concurrent creates → exactly one succeeds at the cap —
  if true concurrency isn't testable under the mock harness, pin the transactional structure
  instead and say so honestly).

**(R)-3 — #4: publisher auth prefix fast-fail.**
- CONFIRMED: `apps/web/src/app/api/tools/publish/route.ts:158` checks `rawKey.length < 16`
  but not the `sg_pub_` prefix before hashing (hash lookup is the real gate — this is
  fast-fail/clarity, NOT a security fix). The prefix constant exists:
  `apps/web/src/lib/crypto.ts:4 PUBLISHER_API_KEY_PREFIX = 'sg_pub_'` (export status — trace
  verifies; export it if private, or inline the literal to match repo style).
- TRACE MUST: read `authenticateDeveloperByApiKey` end-to-end; confirm the added prefix check
  returns the SAME status/code/shape as the existing invalid-key path (response parity — no
  new error taxonomy); enumerate tests pinning current behavior (a 16+-char non-prefixed key
  today proceeds to hash-miss → same 401: the new fast-fail must be behaviorally
  indistinguishable to clients); add the fast-fail test (fails pre-fix? — it CAN: assert the
  DB is never queried for a non-prefixed key, e.g. via the mock's call count — that assertion
  fails pre-fix).

**(R)-4 — #7: render the unused `email` param in the two publisher key emails.**
- CONFIRMED: `apps/web/src/lib/email.ts:562 publisherApiKeyCreatedEmail`, `:599
  publisherApiKeyRevokedEmail` — both take an `email` param that the templates never render.
  Precedent to mirror: `accountDeletedEmail` (`:717`) renders "the account associated with
  {email}".
- TRACE MUST: read all three templates; confirm the interpolation goes through the repo's
  `escapeHtml` (EVERY user-influenced string in email HTML is escaped — pervasive repo rule);
  enumerate existing email tests (snapshot? string-contains?) and which break/need extending;
  the new assertion (rendered output contains the escaped email) fails pre-fix.

**(R)-5 — #8: client tests for the Settings UI section + the two publisher email templates.**
- CONFIRMED: settings page = `apps/web/src/app/(dashboard)/dashboard/settings/page.tsx`
  (⚠️ bracketed path — QUOTE it in shell commands); NO settings `__tests__` dir exists. The
  register names the three highest-value cases: (a) clipboard-copy failure keeps the raw key
  visible (no silent loss of a just-created key), (b) `loadApiKeys` fetch failure → retry
  state, (c) email template escapes a malicious `label` (XSS).
- TRACE MUST: read the settings page (find the API-keys section's component boundaries, the
  clipboard call, the load/retry state machine); find the repo's client-component test
  precedents (testing-library? render harness? grep `apps/web/src/**/__tests__` for `.tsx`
  page/component tests and mirror the freshest pattern); decide test file placement
  (`app/(dashboard)/dashboard/settings/__tests__/`); for (c) confirm whether the email-template
  XSS test belongs with #7's email tests (it does — one test file section, don't duplicate);
  state how each new test would fail if the guarded behavior regressed (these are
  regression-guard tests pinning EXISTING behavior — the fail-pre-fix rule applies to the
  behavior-changing items (R)-2/3/4, NOT here; say this honestly in the plan; where cheap,
  spot-prove by reverting the guarded behavior locally).
- ⚠️ If the page currently lacks the retry state or keeps-key-visible behavior the register
  assumes, that is a FINDING for the plan (smallest fix or document-as-is + founder note), not
  silent scope growth.

**(R)-6 — F4 residual: nevermined comparison copy says "v0.1.0".**
- CONFIRMED: `apps/web/src/app/(marketing)/compare/nevermined/data.ts:169` + `:264` carry
  literal "v0.1.0" prose about the Python SDK (now 0.2.0 locally). The gating test
  `compare-nevermined.test.ts:440-441` pins only `packages/sdk-python` + "not yet published"
  (still true — publish is founder-gated); `:438` is a comment, not an assertion. (Exact
  paths/lines re-verified by the F4 panel 2026-06-06; trace re-confirms.)
- TRACE MUST: confirm the two strings + every other "0.1.0"-as-Python-SDK mention in marketing
  copy (sweep `apps/web/src/app/(marketing)/`); phrase the replacement so it doesn't need
  re-editing at publish time (e.g. "v0.2.0" or versionless phrasing — prefer versionless if
  the copy tolerates it; founder-taste call goes in the plan); confirm the gating test stays
  green.

**(R)-7 — #6: bootstrap `created_at` non-monotonic (NIT).**
- NO CODE. Disposition-only: the register UPDATE at close marks #6 "documented-wontfix"
  (harmless — migrator reads MAX only; the note already warns future migrations not to depend
  on per-row ordering). If the trace finds that warning NOT yet present near the bootstrap
  script, add a one-line comment there (comment-only, allowed).

## 2. Ground state + pre-flight (verify before touching anything)

- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `fa7b7dbb`** ("fix(sdk-python): (F4)…",
  LOCAL, NOT pushed) — full local stack: `93767508` (origin/main, LIVE prod) → … → `be43b501`
  (B4) → … → `aa580355` (N) → `2b479a3e` (F2) → `24b24301` → `fa7b7dbb` (F4). Tree clean
  (`.audit/` gitignored). Confirm: `git -C /Users/lex/settlegrid status -sb && git log -6
  --oneline`.
- **Baselines (re-run to anchor BEFORE any edit; this chunk's end-state must keep them green
  with only its OWN additive test deltas in apps/web):**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4261 pass / 180 files**) ·
    `npx next build` (**0**; not concurrent with tsc) · `npx eslint <changed files>` (0).
  - `cd packages/mcp`: `npx vitest run` (**1898 pass / 1 skip**) — **byte-stable this chunk**;
    the re-run is the untouched-proof.
  - **Python family (`packages/sdk-python*`): byte-stable** — no suite runs needed; the
    untouched-proof is `git diff --numstat` showing zero hunks there.
- **Real-money guardrails:** do NOT push, set/change prod env, apply migrations (none should
  exist this chunk), or publish (all founder-gated). Any DB access read-only. Prod runs
  `origin/main` = `93767508`; the local stack is NOT deployed.
- **Shell is zsh:** quote bracketed paths — this chunk touches several:
  `'apps/web/src/app/(dashboard)/dashboard/settings/...'`,
  `'apps/web/src/app/api/proxy/[slug]/route.ts'` (comment-only),
  `'apps/web/src/app/(marketing)/compare/nevermined/data.ts'`.

## 3. DECIDED scope (Step-0, founder 2026-06-07) + SCOPE GUARD

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

## 4. THE ARC — six phases. Phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code.

### Phase 1 — MANDATORY DISCOVERY TRACE (no plan without it)
Produce `docs/tech-debt/r-register-closeout-trace-2026-06-07.md` answering every TRACE-MUST in
§1, each grounded in file:line read that session. Re-derive every number in this handoff
(lines drift). Also: enumerate EVERY forced test edit per item (the F2 lesson — its R1 audit's
sole blocker was a missed pinned test); map the existing test harness for each touched route/
template/page; confirm the db-driver transaction semantics for (R)-2.

### Phase 2 — BUILD PLAN
Write `docs/tech-debt/r-register-closeout-build-plan-2026-06-07.md` (status DRAFT until the
audit passes): goal + honest value framing (this drains the register tail; it is hygiene, not
heroics); the trace's conclusions; EXACT per-file recipes for all six items; the byte-stable
spine list (§3 verbatim); behavioral deltas (esp. (R)-2's txn semantics and (R)-3's
client-visible parity claim); the test plan — **each behavior-changing item's new/changed test
must FAIL on pre-fix code** ((R)-2 DB-untouched-on-fast-fail / race-structure pin, (R)-3
no-DB-query-for-non-prefixed assertion, (R)-4 rendered-email assertion); (R)-5's
regression-guard tests classified honestly (pin existing behavior; spot-prove by local
mutation where cheap); the machine gates — apps/web tsc 0 / vitest **4261 + exact N_new** /
build 0 / eslint 0; packages/mcp **1898/1 unchanged**; `git diff --numstat` confined to the §3
in-scope files + docs (**zero** `packages/mcp`, **zero** `packages/sdk-python*`, **zero**
`drizzle/`, zero money-spine hunks); the rollout note (nothing deploys; founder bundle
unaffected); an embedded **SCOPE GUARD** (§3 verbatim).

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the founder's hard gate)
**No implementation code until the build plan is audited PLAN_READY (0 blocking) with ALL
fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt
  `.audit/f4-prebuild/prebuild-audit.mjs` → `.audit/r-prebuild/prebuild-audit.mjs`. That
  script already carries the **hardened tail** (null-guard + inline degraded fallback so a
  dead synthesizer can never crash the run or fake a pass) — KEEP IT VERBATIM. Shape: N
  fresh-context lenses that **re-derive the plan's claims against the actual code** →
  **adversarial verify** of every finding (default-refuted) → guarded synthesis at
  **PLAN_READY / 0 blocking**.
- **Suggested 5 lenses:** (a) **factual accuracy** — every file:line + the §1 confirmations
  (esp. the (R)-2 verified route path, the db.transaction/`.for('update')` driver semantics,
  the prefix constant's export status, the settings-page component map); (b) **design
  correctness** — the txn guard actually closes the TOCTOU race (lock anchor serializes
  concurrent creates; no deadlock with other writers; response contract identical); the
  prefix fast-fail is client-invisible (same status/shape); the email render is escaped
  (XSS-safe); the copy fix keeps the gating test green; (c) **test sufficiency** — every
  forced edit enumerated; behavior-change tests fail pre-fix; regression-guard tests genuinely
  pin the named behaviors; no weakened mock; suite arithmetic exact; (d) **scope boundary** —
  zero money-spine / rate-limit / crypto-hashing / mcp / sdk-python / drizzle hunks; NO
  migration; no refactor creep ("while we're in email.ts…" = rejected); (e) **baseline
  integrity** — the recorded baselines are real; the end-state gates are evaluable as written.
- **Run the audit twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 must be
  PLAN_READY 0-blocking. (Precedents: (N)/(F2) went R1 NEEDS_FIXES → R2 READY; (B4)/(F4)
  passed R1 clean — both outcomes are normal.)
- **DEGRADED-RUN GUARD:** before trusting any verdict, confirm ALL lenses produced output and
  no verify-verdict is null (a dead lens silently yields zero findings → fake PASS). The
  hardened script surfaces `deadLenses`/`nullVerdicts`/`degraded` in its return — **a degraded
  result is NOT a pass.**
- **Transient-death / session-limit recovery:** `Workflow({scriptPath, resumeFromRunId})`
  replays cached agents. Account session-limit caveat (hit twice in this series): if ALL
  agents die ("You've hit your session limit · resets 6pm America/New_York"), re-run after the
  reset — no usable cache when everything dies; if ONLY the synthesizer dies, the hardened
  tail emits a deterministic fallback verdict inline (clearly marked degraded — still re-run
  for certification).
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the post-build
  gate):** Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A
  finding that grows scope is `rejected-scope-expansion`, NOT blocking, unless it proves a
  PLANNED change is itself wrong. Hold the line against: ANY edit to the money spine
  (meter/validate-key/proxy-settlement/lib/settlement/metering/pricing/payouts/x402/ap2/
  circle-nano/cron), `lib/rate-limit.ts` or any limiter keying, `hashApiKey`/key-format
  changes, `revenueSharePct` (= chunk (C)), `packages/mcp`, `packages/sdk-python*`, the DB
  schema/migrations; re-litigating settled designs (B4 account_id semantics, F2/F4 wire
  contract, N auth.id keying, M getClientIp, H1 fail-open, the take model) without a NEW
  trace; PyPI/npm publishing. Re-opening a settled decision requires a concrete new trace.
- Record `.audit/r-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md` (recovery procedures,
  mirroring `.audit/f4-prebuild/CHECKPOINT.md`).

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit
gates only). Line-surgical; touch only the planned sites. Suggested batch order (keep each
batch's suite green): (1) F3 removal + proxy comment → tsc/vitest; (2) (R)-3 prefix fast-fail
+ its tests → suite; (3) (R)-2 txn guard + its tests → suite; (4) (R)-4 email render + (R)-5
email-XSS test → suite; (5) (R)-5 settings client tests → suite; (6) (R)-6 copy fix → suite +
the nevermined gating test; (7) full sweep: apps/web tsc/vitest/build/eslint + packages/mcp
vitest (unchanged-proof) + `git diff --numstat` scope proof. Prove the fail-pre-fix property
empirically for the behavior-change tests (the F4 pattern: write tests first against pristine
source, or stash-prove afterwards; record to `.audit/r-build/`).

### Phase 5 — MANDATORY POST-BUILD PANEL + CERTIFICATION (0 blocking BEFORE any commit)
Off-spine chunk → a **correctness/security panel** (not a funds-SEAL), but with a mandatory
**ZERO-SPINE-DIFF lens**. Adapt `.audit/f4-postbuild/panel.mjs` → `.audit/r-postbuild/panel.mjs`
(keep the hardened tail). Lenses: (a) shipped-behavior correctness — the race is actually
closed (txn structure + lock anchor verified in the SHIPPED code), prefix fast-fail parity,
email escaping, copy-fix accuracy; (b) **ZERO-SPINE-DIFF** — `git diff --name-only/--numstat`
contains NOTHING under the §3 byte-stable list (money spine, rate-limit, crypto-hashing,
packages/mcp, packages/sdk-python*, drizzle/) and ONLY the planned files + docs; (c) test
integrity — behavior-change tests fail pre-fix (verify the recorded proof), regression guards
pin the named behaviors, no mock weakened, suite arithmetic exact (4261 + N, mcp 1898/1
unchanged); (d) register/docs accuracy — the close-out updates match what actually shipped;
(e) residual honesty — anything found-but-not-fixed is documented, not buried. Embed the
§Phase-3 SPINE-SAFEGUARD clause verbatim. Degraded-run guard + resume recovery. Record
verdicts to `.audit/r-postbuild/` + `.audit/r-certify/`. **0 blocking before ANY commit.**

### Phase 6 — FOUNDER-GATED CLOSE-OUT (nothing ships without the founder's word)
1. **LOCAL commit, path-scoped, atomic** (shared-worktree hazard — never `git add -A`; quote
   the bracketed paths): `git add <paths> && git -c user.name="Luther Whiting-Collins"
   -c user.email="lexwhiting@gmail.com" commit -m "<msg>" -- <paths>`, trailer
   `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`. **NO push. NO publish.**
2. **Capstone:** `docs/tech-debt/r-register-closeout-resolution-2026-06-07.md` (what shipped
   per item, the audit chain verdicts, honest framing, residuals).
3. **Register** (`publisher-api-keys-audit-2026-05-28.md`): UPDATE section — F3/#2/#4/#7/#8
   RESOLVED, #6 documented-wontfix, F4's nevermined nit closed. The register tail is now
   empty of non-gated items.
4. **Next-chunk handoff** (Step-0-gated): **(C) revenueSharePct cleanup is the natural lead
   AFTER the founder pushes/deploys the current stack** (it wants a migration — keep the
   deploy bundle schema-clean); otherwise the menu is purely gated items ((K) de-recommended,
   (A) BD-gated, (H)+F1 demand-gated). Note the founder's deploy/publish bundle remains
   actionable and unaffected.
5. **Memory:** update `settlegrid-debt-chunks.md` (account memory) pointing at the capstone.

## 5. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the two audit gates.
- **Ground every conclusion in ACTUAL tool output** (suites run, greps shown — no vibes).
- **Line-surgical**; §3 byte-stable spine; smaller change wins; ZERO migrations.
- Do NOT push, change prod env, apply migrations, or publish packages. DB read-only.
- **Flag context degradation the moment it risks quality** (founder standing order). If work
  outgrows context, stop at a phase/batch boundary, write/update
  `.audit/r-prebuild/CHECKPOINT.md`, and recommend a continuation session.

## 6. File-path index (absolute)
- **This handoff:** `/Users/lex/settlegrid/docs/tech-debt/r-register-closeout-bundle-handoff-2026-06-07.md`
- **Register (source of truth + close-out target):** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`
- **(R)-1:** `apps/web/src/lib/middleware/auth.ts` (`:155`) · comment at
  `'apps/web/src/app/api/proxy/[slug]/route.ts'` (`:93`)
- **(R)-2:** `apps/web/src/app/api/dashboard/developer/api-keys/route.ts` (`:21/:105-109`) ·
  txn precedent `apps/web/src/lib/settlement/reconcile.ts:221` · row-lock precedent
  `apps/web/src/lib/payouts/process.ts:219`
- **(R)-3:** `apps/web/src/app/api/tools/publish/route.ts` (`:158` area) · prefix constant
  `apps/web/src/lib/crypto.ts:4`
- **(R)-4 + (R)-5 email:** `apps/web/src/lib/email.ts` (`:562`, `:599`; precedent `:717`)
- **(R)-5 page:** `'apps/web/src/app/(dashboard)/dashboard/settings/page.tsx'`
- **(R)-6:** `'apps/web/src/app/(marketing)/compare/nevermined/data.ts'` (`:169/:264`) ·
  gating test `compare-nevermined.test.ts` (`:438-441` area)
- **Audit templates to adapt (gitignored, on disk):** `.audit/f4-prebuild/prebuild-audit.mjs`
  (hardened tail — keep verbatim) · `.audit/f4-postbuild/panel.mjs` (off-spine panel shape) ·
  `.audit/f4-prebuild/CHECKPOINT.md` (recovery patterns)
- **Prior-chunk records (context, do not edit):** F4 capstone
  `f4-python-sdk-meter-auth-resolution-2026-06-06.md` · B4 capstone
  `b4-account-attribution-resolution-2026-06-04.md` (B4 is CLOSED) · post-F4 menu
  `next-chunk-handoff-2026-06-06-post-f4.md` (carries the superseded-B4 banner)
- **Baselines at HEAD `fa7b7dbb`:** apps/web tsc 0 / vitest 4261/180 / build 0; packages/mcp
  1898/1 + tsup 0; Python family 394 + 17/15/15/30/15/17 (byte-stable this chunk — numstat is
  the proof, no suite runs needed).
