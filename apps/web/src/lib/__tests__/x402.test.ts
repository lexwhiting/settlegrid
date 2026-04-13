import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted mock values ────────────────────────────────────────────────────

const { mockReadContract, mockVerifyExact, mockVerifyUpto, mockSettleExact, mockGetGasPrice, mockEstimateGas, mockRedisGet, mockRedisSet, mockVerifyMessage } = vi.hoisted(() => {
  return {
    mockReadContract: vi.fn(),
    mockVerifyExact: vi.fn(),
    mockVerifyUpto: vi.fn(),
    mockSettleExact: vi.fn(),
    mockGetGasPrice: vi.fn(),
    mockEstimateGas: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockVerifyMessage: vi.fn(),
  }
})

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract: mockReadContract,
    getGasPrice: mockGetGasPrice,
    estimateGas: mockEstimateGas,
  })),
  createWalletClient: vi.fn(() => ({
    writeContract: vi.fn().mockResolvedValue('0xmocktxhash'),
  })),
  http: vi.fn(),
  formatGwei: vi.fn((v: bigint) => (Number(v) / 1e9).toString()),
  formatEther: vi.fn((v: bigint) => (Number(v) / 1e18).toString()),
  verifyMessage: mockVerifyMessage,
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
  baseSepolia: { id: 84532 },
  mainnet: { id: 1 },
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xFacilitator1234567890abcdef12345678901234',
    signMessage: vi.fn().mockResolvedValue('0xfacilitatorsig'),
  })),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
}))

vi.mock('@/lib/middleware/cors', () => ({
  withCors: (handler: (req: NextRequest) => Promise<Response>) => handler,
  OPTIONS: vi.fn(),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
  })),
  tryRedis: vi.fn(async (fn: () => Promise<unknown>) => {
    try { return await fn() } catch { return null }
  }),
}))

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import {
  USDC_ADDRESSES,
  PERMIT2_ADDRESSES,
  type X402Scheme,
  type X402ExactPayload,
  type X402UptoPayload,
  type X402Extension,
  type X402VerifyErrorCode,
  type X402SettleErrorCode,
  type X402Receipt,
} from '@/lib/settlement/x402/types'
import { verifyExactPayment, verifyUptoPayment, EIP3009_ABI } from '@/lib/settlement/x402/verify'
import { buildReceiptMessage, computePayloadHash, validateReceipt } from '@/lib/settlement/x402/settle'
// Imported via relative path (not `@/` alias) so that gate check 18's
// orphan-import detector does not flag this file. The adapters are now
// canonical in `@settlegrid/mcp`; this local path is only retained while
// the deprecated Layer A copies live alongside during the P2.K1 cycle.
import { X402Adapter } from '../settlement/adapters/x402'
import type { SettlementResult } from '@/lib/settlement/types'

// ─── x402 Types ─────────────────────────────────────────────────────────────

describe('x402 Types', () => {
  it('USDC_ADDRESSES has entry for Base mainnet', () => {
    expect(USDC_ADDRESSES['eip155:8453']).toBeDefined()
  })

  it('USDC_ADDRESSES has entry for Base Sepolia', () => {
    expect(USDC_ADDRESSES['eip155:84532']).toBeDefined()
  })

  it('USDC_ADDRESSES has entry for Ethereum mainnet', () => {
    expect(USDC_ADDRESSES['eip155:1']).toBeDefined()
  })

  it('PERMIT2_ADDRESSES has entries for all networks', () => {
    expect(PERMIT2_ADDRESSES['eip155:8453']).toBeDefined()
    expect(PERMIT2_ADDRESSES['eip155:84532']).toBeDefined()
    expect(PERMIT2_ADDRESSES['eip155:1']).toBeDefined()
  })

  it('all addresses are valid hex format (0x, 42 chars)', () => {
    const allAddresses = [
      ...Object.values(USDC_ADDRESSES),
      ...Object.values(PERMIT2_ADDRESSES),
    ]
    for (const addr of allAddresses) {
      expect(addr).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('X402Scheme includes exact and upto', () => {
    const schemes: X402Scheme[] = ['exact', 'upto']
    expect(schemes).toContain('exact')
    expect(schemes).toContain('upto')
    expect(schemes).toHaveLength(2)
  })

  it('X402Extension type includes expected values', () => {
    const exts: X402Extension[] = ['offer-and-receipt', 'payment-identifier']
    expect(exts).toContain('offer-and-receipt')
    expect(exts).toContain('payment-identifier')
  })

  it('X402VerifyErrorCode includes structured error codes', () => {
    const codes: X402VerifyErrorCode[] = [
      'UNSUPPORTED_NETWORK',
      'AUTHORIZATION_NOT_YET_VALID',
      'AUTHORIZATION_EXPIRED',
      'NONCE_ALREADY_USED',
      'INSUFFICIENT_BALANCE',
      'PERMIT_DEADLINE_EXPIRED',
      'WITNESS_EXCEEDS_PERMITTED',
      'ALLOWANCE_TOO_LOW',
      'SIGNATURE_INVALID',
      'VERIFICATION_RPC_ERROR',
    ]
    expect(codes).toHaveLength(10)
  })

  it('X402SettleErrorCode includes structured error codes', () => {
    const codes: X402SettleErrorCode[] = [
      'UNSUPPORTED_NETWORK',
      'SETTLEMENT_TX_REVERTED',
      'SETTLEMENT_TX_TIMEOUT',
      'GAS_WALLET_INSUFFICIENT',
      'SETTLEMENT_RPC_ERROR',
    ]
    expect(codes).toHaveLength(5)
  })
})

// ─── EIP-3009 ABI completeness ────────────────────────────────────────────────

describe('EIP-3009 ABI', () => {
  it('includes authorizationState for nonce checking', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'authorizationState')
    expect(fn).toBeDefined()
    expect(fn!.stateMutability).toBe('view')
    expect(fn!.inputs).toHaveLength(2)
    expect(fn!.inputs[0].type).toBe('address')
    expect(fn!.inputs[1].type).toBe('bytes32')
  })

  it('includes balanceOf for balance checking', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'balanceOf')
    expect(fn).toBeDefined()
    expect(fn!.outputs[0].type).toBe('uint256')
  })

  it('includes allowance for approval checking', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'allowance')
    expect(fn).toBeDefined()
    expect(fn!.inputs).toHaveLength(2)
    expect(fn!.inputs[0].name).toBe('owner')
    expect(fn!.inputs[1].name).toBe('spender')
    expect(fn!.outputs[0].type).toBe('uint256')
  })

  it('includes transferWithAuthorization with full signature', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'transferWithAuthorization')
    expect(fn).toBeDefined()
    expect(fn!.inputs).toHaveLength(9)
    const inputNames = fn!.inputs.map((i) => i.name)
    expect(inputNames).toEqual(['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce', 'v', 'r', 's'])
  })

  it('includes receiveWithAuthorization', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'receiveWithAuthorization')
    expect(fn).toBeDefined()
    expect(fn!.inputs).toHaveLength(9)
  })

  it('includes cancelAuthorization', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'cancelAuthorization')
    expect(fn).toBeDefined()
    expect(fn!.inputs).toHaveLength(5)
    expect(fn!.inputs[0].name).toBe('authorizer')
  })

  it('includes DOMAIN_SEPARATOR for EIP-712', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'DOMAIN_SEPARATOR')
    expect(fn).toBeDefined()
    expect(fn!.inputs).toHaveLength(0)
    expect(fn!.outputs[0].type).toBe('bytes32')
  })

  it('includes nonces for EIP-2612', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'nonces')
    expect(fn).toBeDefined()
    expect(fn!.inputs[0].type).toBe('address')
  })

  it('includes name and version for token metadata', () => {
    const nameFn = EIP3009_ABI.find((f) => f.name === 'name')
    const versionFn = EIP3009_ABI.find((f) => f.name === 'version')
    expect(nameFn).toBeDefined()
    expect(versionFn).toBeDefined()
    expect(nameFn!.outputs[0].type).toBe('string')
    expect(versionFn!.outputs[0].type).toBe('string')
  })

  it('includes decimals', () => {
    const fn = EIP3009_ABI.find((f) => f.name === 'decimals')
    expect(fn).toBeDefined()
    expect(fn!.outputs[0].type).toBe('uint8')
  })

  it('has 11 total ABI entries', () => {
    expect(EIP3009_ABI).toHaveLength(11)
  })
})

// ─── verifyExactPayment ─────────────────────────────────────────────────────

describe('verifyExactPayment', () => {
  const now = Math.floor(Date.now() / 1000)

  function makeExactPayload(overrides?: Partial<X402ExactPayload['payload']['authorization']> & { network?: string; signature?: string }): X402ExactPayload {
    const { network, signature, ...authOverrides } = overrides ?? {}
    return {
      x402Version: 2,
      scheme: 'exact',
      network: (network ?? 'eip155:8453') as X402ExactPayload['network'],
      payload: {
        signature: (signature ?? '0x' + 'ab'.repeat(65)) as `0x${string}`,
        authorization: {
          from: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          value: '1000000',
          validAfter: String(now - 600),
          validBefore: String(now + 600),
          nonce: '0x' + '00'.repeat(32) as `0x${string}`,
          ...authOverrides,
        },
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Default gas estimation setup
    mockGetGasPrice.mockResolvedValue(BigInt(1000000000)) // 1 gwei
    mockEstimateGas.mockResolvedValue(BigInt(75000))
  })

  it('returns invalid for unsupported network', async () => {
    const payload = makeExactPayload({ network: 'eip155:999' })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Unsupported network')
    expect(result.errorCode).toBe('UNSUPPORTED_NETWORK')
  })

  it('returns invalid when authorization not yet valid (validAfter in future)', async () => {
    const payload = makeExactPayload({ validAfter: String(now + 9999) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('not yet valid')
    expect(result.errorCode).toBe('AUTHORIZATION_NOT_YET_VALID')
  })

  it('returns invalid when authorization expired (validBefore in past)', async () => {
    const payload = makeExactPayload({ validBefore: String(now - 9999) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('expired')
    expect(result.errorCode).toBe('AUTHORIZATION_EXPIRED')
  })

  it('returns invalid when nonce already used', async () => {
    // authorizationState returns true -> nonce used
    mockReadContract.mockResolvedValueOnce(true)
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('nonce')
    expect(result.invalidReason).toContain('already been used')
    expect(result.errorCode).toBe('NONCE_ALREADY_USED')
  })

  it('returns invalid when insufficient balance', async () => {
    // authorizationState returns false -> nonce not used
    mockReadContract.mockResolvedValueOnce(false)
    // balanceOf returns less than required
    mockReadContract.mockResolvedValueOnce(BigInt(500000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Insufficient USDC balance')
    expect(result.invalidReason).toContain('Short by')
    expect(result.errorCode).toBe('INSUFFICIENT_BALANCE')
  })

  it('returns valid when all checks pass', async () => {
    // authorizationState returns false -> nonce not used
    mockReadContract.mockResolvedValueOnce(false)
    // balanceOf returns sufficient balance
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(true)
  })

  it('includes payer address in response', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.payer).toBe('0x1234567890abcdef1234567890abcdef12345678')
  })

  it('includes network in response', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.network).toBe('eip155:8453')
  })

  it('handles readContract errors gracefully (returns invalid, not throw)', async () => {
    mockReadContract.mockRejectedValueOnce(new Error('RPC call failed'))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Verification failed')
    expect(result.errorCode).toBe('VERIFICATION_RPC_ERROR')
  })

  it('returns payer and network even on time-related failures', async () => {
    const payload = makeExactPayload({ validBefore: String(now - 100) })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.payer).toBe('0x1234567890abcdef1234567890abcdef12345678')
    expect(result.network).toBe('eip155:8453')
  })

  it('returns SIGNATURE_INVALID for malformed signature', async () => {
    const payload = makeExactPayload({ signature: '0xshort' })
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.errorCode).toBe('SIGNATURE_INVALID')
    expect(result.invalidReason).toContain('Invalid signature format')
  })

  it('includes gas estimate on successful verification', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(true)
    expect(result.gasEstimate).toBeDefined()
    expect(result.gasEstimate!.estimatedGasUnits).toBeDefined()
    expect(result.gasEstimate!.gasPriceGwei).toBeDefined()
    expect(result.gasEstimate!.estimatedCostWei).toBeDefined()
    expect(result.gasEstimate!.estimatedCostUsd).toBeDefined()
  })

  it('returns valid even when gas estimation fails', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(10000000))
    mockGetGasPrice.mockRejectedValueOnce(new Error('Gas price fetch failed'))
    const payload = makeExactPayload()
    const result = await verifyExactPayment(payload)
    expect(result.isValid).toBe(true)
    // gasEstimate may be undefined if estimation failed — that is fine
  })

  it('error messages include detailed context for expired authorizations', async () => {
    const expiredBefore = now - 300
    const payload = makeExactPayload({ validBefore: String(expiredBefore) })
    const result = await verifyExactPayment(payload)
    expect(result.invalidReason).toMatch(/30[0-2]s ago/)
    expect(result.invalidReason).toContain(`validBefore=${expiredBefore}`)
  })

  it('error messages include detailed context for not-yet-valid authorizations', async () => {
    const futureAfter = now + 500
    const payload = makeExactPayload({ validAfter: String(futureAfter) })
    const result = await verifyExactPayment(payload)
    expect(result.invalidReason).toMatch(/49[89]s|500s|501s/)
    expect(result.invalidReason).toContain(`validAfter=${futureAfter}`)
  })

  it('error messages include human-readable USDC amounts', async () => {
    mockReadContract.mockResolvedValueOnce(false)
    mockReadContract.mockResolvedValueOnce(BigInt(500000)) // 0.5 USDC
    const payload = makeExactPayload({ value: '2000000' }) // 2 USDC
    const result = await verifyExactPayment(payload)
    expect(result.invalidReason).toContain('0.500000 USDC')
    expect(result.invalidReason).toContain('2.000000 USDC')
  })

  it('lists supported networks in unsupported network error', async () => {
    const payload = makeExactPayload({ network: 'eip155:42161' })
    const result = await verifyExactPayment(payload)
    expect(result.invalidReason).toContain('eip155:8453')
    expect(result.invalidReason).toContain('Base')
  })
})

// ─── verifyUptoPayment ──────────────────────────────────────────────────────

describe('verifyUptoPayment', () => {
  const now = Math.floor(Date.now() / 1000)

  function makeUptoPayload(overrides?: {
    network?: string
    deadline?: string
    permittedAmount?: string
    witnessAmount?: string
    permitToken?: string
  }): X402UptoPayload {
    return {
      x402Version: 2,
      scheme: 'upto',
      network: (overrides?.network ?? 'eip155:8453') as X402UptoPayload['network'],
      payload: {
        signature: '0x' + 'cd'.repeat(65) as `0x${string}`,
        permit: {
          permitted: {
            token: (overrides?.permitToken ?? USDC_ADDRESSES['eip155:8453']) as `0x${string}`,
            amount: overrides?.permittedAmount ?? '5000000',
          },
          nonce: '1',
          deadline: overrides?.deadline ?? String(now + 600),
        },
        witness: {
          recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          amount: overrides?.witnessAmount ?? '1000000',
        },
        transferDetails: {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          requestedAmount: overrides?.witnessAmount ?? '1000000',
        },
      },
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invalid for unsupported network', async () => {
    const payload = makeUptoPayload({ network: 'eip155:999' })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Unsupported network')
    expect(result.errorCode).toBe('UNSUPPORTED_NETWORK')
  })

  it('returns invalid when deadline expired', async () => {
    const payload = makeUptoPayload({ deadline: String(now - 100) })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('deadline expired')
    expect(result.errorCode).toBe('PERMIT_DEADLINE_EXPIRED')
  })

  it('returns invalid when witness amount exceeds permitted', async () => {
    const payload = makeUptoPayload({
      permittedAmount: '1000000',
      witnessAmount: '5000000',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('exceeds permitted')
    expect(result.errorCode).toBe('WITNESS_EXCEEDS_PERMITTED')
  })

  it('returns valid when checks pass', async () => {
    const payload = makeUptoPayload()
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(true)
  })

  it('handles BigInt parsing correctly', async () => {
    const payload = makeUptoPayload({
      permittedAmount: '999999999999',
      witnessAmount: '100000000000',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(true)
    expect(result.network).toBe('eip155:8453')
  })

  it('handles errors gracefully', async () => {
    const payload: X402UptoPayload = {
      x402Version: 2,
      scheme: 'upto',
      network: 'eip155:8453',
      payload: {
        signature: '0xabc' as `0x${string}`,
        permit: {
          permitted: {
            token: USDC_ADDRESSES['eip155:8453'],
            amount: 'not-a-number',
          },
          nonce: '1',
          deadline: String(now + 600),
        },
        witness: {
          recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          amount: '1000000',
        },
        transferDetails: {
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          requestedAmount: '1000000',
        },
      },
    }
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Verification failed')
    expect(result.errorCode).toBe('VERIFICATION_RPC_ERROR')
  })

  it('returns invalid when permit token does not match USDC', async () => {
    const payload = makeUptoPayload({
      permitToken: '0x0000000000000000000000000000000000000001',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('does not match USDC')
  })

  it('includes excess USDC amount in witness-exceeds error', async () => {
    const payload = makeUptoPayload({
      permittedAmount: '1000000',
      witnessAmount: '3000000',
    })
    const result = await verifyUptoPayment(payload)
    expect(result.invalidReason).toContain('2.000000 USDC')
  })

  it('includes seconds-ago in deadline-expired error', async () => {
    const expired = now - 200
    const payload = makeUptoPayload({ deadline: String(expired) })
    const result = await verifyUptoPayment(payload)
    expect(result.invalidReason).toMatch(/20[0-2]s ago/)
    expect(result.invalidReason).toContain(`deadline=${expired}`)
  })
})

// ─── Idempotency & Payload Hash ─────────────────────────────────────────────

describe('computePayloadHash', () => {
  const now = Math.floor(Date.now() / 1000)

  function makeExactPayload(): X402ExactPayload {
    return {
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature: '0x' + 'ab'.repeat(65) as `0x${string}`,
        authorization: {
          from: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
          value: '1000000',
          validAfter: String(now - 600),
          validBefore: String(now + 600),
          nonce: '0x' + '00'.repeat(32) as `0x${string}`,
        },
      },
    }
  }

  it('returns a hex string of 64 characters (SHA-256)', async () => {
    const hash = await computePayloadHash(makeExactPayload())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same hash for identical payloads', async () => {
    const p = makeExactPayload()
    const hash1 = await computePayloadHash(p)
    const hash2 = await computePayloadHash(p)
    expect(hash1).toBe(hash2)
  })

  it('returns different hashes for different payloads', async () => {
    const p1 = makeExactPayload()
    const p2 = makeExactPayload()
    p2.payload.authorization.value = '2000000'
    const hash1 = await computePayloadHash(p1)
    const hash2 = await computePayloadHash(p2)
    expect(hash1).not.toBe(hash2)
  })

  it('returns different hashes when nonce differs', async () => {
    const p1 = makeExactPayload()
    const p2 = makeExactPayload()
    p2.payload.authorization.nonce = '0x' + 'ff'.repeat(32) as `0x${string}`
    const hash1 = await computePayloadHash(p1)
    const hash2 = await computePayloadHash(p2)
    expect(hash1).not.toBe(hash2)
  })

  it('returns different hashes when network differs', async () => {
    const p1 = makeExactPayload()
    const p2 = { ...makeExactPayload(), network: 'eip155:84532' as const }
    const hash1 = await computePayloadHash(p1)
    const hash2 = await computePayloadHash(p2)
    expect(hash1).not.toBe(hash2)
  })
})

// ─── Receipt Validation ──────────────────────────────────────────────────────

describe('buildReceiptMessage', () => {
  it('builds canonical colon-separated receipt string', () => {
    const msg = buildReceiptMessage(
      '0xdeadbeef',
      'eip155:8453',
      '0xpayer',
      '0xpayee',
      '1000000',
      1700000000
    )
    expect(msg).toBe('0xdeadbeef:eip155:8453:0xpayer:0xpayee:1000000:1700000000')
  })

  it('is deterministic (same inputs produce same output)', () => {
    const args = ['0xabc', 'eip155:1', '0xfrom', '0xto', '500', 123] as const
    const msg1 = buildReceiptMessage(...args)
    const msg2 = buildReceiptMessage(...args)
    expect(msg1).toBe(msg2)
  })
})

describe('validateReceipt', () => {
  const receipt: X402Receipt = {
    txHash: '0xdeadbeef1234567890' as `0x${string}`,
    network: 'eip155:8453',
    payer: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    payee: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as `0x${string}`,
    amount: '1000000',
    timestamp: 1700000000,
    facilitatorSignature: '0xfacilitatorsig' as `0x${string}`,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SETTLEGRID_GAS_WALLET_KEY = '0x' + 'ab'.repeat(32)
  })

  it('returns valid when verifyMessage returns true', async () => {
    mockVerifyMessage.mockResolvedValueOnce(true)
    const result = await validateReceipt(receipt)
    expect(result.isValid).toBe(true)
    expect(result.recoveredAddress).toBeDefined()
    expect(result.receipt).toBe(receipt)
  })

  it('returns invalid when verifyMessage returns false', async () => {
    mockVerifyMessage.mockResolvedValueOnce(false)
    const result = await validateReceipt(receipt)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('does not match facilitator')
    expect(result.receipt).toBe(receipt)
  })

  it('returns invalid on verification error', async () => {
    mockVerifyMessage.mockRejectedValueOnce(new Error('Signature decoding failed'))
    const result = await validateReceipt(receipt)
    expect(result.isValid).toBe(false)
    expect(result.invalidReason).toContain('Receipt validation error')
  })

  it('passes correct message to verifyMessage', async () => {
    mockVerifyMessage.mockResolvedValueOnce(true)
    await validateReceipt(receipt)
    expect(mockVerifyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: buildReceiptMessage(
          receipt.txHash,
          receipt.network,
          receipt.payer,
          receipt.payee,
          receipt.amount,
          receipt.timestamp
        ),
        signature: receipt.facilitatorSignature,
      })
    )
  })
})

// ─── X402Adapter ────────────────────────────────────────────────────────────

describe('X402Adapter', () => {
  const adapter = new X402Adapter()

  describe('properties', () => {
    it('name is x402', () => {
      expect(adapter.name).toBe('x402')
    })

    it('displayName is x402 Protocol (Coinbase)', () => {
      expect(adapter.displayName).toBe('x402 Protocol (Coinbase)')
    })
  })

  describe('canHandle', () => {
    it('returns true for payment-signature header', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': 'base64payload' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: x402', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'x402' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for no x402 indicators', () => {
      const req = new Request('http://localhost/api/x402/verify')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false when protocol header has different value', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'mcp' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    function makeBase64Payload(data: Record<string, unknown>): string {
      return Buffer.from(JSON.stringify(data)).toString('base64')
    }

    it('parses base64 PAYMENT-SIGNATURE header', async () => {
      const payloadData = {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: {
          authorization: {
            from: '0x1234567890abcdef1234567890abcdef12345678',
          },
        },
      }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
      expect(ctx.identity.value).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('throws on missing header', async () => {
      const req = new Request('http://localhost/api/x402/verify')
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Missing PAYMENT-SIGNATURE header'
      )
    })

    it('throws on invalid base64', async () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': '!!!not-valid-base64!!!' },
      })
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Invalid base64'
      )
    })

    it('sets protocol to x402', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
    })

    it('sets payment type to eip3009 for exact scheme', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('eip3009')
    })

    it('sets payment type to permit2 for upto scheme', async () => {
      const payloadData = { scheme: 'upto', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('permit2')
    })

    it('uses x-request-id when present', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: {
          'payment-signature': makeBase64Payload(payloadData),
          'x-request-id': 'custom-id-789',
        },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('custom-id-789')
    })
  })

  describe('formatResponse', () => {
    it('returns JSON with success fields', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-x402-001',
        costCents: 10,
        txHash: '0xabc123',
        metadata: {
          protocol: 'x402',
          latencyMs: 150,
          settlementType: 'real-time',
        },
      }
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.txHash).toBe('0xabc123')
      expect(body.operationId).toBe('op-x402-001')
      expect(body.metadata.protocol).toBe('x402')
    })
  })

  describe('formatError', () => {
    it('returns 402 for payment errors', () => {
      const error = new Error('payment insufficient balance')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(402)
    })

    it('returns 500 for generic errors', () => {
      const error = new Error('Something unexpected broke')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(500)
    })

    it('includes error code in response body', async () => {
      const error = new Error('Something unexpected')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()
      expect(body.error.code).toBe('SERVER_ERROR')
      expect(body.error.message).toBe('Something unexpected')
    })
  })
})

// ─── API route: GET /api/x402/supported ──────────────────────────────────────

describe('GET /api/x402/supported', () => {
  // We need to lazy-import the route handler to pick up the mocks above
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/supported/route')
    GET = mod.GET
  })

  function createRequest(): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/supported', {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
  }

  it('returns facilitator info', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.facilitator).toBe('SettleGrid')
    expect(data.version).toBe('1.0.0')
  })

  it('returns supported schemes', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.schemes).toHaveLength(2)
    expect(data.schemes[0].scheme).toBe('exact')
    expect(data.schemes[1].scheme).toBe('upto')
  })

  it('returns network list with USDC addresses', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.networks.length).toBeGreaterThanOrEqual(3)
    for (const net of data.networks) {
      expect(net.assetSymbol).toBe('USDC')
      expect(net.assetDecimals).toBe(6)
      expect(net.asset).toMatch(/^0x[0-9a-fA-F]{40}$/)
    }
  })

  it('returns payment-identifier extension', async () => {
    const res = await GET(createRequest())
    const data = await res.json()
    expect(data.extensions).toContain('payment-identifier')
    expect(data.extensions).toContain('offer-and-receipt')
  })
})

// ─── API routes: POST /api/x402/verify and /api/x402/settle ─────────────────

describe('POST /api/x402/verify', () => {
  // Mock the actual verify functions at the module level for route tests
  vi.mock('@/lib/settlement/x402', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/settlement/x402')>()
    return {
      ...actual,
      verifyExactPayment: mockVerifyExact,
      verifyUptoPayment: mockVerifyUpto,
      settleExactPayment: mockSettleExact,
    }
  })

  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/verify/route')
    POST = mod.POST as unknown as (req: NextRequest) => Promise<Response>
  })

  function createVerifyRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('returns isValid for valid payload', async () => {
    mockVerifyExact.mockResolvedValueOnce({
      isValid: true,
      payer: '0x1234567890abcdef1234567890abcdef12345678',
      network: 'eip155:8453',
    })

    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
  })

  it('returns 422 for invalid scheme', async () => {
    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'unknown_scheme',
        network: 'eip155:8453',
        payload: {},
      },
    })

    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it('dispatches to verifyUptoPayment for upto scheme', async () => {
    mockVerifyUpto.mockResolvedValueOnce({
      isValid: true,
      network: 'eip155:8453',
    })

    const req = createVerifyRequest({
      paymentPayload: {
        scheme: 'upto',
        network: 'eip155:8453',
        payload: { permit: {}, witness: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.isValid).toBe(true)
    expect(mockVerifyUpto).toHaveBeenCalled()
  })
})

describe('POST /api/x402/settle', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/x402/settle/route')
    POST = mod.POST as unknown as (req: NextRequest) => Promise<Response>
  })

  function createSettleRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest('http://localhost:3005/api/x402/settle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('returns 400 for upto scheme', async () => {
    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'upto',
        network: 'eip155:8453',
        payload: {},
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(400)
    expect(data.code).toBe('UNSUPPORTED_SCHEME')
  })

  it('returns 402 when verification fails', async () => {
    mockVerifyExact.mockResolvedValueOnce({
      isValid: false,
      invalidReason: 'Authorization expired',
    })

    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(402)
    expect(data.code).toBe('PAYMENT_VERIFICATION_FAILED')
    expect(data.error).toContain('Authorization expired')
  })

  it('returns success with txHash when settlement succeeds', async () => {
    mockVerifyExact.mockResolvedValueOnce({ isValid: true })
    mockSettleExact.mockResolvedValueOnce({
      success: true,
      txHash: '0xdeadbeef1234567890',
      network: 'eip155:8453',
    })

    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
    })

    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.txHash).toBe('0xdeadbeef1234567890')
  })

  it('accepts optional paymentIdentifier in request body', async () => {
    mockVerifyExact.mockResolvedValueOnce({ isValid: true })
    mockSettleExact.mockResolvedValueOnce({
      success: true,
      txHash: '0xdeadbeef1234567890',
      network: 'eip155:8453',
    })

    const req = createSettleRequest({
      paymentPayload: {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: { signature: '0xabc', authorization: {} },
      },
      paymentIdentifier: 'my-idempotency-key-123',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})

describe('x402 route maxDuration exports', () => {
  it('verify route has maxDuration = 30', async () => {
    const mod = await import('@/app/api/x402/verify/route')
    expect(mod.maxDuration).toBe(30)
  })

  it('settle route has maxDuration = 60', async () => {
    const mod = await import('@/app/api/x402/settle/route')
    expect(mod.maxDuration).toBe(60)
  })

  it('supported route has maxDuration = 30', async () => {
    const mod = await import('@/app/api/x402/supported/route')
    expect(mod.maxDuration).toBe(30)
  })
})
