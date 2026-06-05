# SettleGrid — NEXT CHUNK handoff (post-B4, Step-0-gated) (2026-06-04)

> **Self-contained handoff for a fresh agent. Read this end-to-end before doing anything.**
> SettleGrid settles **real USDC** (x402 + circle-nano LIVE on Base mainnet; ap2 LIVE as a
> verification facilitator) → suggest `/effort max`. The HARD gate is a **deep, independent
> PRE-BUILD AUDIT of your build plan** (§6) — **no implementation code until it returns
> PLAN_READY with ALL fixes applied** — and a **mandatory post-build panel** (§7) before any seal.
> **⚠️ Read §3 (Step-0) first-thing.** The settlement-spine completion arc (money-mechanics → B4)
> is DONE; the strongest remaining candidates are **gated on signals only the founder has**
> (is BD in motion? is multi-hop ledger attribution wanted?). Do NOT assume a settlement chunk —
> the recommended lead is an **off-funds-spine hardening** chunk. The founder picks.

## 0. Read order
1. **This doc, end-to-end.**
2. `docs/tech-debt/b4-account-attribution-resolution-2026-06-04.md` — the chunk just sealed
   (settlement-row `account_id` IS the developer id, PERMANENT; the zero-row credit alert). The
   freshest spine grounding + the audit-chain pattern this repo runs.
3. `docs/tech-debt/settlement-money-mechanics-seal-2026-06-04.md` — the take-model truth
   (`take_bps=0` CORRECT; take realized progressively at PAYOUT) + the `after()` durability
   precedent. **The settlement spine is SETTLED; do not re-open it.**
4. `docs/tech-debt/acp-step0-decision-and-claims-correction-2026-06-04.md` — the Step-0 +
   certification-panel pattern, AND the B2-moot finding (recordHop / `postLedgerEntryAsync` are
   prod-dead — relevant if Step-0 picks the hop-route option).
5. `docs/tech-debt/p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md` — the **full ACP-dark
   scope (§4)**, still accurate, IF Step-0 picks ACP. Its §6/§6a are the audit-gate template.
6. `docs/tech-debt/b4-account-attribution-build-plan-2026-06-04.md` — the **build-plan + SCOPE
   GUARD shape to reuse** (mirror its §3 SCOPE GUARD and §8/§9 statements).
7. `.audit/` (LOCAL, untracked, gitignored — on disk): `b4-prebuild/prebuild-audit.mjs` (the
   freshest PLAN_READY pre-build workflow base) + `b4-postbuild/seal-panel.mjs` (the freshest
   funds-SEAL base). Adapt these (§6/§7).

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`. Branch `main`. **`origin/main` = `93767508`** (money-mechanics,
  pushed + live). **Local-only stack on top (push FOUNDER-GATED, do NOT push) — 6 commits:**
  `9a9f866d` (P5 handoff) → `df9a2477` (ACP claims, CERTIFIED) → `2e4da629` (ACP cert verdict) →
  `119d1f8a` (gitignore /.audit/) → `f378558c` (B4 handoff) → **`be43b501` (B4, SEALED) = HEAD**.
  Confirm: `git -C /Users/lex/settlegrid status --short && git log -3 --oneline`.
  **Build on `be43b501`.**
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel `/settle` settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as verification facilitator;
  enforce-exact circle-nano + durable ap2 ledger write LIVE. Prod runs `origin/main` — the local
  stack (incl. B4) is NOT deployed.
- **Base green expected (run BOTH suites first):**
  - `cd apps/web` → `npx tsc --noEmit` (0) · `npx vitest run` (**4222 pass / 1 KNOWN
    pre-existing fail** `processDataDeletion` in `settlement-moat.test.ts`) · `npx eslint
    <changed>` (0) · `npx next build` (0; do NOT run concurrently with tsc — they race on
    `.next/types`).
  - `cd packages/mcp` → `npx vitest run` (**1896 pass / 1 skip**). If the picked chunk edits the
    SDK (ACP does; rate-limit/processDataDeletion/revenueSharePct do NOT), **rebuild the SDK
    after editing it**.
- npm (NOT pnpm). viem is **apps/web-only**. `route.ts` files export only HTTP verbs + Next
  config. Migrations live in `apps/web/drizzle/` (last `0013_developer_api_keys.sql`). **Founder
  applies migrations to prod — NEVER run one against prod. Backfills ship as founder-run runbook
  docs.** (Most candidates below need NO migration.)

## 2. The chunk — goal
The settlement-spine completion arc (P5 kernel dispatch → money-mechanics → B4) is **complete and
sealed**. This chunk is **Step-0-gated**: pick the next chunk from the grounded fork in §3, then
execute it with the **full 3-part audit chain** (pre-build audit → implement surgically →
post-build panel). Most of the strongest remaining settlement options are founder-signal-gated, so
the **recommended default** is an off-funds-spine hardening chunk — but the founder decides.

## 3. ⚠️ Step-0 — the next-chunk decision (REQUIRED before you scope anything)
**The landscape was re-grounded against actual code at `be43b501` (read-only research fan-out,
2026-06-04). Findings below; re-verify any line you depend on — they drift.**

**RECOMMENDED LEAD — (R) Rate-limit / availability hardening (publisher-keys DEBT #1).** The only
actionable-now candidate with real, documented value that needs **no external signal** and **never
touches the funds spine**. Verified gaps:
- `apps/web/src/lib/rate-limit.ts` `checkRateLimit` calls `limiter.limit(id)` with **no try/catch
  and no `ephemeralCache`** → a Redis/Upstash outage **throws**, breaking every rate-limited route
  (no graceful fail-static). This is a live availability gap.
- IP identity is derived from raw `x-forwarded-for` at **~218 call sites in two inconsistent
  styles** (≈123 use the whole header, ≈95 use `.split(',')[0]`) — both **attacker-spoofable**
  (left-most XFF), so per-IP limits are evadable. No shared helper.
- **3 genuinely-unprotected public routes:** `api/tools/serve/[slug]` (POST, runs handlers / hits
  external APIs — unprotected), `api/unsubscribe`, and `api/mcp` (POST — proxies to internal
  `tools/serve` + `proxy` which ARE limited, so confirm inheritance vs. add a direct limit).
  *(`cron/*` + `admin/*` are CRON_SECRET/ADMIN_KEY-gated; `badge/*` + `developers/count` are
  cacheable read GETs — verify before deciding they need limits.)*
- **Scope discipline (this is the trap for THIS chunk):** the IP migration is a **200+-caller
  mechanical edit** — at odds with this repo's surgical culture. The Step-0/build-plan decision is
  whether to (i) ship the **high-value surgical core** now — the central fail-mode + `ephemeralCache`
  fix in `checkRateLimit`, a single **trusted-IP helper** (rightmost-XFF / Vercel-trusted), and the
  3 unprotected routes — with the full 218-caller migration as an explicit **documented follow-on**;
  or (ii) do the full migration in one chunk (broad blast radius → larger regression surface, larger
  audit). **Recommend (i): surgical core + helper + unprotected routes; migration as follow-on.**
  Off funds spine; offline-unit-testable; no migration.

**ALTERNATIVES (all grounded; bring the founder the trade-offs):**
- **(A) ACP-dark kernel wiring — settlement-arc continuation, BD-GATED.** Pursue ONLY if the
  founder says OpenAI/Stripe merchant onboarding/BD is in motion. Full scope is
  `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md §4` (verified still 100% accurate at
  `be43b501` — nothing drifted/landed). **Hard pre-condition (pure web research, go/no-go BEFORE
  any code):** re-verify the operative ACP payment flow — the SDK adapter's verify
  (`packages/mcp/src/adapters/acp.ts:323` `validateAcpPayment` → `retrieveCheckoutSession` →
  live `fetch` to `api.stripe.com/v1/checkout/sessions/...`, asserts `payment_status==='paid'`)
  models the Stripe **SPT checkout-session** flow whose in-chat flagship OpenAI **sunset
  2026-03-24**; confirm an ACP service provider still verifies via that retrieve (vs. the
  Delegated-Payment spec / a different PSP shape). **No offline gold test exists** (verify is a
  live Stripe call) → it ships **dark** (`ACP_STRIPE_KEY` UNSET in prod); the real-money path is
  unprovable until onboarding. Touches the **SDK** (rebuild after). This is the natural
  P5 continuation, but its value is groundwork/parity, not revenue, and it cannot be exercised
  end-to-end now.
- **(D) `processDataDeletion` fix — cheapest clean win (publisher-keys DEBT #5).** Clears the
  **perennial "1 pre-existing fail"** (`settlement-moat.test.ts` `processDataDeletion`, in every
  chunk's baseline) so future SEALs run fully green, AND fixes a genuine **non-idempotency**
  (`lib/settlement/compliance.ts:~337` — a re-run throws on the `status!=='pending'` guard instead
  of treating `completed` as a no-op). Off funds spine (GDPR/compliance path; financial rows are
  explicitly retained — verify). Small, surgical, offline. **Decide in the plan:** fix the
  test-mock-vs-impl drift, the idempotency bug, or both (DEBT #5 implies both). LOW-MED value but
  the cheapest win; could be folded in alongside (R) or done first.
- **(H) Hop-route schema extension — DEMAND-GATED, has a trap; pick only if multi-hop ledger
  attribution is now wanted.** Wire `rail`/`protocol`/`accountId`/… through the
  `POST /api/sessions/[id]/hop` zod schema (currently strips them — `route.ts:13-20`) so
  `recordHop`'s per-hop settlement-row trail (`sessions.ts:~461-483`, prod-dead today) fires.
  **Verified DEMAND-GATED:** **zero** code reads settlement rows by `session_id` anywhere (the
  `hops` JSONB on `workflowSessions` is the authoritative per-hop record — the only thing
  `finalizeSession` reads); the feature has **no SDK surface, no demo, no discovered prod caller**,
  and the hop endpoint has **no API-layer test**. **Verified TRAP (must be guarded in the plan):**
  mis-credit is impossible (a hop's random-UUID `operation_id` fails
  `parseSettlementOperationId` → `skipped-unparseable` before any credit), BUT a hop row written
  with `rail ∈ {x402,circle-nano}` + an `externalRef` is **re-SELECTed by the reconciler every
  run forever** (never flips terminal), eventually crowding the bounded 25-row batch
  (starvation + log-noise). **Guard:** constrain the hop `rail` enum to EXCLUDE the two on-chain
  reconcilable rails. Also: durability can't simply mirror ap2's `after()` (recordHop's
  request-scope-free unit tests would break — the B2-moot finding); decide lib-layer
  fire-and-forget (acceptable — audit-only, no consumer) vs. a route-layer durable write. Touches
  the settlement surface → needs the funds-SEAL post-build. **Recommend: defer** unless the founder
  confirms the multi-hop ledger trail is now wanted.
- **(C) `revenueSharePct` legacy cleanup — lower priority.** Confirmed **inert** (read in ~6 sites,
  never applied to a credit; `metering.ts` hardcodes gross; a guard test `billing-credits.test.ts`
  forbids net-crediting). Removal is **MED churn** (column is `NOT NULL DEFAULT 100`, threaded
  through ~20 files + a migration + the guard-test rewrite) and carries **LOW-but-real risk** (the
  `sdk/meter` free-tier overage gate branches on `revenueSharePct === 100` — must be re-derived
  from `tier` first) on the **metering hot path**. Do only as deliberate hygiene; (R)/(D) are
  higher value-per-risk.

**The founder picks. Do NOT scope or plan before Step-0 is resolved.** Bring the trade-offs.
*(Prior-session lean, for context not pre-emption: **(R)** scoped surgically — best
value-per-risk, no external signal, off the funds spine — optionally bundling **(D)** for a green
baseline; **(A)** only if BD is in motion; **(H)** only if multi-hop attribution is wanted.)*

## 4. Scope sketches (verify everything — these are sketches, not plans)

**IF (R) rate-limit hardening — surgical core (recommended shape):**
1. `apps/web/src/lib/rate-limit.ts` — wrap `limiter.limit(id)` in try/catch with an **explicit,
   documented fail-mode** (decide fail-static/allow vs. fail-closed per route class — a global
   fail-open is an abuse hole, a global fail-closed is an availability hole; the safe default for
   most public routes is fail-open-with-alert, but settlement-adjacent routes may warrant
   fail-closed — justify in the plan) + add Upstash `ephemeralCache`.
2. A single **trusted-IP helper** (e.g. `getClientIp(request)`) using the rightmost/Vercel-trusted
   hop, replacing the spoofable left-most XFF; apply it at the highest-risk routes (and, if scoped
   in, mechanically across all ~218 callers — else document the migration as a follow-on).
3. Add rate limiting to the genuinely-unprotected public routes (`tools/serve/[slug]`,
   `unsubscribe`; confirm `mcp` inherits via its internal proxies or add a direct limit).
4. Tests: unit the fail-mode (limiter throws → expected behavior), the IP helper (proxy chains,
   IPv6, missing/garbage headers, spoof attempt), and per-route limit presence. **All offline.**
   No migration. No SDK change. No funds-spine file touched.

**IF (A) ACP-dark — see `p5-...handoff-...md §4` (the canonical, verified scope).** Summary: create
`api/acp/{verify,settle}/route.ts` (mirror `api/ap2/...`), add `'acp'` to
`PHASE_1_KERNEL_PROTOCOLS` (`kernel.ts:222-228`) + the facilitator gate (`kernel.ts:~405-410`),
move the ACP token into `payment.proof` + split a `validateAcpCredentialString` core, durable
ledger write via `after()` with `takeBps:0` + `settledAt`, demo config 5→6
(`demo-kernel-config.ts:182-188`) + sandbox stubs, repoint the unwired-fallthrough test
(`kernel.test.ts:~783`, ACP→UCP). Mocked Stripe; ships dark. **Do the web-research pre-condition
FIRST.**

**IF (D) processDataDeletion — surgical:** `lib/settlement/compliance.ts` (idempotency: treat a
`completed`/non-`pending` deletion as a no-op rather than throwing) + `settlement-moat.test.ts`
(fix the txn/select mock shape to satisfy the 9-step body). Decide both-vs-one in the plan. No
migration. No funds movement (financial rows retained — verify step 9).

**IF (H) hop-route — with the §3 guards:** `api/sessions/[id]/hop/route.ts` (extend `hopSchema`;
**constrain `rail` to a non-reconcilable enum**; `accountId` `.uuid()`; bound `currency`) + new
route tests (accept/reject new fields, the rail-enum guard, passthrough) + likely a `multi-hop.test.ts`
edit (mock `./ledger` to assert the settlement branch fires). `RecordHopInput`/`recordHop` already
accept the fields — likely no edit there. Funds-SEAL post-build (settlement surface).

## 5. Key files (verify line numbers — they DRIFT)
- **(R):** `apps/web/src/lib/rate-limit.ts` (`checkRateLimit`, `sdkLimiter`, the limiters);
  callers via `rg "x-forwarded-for" apps/web/src`; unprotected routes
  `apps/web/src/app/api/{tools/serve/[slug],unsubscribe,mcp}/route.ts`.
- **(A):** `packages/mcp/src/adapters/acp.ts` (`validateAcpPayment:323`, `extractPaymentContext:39`),
  `apps/web/src/lib/acp-proxy.ts`, `apps/web/src/lib/settlement/adapters/acp.ts`,
  `apps/web/src/lib/env.ts` (`isAcpEnabled`/`getAcpStripeKey` :225-231),
  `packages/mcp/src/kernel.ts` (`PHASE_1_KERNEL_PROTOCOLS:222-228`, gate `:~405-410`),
  `packages/mcp/src/__tests__/kernel.test.ts:~783`, `apps/web/src/lib/demo-kernel-config.ts:182-188`.
  (`api/acp/` does NOT exist yet — the chunk creates it.)
- **(D):** `apps/web/src/lib/settlement/compliance.ts` (`processDataDeletion`),
  `apps/web/src/lib/__tests__/settlement-moat.test.ts`.
- **(H):** `apps/web/src/app/api/sessions/[id]/hop/route.ts`,
  `apps/web/src/lib/settlement/sessions.ts` (`recordHop`),
  `apps/web/src/lib/settlement/session-types.ts` (`RecordHopInput`),
  `apps/web/src/lib/settlement/reconcile.ts` (the SELECT + `parseSettlementOperationId` — the trap).
- **Spine (RECORD, do NOT rewrite — any chunk):** `apps/web/src/lib/settlement/ledger.ts`
  (`recordSettlementEntry`, `settlementEntryId`, `markSettlement*`), `reconcile.ts`
  (`creditSettlement`), `payouts/process.ts`, `lib/pricing.ts`.

## 6. ⛔ HARD GATE — deep, independent PRE-BUILD AUDIT of the build plan (MANDATORY, before ANY code)
After Step-0 + writing the build plan (and BEFORE any implementation code), run a **deep,
independent pre-build audit via a dynamic `Workflow` / agent fan-out**. It MUST confirm the plan is
**comprehensive, high-quality, to-spec, every technical & factual assumption verified against the
ACTUAL code, and as error-free as possible** — and it MUST reach **PLAN_READY (0 blocking) with ALL
fixes applied before implementation begins.** Founder requirement; not optional.

**Mechanism (proven 4 chunks running — adapt `.audit/b4-prebuild/prebuild-audit.mjs`, the freshest
base):** a `Workflow` script, `pipeline()` of fresh-context lenses → adversarial verify → guarded
synthesis:
- **Lenses (parallel, each RE-DERIVES against ACTUAL source, NOT trusting the plan):**
  `factual-assumptions` (every file:line claim + the §3 ground truths re-verified live —
  for (R) the spoofable-IP + no-fail-mode claims, the unprotected-route list, the 218-caller count;
  for (A) the SDK/kernel wiring points + the live-Stripe reality; for (H) the reconciler trap +
  the no-consumer claim), `completeness` (the plan enumerates EVERY forced test edit; a literal
  follow yields GREEN suites in BOTH `apps/web` and `packages/mcp`; migration/SDK-rebuild steps
  complete where applicable), `correctness-invariant` (for a funds chunk: exactly-once credit
  preserved, reconciler never mis-/zero-credits, no second authoritative balance, take model
  untouched, settledAt on settled rows — **for an off-funds chunk like (R)/(D): no regression** —
  no legitimate caller wrongly limited, fail-mode doesn't open an abuse hole or an availability
  hole, no route silently loses protection, idempotency holds), and **`scope-regression`** (§6a).
- **Adversarial verify:** every finding independently refuted by ≥1 fresh agent (default "refuted"
  unless a concrete code trace proves it real) so plausible-but-wrong findings die.
- **Synthesis → verdict** `PLAN_READY` / `PLAN_NEEDS_FIXES` (+ blocking list). **Apply ALL blocking
  fixes, re-run a FRESH audit (agents re-read the revised plan), repeat until PLAN_READY.** Use
  **full-reasoning agents** (the workflow default — NOT the search-only `Explore` type).
- *(Ops notes, freshly confirmed this session: a server rate-limit can kill a workflow's subagents
  mid-run — they finish "without calling StructuredOutput". **Resume with
  `Workflow({scriptPath, resumeFromRunId})`** — completed agents return from cache. This happened
  on the B4 SEAL and resumed cleanly.)*

### 6a. ⚠️ Over-auditing regression guard (safeguard the spine)
Pre-build audits balloon scope ("also harden X, also fix Y"). The **`scope-regression` lens is the
spine guard**: it must confirm the plan stays **surgical** and FLAG any finding that adds scope, new
money movement, a second authoritative balance store, or churn beyond the founder's Step-0 decision.
Encode an explicit **SCOPE GUARD** section in the build plan (mirror
`b4-account-attribution-build-plan-2026-06-04.md §3`): list byte-stable / out-of-scope (§8 below).
**Treat any audit finding that grows scope as REJECT-with-rationale, not auto-apply** (copy the B4 /
ACP-certification refuter mechanism — `severityFinal: 'rejected-scope-expansion'`). The audit's job
is to make the PLANNED chunk correct, not to expand it. **Zero findings is a valid outcome; do not
hallucinate problems.** *(Note for (R): the 218-caller migration is itself the scope-growth risk —
the scope-regression lens should HOLD the plan to its chosen boundary, e.g. surgical-core +
follow-on, not let the audit demand the full migration unless the founder scoped it in.)*

## 7. Post-build panel (MANDATORY before seal — lens-shape depends on the picked chunk)
After implementation + green gates, run a **deep, independent post-build panel** (adapt
`.audit/b4-postbuild/seal-panel.mjs`). **A green suite is NOT sufficient** — independent audit
masked nothing in B4 but caught real holes in A1/x402. Calibrate the lenses to the chunk:
- **If the chunk touches the funds/settlement surface ((A) ACP, (H) hop-route): a funds-safety
  SEAL panel** — adversarial lenses hunt a path where a real-money settle is wrongly enabled, the
  ledger double-/under-writes, exactly-once or the take model breaks, a byte-stable core changed, a
  dark-gate leaks (ACP off in prod), the reconciler mis-/zero-credits (hop trap), or the demo
  sandbox reaches a real settle. Verdict **SEAL (0 blocking)**.
- **If the chunk is off the funds spine ((R) rate-limit, (D) processDataDeletion, (C)
  revenueSharePct): a security/regression panel** (funds-SEAL is N/A — precedent: the ACP-claims
  chunk substituted a fact/scope panel for the funds SEAL). For (R): does any legitimate caller now
  get wrongly limited? does the fail-mode open an abuse hole OR an availability hole? does any route
  lose protection? does the IP helper mis-handle proxy chains / IPv6 / missing headers / a spoof
  attempt? did the mechanical edit miss or corrupt a caller? For (D): is the deletion idempotent now,
  and are financial-record retention guarantees intact? Verdict **PASS / 0-blocking**.
Either way: **0 blocking** before any commit, with the scope guard (§6a) applied to the panel's
findings too.

## 8. BYTE-STABLE (do NOT rewrite) + settled questions (do NOT re-litigate)
- The sealed exactly-once credit machinery: `recordSettlementEntry` internals +
  `settlementEntryId` + `onConflictDoNothing` (FIRST-WRITE-WINS — flips via explicit `UPDATE` on
  `operation_id` + `rail`), `markSettlementSettled`/`Failed`/`Broadcast`, `findSettlementRow`,
  `creditSettlement`'s credit-iff-you-flipped contract **and its B4 zero-row throw**
  (`reconcile.ts`), the orchestrators (`x402/orchestrate.ts`, `circle-nano/settle.ts`), the payout
  pipeline (`payouts/process.ts`) + progressive take (`lib/pricing.ts`), the on-chain
  engines/verifiers, dedup on `(from,nonce)` never signature bytes.
- **The take model is SETTLED: `take_bps=0` on settlement rows is CORRECT** (take realized at
  payout; dev credited GROSS). Do NOT compute a per-row take.
- **`developers.balanceCents` is the ONLY authoritative balance** — `accounts` stays dormant;
  nothing may make it authoritative as a side effect. **Settlement-row `account_id` IS the
  developer id (B4, PERMANENT) — NEVER backfill it to `accounts.id`** (guard-tested `B4 SEMANTIC
  GUARD`).
- All SEAL/CERTIFIED commits (x402, circle-nano, money-mechanics, the ACP claims copy `df9a2477`,
  B4 `be43b501`). A new chunk is ADDITIVE/surgical, not a spine rewrite.

## 9. Verification gates
`cd /Users/lex/settlegrid/apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (≥4222 pass + new;
1 known pre-existing fail — UNLESS the chunk is (D), which should make it 0) · `npx eslint
<changed files>` (0) · `npx next build` (0; do NOT run concurrently with tsc). **PLUS** `cd
packages/mcp && npx vitest run` (1896/1 skip baseline; rebuild the SDK if edited — only (A) does).
**DB-affecting behavior must be proven with the REAL validators/functions** (a mocked writer is
insufficient — A1's lesson). Migrations (none needed for (R)/(D)/(H); (A) none): generate + lint
locally; **applying to prod is FOUNDER-GATED**.

## 10. Sequencing (the founder-required order)
Pre-flight (§1) → **Step-0 decision (§3, founder picks)** → (if (A): the web-research pre-condition
FIRST) → trace + finalize scope → write the BUILD PLAN (with the §6a SCOPE GUARD section) →
**PRE-BUILD AUDIT until PLAN_READY, all fixes applied (§6)** → implement surgically (single-writer)
→ post-build verify (§9) → **post-build panel (§7, funds-SEAL or security/regression per the
chunk)** → founder-gated local commit (path-scoped) → capstone/debt-register docs + memory pointer
→ (push + any migration apply remain FOUNDER-GATED).

## 11. Standing rules / guardrails (real money)
- **Single-writer core + READ-ONLY parallel verification.** Fan-out is for AUDIT only; implement
  single-writer.
- **Ground every conclusion in ACTUAL tool output** — re-verify every file:line in this doc; the
  green suite has repeatedly masked holes (A1/x402) — the audits are the real gate.
- Commit **LOCAL-ONLY**, **path-scoped** (`git commit -- <paths>`; quote bracketed dirs like
  `"apps/web/src/app/api/sessions/[id]/hop/route.ts"`). `git user.name` is unset → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`,
  trailer `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.
- **Shared-worktree hazard:** parallel sessions share the tree + index — atomic path-scoped commits
  only.
- Do NOT push; do NOT set/change prod env; do NOT apply migrations to prod; demo sandbox must never
  reach a real settle; (if (A)) keep `ACP_STRIPE_KEY` UNSET in prod (dark).
- **Flag context degradation** the moment it risks implementation quality (founder standing order).

## 12. Out of scope / deferred (note — do NOT chase; verified moot/blocked at `be43b501`)
- **`postLedgerEntryAsync` / repo-wide fire-and-forget → `after()`: MOOT.** `postLedgerEntryAsync`
  has ZERO prod callers; recordHop's async write is prod-unreachable (the hop schema strips the
  fields); every LIVE settlement write is already durable. Not a chunk.
- **UCP wiring: RESEARCH-ONLY.** `packages/mcp/src/adapters/ucp.ts:~269` verify is a no-op stub; no
  offline primitive. Needs verify-semantics research before it's an implementable chunk.
- **CRON_SECRET rotation: OPS, not code** (enforced fail-closed everywhere already).
- **Tier-2/3 rails** (Visa TAP / Mastercard VI / EMVco / L402 / alipay / kyapay): blocked on partner
  sandboxes / infra. Not actionable solo / not offline-testable.
- **B1.4 reconciler debt** (`eip155:1` unconfirmable, sticky-row starvation, `last_reconciled_at`
  watermark): gated on x402 facilitator-mode being ON in prod (latent/off today).
- **Per-rail settlement-time take; ap2 no-`transactionId` dedup (inherent); the hop-route durability
  detail; gas-economics (founder strategy).** The take model + the ACP public copy + the B4 semantic
  are SETTLED/CERTIFIED — do not re-open. The P5 master doc + A1 register are the debt registers to
  UPDATE at close, not rewrite.
