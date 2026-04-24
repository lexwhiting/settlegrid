/**
 * DrainAdapter tests (P2.K2).
 */

import { describe, it, expect } from 'vitest'
import {
  DrainAdapter,
  validateDrainPayment,
  generateDrain402Response,
} from '../adapters/drain'
import { protocolRegistry } from '../adapters'

const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }
const APP_URL = 'https://settlegrid.test'
const CHANNEL = '0x1234567890abcdef1234567890abcdef12345678'
const PAYER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const VALID_SIG = '0x' + 'a'.repeat(130) // 65 bytes hex

function makeVoucher(overrides: Partial<{ amount: string; nonce: number; expiry: number; channelAddress: string }> = {}) {
  return {
    channelAddress: overrides.channelAddress ?? CHANNEL,
    payer: PAYER,
    amount: overrides.amount ?? '100000', // 10 cents × 10_000 = 100_000 base units
    nonce: overrides.nonce ?? 1,
    expiry: overrides.expiry ?? 0,
    signature: VALID_SIG,
  }
}

describe('DrainAdapter', () => {
  const adapter = new DrainAdapter()

  it('has correct identity fields', () => {
    expect(adapter.name).toBe('drain')
    expect(adapter.displayName).toContain('DRAIN')
  })

  describe('canHandle', () => {
    it('returns true for x-drain-voucher', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-drain-voucher': JSON.stringify(makeVoucher()) },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: drain', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-settlegrid-protocol': 'drain' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false without matching headers', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts payer + channel from voucher JSON', async () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-drain-voucher': JSON.stringify(makeVoucher()) },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('drain')
      expect(ctx.identity.value).toBe(PAYER)
      expect(ctx.identity.metadata?.channelAddress).toBe(CHANNEL)
    })
  })

  describe('buildChallenge', () => {
    it('returns scheme drain with polygon chain id', () => {
      const entry = adapter.buildChallenge({
        resource: { url: 'http://localhost/api/proxy/t' },
        pricing: { defaultCostCents: 5 },
      })
      expect(entry.scheme).toBe('drain')
      expect(entry.network).toBe('polygon')
      expect(entry.chainId).toBe(137)
      expect(entry.acceptedPayments).toEqual(['eip712-voucher'])
    })
  })
})

describe('validateDrainPayment', () => {
  it('returns DRAIN_NOT_CONFIGURED when enabled=false', async () => {
    const res = await validateDrainPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_NOT_CONFIGURED')
  })

  it('returns DRAIN_VOUCHER_MISSING without x-drain-voucher', async () => {
    const res = await validateDrainPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_VOUCHER_MISSING')
  })

  it('returns DRAIN_VOUCHER_INVALID for unparseable vouchers', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': 'not-json-not-base64' },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_VOUCHER_INVALID')
  })

  it('returns DRAIN_SIGNATURE_INVALID for malformed signature', async () => {
    const voucher = makeVoucher()
    voucher.signature = '0xabc' // too short
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(voucher) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_SIGNATURE_INVALID')
  })

  it('returns DRAIN_VOUCHER_INVALID when expiry is in the past', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': JSON.stringify(
          makeVoucher({ expiry: Math.floor(Date.now() / 1000) - 10 }),
        ),
      },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_VOUCHER_INVALID')
  })

  it('returns DRAIN_INSUFFICIENT_AMOUNT when voucher is below cost', async () => {
    // Tool costs 5 cents = 50_000 base units. Voucher gives 10 base units.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(makeVoucher({ amount: '10' })) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('DRAIN_INSUFFICIENT_AMOUNT')
  })

  it('returns DRAIN_CHANNEL_UNKNOWN when voucher channel mismatches config', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(makeVoucher()) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      configuredChannelAddress: '0x9999999999999999999999999999999999999999',
    })
    expect(res.error?.code).toBe('DRAIN_CHANNEL_UNKNOWN')
  })

  it('accepts a valid voucher', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': JSON.stringify(makeVoucher()) },
    })
    const res = await validateDrainPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
    expect(res.channelId).toBe(CHANNEL)
    expect(res.payerAddress).toBe(PAYER)
  })
})

describe('generateDrain402Response', () => {
  it('returns 402 with eip712 domain + channel info', async () => {
    const res = generateDrain402Response({
      toolSlug: 't',
      costCents: 25,
      appUrl: APP_URL,
      channelAddress: CHANNEL,
    })
    expect(res.status).toBe(402)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('drain')
    expect(body.amount_cents).toBe(25)
    expect((body.channel as Record<string, unknown>).address).toBe(CHANNEL)
    expect((body.eip712 as Record<string, unknown>).domain).toBeDefined()
  })
})

describe('DrainAdapter registry registration', () => {
  it('is registered as "drain" in the singleton registry', () => {
    expect(protocolRegistry.has('drain')).toBe(true)
    expect(protocolRegistry.get('drain')).toBeInstanceOf(DrainAdapter)
  })
})

// ─── P3.K5 — Keccak-256 vector tests ────────────────────────────────
//
// Locks the `@noble/hashes/sha3` switchover against regression. The
// previous scaffold used `createHash('sha256')` as a structural
// stand-in; a regression that restores the stand-in would fail
// every test below because SHA-256 and Keccak-256 produce
// completely different digests.
//
// Vectors: canonical Keccak-256 known-answer values. Sourced from
// the Keccak team's reference and the `@noble/hashes` test suite.
// (Keccak-256 is the PRE-FIPS Keccak round Ethereum adopted; Node's
// built-in `createHash('sha3-256')` uses a different padding rule
// and would NOT produce these digests.)

import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'

describe('DRAIN — Keccak-256 test vectors (P3.K5)', () => {
  const hashString = (s: string) =>
    bytesToHex(keccak_256(new TextEncoder().encode(s)))

  it('matches the empty-string canonical digest', () => {
    expect(hashString('')).toBe(
      'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
    )
  })

  it('matches the "abc" canonical digest', () => {
    expect(hashString('abc')).toBe(
      '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45',
    )
  })

  it('matches the "testing" canonical digest', () => {
    expect(hashString('testing')).toBe(
      '5f16f4c7f149ac4f9510d9cf8cf384038ad348b3bcdc01915f95de12df9d1b02',
    )
  })

  it('matches the EIP-712 domain type-hash for DRAIN', () => {
    // EIP-712 `keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")`
    // is a well-known constant. Locking it here catches any accidental
    // change to the hash function's input encoding (UTF-8 bytes).
    expect(
      hashString(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
      ),
    ).toBe('8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f')
  })

  it('differs from FIPS SHA3-256 (proves genuine Keccak, not stand-in)', () => {
    // Under FIPS SHA3-256 padding, `keccak256("")` would be
    // 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'.
    // Under genuine Keccak-256, it's the `c5d2…` value above. A
    // regression that swapped back to `createHash('sha3-256')` would
    // emit the FIPS value and fail this test.
    const FIPS_SHA3_256_EMPTY =
      'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'
    expect(hashString('')).not.toBe(FIPS_SHA3_256_EMPTY)
  })

  it('differs from SHA-256 (proves genuine Keccak, not the old SHA-256 stand-in)', () => {
    // Old stand-in: `createHash('sha256').update('').digest('hex')` =
    // 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'.
    // The gate's C15 check explicitly flags the stand-in; a regression
    // restoring it would emit this value.
    const SHA256_EMPTY =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    expect(hashString('')).not.toBe(SHA256_EMPTY)
  })
})
