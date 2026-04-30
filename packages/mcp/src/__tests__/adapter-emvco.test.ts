/**
 * EmvcoAdapter tests (P2.K2).
 */

import { describe, it, expect } from 'vitest'
import {
  EmvcoAdapter,
  EMVCO_NETWORKS,
  validateEmvcoPayment,
  generateEmvco402Response,
} from '../adapters/emvco'
import { protocolRegistry } from '../adapters'

const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }
const APP_URL = 'https://settlegrid.test'
const LONG_TOKEN = 'emvco-token-long-enough-for-validation'

describe('EmvcoAdapter', () => {
  const adapter = new EmvcoAdapter()

  it('has correct identity fields', () => {
    expect(adapter.name).toBe('emvco')
    expect(adapter.displayName).toContain('EMVCo')
  })

  describe('canHandle', () => {
    it('returns true for x-emvco-agent-token', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-emvco-agent-token': 'emv-token' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: emvco', () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: { 'x-settlegrid-protocol': 'emvco' },
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
    it('extracts token + network + 3ds ref', async () => {
      const req = new Request('http://localhost/api/proxy/t', {
        headers: {
          'x-emvco-agent-token': LONG_TOKEN,
          'x-emvco-network': 'visa',
          'x-emvco-3ds-ref': '3ds-ref-abc',
        },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('emvco')
      expect(ctx.identity.value).toBe(LONG_TOKEN)
      expect(ctx.identity.metadata?.network).toBe('visa')
      expect(ctx.identity.metadata?.threeDsRef).toBe('3ds-ref-abc')
    })
  })

  describe('buildChallenge', () => {
    it('returns scheme emvco with supported networks', () => {
      const entry = adapter.buildChallenge({
        resource: { url: 'http://localhost/api/proxy/t' },
        pricing: { defaultCostCents: 5 },
      })
      expect(entry.scheme).toBe('emvco')
      expect(entry.supportedNetworks).toEqual([...EMVCO_NETWORKS])
    })
  })
})

describe('validateEmvcoPayment', () => {
  it('returns EMVCO_NOT_CONFIGURED when enabled=false', async () => {
    const res = await validateEmvcoPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('EMVCO_NOT_CONFIGURED')
  })

  it('returns EMVCO_TOKEN_MISSING without x-emvco-agent-token', async () => {
    const res = await validateEmvcoPayment(new Request('http://localhost/api/proxy/t'), {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('EMVCO_TOKEN_MISSING')
  })

  it('returns EMVCO_TOKEN_INVALID for tokens shorter than 16 chars', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-emvco-agent-token': 'short' },
    })
    const res = await validateEmvcoPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('EMVCO_TOKEN_INVALID')
  })

  it('returns EMVCO_NETWORK_UNSUPPORTED for unsupported networks', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: {
        'x-emvco-agent-token': LONG_TOKEN,
        'x-emvco-network': 'dinersclub',
      },
    })
    const res = await validateEmvcoPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.error?.code).toBe('EMVCO_NETWORK_UNSUPPORTED')
  })

  it('accepts a structurally-valid token', async () => {
    const req = new Request('http://localhost/api/proxy/t', {
      headers: { 'x-emvco-agent-token': LONG_TOKEN },
    })
    const res = await validateEmvcoPayment(req, {
      enabled: true,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(true)
    expect(res.transactionRef).toBeTruthy()
  })
})

describe('generateEmvco402Response', () => {
  it('returns 402 with supported_networks list', async () => {
    const res = generateEmvco402Response({
      toolSlug: 't',
      costCents: 25,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('emvco')
    expect(body.supported_networks).toEqual([...EMVCO_NETWORKS])
  })
})

describe('EmvcoAdapter registry registration', () => {
  it('is registered as "emvco" in the singleton registry', () => {
    expect(protocolRegistry.has('emvco')).toBe(true)
    expect(protocolRegistry.get('emvco')).toBeInstanceOf(EmvcoAdapter)
  })
})
