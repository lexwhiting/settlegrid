import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createMiddleware, extractApiKey } from '../middleware'
import { settlegrid } from '../index'
import type { NormalizedConfig } from '../config'
import type { GeneralizedPricingConfig, PricingConfig } from '../types'

const baseConfig: NormalizedConfig = {
  apiUrl: 'https://settlegrid.ai',
  toolSlug: 'test-tool',
  debug: false,
  cacheTtlMs: 0,
  timeoutMs: 5000,
}

describe('extractApiKey', () => {
  it('extracts from MCP metadata settlegrid-api-key', () => {
    const key = extractApiKey(undefined, { 'settlegrid-api-key': 'sk_test_123' })
    expect(key).toBe('sk_test_123')
  })

  it('extracts from MCP metadata x-api-key', () => {
    const key = extractApiKey(undefined, { 'x-api-key': 'sk_test_456' })
    expect(key).toBe('sk_test_456')
  })

  it('prefers settlegrid-api-key over x-api-key in metadata', () => {
    const key = extractApiKey(undefined, {
      'settlegrid-api-key': 'preferred',
      'x-api-key': 'fallback',
    })
    expect(key).toBe('preferred')
  })

  it('extracts from Authorization Bearer header', () => {
    const key = extractApiKey({ authorization: 'Bearer sk_test_789' })
    expect(key).toBe('sk_test_789')
  })

  it('extracts from x-api-key header', () => {
    const key = extractApiKey({ 'x-api-key': 'sk_test_abc' })
    expect(key).toBe('sk_test_abc')
  })

  it('extracts from X-Api-Key header (case variation)', () => {
    const key = extractApiKey({ 'X-Api-Key': 'sk_test_def' })
    expect(key).toBe('sk_test_def')
  })

  it('handles array header values', () => {
    const key = extractApiKey({ 'x-api-key': ['sk_test_arr'] })
    expect(key).toBe('sk_test_arr')
  })

  it('returns null when no key found', () => {
    const key = extractApiKey({})
    expect(key).toBeNull()
  })

  it('returns null for undefined headers and metadata', () => {
    const key = extractApiKey(undefined, undefined)
    expect(key).toBeNull()
  })

  it('returns null for no arguments', () => {
    const key = extractApiKey()
    expect(key).toBeNull()
  })

  it('ignores non-Bearer authorization', () => {
    const key = extractApiKey({ authorization: 'Basic abc123' })
    expect(key).toBeNull()
  })

  it('prefers metadata over headers', () => {
    const key = extractApiKey(
      { 'x-api-key': 'header-key' },
      { 'settlegrid-api-key': 'metadata-key' }
    )
    expect(key).toBe('metadata-key')
  })
})

// ─── checkCredits: all 6 pricing models resolve through resolveOperationCost ─
//
// Before P1.SDK1, middleware.ts called getMethodCost() at line 176, which
// only supports the legacy per-invocation model. These tests verify that
// the new createMiddleware wiring correctly delegates to
// resolveOperationCost and that all six pricing models charge the right
// amount through the checkCredits path that sg.wrap() calls.
describe('createMiddleware.checkCredits — 6 pricing models', () => {
  it('per-invocation (legacy PricingConfig): falls back to defaultCostCents', () => {
    const pricing: PricingConfig = {
      defaultCostCents: 5,
      methods: { search: { costCents: 10 } },
    }
    const mw = createMiddleware(baseConfig, pricing)
    expect(mw.checkCredits(1000, 'default').costCents).toBe(5)
    expect(mw.checkCredits(1000, 'search').costCents).toBe(10)
    expect(mw.checkCredits(1000, 'unknown').costCents).toBe(5)
  })

  it('per-invocation (generalized): ignores units, returns defaultCostCents', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-invocation',
      defaultCostCents: 7,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // units is ignored for per-invocation — cost is flat defaultCostCents
    expect(mw.checkCredits(1000, 'any-method').costCents).toBe(7)
    expect(mw.checkCredits(1000, 'any-method', 100).costCents).toBe(7)
  })

  it('per-token with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 100 tokens × 1¢ = 100¢
    expect(mw.checkCredits(1000, 'generate', 100).costCents).toBe(100)
    // Without units, defaults to 1 token × 1¢ = 1¢
    expect(mw.checkCredits(1000, 'generate').costCents).toBe(1)
  })

  it('per-byte with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-byte',
      defaultCostCents: 2,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 50 bytes × 2¢ = 100¢
    expect(mw.checkCredits(1000, 'download', 50).costCents).toBe(100)
  })

  it('tiered with units: walks tier schedule and sums per-tier costs', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'tiered',
      defaultCostCents: 1,
      tiers: [
        { upTo: 100, costCents: 2 },
        { upTo: 900, costCents: 1 },
      ],
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 150 units = 100 at 2¢ + 50 at 1¢ = 250¢
    expect(mw.checkCredits(1000, 'api', 150).costCents).toBe(250)
  })

  it('outcome: returns successCostCents as pre-auth quote', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'outcome',
      defaultCostCents: 10,
      outcomeConfig: {
        successCostCents: 50,
        failureCostCents: 0,
        successCondition: 'result.success === true',
      },
    }
    const mw = createMiddleware(baseConfig, pricing)
    // Outcome pricing authorizes for the success price up front; the
    // real per-call cost is resolved after execution but checkCredits
    // needs a number to gate the pipeline.
    expect(mw.checkCredits(1000, 'classify').costCents).toBe(50)
  })

  it('per-second with units: charges defaultCostCents * units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-second',
      defaultCostCents: 3,
    }
    const mw = createMiddleware(baseConfig, pricing)
    expect(mw.checkCredits(1000, 'compute', 10).costCents).toBe(30)
  })

  it('method override in per-token model multiplies override by units', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
      methods: { embed: { costCents: 5 } },
    }
    const mw = createMiddleware(baseConfig, pricing)
    // embed method: 5¢/token × 10 tokens = 50¢
    expect(mw.checkCredits(1000, 'embed', 10).costCents).toBe(50)
    // default: 1¢/token × 10 tokens = 10¢
    expect(mw.checkCredits(1000, 'other', 10).costCents).toBe(10)
  })

  it('sufficient flag reflects balance vs. resolved cost for unit-based pricing', () => {
    const pricing: GeneralizedPricingConfig = {
      model: 'per-token',
      defaultCostCents: 1,
    }
    const mw = createMiddleware(baseConfig, pricing)
    // 1000¢ balance, 500 tokens @ 1¢ = 500¢: sufficient
    expect(mw.checkCredits(1000, 'gen', 500).sufficient).toBe(true)
    // 1000¢ balance, 2000 tokens @ 1¢ = 2000¢: insufficient
    expect(mw.checkCredits(1000, 'gen', 2000).sufficient).toBe(false)
  })
})

// ─── sg.wrap() true end-to-end with fetch mock: pricing-model → meter body ──
//
// DoD item 3 requires the 6 pricing models to work "end-to-end through
// sg.wrap()". The checkCredits tests above verify delegation to
// resolveOperationCost in isolation, and the sdk-validation tests
// verify `units` threading to middleware.execute (with execute mocked).
// This block closes the loop by exercising the FULL pipeline with a
// stubbed global fetch: sg.wrap() → execute → validateKey → checkCredits
// → handler → meter. The meter POST body is captured so we can assert
// the `costCents` field reflects the resolved pricing-model cost.
describe('sg.wrap() end-to-end with fetch mock — pricing-model → meter body', () => {
  type MockFetchImpl = (url: string, init: RequestInit) => Promise<Response>
  let fetchMock: ReturnType<typeof vi.fn<MockFetchImpl>>
  let validateKeyCalls: Array<Record<string, unknown>>
  let meterCalls: Array<Record<string, unknown>>

  beforeEach(() => {
    validateKeyCalls = []
    meterCalls = []
    fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>
      if (url.endsWith('/api/sdk/validate-key')) {
        validateKeyCalls.push(body)
        return new Response(
          JSON.stringify({
            valid: true,
            consumerId: 'con-e2e',
            toolId: 'tool-e2e',
            keyId: 'key-e2e',
            balanceCents: 1_000_000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.endsWith('/api/sdk/meter')) {
        meterCalls.push(body)
        return new Response(
          JSON.stringify({
            success: true,
            remainingBalanceCents: 999_900,
            costCents: (body.costCents as number) ?? 0,
            invocationId: 'inv-e2e',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('unexpected url', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('per-token × units: meter body charges defaultCostCents × units', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-token',
      pricing: { model: 'per-token', defaultCostCents: 1 },
      debug: true, // synchronous meter so the fetch happens before wrap() resolves
    })
    const handler = vi.fn().mockResolvedValue({ ok: true })
    const wrapped = sg.wrap(handler, { method: 'generate', units: 100 })
    const result = await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })

    expect(result).toEqual({ ok: true })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(validateKeyCalls).toHaveLength(1)
    expect(meterCalls).toHaveLength(1)
    // 1¢ × 100 tokens = 100¢
    expect(meterCalls[0].costCents).toBe(100)
    expect(meterCalls[0].method).toBe('generate')
  })

  it('per-byte × units: meter body charges defaultCostCents × units', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-bytes',
      pricing: { model: 'per-byte', defaultCostCents: 2 },
      debug: true,
    })
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'download', units: 50 })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })
    // 2¢ × 50 bytes = 100¢
    expect(meterCalls[0].costCents).toBe(100)
  })

  it('tiered × units: meter body walks the tier schedule', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-tiered',
      pricing: {
        model: 'tiered',
        defaultCostCents: 1,
        tiers: [
          { upTo: 100, costCents: 2 },
          { upTo: 900, costCents: 1 },
        ],
      },
      debug: true,
    })
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'api', units: 150 })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })
    // 100 × 2¢ + 50 × 1¢ = 250¢
    expect(meterCalls[0].costCents).toBe(250)
  })

  it('outcome: meter body uses successCostCents as pre-auth', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-outcome',
      pricing: {
        model: 'outcome',
        defaultCostCents: 0,
        outcomeConfig: {
          successCostCents: 50,
          failureCostCents: 0,
          successCondition: 'result.ok === true',
        },
      },
      debug: true,
    })
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'classify' })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })
    expect(meterCalls[0].costCents).toBe(50)
  })

  it('per-invocation (generalized): units is ignored, charges defaultCostCents', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-perinv',
      pricing: { model: 'per-invocation', defaultCostCents: 7 },
      debug: true,
    })
    // Even if caller passes units=999, per-invocation ignores it
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'go', units: 999 })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })
    expect(meterCalls[0].costCents).toBe(7)
  })

  it('legacy PricingConfig (no model): falls through to per-invocation', async () => {
    const sg = settlegrid.init({
      toolSlug: 'e2e-legacy',
      pricing: {
        defaultCostCents: 3,
        methods: { search: { costCents: 9 } },
      },
      debug: true,
    })
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'search' })
    await wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } })
    expect(meterCalls[0].costCents).toBe(9)
  })

  it('insufficient credits: rejects when balance < per-token cost', async () => {
    // Override the validateKey response with a tiny balance for this test
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as Record<string, unknown>
      if (url.endsWith('/api/sdk/validate-key')) {
        validateKeyCalls.push(body)
        return new Response(
          JSON.stringify({
            valid: true,
            consumerId: 'con-poor',
            toolId: 'tool-poor',
            keyId: 'key-poor',
            balanceCents: 10, // only 10¢
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.endsWith('/api/sdk/meter')) {
        meterCalls.push(body)
        return new Response(
          JSON.stringify({
            success: true,
            remainingBalanceCents: 0,
            costCents: 0,
            invocationId: 'inv-never',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('unexpected', { status: 404 })
    })

    const { InsufficientCreditsError } = await import('../errors')
    const sg = settlegrid.init({
      toolSlug: 'e2e-broke',
      pricing: { model: 'per-token', defaultCostCents: 1 },
      debug: true,
    })
    const handler = vi.fn().mockResolvedValue({ ok: true })
    // 100 tokens × 1¢ = 100¢ required, only 10¢ available
    const wrapped = sg.wrap(handler, { method: 'generate', units: 100 })
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_e2e' } }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError)

    // Handler must NOT have been called when credits are insufficient
    expect(handler).not.toHaveBeenCalled()
    // Meter must NOT have been called either
    expect(meterCalls).toHaveLength(0)
  })
})

// ─── Units validation: reject nonsense values before they reach pricing ─────
describe('middleware.execute units validation', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string, _init: RequestInit) => {
      if (url.endsWith('/api/sdk/validate-key')) {
        return new Response(
          JSON.stringify({
            valid: true,
            consumerId: 'c',
            toolId: 't',
            keyId: 'k',
            balanceCents: 1_000_000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify({
          success: true,
          remainingBalanceCents: 999_999,
          costCents: 1,
          invocationId: 'inv',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function makeWrapped(units: number) {
    const sg = settlegrid.init({
      toolSlug: 'units-test',
      pricing: { model: 'per-token', defaultCostCents: 1 },
      debug: true,
    })
    return sg.wrap(() => ({ ok: true }), { method: 'gen', units })
  }

  it('rejects negative units', async () => {
    const wrapped = makeWrapped(-1)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).rejects.toThrow(/Invalid units.*non-negative/)
  })

  it('rejects NaN units', async () => {
    const wrapped = makeWrapped(NaN)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).rejects.toThrow(/Invalid units.*finite/)
  })

  it('rejects Infinity units', async () => {
    const wrapped = makeWrapped(Infinity)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).rejects.toThrow(/Invalid units.*finite/)
  })

  it('rejects -Infinity units', async () => {
    const wrapped = makeWrapped(-Infinity)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).rejects.toThrow(/Invalid units/)
  })

  it('rejects non-numeric units (runtime bypass of TS)', async () => {
    // Bypass TypeScript with unknown cast — simulates a JS caller
    const wrapped = makeWrapped('ten' as unknown as number)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).rejects.toThrow(/Invalid units/)
  })

  it('accepts units = 0 (free call for unit-based models)', async () => {
    const wrapped = makeWrapped(0)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepts fractional units (e.g. 1.5 seconds)', async () => {
    const wrapped = makeWrapped(1.5)
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepts undefined units (omitted)', async () => {
    const sg = settlegrid.init({
      toolSlug: 'units-omit',
      pricing: { model: 'per-token', defaultCostCents: 1 },
      debug: true,
    })
    // No units field at all
    const wrapped = sg.wrap(() => ({ ok: true }), { method: 'gen' })
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).resolves.toEqual({ ok: true })
  })

  it('accepts wrap options with units but no method (defaults to "default")', async () => {
    // Verifies that `units` can be the only WrapOption — `method` falls
    // through to the 'default' value defined in index.ts.
    const sg = settlegrid.init({
      toolSlug: 'units-no-method',
      pricing: { model: 'per-token', defaultCostCents: 2 },
      debug: true,
    })
    const wrapped = sg.wrap(() => ({ ok: true }), { units: 25 })
    await expect(
      wrapped({}, { headers: { 'x-api-key': 'sg_live_test' } }),
    ).resolves.toEqual({ ok: true })
  })

  it('units validation is LAZY: invalid units does not throw at wrap construction time', () => {
    // Validation lives in execute(), not in wrap(). Constructing a
    // wrapped handler with bad units must NOT throw — the error
    // surfaces only when the wrapped function is actually invoked.
    // This matches the existing pattern where validateKey errors,
    // checkCredits errors, etc. are all per-invocation.
    const sg = settlegrid.init({
      toolSlug: 'units-lazy',
      pricing: { model: 'per-token', defaultCostCents: 1 },
      debug: true,
    })
    expect(() => sg.wrap(() => ({ ok: true }), { units: NaN })).not.toThrow()
    expect(() => sg.wrap(() => ({ ok: true }), { units: -5 })).not.toThrow()
    expect(() => sg.wrap(() => ({ ok: true }), { units: Infinity })).not.toThrow()
  })
})
