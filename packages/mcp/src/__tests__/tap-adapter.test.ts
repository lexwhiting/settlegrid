/**
 * Unit tests for TAPAdapter (Visa Trusted Agent Protocol), extracted from
 * the apps/web integration test `apps/web/src/lib/__tests__/visa-tap.test.ts`
 * as part of the P1.K1 spec-diff close-out. The apps/web integration test
 * file also exercises Visa-specific token/payment/config type shapes that
 * live in `apps/web/src/lib/settlement/visa-tap/types.ts` and cannot
 * relocate cleanly — but the pure-adapter block (properties, canHandle,
 * extractPaymentContext, formatResponse, formatError) has zero apps/web-
 * specific deps and belongs with the SDK package's adapter test suite.
 *
 * Note: during the deprecation window these tests run in BOTH apps/web's
 * vitest workspace (against the deprecated Layer A stub) and packages/mcp's
 * vitest workspace (against the canonical copy). The duplication resolves
 * when P2.K1 removes the Layer A stub.
 */
import { describe, it, expect } from 'vitest'
import { TAPAdapter } from '../adapters/tap'
import type { SettlementResult } from '../adapters/types'

describe('TAPAdapter', () => {
  const adapter = new TAPAdapter()

  describe('properties', () => {
    it('name is visa-tap', () => {
      expect(adapter.name).toBe('visa-tap')
    })

    it('displayName includes Visa TAP', () => {
      expect(adapter.displayName).toContain('Visa TAP')
    })
  })

  describe('canHandle', () => {
    it('returns true for x-settlegrid-protocol: visa-tap', () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-visa-agent-token header', () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-visa-agent-token': 'visa-token-ref-001' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for no TAP indicators', () => {
      const req = new Request('http://localhost/api/visa/payments')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false when protocol header is different', () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'ap2' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('sets protocol to visa-tap', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('visa-tap')
    })

    it('extracts token from x-visa-agent-token header', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-visa-agent-token': 'visa-token-ref-001' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.type).toBe('tap-token')
      expect(ctx.identity.value).toBe('visa-token-ref-001')
    })

    it('sets payment type to card-token', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: { 'x-settlegrid-protocol': 'visa-tap' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('card-token')
    })

    it('uses x-request-id when present', async () => {
      const req = new Request('http://localhost/api/visa/payments', {
        headers: {
          'x-settlegrid-protocol': 'visa-tap',
          'x-request-id': 'visa-req-123',
        },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('visa-req-123')
    })
  })

  describe('formatResponse (not-yet-available)', () => {
    it('returns 501 with VISA_TAP_NOT_AVAILABLE', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-visa-001',
        costCents: 100,
        metadata: {
          protocol: 'visa-tap',
          latencyMs: 50,
          settlementType: 'real-time',
        },
      }
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error.code).toBe('VISA_TAP_NOT_AVAILABLE')
      expect(body.error.message).toContain('not yet available')
    })
  })

  describe('formatError (not-yet-available)', () => {
    it('returns 501 with VISA_TAP_NOT_AVAILABLE', async () => {
      const error = new Error('Token not found')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)

      expect(res.status).toBe(501)
      const body = await res.json()
      expect(body.error.code).toBe('VISA_TAP_NOT_AVAILABLE')
    })

    it('includes original error message', async () => {
      const error = new Error('Daily limit exceeded')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)

      const body = await res.json()
      expect(body.error.message).toBe('Daily limit exceeded')
    })
  })
})
