import { describe, it, expect, beforeEach } from 'vitest'
import { MPPAdapter } from '../adapters/mpp'
import { CircleNanoAdapter } from '../adapters/circle-nano'
import { UCPAdapter } from '../adapters/ucp'
import { ACPAdapter } from '../adapters/acp'
import { MastercardVIAdapter } from '../adapters/mastercard-vi'
import { MCPAdapter } from '../adapters/mcp'
import { X402Adapter } from '../adapters/x402'
import { AP2Adapter } from '../adapters/ap2'
import { TAPAdapter } from '../adapters/tap'
import { ProtocolRegistry, DETECTION_PRIORITY } from '../adapters'
import type { SettlementResult, ProtocolName } from '../adapters/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeResult(protocol: ProtocolName, overrides?: Partial<SettlementResult>): SettlementResult {
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
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MPP Adapter (Machine Payments Protocol — Stripe + Tempo)
// ═══════════════════════════════════════════════════════════════════════════════

describe('MPPAdapter', () => {
  const adapter = new MPPAdapter()

  describe('canHandle', () => {
    it('detects x-mpp-credential header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-mpp-credential': 'mpp_cred_abc123' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects x-settlegrid-protocol: mpp', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'mpp' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects Authorization header with mpp_ prefix', () => {
      const req = new Request('http://localhost', {
        headers: { Authorization: 'Bearer mpp_session_xyz' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('rejects request without MPP headers', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('rejects request with unrelated protocol header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'x402' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts credential from x-mpp-credential header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-mpp-credential': 'mpp_cred_abc123' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('mpp')
      expect(ctx.identity.type).toBe('mpp-session')
      expect(ctx.identity.value).toBe('mpp_cred_abc123')
    })

    it('extracts credential from Authorization header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { Authorization: 'Bearer mpp_session_xyz' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('mpp_session_xyz')
    })

    it('defaults payment type to spt', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-mpp-credential': 'mpp_cred_abc123' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('spt')
    })

    it('detects crypto payment type from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-mpp-credential': 'mpp_cred_abc123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentType: 'crypto' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('crypto')
    })

    it('detects tempo payment type from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-mpp-credential': 'mpp_cred_abc123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentType: 'tempo' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.payment.type).toBe('crypto')
    })

    it('extracts sessionId from body into session field', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-mpp-credential': 'mpp_cred_abc123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: 'sess_mpp_001' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.session?.id).toBe('sess_mpp_001')
    })

    it('throws when no credential header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'mpp' },
      })
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow('No MPP credential')
    })

    it('handles non-JSON body gracefully', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-mpp-credential': 'mpp_cred_abc123',
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('mpp')
      expect(ctx.payment.type).toBe('spt')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with correct structure', async () => {
      const result = makeResult('mpp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.operationId).toBe('op-mpp-001')
      expect(body.costCents).toBe(10)
      expect(body.receipt).toBeNull()
      expect(body.metadata.protocol).toBe('mpp')
    })

    it('includes receipt when present', async () => {
      const result = makeResult('mpp', { receipt: 'mpp-receipt-001' })
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()
      expect(body.receipt).toBe('mpp-receipt-001')
    })

    it('includes txHash header when present', () => {
      const result = makeResult('mpp', { txHash: '0xabc' })
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xabc')
    })

    it('includes protocol header', () => {
      const result = makeResult('mpp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mpp')
    })
  })

  describe('formatError', () => {
    it('returns 401 for credential errors', async () => {
      const res = adapter.formatError(new Error('credential invalid'), new Request('http://localhost'))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('MPP_CREDENTIAL_INVALID')
    })

    it('returns 402 for payment errors', async () => {
      const res = adapter.formatError(new Error('insufficient balance'), new Request('http://localhost'))
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.code).toBe('MPP_PAYMENT_REQUIRED')
    })

    it('returns 500 for server errors', async () => {
      const res = adapter.formatError(new Error('something broke'), new Request('http://localhost'))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('MPP_SERVER_ERROR')
    })

    it('includes protocol field', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.protocol).toBe('mpp')
    })

    it('includes requestId from header', async () => {
      const req = new Request('http://localhost', {
        headers: { 'x-request-id': 'mpp-req-001' },
      })
      const res = adapter.formatError(new Error('test'), req)
      const body = await res.json()
      expect(body.error.requestId).toBe('mpp-req-001')
    })

    it('sets requestId to null when header missing', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.requestId).toBeNull()
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Circle Nanopayments Adapter
// ═══════════════════════════════════════════════════════════════════════════════

describe('CircleNanoAdapter', () => {
  const adapter = new CircleNanoAdapter()

  describe('canHandle', () => {
    it('detects x-circle-nano-auth header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-circle-nano-auth': 'eip3009-auth-payload' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects x-settlegrid-protocol: circle-nano', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'circle-nano' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('rejects request without Circle Nano headers', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })

    it('rejects request with different protocol header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'x402' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts from x-circle-nano-auth header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-circle-nano-auth': 'eip3009-auth-payload' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('circle-nano')
      expect(ctx.identity.type).toBe('eip3009')
      expect(ctx.payment.type).toBe('nanopayment')
      expect(ctx.payment.proof).toBe('eip3009-auth-payload')
    })

    it('extracts from address from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-circle-nano-auth': 'eip3009-auth-payload',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: '0xABC123', amount: '1000000' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('0xABC123')
    })

    it('extracts authorizationId from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-circle-nano-auth': 'eip3009-auth-payload',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authorizationId: 'auth-001' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.metadata?.authorizationId).toBe('auth-001')
    })

    it('throws when no auth header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'circle-nano' },
      })
      await expect(adapter.extractPaymentContext(req)).rejects.toThrow('Missing x-circle-nano-auth')
    })

    it('handles non-JSON body gracefully', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-circle-nano-auth': 'eip3009-auth-payload',
          'Content-Type': 'text/plain',
        },
        body: 'not json',
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('circle-nano')
      expect(ctx.identity.value).toBe('eip3009-auth-payload')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with correct structure', async () => {
      const result = makeResult('circle-nano')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.operationId).toBe('op-circle-nano-001')
      expect(body.settlementStatus).toBe('on-chain')
      expect(body.metadata.protocol).toBe('circle-nano')
    })

    it('returns off-chain-confirmed for pending status', async () => {
      const result = makeResult('circle-nano', { status: 'pending' })
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.settlementStatus).toBe('off-chain-confirmed')
    })

    it('includes batchId from txHash', async () => {
      const result = makeResult('circle-nano', { txHash: '0xbatch123' })
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()
      expect(body.batchId).toBe('0xbatch123')
    })

    it('includes protocol header', () => {
      const result = makeResult('circle-nano')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('circle-nano')
    })
  })

  describe('formatError', () => {
    it('returns 401 for auth errors', async () => {
      const res = adapter.formatError(new Error('auth invalid'), new Request('http://localhost'))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('NANO_AUTH_INVALID')
    })

    it('returns 402 for insufficient funds', async () => {
      const res = adapter.formatError(new Error('insufficient funds'), new Request('http://localhost'))
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.code).toBe('NANO_INSUFFICIENT_FUNDS')
    })

    it('returns 500 for server errors', async () => {
      const res = adapter.formatError(new Error('something broke'), new Request('http://localhost'))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('NANO_SERVER_ERROR')
    })

    it('includes protocol field', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.protocol).toBe('circle-nano')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UCP Adapter (Universal Commerce Protocol — Google + Shopify)
// ═══════════════════════════════════════════════════════════════════════════════

describe('UCPAdapter', () => {
  const adapter = new UCPAdapter()

  describe('canHandle', () => {
    it('detects x-ucp-session header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-ucp-session': 'ucp-session-abc' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects x-settlegrid-protocol: ucp', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'ucp' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('rejects request without UCP headers', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts session from header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-ucp-session': 'ucp-session-abc' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('ucp')
      expect(ctx.identity.type).toBe('ucp-session')
      expect(ctx.identity.value).toBe('ucp-session-abc')
      expect(ctx.payment.type).toBe('payment-handler')
      expect(ctx.session?.id).toBe('ucp-session-abc')
    })

    it('falls back to anonymous when no session header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'ucp' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('anonymous')
    })

    it('extracts action from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-ucp-session': 'ucp-session-abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'complete', paymentHandler: 'google-pay' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.operation.method).toBe('complete')
      expect(ctx.identity.metadata?.paymentHandler).toBe('google-pay')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with sessionId and status', async () => {
      const result = makeResult('ucp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.status).toBe('settled')
      expect(body.metadata.protocol).toBe('ucp')
    })

    it('includes protocol header', () => {
      const result = makeResult('ucp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('ucp')
    })
  })

  describe('formatError', () => {
    it('returns 401 for session errors', async () => {
      const res = adapter.formatError(new Error('session expired'), new Request('http://localhost'))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UCP_SESSION_ERROR')
    })

    it('returns 402 for payment errors', async () => {
      const res = adapter.formatError(new Error('payment declined'), new Request('http://localhost'))
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.code).toBe('UCP_PAYMENT_ERROR')
    })

    it('returns 500 for server errors', async () => {
      const res = adapter.formatError(new Error('something broke'), new Request('http://localhost'))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('UCP_SERVER_ERROR')
    })

    it('includes protocol field', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.protocol).toBe('ucp')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACP Adapter (Agentic Commerce Protocol — OpenAI + Stripe)
// ═══════════════════════════════════════════════════════════════════════════════

describe('ACPAdapter', () => {
  const adapter = new ACPAdapter()

  describe('canHandle', () => {
    it('detects x-acp-token header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-acp-token': 'acp-token-abc' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects x-settlegrid-protocol: acp', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'acp' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('rejects request without ACP headers', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts token from header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-acp-token': 'acp-token-abc' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('acp')
      expect(ctx.identity.type).toBe('spt')
      expect(ctx.identity.value).toBe('acp-token-abc')
      expect(ctx.payment.type).toBe('spt')
    })

    it('falls back to anonymous when no token header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'acp' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('anonymous')
    })

    it('extracts checkoutId from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-acp-token': 'acp-token-abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ checkoutId: 'chk_001' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.metadata?.checkoutId).toBe('chk_001')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with checkoutId', async () => {
      const result = makeResult('acp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.checkoutId).toBeDefined()
      expect(body.metadata.protocol).toBe('acp')
    })

    it('includes protocol header', () => {
      const result = makeResult('acp')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('acp')
    })
  })

  describe('formatError', () => {
    it('returns 401 for checkout errors', async () => {
      const res = adapter.formatError(new Error('checkout expired'), new Request('http://localhost'))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('ACP_CHECKOUT_ERROR')
    })

    it('returns 402 for payment errors', async () => {
      const res = adapter.formatError(new Error('payment declined'), new Request('http://localhost'))
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.code).toBe('ACP_PAYMENT_ERROR')
    })

    it('returns 500 for server errors', async () => {
      const res = adapter.formatError(new Error('something broke'), new Request('http://localhost'))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('ACP_SERVER_ERROR')
    })

    it('includes protocol field', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.protocol).toBe('acp')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Mastercard Verifiable Intent Adapter
// ═══════════════════════════════════════════════════════════════════════════════

describe('MastercardVIAdapter', () => {
  const adapter = new MastercardVIAdapter()

  describe('canHandle', () => {
    it('detects x-mc-verifiable-intent header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-mc-verifiable-intent': 'sd-jwt-credential' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('detects x-settlegrid-protocol: mastercard-vi', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
      })
      expect(adapter.canHandle(req)).toBe(true)
    })

    it('rejects request without Mastercard VI headers', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-api-key': 'sg_live_abc' },
      })
      expect(adapter.canHandle(req)).toBe(false)
    })
  })

  describe('extractPaymentContext', () => {
    it('extracts SD-JWT from header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-mc-verifiable-intent': 'eyJhbGciOiJFUzI1NiJ9.payload.sig~disclosure1~disclosure2' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.protocol).toBe('mastercard-vi')
      expect(ctx.identity.type).toBe('sd-jwt')
      expect(ctx.payment.type).toBe('agentic-token')
      expect(ctx.payment.proof).toContain('eyJhbGciOiJFUzI1NiJ9')
    })

    it('falls back to unknown when no intent header', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.value).toBe('unknown')
    })

    it('extracts intentId from body', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: {
          'x-mc-verifiable-intent': 'sd-jwt-credential',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ intentId: 'intent-001' }),
      })
      const ctx = await adapter.extractPaymentContext(req)
      expect(ctx.identity.metadata?.intentId).toBe('intent-001')
    })
  })

  describe('formatResponse', () => {
    it('returns 200 with intentId and verification status', async () => {
      const result = makeResult('mastercard-vi')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.intentId).toBeDefined()
      expect(body.verified).toBe(true)
      expect(body.metadata.protocol).toBe('mastercard-vi')
    })

    it('verified is false for rejected result', async () => {
      const result = makeResult('mastercard-vi', { status: 'rejected' })
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      const body = await res.json()
      expect(body.verified).toBe(false)
    })

    it('includes protocol header', () => {
      const result = makeResult('mastercard-vi')
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mastercard-vi')
    })
  })

  describe('formatError', () => {
    it('returns 401 for intent/credential errors', async () => {
      const res = adapter.formatError(new Error('intent invalid'), new Request('http://localhost'))
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('MC_VI_INVALID_INTENT')
    })

    it('returns 402 for payment errors', async () => {
      const res = adapter.formatError(new Error('payment declined'), new Request('http://localhost'))
      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error.code).toBe('MC_VI_PAYMENT_ERROR')
    })

    it('returns 500 for server errors', async () => {
      const res = adapter.formatError(new Error('something broke'), new Request('http://localhost'))
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('MC_VI_SERVER_ERROR')
    })

    it('includes protocol field', async () => {
      const res = adapter.formatError(new Error('test'), new Request('http://localhost'))
      const body = await res.json()
      expect(body.error.protocol).toBe('mastercard-vi')
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Priority order — new adapters
// ═══════════════════════════════════════════════════════════════════════════════

describe('Detection priority with new adapters', () => {
  let registry: ProtocolRegistry

  beforeEach(() => {
    registry = new ProtocolRegistry()
    registry.register(new MPPAdapter())
    registry.register(new CircleNanoAdapter())
    registry.register(new X402Adapter())
    registry.register(new MastercardVIAdapter())
    registry.register(new AP2Adapter())
    registry.register(new ACPAdapter())
    registry.register(new UCPAdapter())
    registry.register(new TAPAdapter())
    registry.register(new MCPAdapter())
  })

  it('full priority order has 9 entries', () => {
    expect(DETECTION_PRIORITY).toHaveLength(9)
  })

  it('mpp is first in priority', () => {
    expect(DETECTION_PRIORITY[0]).toBe('mpp')
  })

  it('mcp is last in priority (fallback)', () => {
    expect(DETECTION_PRIORITY[DETECTION_PRIORITY.length - 1]).toBe('mcp')
  })

  it('mpp wins over all other protocols', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-mpp-credential': 'mpp_cred_abc',
        'x-circle-nano-auth': 'nano-auth',
        'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
        'x-api-key': 'sg_live_abc',
      },
    })
    expect(registry.detect(req)?.name).toBe('mpp')
  })

  it('circle-nano wins over x402 when both present', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-circle-nano-auth': 'nano-auth',
        'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
      },
    })
    expect(registry.detect(req)?.name).toBe('circle-nano')
  })

  it('x402 wins over mastercard-vi', () => {
    const req = new Request('http://localhost', {
      headers: {
        'payment-signature': Buffer.from(JSON.stringify({ scheme: 'exact' })).toString('base64'),
        'x-mc-verifiable-intent': 'sd-jwt',
      },
    })
    expect(registry.detect(req)?.name).toBe('x402')
  })

  it('mastercard-vi wins over ap2', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-mc-verifiable-intent': 'sd-jwt',
        'x-ap2-mandate': 'mandate-ref',
      },
    })
    expect(registry.detect(req)?.name).toBe('mastercard-vi')
  })

  it('ap2 wins over acp', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-ap2-mandate': 'mandate-ref',
        'x-acp-token': 'acp-token',
      },
    })
    expect(registry.detect(req)?.name).toBe('ap2')
  })

  it('acp wins over ucp', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-acp-token': 'acp-token',
        'x-ucp-session': 'ucp-session',
      },
    })
    expect(registry.detect(req)?.name).toBe('acp')
  })

  it('ucp wins over visa-tap', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-ucp-session': 'ucp-session',
        'x-visa-agent-token': 'visa-token',
      },
    })
    expect(registry.detect(req)?.name).toBe('ucp')
  })

  it('visa-tap wins over mcp', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-visa-agent-token': 'visa-token',
        'x-api-key': 'sg_live_abc',
      },
    })
    expect(registry.detect(req)?.name).toBe('visa-tap')
  })

  it('explicit x-settlegrid-protocol: mpp forces mpp', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'mpp' },
    })
    expect(registry.detect(req)?.name).toBe('mpp')
  })

  it('explicit x-settlegrid-protocol: circle-nano forces circle-nano', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'circle-nano' },
    })
    expect(registry.detect(req)?.name).toBe('circle-nano')
  })

  it('explicit x-settlegrid-protocol: mastercard-vi forces mastercard-vi', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'mastercard-vi' },
    })
    expect(registry.detect(req)?.name).toBe('mastercard-vi')
  })

  it('explicit x-settlegrid-protocol: acp forces acp', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'acp' },
    })
    expect(registry.detect(req)?.name).toBe('acp')
  })

  it('explicit x-settlegrid-protocol: ucp forces ucp', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-settlegrid-protocol': 'ucp' },
    })
    expect(registry.detect(req)?.name).toBe('ucp')
  })

  it('no matching headers returns undefined', () => {
    const req = new Request('http://localhost')
    expect(registry.detect(req)).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Cross-adapter response consistency — new adapters
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cross-adapter response consistency (new adapters)', () => {
  it('all new adapters return 200 for success', () => {
    const testAdapters = [
      new MPPAdapter(),
      new CircleNanoAdapter(),
      new UCPAdapter(),
      new ACPAdapter(),
      new MastercardVIAdapter(),
    ]
    for (const adapter of testAdapters) {
      const result = makeResult(adapter.name)
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.status).toBe(200)
    }
  })

  it('all new adapters include Content-Type: application/json on success', () => {
    const testAdapters = [
      new MPPAdapter(),
      new CircleNanoAdapter(),
      new UCPAdapter(),
      new ACPAdapter(),
      new MastercardVIAdapter(),
    ]
    for (const adapter of testAdapters) {
      const result = makeResult(adapter.name)
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('Content-Type')).toBe('application/json')
    }
  })

  it('all new adapters include Content-Type: application/json on error', () => {
    const testAdapters = [
      new MPPAdapter(),
      new CircleNanoAdapter(),
      new UCPAdapter(),
      new ACPAdapter(),
      new MastercardVIAdapter(),
    ]
    for (const adapter of testAdapters) {
      const error = new Error('test error')
      const req = new Request('http://localhost')
      const res = adapter.formatError(error, req)
      expect(res.headers.get('Content-Type')).toBe('application/json')
    }
  })

  it('all new adapters include X-SettleGrid-Protocol header on success', () => {
    const testAdapters = [
      new MPPAdapter(),
      new CircleNanoAdapter(),
      new UCPAdapter(),
      new ACPAdapter(),
      new MastercardVIAdapter(),
    ]
    for (const adapter of testAdapters) {
      const result = makeResult(adapter.name)
      const req = new Request('http://localhost')
      const res = adapter.formatResponse(result, req)
      expect(res.headers.get('X-SettleGrid-Protocol')).toBe(adapter.name)
    }
  })
})
