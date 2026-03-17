/**
 * x402 Payment Verification Engine
 *
 * Verifies EIP-3009 (exact scheme) and Permit2 (upto scheme) payment proofs
 * by checking on-chain state via viem.
 */

import { createPublicClient, http, type Address, formatGwei, formatEther } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'
import type {
  X402ExactPayload,
  X402UptoPayload,
  X402VerifyResponse,
  X402Network,
  X402GasEstimate,
} from './types'
import { USDC_ADDRESSES } from './types'
import { logger } from '@/lib/logger'

/**
 * Complete EIP-3009 / FiatTokenV2 ABI for USDC verification.
 *
 * Covers:
 *   - authorizationState: check if a nonce has been consumed
 *   - balanceOf: check payer balance
 *   - allowance: check spending allowance (for Permit2 flow)
 *   - transferWithAuthorization: the function we ultimately call on-chain
 *   - receiveWithAuthorization: alternate EIP-3009 receive variant
 *   - cancelAuthorization: allows payer to revoke an unused authorization
 *   - DOMAIN_SEPARATOR: EIP-712 domain separator for signature verification
 *   - nonces: EIP-2612 permit nonce (different from EIP-3009 nonces)
 *   - name / version / decimals: token metadata for validation
 */
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
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
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
  {
    name: 'receiveWithAuthorization',
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
  {
    name: 'cancelAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'authorizer', type: 'address' },
      { name: 'nonce', type: 'bytes32' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'version',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
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

/** Approximate ETH/USD price per network (used for gas cost display) */
const ETH_USD_PRICES: Record<string, number> = {
  'eip155:8453': 2500,    // Base (tracks ETH)
  'eip155:84532': 0,      // Testnet — free gas
  'eip155:1': 2500,       // Ethereum mainnet
}

/**
 * Estimate gas cost for a transferWithAuthorization call.
 *
 * Uses the public client to fetch gas price, and estimates gas units
 * for the EIP-3009 transfer (~75k gas on average).
 */
export async function estimateGas(
  network: X402Network,
  usdcAddress: `0x${string}`,
  authorization: X402ExactPayload['payload']['authorization'],
  signature: `0x${string}`
): Promise<X402GasEstimate> {
  const client = getPublicClient(network)

  // Split signature for gas estimation
  const sig = signature.slice(2)
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`
  const v = parseInt(sig.slice(128, 130), 16)

  let estimatedGas: bigint
  try {
    estimatedGas = await client.estimateGas({
      to: usdcAddress,
      data: encodeFunctionData(authorization, v, r, s),
    })
  } catch {
    // Fallback: EIP-3009 transferWithAuthorization typically uses ~75k gas
    estimatedGas = BigInt(75000)
  }

  const gasPrice = await client.getGasPrice()
  const estimatedCostWei = estimatedGas * gasPrice
  const ethPrice = ETH_USD_PRICES[network] ?? 2500
  const costEth = Number(formatEther(estimatedCostWei))
  const costUsd = costEth * ethPrice

  return {
    estimatedGasUnits: estimatedGas.toString(),
    gasPriceGwei: formatGwei(gasPrice),
    estimatedCostWei: estimatedCostWei.toString(),
    estimatedCostUsd: costUsd.toFixed(6),
  }
}

/** Manually encode transferWithAuthorization calldata for gas estimation */
function encodeFunctionData(
  auth: X402ExactPayload['payload']['authorization'],
  v: number,
  r: `0x${string}`,
  s: `0x${string}`
): `0x${string}` {
  // transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)
  // selector: 0xe3ee160e
  const selector = '0xe3ee160e'
  const fromPadded = auth.from.slice(2).toLowerCase().padStart(64, '0')
  const toPadded = auth.to.slice(2).toLowerCase().padStart(64, '0')
  const valuePadded = BigInt(auth.value).toString(16).padStart(64, '0')
  const validAfterPadded = BigInt(auth.validAfter).toString(16).padStart(64, '0')
  const validBeforePadded = BigInt(auth.validBefore).toString(16).padStart(64, '0')
  const noncePadded = auth.nonce.slice(2).padStart(64, '0')
  const vPadded = v.toString(16).padStart(64, '0')
  const rPadded = r.slice(2).padStart(64, '0')
  const sPadded = s.slice(2).padStart(64, '0')

  return `${selector}${fromPadded}${toPadded}${valuePadded}${validAfterPadded}${validBeforePadded}${noncePadded}${vPadded}${rPadded}${sPadded}` as `0x${string}`
}

/**
 * Verify an x402 exact scheme payment (EIP-3009).
 *
 * Checks:
 * 1. Network is supported with a known USDC address
 * 2. Signature format is valid (65 bytes = 130 hex chars)
 * 3. Time validity (validAfter <= now <= validBefore)
 * 4. Authorization nonce not yet used
 * 5. Payer has sufficient USDC balance
 * 6. Gas estimation for the settlement transaction
 */
export async function verifyExactPayment(
  payload: X402ExactPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const { authorization, signature } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${network}. Supported: eip155:8453 (Base), eip155:84532 (Base Sepolia), eip155:1 (Ethereum).`,
        errorCode: 'UNSUPPORTED_NETWORK',
      }
    }

    // Validate signature format (65 bytes = 0x + 130 hex chars)
    const sigHex = signature.slice(2)
    if (sigHex.length !== 130 || !/^[0-9a-fA-F]+$/.test(sigHex)) {
      return {
        isValid: false,
        invalidReason: `Invalid signature format: expected 65 bytes (130 hex characters after 0x prefix), got ${sigHex.length} characters.`,
        errorCode: 'SIGNATURE_INVALID',
        payer: authorization.from,
        network,
      }
    }

    const client = getPublicClient(network)
    const now = Math.floor(Date.now() / 1000)

    // Check time validity
    const validAfter = parseInt(authorization.validAfter, 10)
    const validBefore = parseInt(authorization.validBefore, 10)

    if (now < validAfter) {
      const waitSeconds = validAfter - now
      return {
        isValid: false,
        invalidReason: `Authorization not yet valid: becomes valid in ${waitSeconds}s (validAfter=${validAfter}, now=${now}).`,
        errorCode: 'AUTHORIZATION_NOT_YET_VALID',
        payer: authorization.from,
        network,
      }
    }
    if (now > validBefore) {
      const expiredAgo = now - validBefore
      return {
        isValid: false,
        invalidReason: `Authorization expired ${expiredAgo}s ago (validBefore=${validBefore}, now=${now}).`,
        errorCode: 'AUTHORIZATION_EXPIRED',
        payer: authorization.from,
        network,
      }
    }

    // Check nonce not used
    const nonceUsed = await client.readContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'authorizationState',
      args: [authorization.from as Address, authorization.nonce],
    })

    if (nonceUsed) {
      return {
        isValid: false,
        invalidReason: `Authorization nonce ${authorization.nonce} has already been used by ${authorization.from}. Each EIP-3009 nonce can only be used once.`,
        errorCode: 'NONCE_ALREADY_USED',
        payer: authorization.from,
        network,
      }
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
      const shortfall = requiredAmount - balance
      const balanceUsdc = Number(balance) / 1e6
      const requiredUsdc = Number(requiredAmount) / 1e6
      return {
        isValid: false,
        invalidReason: `Insufficient USDC balance: has ${balanceUsdc.toFixed(6)} USDC (${balance} units), needs ${requiredUsdc.toFixed(6)} USDC (${requiredAmount} units). Short by ${shortfall} units.`,
        errorCode: 'INSUFFICIENT_BALANCE',
        payer: authorization.from,
        network,
      }
    }

    // Estimate gas cost for the settlement
    let gasEstimate: X402GasEstimate | undefined
    try {
      gasEstimate = await estimateGas(network, usdcAddress, authorization, signature)
    } catch (gasError) {
      logger.warn('x402.gas_estimate_failed', { network, error: (gasError as Error).message })
      // Gas estimation failure is non-fatal — payment is still valid
    }

    return { isValid: true, payer: authorization.from, network, gasEstimate }
  } catch (error) {
    const errMsg = (error as Error).message
    logger.error('x402.verify_exact_failed', { network: payload.network }, error as Error)
    return {
      isValid: false,
      invalidReason: `Verification failed due to RPC error on ${payload.network}: ${errMsg}`,
      errorCode: 'VERIFICATION_RPC_ERROR',
    }
  }
}

/**
 * Verify an x402 upto scheme payment (Permit2).
 *
 * Checks:
 * 1. Network is supported with a known USDC address
 * 2. Deadline not expired
 * 3. Witness amount <= permitted amount
 * 4. Token address in permit matches USDC on the target network
 */
export async function verifyUptoPayment(
  payload: X402UptoPayload
): Promise<X402VerifyResponse> {
  try {
    const { network, payload: p } = payload
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return {
        isValid: false,
        invalidReason: `Unsupported network: ${network}. Supported: eip155:8453 (Base), eip155:84532 (Base Sepolia), eip155:1 (Ethereum).`,
        errorCode: 'UNSUPPORTED_NETWORK',
      }
    }

    const now = Math.floor(Date.now() / 1000)

    // Check deadline
    const deadline = parseInt(p.permit.deadline, 10)
    if (now > deadline) {
      const expiredAgo = now - deadline
      return {
        isValid: false,
        invalidReason: `Permit deadline expired ${expiredAgo}s ago (deadline=${deadline}, now=${now}).`,
        errorCode: 'PERMIT_DEADLINE_EXPIRED',
        network,
      }
    }

    // Check witness amount <= permitted amount
    const permittedAmount = BigInt(p.permit.permitted.amount)
    const witnessAmount = BigInt(p.witness.amount)
    if (witnessAmount > permittedAmount) {
      const excessUsdc = Number(witnessAmount - permittedAmount) / 1e6
      return {
        isValid: false,
        invalidReason: `Witness amount (${witnessAmount}) exceeds permitted amount (${permittedAmount}) by ${excessUsdc.toFixed(6)} USDC. The witness amount must be <= the Permit2 permitted amount.`,
        errorCode: 'WITNESS_EXCEEDS_PERMITTED',
        network,
      }
    }

    // Verify the token in the permit matches USDC on this network
    const permitToken = p.permit.permitted.token.toLowerCase()
    const expectedToken = usdcAddress.toLowerCase()
    if (permitToken !== expectedToken) {
      return {
        isValid: false,
        invalidReason: `Permit token ${p.permit.permitted.token} does not match USDC address ${usdcAddress} on ${network}.`,
        errorCode: 'UNSUPPORTED_NETWORK',
        network,
      }
    }

    return { isValid: true, network }
  } catch (error) {
    const errMsg = (error as Error).message
    logger.error('x402.verify_upto_failed', { network: payload.network }, error as Error)
    return {
      isValid: false,
      invalidReason: `Verification failed due to error on ${payload.network}: ${errMsg}`,
      errorCode: 'VERIFICATION_RPC_ERROR',
    }
  }
}

/** Exported for testing — the complete EIP-3009 ABI */
export { EIP3009_ABI }
