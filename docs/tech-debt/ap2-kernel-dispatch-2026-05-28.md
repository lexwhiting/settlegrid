# Tech-Debt Register — AP2 Kernel Dispatch (P5 Tier-1, audit 2026-05-28)

> Produced by the mandatory 3-part audit chain over the AP2 kernel-dispatch
> wiring (commit `feat(kernel): wire AP2 Tier-1 facilitator dispatch (P5)`).
> Read before touching `packages/mcp/src/adapters/ap2.ts`,
> `packages/mcp/src/kernel.ts`, or `apps/web/src/app/api/ap2/*`. Companion
> local note (gitignored): the "AP2 — LANDED" section of
> `docs/phase-reports/P5-kernel-dispatch-expansion-deferred.md`.

## Status
**Shipped (code-complete, audited, locally committed; NOT pushed).** AP2
graduated from *detected-only* to *settled end-to-end* through the SDK
dispatch kernel, at parity with x402/mpp. Verified: packages/mcp 1872 pass;
apps/web 4013 pass (1 pre-existing unrelated failure — see below); tsc / eslint
(0 errors on changed files) / `next build` all clean. Audit verdict: **PASS**
(0 blockers).

## What shipped (file list)
- `packages/mcp/src/kernel.ts` — `'ap2'` in `PHASE_1_KERNEL_PROTOCOLS` + the
  facilitator branch (reuses `handleFacilitatorProtocol`).
- `packages/mcp/src/adapters/ap2.ts` — `extractPaymentContext` captures the VDC
  JWT into `payment.proof`; `validateAp2Payment` split into an exported
  `validateAp2CredentialString(credential, opts)` core.
- `packages/mcp/src/index.ts` — export `validateAp2CredentialString`.
- `apps/web/src/app/api/ap2/{verify,settle}/route.ts` — facilitator endpoints
  (raw kernel-facilitator contract, NOT the enveloped public x402 contract).
- `apps/web/src/lib/ap2-proxy.ts` — `validateAp2CredentialString` app wrapper.
- Demo: `api/demo/sandbox/[...path]/route.ts` stubs `/api/ap2/{verify,settle}`;
  `lib/demo-kernel-config.ts` includes `ap2`; `app/demo/kernel/page.tsx` copy.
- Tests: kernel facilitator path, adapter credential-string matrix, `/api/ap2`
  route integration, demo-config pin (3→4), sandbox ap2 stubs.

## DEBT (deferred — non-blocking; ranked)

| # | Severity | Item | Location | Notes / fix sketch |
|---|---|---|---|---|
| 1 | MED (shared) | Kernel facilitator settle does NOT write the unified ledger | `api/ap2/settle/route.ts` + kernel | SAME gap x402/mpp have through the kernel; ledger-write is deferred to P3.K4 "router wiring". Wire all three rails together then. AP2 ships at parity, not deeper. |
| 2 | LOW | Cost fail-open to 0 on malformed `pricingConfig` | `api/ap2/{verify,settle}` `resolveCostCents` | Mirrors the proxy's `getCostCents`. Signature/issuer/expiry remain the real gate; worst case = undercharge on a misconfigured tool, never unauthorized settlement. |
| 3 | LOW | Settle-time re-verify failure → 500 (not 402) for the consumer | `api/ap2/settle` + kernel `facilitatorFetch` | Route returns 402; the kernel maps non-2xx → `SettleGridUnavailableError` → 500. Same as x402's settle path. Rare (sub-second verify→settle expiry window). Could return a `rejected` SettlementResult at 200 for a cleaner 402. |
| 4 | LOW (repo-wide) | No request body-size cap on `/api/ap2/*` | `api/ap2/{verify,settle}` | Consistent with the existing x402 routes (rate-limited by IP only). Folds into the repo-wide rate-limit hardening (publisher-keys DEBT #1 — fix centrally). |
| 5 | LOW (pre-existing) | `getAp2SigningSecret()` defaults to `'ap2-dev-secret'`; `isAp2Enabled()` is the real gate | `apps/web/src/lib/env.ts` | If only `AP2_PROVIDER_KEY`/`AP2_VERIFICATION_KEY` is set (not `AP2_SIGNING_SECRET`), VDCs validate against the dev default → fail closed. Pre-existing; shared with the proxy path. |

## Pre-existing, unrelated test failure observed (NOT introduced here)
`src/lib/__tests__/settlement-moat.test.ts > processDataDeletion > processes a
pending deletion and returns completed` fails at HEAD `3db59b61` (returns
`'failed'`). `compliance.ts` + that test file are unmodified by this change and
import nothing from the AP2 / kernel / `@settlegrid/mcp` surface (confirmed:
reproduces in isolation). This is publisher-keys DEBT #5
(`processDataDeletion` non-idempotency). Out of scope for AP2.

## Next Tier-1
ACP → UCP (clarify deps) → Circle Nano (needs Circle Mint API). NOTE: the
kernel test `falls through to 402 when the matched adapter is not wired into
Phase 1` now uses ACP as its unwired example — repoint it to the next
still-unwired protocol when ACP lands.
