/**
 * Unit tests for the x402 exact-payment header parsing (the structural gate
 * before on-chain settlement). Pure functions — no mocks. Node env.
 */
import { describe, it, expect } from 'vitest'
import { extractX402PaymentHeader, parseX402ExactPayload } from '../parse'

const VALID_EXACT = {
  x402Version: 2,
  scheme: 'exact',
  network: 'eip155:8453',
  payload: {
    signature: '0x' + 'a'.repeat(130),
    authorization: {
      from: '0x' + '1'.repeat(40),
      to: '0x' + '2'.repeat(40),
      value: '500000',
      validAfter: '0',
      validBefore: '9999999999',
      nonce: '0x' + '3'.repeat(64),
    },
  },
}

const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('utf-8') && Buffer.from(JSON.stringify(o)).toString('base64')

describe('parseX402ExactPayload — accepts well-formed exact payloads', () => {
  it('decodes a base64(JSON) exact payload', () => {
    const parsed = parseX402ExactPayload(b64(VALID_EXACT))
    expect(parsed).not.toBeNull()
    expect(parsed!.scheme).toBe('exact')
    expect(parsed!.network).toBe('eip155:8453')
    expect(parsed!.payload.authorization.from).toBe('0x' + '1'.repeat(40))
    expect(parsed!.payload.authorization.value).toBe('500000')
    expect(parsed!.payload.authorization.nonce).toBe('0x' + '3'.repeat(64))
    expect(parsed!.payload.signature).toBe('0x' + 'a'.repeat(130))
  })

  it('falls back to raw JSON (non-base64) input', () => {
    const parsed = parseX402ExactPayload(JSON.stringify(VALID_EXACT))
    expect(parsed).not.toBeNull()
    expect(parsed!.payload.authorization.to).toBe('0x' + '2'.repeat(40))
  })

  it('defaults x402Version to 2 when omitted', () => {
    const noVer = { ...VALID_EXACT } as Record<string, unknown>
    delete noVer.x402Version
    const parsed = parseX402ExactPayload(b64(noVer))
    expect(parsed!.x402Version).toBe(2)
  })
})

describe('parseX402ExactPayload — rejects everything else (returns null)', () => {
  it('rejects the upto scheme (v1 settles exact only)', () => {
    expect(parseX402ExactPayload(b64({ ...VALID_EXACT, scheme: 'upto' }))).toBeNull()
  })
  it('rejects a missing/unknown scheme', () => {
    const s = { ...VALID_EXACT } as Record<string, unknown>
    delete s.scheme
    expect(parseX402ExactPayload(b64(s))).toBeNull()
    expect(parseX402ExactPayload(b64({ ...VALID_EXACT, scheme: 'magical' }))).toBeNull()
  })
  it('rejects a missing network', () => {
    const s = { ...VALID_EXACT } as Record<string, unknown>
    delete s.network
    expect(parseX402ExactPayload(b64(s))).toBeNull()
  })
  it('rejects a missing payload / authorization', () => {
    expect(parseX402ExactPayload(b64({ scheme: 'exact', network: 'eip155:8453' }))).toBeNull()
    expect(parseX402ExactPayload(b64({ scheme: 'exact', network: 'eip155:8453', payload: { signature: '0x1' } }))).toBeNull()
  })
  it('rejects a missing authorization field', () => {
    const missingNonce = JSON.parse(JSON.stringify(VALID_EXACT))
    delete missingNonce.payload.authorization.nonce
    expect(parseX402ExactPayload(b64(missingNonce))).toBeNull()
  })
  it('rejects a non-string authorization field', () => {
    const numericValue = JSON.parse(JSON.stringify(VALID_EXACT))
    numericValue.payload.authorization.value = 500000
    expect(parseX402ExactPayload(b64(numericValue))).toBeNull()
  })
  it('rejects a missing signature', () => {
    const noSig = JSON.parse(JSON.stringify(VALID_EXACT))
    delete noSig.payload.signature
    expect(parseX402ExactPayload(b64(noSig))).toBeNull()
  })
  it('rejects garbage / non-object / array', () => {
    expect(parseX402ExactPayload('not-base64-not-json')).toBeNull()
    expect(parseX402ExactPayload(b64('a string'))).toBeNull()
    expect(parseX402ExactPayload(b64(42))).toBeNull()
    expect(parseX402ExactPayload(b64([VALID_EXACT]))).toBeNull()
    expect(parseX402ExactPayload(b64(null))).toBeNull()
  })
})

describe('extractX402PaymentHeader — header precedence', () => {
  it('returns the X-Payment header when present', () => {
    const req = new Request('https://x.test', { headers: { 'X-Payment': 'abc123' } })
    expect(extractX402PaymentHeader(req)).toBe('abc123')
  })
  it('falls back to payment-signature', () => {
    const req = new Request('https://x.test', { headers: { 'payment-signature': 'sigval' } })
    expect(extractX402PaymentHeader(req)).toBe('sigval')
  })
  it('falls back to a Bearer x402_ token (stripping the x402_ prefix)', () => {
    const req = new Request('https://x.test', { headers: { authorization: 'Bearer x402_PAYLOAD' } })
    expect(extractX402PaymentHeader(req)).toBe('PAYLOAD')
  })
  it('prefers X-Payment over payment-signature', () => {
    const req = new Request('https://x.test', {
      headers: { 'X-Payment': 'primary', 'payment-signature': 'secondary' },
    })
    expect(extractX402PaymentHeader(req)).toBe('primary')
  })
  it('returns null when no payment header is present', () => {
    const req = new Request('https://x.test', { headers: { authorization: 'Bearer sk_live_notx402' } })
    expect(extractX402PaymentHeader(req)).toBeNull()
  })
})
