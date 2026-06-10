# (G) x402 settle-surface network-allowlist hardening — RESOLUTION / CAPSTONE (2026-06-10)

> Closes **B1.4 carried-debt item 1 — the non-Base/REJECT half** (`b1.4-settlement-reconciler-
> 2026-05-31.md`; founder-chosen REJECT path, not ADD-Ethereum-confirm). Pairs with the chunk's
> trace (`g-x402-network-allowlist-trace-2026-06-09.md`), PLAN_READY build plan
> (`g-x402-network-allowlist-build-plan-2026-06-09.md`), and handoff
> (`g-x402-network-allowlist-handoff-2026-06-09.md`).
>
> **TIER: INCREMENTAL** — provisional HIGH-STAKES honestly re-classified per the handoff's own
> Phase-1 NB: the trace + pre-build audit + seal each independently proved **no funds could move
> and no settlement row could be created on `eip155:1` even before the fix** (standalone engine
> throws pre-broadcast; facilitator v1 gated; proxy F2-pinned + Base-only offline verifier +
> fail-closed engine; standalone routes write no ledger rows). The realized gap was
> advertise/accept consistency + reject semantics + drift-proofing.
>
> **State: SEALED (0 blocking), LOCAL COMMIT atop `23663006` (= deployed origin/main). NOT
> pushed** — push/deploy founder-gated as always. No migration, no env change, no publish.

## What (G) is
Every x402 advertise/accept/settle surface now derives from ONE canonical settleable+confirmable
network allowlist — **`CANONICAL_X402_NETWORKS = ['eip155:8453', 'eip155:84532']`** (new
`apps/web/src/lib/settlement/x402/networks.ts`) — and non-canonical networks are rejected at the
route boundary BEFORE any engine/RPC work:

- **`POST /api/x402/settle`** — canonical guard before `verifyExactPayment`/`settleExactPayment`
  → 400 `UNSUPPORTED_NETWORK` (was: `eip155:1` burned Ethereum RPC verify reads then died on an
  incidental engine throw → 500 `SETTLEMENT_FAILED`).
- **`POST /api/x402/verify`** — same guard before the scheme branches (was: the verify engine
  fully supports Ethereum RPC, so a funded `eip155:1` payload returned `isValid: true` for a
  payment that could never settle or confirm here). This route was MISSING from the handoff's
  surface enumeration — found by the Phase-1 route census (the LB-1 completeness trap, realized).
- **`GET /api/x402/supported`** — advertisement filtered to canonical (stops advertising
  `eip155:1`, matching facilitator v1's day-one behavior).
- **No-drift invariant test** (`lib/settlement/x402/__tests__/x402-networks.test.ts`, 5 tests):
  `PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL == keys(SUPPORTED_CHAINS) ⊆ keys(USDC_ADDRESSES)` +
  `eip155:1 ∉ CANONICAL` — the DC-07 multi-surface drift that caused this debt is now a RED
  suite, not a silent divergence.
- `settle-engine.ts`: `SUPPORTED_CHAINS` gained ONLY the `export` keyword (so the invariant test
  reads the real engine set). `packages/mcp` (incl. its `USDC_ADDRESSES` copy), sdk-python,
  `env.ts` (F2 pin), facilitator v1, proxy, and all engine internals: **byte-stable** (git-diff
  proven).

**Canonical-set shape (deliberate, audit-sustained deviation from the handoff sketch):** static
{Base mainnet, Base Sepolia} in every env — the handoff's "prod mainnet-only" sketch contradicts
its own mandated invariant (`PUBLIC_FACILITATOR_NETWORKS ⊆ canonical`; that list deliberately
includes Sepolia in prod — a no-credit free relay). The env-dependent F2 prod pin remains the
SEPARATE, stricter gate on the credit-minting proxy/circle-nano rails, untouched.

## Evidence chain (all from the build session, 2026-06-10)
- **Pre-build audit** `wf_f96cd3d6-b39` (4 opus lenses + opus synthesizer, single-pass per the
  INCREMENTAL tier; mechanical-first: 19/19 deterministic probes): **PLAN_READY, 0 blocking,
  0 dead lenses, degraded=false.** All findings folded + live-re-confirmed; one submitted
  "correction" refuted by the synthesizer's own spot-check.
- **Fail-pre-fix proven empirically:** 3 behavior-change tests RED against the unguarded routes
  → GREEN post-guard (`.audit/g-build/{fail-pre-fix,pass-post-fix}.txt`).
- **Interval self-verification** (fresh-context sonnet, read-only): CLEAN, 9/9 contract items.
- **Executable gate:** tsc 0 · web vitest **4322 / 186 files / 0 fail** (= 4313 + 9 new, 185+1)
  · next build 0 · eslint 0 · mcp **1898/1 untouched** · `git diff packages/` empty.
- **Hostile-input battery** (script, real handlers): **43/43** — 18 hostile network variants ×
  both routes (case/whitespace/NUL/homoglyph/near-miss/prototype-pollution/fullwidth-colon…) all
  400 + zero engine calls; zod 422s type-level malformation; Base mainnet + Sepolia controls
  reach the engines (`.audit/g-postbuild/hostile-battery.txt`).
- **Seal-gating review** `wf_4b61aba1-08a` (3 hostile opus lenses, coverage mode, 0 dead):
  **SEALED — 7 findings, ALL low severity, 0 high, 0 medium**; dispositions + spot-reproductions
  in `.audit/g-postbuild/SEAL.md`. Tier re-confirmed against the realized diff (no escalation).

## Residuals / tracked follow-ups (all LOW, none blocking — from the seal)
1. **PRE-EXISTING parity gap:** `/api/x402/supported` still advertises the `payment-identifier`
   extension that facilitator v1 deliberately dropped (accepted-but-not-honored by
   `settleExactPayment`). Slotted as DC-16 ledger evidence; a one-line fix for a future tidy.
2. mcp adapter's error string still names `eip155:1` as supported (frozen spine, deliberate —
   server boundary rejects; no money path). Candidate for a future frozen-spine cleanup chunk.
3. `openapi.json:192` hardcodes the network enum (`base-sepolia`/`base-mainnet` slugs) — currently
   correct Base-only, but not derived from canonical; tracked discovery surface.
4. `SUPPORTED_CHAINS` is TS-readonly but not `Object.freeze`d (theoretical; no mutating consumer).
5. The invariant test pins the SET relationships; a hypothetical future route bypassing the
   canonical module would need its own route-level pin (the existing 3 surfaces are pinned).

## Surface to the founder
- **(G) makes enabling a public `X402_FACILITATOR_URL` safe w.r.t. non-Base settlement** —
  facilitator go-live is now a pure operator decision with no known funds-integrity precondition.
- **B1.4 item 2 ("starvation at scale") remains OPEN** — separate chunk, at-volume, needs a
  migration (`last_reconciled_at` watermark + pending-age alert). (G) removed its `eip155:1`
  sticky-row source at origin.
- The (K) docs-tidy rider rode this commit: `k-hmac-pepper-resolution-2026-06-08.md` + the
  register's (K) UPDATE now read SHIPPED+LIVE @ `23663006` (deployed + smoke-tested 2026-06-09).

## Next-chunk pointers (existing queue; no new handoff needed)
- **B4 settlement-row account attribution** — in-repo handoff
  `b4-settlement-account-attribution-handoff-2026-06-04.md` (⚠️ contains a verified TRAP note:
  reconcile.ts credits real money from settlement-row account_id).
- **B1.1 circle-nano enable-gate split** (INCREMENTAL, different rail).
- **B1.4 starvation-at-scale** (needs migration; "before high volume" — facilitator off, volume
  minimal today).
