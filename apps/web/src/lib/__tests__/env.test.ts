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
    delete process.env.CLERK_SECRET_KEY
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

  it('getClerkSecretKey returns value when set', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_clerk_secret_key'
    const { getClerkSecretKey } = await import('@/lib/env')
    expect(getClerkSecretKey()).toBe('sk_test_clerk_secret_key')
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
    process.env.CLERK_SECRET_KEY = 'sk_test_clerk'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3005'

    const { getEnv } = await import('@/lib/env')
    const env1 = getEnv()
    const env2 = getEnv()

    // Same reference means it was cached
    expect(env1).toBe(env2)
    expect(env1.DATABASE_URL).toBe('postgres://localhost/test')
    expect(env1.CLERK_SECRET_KEY).toBe('sk_test_clerk')
  })
})
