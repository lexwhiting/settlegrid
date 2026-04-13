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
import { AP2Adapter } from '../adapters/ap2'
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
