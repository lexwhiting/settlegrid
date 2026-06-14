/**
 * x402 Protocol Types
 * Based on the x402 v2 specification: https://github.com/coinbase/x402
 */

/** Supported x402 payment schemes */
export type X402Scheme = 'exact' | 'upto'

/** Supported networks (CAIP-2 format) */
export type X402Network =
  | 'eip155:8453'   // Base mainnet
  | 'eip155:84532'  // Base Sepolia
  | 'eip155:1'      // Ethereum mainnet

/** USDC contract addresses per network */
export const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',  // Base mainnet USDC
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',    // Ethereum mainnet USDC
}

/** Permit2 canonical addresses (same across all EVM chains) */
export const PERMIT2_ADDRESSES: Record<string, `0x${string}`> = {
  'eip155:8453': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  'eip155:84532': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  'eip155:1': '0x000000000022D473030F116dDEE9F6B43aC78BA3',
}

/**
 * Maximum allowed window between `now` and a buyer-set EIP-3009 `validBefore`,
 * in seconds. A `validBefore > now + this` is rejected at BOTH offline verifiers
 * (`circle-nano/verify.ts` and `x402/verify.ts`) with a buyer-facing 402.
 *
 * WHY: an uncapped far-future `validBefore` (e.g. year 2099) lets a buyer mint a
 * ref-NULL `pending` ledger row that never wall-expires — the reconciler's expiry
 * pass pre-filter (`now <= validBefore + EXPIRY_MARGIN_SECONDS → skip`) skips it
 * forever → permanent `pending_overdue`/`noTxhashCount` alarm inflation AND
 * permanent indexed payer-PII. Rate limits bound the RATE of new rows; nothing
 * bounded their ACCUMULATION. This cap is the root fix for all NEW rows.
 *
 * WHY 3600 (1h): the advertised seller anchor is `X402_MAX_TIMEOUT_SECONDS = 300`
 * (a protocol-compliant buyer sets `validBefore ≈ now + 300`); a legit window only
 * needs to cover a single in-request settle attempt (seconds), not the reconciler
 * lifecycle. 3600 is 12× the advertised anchor — huge headroom for clock skew and
 * non-canonical clients — while sitting materially below the 6h `pending_overdue`
 * alarm threshold, so a max-cap abuse row (≤1h pending) can never re-cross it. The
 * asymmetry favors generous: false-rejecting a good real-USDC payment is the worst
 * outcome; an over-cap row's only cost is staying `pending` ~1h before terminalizing.
 * This is an ANTI-ABUSE bound, NOT a protocol-conformance gate. See
 * `docs/tech-debt/v-n1-validbefore-cap-handoff-2026-06-14.md` §2.
 *
 * DC-07: defined ONCE here and imported at both verifiers — never copied.
 */
export const MAX_VALIDBEFORE_WINDOW_SECONDS = 3600

/** x402 v2 extensions — typed keys for the `extensions` field */
export type X402Extension =
  | 'offer-and-receipt'       // Cryptographic receipt from facilitator
  | 'payment-identifier'      // Idempotency key for dedup

/** x402 PaymentRequired response (server -> client, HTTP 402) */
export interface X402PaymentRequired {
  x402Version: number
  error?: string
  resource?: {
    url: string
    description?: string
    mimeType?: string
  }
  accepts: Array<{
    scheme: X402Scheme
    network: string
    amount: string          // in token base units (6 decimals for USDC)
    asset: string           // token contract address
    payTo: string           // recipient wallet
    maxTimeoutSeconds?: number
    extra?: Record<string, unknown>
  }>
  /** v2 extensions support */
  extensions?: Record<X402Extension, unknown>
}

/** x402 exact scheme payment payload (EIP-3009 transferWithAuthorization) */
export interface X402ExactPayload {
  x402Version: number
  scheme: 'exact'
  network: X402Network
  payload: {
    signature: `0x${string}`
    authorization: {
      from: `0x${string}`
      to: `0x${string}`
      value: string
      validAfter: string
      validBefore: string
      nonce: `0x${string}`
    }
  }
}

/** x402 upto scheme payment payload (Permit2 permitWitnessTransferFrom) */
export interface X402UptoPayload {
  x402Version: number
  scheme: 'upto'
  network: X402Network
  payload: {
    signature: `0x${string}`
    permit: {
      permitted: {
        token: `0x${string}`
        amount: string
      }
      nonce: string
      deadline: string
    }
    witness: {
      recipient: `0x${string}`
      amount: string
    }
    transferDetails: {
      to: `0x${string}`
      requestedAmount: string
    }
  }
}

export type X402PaymentPayload = X402ExactPayload | X402UptoPayload

/** Gas estimation for a settlement transaction */
export interface X402GasEstimate {
  estimatedGasUnits: string
  gasPriceGwei: string
  estimatedCostWei: string
  estimatedCostUsd: string
}

/** x402 verification error codes for structured error reporting */
export type X402VerifyErrorCode =
  | 'UNSUPPORTED_NETWORK'
  | 'AUTHORIZATION_NOT_YET_VALID'
  | 'AUTHORIZATION_EXPIRED'
  | 'NONCE_ALREADY_USED'
  | 'INSUFFICIENT_BALANCE'
  | 'PERMIT_DEADLINE_EXPIRED'
  | 'WITNESS_EXCEEDS_PERMITTED'
  | 'ALLOWANCE_TOO_LOW'
  | 'SIGNATURE_INVALID'
  | 'AUTHORIZATION_VALIDBEFORE_TOO_FAR' // validBefore > now + MAX_VALIDBEFORE_WINDOW_SECONDS (V-N1 cap)
  | 'VERIFICATION_RPC_ERROR'

/** Facilitator verify response */
export interface X402VerifyResponse {
  isValid: boolean
  invalidReason?: string
  errorCode?: X402VerifyErrorCode
  payer?: `0x${string}`
  network?: X402Network
  gasEstimate?: X402GasEstimate
}

/** x402 settlement error codes for structured error reporting */
export type X402SettleErrorCode =
  | 'UNSUPPORTED_NETWORK'
  | 'SETTLEMENT_TX_REVERTED'
  | 'SETTLEMENT_TX_TIMEOUT'
  | 'GAS_WALLET_INSUFFICIENT'
  | 'SETTLEMENT_RPC_ERROR'

/** Facilitator settle response */
export interface X402SettleResponse {
  success: boolean
  txHash?: `0x${string}`
  network?: X402Network
  errorReason?: string
  errorCode?: X402SettleErrorCode
  gasEstimate?: X402GasEstimate
}

/** Idempotency cache entry for settled payments */
export interface X402IdempotencyEntry {
  payloadHash: string
  result: X402SettleResponse
  receipt?: X402Receipt
  settledAt: number
}

/** Cryptographic receipt (offer-and-receipt extension) */
export interface X402Receipt {
  txHash: `0x${string}`
  network: X402Network
  payer: `0x${string}`
  payee: `0x${string}`
  amount: string
  timestamp: number
  facilitatorSignature: `0x${string}`
}

/** Receipt validation result */
export interface X402ReceiptValidation {
  isValid: boolean
  invalidReason?: string
  recoveredAddress?: `0x${string}`
  receipt?: X402Receipt
}

/** Supported schemes info for GET /api/x402/supported */
export interface X402SupportedInfo {
  facilitator: string
  version: string
  schemes: Array<{
    scheme: X402Scheme
    description: string
    status: 'active' | 'beta' | 'planned'
  }>
  networks: Array<{
    network: string
    asset: string
    assetSymbol: string
    assetDecimals: number
  }>
  extensions: X402Extension[]
}
