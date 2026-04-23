/**
 * x402 payer (manifest scheme `'exact'`).
 *
 * x402 v2 advertises cost as a decimal string in the asset's base
 * units. Base USDC uses 6 decimals, so a `amount: '50000'` entry on
 * an `asset: '0x833589fc…'` (Base USDC) corresponds to 0.05 USDC =
 * 5 cents USD. Other assets would need a live rate; this scaffold
 * only prices USDC — entries advertising a non-USDC asset return
 * `null` from `extractCostCents` and are skipped during selection.
 *
 * The wallet for x402 carries a pre-signed `xPaymentHeader` — a
 * base64-encoded X-Payment payload (EIP-3009 `transferWithAuthorization`
 * or Permit2 `permitWitnessTransferFrom`). The client does NOT hold
 * private keys or sign payloads: the wallet is produced offline by
 * a Node service or browser extension and passed to the client as
 * opaque material. This keeps the SDK isomorphic.
 */

import type { AcceptEntry, WalletRef } from '../types'
import { requireString, type ProtocolPayer } from './index'

/**
 * Base USDC ERC-20 address on Base mainnet. Scaffold pricing is
 * enabled only for this asset — all other x402 assets return a
 * null cost.
 */
export const BASE_USDC_ADDRESS =
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/** Decimals on USDC. `1 USDC == 10^6 base units`. */
const USDC_DECIMALS = 6

/** Base units per cent. `1 cent USD == 0.01 USDC == 10_000 base units`. */
const USDC_BASE_UNITS_PER_CENT = 10 ** (USDC_DECIMALS - 2)

export const x402Payer: ProtocolPayer = {
  scheme: 'exact',
  rail: 'exact',

  extractCostCents(entry: AcceptEntry): number | null {
    const { amount, asset } = entry as { amount?: unknown; asset?: unknown }
    // Scaffold only prices Base USDC — case-insensitive because EVM
    // addresses are case-insensitive in comparison but often stored
    // in checksum form with mixed case.
    if (typeof asset !== 'string') return null
    if (asset.toLowerCase() !== BASE_USDC_ADDRESS.toLowerCase()) return null
    if (typeof amount !== 'string' || amount.length === 0) return null
    // Strip leading '+' (not produced by trusted servers but cheap to
    // accept). Reject anything that is not a decimal integer string —
    // BigInt is strict about format and throws on scientific notation
    // or non-integer characters, which would otherwise surface as a
    // deep SyntaxError later.
    if (!/^\+?[0-9]+$/.test(amount)) return null
    let baseUnits: bigint
    try {
      baseUnits = BigInt(amount)
    } catch {
      return null
    }
    if (baseUnits < 0n) return null
    // Convert base units → cents via the USDC_BASE_UNITS_PER_CENT
    // constant. Integer division is exact for amounts that are a
    // whole number of cents; sub-cent amounts (e.g., amount='1234'
    // = 0.001234 USDC = 0.12 cents) truncate down to match the
    // conservative seller-side semantics in buildChallenge.
    const cents = baseUnits / BigInt(USDC_BASE_UNITS_PER_CENT)
    if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null
    return Number(cents)
  },

  canPay(wallet: WalletRef | undefined): boolean {
    if (!wallet || wallet.readOnly) return false
    return typeof wallet.xPaymentHeader === 'string' && wallet.xPaymentHeader.length > 0
  },

  async buildPayment({ wallet }) {
    const xPayment = requireString(wallet, 'xPaymentHeader', 'exact')
    return {
      headers: {
        'X-Payment': xPayment,
      },
    }
  },
}
