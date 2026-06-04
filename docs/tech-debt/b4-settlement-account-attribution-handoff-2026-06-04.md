# SettleGrid — NEXT CHUNK handoff: B4 settlement-row account attribution (Step-0 may reshape) (2026-06-04)

> **Self-contained handoff for a fresh agent. Read this end-to-end before doing anything.**
> This touches the **settlement ledger + a LIVE money-credit path** (the reconciler credits
> `developers.balanceCents` from settlement-row `account_id` — x402 + circle-nano settle real
> USDC on Base) → suggest `/effort max`. The HARD gate is the **deep, independent PRE-BUILD
> AUDIT of your build plan** (§6) — **no implementation code until it returns PLAN_READY with
> ALL fixes applied.**
> **⚠️ Read §3 (Step-0) first-thing: the nominal target ("provision accounts + backfill") has a
> verified FUNDS TRAP (§3, ground truth #4) that may flip the right design entirely. Do NOT
> assume the A1 register's "backfill when provisioning lands" framing is the right shape.**

## 0. Read order
1. **This doc, end-to-end.**
2. `docs/tech-debt/a1-facilitator-ledger-writes-2026-05-30.md` — where the `accountId =
   developerId` stand-in was decided (Decision 1) + the A2 traps + the 2026-06-04 UPDATE
   sections (B4 queued; the latent recordHop finding). **The single most important grounding.**
3. `docs/tech-debt/settlement-money-mechanics-seal-2026-06-04.md` — the take-model truth
   (`take_bps=0` CORRECT; take realized progressively at PAYOUT) + what is sealed.
4. `docs/tech-debt/acp-step0-decision-and-claims-correction-2026-06-04.md` — the prior chunk
   (Step-0 record; B2-moot finding; the certification-panel pattern this repo now uses).
5. `docs/tech-debt/settlement-money-mechanics-build-plan-2026-06-03.md` — the **build-plan +
   SCOPE-GUARD shape to reuse** (§4 of that doc is the template).
6. `.audit/` (LOCAL, untracked — now gitignored by `119d1f8a`, still on disk) —
   `money-mechanics-prebuild/prebuild-audit.mjs` (the PLAN_READY pre-build workflow base),
   `money-mechanics-postbuild/seal-panel.mjs` (the SEAL base), `acp-certification/` (the
   4-lens+critic+refuter certification output, the most recent panel run). Adapt these (§6/§7).
7. `docs/tech-debt/x402-onchain-settlement-2026-05-31.md` + `circle-nano` A2 docs if the chosen
   scope touches the reconciler (it reads on-chain rails' pending rows).

## 1. Ground state + pre-flight (verify before touching anything)
- Repo `/Users/lex/settlegrid`. Branch `main`. **`origin/main` = `93767508`** (money-mechanics,
  pushed + live). **Local-only stack on top (push FOUNDER-GATED, do not push):**
  `9a9f866d` (ACP handoff doc) → `df9a2477` (ACP claims chunk, CERTIFIED) → `2e4da629`
  (certification verdict) → `119d1f8a` (gitignore /.audit/) → **this handoff's commit = HEAD**.
  Confirm: `git -C /Users/lex/settlegrid status --short && git log -6 --oneline`.
- **LIVE prod (do NOT regress):** x402 proxy + circle-nano kernel `/settle` settle USDC to
  `0xdcefe0094755ae37395198488f057daa6e430724`; ap2 LIVE as verification facilitator;
  enforce-exact circle-nano + durable ap2 ledger write LIVE. Prod runs `origin/main` —
  the local stack is NOT deployed.
- **Base green expected (run BOTH suites first):**
  - `cd apps/web` → `npx tsc --noEmit` (0) · `npx vitest run` (**4220 pass / 1 KNOWN
    pre-existing fail** `processDataDeletion` in `settlement-moat.test.ts`) ·
    `npx next build` (0).
  - `cd packages/mcp` → `npx vitest run` (**1896 pass / 1 skip**). B4 likely touches only
    apps/web, but run both anyway (cheap) — the canonical `recordLedgerEntry` validator lives
    in `packages/mcp/src/ledger.ts`; if you edit the SDK, REBUILD it after.
- npm (NOT pnpm). viem apps/web-only. `route.ts` exports only HTTP verbs + Next config.
- Migrations live in `apps/web/drizzle/` (last: `0013_developer_api_keys.sql`). **Founder
  applies migrations to prod — NEVER run a migration against prod yourself.** Backfills are
  founder-run runbooks (precedent: the circle-nano uncredited-/settle backfill runbook,
  commits `130b5f8a`/`71a9ad94`).

## 2. The chunk — goal
Resolve the **`accountId = developerId` stand-in** on settlement ledger rows (carried since A1,
2026-05-30) the RIGHT way: either make the double-entry `accounts` system real (provision +
backfill) or formalize the developer-id semantic as the permanent, documented design — decided
by Step-0 ground truth + founder pick, then executed with the full 3-part audit chain
(pre-build audit → implement → post-build SEAL).

## 3. ⚠️ Step-0 — the attribution decision (REQUIRED before you scope anything)
**GROUND TRUTH (verified 2026-06-04 at `119d1f8a` — re-verify, lines drift):**
1. **`accounts` (schema.ts:823-843)** — full double-entry account table (`type` ∈
   provider/customer/platform/escrow, `entityId`, `balanceCents`, optimistic `version`) with
   **ZERO provisioning anywhere** (no `insert(accounts)` in app/scripts/SQL/packages — the
   whole double-entry half is dormant architecture).
2. **`ledger_entries.account_id` (schema.ts:849)** — `uuid NOT NULL`, **NO FK** (deliberate).
   Settlement rows (A1) store **`tool.developerId`** there. The double-entry machinery that
   would consume real account ids (`postLedgerEntry` :63, `postLedgerEntryAsync` :208,
   `computeBalanceFromLedger` :223, `reconcileAccount` :240) has **zero prod callers**
   (verified in the ACP chunk — B2-moot finding).
3. **The LIVE payout source of truth** is `developers.balanceCents` (+
   `tools.totalRevenueCents`), credited by `creditSettlement` (reconcile.ts:195) — gross at
   settle, take realized progressively at payout (`lib/pricing.ts`). SETTLED — do not re-open.
4. **⚠️ THE TRAP (this is why Step-0 exists):** the settlement reconciler **credits real money
   from `account_id`**: `reconcile.ts:129` passes `developerId: row.accountId` into
   `creditSettlement`, which `UPDATE developers ... WHERE id = <that value>`. So settlement-row
   `account_id` is **load-bearing in a LIVE credit path for on-chain rails**. A naive backfill
   (`account_id`: developerId → `accounts.id`) makes the reconciler credit a NONEXISTENT
   developer id → the UPDATE matches zero rows → **silently un-credits genuinely collected
   USDC** (and `creditSettlement` only logs; it does not throw). Any (A)-shaped design MUST
   handle this atomically (see A-variants below).
5. The kernel `/settle` in-request path passes `accountId: toolRow.developerId` directly
   (circle-nano settle route :178; ap2 route ledger write) — writers and reconciler share the
   developer-id semantic today, consistently.

**So research + bring the founder a grounded recommendation (mirror the prior Step-0s):**
- **(A) Provision + backfill (the nominal B4):** build an `accounts` provisioning path
  (provider accounts keyed `entityId = developerId`; created at signup + lazy-on-first-settle +
  a backfill script for existing developers), then re-point settlement-row attribution at real
  `accounts.id`. **MUST be trap-safe — viable shapes:** (i) add a NEW nullable
  `provider_account_id` column for the accounts linkage and **leave `account_id` =
  developerId** (zero behavior change to the reconciler/credit path; purely additive); or
  (ii) repurpose `account_id` with an ATOMIC same-deploy change to reconciler + writers +
  backfill + dual-read window (high blast radius on live money — needs its own failure-mode
  matrix in the plan). **Cost/caveat:** populating dormant double-entry architecture creates a
  SECOND money-state surface (accounts.balanceCents vs developers.balanceCents) that can
  diverge — divergence between two balance systems is the classic funds-bug factory; the plan
  must define which is authoritative (today: developers.balanceCents, full stop) and keep
  accounts non-authoritative/inert until a real consumer exists.
- **(B) Formalize the stand-in (cheaper, funds-safe):** make "settlement-row `account_id` IS
  the developer id" the PERMANENT documented semantic — schema comment + `RailSettlementRow`
  docstring + A1-register resolution + a **guard test** pinning `reconcile.ts`'s
  `developerId: row.accountId` contract + (optional) a DB CHECK or naming note. Defer
  double-entry provisioning until a real requirement lands (consumer balances, platform-take
  ledgering, audit-grade books). Zero money-path change; kills the recurring
  "backfill later" debt by making the semantic intentional.
- **(C) Pivot** (grounded alternates, in current priority): ACP-dark wiring **only if** the
  founder says OpenAI/Stripe BD is in motion (then FIRST satisfy the post-sunset
  pre-condition: re-verify the SPT checkout-session flow is still the operative ACP payment
  spec — see the P5 doc's ACP ROADMAP DECISION section); the hop-route schema extension
  (wire `rail`/`protocol`/`accountId` through `api/sessions/[id]/hop` so the multi-hop ledger
  trail actually fires — small, offline-testable); UCP verify-semantics research (research-only).
- **The founder picks. Do NOT scope or plan before Step-0 is resolved.** Bring the trade-offs
  WITH the trap explained. (Prior-session lean, for context not pre-emption: **(B)** unless the
  founder wants audit-grade double-entry books on the roadmap now — in which case **(A)(i)**,
  the additive-column shape, is the funds-safe variant.)

## 4. IF (A) is chosen — scope sketch (verify everything, this is a sketch not a plan)
1. Migration `0014`: any new column (A-i) — additive, nullable, no default-rewrite of live rows.
2. Provisioning: `ensureProviderAccount(developerId)` (idempotent, keyed on
   `(type='provider', entityId)` — needs a UNIQUE index, which dormant `accounts` lacks today;
   that's part of the migration) + call sites (developer signup; lazy at settle-write).
3. Backfill: **founder-run runbook** (SQL, batched, resumable) for existing developers + rows.
4. Writers: ap2 route / circle-nano settle / x402 orchestrate / recordHop — attach the linkage
   (A-i: populate `provider_account_id` alongside untouched `account_id`).
5. Reconciler: UNCHANGED under (A-i) — that is the point. Under (A-ii): atomic re-point +
   dual-read + alert-on-miss; treat as its own audited mini-spine.
6. Tests: provisioning idempotency (concurrent-create race), writer linkage, reconciler
   credit-path REGRESSION (prove a pending row still credits the right developer — with the
   REAL `creditSettlement` against a seeded dev, not a mock — the A1 lesson), backfill
   dry-run validator.
## IF (B) is chosen — scope sketch
1. Schema comment on `ledger_entries.accountId` + `RailSettlementRow.accountId` docstring
   (ledger.ts:359-362) stating the permanent developer-id semantic for settlement rows.
2. Guard test pinning `reconcile.ts` `developerId: row.accountId` + the writers' developerId
   sourcing (so a future "helpful" backfill breaks CI, not prod).
3. A1-register + P5-doc resolution notes; close the debt as resolved-by-design.
4. (Optional, founder call) rename-by-alias deferred — no migration in (B).

## 5. Key files (the surface — verify line numbers, they DRIFT)
- Spine writer: `apps/web/src/lib/settlement/ledger.ts` — `recordSettlementEntry` (:404,
  byte-stable internals), `RailSettlementRow.accountId` (:359-362), dormant double-entry
  (`postLedgerEntry` :63, `computeBalanceFromLedger` :223, `reconcileAccount` :240).
- **The credit path (THE TRAP):** `apps/web/src/lib/settlement/reconcile.ts` —
  `reconcilePendingSettlements` (:264, selects `accountId` at :279), `creditSettlement`
  (:195, credits `developers.balanceCents` :214-225), the `developerId: row.accountId` feed (:129).
- Writers passing accountId: `apps/web/src/app/api/ap2/settle/route.ts` (after()-wrapped write),
  `apps/web/src/app/api/circle-nano/settle/route.ts` (:178 `accountId: toolRow.developerId`),
  `apps/web/src/lib/settlement/x402/orchestrate.ts` (:136), `apps/web/src/lib/settlement/sessions.ts`
  (:469 — unreachable from prod; see the A1 register's 2026-06-04 UPDATE).
- Schema: `apps/web/src/lib/db/schema.ts` — `accounts` (:823), `ledgerEntries.accountId` (:849).
- Migrations: `apps/web/drizzle/` (last `0013`).
- Canonical row validator: `packages/mcp/src/ledger.ts` (`recordLedgerEntry`) — settled rows
  REQUIRE `settledAt` (throws otherwise).

## 6. ⛔ HARD GATE — deep, independent PRE-BUILD AUDIT of the build plan (MANDATORY, before ANY code)
After Step-0 + writing the build plan (and BEFORE any implementation code), run a **deep,
independent pre-build audit via a dynamic Workflow / agent fan-out**. It MUST confirm the plan
is **comprehensive, high-quality, to-spec, every technical & factual assumption verified
against the ACTUAL code, and as error-free as possible** — and it MUST reach **PLAN_READY
(0 blocking) with ALL fixes applied before implementation begins.** Founder requirement; not
optional.

**Mechanism (proven 3 chunks running — adapt `.audit/money-mechanics-prebuild/prebuild-audit.mjs`;
the freshest panel shape incl. structured schemas + critic is `.audit/acp-certification/`):**
- **Lenses (parallel, fresh-context, each RE-DERIVES against ACTUAL source, NOT trusting the
  plan):** `factual-assumptions` (every file:line claim + §3 ground truths — ESPECIALLY the
  reconciler trap and the zero-provisioning claim — re-verified live), `completeness` (the plan
  enumerates every forced test edit; a literal follow yields GREEN suites in BOTH apps/web and
  packages/mcp; migration + backfill runbook steps complete and founder-gated),
  `correctness-invariant` (exactly-once credit preserved; the reconciler NEVER mis-credits or
  zero-credits under the new shape; no second authoritative balance surface; take model
  untouched; settled rows carry settledAt), and **`scope-regression`** (§6a).
- **Adversarial verify:** every finding independently refuted by ≥1 fresh agent (default
  "refuted" unless a concrete code trace proves it real) so plausible-but-wrong findings die.
- **Synthesis → verdict** `PLAN_READY` / `PLAN_NEEDS_FIXES` (+ blocking list). **Apply ALL
  blocking fixes, re-run a FRESH audit (agents re-read the revised plan), repeat until
  PLAN_READY.** Use **full-reasoning agents** (NOT the search-only Explore type).
- *(Ops notes: a server rate-limit can kill a workflow's subagents mid-run — resume with
  `Workflow({scriptPath, resumeFromRunId})`, completed agents return from cache. Schema-forced
  agents occasionally skip StructuredOutput when rate-limited; just resume.)*

### 6a. ⚠️ Over-auditing regression guard (safeguard the spine)
Pre-build audits balloon scope ("also harden X, also fix Y"). The **`scope-regression` lens is
the spine guard**: it must confirm the plan stays **surgical** and FLAG any finding that adds
scope, new money movement, a second authoritative balance store, or churn beyond the founder's
Step-0 decision. Encode an explicit **SCOPE GUARD** section in the build plan (mirror
`settlement-money-mechanics-build-plan-2026-06-03.md` §4): list byte-stable / out-of-scope
(§8 below). **Treat any audit finding that grows scope as REJECT-with-rationale, not
auto-apply** (the ACP certification panel's refuter did exactly this — `severityFinal:
'rejected-scope-expansion'` — copy that mechanism). The audit's job is to make the PLANNED
chunk correct, not to expand it. Zero findings is a valid outcome; do not hallucinate problems.

## 7. Post-build SEAL panel (MANDATORY before seal — this IS a funds chunk)
After implementation + green gates, run a **post-build funds-safety SEAL panel** (adapt
`.audit/money-mechanics-postbuild/seal-panel.mjs`): fresh-context adversarial lenses try to
find a path where the reconciler mis-credits/zero-credits (wrong id, race during backfill,
pre-backfill row vs post-backfill code), exactly-once breaks, a second balance surface becomes
authoritative or diverges, a byte-stable core changed, the take model is touched, a migration
mutates live rows non-additively, or the demo sandbox reaches a real settle. Verdict **SEAL
(0 blocking)** before any commit. **A green suite is NOT sufficient** — it masked 2 blockers in
A1 and every hole in the x402 chunk; independent audit is mandatory.

## 8. BYTE-STABLE (do NOT rewrite) + settled questions (do NOT re-litigate)
- The sealed exactly-once credit machinery: `recordSettlementEntry` internals +
  `settlementEntryId` + `onConflictDoNothing` (FIRST-WRITE-WINS — flips happen via explicit
  `UPDATE` on `operation_id` + `rail`, never re-insert), `markSettlementSettled`/`Failed`/
  `Broadcast`, `creditSettlement`'s credit-iff-you-flipped contract, the orchestrators
  (`x402/orchestrate.ts`, `circle-nano/settle.ts` flip/return shape).
- The payout pipeline (`payouts/process.ts`) + progressive take (`lib/pricing.ts`) — **the take
  model is SETTLED: `take_bps=0` on settlement rows is CORRECT** (take realized at payout; dev
  credited GROSS). Do NOT compute a per-row take.
- The on-chain engines/verifiers (`circle-nano/settle-engine.ts`, x402 settle, the offline
  EIP-3009 verifier) + dedup on `(from,nonce)` never signature bytes.
- The x402 / circle-nano / money-mechanics SEAL commits; the ACP claims chunk (`df9a2477`,
  CERTIFIED — its public copy is fact-locked, do not re-edit).
- `developers.balanceCents` remains the payout source of truth unless the founder EXPLICITLY
  re-decides — no chunk output may make `accounts` authoritative as a side effect.

## 9. Verification gates
`cd /Users/lex/settlegrid/apps/web`: `npx tsc --noEmit` (0) · `npx vitest run` (≥4220 pass +
new; 1 known pre-existing fail) · `npx eslint <changed files>` (0) · `npx next build` (0;
do NOT run concurrently with tsc — they race on `.next/types`). **PLUS** `cd packages/mcp &&
npx vitest run` (1896/1 skip baseline; rebuild the SDK if edited). **DB-affecting behavior must
be proven with the REAL validators/functions** (real `recordLedgerEntry` shape-validation; the
reconciler credit regression against the real `creditSettlement` — a mocked writer is
insufficient, A1's lesson). Migrations: generate + lint locally; **applying to prod is
FOUNDER-GATED**; backfills ship as a **founder-run runbook doc**, never auto-executed.

## 10. Sequencing (the founder-required order)
Pre-flight (§1) → **Step-0 attribution decision (§3, founder picks)** → trace + finalize scope →
write the BUILD PLAN (with the §6a SCOPE GUARD section) → **PRE-BUILD AUDIT until PLAN_READY,
all fixes applied (§6)** → implement surgically (single-writer) → post-build verify (§9) →
**post-build SEAL panel (§7)** → founder-gated local commit (path-scoped) → capstone/debt-register
docs → memory pointer → (push + migration apply + backfill remain FOUNDER-GATED).

## 11. Standing rules / guardrails (real money)
- **Single-writer core + READ-ONLY parallel verification.** Fan-out is for AUDIT only.
- **Ground every conclusion in ACTUAL tool output** — re-verify every file:line in this doc.
- Commit LOCAL-ONLY, **path-scoped** (`git commit -- <paths>`; quote bracketed dirs like
  `"apps/web/src/app/api/sessions/[id]/hop/route.ts"`). `git user.name` is unset → commit with
  `git -c user.name="Luther Whiting-Collins" -c user.email="lexwhiting@gmail.com" commit …`,
  trailer `Co-Authored-By: Claude <your exact model> <noreply@anthropic.com>`.
- **Shared-worktree hazard:** parallel sessions share tree + index — atomic path-scoped commits only.
- Do NOT push; do NOT set/change prod env; do NOT apply migrations to prod; demo sandbox must
  never reach a real settle.
- **Flag context degradation** the moment it risks implementation quality (founder standing order).

## 12. Out of scope (note, do not fix here unless Step-0 pulls it in)
ACP-dark wiring (BD-gated; has its own pre-condition — see the P5 doc ACP section); the
hop-route schema extension (unless picked as (C)); UCP research; Tier-2/3 rails; ap2
no-transactionId dedup (inherent); repo-wide rate-limit hardening (publisher-keys DEBT #1);
`processDataDeletion` flaky pre-existing fail; the take model and the ACP public copy (both
SETTLED/CERTIFIED). The P5 master doc + A1 register are the debt registers to UPDATE at close,
not rewrite.
