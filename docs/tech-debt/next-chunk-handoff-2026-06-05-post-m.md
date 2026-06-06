# Next-chunk handoff — post-(M)+(E) getClientIp migration (2026-06-05, Step-0-gated)

> **Self-contained handoff for a FRESH session. Read this end-to-end before touching anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a verification
> facilitator) → suggest `/effort max`.
>
> **Where things stand:** the `(M)+(E)` getClientIp call-site migration + `processDataExport` guard is
> **SHIPPED, CERTIFIED (0 code defects), committed, and PUSHED** (`origin/main = 9d22fd2e`; a doc-fix
> `d1b0297f` may be local). DEBT #1's mechanical core is closed. **This handoff scopes the NEXT chunk.**
> It is **Step-0-gated**: the founder picks the chunk (§2) BEFORE anything is scoped or planned, then the
> work runs the **full 3-part audit chain** — deep independent PRE-BUILD AUDIT of the build plan → single-
> writer implementation → mandatory POST-BUILD panel/SEAL → founder-gated local commit.

---

## 0. Read order
1. **THIS doc, end-to-end.**
2. `docs/tech-debt/m-getclientip-migration-resolution-2026-06-05.md` — the just-shipped (M)+(E) capstone
   (what's now settled: the `getClientIp` helper as the single IP source of truth; the `'unknown-ip'`
   sentinel; the line-surgical settlement-surface contract; the test-mock audit lesson).
3. `docs/tech-debt/next-chunk-handoff-2026-06-05-post-h1.md` §3 — the prior Step-0 menu (the canonical
   candidate analysis; (M) is now done, the alternatives carry forward — re-verify every line, they drift).
4. `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` — the DEBT register. **DEBT #1 (HIGH)** is the
   anchor for the recommended lead (see §2); its three sub-parts are (a) fail-open [done H1], (b)
   platform-trusted IP [done M], **(c) key authenticated routes on `auth.id` after auth [OPEN — the lead]**.
5. `docs/tech-debt/h1-rate-limit-availability-resolution-2026-06-05.md` — the H1 capstone (the rate-limit
   posture the lead builds on: fail-open, the shared limiters, `checkRateLimit`'s shape).
6. The **audit-chain templates to adapt** (gitignored, on disk): pre-build
   `.audit/m-prebuild/prebuild-audit.mjs` (+ `round{1,2}-verdict.txt` as worked examples); post-build
   `.audit/m-postbuild/security-panel.mjs` (off-spine regression panel) and `.audit/b4-postbuild/seal-panel.mjs`
   (funds-SEAL, if the pick touches the spine); the certification spine `.audit/m-certify/certify.mjs`.

---

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`, branch `main`. **`origin/main = 9d22fd2e`** (pushed, LIVE — the prod Vercel
  build was triggered by that push; confirm green). Local **HEAD may be `d1b0297f`** (a doc-only capstone
  fix, +1 ahead of origin, push held to avoid a wasteful Vercel build). **Build on HEAD.** Confirm:
  `git -C /Users/lex/settlegrid status -sb && git log -3 --oneline && git rev-parse origin/main`.
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as a verification facilitator.
- **Baselines — re-run BOTH first; all GREEN at this HEAD → ANY red is YOURS:**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4250 pass / 0 failed / 179 files**) ·
    `npx eslint <changed>` (**0 errors**; 2 pre-existing `unused-eslint-disable` warnings in
    cron/crawl-{registry,services} are NOT yours) · `npx next build` (**0**; NOT concurrent with tsc — they
    race on `.next/types`).
  - `cd packages/mcp`: `npx vitest run` (**1896 pass / 1 skip**).
  - Note: one PRE-EXISTING full-suite flake was observed once in `tools.test.ts` (a leaked db-mock
    rejection, did NOT recur across multiple clean runs) — if you see a transient red, re-run before
    assuming it is yours.
- **Shell is zsh:** unquoted `$VAR` does NOT word-split (use `xargs` or `${=VAR}`); `cd` persists across
  Bash calls (don't mix a `cd apps/web` command with repo-root-relative greps in one batch).
- npm (NOT pnpm). Migrations live in `apps/web/drizzle/` (last applied `0013`). **No push, no prod env
  change, no migration apply — all FOUNDER-GATED.**

**SETTLED / byte-stable — do NOT re-litigate (a finding here needs a concrete NEW trace or it is rejected):**
the settlement spine (`lib/settlement/{ledger,reconcile,payouts/process,pricing}.ts`, orchestrators,
on-chain engines/verifiers, the 4 settlement writer call sites), the take model (`take_bps=0`; platform
take realized at PAYOUT via `lib/pricing.ts:calculateTakeCents`), B4 (settlement-row `account_id` IS the
developer id), `developers.balanceCents` as the only authoritative balance, `(from,nonce)` dedup, the
exactly-once credit machinery; the `getClientIp` helper + the `'unknown-ip'` sentinel + left-most-XFF
correctness + fail-open posture (H1/M SETTLED); the 9 `ipAddress: … ?? undefined` audit captures.

---

## 2. ⚠️ Step-0 — the next-chunk decision (REQUIRED before you scope or plan anything)

**The founder picks. Do NOT scope, trace, or plan before Step-0 is resolved. Bring the founder the
trade-offs.** Landscape re-grounded against actual code at HEAD 2026-06-05; re-verify any line you depend on.

### RECOMMENDED LEAD — **(N) Authenticated-route `auth.id` rate-limit keying — "finish DEBT #1 (part c)".**
The last open sub-part of the **HIGH-severity DEBT #1** (register #1c: *"for authenticated routes, key on
`auth.id` after auth"*). H1 closed #1a (fail-open) and M closed #1b (platform-trusted IP via `getClientIp`);
**#1c is what remains, and it builds directly on the just-certified getClientIp unification.**
- **The gap (real, grounded):** authenticated routes rate-limit by **IP** (`checkRateLimit(limiter,
  \`prefix:${ip}\`)`) and do so **BEFORE auth** (verified: `api-keys/route.ts` limits at the top of the
  handler, `requireDeveloper` after). Consequences: (i) **legit authed users behind a shared NAT / mobile
  carrier IP are collectively throttled** (one noisy tenant starves the others sharing that egress IP);
  (ii) a distributed authenticated abuser (many source IPs) dodges the per-IP cap. Keying on the
  authenticated identity fixes both.
- **Census (verify in the trace, do NOT trust):** **~96 route files** are in the intersection of
  `checkRateLimit`/`checkTieredRateLimit` callers ∩ auth-guarded routes (`requireDeveloper` 69,
  `requireConsumer` 26, `authenticateDeveloperByApiKey` 1 — the SDK/proxy high-volume path — `requireAdmin` 1;
  some overlap). Smaller than M's 208 but still meaty.
- **⚠️ THE CORE DESIGN DECISION (the Step-0 question that gates everything — the audit must not let the
  plan paper over it):** the current limit runs BEFORE auth precisely so a flooder is rejected cheaply
  *without* forcing the (expensive) auth check first. Keying on `auth.id` requires the identity, which
  exists only AFTER auth. So the plan must choose, with an explicit funds/abuse trade-off analysis:
  - **(a) TWO-LAYER (recommended to evaluate):** keep the cheap pre-auth IP limit (protects the auth path
    from floods) AND add a post-auth `auth.id`-keyed limit (per-user fairness/abuse-resistance). Adds a
    limiter call per route — the founder's "no new limits" guard from M does NOT apply here (adding the
    layer IS this chunk's intent), but every added limiter number/window must be deliberate + justified.
  - **(b) REPLACE / re-order:** auth first, then a single `auth.id`-keyed limit. Simpler key but INVERTS the
    flood-protection ordering (a flooder now forces auth on every request) — likely unacceptable for the
    public/SDK paths; maybe acceptable for low-volume dashboard routes. Per-route judgement.
  - **(c) HYBRID:** IP-keyed pre-auth on the public/SDK/settlement surface; `auth.id`-keyed (with or without
    a retained IP pre-limit) on the dashboard routes. Most likely the right answer — but it must be
    DERIVED per route-class, not assumed.
- **⚠️ SCOPE HAZARD (the inverse of M's, same shape):** the 96 includes **settlement-surface authed routes**
  (e.g. `sdk/meter*`, `payouts/*`, `sessions/*`, `settlements/[id]`, the x402/ap2/circle-nano settle/verify
  paths that authenticate). For those the spine contract is at the **LINE** level: ONLY the rate-limit
  block may change; writer call sites, settle/verify/dispatch, enforce-exact, response shapes byte-identical.
  And the change must NOT weaken the pre-auth flood protection on any settlement/SDK route. The post-build
  gate for those files is a **spine-line diff lens (+ funds-SEAL if any spine logic is in reach)**.
- **Auth-type nuance (trace it):** `requireDeveloper`/`requireConsumer` return a session identity;
  `authenticateDeveloperByApiKey` returns a key/developer identity; the SDK/proxy path keys differ. The
  `auth.id` value to bucket on is NOT uniform — the plan must define it per auth type, and confirm it is a
  stable, non-spoofable, non-PII-leaking bucket key.
- **Value framing (be honest, like M):** this is a real abuse-resistance + multi-tenant-fairness
  improvement (the open HIGH DEBT #1c), NOT an exploited-today hole. No migration. Offline-testable.
  Likely a `lib/rate-limit.ts` helper addition (e.g. an `auth.id`-aware limit wrapper) + per-route wiring.

### ALTERNATIVES (grounded; bring the trade-offs):
- **(K) HMAC-pepper the API-key hash (DEBT #3, LOW-arch).** `lib/crypto.ts hashApiKey` is unsalted shared
  SHA-256 across `sg_live_`/`sg_pub_`. Real defense-in-depth IF the DB is ever disclosed, but **not
  exploitable today**, and it **touches the auth path for ALL keys + needs a pepper env + dual-read
  migration** — a careful dedicated chunk, HIGHER risk (a bug locks out every API key = access/funds
  disruption). Strong #2 if the founder wants a pure security-hardening pass over a fairness one.
- **(C) `revenueSharePct` legacy cleanup (lower priority, hygiene).** Inert column (`metering.ts:298`
  "Legacy — ignored"); MED churn (~20 files + a migration + `metering.test.ts` rewrite); LOW-but-real
  hazard: the `sdk/meter` free-tier overage gate branches on `revenueSharePct === 100` — must re-derive
  from `tier` FIRST. Deliberate hygiene only.
- **(A) ACP-dark kernel wiring — BD-GATED.** Pursue ONLY if the founder says OpenAI/Stripe merchant
  onboarding/BD is in motion. Hard pre-condition: web research FIRST on the operative ACP payment flow
  (the SDK's `validateAcpPayment` models the Stripe SPT checkout-session retrieve whose in-chat flagship
  OpenAI **sunset 2026-03-24** — confirm facilitators still verify via that retrieve). Ships **dark**
  (`ACP_STRIPE_KEY` unset). Touches the SDK (rebuild + 1896-suite). Post-build = **funds-SEAL**. Canonical
  scope: `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md §4`.
- **(H) hop-route schema extension — DEMAND-GATED + reconciler-starvation trap.** Only if multi-hop ledger
  attribution is now wanted (zero consumers verified). MANDATORY guard: constrain the hop `rail` enum to
  EXCLUDE `{x402, circle-nano}` or hop rows are re-SELECTed by the reconciler forever (starvation).
  Funds-SEAL post-build.

*(Prior-session lean, for context not pre-emption: **(N) auth.id keying** — it finishes the open HIGH
DEBT #1c, needs no external signal, no migration, and continues the H1→M rate-limit arc on the surface
just unified. (K) is the strong security-pure alternative; (C) hygiene; (A)/(H) externally gated.)*

---

## 3. ⛔ THE AUDIT CHAIN — founder hard gate (real money). PRE-BUILD AUDIT is MANDATORY before ANY code.

The founder's doctrine: **no implementation code ships until a deep, independent pre-build audit confirms
the build plan is comprehensive, high-quality, to-spec, with every technical/factual assumption verified
against ACTUAL code, and as error-free as possible — verdict PLAN_READY (0 blocking) with ALL fixes
applied — AND a mandatory independent post-build gate passes (0 blocking) before any commit.** Both gates
carry an explicit **over-auditing / spine-safeguard** clause.

### 3a. PRE-BUILD AUDIT — the required mechanism (adapt `.audit/m-prebuild/prebuild-audit.mjs`)
After Step-0 is resolved and a build plan is drafted, run a **deep, independent pre-build audit of the plan
via a dynamic `Workflow` fan-out** — do NOT hand-audit. Required shape (this is what passed for M, two
rounds, 38 agents):
- **A `pipeline()` of fresh-context lenses, each of which RE-DERIVES against actual source — it does NOT
  trust the plan:**
  - **`factual-assumptions`** — every technical/factual claim in the plan (line numbers, censuses, "X is
    read-only", "no caller does Y", behavioral deltas, auth-identity shapes) is verified against the real
    code with tools. A false/unverified assumption is a finding.
  - **`completeness`** — no gap: every affected file/route censused, every forced edit (tests, downstream
    consumers, sentinel/equality guards) found, every behavioral delta enumerated, every edge case named.
  - **`correctness-invariant`** — the design is correct + regression-free: the value deltas are sound, no
    caller is wrongly limited/un-limited, no bucket collision, the funds/abuse invariants hold, the
    ordering/trade-off decision is actually safe.
  - **`scope-regression`** — the plan does NOT grow scope or touch the byte-stable spine; the line-surgical
    contract on settlement-surface files is explicit.
- **→ adversarial verify:** every finding is handed to a FRESH agent that tries to REFUTE it; a finding
  survives ONLY with a concrete code trace (file:line read that session). Default "refuted".
- **→ guarded synthesis → verdict `PLAN_READY` (0 blocking) / `PLAN_NEEDS_FIXES`** with the findings ranked
  blocking / improvement / nit / rejected-scope-expansion.
- **Loop:** apply ALL fixes to the plan, re-run the audit, repeat until **PLAN_READY (0 blocking)** with all
  improvements/nits resolved. Record the verdicts (e.g. `.audit/<chunk>-prebuild/round{1,2}-verdict.txt`).
  Only THEN does implementation begin. (If subagents die "without calling StructuredOutput" from a transient
  rate-limit, resume `Workflow({scriptPath, resumeFromRunId})` — cached agents return.)

### 3b. ⚠️ Over-auditing / spine-safeguard guard (embed in BOTH gates — protect the spine)
The goal is **objective confidence, NOT finding-count.** A finding that GROWS SCOPE — re-architecting the
limiter, adding/removing/tuning limits beyond the chunk's intent, "improving" a settlement file beyond its
in-scope lines, re-deriving an identifier PREFIX, migrating an `ipAddress` capture, re-litigating a SETTLED
decision (§1) without a NEW trace — is classified **`rejected-scope-expansion`**, NOT a blocker, UNLESS it
proves a PLANNED change is itself wrong (a value delta that breaks a caller, a missed forced edit, a
non-byte-stable hunk in a settlement file, a funds/idempotency hole, a false plan assumption). **Zero
findings is a valid, expected outcome for a clean plan.** Do NOT hallucinate fixes that cause regressions.
A dedicated `scope-regression` lens + an explicit SCOPE GUARD section in the build plan enforce this.

### 3c. POST-BUILD gate — MANDATORY, 0 blocking BEFORE any commit
A green suite is NOT sufficient (independent audit has caught real holes a green suite masked). After
implementation + green gates, run a deep independent **post-build gate** (same Workflow fan-out: lenses →
adversarial verify → synthesis at PASS/0-blocking, over-auditing guard applied):
- **Off the funds spine** (e.g. (N) auth.id keying if it stays line-surgical on settlement routes) → the
  **security/regression panel** with a **spine-line diff lens** over the settlement-surface union (adapt
  `.audit/m-postbuild/security-panel.mjs`).
- **Touches the spine** (e.g. (A)/(H), or if (N) changes any settle/verify logic) → the **funds-SEAL** (adapt
  `.audit/b4-postbuild/seal-panel.mjs`, dark-gate/double-write/exactly-once lenses).
- A final **highest-confidence certification** pass (adapt `.audit/m-certify/certify.mjs`) is the founder's
  standard before declaring the chunk done.

---

## 4. Scope sketch — **(N) auth.id keying** (SKETCH ONLY — verify everything; build only if Step-0 picks it)
1. **Trace first (no edits):** enumerate the ~96 authed-rate-limited routes; classify each by (auth type ×
   public/SDK/settlement/dashboard) and current limit (limiter, prefix, pre- vs post-auth). Identify the
   `auth.id`/identity value available per auth type and confirm it is a stable, non-spoofable, non-PII key.
2. **Decide the keying model per route-class** (§2 design decision (a)/(b)/(c)) with the funds/abuse
   trade-off written down — this is the heart of the build plan and the #1 thing the pre-build audit must
   stress-test.
3. **Helper, then wiring:** likely a `lib/rate-limit.ts` addition (an `auth.id`-aware limit + the
   two-layer/ordering convention), then per-route wiring — single-writer, file-by-file or an asserted codemod
   for the uniform cases (the M approach is the model: manual for variance, asserted+dry-run codemod for the
   uniform bulk, full gates + panel as proof).
4. **Settlement-surface routes:** line-surgical; the post-build spine-line diff lens verifies byte-stability.
5. **Tests:** new limiter behavior pinned; identifier-pinning route tests updated; **the M test-mock lesson
   applies** — any newly-used `@/lib/rate-limit` export must be exposed in every route test that mocks it.
6. Done-check greps + the no-regression invariants (no route loses its flood protection; no legit caller
   wrongly limited; no bucket collision).

---

## 5. Guardrails (real money — non-negotiable)
- **Single-writer core; READ-ONLY parallel verification.** Fan-out is for the pre-build audit, the post-build
  panel/SEAL, and the certification ONLY — NEVER to mutate files in parallel (shared-worktree hazard: use
  atomic path-scoped `git commit -- <paths>`; quote bracketed `[slug]`/`[id]` paths).
- **Ground every conclusion in ACTUAL tool output.** The green suite has historically masked holes; the
  audits + done-check greps are the real gate.
- **Byte-stable / settled (§1) — do NOT touch or re-litigate.** Line-surgical on any settlement-surface file.
- Do NOT push, set/change prod env, or apply migrations — all FOUNDER-GATED. Demo sandbox must never reach a
  real settle.
- **Flag context degradation** the moment it risks implementation quality (founder standing order); checkpoint
  + recommend a continuation session if a high-volume sweep outgrows one context.
- Commit author for local commits: `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com"
  commit -- <paths>`, trailer `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.

---

## 6. File-path index
- **This handoff:** `docs/tech-debt/next-chunk-handoff-2026-06-05-post-m.md`
- **Just-shipped (M)+(E) capstone:** `docs/tech-debt/m-getclientip-migration-resolution-2026-06-05.md`
- **Prior Step-0 menu (candidate analysis):** `docs/tech-debt/next-chunk-handoff-2026-06-05-post-h1.md` §3
- **DEBT register (DEBT #1c = the lead; alternatives):** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`
- **H1 capstone (rate-limit posture the lead builds on):** `docs/tech-debt/h1-rate-limit-availability-resolution-2026-06-05.md`
- **ACP (alt A) canonical scope:** `docs/tech-debt/p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md`
- **Rate-limit source of truth:** `apps/web/src/lib/rate-limit.ts` (`getClientIp:194-203`, `checkRateLimit`,
  the shared limiters), `apps/web/src/lib/middleware/auth.ts` (the auth guards), `apps/web/src/lib/crypto.ts`
  (`hashApiKey` — alt K).
- **Audit-chain templates (gitignored, adapt):** pre-build `.audit/m-prebuild/prebuild-audit.mjs`
  (+ `round{1,2}-verdict.txt`); post-build `.audit/m-postbuild/security-panel.mjs` +
  `.audit/b4-postbuild/seal-panel.mjs`; certification `.audit/m-certify/certify.mjs`.
- **Memory:** `m-getclientip-chunk.md` (the just-finished chunk) + `settlegrid-cross-account-state.md`.
