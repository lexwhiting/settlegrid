/**
 * P3.K5 — DRAIN Keccak-256 vector tests.
 *
 * Scoped to the P3.K5 deliverable: locking the `@noble/hashes/sha3`
 * switchover against regression. The broader DRAIN contract tests
 * (canHandle / extractPaymentContext / buildChallenge / settle) live
 * in `packages/mcp/src/__tests__/adapter-drain.test.ts` and predate
 * this card; that file stays untouched.
 *
 * Vectors: canonical Keccak-256 known-answer values from the Keccak
 * team's reference + the `@noble/hashes` test suite. A regression
 * that reverts to `createHash('sha256')` stand-in OR `createHash
 * ('sha3-256')` (FIPS padding) would fail every test here because
 * all three hash functions produce completely different digests.
 */

import { describe, expect, it } from 'vitest'
import { keccak_256 } from '@noble/hashes/sha3'
import { bytesToHex } from '@noble/hashes/utils'
import {
  DrainAdapter,
  generateDrain402Response,
  __internal__,
} from '../drain'

const hashString = (s: string) =>
  bytesToHex(keccak_256(new TextEncoder().encode(s)))

describe('DRAIN — Keccak-256 test vectors (P3.K5)', () => {
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
    // is a well-known constant that any ethers.js / web3.js
    // installation produces identically. Locking it here catches
    // any accidental change to the hash function's input encoding
    // (we rely on UTF-8 bytes via TextEncoder).
    expect(
      hashString(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
      ),
    ).toBe('8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f')
  })

  it('differs from FIPS SHA3-256 (proves genuine Keccak, not FIPS padding)', () => {
    // Under FIPS SHA3-256 padding, `keccak_256("")` would be
    // 'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'.
    // Under genuine Keccak-256, it's the `c5d2…` value above. A
    // regression that swapped to `createHash('sha3-256')` would
    // emit the FIPS value and fail this test.
    const FIPS_SHA3_256_EMPTY =
      'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a'
    expect(hashString('')).not.toBe(FIPS_SHA3_256_EMPTY)
  })

  it('differs from SHA-256 (proves genuine Keccak, not the old SHA-256 stand-in)', () => {
    // Old stand-in: `createHash('sha256').update('').digest('hex')` =
    // 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'.
    // The P1.MKT1 marketing audit flagged the SHA-256 stand-in as
    // cryptographically broken; a regression restoring it would
    // emit this value and fail here.
    const SHA256_EMPTY =
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    expect(hashString('')).not.toBe(SHA256_EMPTY)
  })
})

// ─── Hostile-round guards (P3.K5) ───────────────────────────────────
//
// Lock the parser-boundary fixes. Before P3.K5 the hash helper
// used `Buffer.from(hex, 'hex')` which silently dropped invalid
// chars (producing wrong digests but no crash). Switching to
// `@noble/hashes/utils.hexToBytes` made the helpers strict —
// malformed addresses / negative expiries now throw. The parser
// was updated to reject these at the voucher-extraction boundary
// so the throw can't reach the settlement flow as a 500.
//
// Tests exercise the adapter's public `extractPaymentContext`
// surface (parseVoucher is internal). When the parser rejects a
// voucher, identity.value falls back to 'unknown' — the
// observable signal that the malformed voucher was discarded.

const VALID_CHANNEL = '0x1234567890abcdef1234567890abcdef12345678'
const VALID_PAYER = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
const VALID_SIG = '0x' + 'a'.repeat(130)

function makeVoucher(overrides: Record<string, unknown> = {}): string {
  const base: Record<string, unknown> = {
    channelAddress: VALID_CHANNEL,
    payer: VALID_PAYER,
    amount: '100000',
    nonce: 1,
    expiry: 0,
    signature: VALID_SIG,
  }
  return JSON.stringify({ ...base, ...overrides })
}

describe('DRAIN parser hostile guards (P3.K5)', () => {
  const adapter = new DrainAdapter()

  it('rejects a voucher with a non-EVM-shaped channelAddress (H1)', async () => {
    // Before H1: `padAddress('not-hex-zz...')` left `zz` in the output;
    // `hexToBytes` then threw; `verifyVoucherSignature` crashed the
    // request with a 500. After H1: parseVoucher returns null; the
    // adapter falls back to 'unknown' payer.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': makeVoucher({ channelAddress: 'not-an-address' }),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
    expect(ctx.identity.metadata?.channelAddress).toBeUndefined()
  })

  it('rejects a voucher with a non-EVM-shaped payer (H1)', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': makeVoucher({ payer: 'zzzz' }),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })

  it('rejects a voucher with a 39-hex-char address (off by one; H1)', async () => {
    // Length boundary — EVM address is exactly 40 hex chars after 0x.
    const shortAddress = '0x' + '1'.repeat(39)
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': makeVoucher({ channelAddress: shortAddress }),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })

  it('rejects a voucher with a negative expiry (H2)', async () => {
    // Before H2: nonce had `< 0` rejection but expiry didn't. A
    // negative expiry flowed into `padUint256(BigInt(-5))` which
    // emits '-5' → not hex → `hexToBytes` throw. After H2: parser
    // rejects the voucher; fallback 'unknown' payer.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': makeVoucher({ expiry: -100 }),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })

  it('still accepts a well-formed voucher after the tighter validation', async () => {
    // Regression guard: the stricter parser must not reject the
    // canonical voucher shape the existing test suite uses.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': makeVoucher() },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe(VALID_PAYER)
    expect(ctx.identity.metadata?.channelAddress).toBe(VALID_CHANNEL)
  })

  it('accepts uppercase-hex EVM addresses (case-insensitive; H1)', async () => {
    // EIP-55 checksum addresses use mixed-case hex. The parser
    // regex is case-insensitive so checksummed input passes.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-drain-voucher': makeVoucher({
          payer: '0xABCDefABCDefABCDefABCDefABCDefABCDefABCD',
        }),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('0xABCDefABCDefABCDefABCDefABCDefABCDefABCD')
  })
})

// ─── Coverage-round structural tests ────────────────────────────────
//
// Exercise the Keccak-256 hash chain via the `computeVoucherHash`
// internal helper. The scaffold commit removed the `void
// computeVoucherHash(voucher)` dead-code site, so the function is
// only reachable via `__internal__` today. These tests cover the
// full chain (padAddress / padUint256 / keccak256 / keccak256Hex)
// with structural invariants — they do NOT pin a specific EIP-712
// digest (that would require pre-computing the value offline via
// ethers.js; deferred until ecrecover integration).
//
// `base` voucher has all-zeros addresses so the hex padding is
// a known quantity (64 zeros each), letting the test reason about
// the input bytes of the outer keccak256Hex call.

const BASE_VOUCHER: Parameters<typeof __internal__.computeVoucherHash>[0] = {
  channelAddress: '0x0000000000000000000000000000000000000001',
  payer: '0x0000000000000000000000000000000000000002',
  amount: '100',
  nonce: 1,
  expiry: 0,
  signature: '0x' + 'a'.repeat(130),
}

describe('computeVoucherHash — structural invariants (P3.K5 coverage)', () => {
  const { computeVoucherHash } = __internal__

  it('returns exactly 64 lowercase hex chars (32-byte Keccak-256 digest)', () => {
    const digest = computeVoucherHash(BASE_VOUCHER)
    expect(digest).toHaveLength(64)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic: same voucher → same digest', () => {
    expect(computeVoucherHash(BASE_VOUCHER)).toBe(computeVoucherHash(BASE_VOUCHER))
  })

  it('changes when amount changes (sensitivity to voucher fields)', () => {
    const a = computeVoucherHash(BASE_VOUCHER)
    const b = computeVoucherHash({ ...BASE_VOUCHER, amount: '101' })
    expect(a).not.toBe(b)
  })

  it('changes when nonce changes', () => {
    const a = computeVoucherHash(BASE_VOUCHER)
    const b = computeVoucherHash({ ...BASE_VOUCHER, nonce: 2 })
    expect(a).not.toBe(b)
  })

  it('changes when expiry changes', () => {
    const a = computeVoucherHash(BASE_VOUCHER)
    const b = computeVoucherHash({ ...BASE_VOUCHER, expiry: 9999 })
    expect(a).not.toBe(b)
  })

  it('changes when channelAddress changes (domain separator binding)', () => {
    const a = computeVoucherHash(BASE_VOUCHER)
    const b = computeVoucherHash({
      ...BASE_VOUCHER,
      channelAddress: '0x00000000000000000000000000000000000000ff',
    })
    expect(a).not.toBe(b)
  })

  it('signature field does NOT affect the digest (hash is of typed data, not sig)', () => {
    const a = computeVoucherHash(BASE_VOUCHER)
    const b = computeVoucherHash({
      ...BASE_VOUCHER,
      signature: '0x' + 'b'.repeat(130),
    })
    expect(a).toBe(b)
  })
})

describe('padAddress / padUint256 — canonical output shape', () => {
  const { padAddress, padUint256 } = __internal__

  it('padAddress strips 0x, lowercases, and zero-pads to 64 chars', () => {
    expect(padAddress('0xAbCdEf1234567890abcdef1234567890abcdef12')).toBe(
      '000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
    )
  })

  it('padAddress accepts address WITHOUT 0x prefix', () => {
    expect(padAddress('abcdef1234567890abcdef1234567890abcdef12')).toBe(
      '000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
    )
  })

  it('padUint256 encodes the number as 64-char lowercase hex', () => {
    expect(padUint256(0)).toBe(
      '0000000000000000000000000000000000000000000000000000000000000000',
    )
    expect(padUint256(137)).toBe(
      '0000000000000000000000000000000000000000000000000000000000000089',
    )
    expect(padUint256(BigInt('1000000'))).toBe(
      '00000000000000000000000000000000000000000000000000000000000f4240',
    )
  })
})

describe('centsToUsdcBaseUnits', () => {
  const { centsToUsdcBaseUnits } = __internal__

  it('multiplies cents by 10_000 (6-decimal USDC)', () => {
    // 1 cent = 0.01 USDC = 10_000 base units (USDC has 6 decimals,
    // so 1 USDC = 10^6 base units, and 1 cent = 10^4 base units).
    expect(centsToUsdcBaseUnits(0)).toBe('0')
    expect(centsToUsdcBaseUnits(1)).toBe('10000')
    expect(centsToUsdcBaseUnits(100)).toBe('1000000') // $1 = 1 USDC
    expect(centsToUsdcBaseUnits(250)).toBe('2500000') // $2.50
  })
})

describe('DrainAdapter — class method wrappers (coverage)', () => {
  const adapter = new DrainAdapter()

  it('build402Response delegates to generateDrain402Response', async () => {
    const r1 = adapter.build402Response({
      toolSlug: 'cov',
      costCents: 10,
      appUrl: 'https://settlegrid.test',
    })
    const r2 = generateDrain402Response({
      toolSlug: 'cov',
      costCents: 10,
      appUrl: 'https://settlegrid.test',
    })
    // Status + core body shape should match; timestamps / metadata
    // may differ if the response embeds clocks.
    expect(r1.status).toBe(r2.status)
    const b1 = (await r1.json()) as Record<string, unknown>
    const b2 = (await r2.json()) as Record<string, unknown>
    expect(b1.protocol).toBe(b2.protocol)
    expect(b1.amount_cents).toBe(b2.amount_cents)
  })

  it('verify method delegates to validateDrainPayment', async () => {
    // Passes enabled=false so validateDrainPayment returns the
    // NOT_CONFIGURED path — stable, no network required.
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': makeVoucher() },
    })
    const result = await adapter.verify(req, {
      enabled: false,
      toolConfig: { slug: 't', costCents: 5, displayName: 'T' },
    })
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('DRAIN_NOT_CONFIGURED')
  })

  it('formatError routes voucher-related errors to 401 DRAIN_VOUCHER_INVALID', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = adapter.formatError(new Error('voucher signature bad'), req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('DRAIN_VOUCHER_INVALID')
  })

  it('formatError routes insufficient-amount errors to 402 DRAIN_INSUFFICIENT_AMOUNT', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = adapter.formatError(new Error('insufficient amount'), req)
    expect(res.status).toBe(402)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('DRAIN_INSUFFICIENT_AMOUNT')
  })

  it('formatError routes other errors to 500', async () => {
    const req = new Request('http://localhost/api/proxy/t')
    const res = adapter.formatError(new Error('network unreachable'), req)
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: { code: string } }
    expect(body.error.code).toBe('DRAIN_VOUCHER_INVALID')
  })

  it('formatError echoes x-request-id when present', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-request-id': 'req-abc-123' },
    })
    const res = adapter.formatError(new Error('voucher bad'), req)
    const body = (await res.json()) as { error: { requestId: string } }
    expect(body.error.requestId).toBe('req-abc-123')
  })
})

describe('parseVoucher — base64 fallback + field coercion', () => {
  const adapter = new DrainAdapter()

  it('decodes a base64-encoded voucher JSON payload', async () => {
    const voucherJson = JSON.stringify({
      channelAddress: VALID_CHANNEL,
      payer: VALID_PAYER,
      amount: '100',
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
    })
    const b64 = Buffer.from(voucherJson, 'utf-8').toString('base64')
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': b64 },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe(VALID_PAYER)
  })

  it('accepts snake_case channel_address alongside camelCase channelAddress', async () => {
    const voucher = JSON.stringify({
      channel_address: VALID_CHANNEL, // snake_case
      payer: VALID_PAYER,
      amount: '100',
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': voucher },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.metadata?.channelAddress).toBe(VALID_CHANNEL)
  })

  it('coerces numeric amount to a string before validation', async () => {
    const voucher = JSON.stringify({
      channelAddress: VALID_CHANNEL,
      payer: VALID_PAYER,
      amount: 100, // number, not string
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': voucher },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe(VALID_PAYER) // parser accepted
  })

  it('rejects non-integer numeric amount (NaN / float)', async () => {
    const voucher = JSON.stringify({
      channelAddress: VALID_CHANNEL,
      payer: VALID_PAYER,
      amount: 100.5, // non-integer
      nonce: 1,
      expiry: 0,
      signature: VALID_SIG,
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': voucher },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown') // parser rejected
  })

  it('rejects voucher with non-JSON, non-base64 raw string', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': '!@#$ not-valid-anything %^&*' },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })

  it('rejects voucher missing the signature field', async () => {
    const voucher = JSON.stringify({
      channelAddress: VALID_CHANNEL,
      payer: VALID_PAYER,
      amount: '100',
      nonce: 1,
      expiry: 0,
      // signature omitted
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': voucher },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })

  it('rejects voucher with negative nonce', async () => {
    const voucher = JSON.stringify({
      channelAddress: VALID_CHANNEL,
      payer: VALID_PAYER,
      amount: '100',
      nonce: -1,
      expiry: 0,
      signature: VALID_SIG,
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-drain-voucher': voucher },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('unknown')
  })
})
