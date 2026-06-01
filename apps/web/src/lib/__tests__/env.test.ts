import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test env.ts which reads process.env directly.
// We re-import each time to test lazy init behavior.

describe('env module', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    // Clear all env vars used by the module
    delete process.env.DATABASE_URL
    delete process.env.REDIS_URL
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_CONNECT_CLIENT_ID
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.RESEND_API_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('getDatabaseUrl returns DATABASE_URL when set', async () => {
    process.env.DATABASE_URL = 'postgres://localhost:5432/test'
    const { getDatabaseUrl } = await import('@/lib/env')
    expect(getDatabaseUrl()).toBe('postgres://localhost:5432/test')
  })

  it('getDatabaseUrl throws when DATABASE_URL is missing', async () => {
    const { getDatabaseUrl } = await import('@/lib/env')
    expect(() => getDatabaseUrl()).toThrow('Missing required environment variable: DATABASE_URL')
  })

  it('getRedisUrl returns REDIS_URL when set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379'
    const { getRedisUrl } = await import('@/lib/env')
    expect(getRedisUrl()).toBe('redis://localhost:6379')
  })

  it('getStripeSecretKey throws with descriptive message when missing', async () => {
    const { getStripeSecretKey } = await import('@/lib/env')
    expect(() => getStripeSecretKey()).toThrow('STRIPE_SECRET_KEY')
    expect(() => getStripeSecretKey()).toThrow('.env.local')
  })

  it('getStripeConnectClientId returns value when set', async () => {
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_test_123'
    const { getStripeConnectClientId } = await import('@/lib/env')
    expect(getStripeConnectClientId()).toBe('ca_test_123')
  })

  it('getStripeConnectClientId returns undefined when not set', async () => {
    const { getStripeConnectClientId } = await import('@/lib/env')
    expect(getStripeConnectClientId()).toBeUndefined()
  })

  it('getStripeWebhookSecret returns value when set', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_123'
    const { getStripeWebhookSecret } = await import('@/lib/env')
    expect(getStripeWebhookSecret()).toBe('whsec_test_123')
  })

  it('getStripeWebhookSecret returns undefined when not set', async () => {
    const { getStripeWebhookSecret } = await import('@/lib/env')
    expect(getStripeWebhookSecret()).toBeUndefined()
  })

  it('getResendApiKey returns value when set', async () => {
    process.env.RESEND_API_KEY = 're_test_123'
    const { getResendApiKey } = await import('@/lib/env')
    expect(getResendApiKey()).toBe('re_test_123')
  })

  it('getSupabaseUrl returns value when set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dljdthtrsuxglybhmqox.supabase.co'
    const { getSupabaseUrl } = await import('@/lib/env')
    expect(getSupabaseUrl()).toBe('https://dljdthtrsuxglybhmqox.supabase.co')
  })

  it('getSupabaseAnonKey returns value when set', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    const { getSupabaseAnonKey } = await import('@/lib/env')
    expect(getSupabaseAnonKey()).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test')
  })

  it('getSupabaseServiceRoleKey returns undefined when not set', async () => {
    const { getSupabaseServiceRoleKey } = await import('@/lib/env')
    expect(getSupabaseServiceRoleKey()).toBeUndefined()
  })

  it('getAppUrl returns value when set', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://settlegrid.ai'
    const { getAppUrl } = await import('@/lib/env')
    expect(getAppUrl()).toBe('https://settlegrid.ai')
  })

  it('getEnv caches after first call and validates all vars at once', async () => {
    process.env.DATABASE_URL = 'postgres://localhost/test'
    process.env.REDIS_URL = 'redis://localhost'
    process.env.STRIPE_SECRET_KEY = 'sk_test'
    process.env.STRIPE_CONNECT_CLIENT_ID = 'ca_test'
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.RESEND_API_KEY = 're_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dljdthtrsuxglybhmqox.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3005'

    const { getEnv } = await import('@/lib/env')
    const env1 = getEnv()
    const env2 = getEnv()

    // Same reference means it was cached
    expect(env1).toBe(env2)
    expect(env1.DATABASE_URL).toBe('postgres://localhost/test')
    expect(env1.NEXT_PUBLIC_SUPABASE_URL).toBe('https://dljdthtrsuxglybhmqox.supabase.co')
  })

  describe('useUnifiedAdapters (feature flag — P2.K3 flipped default to true)', () => {
    // P2.K3 flipped the default from off to on once the
    // apps/web/src/lib/__tests__/proxy-equivalence.test.ts snapshot test
    // proved byte-for-byte parity between the legacy 13-branch chain and
    // the unified adapter-registry dispatch path.
    //
    // The P2.K3 hostile-review pass made the opt-out case-insensitive
    // and whitespace-tolerant — an operator setting FALSE in an
    // emergency rollback should not have to discover via another
    // failed deploy that the flag is case-sensitive. Typos (e.g.
    // 'flase') still leave the unified path on; that's the
    // rollout-safety half of the contract.
    //
    // See env.ts for the full rationale + design-tension analysis.
    it.each([
      // Explicit OFF (various cases + whitespace): all disable.
      ['false', false],
      ['FALSE', false], // case-insensitive opt-out
      ['False', false], // case-insensitive opt-out
      ['fAlSe', false], // case-insensitive opt-out (pathological case)
      ['  false  ', false], // surrounding whitespace tolerated
      ['false\n', false], // trailing newline tolerated
      // Everything else leaves the unified path on.
      ['true', true],
      ['TRUE', true],
      ['True', true],
      ['1', true],
      ['yes', true],
      ['on', true],
      ['', true],
      ['flase', true], // typo: safe default, stays on
      ['no', true], // other falsy-ish strings: stay on (not the opt-out value)
      ['0', true],
    ])('USE_UNIFIED_ADAPTERS=%j → %j', async (value, expected) => {
      process.env.USE_UNIFIED_ADAPTERS = value
      const { useUnifiedAdapters } = await import('@/lib/env')
      expect(useUnifiedAdapters()).toBe(expected)
    })

    it('returns true when USE_UNIFIED_ADAPTERS is unset (P2.K3 default on)', async () => {
      delete process.env.USE_UNIFIED_ADAPTERS
      const { useUnifiedAdapters } = await import('@/lib/env')
      expect(useUnifiedAdapters()).toBe(true)
    })
  })

  // F2 — the load-bearing testnet-USDC-on-mainnet guard. The proxy rejects a
  // non-mainnet x402 payload unless isX402TestnetSettlementAllowed() is true, so
  // the prod HARD-PIN (false even with the flag ON) is what prevents free testnet
  // USDC from minting real, withdrawable developer credit on a mainnet deploy.
  describe('x402 production network-pin (F2)', () => {
    it('X402_MAINNET_NETWORK is Base mainnet eip155:8453', async () => {
      const { X402_MAINNET_NETWORK } = await import('@/lib/env')
      expect(X402_MAINNET_NETWORK).toBe('eip155:8453')
    })

    it.each([
      // [NODE_ENV, SETTLEGRID_X402_ALLOW_TESTNET, expected]
      ['production', 'true', false], // HARD-PIN: prod rejects testnet even with the flag ON
      ['production', 'false', false], // prod, explicit off
      ['production', undefined, false], // prod, no flag → mainnet only
      ['development', 'true', true], // non-prod + explicit opt-in → testnet allowed
      ['test', 'true', true], // non-prod + explicit opt-in → testnet allowed
      ['development', undefined, false], // non-prod default is mainnet-only too
      ['development', '1', false], // only the literal 'true' opts in
    ])('NODE_ENV=%j flag=%j → isX402TestnetSettlementAllowed=%j', async (nodeEnv, flag, expected) => {
      // NODE_ENV is typed read-only; cast for the test (afterEach restores process.env).
      ;(process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv
      if (flag === undefined) delete process.env.SETTLEGRID_X402_ALLOW_TESTNET
      else process.env.SETTLEGRID_X402_ALLOW_TESTNET = flag
      const { isX402TestnetSettlementAllowed } = await import('@/lib/env')
      expect(isX402TestnetSettlementAllowed()).toBe(expected)
    })
  })
})
