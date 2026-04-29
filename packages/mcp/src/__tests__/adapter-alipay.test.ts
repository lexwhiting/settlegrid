/**
 * AlipayAdapter tests (P2.K2).
 */

import { describe, it, expect } from 'vitest'
import {
  AlipayAdapter,
  validateAlipayPayment,
  generateAlipay402Response,
} from '../adapters/alipay'
import { protocolRegistry } from '../adapters'

const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }
const APP_URL = 'https://settlegrid.test'

describe('AlipayAdapter', () => {
  const adapter = new AlipayAdapter()

  it('has correct identity fields', () => {
    expect(adapter.name).toBe('alipay')
    expect(adapter.displayName).toContain('Alipay')
  })

  describe('canHandle', () => {
    it('returns true for x-alipay-agent-token', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-alipay-agent-token': 'alipay-token-abc' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for Bearer alipay_ token', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { authorization: 'Bearer alipay_abc123def456' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: alipay', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-settlegrid-protocol': 'alipay' },
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
    it('extracts token from x-alipay-agent-token', async () => {
      const req = new Request('http://localhost/api/proxy/t', {
        method: 'POST',
        headers: { 'x-alipay-agent-token': 'alipay-token-abcdefghij' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('alipay')
      expect(ctx.identity.value).toBe('alipay-token-abcdefghij')
    })

    it('uses unknown when no token present but protocol header is set', async () => {
      const req = new Request('http://localhost/api/proxy/t', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'alipay' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('alipay')
      expect(ctx.identity.value).toBe('unknown')
    })
  })

  describe('buildChallenge', () => {
    it('returns scheme alipay with costCents and acceptedPayments', () => {
      const entry = adapter.buildChallenge({
        resource: { url: 'http://localhost/api/proxy/t' },
        pricing: { defaultCostCents: 5 },
        method: 'default',
      })
      expect(entry.scheme).toBe('alipay')
      expect(entry.costCents).toBe(5)
      expect(entry.acceptedPayments).toEqual(['alipay-agent-token'])
    })
  })
})

describe('validateAlipayPayment', () => {
  it('returns ALIPAY_NOT_CONFIGURED when enabled=false', async () => {
    const res = await validateAlipayPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('ALIPAY_NOT_CONFIGURED')
  })

  it('returns ALIPAY_TOKEN_MISSING when no token in request', async () => {
    const res = await validateAlipayPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('ALIPAY_TOKEN_MISSING')
  })

  it('returns ALIPAY_TOKEN_INVALID for tokens shorter than 16 chars', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-alipay-agent-token': 'short' },
    })
    const res = await validateAlipayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('ALIPAY_TOKEN_INVALID')
  })

  it('accepts a structurally-valid token (stub)', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-alipay-agent-token': 'alipay-token-long-enough-16plus' },
    })
    const res = await validateAlipayPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
    expect(res.transactionRef).toBeTruthy()
  })
})

describe('generateAlipay402Response', () => {
  it('returns 402 with amount_cny_fen and supported methods', async () => {
    const res = generateAlipay402Response({
      toolSlug: 't',
      costCents: 100,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('alipay-trust')
    expect(body.amount_cents).toBe(100)
    expect(typeof body.amount_cny_fen).toBe('number')
    expect(body.currencies).toEqual(['USD', 'CNY'])
  })
})

describe('AlipayAdapter registry registration', () => {
  it('is registered as "alipay" in the singleton registry', () => {
    expect(protocolRegistry.has('alipay')).toBe(true)
    expect(protocolRegistry.get('alipay')).toBeInstanceOf(AlipayAdapter)
  })
})
