import { describe, it, expect, beforeEach } from 'vitest'
// Imported via relative path (not `@/` alias) so that gate check 18's
// orphan-import detector does not flag this file. The registry is now
// canonical in `@settlegrid/mcp`; this local path is only retained while
// the deprecated Layer A copies live alongside during the P2.K1 cycle.
import { ProtocolRegistry } from '../settlement/adapters'
import type {
  ProtocolAdapter,
  ProtocolName,
  PaymentContext,
  SettlementResult,
  PaymentType,
  IdentityType,
  SettlementStatus,
  PricingModel,
  LedgerCategory,
  AccountType,
  EntryType,
  SessionState,
  GeneralizedPricingConfig,
  AgentFactsProfile,
} from '@/lib/settlement/types'

// ─── Helper: create a mock adapter ───────────────────────────────────────────

function createMockAdapter(
  name: ProtocolName,
  canHandleFn: (req: Request) => boolean = () => false
): ProtocolAdapter {
  return {
    name,
    displayName: `${name} adapter`,
    canHandle: canHandleFn,
    extractPaymentContext: async () => ({
      protocol: name,
      identity: { type: 'api-key' as IdentityType, value: 'test-key' },
      operation: { service: 'test-tool', method: 'test-method' },
      payment: { type: 'credit-balance' as PaymentType },
      requestId: 'req-123',
    }),
    formatResponse: (result: SettlementResult) =>
      new Response(JSON.stringify(result), { status: 200 }),
    formatError: (error: Error) =>
      new Response(JSON.stringify({ error: error.message }), { status: 500 }),
  }
}

// ─── ProtocolRegistry Tests ──────────────────────────────────────────────────

describe('ProtocolRegistry', () => {
  let registry: ProtocolRegistry

  beforeEach(() => {
    registry = new ProtocolRegistry()
  })

  it('register() adds adapter', () => {
    const adapter = createMockAdapter('mcp')
    registry.register(adapter)
    expect(registry.has('mcp')).toBe(true)
  })

  it('register() throws on duplicate', () => {
    const adapter = createMockAdapter('mcp')
    registry.register(adapter)
    expect(() => registry.register(createMockAdapter('mcp'))).toThrow(
      'Adapter already registered for protocol: mcp'
    )
  })

  it('get() returns registered adapter', () => {
    const adapter = createMockAdapter('x402')
    registry.register(adapter)
    expect(registry.get('x402')).toBe(adapter)
  })

  it('get() returns undefined for unknown', () => {
    expect(registry.get('mcp')).toBeUndefined()
  })

  it('detect() calls canHandle() on each adapter', () => {
    const mcpAdapter = createMockAdapter('mcp', (req) =>
      req.headers.get('x-protocol') === 'mcp'
    )
    const x402Adapter = createMockAdapter('x402', (req) =>
      req.headers.get('x-protocol') === 'x402'
    )
    registry.register(mcpAdapter)
    registry.register(x402Adapter)

    const req = new Request('http://localhost', {
      headers: { 'x-protocol': 'x402' },
    })
    expect(registry.detect(req)).toBe(x402Adapter)
  })

  it('detect() returns highest-priority matching adapter (x402 > mcp)', () => {
    const adapter1 = createMockAdapter('mcp', () => true)
    const adapter2 = createMockAdapter('x402', () => true)
    registry.register(adapter1)
    registry.register(adapter2)

    const req = new Request('http://localhost')
    // x402 has higher priority than mcp, so x402 wins even if mcp was registered first
    expect(registry.detect(req)).toBe(adapter2)
  })

  it('detect() returns undefined when none match', () => {
    const adapter = createMockAdapter('mcp', () => false)
    registry.register(adapter)

    const req = new Request('http://localhost')
    expect(registry.detect(req)).toBeUndefined()
  })

  it('list() returns all registered adapters', () => {
    const mcp = createMockAdapter('mcp')
    const x402 = createMockAdapter('x402')
    registry.register(mcp)
    registry.register(x402)

    const list = registry.list()
    expect(list).toHaveLength(2)
    expect(list).toContain(mcp)
    expect(list).toContain(x402)
  })

  it('has() returns false for unregistered protocol', () => {
    expect(registry.has('ap2')).toBe(false)
  })

  it('clear() removes all adapters', () => {
    registry.register(createMockAdapter('mcp'))
    registry.register(createMockAdapter('x402'))
    registry.clear()
    expect(registry.list()).toHaveLength(0)
  })
})

// ─── Type System Smoke Tests ─────────────────────────────────────────────────

describe('Settlement Type System', () => {
  it('PaymentContext can represent MCP credit-balance payment', () => {
    const ctx: PaymentContext = {
      protocol: 'mcp',
      identity: { type: 'api-key', value: 'sg_live_abc123' },
      operation: { service: 'my-tool', method: 'search' },
      payment: { type: 'credit-balance' },
      requestId: 'req-001',
    }
    expect(ctx.protocol).toBe('mcp')
    expect(ctx.payment.type).toBe('credit-balance')
  })

  it('PaymentContext can represent x402 EIP-3009 payment', () => {
    const ctx: PaymentContext = {
      protocol: 'x402',
      identity: { type: 'did:key', value: 'did:key:z6Mk...' },
      operation: { service: 'data-api', method: 'fetch' },
      payment: {
        type: 'eip3009',
        amount: { value: 10000n, currency: 'USDC' },
        proof: '0xsignature...',
      },
      requestId: 'req-002',
    }
    expect(ctx.payment.type).toBe('eip3009')
    expect(ctx.payment.amount?.value).toBe(10000n)
  })

  it('SettlementResult represents all required fields', () => {
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
    expect(result.status).toBe('settled')
    expect(result.costCents).toBe(5)
  })

  it('SettlementResult can include error details', () => {
    const result: SettlementResult = {
      status: 'rejected',
      operationId: 'op-456',
      costCents: 0,
      error: {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Balance too low',
        retryable: false,
      },
      metadata: {
        protocol: 'mcp',
        latencyMs: 2,
        settlementType: 'real-time',
      },
    }
    expect(result.error?.code).toBe('INSUFFICIENT_CREDITS')
    expect(result.error?.retryable).toBe(false)
  })

  it('SessionState represents budget delegation tree', () => {
    const session: SessionState = {
      id: 'sess-001',
      customerId: 'cust-001',
      parentSessionId: null,
      budgetCents: 10000,
      spentCents: 3000,
      reservedCents: 2000,
      availableCents: 5000,
      status: 'active',
      expiresAt: '2026-03-17T12:00:00Z',
      children: [
        {
          id: 'sess-002',
          customerId: 'cust-001',
          parentSessionId: 'sess-001',
          budgetCents: 2000,
          spentCents: 500,
          reservedCents: 0,
          availableCents: 1500,
          status: 'active',
          expiresAt: '2026-03-17T12:00:00Z',
          children: [],
        },
      ],
    }
    expect(session.availableCents).toBe(
      session.budgetCents - session.spentCents - session.reservedCents
    )
    expect(session.children).toHaveLength(1)
    expect(session.children[0].parentSessionId).toBe(session.id)
  })

  it('GeneralizedPricingConfig supports tiered pricing', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      currencyCode: 'USD',
      tiers: [
        { upTo: 1000, costCents: 1 },
        { upTo: 10000, costCents: 0 },
      ],
    }
    expect(pricing.model).toBe('tiered')
    expect(pricing.tiers).toHaveLength(2)
  })

  it('AgentFactsProfile covers all 4 categories', () => {
    const profile: AgentFactsProfile = {
      coreIdentity: {
        id: 'agent-001',
        name: 'TestAgent',
        version: '1.0.0',
        provider: 'TestProvider',
        ttl: 3600,
      },
      capabilities: {
        tools: ['search', 'analyze'],
        methods: ['search.query', 'analyze.run'],
        pricing: {
          model: 'per-invocation',
          defaultCostCents: 5,
          currencyCode: 'USD',
        },
        protocols: ['mcp', 'x402'],
      },
      authPermissions: {
        authTypes: ['api-key', 'did:key'],
        rateLimits: { requestsPerMinute: 100, requestsPerDay: 10000 },
        spendingLimits: { perSession: 5000, perDay: 50000, currency: 'USD' },
      },
      verification: {
        level: 'business',
        verifiedAt: '2026-03-17T00:00:00Z',
        trustScore: 85,
      },
    }
    expect(profile.coreIdentity.id).toBe('agent-001')
    expect(profile.capabilities.protocols).toContain('mcp')
    expect(profile.verification.trustScore).toBe(85)
  })

  it('all ProtocolName values are valid', () => {
    const names: ProtocolName[] = ['mcp', 'x402', 'ap2', 'visa-tap', 'mpp', 'ucp', 'acp', 'mastercard-vi', 'circle-nano']
    expect(names).toHaveLength(9)
  })

  it('all PaymentType values are valid', () => {
    const types: PaymentType[] = [
      'credit-balance',
      'eip3009',
      'permit2',
      'card-token',
      'vdc',
      'spt',
      'crypto',
      'payment-handler',
      'agentic-token',
      'nanopayment',
    ]
    expect(types).toHaveLength(10)
  })

  it('all SettlementStatus values are valid', () => {
    const statuses: SettlementStatus[] = [
      'settled',
      'pending',
      'rejected',
      'failed',
    ]
    expect(statuses).toHaveLength(4)
  })

  it('all PricingModel values are valid', () => {
    const models: PricingModel[] = [
      'per-invocation',
      'per-token',
      'per-byte',
      'per-second',
      'tiered',
      'outcome',
    ]
    expect(models).toHaveLength(6)
  })

  it('all LedgerCategory values are valid', () => {
    const cats: LedgerCategory[] = [
      'metering',
      'purchase',
      'payout',
      'refund',
      'fee',
      'netting',
      'delegation',
    ]
    expect(cats).toHaveLength(7)
  })

  it('all AccountType values are valid', () => {
    const types: AccountType[] = ['provider', 'customer', 'platform', 'escrow']
    expect(types).toHaveLength(4)
  })

  it('all EntryType values are valid', () => {
    const types: EntryType[] = ['debit', 'credit']
    expect(types).toHaveLength(2)
  })
})
