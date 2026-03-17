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
