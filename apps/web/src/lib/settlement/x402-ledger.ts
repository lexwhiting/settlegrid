/**
 * P3.K4 — B1.2: build the unified-ledger settlement row for an x402 on-chain
 * settlement attempt.
 *
 * x402 settles USDC on-chain but — unlike ap2 + circle-nano — wrote NO
 * `recordSettlementEntry` row, so x402 revenue was invisible to the unified
 * ledger / reconciliation. This pure builder produces that row (or null when
 * there's nothing attributable) so the per-invocation handler
 * (`handleX402Proxy`) can `const row = buildX402SettlementRow(...);
 * if (row) recordSettlementEntryAsync(row)`.
 *
 * STATUS = 'pending', NOT 'settled' — deliberately. The x402 proxy path never
 * has a CONFIRMED on-chain settlement at this point:
 *   - local mode (no facilitator): `validateX402Payment` does structural
 *     acceptance and returns NO txHash → this builder returns null (nothing
 *     moved on-chain to record); and
 *   - facilitator mode: the txHash is returned on mempool BROADCAST (e.g.
 *     `settleExactPayment` does not waitForTransactionReceipt), so the tx may
 *     still revert.
 * Recording 'settled' here would violate the money-rail invariant A2 set for
 * circle-nano ("broadcast is NOT settlement; never record an unconfirmed tx as
 * settled") and could leave a permanent, uncorrectable phantom 'settled' row
 * (the writer is FIRST-WRITE-WINS via ON CONFLICT DO NOTHING). Instead we write
 * 'pending' with the broadcast txHash in `externalRef`; the B1.4 settlement
 * reconciler confirms the receipt on-chain and flips the row to 'settled' (or
 * 'failed' on revert) via an explicit UPDATE — exactly the circle-nano A2 flow.
 *
 * Pure (no clock / no I/O) so the guard + field-mapping logic is unit-testable
 * without the proxy route's heavy Postgres/Redis/Stripe/fraud stack (which
 * billing-credits.test.ts documents is why the route handler is source-pinned,
 * not handler-tested).
 */
import type { RailSettlementRow } from './ledger'

/** The subset of the x402 validation result the ledger row is built from. */
export interface X402SettlementInputs {
  /** Broadcast tx hash — PRESENT iff an on-chain settlement was submitted. */
  txHash?: string
  /** CAIP-2 network the settlement executed on (e.g. `eip155:8453`). */
  network?: string
  scheme?: 'exact' | 'upto'
  /** USDC base units transferred on-chain (audit detail; not the billed cents). */
  amountUsdc?: string
  payerAddress?: string
}

/**
 * Returns the `pending` settlement row to record, or `null` when there is
 * nothing to attribute. Guards (each returns null):
 *  - no `txHash` → no on-chain settle was submitted on this path (e.g. local
 *    structural acceptance); a settlement row would be a phantom.
 *  - `costCents <= 0` → a free call moved no money.
 *  - no `developerId` → no account to credit the settlement to.
 *
 * Idempotent by `invocationId = x402:<network>:<txHash>`. The broadcast txHash
 * is globally unique per settlement (one EIP-3009 nonce → one tx) and the
 * nonce isn't surfaced on this path, so the txHash is the dedup key; the
 * writer's deterministic-id + ON CONFLICT DO NOTHING yields exactly-once rows
 * across settle retries. The same `invocationId` is the `operation_id` key the
 * B1.4 reconciler matches on to flip the row, and `externalRef` carries the
 * txHash it confirms. `amountCents` is the billed COST (parity with
 * ap2/circle-nano rows), not the on-chain USDC amount (kept in metadata).
 * `accountId = developerId` is the A1 stand-in (the accounts table has no
 * provisioning path — see a1-facilitator-ledger-writes tech-debt).
 */
export function buildX402SettlementRow(
  result: X402SettlementInputs,
  toolSlug: string,
  developerId: string | undefined,
  costCents: number,
): RailSettlementRow | null {
  if (!result.txHash || costCents <= 0 || !developerId) return null

  const network = result.network ?? 'unknown'
  return {
    invocationId: `x402:${network}:${result.txHash}`,
    rail: 'x402',
    protocol: 'x402',
    amountCents: costCents,
    currency: 'USDC',
    takeBps: 0,
    // 'pending' until the B1.4 reconciler confirms the on-chain receipt — see
    // the file header. NO settledAt on a pending row (the validator requires
    // settledAt only for 'settled'; the reconciler sets it on the flip).
    status: 'pending',
    externalRef: result.txHash,
    accountId: developerId,
    metadata: {
      network: result.network ?? null,
      scheme: result.scheme ?? null,
      amountUsdc: result.amountUsdc ?? null,
      payerAddress: result.payerAddress ?? null,
      settlementType: 'on-chain',
    },
    description: `x402 settlement (pending on-chain confirmation) for tool ${toolSlug} (${result.txHash})`,
  }
}
