/**
 * P4.MKT2 — shared constants for the public x402 facilitator routes.
 *
 * Lives in a sibling file (NOT route.ts) because Next.js App Router's
 * Route segment type-check rejects any export from `route.ts` that
 * isn't an HTTP method handler or a recognized config export. The
 * verify, settle, and supported routes all import from here.
 *
 * Underscore prefix in the filename signals "non-route helper" —
 * Next.js doesn't pattern-match `_shared.ts` as a route entrypoint.
 */

/**
 * Networks the public facilitator officially supports on day one.
 * Filter applied to USDC_ADDRESSES (which includes ETH mainnet too).
 * Add to this list ONLY when the founder has run an end-to-end
 * settle on the new network from outside the dev environment.
 */
export const PUBLIC_FACILITATOR_NETWORKS = [
  'eip155:8453',
  'eip155:84532',
] as const

/** Facilitator name reported in /v1/supported. Stable per release. */
export const FACILITATOR_NAME = 'SettleGrid' as const

/** SemVer of the facilitator surface itself, not of the x402 spec. */
export const FACILITATOR_VERSION = '1.0.0' as const
