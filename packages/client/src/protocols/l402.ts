/**
 * L402 payer (manifest scheme `'l402'`).
 *
 * The seller-side L402 adapter accepts payment via the legacy LSAT
 * header format: `Authorization: LSAT <macaroon>:<preimage>`. The
 * wallet holds a pre-obtained macaroon / preimage pair — the client
 * does NOT mint invoices or pay Lightning invoices; that belongs in
 * a dedicated wallet service.
 *
 * Entry shape (seller-side `L402Adapter.buildChallenge`):
 *
 *   {
 *     scheme: 'l402',
 *     provider: 'lightning',
 *     costCents: number,
 *     currency: 'btc-lightning',
 *     acceptedPayments: ['lightning-invoice']
 *   }
 *
 * The scaffold trusts the `costCents` field as the price. The
 * `acceptedPayments` array is informational — only 'lightning-invoice'
 * is supported today, and the wallet's presence of a macaroon +
 * preimage is sufficient proof of capability.
 */

import type { AcceptEntry, WalletRef } from '../types'
import { requireString, type ProtocolPayer } from './index'

/**
 * Regex for a valid hex preimage: 32 bytes = 64 hex characters,
 * case-insensitive. Rejects whitespace and non-hex characters
 * BEFORE the preimage flows into the LSAT header, where a malformed
 * value would cause the seller to reject on preimage-hash mismatch
 * with a confusing error.
 */
const HEX_32_BYTES = /^[0-9a-fA-F]{64}$/

export const l402Payer: ProtocolPayer = {
  scheme: 'l402',
  rail: 'l402',

  extractCostCents(entry: AcceptEntry): number | null {
    const raw = (entry as { costCents?: unknown }).costCents
    if (
      typeof raw !== 'number' ||
      !Number.isFinite(raw) ||
      !Number.isInteger(raw) ||
      raw < 0
    ) {
      return null
    }
    return raw
  },

  canPay(wallet: WalletRef | undefined): boolean {
    if (!wallet || wallet.readOnly) return false
    return (
      typeof wallet.macaroon === 'string' &&
      wallet.macaroon.length > 0 &&
      typeof wallet.preimage === 'string' &&
      HEX_32_BYTES.test(wallet.preimage)
    )
  },

  async buildPayment({ wallet }) {
    const macaroon = requireString(wallet, 'macaroon', 'l402')
    const preimage = requireString(wallet, 'preimage', 'l402')
    if (!HEX_32_BYTES.test(preimage)) {
      throw new TypeError(
        'l402 wallet `preimage` must be 64 hex chars (32 bytes). ' +
          'canPay() should have rejected this wallet before buildPayment() was called.',
      )
    }
    // LSAT header format — `LSAT <macaroon>:<preimage>`. Note the
    // single space after 'LSAT' and the colon separator; the seller
    // parses by splitting on ':' after stripping the 'LSAT ' prefix.
    return {
      headers: {
        Authorization: `LSAT ${macaroon}:${preimage}`,
      },
    }
  },
}
