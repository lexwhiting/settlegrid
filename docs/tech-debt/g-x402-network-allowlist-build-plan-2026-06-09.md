# (G) x402 network-allowlist — BUILD PLAN (2026-06-10) — **status: PLAN_READY**
> Pre-build audit `wf_f96cd3d6-b39` (4 opus lenses + opus synthesizer, INCREMENTAL single-pass):
> **PLAN_READY, 0 blocking, 0 dead lenses, degraded=false**; 7 findings = 1 test-seeding
> improvement (folded into §3.7) + doc-precision rewordings (folded) + 1 refuted line-number
> "correction". Both deliberate deviations (INCREMENTAL tier; static canonical) independently
> re-derived and SUSTAINED. Verdict record: `.audit/g-prebuild/round1-verdict.txt`.

> Companion to `g-x402-network-allowlist-trace-2026-06-09.md` (the Phase-1 trace; all file:line
> claims re-derived there this session). Implements the founder-chosen REJECT path for the B1.4
> carried-debt item 2. **No code until the Phase-3 audit returns PLAN_READY, 0 blocking.**

## 1. Goal + honest framing + TIER

Make every x402 advertise/accept/settle surface derive from ONE canonical settleable+confirmable
network allowlist and reject non-members at the route boundary, so no surface can advertise,
accept, or attempt a network the platform cannot settle AND confirm.

**Honest framing (trace T3):** no funds can move and no settlement row can be created on
`eip155:1` today — every settle path already fails before any chain write (standalone: engine
`getWalletClient` throw; facilitator v1: gate; proxy: F2 pin + Base-only offline verifier +
fail-closed engine). The realized defects are: advertisement leak (A1), verify-accepts-the-
unsettleable (B1), accidental/unclean reject semantics at the money route (C1: HTTP 500
`SETTLEMENT_RPC_ERROR` after burning Ethereum RPC verify reads, as an engine implementation detail
rather than an enforced boundary invariant — HTTP body code `SETTLEMENT_FAILED`; the engine's internal
`errorCode` is `SETTLEMENT_RPC_ERROR` and is never surfaced [audit precision]), and no structural drift
protection (DC-07).

**TIER: INCREMENTAL** — re-classified per the handoff Phase-1 NB (the funds-safety trigger is
disproven; the mcp frozen spine is NOT edited per trace T5). Residual risk concentrates in
LB-2-too-broad (breaking legit Base mainnet / Base Sepolia settles on the LIVE money route) —
the audit keeps a funds-safety-aware lens + the mechanical guard probes for exactly this.

## 2. Resolved LB-1 / LB-2 (proofs in trace T2–T5)

- **LB-1 (completeness):** census = 6 routes + proxy + mcp + reconciler (trace T2 table; includes
  `/api/x402/verify`, ABSENT from the handoff's enumeration — found by route census). Surfaces to
  change: A1, B1, C1. Surfaces verified-already-guarded: A2/B2/C2 (facilitator v1), A3 (mcp 402
  gen, Base-mainnet-only), C3 (proxy ×3), C4, D1. mcp `USDC_ADDRESSES` copy: byte-stable (T5) —
  client-side structural pre-check; the authoritative boundary is server-side.
- **LB-2 (reject at the settle boundary, without breaking Base):** guard lands in C1's route
  handler BEFORE `verifyExactPayment` (and in B1 before the scheme branches). Canonical set is
  **static `{eip155:8453, eip155:84532}`** — identical to `SUPPORTED_CHAINS`, the settle engine's
  `getWalletClient` switch, and `USDC_EIP712_DOMAINS` — because "settleable+confirmable" is a
  static engine fact; the env-dependent F2 pin stays the separate, stricter gate on the
  credit-minting rails (UNTOUCHED). This keeps every legit current behavior byte-identical
  (C1/C2 already settle Sepolia in prod as a no-credit relay, deliberately) and removes ONLY
  `eip155:1` admission. **Deviation from the handoff's "prod mainnet-only" sketch is deliberate
  and argued in trace T4** (the handoff's own invariant `PUBLIC_FACILITATOR_NETWORKS ⊆ canonical`
  is unsatisfiable in prod under the sketch); flagged for audit scrutiny.

## 3. EXACT per-file recipes

### 3.1 NEW `apps/web/src/lib/settlement/x402/networks.ts`
```ts
/**
 * (G) Canonical settleable+confirmable x402 network allowlist — THE single
 * source of truth every x402 advertise/accept/settle surface filters/guards on.
 * Membership = networks BOTH settle engines can broadcast on (settle.ts
 * getWalletClient, circle-nano settle-engine SUPPORTED_CHAINS) AND the
 * reconciler can confirm (same SUPPORTED_CHAINS) — a static engine fact, NOT
 * env policy. The production mainnet-only rule for the credit-minting rails is
 * the SEPARATE, stricter F2 pin (env.ts X402_MAINNET_NETWORK) — do not merge.
 * No-drift invariant test: x402-networks.test.ts pins
 * PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL == keys(SUPPORTED_CHAINS) ⊆ keys(USDC_ADDRESSES).
 */
export const CANONICAL_X402_NETWORKS = ['eip155:8453', 'eip155:84532'] as const

export type CanonicalX402Network = (typeof CANONICAL_X402_NETWORKS)[number]

export function isCanonicalX402Network(network: string): network is CanonicalX402Network {
  return (CANONICAL_X402_NETWORKS as readonly string[]).includes(network)
}
```

### 3.2 `apps/web/src/lib/settlement/x402/index.ts` — add one barrel line
`export { CANONICAL_X402_NETWORKS, isCanonicalX402Network, type CanonicalX402Network } from './networks'`

### 3.3 `apps/web/src/app/api/x402/settle/route.ts` (C1) — guard before verify
After `parseBody` + the `x402.settle_request` log, BEFORE the upto-scheme check (mirrors the
facilitator settle's network-then-scheme ordering, `route.ts:77-102`; log placement differs
harmlessly — the standalone logs first, which gives observability of rejected networks
[audit precision]):
```ts
if (!isCanonicalX402Network(paymentPayload.network)) {
  return errorResponse(
    `Network not supported for settlement: ${paymentPayload.network}. ` +
      `Supported: ${CANONICAL_X402_NETWORKS.join(', ')}.`,
    400,
    'UNSUPPORTED_NETWORK'
  )
}
```
Import via the barrel (`@/lib/settlement/x402`). No other change to the route.

### 3.4 `apps/web/src/app/api/x402/verify/route.ts` (B1) — same guard
Same block, message `Network not supported: …`, placed after the `x402.verify_request` log,
before the scheme branches. (Returning 400 mirrors facilitator verify `route.ts:71-78`.)

### 3.5 `apps/web/src/app/api/x402/supported/route.ts` (A1) — filter the advertisement
```ts
networks: Object.entries(USDC_ADDRESSES)
  .filter(([network]) => isCanonicalX402Network(network))
  .map(([network, address]) => ({ … unchanged … })),
```

### 3.6 `apps/web/src/lib/settlement/circle-nano/settle-engine.ts` — export keyword ONLY
`const SUPPORTED_CHAINS` → `export const SUPPORTED_CHAINS` (line 37). Zero behavior change;
needed so the no-drift test reads the engine's real set instead of restating it (restating would
defeat drift detection — DC-07). This is the ONLY engine-file edit; reconciler math untouched.

### 3.7 Tests
**Modified — `apps/web/src/lib/__tests__/x402.test.ts`:**
- `:945` "returns network list with USDC addresses": `networks.length >= 3` → assert the network
  ids are EXACTLY `CANONICAL_X402_NETWORKS` (sorted-equal) and `not.toContain('eip155:1')`.
  (**fails pre-fix** — today's route returns 3 incl. `eip155:1`.)
- Existing `:115` `USDC_ADDRESSES['eip155:1']` stays (table kept).
- Note (DC-05): the file's `vi.mock('@/lib/settlement/x402', importOriginal)` spreads the actual
  module, so the new barrel exports flow through the mock factory untouched.

**New route tests (same file, in the existing verify/settle describes — they mock
verifyExactPayment/settleExactPayment, so the guard's short-circuit is directly observable):**
1. settle `eip155:1` → 400, code `UNSUPPORTED_NETWORK`, and `mockVerifyExact`/`mockSettleExact`
   NOT called (**fails pre-fix** — mechanics [audit precision]: with no seeded mock and no guard,
   `mockVerifyExact()` returns `undefined` → `route.ts:62` throws on `.isValid` → 500
   `INTERNAL_ERROR` before settle is reached; 500 ≠ 400, so the RED holds).
2. verify `eip155:1` → 400 `UNSUPPORTED_NETWORK`, `mockVerifyExact` not called
   (**fails pre-fix**: today the engine mock IS called).
3. Behavior-neutral pins: settle + verify with `eip155:8453` AND with `eip155:84532` still reach
   the mocked engine (no over-broad guard). (Existing tests cover 8453; add explicit 84532.)
   **MANDATORY mock seeding [audit fold]:** the settle describe's `beforeEach` only
   `vi.clearAllMocks()` — it seeds NO default returns. Each settle pass-through pin must seed
   BOTH `mockVerifyExact.mockResolvedValueOnce({ isValid: true, … })` AND
   `mockSettleExact.mockResolvedValueOnce({ success: true, … })` (copy the pattern at
   `x402.test.ts:1107-1113`); each verify pin must seed `mockVerifyExact.mockResolvedValueOnce(
   { isValid: true, … })`. An unseeded pin would 500 on `undefined.isValid` and fail post-fix
   for the wrong reason.

**New `apps/web/src/lib/settlement/x402/__tests__/x402-networks.test.ts` (no-drift invariant):**
```ts
// DC-07 guard: the four x402 network sets can never silently diverge again.
expect([...CANONICAL_X402_NETWORKS].sort()).toEqual(Object.keys(SUPPORTED_CHAINS).sort())
for (const n of PUBLIC_FACILITATOR_NETWORKS) expect(CANONICAL_X402_NETWORKS).toContain(n)
for (const n of CANONICAL_X402_NETWORKS) expect(Object.keys(USDC_ADDRESSES)).toContain(n)
expect(CANONICAL_X402_NETWORKS).not.toContain('eip155:1')
```
(Imports: networks.ts, settle-engine `SUPPORTED_CHAINS` (3.6), `_shared`
`PUBLIC_FACILITATOR_NETWORKS`, types `USDC_ADDRESSES`. The `getWalletClient` switch in settle.ts
is not exported/enumerable; it is pinned transitively by `== keys(SUPPORTED_CHAINS)` (both are the
static Base pair) plus the route-level behavior pins above — recorded as a conscious limit.)

## 4. Byte-stable spine (NOT touched)
Handoff §3 OUT-list in full, plus (trace-decided): `packages/mcp/**` (incl. its `USDC_ADDRESSES`)
· `packages/sdk-python*` · `types.ts` tables/`X402Network` type · `verify.ts`/`settle.ts`/
`orchestrate.ts`/`parse.ts` engine internals (incl. their error-message strings naming
`eip155:1` — unreachable via guarded routes post-fix) · `reconcile.ts` · `env.ts` (F2 pin) ·
`_shared.ts` · all facilitator v1 routes · proxy + circle-nano routes · no migration, no env, no
push, no publish. **SCOPE GUARD:** reject ADD-Ethereum-confirm, F2 loosening/generalizing,
B1.1/B1.4-starvation pull-in, gold-plating (e.g. refactoring PUBLIC_FACILITATOR_NETWORKS to
derive from canonical — invariant-pinned instead, founder-gated list stays founder-gated).

## 5. Machine gates (end-state)
- `apps/web`: tsc **0** · vitest **4313 + N_new** (N_new ≈ 5–7; the modified `:945` test still
  counts as 1) / **185+1 files** / 0 fail · `next build` **0** · eslint on changed files **0**.
- `packages/mcp`: **1898 / 1 skip, byte-stable** (no file touched). Python: `git diff --numstat`
  shows zero `packages/sdk-python*` lines.
- `git diff --numstat` confined to: `networks.ts` (new), `index.ts`, 3 x402 route files,
  `settle-engine.ts` (the `export` keyword line only), `x402.test.ts`,
  `x402-networks.test.ts` (new), the (G) docs + the (K)-rider docs (Phase 7).
- Fail-pre-fix proof: new tests 1+2 + modified `:945` run RED against HEAD before the fix lands
  (captured to `.audit/g-build/fail-pre-fix.txt`), GREEN after.

## 6. No migration
Route-layer guard + advertisement filter + tests only. No schema/row/env change. (G) creates no
new settlement-row source and removes none — D1's row sources are unchanged.

## 7. Phase-3 audit shape (INCREMENTAL per trace T3)
Reduced lens set, single-pass vs the concrete bar (*"no x402 surface admits a network outside the
canonical settleable+confirmable set; legit Base mainnet + Base Sepolia paths byte-behavior-
stable"*), findings = anything causing incorrect behavior / failing check / misleading result.
- **Mechanical-first (scripts, results fed to lenses):** gates already baselined (tsc 0 ·
  4313/185 · mcp 1898/1 · eslint 0; build pending-anchor); surface-census probe (4-symbol grep +
  route find == trace T2 set); current-state no-drift probe (PUBLIC ⊆ {8453,84532} ⊆ keys
  USDC_ADDRESSES, straight from source); current-behavior probe for C1 (the engine throw path —
  file:line, asserted textually pre-build; empirical RED/GREEN lands in Phase 4).
- **Lenses (model: opus, effort high, isolated, single-pass):** L1 factual+completeness (re-derive
  the census; hunt a missed surface; DC-15 plan-drift vs handoff); L2 settle-boundary/funds-safety
  (guard placement+shape; Base mainnet/Sepolia not broken; F2 untouched; DC-01/DC-04); L3
  invariant+test-sufficiency (no-drift test actually pins; fail-pre-fix is real; DC-05 mock-factory
  check; DC-07); L4 scope/spine + tier honesty (zero out-of-spine edits; scrutinize the T4
  canonical-static deviation AND the T3 INCREMENTAL call — escalate the tier back if unjustified).
- **Synthesizer:** opus, PLAN_READY only at 0 blocking; spine-safeguard clause embedded VERBATIM
  (handoff §Phase-3); degraded-run guard; R1→fix→R2 on blockers.
