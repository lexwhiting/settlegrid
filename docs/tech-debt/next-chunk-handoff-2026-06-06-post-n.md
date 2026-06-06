# Next-chunk handoff — post-(N) `auth.id` keying — 2026-06-06 (Step-0-gated)

> **(N) is DONE and CERTIFIED** (`n-authid-keying-resolution-2026-06-06.md`); **DEBT #1 is now FULLY
> CLOSED** (a=H1, b=M, c=N). This handoff scopes the *next* chunk. **Step-0 is founder-gated: the founder
> picks the chunk before any scoping or code.** Every candidate line below was re-verified against the
> tree on 2026-06-06 — but re-verify again at pickup; they drift.

## 1. Ground state
- HEAD after (N)'s local commit (NOT pushed). Working tree clean post-commit. Baselines at that point:
  apps/web tsc 0 / vitest **4256** / next build 0 / eslint 0; packages/mcp **1896/1**.
- LIVE prod (do NOT regress): x402 proxy + circle-nano settle USDC on Base mainnet; ap2 LIVE as a
  verification facilitator. No push / prod-env / migration without the founder.

## 2. Candidate menu (carried from `next-chunk-handoff-2026-06-05-post-m.md` §2, minus the now-done (N);
the (N)-opened follow-ups F1/F2/F3 added)

### LEAD candidate — **(K) HMAC-pepper the API-key hash (DEBT #3, LOW-arch).**
`apps/web/src/lib/crypto.ts:37 hashApiKey` is a bare unsalted `createHash('sha256').update(key).digest('hex')`
shared across `sg_live_` (consumer) + `sg_pub_` (publisher) keys — verified this date. Real defense-in-depth
**iff the DB is ever disclosed**; **not exploitable today** (256-bit keyspace). Cost/risk: touches the auth
path for **all** keys → needs a pepper env var + a dual-read/migration for existing hashes; a bug here locks
out every API key (access/funds disruption), so it is a careful, HIGHER-risk dedicated chunk. Strong #1 if
the founder wants a security-pure pass. **Post-build = funds-adjacent panel** (auth path, not the settle
spine).

### ALTERNATIVES (grounded; bring the trade-offs)
- **(C) `revenueSharePct` legacy cleanup (hygiene).** Inert column: `metering.ts:298` is labelled
  "Legacy — ignored. Progressive take rate calculated at payout time." MED churn (~20 files + a migration +
  test rewrite). LOW-but-real hazard: `sdk/meter/route.ts:75` computes `effectiveRevenueSharePct` and
  `:283` writes it — any cleanup must re-derive the take from `tier`/`pricing.ts` FIRST and prove the
  free-tier overage gate is unaffected. Deliberate hygiene only; **funds-SEAL post-build** (touches the
  meter write path).
- **(A) ACP-dark kernel wiring — BD-GATED.** Pursue ONLY if the founder says OpenAI/Stripe merchant
  onboarding/BD is in motion. Hard pre-condition: web-research FIRST the operative ACP flow (the SDK's
  `validateAcpPayment` — present at `packages/mcp/src/index.ts` + `adapters/acp.ts` — models the Stripe SPT
  checkout-session retrieve whose in-chat flagship OpenAI sunset 2026-03-24; confirm facilitators still
  verify via that retrieve). Ships **dark** (`ACP_STRIPE_KEY` unset). Touches the SDK (rebuild + 1896-suite).
  **Post-build = funds-SEAL.** Canonical scope: `p5-tier1-acp-kernel-dispatch-handoff-2026-06-04.md §4`.
- **(H) hop-route schema extension — DEMAND-GATED + reconciler-starvation trap.** Only if multi-hop ledger
  attribution is now wanted (zero consumers verified). MANDATORY guard: constrain the hop `rail` enum to
  EXCLUDE `{x402, circle-nano}` or hop rows are re-SELECTed by the reconciler forever (starvation — see
  `reconcile.ts parseSettlementOperationId`). **Funds-SEAL post-build.**

### (N)-opened follow-ups (small, tracked in `publisher-api-keys-audit-2026-05-28.md`)
- **F1** — NAT-fairness IP-raise on session routes (new limiter export → ~84-test-file mock sweep + flood-
  posture loosening). Demand-gated: do if NAT throttling is observed.
- **F2** — `sdk/meter:108` tiered limit keys on client-supplied `body.consumerId` (not matched to the key
  before the call). Settlement surface → own trace + funds-aware chunk.
- **F3** — dead `requireApiKey` export (`auth.ts:155`, zero route callers). Trivial hygiene removal; verify
  no dynamic/string reference first.

*(Prior-session lean, for context not pre-emption: with DEBT #1 fully closed, **(K)** is the natural lead —
a self-contained security-hardening chunk needing no external signal; (C) is hygiene; (A)/(H) stay
externally gated; F3 is a near-zero-cost cleanup that could ride along with any chunk.)*

## 3. ⛔ The audit chain — founder hard gate (real money)
No implementation code ships until a deep, independent **pre-build audit** confirms the build plan is
comprehensive, to-spec, every technical/factual assumption verified against ACTUAL code — verdict
**PLAN_READY (0 blocking)** with ALL fixes applied — AND a mandatory independent **post-build gate** passes
(**0 blocking**) before any commit, followed by a **certification** pass. Mechanism: dynamic `Workflow`
fan-out — re-deriving lenses → adversarial verify (default-refuted) → guarded synthesis. Both gates carry
the **over-auditing / spine-safeguard (SCOPE GUARD)** clause: objective confidence not finding-count, zero
findings is valid, scope-growth findings are `rejected-scope-expansion`. Adapt the (N) scripts as templates:
`.audit/n-prebuild/prebuild-audit.mjs`, `.audit/n-postbuild/security-panel.mjs`, `.audit/n-certify/certify.mjs`.
**Degraded-run guard:** before trusting any verdict, confirm all lenses produced genuine output and no
verifier returned null (a dead lens silently yields zero findings). **Transient-death recovery:**
`Workflow({scriptPath, resumeFromRunId})` replays cached agents; note the account session-limit can kill the
final synthesizer (it did on (N)'s cert run) — either resume after the limit resets or synthesize inline
from the cached worker outputs (provenance-recorded).

## 4. File-path index
- **This handoff:** `docs/tech-debt/next-chunk-handoff-2026-06-06-post-n.md`
- **DEBT register:** `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md`
- **Prior capstones:** `n-authid-keying-resolution-2026-06-06.md`, `m-getclientip-migration-resolution-2026-06-05.md`,
  `h1-rate-limit-availability-resolution-2026-06-05.md`
- **Prior menu (fuller candidate analysis):** `next-chunk-handoff-2026-06-05-post-m.md` §2
