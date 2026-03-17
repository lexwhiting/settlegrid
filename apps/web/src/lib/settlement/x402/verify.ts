/**
 * x402 Payment Verification Engine
 *
 * Verifies EIP-3009 (exact scheme) and Permit2 (upto scheme) payment proofs
 * by checking on-chain state via viem.
 */

import { createPublicClient, http, type Address } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'
import type { X402ExactPayload, X402UptoPayload, X402VerifyResponse, X402Network } from './types'
import { USDC_ADDRESSES } from './types'
import { logger } from '@/lib/logger'

// EIP-3009 ABI subset for verification
const EIP3009_ABI = [
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

/** Get the viem chain config for a CAIP-2 network ID */
function getChain(network: X402Network) {
  switch (network) {
    case 'eip155:8453': return base
    case 'eip155:84532': return baseSepolia
    case 'eip155:1': return mainnet
    default: throw new Error(`Unsupported network: ${network}`)
  }
}

/** Get a public client for the given network */
function getPublicClient(network: X402Network) {
  const chain = getChain(network)
  return createPublicClient({
    chain,
    transport: http(),
  })
}

/**
 * Verify an x402 exact scheme payment (EIP-3009).
 *
 * Checks:
 * 1. Time validity (validAfter <= now <= validBefore)
 * 2. Authorization nonce not yet used
 * 3. Payer has sufficient USDC balance
 */
export async function verifyExactPayment(
  payload: X402ExactPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const { authorization } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { isValid: false, invalidReason: `Unsupported network: ${network}` }
    }

    const client = getPublicClient(network)
    const now = Math.floor(Date.now() / 1000)

    // Check time validity
    const validAfter = parseInt(authorization.validAfter, 10)
    const validBefore = parseInt(authorization.validBefore, 10)

    if (now < validAfter) {
      return { isValid: false, invalidReason: 'Authorization not yet valid', payer: authorization.from, network }
    }
    if (now > validBefore) {
      return { isValid: false, invalidReason: 'Authorization expired', payer: authorization.from, network }
    }

    // Check nonce not used
    const nonceUsed = await client.readContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'authorizationState',
      args: [authorization.from as Address, authorization.nonce],
    })

    if (nonceUsed) {
      return { isValid: false, invalidReason: 'Authorization nonce already used', payer: authorization.from, network }
    }

    // Check balance
    const balance = await client.readContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'balanceOf',
      args: [authorization.from as Address],
    })

    const requiredAmount = BigInt(authorization.value)
    if (balance < requiredAmount) {
      return {
        isValid: false,
        invalidReason: `Insufficient USDC balance: has ${balance}, needs ${requiredAmount}`,
        payer: authorization.from,
        network,
      }
    }

    return { isValid: true, payer: authorization.from, network }
  } catch (error) {
    logger.error('x402.verify_exact_failed', { network: payload.network }, error as Error)
    return { isValid: false, invalidReason: `Verification error: ${(error as Error).message}` }
  }
}

/**
 * Verify an x402 upto scheme payment (Permit2).
 *
 * Checks:
 * 1. Deadline not expired
 * 2. Witness amount <= permitted amount
 */
export async function verifyUptoPayment(
  payload: X402UptoPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { isValid: false, invalidReason: `Unsupported network: ${network}` }
    }

    const now = Math.floor(Date.now() / 1000)

    // Check deadline
    const deadline = parseInt(p.permit.deadline, 10)
    if (now > deadline) {
      return { isValid: false, invalidReason: 'Permit deadline expired', network }
    }

    // Check witness amount <= permitted amount
    const permittedAmount = BigInt(p.permit.permitted.amount)
    const witnessAmount = BigInt(p.witness.amount)
    if (witnessAmount > permittedAmount) {
      return {
        isValid: false,
        invalidReason: `Witness amount (${witnessAmount}) exceeds permitted amount (${permittedAmount})`,
        network,
      }
    }

    return { isValid: true, network }
  } catch (error) {
    logger.error('x402.verify_upto_failed', { network: payload.network }, error as Error)
    return { isValid: false, invalidReason: `Verification error: ${(error as Error).message}` }
  }
}
