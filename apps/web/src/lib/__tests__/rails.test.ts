/**
 * P2.RAIL1 — tests for apps/web/src/lib/rails.ts.
 *
 * Coverage target: the web-app wrapper around the @settlegrid/mcp
 * rail registry. Three concerns:
 *   1. getStripeClient() memoizes the Stripe SDK client (one per process)
 *   2. getRailRegistry() shares that same client with the rails registry
 *   3. __resetRailRegistry refuses to run outside NODE_ENV==='test'
 *      (the hostile-review II fix)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the env module so getStripeClient() doesn't try to read a
// real secret from process.env during tests.
vi.mock('@/lib/env', () => ({
  getStripeSecretKey: () => 'sk_test_x_x_x_dummy',
  getAppUrl: () => 'https://test.settlegrid.ai',
}))

// Mock stripe so `new Stripe(...)` doesn't try to validate the key.
vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      accounts = { create: vi.fn(), retrieve: vi.fn() }
      accountLinks = { create: vi.fn() }
      checkout = { sessions: { create: vi.fn() } }
      webhooks = { constructEvent: vi.fn() }
      constructor(public secret: string) {}
    },
  }
})

describe('getStripeClient — memoization', () => {
  beforeEach(async () => {
    const mod = await import('../rails')
    mod.__resetRailRegistry()
  })

  it('returns the same Stripe instance on repeated calls', async () => {
    const { getStripeClient } = await import('../rails')
    const a = getStripeClient()
    const b = getStripeClient()
    expect(a).toBe(b)
  })
})

describe('getRailRegistry — shared client', () => {
  beforeEach(async () => {
    const mod = await import('../rails')
    mod.__resetRailRegistry()
  })

  it('returns the same registry on repeated calls', async () => {
    const { getRailRegistry } = await import('../rails')
    const r1 = getRailRegistry()
    const r2 = getRailRegistry()
    expect(r1).toBe(r2)
  })

  it('populates stripe-connect but not future rails', async () => {
    const { getRailRegistry } = await import('../rails')
    const r = getRailRegistry()
    expect(r['stripe-connect']).toBeDefined()
    expect(r['paddle']).toBeUndefined()
    expect(r['lemon-squeezy']).toBeUndefined()
  })
})

describe('getRailDisplayMetadata', () => {
  beforeEach(async () => {
    const mod = await import('../rails')
    mod.__resetRailRegistry()
  })

  it('returns one entry per populated rail', async () => {
    const { getRailDisplayMetadata } = await import('../rails')
    const entries = getRailDisplayMetadata()
    expect(entries).toHaveLength(1)
    expect(entries[0].id).toBe('stripe-connect')
    expect(entries[0].displayName).toBe('Stripe Connect')
    expect(entries[0].legalStructure).toBe('platform')
    expect(typeof entries[0].percentBps).toBe('number')
    expect(typeof entries[0].flatCents).toBe('number')
  })

  it('entries are JSON-serializable (no functions, no Stripe client)', async () => {
    const { getRailDisplayMetadata } = await import('../rails')
    const entries = getRailDisplayMetadata()
    // JSON.stringify + parse round-trips cleanly — no Date/Map/Function
    // in the payload that would break client-side hydration.
    const roundtripped = JSON.parse(JSON.stringify(entries))
    expect(roundtripped).toEqual(entries)
  })
})

describe('getStripeConnectDisplayName', () => {
  beforeEach(async () => {
    const mod = await import('../rails')
    mod.__resetRailRegistry()
  })

  it('returns the Stripe Connect display name from the registry', async () => {
    const { getStripeConnectDisplayName } = await import('../rails')
    expect(getStripeConnectDisplayName()).toBe('Stripe Connect')
  })
})

describe('buildRailDisplayMetadata — pure iteration (defensive branches)', () => {
  it('skips entries with undefined adapter values', async () => {
    const { buildRailDisplayMetadata } = await import('../rails')
    const registry = {
      'stripe-connect': undefined,
      'paddle': undefined,
    }
    expect(buildRailDisplayMetadata(registry)).toEqual([])
  })

  it('returns an empty array for a fully-empty registry', async () => {
    const { buildRailDisplayMetadata } = await import('../rails')
    expect(buildRailDisplayMetadata({})).toEqual([])
  })

  it('returns metadata for populated entries only', async () => {
    const { buildRailDisplayMetadata } = await import('../rails')
    const fakeAdapter = {
      id: 'stripe-connect' as const,
      displayName: 'Stripe Connect',
      legalStructure: 'platform' as const,
      capabilities: {
        individualCountries: [],
        businessCountries: [],
        payoutCurrencies: [],
        acceptCurrencies: [],
        supportsMeteredCheckout: true,
        supportsApplicationFees: true,
      },
      compliance: {} as never,
      pricing: {
        basePercentBps: 30,
        baseFlatCents: 30,
        // P3.K4 — legacy aliases are still populated for back-compat
        // with dashboards that read .percentBps directly.
        percentBps: 30,
        flatCents: 30,
      },
      startOnboarding: vi.fn(),
      syncOnboardingStatus: vi.fn(),
      createTopupSession: vi.fn(),
      handleWebhook: vi.fn(),
    }
    const registry = { 'stripe-connect': fakeAdapter, 'paddle': undefined }
    const result = buildRailDisplayMetadata(registry)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('stripe-connect')
    expect(result[0].percentBps).toBe(30)
    expect(result[0].flatCents).toBe(30)
  })
})

describe('resolveStripeConnectDisplayName — pure resolver (fallback branch)', () => {
  it('returns the adapter displayName when populated', async () => {
    const { resolveStripeConnectDisplayName } = await import('../rails')
    // Minimal shape — only displayName is read by the resolver; other
    // fields cast through unknown to satisfy the RailAdapter contract.
    const registry = {
      'stripe-connect': { displayName: 'Stripe Connect Standard' },
    } as unknown as Parameters<typeof resolveStripeConnectDisplayName>[0]
    expect(resolveStripeConnectDisplayName(registry)).toBe(
      'Stripe Connect Standard',
    )
  })

  it('falls back to literal "Stripe Connect" when slot is empty', async () => {
    const { resolveStripeConnectDisplayName } = await import('../rails')
    expect(resolveStripeConnectDisplayName({})).toBe('Stripe Connect')
  })

  it('falls back to literal "Stripe Connect" when slot is explicitly undefined', async () => {
    const { resolveStripeConnectDisplayName } = await import('../rails')
    expect(
      resolveStripeConnectDisplayName({ 'stripe-connect': undefined }),
    ).toBe('Stripe Connect')
  })
})

describe('__resetRailRegistry — hostile-review II guard', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV
  })

  afterEach(() => {
    // Restore NODE_ENV regardless of what each test set it to.
    if (originalEnv === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV
    } else {
      ;(process.env as Record<string, string>).NODE_ENV = originalEnv
    }
  })

  it('runs cleanly when NODE_ENV === test', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'test'
    const { __resetRailRegistry } = await import('../rails')
    expect(() => __resetRailRegistry()).not.toThrow()
  })

  it('throws when NODE_ENV === production', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'production'
    const { __resetRailRegistry } = await import('../rails')
    expect(() => __resetRailRegistry()).toThrowError(/test-only/)
  })

  it('throws when NODE_ENV === development', async () => {
    ;(process.env as Record<string, string>).NODE_ENV = 'development'
    const { __resetRailRegistry } = await import('../rails')
    expect(() => __resetRailRegistry()).toThrowError(/test-only/)
  })

  it('throws when NODE_ENV is undefined', async () => {
    delete (process.env as Record<string, string | undefined>).NODE_ENV
    const { __resetRailRegistry } = await import('../rails')
    expect(() => __resetRailRegistry()).toThrowError(/test-only/)
  })
})
