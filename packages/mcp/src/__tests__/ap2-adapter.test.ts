/**
 * Unit tests for AP2Adapter, extracted from the apps/web integration test
 * `apps/web/src/lib/__tests__/ap2.test.ts` as part of the P1.K1 spec-diff
 * close-out. The apps/web integration test file still exercises AP2
 * credentials, JWT signing/verification, and VDC validation alongside the
 * adapter, so it cannot relocate cleanly — but the pure-adapter describe
 * block (properties, canHandle, extractPaymentContext, formatResponse,
 * formatError) has zero apps/web-specific deps and belongs with the SDK
 * package's adapter test suite.
 *
 * Note: during the deprecation window these tests run in BOTH apps/web's
 * vitest workspace (against the deprecated Layer A stub) and packages/mcp's
 * vitest workspace (against the canonical copy). This duplication is
 * intentional and will resolve automatically when P2.K1 removes the
 * Layer A stub.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import {
  AP2Adapter,
  validateAp2CredentialString,
  validateAp2Payment,
  type Ap2ValidateOptions,
} from '../adapters/ap2'
import type { SettlementResult } from '../adapters/types'

const TEST_CONSUMER_ID = '12345678-1234-1234-1234-123456789abc'

describe('AP2Adapter', () => {
  const adapter = new AP2Adapter()

  describe('properties', () => {
    it('name is ap2', () => {
      expect(adapter.name).toBe('ap2')
    })

    it('displayName includes Google', () => {
      expect(adapter.displayName).toContain('AP2')
      expect(adapter.displayName).toContain('Google')
    })
  })

  describe('canHandle', () => {
    it('returns true for x-settlegrid-protocol: ap2', () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        headers: { 'x-settlegrid-protocol': 'ap2' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-ap2-mandate header', () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        headers: { 'x-ap2-mandate': 'mandate-ref-123' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for no AP2 indicators', () => {
      const req = new Request('http://localhost/api/a2a/skills')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false when protocol header is different', () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        headers: { 'x-settlegrid-protocol': 'mcp' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts skill from JSON body', async () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        method: 'POST',
        headers: {
          'x-settlegrid-protocol': 'ap2',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skill: 'get_eligible_payment_methods',
          params: { consumerId: TEST_CONSUMER_ID },
        }),
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('ap2')
      expect(ctx.operation.method).toBe('get_eligible_payment_methods')
      expect(ctx.identity.value).toBe(TEST_CONSUMER_ID)
    })

    it('sets protocol to ap2', async () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'ap2' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('ap2')
    })

    it('uses x-request-id when present', async () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        method: 'POST',
        headers: {
          'x-settlegrid-protocol': 'ap2',
          'x-request-id': 'custom-req-999',
        },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('custom-req-999')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with AP2 fields', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-ap2-001',
        costCents: 25,
        remainingBalanceCents: 975,
        metadata: {
          protocol: 'ap2',
          latencyMs: 45,
          settlementType: 'real-time',
        },
      }
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('ap2')

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.operationId).toBe('op-ap2-001')
      expect(body.costCents).toBe(25)
      expect(body.metadata.protocol).toBe('ap2')
    })
  })

  describe('formatError', () => {
    it('returns 402 for mandate errors', () => {
      const error = new Error('mandate expired')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(402)
    })

    it('returns 402 for credential errors', () => {
      const error = new Error('credential not valid')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(402)
    })

    it('returns 500 for generic errors', () => {
      const error = new Error('something broke')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(500)
    })

    it('includes AP2_PAYMENT_ERROR code for payment errors', async () => {
      const error = new Error('insufficient balance')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()
      expect(body.error.code).toBe('AP2_PAYMENT_ERROR')
    })
  })
})

// ─── P5 — credential propagation + validateAp2CredentialString core ────────

const AP2_SECRET = 'test-ap2-secret'

/**
 * Sign a VDC JWT the way the AP2 credentials provider does: HMAC-SHA256
 * over `${header}.${body}`, base64url. Kept local so the package test has
 * no apps/web dependency.
 */
function signVdc(claims: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}

function freshClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return {
    iss: 'settlegrid.ai',
    sub: 'consumer-123',
    aud: 'settlegrid_platform',
    iat: now,
    exp: now + 3600,
    mandate_type: 'ap2.mandates.PaymentMandate',
    mandate_id: 'mandate-1',
    payment_method: 'settlegrid_balance',
    amount_cents: 100,
    currency: 'USD',
    ...overrides,
  }
}

function opts(overrides: Partial<Ap2ValidateOptions> = {}): Ap2ValidateOptions {
  return {
    enabled: true,
    toolConfig: { slug: 'demo', costCents: 50, displayName: 'Demo' },
    signingSecret: AP2_SECRET,
    ...overrides,
  }
}

describe('AP2Adapter extractPaymentContext — credential propagation (P5)', () => {
  const adapter = new AP2Adapter()

  it('captures the x-ap2-credential VDC into payment.proof', async () => {
    const vdc = signVdc(freshClaims(), AP2_SECRET)
    const req = new Request('http://localhost/api/a2a', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2', 'x-ap2-credential': vdc },
      body: JSON.stringify({ skill: 'demo' }),
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBe(vdc)
  })

  it('captures a `Bearer ap2_<jwt>` credential into payment.proof (prefix stripped)', async () => {
    const vdc = signVdc(freshClaims(), AP2_SECRET)
    const req = new Request('http://localhost/api/a2a', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        authorization: `Bearer ap2_${vdc}`,
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBe(vdc)
  })

  it('falls back to mandateRef in proof + preserves it in identity.metadata when no credential', async () => {
    const req = new Request('http://localhost/api/a2a', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2' },
      body: JSON.stringify({ mandateRef: 'mref-9' }),
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBe('mref-9')
    expect(ctx.identity.metadata?.mandateRef).toBe('mref-9')
  })

  it('leaves proof undefined when neither a credential nor a mandateRef is present', async () => {
    const req = new Request('http://localhost/api/a2a', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2' },
      body: JSON.stringify({ skill: 'demo' }),
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBeUndefined()
  })
})

describe('validateAp2CredentialString (P5 core)', () => {
  it('returns valid for a correctly-signed, unexpired, sufficient VDC', async () => {
    const vdc = signVdc(freshClaims({ amount_cents: 100 }), AP2_SECRET)
    const result = await validateAp2CredentialString(vdc, opts())
    expect(result.valid).toBe(true)
    expect(result.consumerId).toBe('consumer-123')
    expect(result.transactionId).toBeTruthy()
  })

  it('AP2_NOT_CONFIGURED when disabled', async () => {
    const vdc = signVdc(freshClaims(), AP2_SECRET)
    const result = await validateAp2CredentialString(vdc, opts({ enabled: false }))
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_NOT_CONFIGURED')
  })

  it('AP2_CREDENTIAL_MISSING when credential is null', async () => {
    const result = await validateAp2CredentialString(null, opts())
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_CREDENTIAL_MISSING')
  })

  it('AP2_NOT_CONFIGURED when the signing secret is absent', async () => {
    const vdc = signVdc(freshClaims(), AP2_SECRET)
    const result = await validateAp2CredentialString(
      vdc,
      opts({ signingSecret: undefined }),
    )
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_NOT_CONFIGURED')
  })

  it('AP2_CREDENTIAL_INVALID when signed with a different secret', async () => {
    const vdc = signVdc(freshClaims(), 'wrong-secret')
    const result = await validateAp2CredentialString(vdc, opts())
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_CREDENTIAL_INVALID')
  })

  it('AP2_CREDENTIAL_EXPIRED when exp is in the past', async () => {
    const past = Math.floor(Date.now() / 1000) - 10
    const vdc = signVdc(freshClaims({ exp: past }), AP2_SECRET)
    const result = await validateAp2CredentialString(vdc, opts())
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_CREDENTIAL_EXPIRED')
  })

  it('AP2_AMOUNT_MISMATCH when the authorized amount is below the tool cost', async () => {
    const vdc = signVdc(freshClaims({ amount_cents: 10 }), AP2_SECRET)
    const result = await validateAp2CredentialString(vdc, opts())
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_AMOUNT_MISMATCH')
  })

  it('AP2_CREDENTIAL_INVALID when the issuer claim mismatches', async () => {
    const vdc = signVdc(freshClaims({ iss: 'evil.example' }), AP2_SECRET)
    const result = await validateAp2CredentialString(vdc, opts())
    expect(result.valid).toBe(false)
    expect(result.error?.code).toBe('AP2_CREDENTIAL_INVALID')
  })

  it('validateAp2Payment(request) delegates to the same core (header credential)', async () => {
    const vdc = signVdc(freshClaims({ amount_cents: 100 }), AP2_SECRET)
    const req = new Request('http://localhost/api/a2a', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2', 'x-ap2-credential': vdc },
    })
    const result = await validateAp2Payment(req, opts())
    expect(result.valid).toBe(true)
    expect(result.consumerId).toBe('consumer-123')
  })
})
