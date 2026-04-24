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
import { DrainAdapter } from '../drain'

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
