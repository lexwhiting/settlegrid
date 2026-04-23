/**
 * AP2 payer (manifest scheme `'ap2'`).
 *
 * The seller-side AP2 adapter accepts payment via the
 * `x-ap2-credential` header carrying a VDC (Verifiable Digital
 * Credential) JWT. The wallet holds the JWT pre-issued by an AP2
 * provider — the client does NOT issue VDCs or run mandate flows;
 * that is the provider's responsibility.
 *
 * Entry shape (seller-side `AP2Adapter.buildChallenge`):
 *
 *   { scheme: 'ap2', provider: 'google', costCents, currency: 'USD' }
 *
 * Optional wallet field `consumerId` is echoed back on the retry via
 * `x-ap2-consumer-id` — the AP2 adapter uses it to log the operator
 * but does not strictly require it (the VDC itself carries `sub`).
 */

import type { AcceptEntry, WalletRef } from '../types'
import { requireString, type ProtocolPayer } from './index'

export const ap2Payer: ProtocolPayer = {
  scheme: 'ap2',
  rail: 'ap2',

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
    return typeof wallet.vdcJwt === 'string' && wallet.vdcJwt.length > 0
  },

  async buildPayment({ wallet }) {
    const vdcJwt = requireString(wallet, 'vdcJwt', 'ap2')
    const headers: Record<string, string> = {
      'x-ap2-credential': vdcJwt,
    }
    if (typeof wallet.consumerId === 'string' && wallet.consumerId.length > 0) {
      // Re-validate length — consumerId was not passed through
      // requireString because it's optional; the cap still applies.
      if (wallet.consumerId.length > 16 * 1024) {
        throw new TypeError(
          'ap2 wallet field `consumerId` exceeds 16384-char cap.',
        )
      }
      headers['x-ap2-consumer-id'] = wallet.consumerId
    }
    return { headers }
  },
}
