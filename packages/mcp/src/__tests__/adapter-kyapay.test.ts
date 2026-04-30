/**
 * KyaPayAdapter tests (P2.K2).
 */

import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  KyaPayAdapter,
  validateKyaPayPayment,
  generateKyaPay402Response,
} from '../adapters/kyapay'
import { protocolRegistry } from '../adapters'

const VERIFICATION_KEY = 'test-kyapay-hmac-secret'
const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }
const APP_URL = 'https://settlegrid.test'

function mintKyaPayJwt(
  payload: Record<string, unknown>,
  alg: 'HS256' = 'HS256',
): string {
  const header = { alg, typ: 'JWT' }
  const b64 = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const signedContent = `${b64(header)}.${b64(payload)}`
  const signature = createHmac('sha256', VERIFICATION_KEY).update(signedContent).digest('base64url')
  return `${signedContent}.${signature}`
}

describe('KyaPayAdapter', () => {
  const adapter = new KyaPayAdapter()

  it('has correct identity fields', () => {
    expect(adapter.name).toBe('kyapay')
    expect(adapter.displayName).toContain('KYAPay')
  })

  describe('canHandle', () => {
    it('returns true for x-kyapay-token', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-kyapay-token': 'some.jwt.value' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for Bearer kyapay_ token', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { authorization: 'Bearer kyapay_abc.def.ghi' },
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
    it('throws when no token present', async () => {
      const req = new Request('http://localhost/api/proxy/t')
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(/No KYAPay token/)
    })

    it('extracts JWT claims when a parseable JWT is presented', async () => {
      const jwt = mintKyaPayJwt({
        sub: 'principal-abc',
        jti: 'token-123',
        max_spend_cents: 1000,
        agent_id: 'agent-xyz',
      })
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-kyapay-token': jwt },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('kyapay')
      expect(ctx.identity.value).toBe('principal-abc')
      expect(ctx.identity.metadata?.jti).toBe('token-123')
      expect(ctx.payment.maxAmount?.value).toBe(BigInt(1000))
    })
  })

  describe('buildChallenge', () => {
    it('returns scheme kyapay with kyapay-jwt acceptance', () => {
      const entry = adapter.buildChallenge({
        resource: { url: 'http://localhost/api/proxy/t' },
        pricing: { defaultCostCents: 5 },
      })
      expect(entry.scheme).toBe('kyapay')
      expect(entry.acceptedPayments).toEqual(['kyapay-jwt'])
    })
  })
})

describe('validateKyaPayPayment', () => {
  it('returns KYAPAY_NOT_CONFIGURED when enabled=false', async () => {
    const res = await validateKyaPayPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('KYAPAY_NOT_CONFIGURED')
  })

  it('returns KYAPAY_NOT_CONFIGURED when verification key missing even if enabled', async () => {
    const res = await validateKyaPayPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('KYAPAY_NOT_CONFIGURED')
  })

  it('returns KYAPAY_TOKEN_MISSING when no token in request', async () => {
    const res = await validateKyaPayPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: VERIFICATION_KEY,
    })
    expect(res.error?.code).toBe('KYAPAY_TOKEN_MISSING')
  })

  it('returns KYAPAY_TOKEN_INVALID for non-JWT tokens', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': 'not-a-jwt' },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: VERIFICATION_KEY,
    })
    expect(res.error?.code).toBe('KYAPAY_TOKEN_INVALID')
  })

  it('returns KYAPAY_SIGNATURE_INVALID when signed with a different key', async () => {
    const jwt = mintKyaPayJwt({ sub: 'p', max_spend_cents: 100 })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: 'different-key',
    })
    expect(res.error?.code).toBe('KYAPAY_SIGNATURE_INVALID')
  })

  it('returns KYAPAY_TOKEN_EXPIRED when exp is in the past', async () => {
    const jwt = mintKyaPayJwt({
      sub: 'p',
      exp: Math.floor(Date.now() / 1000) - 10,
      max_spend_cents: 100,
    })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: VERIFICATION_KEY,
    })
    expect(res.error?.code).toBe('KYAPAY_TOKEN_EXPIRED')
  })

  it('returns KYAPAY_INSUFFICIENT_AUTHORIZATION when max_spend_cents < cost', async () => {
    const jwt = mintKyaPayJwt({ sub: 'p', max_spend_cents: 1 })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: VERIFICATION_KEY,
    })
    expect(res.error?.code).toBe('KYAPAY_INSUFFICIENT_AUTHORIZATION')
  })

  it('accepts a valid JWT with sufficient authorization', async () => {
    const jwt = mintKyaPayJwt({ sub: 'p', jti: 'jti-1', max_spend_cents: 1000 })
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-kyapay-token': jwt },
    })
    const res = await validateKyaPayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
      verificationKey: VERIFICATION_KEY,
    })
    expect(res.valid).toBe(true)
    expect(res.tokenId).toBe('jti-1')
    expect(res.principalId).toBe('p')
  })
})

describe('generateKyaPay402Response', () => {
  it('returns 402 with accepted_payments kyapay-jwt', async () => {
    const res = generateKyaPay402Response({
      toolSlug: 't',
      costCents: 25,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('kyapay')
    expect(body.accepted_payments).toEqual(['kyapay-jwt'])
  })
})

describe('KyaPayAdapter registry registration', () => {
  it('is registered as "kyapay" in the singleton registry', () => {
    expect(protocolRegistry.has('kyapay')).toBe(true)
    expect(protocolRegistry.get('kyapay')).toBeInstanceOf(KyaPayAdapter)
  })
})
