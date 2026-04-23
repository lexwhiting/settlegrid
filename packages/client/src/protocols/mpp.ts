/**
 * MPP payer (manifest scheme `'mpp'`).
 *
 * The seller-side MPP adapter accepts payment via the `X-Payment-Token`
 * header carrying a Stripe Shared Payment Token (`spt_*`) alongside a
 * `X-Payment-Protocol: MPP/1.0` marker. The SPT is minted by the
 * buyer's wallet offline — the client does NOT mint tokens.
 *
 * Entry shape (seller-side `MPPAdapter.buildChallenge`):
 *
 *   { scheme: 'mpp', provider: 'stripe', amountCents, currency: 'USD' }
 *
 * Scaffold ignores the `currency` field because MPP's narrow contract
 * at this phase is USD-only. A future multi-currency card will gate
 * on `currency` and reject entries the wallet cannot pay.
 */

import type { AcceptEntry, WalletRef } from '../types'
import { requireString, type ProtocolPayer } from './index'

export const mppPayer: ProtocolPayer = {
  scheme: 'mpp',
  rail: 'mpp',

  extractCostCents(entry: AcceptEntry): number | null {
    const raw = (entry as { amountCents?: unknown }).amountCents
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
      typeof wallet.sharedPaymentToken === 'string' &&
      wallet.sharedPaymentToken.length > 0
    )
  },

  async buildPayment({ wallet, entry }) {
    const token = requireString(wallet, 'sharedPaymentToken', 'mpp')
    const headers: Record<string, string> = {
      'X-Payment-Protocol': 'MPP/1.0',
      'X-Payment-Token': token,
    }
    // Echo amountCents + currency back on the retry. The seller-side
    // MPPAdapter is tolerant of missing amount/currency headers (it
    // trusts the SPT itself), but echoing them back lets a middlebox
    // log/meter without having to parse the opaque SPT.
    const amountCents = (entry as { amountCents?: unknown }).amountCents
    if (typeof amountCents === 'number' && Number.isFinite(amountCents)) {
      headers['X-Payment-Amount'] = String(amountCents)
    }
    const currency = (entry as { currency?: unknown }).currency
    if (typeof currency === 'string' && currency.length > 0) {
      headers['X-Payment-Currency'] = currency
    }
    // Optional session ID — MPP groups calls into a session for
    // batched settlement. The wallet may or may not carry one.
    if (typeof wallet.sessionId === 'string' && wallet.sessionId.length > 0) {
      headers['X-MPP-Session-Id'] = wallet.sessionId
    }
    return { headers }
  },
}
