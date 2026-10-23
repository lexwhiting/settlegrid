/**
 * /api/developer/invite exposes GET only. Signup referrals are applied
 * server-side in app/auth/callback/route.ts (processSignupInvite).
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/db/schema', () => ({ developers: {}, signupInvites: {} }))
vi.mock('@/lib/middleware/auth', () => ({ requireDeveloper: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
}))

describe('/api/developer/invite', () => {
  it('exports GET only', async () => {
    const mod = await import('../route')
    expect(typeof mod.GET).toBe('function')
    expect('POST' in mod).toBe(false)
  })
})
