# (F2) `sdk/meter` metering-call authentication + consumer-key binding — CHUNK HANDOFF (2026-06-06)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a verification
> facilitator) → use `/effort max`.
>
> **This chunk is on the MONEY surface.** Unlike (M)/(N) it deliberately modifies a settlement-adjacent
> route (`/api/sdk/meter`, which deducts credits + records invocations + accrues developer revenue). The
> bar is therefore higher: a **discovery trace FIRST**, then a build plan, then a **deep independent
> pre-build audit (PLAN_READY, 0 blocking, all fixes applied) BEFORE any implementation**, then a
> **funds-SEAL post-build gate + certification**, then a founder-gated LOCAL commit. NOTHING ships
> (push / prod-env / migration) without the founder's explicit word.

---

## 0. Why this chunk (the research-based recommendation — 2026-06-06)

Picked over the post-(N) menu's nominal lead (K) after a deep study + a read-only production inventory.
**Bottom line: (F2) is the only *real* (non-theoretical) security/integrity defect left, it sits on the
money surface (top priority by the spine-safety doctrine), and the system is pre-launch-dormant — which
makes NOW the safest possible time to touch the metering path.**

- **(F2) is a CONFIRMED unauthenticated metering/settlement-integrity gap** (evidence below) — not the
  theoretical item the register implied.
- **(K) HMAC-pepper was DE-recommended:** for **256-bit random** API keys, SHA-256 is already
  preimage-safe, so a leaked `key_hash` column cannot be used to authenticate (no plaintext is stored).
  A pepper adds ~nothing to preimage resistance here; the register's own rating is "LOW (arch) / not
  exploitable today." Its value is marginal and it touches the live settlement-auth path (`proxy/[slug]`)
  — poor risk/reward as the next chunk. Keep deferred.
- **(C)/(A)/(H)** are hygiene / externally-gated; the small bundle (F3 + #4 + #8) is low-value (the #8
  "email XSS" is already mitigated — `email.ts` `escapeHtml` is applied pervasively incl. to `label`; the
  gap is only a missing Settings-UI client test).

### Production inventory that informed this (read-only, 2026-06-06)
Queried the live Supabase prod DB (`apps/web/.env.local` `DATABASE_URL`). **The platform is
pre-launch-dormant:**
- Users: **15 developers** (≈half are the founder's own / `sys@settlegrid.com` crawler / internal
  `hello@`,`support@` accounts; ~7 external founding-member signups, mostly tier=standard, 0 balance,
  Stripe Connect `not_started`, 0 tools) · **36 consumers**, **0 funded** (`global_balance_cents=0` for
  all), 1 with a Stripe customer, ~10 obvious test emails.
- Activity: **invocations 235,647 but ALL pre-dating 2026-03-25; real_30d = 0, real_7d = 0** — a Feb–Mar
  build/test burst from 14 consumers, no live traffic since. Consumer API keys: 52, last used 2026-05-06.
  Publisher keys: 2 (1 used). Purchases: 16 completed = **$630** total, last 2026-03-23. Payouts: 7 =
  **$9,030** (inconsistent with $630 in → the early money tables are seed/test, not organic). Tools: 1,462
  but 991 templates + 423 crawled-unclaimed + only **31 active across 3 (mostly-internal) developers**.
- **Implication for this chunk:** (a) no funded balances + no live SDK traffic ⇒ exploitation impact is
  currently bounded AND backward-compat risk of an SDK-side change is low — the safest window to harden
  the meter path; (b) it must be fixed **before** real consumers fund balances, because the gap lets an
  unauthenticated caller move/attribute credits.

---

## 1. The vulnerability — what is CONFIRMED vs. what the TRACE must establish

**CONFIRMED (read `apps/web/src/app/api/sdk/meter/route.ts` this session, HEAD aa580355):**
- `POST /api/sdk/meter` is `export const POST = withCors(async function POST(...))` (:45) with **no API-key
  authentication**. The only gate is an **IP** flat limit `checkRateLimit(sdkLimiter, \`sdk-meter:${ip}\`)`
  (:51) + a tiered limit keyed on **client-supplied** `body.consumerId` (:108-109).
- The Zod body (`meterSchema`, :33-43) is fully client-supplied: `{toolSlug, consumerId, toolId, keyId,
  method, costCents, latencyMs?, isTestKey?, referralCode?}`. There is **no verification** that the caller
  possesses the API key, that `keyId` belongs to `consumerId`, or that either is bound to `toolId`.
- Downstream of the limit (lines ~116+), the handler **deducts credits** (`deductCreditsRedis`), **records
  invocations** (`recordInvocationAsync` with `consumerId: body.consumerId`), **increments period spend**,
  and **accrues developer revenue/overage** — all keyed on the unauthenticated body fields. The only place
  it ever looks up `apiKeys` by `body.keyId` is the `isTestKey` branch (:118-126), and only to read
  `is_test_key`.
- ⇒ **An unauthenticated caller who passes the 1000/min IP limit can POST arbitrary
  `{consumerId, toolId, keyId, costCents}` and cause credit deduction from / usage attribution to /
  revenue accrual for arbitrary accounts.** Financial-integrity impact, currently bounded only by
  dormancy (no funded balances) + the IP limit.

**The SDK side (partially traced; the discovery trace must finish this):**
- The SDK calls the meter endpoint: `packages/mcp/src/middleware.ts` → `apiCall<MeterResponse>(config,
  <meter path>, …)`. The SDK **holds** the API key (`extractApiKey`, `headers['X-Api-Key']` /
  `headers['authorization']` — see `packages/mcp/src/{index,middleware,types}.ts`). **Whether the SDK
  already SENDS that key to `/api/sdk/meter`** (so a server-side check is sufficient) **or must be changed
  to do so** is the pivotal scoping question (server-only fix vs. SDK change + version bump + in-the-wild
  backward-compat).

---

## 2. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `aa580355`** (the (N) chunk's local commit) =
  origin/main `9d22fd2e` + 4 doc commits + the (N) commit. **(N) is local-only / NOT pushed.** Working
  tree clean (the gitignored `.audit/` dir holds (N)'s verdicts). Confirm:
  `git -C /Users/lex/settlegrid status -sb && git log -3 --oneline`.
- **Baselines — re-run BOTH first; all GREEN at this HEAD → any red is yours:**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4256 pass / 0 fail / 180 files**) ·
    `npx next build` (**0**; NOT concurrent with tsc — they race on `.next/types`).
  - `cd packages/mcp`: `npx vitest run` (**1896 pass / 1 skip**). **If this chunk touches the SDK, this
    suite + an SDK version bump are in scope.**
- **Shell is zsh:** `cd` persists across Bash calls (use absolute paths or re-`cd`); quote bracketed paths
  (`'…/[slug]/…'`). npm at root is pnpm-workspace-aware; `apps/web` uses `npx`. Migrations: none expected;
  applying anything is founder-gated regardless.
- **Real-money guardrails:** do NOT push, set/change prod env, or apply migrations. The read-only prod
  inventory in §0 used `default_transaction_read_only=on`; any further DB access stays read-only.

## 3. DECIDED at Step-0 (founder, 2026-06-06): the chunk is **(F2)**. Scope guard for the chunk itself:
- **In scope:** authenticating the `sdk/meter` call and binding `keyId`/`consumerId`/`toolId` to the
  presented credential before any credit/record/revenue effect — plus the minimal SDK change (if the
  trace shows the key isn't already sent) and its tests. Mirror how `proxy/[slug]/route.ts:137`
  authenticates (`hashApiKey(rawKey)` → active-key lookup) and how `sdk/validate-key` resolves a key.
- **OUT of scope (do NOT touch — byte-stable):** the take model (`take_bps=0`), `lib/pricing.ts`,
  `lib/metering.ts` deduction/ledger semantics (`deductCreditsRedis`, `recordInvocationAsync`,
  `incrementPeriodSpend`), `developers.balanceCents` / `consumers.global_balance_cents` authority, the
  `(from,nonce)` dedup, B4 account_id semantics, the `proxy/[slug]` settlement logic beyond reading its
  auth pattern, `x402/* ap2/* circle-nano/* outcomes/* settlements/* cron/*`, `lib/rate-limit.ts`,
  `lib/middleware/auth.ts`. Do NOT re-key/raise/lower any limiter, rename prefixes, or migrate the
  `revenueSharePct`/overage logic (that's chunk (C), not this). When in doubt, the smaller change wins.

---

## 4. THE ARC — six phases. Phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code.

### Phase 1 — MANDATORY DISCOVERY TRACE (no plan can be written without it)
Produce `docs/tech-debt/f2-sdk-meter-trace-2026-06-06.md` answering, each grounded in file:line:
1. **Reachability / trust model:** Is `/api/sdk/meter` reachable by untrusted clients, or only called
   server-side by a trusted caller? Trace every caller: the SDK (`packages/mcp/src/middleware.ts`
   `apiCall(… meter …)`), `proxy/[slug]/route.ts`, any server lib, any cron. Does `withCors` permit
   arbitrary origins?
2. **Does the SDK already send the API key to meter?** Read `packages/mcp/src/middleware.ts` `apiCall` +
   how it builds the meter request headers/body; confirm whether the raw key (or a token) is transmitted.
   This decides server-only vs. SDK-change.
3. **Full effect inventory:** every state mutation `sdk/meter` performs off body fields (credit deduction,
   invocation/usage rows, period-spend, monthly-ops counter, revenue/overage, fraud signals, emails) — so
   the fix covers the whole blast radius. Cross-check the near-twin `sdk/meter-with-metadata/route.ts`
   (does it share the gap? it is in `SPINE_UNION` of the (M) panel) and `sdk/validate-key` +
   `sdk/test-validate`.
4. **Correct binding source:** given a presented key, what is the authoritative `consumerId` (the
   `api_keys.consumer_id` for that `key_hash`) and how should a body/credential mismatch be rejected
   (401/403) without leaking which field was wrong?
5. **Backward-compat:** are there SDK versions in the wild that call meter without a key? (Inventory says
   ~no live usage, so a hard requirement is likely acceptable — but state it explicitly; if a window is
   needed, design dual-mode + a deprecation note.)
6. **Test-mode path:** how `isTestKey` / `is_test_key` interacts with the new auth (the test path must
   still work and must not become an auth bypass).

### Phase 2 — BUILD PLAN
Write `docs/tech-debt/f2-sdk-meter-auth-build-plan-2026-06-06.md` (status: DRAFT until the audit passes):
goal + honest value framing; the trace's trust-model conclusion; the **fix design** (server-side: require
the key on `/api/sdk/meter`, hash + look up the active key, derive `consumerId` from the key row, and
**reject** any body `consumerId`/`keyId`/`toolId` that doesn't match — before any mutation; SDK-side: send
the key if it doesn't already); exact edit sites + a per-file recipe; the byte-stable spine list (§3); the
behavioral deltas (incl. any newly-rejected request shapes); the test plan (server auth-pass/auth-fail/
mismatch/test-mode + SDK call-shape + `meter-with-metadata` parity if in scope); the machine gates
(tsc/vitest counts, diff confinement, `git diff --numstat` discipline, packages/mcp suite + version bump
if touched); the rollout; an embedded **SCOPE GUARD** (below). Re-derive every census/number against the
ACTUAL code — do not trust this handoff's line numbers; they drift.

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the founder's hard gate)
**No implementation code until the build plan is audited PLAN_READY (0 blocking) with ALL fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt `.audit/n-prebuild/prebuild-audit.mjs`
  → `.audit/f2-prebuild/prebuild-audit.mjs`. Shape: N fresh-context lenses that **re-derive the plan's
  claims against the actual code** → **adversarial verify** of every finding (default-refuted) → guarded
  synthesis at **PLAN_READY / 0 blocking**. Lenses must cover: (a) trust-model correctness (is the trace's
  reachability conclusion right?); (b) the fix actually closes the gap with no residual unauthenticated
  mutation path (incl. `meter-with-metadata`); (c) no money-semantics change (deduction/ledger/pricing/
  balance authority byte-stable — the fix only gates/authenticates); (d) backward-compat / SDK-version
  correctness; (e) test sufficiency (would each test fail on the pre-fix code?); (f) factual/spec accuracy
  of every plan number.
- **Run the audit twice if it finds blockers:** round 1 → apply ALL fixes to the plan → round 2 must be
  PLAN_READY 0-blocking (the (N) precedent: R1 PLAN_NEEDS_FIXES → fixes → R2 PLAN_READY).
- **DEGRADED-RUN GUARD:** before trusting any verdict, confirm the log shows ALL lenses produced output and
  no verify-verdict is null (a dead lens silently yields zero findings → fake PASS). **Transient-death
  recovery:** `Workflow({scriptPath, resumeFromRunId})` replays cached agents. **Account session-limit
  caveat (hit on (N)'s cert run):** if only the final synthesizer dies on a limit, either resume after the
  limit resets or synthesize inline from the cached worker outputs and record the provenance.
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the post-build gate):**
  Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows
  scope is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong.
  Hold the line against: changing the take model / pricing / `deductCreditsRedis` / ledger writes /
  `balanceCents` authority / dedup / B4; re-keying/raising/lowering any limiter or its prefix; migrating
  `revenueSharePct` or the overage logic (chunk C); touching `proxy/[slug]` settlement logic, `x402/ap2/
  circle-nano`, `cron/*`, `lib/rate-limit.ts`, `lib/middleware/auth.ts` beyond what the fix strictly
  needs; re-litigating H1/M/N-settled items (fail-open, left-most-XFF, `getClientIp`, `auth.id` keying)
  without a NEW trace. Re-opening a settled decision requires a concrete new trace.
- Record `.audit/f2-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md` (recovery procedures).

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audits only, never
to mutate files in parallel). Line-surgical; touch only the planned sites; keep the §3 byte-stable spine
untouched. If the SDK changes: bump `@settlegrid/mcp`, keep its 1896-suite green, and rebuild per the
SDK's build step. Per-batch `tsc --noEmit` + the planned machine-gate inventory. Ground every conclusion
in actual tool output (greps/gates, not green-suite vibes).

### Phase 5 — MANDATORY POST-BUILD GATE: funds-SEAL panel + certification (0 blocking BEFORE any commit)
This chunk **modifies a money-path route**, so the post-build gate is a **funds-SEAL** (stronger than
(N)'s panel). Adapt `.audit/n-postbuild/security-panel.mjs` → `.audit/f2-postbuild/` and
`.audit/m-certify`/`.audit/n-certify/certify.mjs` → `.audit/f2-certify/`. Lenses: (a) the auth/binding
actually closes every unauthenticated mutation path (server + `meter-with-metadata`); (b) money semantics
byte-stable (deduction/ledger/pricing/balance unchanged — diff proves it); (c) no new bypass via test-mode
or CORS; (d) SDK call-shape + backward-compat; (e) test integrity. Embed the §Phase-3 SPINE-SAFEGUARD
clause verbatim. Apply the degraded-run guard + resume recovery. Record verdicts to `.audit/f2-postbuild/`
+ `.audit/f2-certify/`. **0 blocking before ANY commit.**

### Phase 6 — FOUNDER-GATED CLOSE-OUT (nothing ships without the founder's word)
1. **LOCAL commit, path-scoped, atomic** (shared-worktree hazard — never `git add -A`):
   `git add <paths> && git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com"
   commit -m "<msg>" -- <paths>` (quote `[slug]`/`[id]` paths), trailer
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (match the exact model you run as). **NO push.**
2. **Capstone:** `docs/tech-debt/f2-sdk-meter-auth-resolution-2026-06-06.md` (what shipped, the audit chain
   R1→R2 + funds-SEAL + cert verdicts, honest value framing, residual items).
3. **DEBT register** (`docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`): mark **F2 RESOLVED**;
   note F1/F3 still open + (K)/(C)/(A)/(H) dispositions.
4. **Next-chunk handoff** (Step-0-gated): carry the menu minus (F2).
5. **Memory:** update the account's memory (`settlegrid-debt-chunks.md`) pointing at the capstone.

---

## 5. Guardrails (real money — non-negotiable)
- **Single-writer core**; fan-out only for the two audit gates.
- **Ground every conclusion in ACTUAL tool output.**
- **Line-surgical**; §3 byte-stable spine; smaller change wins when in doubt.
- Do NOT push, set/change prod env, or apply migrations. Demo/sandbox must never reach a real settle.
- **Flag context degradation the moment it risks quality** (founder standing order). If work outgrows
  context, stop at a phase/batch boundary, write the inventory + a `.audit/f2-prebuild/CHECKPOINT.md`, and
  recommend a continuation session — partial state is safe by construction.

## 6. File-path index (absolute)
- **This handoff:** `/Users/lex/settlegrid/docs/tech-debt/f2-sdk-meter-auth-handoff-2026-06-06.md`
- **Primary target:** `apps/web/src/app/api/sdk/meter/route.ts` (the gap) · twin
  `apps/web/src/app/api/sdk/meter-with-metadata/route.ts` (check parity) · `sdk/validate-key/route.ts` +
  `sdk/test-validate/route.ts` (key-resolution patterns)
- **Auth model to mirror:** `apps/web/src/app/api/proxy/[slug]/route.ts:137` (`hashApiKey` → active-key
  lookup); `apps/web/src/lib/crypto.ts` (`hashApiKey`); `apps/web/src/lib/middleware/auth.ts`
- **Money semantics (BYTE-STABLE — read only):** `apps/web/src/lib/metering.ts`, `lib/pricing.ts`,
  `lib/settlement/**`, the `developers.balanceCents` / `consumers.global_balance_cents` columns
- **SDK:** `packages/mcp/src/{middleware,index,types,telemetry}.ts` (the meter call path + key handling)
- **Schema:** `apps/web/src/lib/db/schema.ts` (`apiKeys` :241, `invocations` :316, `developers` :19,
  `consumers` :165)
- **DEBT register / F2 source:** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`;
  prior menu `next-chunk-handoff-2026-06-06-post-n.md`; (N) capstone
  `n-authid-keying-resolution-2026-06-06.md`
- **Audit templates to adapt:** `.audit/n-prebuild/prebuild-audit.mjs` (+ `CHECKPOINT.md`,
  `round{1,2}-verdict.txt`) · `.audit/n-postbuild/security-panel.mjs` · `.audit/n-certify/certify.mjs`
- **Read-only prod inventory** (how §0 was derived): `DATABASE_URL` in `apps/web/.env.local`; query with
  `psql "$DB"` under `SET default_transaction_read_only=on; SET statement_timeout='30s';` — read-only only.
