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

/**
 * Hostile fix H26 — HTTP-header-forbidden control characters. Any
 * credential string attached to a request header MUST NOT carry
 * CR (0x0D), LF (0x0A), or NUL (0x00). Fetch's Headers constructor
 * would reject such values later with an opaque TypeError; guarding
 * at the wallet boundary surfaces a specific, actionable error
 * naming the bad field instead of a generic "invalid header value".
 *
 * We intentionally DON'T enforce a full RFC 7230 token set on
 * credentials — real L402 macaroons are base64, x402 X-Payment
 * blobs are base64, VDC JWTs are base64url + '.' — all of which
 * are ASCII-printable. A caller who wires a weird non-ASCII
 * credential (Unicode emoji, etc.) is on their own; fetch decides.
 */
const HEADER_FORBIDDEN_CHARS = /[\x00\r\n]/

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
 * Shared validation used by {@link requireString} and
 * {@link optionalString} — caps length + rejects header-forbidden
 * control characters. Throws with a rail/field-specific message.
 */
function validateCredentialString(
  value: string,
  field: string,
  rail: RailName,
): void {
  if (value.length > MAX_CREDENTIAL_CHARS) {
    throw new TypeError(
      `${rail} wallet field \`${field}\` exceeds ${MAX_CREDENTIAL_CHARS}-char cap ` +
        `(received ${value.length} chars) — refusing to attach to a payment header.`,
    )
  }
  if (HEADER_FORBIDDEN_CHARS.test(value)) {
    throw new TypeError(
      `${rail} wallet field \`${field}\` contains forbidden control characters ` +
        `(CR, LF, or NUL). HTTP header values cannot carry these, and the ` +
        `presence of CR/LF would otherwise enable header injection.`,
    )
  }
}

/**
 * Validate that a wallet field is a non-empty string no longer than
 * {@link MAX_CREDENTIAL_CHARS} and free of CR/LF/NUL. Throws
 * TypeError with a specific message when the field is wrong — the
 * payer's `canPay` has already returned true, so this is a
 * programmer error rather than a missing-config case.
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
  validateCredentialString(value, field, rail)
  return value
}

/**
 * Validate that a wallet field is either absent or a non-empty
 * string passing {@link validateCredentialString}. Empty strings
 * are treated as absent so callers can clear a field by setting it
 * to `''` rather than deleting it. Returns the validated string or
 * `undefined`.
 */
export function optionalString(
  wallet: WalletRef,
  field: string,
  rail: RailName,
): string | undefined {
  const value = wallet[field]
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') {
    throw new TypeError(
      `${rail} wallet field \`${field}\`, when present, must be a string ` +
        `(got ${typeof value}).`,
    )
  }
  if (value.length === 0) return undefined
  validateCredentialString(value, field, rail)
  return value
}
