/**
 * On-chain settlement rails — single source of truth.
 *
 * These rails settle USDC on-chain (broadcast→confirm) and are SELECTed by the
 * pending-settlement reconciler (reconcile.ts) by txHash: a row with rail ∈ this
 * set + a non-null external_ref + status 'pending' enters the reconciler's
 * confirmable window.
 *
 * The multi-hop hop→ledger attribution path (recordHop) MUST exclude these rails
 * by construction. A hop's operation_id is a bare random UUID (the hopId), which
 * can never parse as a settlement operation_id (`<rail>:<network>:<from>:<nonce>`),
 * so a hop row carrying an on-chain rail + external_ref would be re-SELECTed by
 * the reconciler every run forever (skipped-unparseable), starving its bounded
 * batch. Sharing THIS constant between the reconciler's selection (inArray) and
 * the hop guard's exclusion makes the exclusion provable-by-construction and
 * drift-proof. See docs/tech-debt/h-f1-trace-2026-06-08.md §1b.
 */
export const RECONCILABLE_RAILS = ['circle-nano', 'x402'] as const

export type ReconcilableRail = (typeof RECONCILABLE_RAILS)[number]

/** True iff `rail` settles on-chain and is reconciled by the settlement reconciler. */
export function isReconcilableRail(rail: string): boolean {
  return (RECONCILABLE_RAILS as readonly string[]).includes(rail)
}
