/**
 * P3.K2 — Direct-LND REST client stub.
 *
 * The P3.K2 spec requires a backend toggle (`L402_BACKEND=voltage|lnd`)
 * so operators can swap the hosted Voltage backend for a directly-
 * operated LND node later without rewriting the adapter. This file
 * ships that stub: every factory throws the spec-named error message
 * verbatim so `L402_BACKEND=lnd` is a clean, grep-able signal that
 * the caller wired a backend that is not yet implemented.
 *
 * A future card will replace this body with a real LND REST client
 * (likely similar in shape to `voltage.ts`) — keeping the file
 * present now gives the backend-dispatch logic in `l402.ts` a real
 * import to route through, so the dispatch code doesn't rot.
 */

import type { VoltageClient } from './voltage'

/**
 * Error message mandated by the P3.K2 spec card, step 4
 * ("Add `lnd.ts` stub that throws 'L402_BACKEND=lnd not yet wired —
 * use voltage.'"). Kept as an exported constant so the L402 adapter
 * and its tests can assert on the exact wording without string-
 * duplicating it.
 */
export const LND_NOT_WIRED_MESSAGE =
  'L402_BACKEND=lnd not yet wired — use voltage.'

/**
 * Return-type-compatible with {@link createVoltageClient} so both
 * backends satisfy the same contract from the adapter's perspective.
 * Always throws — there is no LND implementation in this card.
 */
export function createLndClient(): VoltageClient {
  throw new Error(LND_NOT_WIRED_MESSAGE)
}
