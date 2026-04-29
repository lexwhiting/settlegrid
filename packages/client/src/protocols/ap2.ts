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
import { optionalString, requireString, type ProtocolPayer } from './index'

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
    // Hostile fix H57: currency check. AP2 scaffold is USD-only.
    // Absent currency tolerated; non-USD returns null.
    const currency = (entry as { currency?: unknown }).currency
    if (currency !== undefined && currency !== 'USD') return null
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
    // Hostile fix H27 — route consumerId through `optionalString`
    // so it is length-capped AND CRLF/NUL-guarded consistently with
    // the required vdcJwt. The previous inline check enforced the
    // length cap but NOT the control-character ban, leaving a
    // header-injection path via a caller-controlled consumerId.
    const consumerId = optionalString(wallet, 'consumerId', 'ap2')
    if (consumerId !== undefined) {
      headers['x-ap2-consumer-id'] = consumerId
    }
    return { headers }
  },
}
