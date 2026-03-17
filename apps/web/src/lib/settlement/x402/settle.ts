/**
 * x402 On-Chain Settlement Engine
 *
 * Executes pre-signed payment authorizations on the blockchain.
 * SettleGrid's gas wallet pays transaction fees.
 *
 * Features:
 *   - Idempotency via Redis (SHA-256 payload hash as key)
 *   - Gas estimation in settlement response
 *   - Cryptographic receipts with facilitator signature
 *   - Receipt validation (signature recovery)
 */

import { createPublicClient, createWalletClient, http, type Address, verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import type {
  X402ExactPayload,
  X402SettleResponse,
  X402Network,
  X402Receipt,
  X402ReceiptValidation,
  X402IdempotencyEntry,
} from './types'
import { USDC_ADDRESSES } from './types'
import { estimateGas } from './verify'
import { logger } from '@/lib/logger'
import { getRedis, tryRedis } from '@/lib/redis'

// EIP-3009 TransferWithAuthorization ABI
const TRANSFER_WITH_AUTHORIZATION_ABI = [
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
] as const

/** Idempotency key TTL: 24 hours */
const IDEMPOTENCY_TTL_SECONDS = 86400

/** Redis key prefix for x402 idempotency entries */
function idempotencyKey(hash: string): string {
  return `x402:settle:${hash}`
}

/** Get gas wallet account from env */
function getGasWallet() {
  const privateKey = process.env.SETTLEGRID_GAS_WALLET_KEY
  if (!privateKey) throw new Error('SETTLEGRID_GAS_WALLET_KEY not configured')
  return privateKeyToAccount(privateKey as `0x${string}`)
}

/** Get wallet client for the given network */
function getWalletClient(network: X402Network) {
  const account = getGasWallet()
  switch (network) {
    case 'eip155:8453':
      return createWalletClient({ account, chain: base, transport: http() })
    case 'eip155:84532':
      return createWalletClient({ account, chain: baseSepolia, transport: http() })
    default:
      throw new Error(`Settlement not supported on network: ${network}. Only Base mainnet (eip155:8453) and Base Sepolia (eip155:84532) are supported.`)
  }
}

/** Get a public client for receipt validation */
function getPublicClient(network: X402Network) {
  switch (network) {
    case 'eip155:8453':
      return createPublicClient({ chain: base, transport: http() })
    case 'eip155:84532':
      return createPublicClient({ chain: baseSepolia, transport: http() })
    default:
      throw new Error(`Unsupported network for validation: ${network}`)
  }
}

/**
 * Compute a SHA-256 hash of the payment payload for idempotency deduplication.
 * The hash covers: network + from + to + value + nonce + signature — all the
 * fields that uniquely identify a payment attempt.
 */
export async function computePayloadHash(payload: X402ExactPayload): Promise<string> {
  const { network, payload: p } = payload
  const { authorization, signature } = p
  const input = `${network}:${authorization.from}:${authorization.to}:${authorization.value}:${authorization.nonce}:${signature}`
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Check Redis for an existing idempotency entry.
 * Returns the cached result if found, null otherwise.
 */
export async function checkIdempotency(payloadHash: string): Promise<X402IdempotencyEntry | null> {
  const redis = getRedis()
  const cached = await tryRedis(() => redis.get<X402IdempotencyEntry>(idempotencyKey(payloadHash)))
  return cached ?? null
}

/**
 * Store a settlement result in Redis for idempotency.
 */
export async function storeIdempotency(
  payloadHash: string,
  result: X402SettleResponse,
  receipt?: X402Receipt
): Promise<void> {
  const redis = getRedis()
  const entry: X402IdempotencyEntry = {
    payloadHash,
    result,
    receipt,
    settledAt: Math.floor(Date.now() / 1000),
  }
  await tryRedis(() => redis.set(idempotencyKey(payloadHash), entry, { ex: IDEMPOTENCY_TTL_SECONDS }))
}

/**
 * Settle an x402 exact scheme payment by calling transferWithAuthorization on-chain.
 *
 * The pre-signed authorization is submitted to the USDC contract, which transfers
 * funds from the payer to the payee. SettleGrid's gas wallet pays the gas fee.
 *
 * Idempotency: If the same payload (identified by SHA-256 hash) has already been
 * settled, the cached result is returned without re-submitting to the chain.
 */
export async function settleExactPayment(
  payload: X402ExactPayload
): Promise<X402SettleResponse> {
  try {
    const { network, payload: p } = payload
    const { signature, authorization } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return {
        success: false,
        errorReason: `Unsupported network: ${network}. Settlement is only supported on Base mainnet (eip155:8453) and Base Sepolia (eip155:84532).`,
        errorCode: 'UNSUPPORTED_NETWORK',
      }
    }

    // Check idempotency — return cached result if this payload was already settled
    const payloadHash = await computePayloadHash(payload)
    const cached = await checkIdempotency(payloadHash)
    if (cached) {
      logger.info('x402.settle_idempotent_hit', {
        payloadHash,
        txHash: cached.result.txHash,
        network,
      })
      return cached.result
    }

    // Split signature into v, r, s
    const sig = signature.slice(2) // remove 0x prefix
    if (sig.length !== 130) {
      return {
        success: false,
        errorReason: `Invalid signature length: expected 130 hex characters, got ${sig.length}. Signature must be 65 bytes (r: 32 bytes, s: 32 bytes, v: 1 byte).`,
        errorCode: 'SETTLEMENT_TX_REVERTED',
        network,
      }
    }
    const r = `0x${sig.slice(0, 64)}` as `0x${string}`
    const s = `0x${sig.slice(64, 128)}` as `0x${string}`
    const v = parseInt(sig.slice(128, 130), 16)

    const client = getWalletClient(network)

    // Estimate gas before submitting
    let gasEstimate
    try {
      gasEstimate = await estimateGas(network, usdcAddress, authorization, signature)
    } catch {
      // Non-fatal — proceed without estimate
    }

    const txHash = await client.writeContract({
      address: usdcAddress,
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from as Address,
        authorization.to as Address,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce,
        v,
        r,
        s,
      ],
    })

    logger.info('x402.settle_exact_success', {
      txHash,
      network,
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
      payloadHash,
    })

    const result: X402SettleResponse = { success: true, txHash, network, gasEstimate }

    // Store in idempotency cache
    await storeIdempotency(payloadHash, result)

    return result
  } catch (error) {
    const errMsg = (error as Error).message
    let errorCode: X402SettleResponse['errorCode'] = 'SETTLEMENT_RPC_ERROR'

    if (errMsg.includes('insufficient funds') || errMsg.includes('gas')) {
      errorCode = 'GAS_WALLET_INSUFFICIENT'
    } else if (errMsg.includes('revert') || errMsg.includes('execution reverted')) {
      errorCode = 'SETTLEMENT_TX_REVERTED'
    } else if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
      errorCode = 'SETTLEMENT_TX_TIMEOUT'
    }

    logger.error('x402.settle_exact_failed', {
      network: payload.network,
      errorCode,
    }, error as Error)

    return {
      success: false,
      errorReason: `Settlement failed on ${payload.network}: ${errMsg}`,
      errorCode,
      network: payload.network,
    }
  }
}

/**
 * Generate a cryptographic receipt for a settled x402 payment.
 * SettleGrid signs the receipt with its gas wallet for non-repudiation.
 */
export async function generateReceipt(
  txHash: `0x${string}`,
  network: X402Network,
  payer: `0x${string}`,
  payee: `0x${string}`,
  amount: string
): Promise<X402Receipt> {
  const account = getGasWallet()
  const timestamp = Math.floor(Date.now() / 1000)

  const receiptData = buildReceiptMessage(txHash, network, payer, payee, amount, timestamp)
  const facilitatorSignature = await account.signMessage({
    message: receiptData,
  })

  return {
    txHash,
    network,
    payer,
    payee,
    amount,
    timestamp,
    facilitatorSignature: facilitatorSignature as `0x${string}`,
  }
}

/**
 * Build the canonical receipt message string for signing/validation.
 * This MUST match exactly between generateReceipt and validateReceipt.
 */
export function buildReceiptMessage(
  txHash: string,
  network: string,
  payer: string,
  payee: string,
  amount: string,
  timestamp: number
): string {
  return `${txHash}:${network}:${payer}:${payee}:${amount}:${timestamp}`
}

/**
 * Validate an x402 receipt's facilitator signature.
 *
 * Recovers the signer address from the receipt signature and compares it
 * to SettleGrid's gas wallet address. This proves the receipt was generated
 * by SettleGrid and has not been tampered with.
 */
export async function validateReceipt(receipt: X402Receipt): Promise<X402ReceiptValidation> {
  try {
    const receiptData = buildReceiptMessage(
      receipt.txHash,
      receipt.network,
      receipt.payer,
      receipt.payee,
      receipt.amount,
      receipt.timestamp
    )

    // Get the expected facilitator address
    const gasWallet = getGasWallet()
    const expectedAddress = gasWallet.address

    // Verify the signature was produced by the gas wallet
    const isValid = await verifyMessage({
      address: expectedAddress,
      message: receiptData,
      signature: receipt.facilitatorSignature,
    })

    if (!isValid) {
      return {
        isValid: false,
        invalidReason: `Receipt signature does not match facilitator address ${expectedAddress}. The receipt may have been tampered with or was not issued by SettleGrid.`,
        recoveredAddress: undefined,
        receipt,
      }
    }

    return {
      isValid: true,
      recoveredAddress: expectedAddress as `0x${string}`,
      receipt,
    }
  } catch (error) {
    return {
      isValid: false,
      invalidReason: `Receipt validation error: ${(error as Error).message}`,
      receipt,
    }
  }
}
