/**
 * P5 — Circle Nano adapter: proof parsing + STRUCTURAL validation.
 *
 * Covers the SDK-side, zero-crypto-dependency surface introduced when the
 * stub `validateCircleNanoPayment` was replaced:
 *   - parseCircleNanoProof: base64/JSON decode + shape validation
 *   - validateCircleNanoProofString: structural checks (enablement, presence,
 *     shape, supported network, time window, amount) — but NOT the EIP-712
 *     signature, which is verified server-side (apps/web, viem). The final
 *     test documents that deliberate split: a well-formed proof with a bogus
 *     signature passes the STRUCTURAL check.
 *
 * The authoritative cryptographic verification is tested in apps/web
 * (lib/settlement/circle-nano/__tests__/verify.test.ts).
 */
import { describe, it, expect } from 'vitest'
import {
  parseCircleNanoProof,
  validateCircleNanoProofString,
  type CircleNanoProof,
  type CircleNanoValidateOptions,
} from '../adapters/circle-nano'

const VALID_AUTH = {
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  to: '0x1111111111111111111111111111111111111111',
  value: '10000', // 1 cent in USDC base units
  validAfter: '0',
  validBefore: '2000000000',
  nonce: `0x${'11'.repeat(32)}`,
}

function proofObject(overrides: Partial<CircleNanoProof> = {}): CircleNanoProof {
  return {
    network: 'eip155:8453',
    authorization: { ...VALID_AUTH },
    signature: `0x${'ab'.repeat(65)}`,
    ...overrides,
  }
}

function encodeB64(p: unknown): string {
  return Buffer.from(JSON.stringify(p)).toString('base64')
}

const OPTIONS: CircleNanoValidateOptions = {
  enabled: true,
  toolConfig: { slug: 'demo', costCents: 1, displayName: 'Demo' }, // 1¢ = 10000 base units
}

describe('parseCircleNanoProof', () => {
  it('decodes a base64(JSON) envelope', () => {
    const parsed = parseCircleNanoProof(encodeB64(proofObject()))
    expect(parsed).not.toBeNull()
    expect(parsed?.network).toBe('eip155:8453')
    expect(parsed?.authorization.from).toBe(VALID_AUTH.from)
  })

  it('decodes a raw JSON envelope (no base64)', () => {
    const parsed = parseCircleNanoProof(JSON.stringify(proofObject()))
    expect(parsed?.authorization.value).toBe('10000')
  })

  it('returns null for non-JSON / non-base64 garbage', () => {
    expect(parseCircleNanoProof('not a proof at all !!!')).toBeNull()
  })

  it('returns null when a required authorization field is missing', () => {
    const broken = proofObject()
    // @ts-expect-error — intentionally drop a required field
    delete broken.authorization.nonce
    expect(parseCircleNanoProof(encodeB64(broken))).toBeNull()
  })

  it('returns null when authorization is not an object', () => {
    expect(parseCircleNanoProof(encodeB64({ network: 'eip155:8453', authorization: 'x', signature: '0x' }))).toBeNull()
  })

  it('returns null when network/signature are missing', () => {
    expect(parseCircleNanoProof(encodeB64({ authorization: VALID_AUTH }))).toBeNull()
  })
})

describe('validateCircleNanoProofString (structural)', () => {
  it('accepts a well-formed, in-window, sufficient-amount proof', () => {
    const r = validateCircleNanoProofString(encodeB64(proofObject()), OPTIONS)
    expect(r.valid).toBe(true)
    expect(r.payerAddress).toBe(VALID_AUTH.from)
    expect(r.amountUsdc).toBe('10000')
  })

  it('rejects when the rail is not enabled', () => {
    const r = validateCircleNanoProofString(encodeB64(proofObject()), { ...OPTIONS, enabled: false })
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_NOT_CONFIGURED')
  })

  it('rejects a missing proof', () => {
    const r = validateCircleNanoProofString(null, OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_AUTH_MISSING')
  })

  it('rejects a malformed proof', () => {
    const r = validateCircleNanoProofString('garbage', OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('rejects an unsupported network', () => {
    const r = validateCircleNanoProofString(encodeB64(proofObject({ network: 'eip155:1' })), OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_NETWORK_UNSUPPORTED')
  })

  it('rejects an expired authorization', () => {
    const proof = proofObject()
    proof.authorization.validBefore = '500'
    const r = validateCircleNanoProofString(encodeB64(proof), OPTIONS)
    // Date.now()-based; validBefore far in the past relative to real now.
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_EXPIRED')
  })

  it('rejects a not-yet-valid authorization', () => {
    const proof = proofObject()
    proof.authorization.validAfter = '9999999999' // year ~2286
    const r = validateCircleNanoProofString(encodeB64(proof), OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_NOT_YET_VALID')
  })

  it('rejects an under-payment (authorized < tool cost)', () => {
    const proof = proofObject()
    proof.authorization.value = '5000' // < 10000 required for 1¢
    const r = validateCircleNanoProofString(encodeB64(proof), OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_AMOUNT_MISMATCH')
  })

  it('rejects a non-integer value without throwing', () => {
    const proof = proofObject()
    proof.authorization.value = '12.5'
    const r = validateCircleNanoProofString(encodeB64(proof), OPTIONS)
    expect(r.valid).toBe(false)
    expect(r.error?.code).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('is STRUCTURAL ONLY: a well-formed proof with a bogus signature still passes here (crypto is server-side)', () => {
    // Documents the deliberate SDK/server split — this check never inspects
    // the signature. The authoritative EIP-712 recovery is in apps/web.
    const proof = proofObject({ signature: '0xdeadbeef' })
    const r = validateCircleNanoProofString(encodeB64(proof), OPTIONS)
    expect(r.valid).toBe(true)
  })
})
