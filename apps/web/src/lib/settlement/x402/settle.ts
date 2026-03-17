/**
 * x402 On-Chain Settlement Engine
 *
 * Executes pre-signed payment authorizations on the blockchain.
 * SettleGrid's gas wallet pays transaction fees.
 */

import { createWalletClient, http, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import type { X402ExactPayload, X402SettleResponse, X402Network, X402Receipt } from './types'
import { USDC_ADDRESSES } from './types'
import { logger } from '@/lib/logger'

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
      throw new Error(`Settlement not supported on network: ${network}`)
  }
}

/**
 * Settle an x402 exact scheme payment by calling transferWithAuthorization on-chain.
 *
 * The pre-signed authorization is submitted to the USDC contract, which transfers
 * funds from the payer to the payee. SettleGrid's gas wallet pays the gas fee.
 */
export async function settleExactPayment(
  payload: X402ExactPayload
): Promise<X402SettleResponse> {
  try {
    const { network, payload: p } = payload
    const { signature, authorization } = p
    const usdcAddress = USDC_ADDRESSES[network]

    if (!usdcAddress) {
      return { success: false, errorReason: `Unsupported network: ${network}` }
    }

    // Split signature into v, r, s
    const sig = signature.slice(2) // remove 0x prefix
    const r = `0x${sig.slice(0, 64)}` as `0x${string}`
    const s = `0x${sig.slice(64, 128)}` as `0x${string}`
    const v = parseInt(sig.slice(128, 130), 16)

    const client = getWalletClient(network)

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
    })

    return { success: true, txHash, network }
  } catch (error) {
    logger.error('x402.settle_exact_failed', { network: payload.network }, error as Error)
    return { success: false, errorReason: (error as Error).message, network: payload.network }
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

  const receiptData = `${txHash}:${network}:${payer}:${payee}:${amount}:${timestamp}`
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
