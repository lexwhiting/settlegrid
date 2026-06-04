# SettleGrid — NEXT CHUNK handoff: settlement money-mechanics completion (2026-06-03)

> **Self-contained handoff for a fresh agent.** Read this end-to-end before doing anything.
> This is **real money** (x402 + circle-nano + ap2 are LIVE in prod, settling real USDC) →
> suggest `/effort max`. The HARD gate is the **deep, independent PRE-BUILD AUDIT of your build
> plan** (§6) — no implementation code until it returns PLAN_READY with all fixes applied.

## 0. Read order
1. This doc, end-to-end.
2. `docs/tech-debt/a1-facilitator-ledger-writes-2026-05-30.md` — the canonical carried-debt register
   (takeBps:0, accountId stand-in, fire-and-forget, ap2 dedup) + the **A2 traps** (first-write-wins,
   `operation_id` matching, dedup on `(from,nonce)`). **The single most important grounding doc.**
3. `docs/tech-debt/circle-nano-funds-safety-seal-2026-06-02.md` — the most recent live-money chunk;
   its trace/build-plan/SEAL are the **template** for how this chunk should run (Step-0 → trace →
   build plan → pre-build audit → implement → post-build SEAL panel). Reuse that shape.
4. `.audit/circle-nano-prebuild/` (untracked, local) + `.audit/circle-nano-postbuild/seal-panel.mjs` —
   the **runnable pre-build/post-build audit workflows** from the last chunk; adapt them (§6/§7).

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`. Branch `main`, **HEAD = `origin/main` = `71a9ad94`** (synced 0/0), clean
  tree (only untracked `.audit/`). Confirm: `git -C /Users/lex/settlegrid status --short && git log -1 --oneline`.
- **LIVE prod state (do NOT regress):** x402 proxy on-chain settlement + circle-nano kernel `/settle` are
  LIVE on Base mainnet, settling USDC to the **revenue wallet `0xdcefe0094755ae37395198488f057daa6e430724`**
  (both `SETTLEGRID_PAYMENT_ADDRESS` + `SETTLEGRID_USDC_RECIPIENT` = it). ap2 settle is LIVE
  (`AP2_SIGNING_SECRET` set). Gas wallet (hot, key-in-env) = `0x0859cF704798619133241A385220D6797C635c95`.
- Build base green expected: `cd apps/web && npx tsc --noEmit` (0) · `npx vitest run` (baseline ~4218
  pass / **1 known pre-existing fail** `processDataDeletion` in `settlement-moat.test.ts`) · eslint 0 ·
  `npx next build` (0). Run these first to confirm a clean base.
- npm (NOT pnpm). viem is **apps/web-only** (no `packages/mcp` change unless truly required → if you
  touch the SDK you must rebuild it). Route files (`route.ts`) may export only HTTP verbs + Next config.

## 2. The chunk — goal
**Now that the live rails settle real USDC, make the per-settlement money mechanics COMPLETE, CORRECT,
and MONETIZATION-READY** — before expanding to more rails (P5) which would replicate today's gaps ~10×.

This is the **founder-recommended next chunk** (chosen over P5 kernel-dispatch expansion and Task C
facilitator hardening): P5 is *expansion* and should follow correct money mechanics; Task C is gated on
the public facilitator, which is OFF.

## 3. Scope (candidate sub-items — Step-0 with the founder will finalize which are IN)
Grounded in code; the build plan must verify each against the ACTUAL source.
1. **Platform take (the monetization core).** Every live settle path hardcodes `takeBps: 0` —
   `apps/web/src/lib/settlement/x402/orchestrate.ts:142`, `apps/web/src/lib/settlement/circle-nano/settle.ts:91`,
   `apps/web/src/app/api/ap2/settle/route.ts:174`. The infra exists (`take_bps`/`take_cents` columns
   `apps/web/src/lib/db/schema.ts:877`; the `takeBps` field on `recordSettlementEntry`). Wire **computation
   of `takeBps`/`takeCents`** from a **configurable rate** (default **0** → turning monetization on becomes a
   config flip, NOT a code change). NOTE the interplay with `developers.revenueSharePct` (default 100 = dev
   keeps 100%) — Step-0 must reconcile the two take models.
2. **Over-collection / payer fairness.** circle-nano tolerates `value >= requiredBaseUnits`
   (`apps/web/src/lib/settlement/circle-nano/verify.ts:189`, comment at `:103-107`) while x402 is exact
   (`value === requiredBaseUnits`). An over-authorized circle-nano payment collects the full `value` to the
   recipient but credits the dev only `costCents` → the excess is silently retained. Decide: enforce-exact,
   credit/refund-excess, or document-as-accepted.
3. **Unowned-priced-tool.** A priced tool with no `developerId` settles-without-crediting. Define behavior.
4. **`accountId = developerId` stand-in.** The `accounts` table has **NO provisioning path anywhere** in the
   codebase (A1 register Decision 1) — settlement rows attribute to `developerId`. Proper take accounting
   ("where does the platform's cut land?") may force resolving this. **Step-0: scope account provisioning IN,
   or use a platform stand-in + defer.** (Account provisioning is potentially large — guard against scope creep.)
5. **Ledger-write durability.** The write is fire-and-forget (`recordSettlementEntryAsync`, not awaited) →
   droppable on a serverless freeze (A1 debt #3, shared with `recordHop`). Consider Vercel `after()`.
6. **ap2 dedup gap** (A1 debt #1) — VDC with no `transactionId` → random fallback → no dedupe. Likely
   out of scope (inherent), but note it.

## 4. Step-0 — founder decisions REQUIRED before the build plan
Do NOT scope without these (mirror the circle-nano Step-0). Research each, then bring grounded
recommendations:
- **Take model + default rate** (flat bps? per-tool override? per-rail?) and how it reconciles with
  `revenueSharePct`. Default 0 (config-flip go-live) — confirm.
- **Where the take accrues** (a platform account → needs the accounts model? or a ledger marker that
  defers provisioning?). This is the scope fork.
- **Account provisioning: in-scope or stand-in + defer?** (size/risk vs the take requirement).
- **Over-collection policy** (enforce-exact / refund / accept).
- **Which sub-items (1–6) are IN this chunk vs deferred** — keep it tight; this is live money.

## 5. Key files (anchors to read at build time — verify line numbers, they drift)
- Settle paths (the `takeBps:0` sites + where a take would compute): `x402/orchestrate.ts`,
  `circle-nano/settle.ts`, `app/api/ap2/settle/route.ts`.
- The unified writer: `apps/web/src/lib/settlement/ledger.ts` (`recordSettlementEntry`,
  `settlementEntryId`, `markSettlementSettled`, `postLedgerEntry` for balance moves). **The take must
  be RECORDED here without breaking the sealed exactly-once writer.**
- Credit path: `apps/web/src/lib/settlement/reconcile.ts` (`creditSettlement` — credits
  `developers.balanceCents` + `tools.totalRevenueCents`; a take would reduce the dev credit or add a
  platform entry — decide cleanly).
- Verify (over-collection): `circle-nano/verify.ts`; x402 exact in `x402/orchestrate.ts`.
- Schema: `apps/web/src/lib/db/schema.ts` (`ledger_entries` take_bps/take_cents + check constraint;
  `developers.revenueSharePct/balanceCents`; the unprovisioned `accounts` table).
- Payout source of truth (do NOT regress): `apps/web/src/lib/payouts/process.ts` draws on
  `developers.balanceCents`. A take must not silently change what devs are owed without intent.

## 6. ⛔ HARD GATE — deep, independent PRE-BUILD AUDIT of the build plan (MANDATORY, before ANY code)
After you write the build plan (and BEFORE writing implementation code), run a **deep, independent
pre-build audit via a dynamic workflow / agent fan-out**. It must confirm the plan is **comprehensive,
high-quality, to-spec, that every technical & factual assumption checks out against the ACTUAL code,
and is as error-free as possible** — and it must reach **PLAN_READY (0 blocking) with ALL fixes applied
before implementation begins.** This is the founder requirement; it is not optional.

**Mechanism (proven last chunk — adapt `.audit/circle-nano-prebuild/`):** a `Workflow` script with
fresh-context lenses → adversarial verify → guarded synthesis:
- **Lenses (parallel, each re-derives against ACTUAL source, NOT trusting the plan):**
  `factual-assumptions` (every file:line claim + the §3 assumptions hold), `completeness` (no under-scoped
  money gap; the plan enumerates the test edits its own changes force → a literal follow yields a GREEN
  suite), `correctness-invariant` (the exactly-once credit invariant + the new take math are sound; no
  double-count, no payer over-charge, no dev under-credit), and **`scope-regression`** (see the guard below).
- **Adversarial verify:** each finding is independently refuted by ≥1 fresh agent (default to "refuted"
  unless a concrete code trace proves it real) so plausible-but-wrong findings don't survive.
- **Synthesis → verdict** `PLAN_READY` / `PLAN_NEEDS_FIXES` with blocking + improvements. Apply ALL
  blocking fixes, re-run a FRESH audit (agents re-read the revised plan), repeat until **PLAN_READY**.
- Skeleton: copy `.audit/circle-nano-postbuild/seal-panel.mjs` structure (pipeline → parallel verify →
  synthesis, with a JSON `schema` per agent). Use full-reasoning agents (NOT the search-only `Explore`
  agent) for review + verify.

### 6a. ⚠️ Over-auditing regression guard (safeguard the spine)
A pre-build audit tends to **balloon scope** ("also fix X, also harden Y"). The **`scope-regression`
lens is the spine guard**: it must confirm the plan stays **additive/surgical** and FLAG any finding that
**adds scope, new money movement, or churn** beyond the founder's Step-0 decisions. Encode an explicit
**SCOPE GUARD** section in the build plan (mirror the circle-nano build-plan §8): list what is byte-stable
/ out-of-scope (e.g. the sealed exactly-once writer core, `markSettlementSettled`, the payout pipeline, the
x402/circle-nano SEAL commits). The audit's job is to make the **planned** chunk correct — **NOT** to expand
it. Treat an audit finding that grows scope as a finding to REJECT-with-rationale, not auto-apply. (Last
chunk, every "blocking" item was a completeness/enumeration nit, never a scope expansion — that's the bar.)

## 7. Post-build audit (MANDATORY before seal) — funds-safety panel
After implementation + green gates, run a **post-build funds-safety SEAL panel** (adapt
`.audit/circle-nano-postbuild/seal-panel.mjs`): fresh-context lenses adversarially try to find a path where
the take double-counts, a payer is over-charged, a dev is under-credited, the exactly-once invariant breaks,
a byte-stable core was altered, or the payout source-of-truth diverges. Verdict SEAL (0 blocking) before
any commit. The green suite is NOT sufficient — it masked 2 blockers + a fix-now in the A1 chunk and every
hole in the x402 chunk; **independent audit is mandatory** (see `feedback-ke2-independent-audit-mandatory`).

## 8. Standing rules / guardrails (real money)
- **Single-writer core + READ-ONLY parallel verification.** Fan-out is for AUDIT (read-only) only; the
  implementation is single-writer. Do not parallelize code edits to the money path.
- **Ground every conclusion in ACTUAL tool output** — the green suite repeatedly masked funds holes; the
  pre-build audit + the post-build panel are the real gates.
- **A1/A2 traps (do not repeat):** the shared writer's `onConflictDoNothing` is FIRST-WRITE-WINS (flip via
  explicit `UPDATE` on `operation_id` + `rail`, never re-insert); dedup on `(from,nonce)` never signature
  bytes; an ap2 `settled` row MUST carry `settledAt` (validator throws otherwise).
- **Byte-stable (do NOT rewrite):** the sealed exactly-once credit machinery (`markSettlementSettled`,
  `creditSettlement`, the orchestrators' flip/return shape), the payout pipeline, the on-chain engines/
  verifiers, the x402 + circle-nano SEAL commits. A take is ADDITIVE recording, not a rewrite of the spine.
- **Prod / push are FOUNDER-GATED.** Do NOT push, do NOT set/change prod env. Commit LOCAL-ONLY,
  path-scoped (quote bracketed dirs, e.g. `"apps/web/src/app/api/proxy/[slug]/route.ts"`).
  `git user.name` is unset → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`
  trailer: `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.
- **Flag context degradation** the moment it risks implementation quality (founder standing order).

## 9. Verification commands (gates)
`cd /Users/lex/settlegrid/apps/web` then: `npx tsc --noEmit` (0) · `npx vitest run` (baseline 4218 pass /
1 pre-existing `processDataDeletion`) · `npx eslint <changed files>` (0) · `npx next build` (0). No
`packages/mcp` change expected. If any take math touches the DB, prove it with the **real** ledger
validator (a route test that mocks the writer is insufficient — A1's lesson).

## 10. Sequencing (the founder-required order)
Step-0 founder check (§4) → trace + finalize scope → write the BUILD PLAN (with §6a SCOPE GUARD) →
**PRE-BUILD AUDIT until PLAN_READY, all fixes applied (§6)** → implement surgically (single-writer) →
post-build verify (tsc/vitest/eslint/next build) → **post-build funds-safety SEAL panel (§7)** →
founder-gated local commit → founder-gated push + (if monetization is being turned on) the take-rate config.

## 11. Out of scope (note, do not fix here unless Step-0 pulls it in)
P5 kernel-dispatch expansion (the runner-up — `docs/phase-reports/P5-kernel-dispatch-expansion-deferred.md`);
Task C facilitator gas-budget circuit-breaker + the B1.4 non-Base reconciler gap (gated on the OFF public
facilitator); the CRON_SECRET rotation (ops hygiene — it leaked in a failed command during the x402 go-live).
