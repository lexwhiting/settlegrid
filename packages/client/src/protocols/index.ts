/**
 * Protocol-payer registry. Each payer encapsulates the buyer-side logic
 * for one payment rail: cost extraction, wallet-readiness, and payment
 * header construction. The registry is a plain object keyed by the
 * manifest `scheme` field (not the RailName — `scheme: 'exact'` in the
 * x402 manifest maps to `rail: 'exact'` by coincidence; the indirection
 * is preserved so future rails can rename freely).
 */

import type { AcceptEntry, RailName, WalletRef } from '../types'
import { x402Payer } from './x402'
import { mppPayer } from './mpp'
import { l402Payer } from './l402'
import { ap2Payer } from './ap2'

/** Bytes-max cap for any credential string the caller passes in. */
export const MAX_CREDENTIAL_CHARS = 16 * 1024

/** Output of `buildPayment` — headers to attach to the retry request. */
export interface PaymentAttachment {
  /** Request headers to merge into the retry. Override caller headers. */
  headers: Record<string, string>
}

/** One protocol payer. All payers implement this surface uniformly. */
export interface ProtocolPayer {
  /** Scheme string the 402 manifest uses for this rail. */
  readonly scheme: string

  /** Canonical rail name used in wallet config + debug output. */
  readonly rail: RailName

  /**
   * Read the rail's cost from a 402 accept entry, normalized to
   * integer cents. Returns `null` when the entry does not carry
   * enough information to price (e.g., an L402 invoice without a
   * costCents field requires a live BTC→USD rate the client cannot
   * mint locally). Rails with null costs are skipped during
   * cheapest-selection — the client never pays a rail it cannot
   * price.
   */
  extractCostCents(entry: AcceptEntry): number | null

  /**
   * Return true iff the configured wallet contains the credentials
   * this rail needs to pay. A `readOnly` wallet always returns false
   * (browser-side display-only credential).
   */
  canPay(wallet: WalletRef | undefined): boolean

  /**
   * Construct the payment headers for a retry request. Called only
   * AFTER `canPay` returned true AND the budget check passed, so the
   * function can trust the wallet has the right fields and the
   * caller has authorized the spend.
   */
  buildPayment(args: {
    entry: AcceptEntry
    wallet: WalletRef
    toolUrl: string
  }): Promise<PaymentAttachment>
}

/** Registry of built-in payers, keyed by manifest scheme. */
export const PROTOCOL_PAYERS: Record<string, ProtocolPayer> = {
  [x402Payer.scheme]: x402Payer,
  [mppPayer.scheme]: mppPayer,
  [l402Payer.scheme]: l402Payer,
  [ap2Payer.scheme]: ap2Payer,
}

/** Lookup a payer by manifest scheme. Returns `undefined` for unknown schemes. */
export function getPayer(scheme: string): ProtocolPayer | undefined {
  return PROTOCOL_PAYERS[scheme]
}

/**
 * Validate that a wallet field is a non-empty string no longer than
 * {@link MAX_CREDENTIAL_CHARS}. Throws TypeError with a specific
 * message when the field is wrong — the payer's `canPay` has
 * already returned true, so this is a programmer error rather than
 * a missing-config case.
 */
export function requireString(
  wallet: WalletRef,
  field: string,
  rail: RailName,
): string {
  const value = wallet[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(
      `${rail} wallet is missing required string field \`${field}\`.`,
    )
  }
  if (value.length > MAX_CREDENTIAL_CHARS) {
    throw new TypeError(
      `${rail} wallet field \`${field}\` exceeds ${MAX_CREDENTIAL_CHARS}-char cap ` +
        `(received ${value.length} chars) — refusing to attach to a payment header.`,
    )
  }
  return value
}
