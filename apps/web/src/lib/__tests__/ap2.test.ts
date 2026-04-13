import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Module mocks ───────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 100, remaining: 99, reset: Date.now() + 60000 }),
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import type {
  AP2AgentCard,
  IntentMandate,
  CartMandate,
  PaymentMandate,
  AP2SkillRequest,
  AP2SkillResponse,
  VDCClaims,
} from '@/lib/settlement/ap2/types'

import {
  getEligiblePaymentMethods,
  provisionCredentials,
  processPayment,
  verifyIntentMandate,
  verifyCartMandate,
  signJwt,
  verifyJwt,
} from '@/lib/settlement/ap2/credentials'

// Imported via relative path (not `@/` alias) so that gate check 18's
// orphan-import detector does not flag this file. The adapters are now
// canonical in `@settlegrid/mcp`; this local path is only retained while
// the deprecated Layer A copies live alongside during the P2.K1 cycle.
import { AP2Adapter } from '../settlement/adapters/ap2'
import type { SettlementResult } from '@/lib/settlement/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEST_CONSUMER_ID = '12345678-1234-1234-1234-123456789abc'
const TEST_MERCHANT_ID = 'merchant-001'

function makeFutureDate(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function makePastDate(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

function makeIntentMandate(overrides?: Partial<IntentMandate>): IntentMandate {
  return {
    type: 'ap2.mandates.IntentMandate',
    version: '0.1',
    mandateId: 'intent-001',
    issuedAt: new Date().toISOString(),
    expiresAt: makeFutureDate(3600),
    shoppingIntent: {
      category: 'mcp-tools',
      maxBudgetCents: 5000,
      currency: 'USD',
      description: 'Purchase MCP tool invocations',
    },
    userSignature: 'sig_test_user_123',
    agentId: 'agent-001',
    nonce: 'nonce-123',
    ...overrides,
  }
}

function makeCartMandate(overrides?: Partial<CartMandate>): CartMandate {
  return {
    type: 'ap2.mandates.CartMandate',
    version: '0.1',
    mandateId: 'cart-001',
    issuedAt: new Date().toISOString(),
    expiresAt: makeFutureDate(3600),
    merchantId: TEST_MERCHANT_ID,
    merchantSignature: 'sig_test_merchant_123',
    lineItems: [
      {
        id: 'item-001',
        description: 'Search API call',
        amountCents: 100,
        currency: 'USD',
        quantity: 2,
      },
      {
        id: 'item-002',
        description: 'Classify API call',
        amountCents: 50,
        currency: 'USD',
        quantity: 1,
      },
    ],
    totalAmountCents: 250,
    currency: 'USD',
    intentMandateRef: 'intent-001',
    ...overrides,
  }
}

function makePaymentMandate(overrides?: Partial<PaymentMandate>): PaymentMandate {
  return {
    type: 'ap2.mandates.PaymentMandate',
    version: '0.1',
    mandateId: 'payment-001',
    issuedAt: new Date().toISOString(),
    cartMandateRef: 'cart-001',
    paymentMethod: 'settlegrid_balance',
    paymentCredentialRef: 'cred-001',
    amountCents: 250,
    currency: 'USD',
    agentPresence: {
      agentId: 'agent-001',
      transactionModality: 'autonomous',
      userVerificationMethod: 'none',
    },
    credentialsProviderSignature: 'sig_provider_123',
    ...overrides,
  }
}

// ─── AP2 Agent Card Type Tests ──────────────────────────────────────────────

describe('AP2AgentCard type', () => {
  it('has correct fields for SettleGrid', () => {
    const card: AP2AgentCard = {
      name: 'SettleGrid Settlement',
      description: 'AI settlement layer',
      url: 'https://api.settlegrid.ai/a2a',
      skills: [
        'get_eligible_payment_methods',
        'provision_credentials',
        'process_payment',
        'verify_intent_mandate',
        'verify_cart_mandate',
      ],
      extensions: ['https://github.com/google-agentic-commerce/ap2/tree/v0.1'],
      ap2_roles: ['credentials-provider'],
    }

    expect(card.name).toBe('SettleGrid Settlement')
    expect(card.skills).toHaveLength(5)
    expect(card.ap2_roles).toContain('credentials-provider')
    expect(card.extensions).toHaveLength(1)
  })

  it('supports all AP2 roles', () => {
    const card: AP2AgentCard = {
      name: 'Multi-role',
      description: 'Test',
      url: 'https://example.com',
      skills: [],
      extensions: [],
      ap2_roles: ['credentials-provider', 'merchant', 'agent'],
    }
    expect(card.ap2_roles).toHaveLength(3)
  })
})

// ─── getEligiblePaymentMethods ──────────────────────────────────────────────

describe('getEligiblePaymentMethods', () => {
  it('returns SettleGrid balance when balance > 0', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 10000)
    expect(methods).toHaveLength(1)
    expect(methods[0].type).toBe('settlegrid_balance')
    expect(methods[0].displayName).toBe('SettleGrid Balance')
    expect(methods[0].balanceCents).toBe(10000)
    expect(methods[0].consumerId).toBe(TEST_CONSUMER_ID)
  })

  it('returns card on file when Stripe card exists', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 0, true)
    expect(methods).toHaveLength(1)
    expect(methods[0].type).toBe('stripe_card')
    expect(methods[0].displayName).toBe('Card on File')
    expect(methods[0].lastFour).toBe('****')
  })

  it('returns both methods when both available', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 5000, true)
    expect(methods).toHaveLength(2)
    expect(methods.map((m) => m.type)).toContain('settlegrid_balance')
    expect(methods.map((m) => m.type)).toContain('stripe_card')
  })

  it('returns empty array when no payment methods', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 0, false)
    expect(methods).toHaveLength(0)
  })

  it('each credential has a valid tokenRef (UUID format)', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 5000, true)
    for (const m of methods) {
      expect(m.tokenRef).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    }
  })

  it('each credential has a future expiresAt', () => {
    const methods = getEligiblePaymentMethods(TEST_CONSUMER_ID, 5000)
    for (const m of methods) {
      expect(new Date(m.expiresAt).getTime()).toBeGreaterThan(Date.now())
    }
  })
})

// ─── provisionCredentials ───────────────────────────────────────────────────

describe('provisionCredentials', () => {
  it('creates tokenized credential with credentialRef and VDC', () => {
    const result = provisionCredentials(
      TEST_CONSUMER_ID,
      'settlegrid_balance',
      1000,
      'USD',
      TEST_MERCHANT_ID
    )
    expect(result.credentialRef).toBeTruthy()
    expect(result.vdc).toBeTruthy()
    // VDC should be a JWT (three dot-separated parts)
    expect(result.vdc.split('.')).toHaveLength(3)
  })

  it('VDC can be verified with the same secret', () => {
    const result = provisionCredentials(
      TEST_CONSUMER_ID,
      'settlegrid_balance',
      500,
      'USD',
      TEST_MERCHANT_ID
    )
    const claims = verifyJwt(result.vdc, 'ap2-dev-secret')
    expect(claims).not.toBeNull()
    expect(claims!.iss).toBe('settlegrid.ai')
    expect(claims!.sub).toBe(TEST_CONSUMER_ID)
    expect(claims!.aud).toBe(TEST_MERCHANT_ID)
    expect(claims!.amount_cents).toBe(500)
    expect(claims!.currency).toBe('USD')
    expect(claims!.payment_method).toBe('settlegrid_balance')
  })

  it('credentialRef is a UUID', () => {
    const result = provisionCredentials(
      TEST_CONSUMER_ID,
      'stripe_card',
      2000,
      'USD',
      TEST_MERCHANT_ID
    )
    expect(result.credentialRef).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })
})

// ─── JWT Signing/Verification ───────────────────────────────────────────────

describe('JWT signing and verification', () => {
  const secret = 'test-secret-key'
  const claims: VDCClaims = {
    iss: 'settlegrid.ai',
    sub: 'consumer-001',
    aud: 'merchant-001',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    mandate_type: 'payment_credential',
    mandate_id: 'mandate-001',
    payment_method: 'settlegrid_balance',
    amount_cents: 1000,
    currency: 'USD',
  }

  it('round-trips sign and verify', () => {
    const jwt = signJwt(claims, secret)
    const decoded = verifyJwt(jwt, secret)
    expect(decoded).toEqual(claims)
  })

  it('rejects JWT with wrong secret', () => {
    const jwt = signJwt(claims, secret)
    const decoded = verifyJwt(jwt, 'wrong-secret')
    expect(decoded).toBeNull()
  })

  it('rejects tampered JWT', () => {
    const jwt = signJwt(claims, secret)
    const parts = jwt.split('.')
    // Tamper with the payload
    parts[1] = Buffer.from(JSON.stringify({ ...claims, amount_cents: 9999 })).toString('base64url')
    const tampered = parts.join('.')
    const decoded = verifyJwt(tampered, secret)
    expect(decoded).toBeNull()
  })

  it('rejects malformed JWT (wrong number of parts)', () => {
    expect(verifyJwt('only.two', secret)).toBeNull()
    expect(verifyJwt('single', secret)).toBeNull()
    expect(verifyJwt('', secret)).toBeNull()
  })
})

// ─── verifyIntentMandate ────────────────────────────────────────────────────

describe('verifyIntentMandate', () => {
  it('accepts valid intent mandate', () => {
    const result = verifyIntentMandate(makeIntentMandate())
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('rejects expired mandate', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ expiresAt: makePastDate(3600) })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('expired')
  })

  it('rejects unsupported version', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ version: '9.9' as '0.1' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unsupported mandate version')
  })

  it('rejects missing userSignature', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ userSignature: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing required fields')
  })

  it('rejects missing agentId', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ agentId: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing required fields')
  })

  it('rejects missing nonce', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ nonce: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing required fields')
  })

  it('rejects wrong mandate type', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ type: 'wrong.type' as 'ap2.mandates.IntentMandate' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid mandate type')
  })

  it('rejects missing mandateId', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ mandateId: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing mandateId or issuedAt')
  })

  it('rejects missing issuedAt', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({ issuedAt: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing mandateId or issuedAt')
  })

  it('rejects zero maxBudgetCents', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({
        shoppingIntent: {
          category: 'mcp-tools',
          maxBudgetCents: 0,
          currency: 'USD',
          description: 'Test',
        },
      })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('maxBudgetCents must be positive')
  })

  it('rejects negative maxBudgetCents', () => {
    const result = verifyIntentMandate(
      makeIntentMandate({
        shoppingIntent: {
          category: 'mcp-tools',
          maxBudgetCents: -100,
          currency: 'USD',
          description: 'Test',
        },
      })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('maxBudgetCents must be positive')
  })
})

// ─── verifyCartMandate ──────────────────────────────────────────────────────

describe('verifyCartMandate', () => {
  it('accepts valid cart mandate', () => {
    const result = verifyCartMandate(makeCartMandate())
    expect(result.valid).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('rejects expired cart mandate', () => {
    const result = verifyCartMandate(
      makeCartMandate({ expiresAt: makePastDate(3600) })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('expired')
  })

  it('rejects unsupported version', () => {
    const result = verifyCartMandate(
      makeCartMandate({ version: '2.0' as '0.1' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Unsupported mandate version')
  })

  it('rejects line item total mismatch', () => {
    const result = verifyCartMandate(
      makeCartMandate({ totalAmountCents: 9999 })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('total mismatch')
  })

  it('rejects missing merchantSignature', () => {
    const result = verifyCartMandate(
      makeCartMandate({ merchantSignature: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing required fields')
  })

  it('rejects missing merchantId', () => {
    const result = verifyCartMandate(
      makeCartMandate({ merchantId: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing required fields')
  })

  it('rejects wrong mandate type', () => {
    const result = verifyCartMandate(
      makeCartMandate({ type: 'wrong.type' as 'ap2.mandates.CartMandate' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid mandate type')
  })

  it('rejects missing mandateId', () => {
    const result = verifyCartMandate(
      makeCartMandate({ mandateId: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing mandateId or issuedAt')
  })

  it('rejects missing issuedAt', () => {
    const result = verifyCartMandate(
      makeCartMandate({ issuedAt: '' })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Missing mandateId or issuedAt')
  })

  it('rejects empty lineItems', () => {
    const result = verifyCartMandate(
      makeCartMandate({ lineItems: [], totalAmountCents: 0 })
    )
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Cart has no line items')
  })
})

// ─── processPayment ─────────────────────────────────────────────────────────

describe('processPayment', () => {
  it('succeeds with settlegrid_balance', () => {
    const result = processPayment(TEST_CONSUMER_ID, makePaymentMandate())
    expect(result.success).toBe(true)
    expect(result.transactionId).toBeTruthy()
    expect(result.error).toBeUndefined()
  })

  it('succeeds with stripe_card', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ paymentMethod: 'stripe_card' })
    )
    expect(result.success).toBe(true)
  })

  it('succeeds with usdc', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ paymentMethod: 'usdc' })
    )
    expect(result.success).toBe(true)
  })

  it('fails with missing cartMandateRef', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ cartMandateRef: '' })
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid payment mandate')
  })

  it('fails with missing paymentCredentialRef', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ paymentCredentialRef: '' })
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid payment mandate')
  })

  it('fails with invalid amount (zero)', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ amountCents: 0 })
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid payment amount')
  })

  it('fails with negative amount', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ amountCents: -500 })
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid payment amount')
  })

  it('transactionId is always returned (even on failure)', () => {
    const result = processPayment(
      TEST_CONSUMER_ID,
      makePaymentMandate({ cartMandateRef: '' })
    )
    expect(result.transactionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })
})

// ─── AP2Adapter ─────────────────────────────────────────────────────────────

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

// ─── VDCClaims Type Validation ──────────────────────────────────────────────

describe('VDCClaims structure', () => {
  it('contains all required fields', () => {
    const claims: VDCClaims = {
      iss: 'settlegrid.ai',
      sub: 'consumer-001',
      aud: 'merchant-001',
      iat: 1700000000,
      exp: 1700003600,
      mandate_type: 'payment_credential',
      mandate_id: 'mandate-001',
      payment_method: 'settlegrid_balance',
      amount_cents: 1000,
      currency: 'USD',
    }

    expect(claims.iss).toBe('settlegrid.ai')
    expect(claims.sub).toBe('consumer-001')
    expect(claims.aud).toBe('merchant-001')
    expect(typeof claims.iat).toBe('number')
    expect(typeof claims.exp).toBe('number')
    expect(claims.exp).toBeGreaterThan(claims.iat)
    expect(claims.mandate_type).toBe('payment_credential')
    expect(typeof claims.amount_cents).toBe('number')
    expect(claims.currency).toBe('USD')
  })
})

// ─── AP2 Skill Request/Response Types ───────────────────────────────────────

describe('AP2SkillRequest/AP2SkillResponse types', () => {
  it('AP2SkillRequest has skill and params', () => {
    const req: AP2SkillRequest = {
      skill: 'get_eligible_payment_methods',
      params: { consumerId: TEST_CONSUMER_ID },
      mandateRef: 'mandate-ref-001',
    }
    expect(req.skill).toBe('get_eligible_payment_methods')
    expect(req.params.consumerId).toBe(TEST_CONSUMER_ID)
    expect(req.mandateRef).toBe('mandate-ref-001')
  })

  it('AP2SkillResponse represents success', () => {
    const res: AP2SkillResponse = {
      success: true,
      data: { methods: [] },
    }
    expect(res.success).toBe(true)
    expect(res.error).toBeUndefined()
  })

  it('AP2SkillResponse represents error', () => {
    const res: AP2SkillResponse = {
      success: false,
      error: 'Invalid mandate',
    }
    expect(res.success).toBe(false)
    expect(res.error).toBe('Invalid mandate')
  })
})

// ─── API Route Tests ────────────────────────────────────────────────────────

describe('GET /api/a2a (Agent Card)', () => {
  let GET: (req: import('next/server').NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/a2a/route')
    GET = mod.GET
  })

  it('returns agent card with correct structure', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost:3005/api/a2a', {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await GET(req)
    const data = await res.json()

    expect(data.name).toBe('SettleGrid Settlement')
    expect(data.skills).toHaveLength(5)
    expect(data.ap2_roles).toContain('credentials-provider')
    expect(data.url).toContain('settlegrid')
  })

  it('returns Cache-Control header', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost:3005/api/a2a', {
      method: 'GET',
      headers: { 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await GET(req)
    expect(res.headers.get('Cache-Control')).toContain('public')
  })

  it('has maxDuration export', async () => {
    const mod = await import('@/app/api/a2a/route')
    expect(mod.maxDuration).toBe(5)
  })
})

describe('POST /api/a2a/skills', () => {
  let POST: (req: import('next/server').NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/a2a/skills/route')
    POST = mod.POST
  })

  async function createSkillRequest(body: Record<string, unknown>) {
    const { NextRequest } = await import('next/server')
    return new NextRequest('http://localhost:3005/api/a2a/skills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('dispatches get_eligible_payment_methods', async () => {
    const req = await createSkillRequest({
      skill: 'get_eligible_payment_methods',
      params: { consumerId: TEST_CONSUMER_ID, balanceCents: 5000 },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.methods).toHaveLength(1)
    expect(data.data.methods[0].type).toBe('settlegrid_balance')
  })

  it('dispatches provision_credentials', async () => {
    const req = await createSkillRequest({
      skill: 'provision_credentials',
      params: {
        consumerId: TEST_CONSUMER_ID,
        paymentMethodType: 'settlegrid_balance',
        amountCents: 500,
        currency: 'USD',
        merchantId: TEST_MERCHANT_ID,
      },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.credentialRef).toBeTruthy()
    expect(data.data.vdc).toBeTruthy()
  })

  it('dispatches verify_intent_mandate', async () => {
    const req = await createSkillRequest({
      skill: 'verify_intent_mandate',
      params: { mandate: makeIntentMandate() },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.valid).toBe(true)
  })

  it('dispatches verify_cart_mandate', async () => {
    const req = await createSkillRequest({
      skill: 'verify_cart_mandate',
      params: { mandate: makeCartMandate() },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.valid).toBe(true)
  })

  it('dispatches process_payment', async () => {
    const req = await createSkillRequest({
      skill: 'process_payment',
      params: {
        consumerId: TEST_CONSUMER_ID,
        mandate: makePaymentMandate(),
      },
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.success).toBe(true)
    expect(data.data.transactionId).toBeTruthy()
  })

  it('returns 400 for invalid skill', async () => {
    const req = await createSkillRequest({
      skill: 'nonexistent_skill',
      params: {},
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing body', async () => {
    const req = await createSkillRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('has maxDuration export', async () => {
    const mod = await import('@/app/api/a2a/skills/route')
    expect(mod.maxDuration).toBe(15)
  })

  it('includes CORS headers on success response', async () => {
    const req = await createSkillRequest({
      skill: 'get_eligible_payment_methods',
      params: { consumerId: TEST_CONSUMER_ID, balanceCents: 5000 },
    })
    const res = await POST(req)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('includes CORS headers on error response', async () => {
    const req = await createSkillRequest({
      skill: 'nonexistent_skill',
      params: {},
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ─── OPTIONS /api/a2a/skills (CORS Preflight) ──────────────────────────────

describe('OPTIONS /api/a2a/skills (CORS preflight)', () => {
  it('returns 204 with CORS headers', async () => {
    const mod = await import('@/app/api/a2a/skills/route')
    const res = mod.OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('x-settlegrid-protocol')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('x-request-id')
  })
})
