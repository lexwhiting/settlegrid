/**
 * Unit tests for X402Adapter, extracted from the apps/web integration test
 * `apps/web/src/lib/__tests__/x402.test.ts` as part of the P1.K1 spec-diff
 * close-out. The apps/web integration test file also exercises EIP-3009
 * verification, Permit2 settlement, viem mocks, Redis caching, and full
 * route handlers — so it cannot relocate cleanly. The pure-adapter block
 * (properties, canHandle, extractPaymentContext, formatResponse,
 * formatError) has zero apps/web-specific deps and belongs with the SDK
 * package's adapter test suite.
 *
 * Note: during the deprecation window these tests run in BOTH apps/web's
 * vitest workspace (against the deprecated Layer A stub) and packages/mcp's
 * vitest workspace (against the canonical copy). The duplication resolves
 * when P2.K1 removes the Layer A stub.
 */
import { describe, it, expect } from 'vitest'
import { X402Adapter } from '../adapters/x402'
import type { SettlementResult } from '../adapters/types'

describe('X402Adapter', () => {
  const adapter = new X402Adapter()

  describe('properties', () => {
    it('name is x402', () => {
      expect(adapter.name).toBe('x402')
    })

    it('displayName is x402 Protocol (Coinbase)', () => {
      expect(adapter.displayName).toBe('x402 Protocol (Coinbase)')
    })
  })

  describe('canHandle', () => {
    it('returns true for payment-signature header', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': 'base64payload' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns true for x-settlegrid-protocol: x402', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'x402' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('returns false for no x402 indicators', () => {
      const req = new Request('http://localhost/api/x402/verify')
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('returns false when protocol header has different value', () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'x-settlegrid-protocol': 'mcp' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    function makeBase64Payload(data: Record<string, unknown>): string {
      return Buffer.from(JSON.stringify(data)).toString('base64')
    }

    it('parses base64 PAYMENT-SIGNATURE header', async () => {
      const payloadData = {
        scheme: 'exact',
        network: 'eip155:8453',
        payload: {
          authorization: {
            from: '0x1234567890abcdef1234567890abcdef12345678',
          },
        },
      }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
      expect(ctx.identity.value).toBe('0x1234567890abcdef1234567890abcdef12345678')
    })

    it('throws on missing header', async () => {
      const req = new Request('http://localhost/api/x402/verify')
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Missing PAYMENT-SIGNATURE header'
      )
    })

    it('throws on invalid base64', async () => {
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': '!!!not-valid-base64!!!' },
      })
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow(
        'Invalid base64'
      )
    })

    it('sets protocol to x402', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('x402')
    })

    it('sets payment type to eip3009 for exact scheme', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('eip3009')
    })

    it('sets payment type to permit2 for upto scheme', async () => {
      const payloadData = { scheme: 'upto', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: { 'payment-signature': makeBase64Payload(payloadData) },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('permit2')
    })

    it('uses x-request-id when present', async () => {
      const payloadData = { scheme: 'exact', network: 'eip155:8453', payload: {} }
      const req = new Request('http://localhost/api/x402/verify', {
        headers: {
          'payment-signature': makeBase64Payload(payloadData),
          'x-request-id': 'custom-id-789',
        },
      })

      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.requestId).toBe('custom-id-789')
    })
  })

  describe('formatResponse', () => {
    it('returns JSON with success fields', async () => {
      const result: SettlementResult = {
        status: 'settled',
        operationId: 'op-x402-001',
        costCents: 10,
        txHash: '0xabc123',
        metadata: {
          protocol: 'x402',
          latencyMs: 150,
          settlementType: 'real-time',
        },
      }
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.txHash).toBe('0xabc123')
      expect(body.operationId).toBe('op-x402-001')
      expect(body.metadata.protocol).toBe('x402')
    })
  })

  describe('formatError', () => {
    it('returns 402 for payment errors', () => {
      const error = new Error('payment insufficient balance')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(402)
    })

    it('returns 500 for generic errors', () => {
      const error = new Error('Something unexpected broke')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.status).toBe(500)
    })

    it('includes error code in response body', async () => {
      const error = new Error('Something unexpected')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      const body = await res.json()
      expect(body.error.code).toBe('SERVER_ERROR')
      expect(body.error.message).toBe('Something unexpected')
    })
  })
})
