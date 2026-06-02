# circle-nano funds-safety chunk — SEALED (2026-06-02)

> Capstone record for the circle-nano funds-safety parity chunk. Builds on the
> trace (`circle-nano-funds-safety-trace-2026-06-01.md`) + the build plan
> (`circle-nano-funds-safety-build-plan-2026-06-01.md`, pre-build audit PLAN_READY).
> circle-nano is LIVE on Base mainnet — this was real money.

## What shipped (two phases, mirror the sealed x402 design)

- **Phase 1 — dark-gate** (Commit 1, `f957fa33`): PAID circle-nano on the direct proxy →
  503 `CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE` (stop the live phantom credit; nonce left unspent).
- **Phase 2 — settle-in-path parity** (Commit 2): both circle-nano surfaces now collect-AND-credit.
  - **Part A** — new `handleCircleNanoProxy` settles on-chain in-path (confirm-before-deliver) before
    `forwardAndBill`; dark-gate (`isCircleNanoKernelEnabled` → 503), F2 network-pin, replay → `skipCredit`.
    Old credit-without-settle branch removed from `handleProtocolProxy`; both dispatch sites rerouted.
  - **Part B** — `executeCircleNanoSettlement`: `+toolId` param, `+alreadySettled?` on the idempotent-hit
    & concurrent-loser returns (NOT the fresh flip), `toolId` in pending JSONB metadata.
  - **Part C** — kernel `/settle` credits on the fresh flip via `creditSettlement` (keyed by the STABLE
    `circleNanoOperationId`); F2 pin; passes `toolId`.
  - **Part C2** — `creditReconciledX402Settlement` → exported rail-agnostic `creditSettlement`; reconciler
    credit gate widened to `x402 || circle-nano`; alert keys `reconcile.x402_*` → `settlement.*`.
  - **Part D** — F2 pin reuses x402's prod-hard-pin (`X402_MAINNET_NETWORK` + `isX402TestnetSettlementAllowed`)
    on both surfaces; no new env, no migration.

## The exactly-once invariant (holds in the built code)

One credit per authorization, iff THIS actor flips the row `pending→settled` (the single guarded
`markSettlementSettled WHERE settlement_status='pending'`). Three credit-sites each gate on their own flip:
proxy `forwardAndBill` (`skipCredit` when `alreadySettled`), kernel `/settle` (`alreadySettled !== true`),
reconciler (`flipped === true`). An idempotent-hit / concurrent-loser returns `alreadySettled` → never re-credits.

## Gates (ground-truth, tree at build)

`tsc --noEmit` **0** · full `vitest` **4218 pass / 1 pre-existing fail** (`processDataDeletion`, unrelated) ·
`eslint` (8 changed files) **0** · `next build` **0**. No `packages/mcp` change; no schema migration.

## Pre-build audit (HARD gate, 3 rounds) → PLAN_READY

R1 (wf_5f5c3c00-8e5) NEEDS_FIXES → R2 (wf_bee56c2b-09b) NEEDS_FIXES → **R3 (wf_6e1c3724-4c9) PLAN_READY**.
All fixes applied to the plan. Verdicts: `.audit/circle-nano-prebuild/round{1,2,3}-verdict.json`.

## Post-build funds-safety SEAL panel → ✅ SEAL (0 blocking)

`wf_a4223770-c6a` (6 agents, 5 lenses → adversarial verify → synthesis). Zero confirmed funds-breaking
findings across all 6 vectors (phantom-credit / uncredited-revenue / double-credit / Sepolia-on-prod /
byte-stable-core / dispatch+reconcile regression), each refuted with file:line. Full output:
`.audit/circle-nano-postbuild/seal-verdict.json`.

- **INFO (pre-existing, benign, NOT this chunk):** a paid tool with an *unparseable* proof on kernel
  `/settle` falls through to the free settled-no-credit branch (honest no-credit, not a phantom credit).

## Founder-gated follow-ups (NOT code; surfaced at seal)

1. **Confirm prod env before push:** `vercel env ls production | grep CIRCLE_NANO` (proxy LIVE per the B1.1 doc).
2. **Historical backfill:** the ~1–2 day A2 live window of kernel `/settle` rows that collected USDC but never
   credited the dev are terminal `settled` rows — the reconciler-widen selects only `pending`, so it does NOT
   auto-backfill them. One-time operator credit (sum settled circle-nano ledger rows per dev → credit
   `balanceCents`), founder-decided. Read-only diagnostic SQL + backfill script to be handed over for sign-off.
3. **Carried (adjacent, not this chunk):** move `SETTLEGRID_USDC_RECIPIENT` off the hot gas wallet (B1.1).
