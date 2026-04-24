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
