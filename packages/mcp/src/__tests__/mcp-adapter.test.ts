import { describe, it, expect } from 'vitest'
import { MCPAdapter } from '../adapters/mcp'
import type { SettlementResult } from '../adapters/types'

describe('MCPAdapter', () => {
  const adapter = new MCPAdapter()

  describe('properties', () => {
    it('has name "mcp"', () => {
      expect(adapter.name).toBe('mcp')
    })

    it('has displayName', () => {
      expect(adapter.displayName).toBe('Model Context Protocol')
    })
  })

  describe('canHandle', () => {
    it('returns true for requests with x-api-key header', () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        headers: { 'x-api-key': 'sg_live_abc123' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for requests with Bearer sg_ token', () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        headers: { Authorization: 'Bearer sg_live_abc123' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for requests without API key', () => {
      const req = new Request('http://localhost/api/sdk/meter')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false for non-sg_ Bearer tokens', () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        headers: { Authorization: 'Bearer some-other-token' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts API key from x-api-key header', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
        headers: {
          'x-api-key': 'sg_live_test123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ method: 'search', toolSlug: 'my-tool' }),
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('mcp')
      expect(ctx.identity.type).toBe('api-key')
      expect(ctx.identity.value).toBe('sg_live_test123')
      expect(ctx.operation.method).toBe('search')
      expect(ctx.operation.service).toBe('my-tool')
      expect(ctx.payment.type).toBe('credit-balance')
      expect(ctx.requestId).toBeTruthy()
    })

    it('extracts API key from Authorization header', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer sg_live_bearer123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('sg_live_bearer123')
    })

    it('throws when no API key found', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
      })

      await expect(adapter.extractPaymentContext(req)).rejects.toThrow('No API key found')
    })

    it('extracts method from MCP _meta', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
        headers: {
          'x-api-key': 'sg_live_test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          _meta: {
            'settlegrid-method': 'classify',
            'settlegrid-service': 'entity-screener',
          },
        }),
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.operation.method).toBe('classify')
      expect(ctx.operation.service).toBe('entity-screener')
    })

    it('uses x-request-id as requestId', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
        headers: {
          'x-api-key': 'sg_live_test',
          'x-request-id': 'custom-req-id-456',
        },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('custom-req-id-456')
    })

    it('defaults method to "default" when body has no method', async () => {
      const req = new Request('http://localhost/api/sdk/meter', {
        method: 'POST',
        headers: { 'x-api-key': 'sg_live_test' },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.operation.method).toBe('default')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with billing metadata', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-123',
        costCents: 5,
        remainingBalanceCents: 995,
        metadata: {
          protocol: 'mcp',
          latencyMs: 12,
          settlementType: 'real-time',
        },
      }

      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(200)
      expect(res.headers.get('X-SettleGrid-Operation-Id')).toBe('op-123')
      expect(res.headers.get('X-SettleGrid-Cost-Cents')).toBe('5')
      expect(res.headers.get('X-SettleGrid-Remaining-Balance')).toBe('995')

      const body = await res.json()
      expect(body._meta.billing.costCents).toBe(5)
      expect(body._meta.billing.remainingBalanceCents).toBe(995)
      expect(body._meta.billing.settlementType).toBe('real-time')
    })
  })

  describe('formatError', () => {
    it('returns 402 for insufficient credits', () => {
      const error = new Error('INSUFFICIENT_CREDITS: balance too low')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)

      expect(res.status).toBe(402)
    })

    it('returns 500 for generic errors', () => {
      const error = new Error('Something went wrong')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)

      expect(res.status).toBe(500)
    })

    it('includes error code in response body', async () => {
      const error = new Error('INSUFFICIENT_CREDITS')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()

      expect(body.error.code).toBe('INSUFFICIENT_CREDITS')
      expect(body.error.message).toBe('INSUFFICIENT_CREDITS')
    })
  })
})
