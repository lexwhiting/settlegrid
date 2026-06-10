# (G) x402 network-allowlist — Phase 1 SCOPE-CONFIRM DISCOVERY TRACE (2026-06-10)

> Re-derivation of every handoff (§0–§4, `g-x402-network-allowlist-handoff-2026-06-09.md`) claim
> against live code at HEAD `23663006` (= `origin/main`, tree clean). Every claim below is grounded
> in a file:line read **this session** (2026-06-10).

---

## T0. Ground state (verified)

- `git log -1` → `23663006 feat(web): (K) HMAC-pepper API keyspace — dual-read hardening (DEBT #3)`;
  `git status -sb` → `## main`, only this handoff + trace untracked. ✔ matches handoff §4.
- Baselines: re-run in progress (tsc / web vitest / build / mcp vitest); recorded in §T7.

## T1. The network lists (the handoff's four, plus two it groups implicitly)

| # | List | Location (read this session) | Contents | Env-dependent? |
|---|------|------------------------------|----------|----------------|
| L1 | `USDC_ADDRESSES` (app) | `apps/web/src/lib/settlement/x402/types.ts:16-20` | 8453, 84532, **1** | no |
| L1b | `PERMIT2_ADDRESSES` + `X402Network` type | `types.ts:23-27`, `:10-13` | same 3 | no |
| L2 | `USDC_ADDRESSES` (mcp duplicate) | `packages/mcp/src/adapters/x402.ts:232-236`; `DEFAULT_X402_NETWORK = 'eip155:8453'` at `:29` | 8453, 84532, **1** | no |
| L3 | `PUBLIC_FACILITATOR_NETWORKS` | `apps/web/src/app/api/x402/facilitator/v1/_shared.ts:19-22` | 8453, 84532 | **no — static, applies in PROD too** (deliberate: "Add ONLY when the founder has run an end-to-end settle") |
| L4 | `SUPPORTED_CHAINS` (confirm+settle engine) | `apps/web/src/lib/settlement/circle-nano/settle-engine.ts:37-40` ("anything else fails closed") | 8453, 84532 | no |
| L5 | `X402_MAINNET_NETWORK` + `isX402TestnetSettlementAllowed()` | `apps/web/src/lib/env.ts:201`, `:213-215` | 8453 pin; testnet only when flag AND !prod | **yes — the F2 prod pin (proxy + circle-nano routes only)** |
| L6 | `USDC_EIP712_DOMAINS` (offline verifier) | `apps/web/src/lib/settlement/circle-nano/verify.ts:43-44`, fail-closed at `:137-143` | 8453, 84532 | no |

Also: `verify.ts:147-153` `getChain` **supports `eip155:1`** (viem `mainnet`) and `ETH_USD_PRICES`
(`verify.ts:169`) prices it — the x402 VERIFY engine genuinely operates on Ethereum.

## T2. COMPLETE surface census (grep-proven: `USDC_ADDRESSES|PUBLIC_FACILITATOR_NETWORKS|SUPPORTED_CHAINS|X402_MAINNET_NETWORK|isX402TestnetSettlementAllowed` across `apps/web/src` + `packages/mcp/src`, non-test; plus `find apps/web/src/app/api/x402 -name route.ts` → **6 routes**, one MORE than the handoff enumerated)

### Advertise
| ID | Surface | State | Disposition |
|----|---------|-------|-------------|
| A1 | `GET /api/x402/supported` — `route.ts:35` maps **raw** `USDC_ADDRESSES` | **LEAKS `eip155:1`** | **FIX: filter to canonical** |
| A2 | `GET /api/x402/facilitator/v1/supported` — `route.ts:53-57` filters `PUBLIC_FACILITATOR_NETWORKS ∩ USDC_ADDRESSES`; test pins `not.toContain('eip155:1')` (`x402-facilitator.test.ts:137`) | guarded | verify-only |
| A3 | proxy x402 402 challenge — mcp `generateX402_402Response` advertises `DEFAULT_X402_NETWORK` only (`x402.ts:591-593`) | Base-mainnet-only | none |
| A4 | facilitator marketing page `app/protocols/x402/facilitator/page.tsx:8-10` — documents day-one Base-only | consistent | none |

### Accept / verify
| ID | Surface | State | Disposition |
|----|---------|-------|-------------|
| B1 | `POST /api/x402/verify` (**standalone — NOT in the handoff's LB-1 enumeration; found by route census**) — `route.ts:13-19` `network: z.string().min(1)`, no allowlist; `verifyExactPayment`/`verifyUptoPayment` accept any `USDC_ADDRESSES` key and `getChain` supports `eip155:1` → returns `isValid: true` for a funded Ethereum payload that can NEVER settle here | **UNGUARDED** | **FIX: guard to canonical** |
| B2 | `POST /api/x402/facilitator/v1/verify` — `route.ts:71-78` rejects non-`PUBLIC_FACILITATOR_NETWORKS` | guarded | verify-only |
| B3 | mcp `validateX402Payment` — `x402.ts:422-431` accepts any `USDC_ADDRESSES`(mcp) key incl. `eip155:1`; consumed by the app proxy as a **pure structural accept** (`apps/web/src/lib/x402-proxy.ts:41-51`, facilitatorUrl deliberately omitted — never settles) | structural only; authoritative guards are downstream (C3) | **leave byte-stable** (see T5) |

### Settle (money)
| ID | Surface | State | Disposition |
|----|---------|-------|-------------|
| C1 | `POST /api/x402/settle` (standalone) — `route.ts:16-24` `network: z.string().min(1)`, **no allowlist**; flow for `eip155:1`: `verifyExactPayment` PASSES (real Ethereum RPC nonce/balance reads), then `settleExactPayment`: `USDC_ADDRESSES[network]` check passes (`settle.ts:172-180`), idempotency, sig split, then **`getWalletClient` (`settle.ts:86-96`) THROWS** ("Settlement not supported…") **before `writeContract` (`:218`)** → outer catch (`:281-304`) → `success:false`, `errorCode:'SETTLEMENT_RPC_ERROR'` → route returns **HTTP 500** | **No funds can move on `eip155:1`** — but the reject is an incidental engine throw, not a boundary guard: 500 not 4xx, wrong error code, reached only after burning Ethereum RPC verify reads | **FIX: canonical guard at the route boundary, before verify** |
| C2 | `POST /api/x402/facilitator/v1/settle` — guarded at `route.ts:77-86`; **pure relay, NO ledger write** (route read end-to-end, `:65-149`: verify → `settleExactPayment` → response). Note: **allows `eip155:84532` in PROD by design** (free relay, mints no credit; `_shared.ts:14-18`) | guarded | verify-only |
| C3 | proxy in-request — **triple-guarded**: F2 pin `proxy/[slug]/route.ts:1860` → `orchestrate.ts` offline verifier `verifyEip3009Authorization` fail-closed on `USDC_EIP712_DOMAINS` (Base-only, `circle-nano/verify.ts:137-143`) → engine `submitCircleNanoOnChain` fail-closed (`settle-engine.ts:117-121`). Even non-prod with `SETTLEGRID_X402_ALLOW_TESTNET=true` (which lets any non-mainnet network past the pin), `eip155:1` dies at the offline verifier | guarded ×3 | none |
| C4 | `POST /api/circle-nano/settle:165` — F2 pin (different rail) | guarded | reference only |

### Confirm
| ID | Surface | State |
|----|---------|-------|
| D1 | reconciler `reconcile.ts:156-162` — `unsupported-network` → `skipped-unsupported`, graceful warn. **Row sources today:** ONLY `orchestrate.ts` writes x402 settlement rows (`recordSettlementEntry`); the standalone routes C1/C2 write none. Since C3 is triple-guarded, **no `eip155:1` row can be created today** — the stuck-pending scenario is fully latent. |

**Census completeness:** the 6-route `find` + the 4-symbol grep + a repo-wide non-test `eip155:1` grep
(hits only: `verify.ts` getChain/prices, `parse.ts` comment [accurate — it describes the PROXY path's
offline verifier, which IS Base-only], `types.ts` tables/type, mcp adapter) — no 7th surface found.

## T3. Phase-1 NB answer (e) — the tier question

**`settleExactPayment` cannot move money on `eip155:1`:** `getWalletClient` throws for any network
other than 8453/84532 *before* `writeContract`. Every other settle path is independently guarded
(C2 gate, C3 ×3, C4 pin). No path writes an `eip155:1` settlement row. **The funds-safety trigger
is GONE; per the handoff NB this re-classifies (G) → INCREMENTAL** (under-auditing danger noted;
see honest residuals below). The realized gap is **consistency + reject-semantics + drift-proofing**:

1. A1 advertises a network no settle path supports (`/supported` leaks `eip155:1`).
2. B1 tells clients `isValid: true` for payments that can never settle/confirm here (client signs,
   submits, gets an opaque 500).
3. C1's reject is accidental (HTTP 500 body-code `SETTLEMENT_FAILED` — engine-internal `errorCode`
   `SETTLEMENT_RPC_ERROR`, never surfaced — instead of a clean 4xx `UNSUPPORTED_NETWORK`),
   reached only after spending Ethereum RPC reads — and it exists only as an engine implementation
   detail, not an enforced boundary invariant (DC-13 latent + DC-07 drift risk).
4. Nothing structurally prevents the four lists from diverging further (DC-07 — the chunk's point).

**Honest residual risk (why the audit still gets a funds-safety-aware lens):** the fix inserts a
rejection gate in front of the LIVE Base-mainnet real-USDC route (C1). The non-trivial risk is now
LB-2-too-broad (breaking legit Base mainnet / Base Sepolia settles), not eip155:1 money movement.
The guard-correctness probe (eth-rejected / Base-passes / Sepolia-passes) stays mechanical-mandatory.

## T4. Canonical-set decision (c) — resolving an internal contradiction in the handoff

The handoff prescribes BOTH (i) canonical = "prod mainnet-only; non-prod +Base Sepolia, mirroring F2"
and (ii) the invariant `PUBLIC_FACILITATOR_NETWORKS ⊆ canonical`. These are **mutually inconsistent in
prod**: `PUBLIC_FACILITATOR_NETWORKS` is static `{8453, 84532}` including production — deliberately
(`_shared.ts:14-18`; C2 is a no-credit free relay; founder e2e'd both networks; the handoff §3.5 says
verify, don't change it). If canonical(prod) = {8453}, either the invariant fails in prod or we'd have
to strip Sepolia from the prod facilitator — a behavior change to a documented day-one contract,
i.e. scope creep the handoff itself forbids.

**Resolution: canonical = the static settleable+confirmable set `{eip155:8453, eip155:84532}`** —
exactly `SUPPORTED_CHAINS` = exactly the `getWalletClient` switch = exactly `USDC_EIP712_DOMAINS`.
- "Confirmable" (L4) and "settleable" (settle.ts switch) are both **static** facts about the engines —
  not env-dependent. The env-dependent F2 pin (L5) is a *stricter, separate* gate on the
  **credit-minting** proxy/circle-nano rails and stays BYTE-STABLE (not loosened, not generalized).
- The standalone x402 surfaces (A1/B1/C1) are the same no-credit facilitator trust class as C2, which
  already admits exactly this set in every env. C1 *already settles Sepolia in prod today* (relay,
  no credit) — canonical-static keeps every legit current behavior byte-identical and removes ONLY
  `eip155:1` admission. Minimal change wins.
- Invariant chain that becomes structurally pinned:
  `PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL == keys(SUPPORTED_CHAINS) ⊆ keys(USDC_ADDRESSES)`.

This deviates from the handoff's "prod mainnet-only" sketch **with cause**; flagged for the
pre-build audit to scrutinize explicitly.

## T5. mcp `USDC_ADDRESSES` fate (d): **stays byte-stable.**
Its 402 generation already advertises Base mainnet only (A3); its validate (B3) is a client-side
structural pre-check ahead of the authoritative server-side boundary (where rejection must live —
a client can post any network regardless of client-side tables, LB-2's own argument); removing
`eip155:1` there is an SDK-visible behavior change with zero safety gain. → `packages/mcp` suite
stays 1898/1, python untouched. This also removes the handoff's "frozen-surface edit" HIGH-STAKES
trigger, consistent with the T3 re-classification.

App-side `USDC_ADDRESSES`/`PERMIT2_ADDRESSES`/`X402Network` (L1/L1b) also stay as-is (data tables
+ type, consumed by verify/gas internals the chunk holds byte-stable); surfaces FILTER to canonical.

## T6. Test landscape (f) + behavior-change set

Pinning today's behavior (must change with the fix — these are the fail-pre-fix proofs):
- `apps/web/src/lib/__tests__/x402.test.ts:945` — `/api/x402/supported` `networks.length >= 3` →
  becomes exactly-canonical (2) + `not.toContain('eip155:1')`.
- NEW: C1 settle with `eip155:1` → 400 `UNSUPPORTED_NETWORK` (pre-fix: 500 via engine throw — prove
  empirically pre-fix); B1 verify with `eip155:1` → 400 (pre-fix: 200 + verify result); Base mainnet +
  Base Sepolia payloads still pass the guard on both routes (behavior-neutral pins); no-drift
  invariant test (T4 chain, incl. `canonical == keys(SUPPORTED_CHAINS)`).
- Unchanged: `x402.test.ts:115` (`USDC_ADDRESSES['eip155:1']` defined — table kept);
  `x402-facilitator.test.ts` (C2/B2/A2 behavior untouched); mcp suites.

## T7. Baselines (anchored this session, pre-edit)
- tsc: 0 errors ✔ (exit 0) · web vitest: **4313 pass / 185 files / 0 fail** ✔ · mcp vitest: **1898 pass / 1 skip** ✔
  · next build: exit 0 ✔ · eslint on the 3 target routes: 0 ✔ · mechanical probes: 19/19 PASS
  (`.audit/g-prebuild/probes/RESULTS.txt`)
- python packages: untouched by plan; `git diff --numstat` gate at close.

## T8. No migration (g)
Pure route-layer guard + advertisement filter + tests; no schema, no row-shape, no env change. ✔

## T9. In-scope change list (feeds Phase 2 plan)
1. NEW `CANONICAL_X402_NETWORKS` (+ membership helper) co-located in `lib/settlement/x402/`
   (exact file decided in plan; no circular imports — types.ts has zero imports today).
2. C1 `/api/x402/settle`: canonical guard **before** `verifyExactPayment` → 400 `UNSUPPORTED_NETWORK`
   (mirror C2's `:77-86` message shape).
3. B1 `/api/x402/verify`: same guard, same shape.
4. A1 `/api/x402/supported`: filter `USDC_ADDRESSES` entries to canonical.
5. No-drift invariant test + behavior tests per T6.
6. OUT (confirmed): everything in handoff §3 OUT-list; plus mcp adapter (T5); plus the
   `verify.ts:262`/`settle.ts:177` error-message strings that name `eip155:1`/Base-only (lib
   internals, unreachable for `eip155:1` via guarded routes post-fix; byte-stable engines win).

**TIER recorded: INCREMENTAL** (re-classified per handoff Phase-1 NB; rationale T3; audit shape:
reduced lens set, single-pass vs the concrete bar, mechanical probes mandatory, no separate
adversarial-verify pass).
