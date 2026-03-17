import { describe, it, expect } from 'vitest'

// ─── Imports ────────────────────────────────────────────────────────────────

import type {
  VisaAgentToken,
  VisaPaymentInstruction,
  VisaTAPConfig,
  VisaTokenProvisionRequest,
  VisaTokenProvisionResponse,
  VisaPaymentResponse,
  VisaTransaction,
} from '@/lib/settlement/visa-tap/types'

import { TAPAdapter } from '@/lib/settlement/adapters/tap'
import type { SettlementResult } from '@/lib/settlement/types'

// ─── VisaAgentToken Type Tests ──────────────────────────────────────────────

describe('VisaAgentToken type', () => {
  it('represents an active agent token', () => {
    const token: VisaAgentToken = {
      id: 'tok-001',
      agentId: 'agent-001',
      consumerId: 'consumer-001',
      tokenRef: 'visa-ref-abc123',
      lastFour: '4242',
      cardBrand: 'visa',
      expiresAt: '2026-12-31T23:59:59Z',
      status: 'active',
      merchantScope: null,
      maxTransactionCents: 50000,
      dailyLimitCents: 100000,
      dailySpentCents: 25000,
      lastUsedAt: '2026-03-17T10:00:00Z',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-17T10:00:00Z',
    }

    expect(token.status).toBe('active')
    expect(token.cardBrand).toBe('visa')
    expect(token.dailySpentCents).toBeLessThan(token.dailyLimitCents!)
    expect(token.maxTransactionCents).toBe(50000)
  })

  it('supports all status values', () => {
    const statuses: VisaAgentToken['status'][] = [
      'active',
      'suspended',
      'revoked',
      'expired',
    ]
    expect(statuses).toHaveLength(4)
  })

  it('supports null merchant scope (unrestricted)', () => {
    const token: VisaAgentToken = {
      id: 'tok-002',
      agentId: 'agent-002',
      consumerId: 'consumer-002',
      tokenRef: 'visa-ref-def456',
      lastFour: null,
      cardBrand: null,
      expiresAt: '2026-12-31T23:59:59Z',
      status: 'active',
      merchantScope: null,
      maxTransactionCents: null,
      dailyLimitCents: null,
      dailySpentCents: 0,
      lastUsedAt: null,
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-01T00:00:00Z',
    }

    expect(token.merchantScope).toBeNull()
    expect(token.maxTransactionCents).toBeNull()
    expect(token.dailyLimitCents).toBeNull()
  })
})

// ─── VisaPaymentInstruction Type Tests ──────────────────────────────────────

describe('VisaPaymentInstruction type', () => {
  it('has all required fields', () => {
    const instruction: VisaPaymentInstruction = {
      tokenReferenceId: 'visa-ref-abc123',
      amountCents: 5000,
      currency: 'USD',
      merchantId: 'merchant-001',
      agentAttestation: {
        agentId: 'agent-001',
        confidence: 0.95,
        decisionContext: 'Routine purchase under threshold',
        userVerificationMethod: 'none',
      },
    }

    expect(instruction.amountCents).toBe(5000)
    expect(instruction.agentAttestation.confidence).toBe(0.95)
    expect(instruction.agentAttestation.userVerificationMethod).toBe('none')
  })

  it('supports all verification methods', () => {
    const methods: VisaPaymentInstruction['agentAttestation']['userVerificationMethod'][] = [
      'passkey',
      'pin',
      'biometric',
      'none',
    ]
    expect(methods).toHaveLength(4)
  })
})

// ─── VisaTAPConfig Type Tests ───────────────────────────────────────────────

describe('VisaTAPConfig type', () => {
  it('represents sandbox config', () => {
    const config: VisaTAPConfig = {
      apiUrl: 'https://sandbox.api.visa.com',
      apiKey: 'test-api-key',
      sharedSecret: 'test-shared-secret',
      enabled: false,
    }

    expect(config.apiUrl).toContain('sandbox')
    expect(config.enabled).toBe(false)
  })

  it('supports undefined credentials', () => {
    const config: VisaTAPConfig = {
      apiUrl: 'https://sandbox.api.visa.com',
      apiKey: undefined,
      sharedSecret: undefined,
      enabled: false,
    }

    expect(config.apiKey).toBeUndefined()
    expect(config.sharedSecret).toBeUndefined()
  })
})

// ─── VisaTokenProvisionRequest/Response Types ───────────────────────────────

describe('Visa Token Provision types', () => {
  it('VisaTokenProvisionRequest has all fields', () => {
    const req: VisaTokenProvisionRequest = {
      primaryAccountNumber: '4111111111111111',
      expirationDate: '12/2028',
      cardholderName: 'AI Agent',
      agentId: 'agent-001',
      merchantScope: 'merchant-001',
      maxTransactionCents: 50000,
    }

    expect(req.primaryAccountNumber).toHaveLength(16)
    expect(req.agentId).toBe('agent-001')
  })

  it('VisaTokenProvisionResponse has all fields', () => {
    const res: VisaTokenProvisionResponse = {
      tokenReferenceId: 'visa-token-ref-001',
      lastFourDigits: '1111',
      tokenStatus: 'active',
      expirationDate: '12/2028',
    }

    expect(res.lastFourDigits).toHaveLength(4)
    expect(res.tokenStatus).toBe('active')
  })
})

// ─── VisaPaymentResponse Type Tests ─────────────────────────────────────────

describe('VisaPaymentResponse type', () => {
  it('represents a successful payment', () => {
    const res: VisaPaymentResponse = {
      authorizationCode: 'AUTH123',
      networkReferenceId: 'NET-REF-456',
      responseCode: '00',
      responseMessage: 'Approved',
    }

    expect(res.responseCode).toBe('00')
    expect(res.responseMessage).toBe('Approved')
  })
})

// ─── VisaTransaction Type Tests ─────────────────────────────────────────────

describe('VisaTransaction type', () => {
  it('represents a captured transaction', () => {
    const tx: VisaTransaction = {
      id: 'tx-001',
      tokenId: 'tok-001',
      consumerId: 'consumer-001',
      amountCents: 5000,
      currency: 'USD',
      merchantId: 'merchant-001',
      merchantName: 'Test Merchant',
      status: 'captured',
      visaAuthCode: 'AUTH123',
      visaNetworkRef: 'NET-REF-456',
      agentAttestation: {
        agentId: 'agent-001',
        confidence: 0.95,
        decisionContext: 'Routine purchase',
        userVerification: 'none',
      },
      disputeStatus: null,
      createdAt: '2026-03-17T10:00:00Z',
      updatedAt: '2026-03-17T10:00:00Z',
    }

    expect(tx.status).toBe('captured')
    expect(tx.disputeStatus).toBeNull()
    expect(tx.agentAttestation?.confidence).toBe(0.95)
  })

  it('supports all status values', () => {
    const statuses: VisaTransaction['status'][] = [
      'pending',
      'authorized',
      'captured',
      'declined',
      'reversed',
      'disputed',
    ]
    expect(statuses).toHaveLength(6)
  })

  it('supports all dispute statuses', () => {
    const disputes: VisaTransaction['disputeStatus'][] = [
      'opened',
      'under_review',
      'resolved',
      null,
    ]
    expect(disputes).toHaveLength(4)
  })
})

// ─── TAPAdapter ─────────────────────────────────────────────────────────────

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
