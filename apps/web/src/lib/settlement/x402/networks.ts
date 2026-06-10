/**
 * (G) Canonical settleable+confirmable x402 network allowlist — THE single
 * source of truth every x402 advertise/accept/settle surface filters/guards on.
 *
 * Membership = networks BOTH settle engines can broadcast on (settle.ts
 * getWalletClient, circle-nano settle-engine SUPPORTED_CHAINS) AND the
 * reconciler can confirm (the same SUPPORTED_CHAINS) — a static engine fact,
 * NOT env policy. The production mainnet-only rule for the credit-minting
 * rails is the SEPARATE, stricter F2 pin (env.ts X402_MAINNET_NETWORK +
 * isX402TestnetSettlementAllowed) — do not merge the two.
 *
 * No-drift invariant (pinned by x402-networks.test.ts):
 *   PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL == keys(SUPPORTED_CHAINS) ⊆ keys(USDC_ADDRESSES)
 */
export const CANONICAL_X402_NETWORKS = ['eip155:8453', 'eip155:84532'] as const

export type CanonicalX402Network = (typeof CANONICAL_X402_NETWORKS)[number]

export function isCanonicalX402Network(network: string): network is CanonicalX402Network {
  return (CANONICAL_X402_NETWORKS as readonly string[]).includes(network)
}
