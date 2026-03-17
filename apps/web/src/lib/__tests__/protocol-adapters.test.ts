import { describe, it, expect, beforeEach } from 'vitest'
import { MCPAdapter } from '@/lib/settlement/adapters/mcp'
import { X402Adapter } from '@/lib/settlement/adapters/x402'
import { AP2Adapter } from '@/lib/settlement/adapters/ap2'
import { TAPAdapter } from '@/lib/settlement/adapters/tap'
import {
  ProtocolRegistry,
  DETECTION_PRIORITY,
  adapterMetrics,
} from '@/lib/settlement/adapters'
import { protocolRegistry } from '@/lib/settlement/adapters'
import type { SettlementResult, ProtocolName } from '@/lib/settlement/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(protocol: ProtocolName): SettlementResult {
  return {
    status: 'settled',
    operationId: `op-${protocol}-001`,
    costCents: 10,
    remainingBalanceCents: 990,
    metadata: {
      protocol,
      latencyMs: 5,
      settlementType: 'real-time',
    },
  }
}

// ─── 1. Auto-registration ────────────────────────────────────────────────────

describe('Auto-registration', () => {
  it('protocolRegistry has all 4 adapters registered on import', () => {
    expect(protocolRegistry.has('mcp')).toBe(true)
    expect(protocolRegistry.has('x402')).toBe(true)
    expect(protocolRegistry.has('ap2')).toBe(true)
    expect(protocolRegistry.has('visa-tap')).toBe(true)
  })

  it('protocolRegistry lists exactly 4 adapters', () => {
    expect(protocolRegistry.list()).toHaveLength(4)
  })

  it('MCP adapter is correct class instance', () => {
    const adapter = protocolRegistry.get('mcp')
    expect(adapter).toBeInstanceOf(MCPAdapter)
    expect(adapter?.displayName).toBe('Model Context Protocol')
  })

  it('x402 adapter is correct class instance', () => {
    const adapter = protocolRegistry.get('x402')
    expect(adapter).toBeInstanceOf(X402Adapter)
    expect(adapter?.displayName).toContain('x402')
  })

  it('AP2 adapter is correct class instance', () => {
    const adapter = protocolRegistry.get('ap2')
    expect(adapter).toBeInstanceOf(AP2Adapter)
    expect(adapter?.displayName).toContain('AP2')
  })

  it('TAP adapter is correct class instance', () => {
    const adapter = protocolRegistry.get('visa-tap')
    expect(adapter).toBeInstanceOf(TAPAdapter)
    expect(adapter?.displayName).toContain('Visa TAP')
  })

  it('importing settlement/adapters does not throw', async () => {
    const mod = await import('@/lib/settlement/adapters')
    expect(mod.protocolRegistry).toBeDefined()
    expect(mod.protocolRegistry.list().length).toBeGreaterThanOrEqual(4)
  })
})

// ─── 2. Error format standardization ─────────────────────────────────────────

describe('Error format standardization', () => {
  const adapters = [
    { name: 'mcp' as const, Adapter: MCPAdapter },
    { name: 'x402' as const, Adapter: X402Adapter },
    { name: 'ap2' as const, Adapter: AP2Adapter },
    { name: 'visa-tap' as const, Adapter: TAPAdapter },
  ]

  for (const { name, Adapter } of adapters) {
    describe(`${name} formatError`, () => {
      const adapter = new Adapter()

      it('includes error.code field', async () => {
        const error = new Error('test error')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.code).toBeDefined()
        expect(typeof body.error.code).toBe('string')
      })

      it('includes error.message field', async () => {
        const error = new Error('Something went wrong')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.message).toBeDefined()
        expect(typeof body.error.message).toBe('string')
      })

      it('includes error.protocol field matching adapter name', async () => {
        const error = new Error('test')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.protocol).toBe(name)
      })

      it('includes error.timestamp as ISO string', async () => {
        const error = new Error('test')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.timestamp).toBeDefined()
        // Validate ISO 8601 format
        expect(new Date(body.error.timestamp).toISOString()).toBe(body.error.timestamp)
      })

      it('includes error.requestId from x-request-id header', async () => {
        const error = new Error('test')
        const req = new Request('http://localhost', {
          headers: { 'x-request-id': 'req-std-001' },
        })
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.requestId).toBe('req-std-001')
      })

      it('sets error.requestId to null when header missing', async () => {
        const error = new Error('test')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        const body = await res.json()
        expect(body.error.requestId).toBeNull()
      })

      it('returns Content-Type: application/json', () => {
        const error = new Error('test')
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        expect(res.headers.get('Content-Type')).toBe('application/json')
      })
    })
  }

  it('all adapters produce identical error structure keys', async () => {
    const error = new Error('universal test error')
    const req = new Request('http://localhost', {
      headers: { 'x-request-id': 'req-compare' },
    })

    const bodies = await Promise.all(
      adapters.map(async ({ Adapter }) => {
        const adapter = new Adapter()
        const res = adapter.formatError(error, req)
        return res.json()
      })
    )

    const expectedKeys = ['code', 'message', 'protocol', 'timestamp', 'requestId']
    for (const body of bodies) {
      const keys = Object.keys(body.error).sort()
      expect(keys).toEqual(expectedKeys.sort())
    }
  })
})

// ─── 3. Protocol detection priority ──────────────────────────────────────────

describe('Protocol detection priority', () => {
  it('DETECTION_PRIORITY is x402 > ap2 > visa-tap > mcp', () => {
    expect(DETECTION_PRIORITY).toEqual(['x402', 'ap2', 'visa-tap', 'mcp'])
  })

  it('registry exposes detectionPriority', () => {
    const registry = new ProtocolRegistry()
    expect(registry.detectionPriority).toEqual(['x402', 'ap2', 'visa-tap', 'mcp'])
  })

  describe('conflicting headers', () => {
    let registry: ProtocolRegistry

    beforeEach(() => {
      registry = new ProtocolRegistry()
      registry.register(new X402Adapter())
      registry.register(new AP2Adapter())
      registry.register(new TAPAdapter())
      registry.register(new MCPAdapter())
    })

    it('x402 wins over MCP when both x-api-key and payment-signature present', () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        headers: {
          'x-api-key': 'sg_live_abc123',
          'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('x402')
    })

    it('AP2 wins over MCP when both x-api-key and x-ap2-mandate present', () => {
      const req = new Request('http://localhost/api/a2a/skills', {
        headers: {
          'x-api-key': 'sg_live_abc123',
          'x-ap2-mandate': 'mandate-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('ap2')
    })

    it('visa-tap wins over MCP when both x-api-key and x-visa-agent-token present', () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: {
          'x-api-key': 'sg_live_abc123',
          'x-visa-agent-token': 'visa-token-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('visa-tap')
    })

    it('x402 wins over AP2 when both payment-signature and x-ap2-mandate present', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
          'x-ap2-mandate': 'mandate-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('x402')
    })

    it('x402 wins over visa-tap when both payment-signature and x-visa-agent-token present', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
          'x-visa-agent-token': 'visa-token-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('x402')
    })

    it('AP2 wins over visa-tap when both x-ap2-mandate and x-visa-agent-token present', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'x-ap2-mandate': 'mandate-ref-001',
          'x-visa-agent-token': 'visa-token-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('ap2')
    })

    it('MCP is fallback when only x-api-key present', () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        headers: { 'x-api-key': 'sg_live_abc123' },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('mcp')
    })

    it('all four headers: x402 still wins', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'x-api-key': 'sg_live_abc123',
          'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
          'x-ap2-mandate': 'mandate-ref-001',
          'x-visa-agent-token': 'visa-token-ref-001',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('x402')
    })

    it('explicit x-settlegrid-protocol: x402 forces x402', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'x-settlegrid-protocol': 'x402',
          'x-api-key': 'sg_live_abc123',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('x402')
    })

    it('explicit x-settlegrid-protocol: ap2 forces ap2', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'x-settlegrid-protocol': 'ap2',
          'x-api-key': 'sg_live_abc123',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('ap2')
    })

    it('explicit x-settlegrid-protocol: visa-tap forces visa-tap', () => {
      const req = new Request('http://localhost/api/settle', {
        headers: {
          'x-settlegrid-protocol': 'visa-tap',
          'x-api-key': 'sg_live_abc123',
        },
      })
      const adapter = registry.detect(req)
      expect(adapter?.name).toBe('visa-tap')
    })
  })
})

// ─── 4. Adapter metrics ─────────────────────────────────────────────────────

describe('Adapter metrics', () => {
  beforeEach(() => {
    adapterMetrics.reset()
  })

  it('starts with zero counters', () => {
    const m = adapterMetrics.getMetrics('mcp')
    expect(m.invocations).toBe(0)
    expect(m.errors).toBe(0)
    expect(m.lastInvokedAt).toBeNull()
    expect(m.lastErrorAt).toBeNull()
  })

  it('recordInvocation increments invocation count', () => {
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('mcp')
    expect(adapterMetrics.getMetrics('mcp').invocations).toBe(3)
  })

  it('recordError increments error count', () => {
    adapterMetrics.recordError('x402')
    adapterMetrics.recordError('x402')
    expect(adapterMetrics.getMetrics('x402').errors).toBe(2)
  })

  it('recordInvocation sets lastInvokedAt', () => {
    const before = new Date().toISOString()
    adapterMetrics.recordInvocation('ap2')
    const m = adapterMetrics.getMetrics('ap2')
    expect(m.lastInvokedAt).not.toBeNull()
    expect(m.lastInvokedAt! >= before).toBe(true)
  })

  it('recordError sets lastErrorAt', () => {
    const before = new Date().toISOString()
    adapterMetrics.recordError('visa-tap')
    const m = adapterMetrics.getMetrics('visa-tap')
    expect(m.lastErrorAt).not.toBeNull()
    expect(m.lastErrorAt! >= before).toBe(true)
  })

  it('getAllMetrics returns all 4 protocols', () => {
    const all = adapterMetrics.getAllMetrics()
    expect(Object.keys(all)).toHaveLength(4)
    expect(all.mcp).toBeDefined()
    expect(all.x402).toBeDefined()
    expect(all.ap2).toBeDefined()
    expect(all['visa-tap']).toBeDefined()
  })

  it('getAllMetrics reflects recorded data', () => {
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('x402')
    adapterMetrics.recordError('ap2')

    const all = adapterMetrics.getAllMetrics()
    expect(all.mcp.invocations).toBe(1)
    expect(all.x402.invocations).toBe(1)
    expect(all.ap2.errors).toBe(1)
    expect(all['visa-tap'].invocations).toBe(0)
  })

  it('reset() clears all counters', () => {
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('x402')
    adapterMetrics.recordError('ap2')
    adapterMetrics.reset()

    expect(adapterMetrics.getMetrics('mcp').invocations).toBe(0)
    expect(adapterMetrics.getMetrics('x402').invocations).toBe(0)
    expect(adapterMetrics.getMetrics('ap2').errors).toBe(0)
  })

  it('invocations and errors are independent counters', () => {
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordError('mcp')

    const m = adapterMetrics.getMetrics('mcp')
    expect(m.invocations).toBe(2)
    expect(m.errors).toBe(1)
  })

  it('different protocols track independently', () => {
    adapterMetrics.recordInvocation('mcp')
    adapterMetrics.recordInvocation('x402')
    adapterMetrics.recordInvocation('x402')

    expect(adapterMetrics.getMetrics('mcp').invocations).toBe(1)
    expect(adapterMetrics.getMetrics('x402').invocations).toBe(2)
    expect(adapterMetrics.getMetrics('ap2').invocations).toBe(0)
  })
})

// ─── 5. Edge cases: empty, malformed, conflicting headers ────────────────────

describe('Protocol detection edge cases', () => {
  let registry: ProtocolRegistry

  beforeEach(() => {
    registry = new ProtocolRegistry()
    registry.register(new X402Adapter())
    registry.register(new AP2Adapter())
    registry.register(new TAPAdapter())
    registry.register(new MCPAdapter())
  })

  it('empty headers returns undefined (no adapter matches)', () => {
    const req = new Request('http://localhost/api/sdk/meter')
    expect(registry.detect(req)).toBeUndefined()
  })

  it('empty x-api-key header (empty string) still matches MCP', () => {
    // Request constructor sets the header but with empty value
    const req = new Request('http://localhost/api/sdk/meter', {
      headers: { 'x-api-key': '' },
    })
    // MCP canHandle checks !== null, empty string is not null
    expect(registry.detect(req)?.name).toBe('mcp')
  })

  it('empty payment-signature matches x402', () => {
    const req = new Request('http://localhost/api/settle', {
      headers: { 'payment-signature': '' },
    })
    expect(registry.detect(req)?.name).toBe('x402')
  })

  it('Authorization header without sg_ prefix does not match MCP', () => {
    const req = new Request('http://localhost/api/sdk/meter', {
      headers: { Authorization: 'Bearer some-other-token' },
    })
    expect(registry.detect(req)).toBeUndefined()
  })

  it('unknown x-settlegrid-protocol value matches nothing specific', () => {
    const req = new Request('http://localhost/api/settle', {
      headers: { 'x-settlegrid-protocol': 'unknown-proto' },
    })
    // No adapter recognizes this, and no other protocol headers present
    expect(registry.detect(req)).toBeUndefined()
  })

  it('x-settlegrid-protocol: mcp does not match MCP adapter (MCP uses API keys not protocol header)', () => {
    const req = new Request('http://localhost/api/sdk/meter', {
      headers: { 'x-settlegrid-protocol': 'mcp' },
    })
    // MCP canHandle only checks for x-api-key or Bearer sg_
    expect(registry.detect(req)).toBeUndefined()
  })

  it('malformed base64 in payment-signature still detects x402 (validation happens in extractPaymentContext)', () => {
    const req = new Request('http://localhost/api/settle', {
      headers: { 'payment-signature': 'not-valid-base64!!!' },
    })
    expect(registry.detect(req)?.name).toBe('x402')
  })

  it('x402 extractPaymentContext throws on malformed base64', async () => {
    const adapter = new X402Adapter()
    const req = new Request('http://localhost/api/settle', {
      headers: { 'payment-signature': 'not-valid-base64!!!' },
    })
    await expect(adapter.extractPaymentContext(req)).rejects.toThrow()
  })

  it('MCP extractPaymentContext throws when no API key in headers', async () => {
    const adapter = new MCPAdapter()
    const req = new Request('http://localhost/api/sdk/meter', {
      method: 'POST',
    })
    await expect(adapter.extractPaymentContext(req)).rejects.toThrow('No API key found')
  })

  it('AP2 extractPaymentContext handles missing body gracefully', async () => {
    const adapter = new AP2Adapter()
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2' },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('ap2')
    expect(ctx.operation.method).toBe('default')
  })

  it('MCP extractPaymentContext handles non-JSON body gracefully', async () => {
    const adapter = new MCPAdapter()
    const req = new Request('http://localhost/api/sdk/meter', {
      method: 'POST',
      headers: {
        'x-api-key': 'sg_live_test',
        'Content-Type': 'text/plain',
      },
      body: 'not json',
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('mcp')
    expect(ctx.operation.method).toBe('default')
  })
})

// ─── 6. AP2 mandate types ────────────────────────────────────────────────────

describe('AP2Adapter mandate type handling', () => {
  const adapter = new AP2Adapter()

  it('IntentMandate: payment type is credit-balance (no "Payment" in type name)', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'verify_intent_mandate',
        params: {
          consumerId: 'consumer-001',
          mandate: {
            type: 'ap2.mandates.IntentMandate',
            version: '0.1',
            mandateId: 'intent-001',
            shoppingIntent: {
              category: 'mcp-tools',
              maxBudgetCents: 5000,
              currency: 'USD',
            },
          },
        },
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.protocol).toBe('ap2')
    // IntentMandate does not contain "Payment" so type should be credit-balance
    expect(ctx.payment.type).toBe('credit-balance')
    expect(ctx.identity.metadata?.mandateType).toBe('ap2.mandates.IntentMandate')
  })

  it('CartMandate: payment type is credit-balance (no "Payment" in type name)', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'verify_cart_mandate',
        params: {
          consumerId: 'consumer-001',
          mandate: {
            type: 'ap2.mandates.CartMandate',
            merchantId: 'merchant-001',
            lineItems: [],
            totalAmountCents: 0,
          },
        },
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.type).toBe('credit-balance')
    expect(ctx.identity.metadata?.mandateType).toBe('ap2.mandates.CartMandate')
  })

  it('PaymentMandate: payment type is vdc (contains "Payment" in type name)', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'process_payment',
        params: {
          consumerId: 'consumer-001',
          mandate: {
            type: 'ap2.mandates.PaymentMandate',
            cartMandateRef: 'cart-001',
            paymentMethod: 'settlegrid_balance',
            amountCents: 250,
          },
        },
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.type).toBe('vdc')
    expect(ctx.identity.metadata?.mandateType).toBe('ap2.mandates.PaymentMandate')
  })

  it('extracts consumerId from params', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'get_eligible_payment_methods',
        params: { consumerId: 'consumer-unique-123' },
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('consumer-unique-123')
  })

  it('falls back to x-ap2-consumer-id header when no body consumerId', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'x-ap2-consumer-id': 'header-consumer-456',
      },
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('header-consumer-456')
  })

  it('falls back to "anonymous" when no consumerId available', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: { 'x-settlegrid-protocol': 'ap2' },
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('anonymous')
  })

  it('extracts mandateRef as payment proof', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'process_payment',
        mandateRef: 'mandate-ref-unique-789',
        params: { consumerId: 'consumer-001' },
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBe('mandate-ref-unique-789')
  })

  it('service is always ap2-credentials-provider', async () => {
    const req = new Request('http://localhost/api/a2a/skills', {
      method: 'POST',
      headers: {
        'x-settlegrid-protocol': 'ap2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skill: 'any_skill',
        params: {},
      }),
    })

    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.operation.service).toBe('ap2-credentials-provider')
  })
})

// ─── 7. TAP adapter 501 responses ────────────────────────────────────────────

describe('TAPAdapter 501 responses', () => {
  const adapter = new TAPAdapter()

  describe('formatResponse always returns 501', () => {
    it('returns 501 even for a "settled" result', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(501)
    })

    it('body contains VISA_TAP_NOT_AVAILABLE code', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.code).toBe('VISA_TAP_NOT_AVAILABLE')
    })

    it('message mentions sandbox access requirement', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.message).toContain('sandbox')
      expect(body.error.message).toContain('not yet available')
    })

    it('message suggests alternatives (SettleGrid balance or AP2)', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.message).toContain('SettleGrid balance')
      expect(body.error.message).toContain('AP2')
    })

    it('includes sandboxInfo with status and alternatives', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.sandboxInfo).toBeDefined()
      expect(body.error.sandboxInfo.status).toBe('pending')
      expect(body.error.sandboxInfo.alternative).toContain('mcp')
      expect(body.error.sandboxInfo.alternative).toContain('ap2')
    })

    it('includes protocol field', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.protocol).toBe('visa-tap')
    })

    it('includes timestamp', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.timestamp).toBeDefined()
      expect(new Date(body.error.timestamp).toISOString()).toBe(body.error.timestamp)
    })

    it('includes requestId from header', async () => {
      const result = makeResult('visa-tap')
      const req = new Request('http://localhost', {
        headers: { 'x-request-id': 'tap-req-001' },
      })
      const res = adapter.formatResponse(result, req)
      const body = await res.json()

      expect(body.error.requestId).toBe('tap-req-001')
    })
  })

  describe('formatError always returns 501', () => {
    it('returns 501 regardless of error type', async () => {
      const errors = [
        new Error('Token not found'),
        new Error('Daily limit exceeded'),
        new Error('Network timeout'),
        new Error('insufficient funds'),
        new Error(''),
      ]

      for (const error of errors) {
        const req = new Request('http://localhost')
        const res = adapter.formatError(error, req)
        expect(res.status).toBe(501)
      }
    })

    it('preserves original error message', async () => {
      const error = new Error('Custom visa error message')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()

      expect(body.error.message).toBe('Custom visa error message')
    })

    it('falls back to default message for empty error', async () => {
      const error = new Error('')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()

      expect(body.error.message).toBe('Visa TAP integration is not yet available.')
    })

    it('includes protocol: visa-tap in error body', async () => {
      const error = new Error('test')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()

      expect(body.error.protocol).toBe('visa-tap')
    })
  })

  describe('extractPaymentContext still works (for logging/auditing)', () => {
    it('identity type is tap-token', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-visa-agent-token': 'tok-abc' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.type).toBe('tap-token')
      expect(ctx.identity.value).toBe('tok-abc')
    })

    it('falls back to "unknown" when no token header', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('unknown')
    })

    it('payment type is card-token', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('card-token')
    })

    it('operation service and method set correctly', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.operation.service).toBe('visa-tap')
      expect(ctx.operation.method).toBe('payment')
    })
  })
})

// ─── X402 adapter edge cases ─────────────────────────────────────────────────

describe('X402Adapter extractPaymentContext edge cases', () => {
  const adapter = new X402Adapter()

  it('extracts payer address from exact scheme', async () => {
    const payload = {
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        authorization: { from: '0xABC123' },
      },
    }
    const req = new Request('http://localhost', {
      headers: {
        'payment-signature': Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('0xABC123')
    expect(ctx.payment.type).toBe('eip3009')
    expect(ctx.operation.method).toBe('transferWithAuthorization')
  })

  it('extracts payer from upto scheme', async () => {
    const payload = {
      scheme: 'upto',
      network: 'eip155:8453',
      payload: {
        witness: { recipient: '0xDEF456' },
      },
    }
    const req = new Request('http://localhost', {
      headers: {
        'payment-signature': Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('0xDEF456')
    expect(ctx.payment.type).toBe('permit2')
    expect(ctx.operation.method).toBe('permitWitnessTransferFrom')
  })

  it('defaults to eip155:8453 network when not specified', async () => {
    const payload = { scheme: 'exact', payload: { authorization: { from: '0x123' } } }
    const req = new Request('http://localhost', {
      headers: {
        'payment-signature': Buffer.from(JSON.stringify(payload)).toString('base64'),
      },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.identity.value).toBe('0x123')
  })

  it('throws for missing payment-signature header', async () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'x402' },
    })
    await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
      'Missing PAYMENT-SIGNATURE header'
    )
  })

  it('throws for invalid base64 in payment-signature', async () => {
    const req = new Request('http://localhost', {
      headers: { 'payment-signature': '!!!invalid-base64!!!' },
    })
    await expect(adapter.extractPaymentContext(req)).rejects.toThrow()
  })

  it('proof field contains the original payment-signature header', async () => {
    const payload = { scheme: 'exact', payload: { authorization: { from: '0x123' } } }
    const sig = Buffer.from(JSON.stringify(payload)).toString('base64')
    const req = new Request('http://localhost', {
      headers: { 'payment-signature': sig },
    })
    const ctx = await adapter.extractPaymentContext(req)
    expect(ctx.payment.proof).toBe(sig)
  })
})

// ─── Cross-adapter formatResponse comparison ─────────────────────────────────

describe('Cross-adapter response consistency', () => {
  it('MCP formatResponse includes _meta.billing', async () => {
    const adapter = new MCPAdapter()
    const result = makeResult('mcp')
    const req = new Request('http://localhost')
    const res = adapter.formatResponse(result, req)
    const body = await res.json()

    expect(body._meta).toBeDefined()
    expect(body._meta.billing.costCents).toBe(10)
    expect(body._meta.billing.remainingBalanceCents).toBe(990)
  })

  it('x402 formatResponse includes txHash field', async () => {
    const adapter = new X402Adapter()
    const result: SettlementResult = {
      ...makeResult('x402'),
      txHash: '0xabc123',
    }
    const req = new Request('http://localhost')
    const res = adapter.formatResponse(result, req)
    const body = await res.json()

    expect(body.txHash).toBe('0xabc123')
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xabc123')
  })

  it('AP2 formatResponse includes protocol header', async () => {
    const adapter = new AP2Adapter()
    const result = makeResult('ap2')
    const req = new Request('http://localhost')
    const res = adapter.formatResponse(result, req)

    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('ap2')
  })

  it('all non-TAP adapters return 200 for success', () => {
    const testAdapters = [new MCPAdapter(), new X402Adapter(), new AP2Adapter()]
    for (const adapter of testAdapters) {
      const result = makeResult(adapter.name)
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)
    }
  })
})
