/**
 * DC-03 — auth pins for the 4 sites that were UNTESTED before the cron-auth
 * centralization (github/scan + the 3 collapsed routes), plus an explicit
 * LE-09 fail-open regression on a separate-block route (expire-sessions).
 *
 * These routes run the REAL verifyCronAuth helper (only getCronSecret is mocked),
 * so they exercise the centralized constant-time gate end-to-end. Each case
 * asserts the protected handler work is NEVER invoked on a no-secret or bad-token
 * request — a dropped `return` in any auth branch (fail-OPEN) would trip these.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockGetCronSecret,
  mockCheckRateLimit,
  mockRunGridBot,
  mockIsGitHubAppConfigured,
  mockScanRepository,
  mockDbSelect,
  mockExpireSessions,
} = vi.hoisted(() => ({
  mockGetCronSecret: vi.fn(),
  mockCheckRateLimit: vi.fn(),
  mockRunGridBot: vi.fn(),
  mockIsGitHubAppConfigured: vi.fn(),
  mockScanRepository: vi.fn(),
  mockDbSelect: vi.fn(),
  mockExpireSessions: vi.fn(),
}))

vi.mock('@/lib/env', () => ({ getCronSecret: mockGetCronSecret }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/gridbot', () => ({ runGridBot: mockRunGridBot }))
vi.mock('@/lib/github', () => ({
  isGitHubAppConfigured: mockIsGitHubAppConfigured,
  getInstallationToken: vi.fn(),
  listInstallationRepos: vi.fn(),
}))
vi.mock('@/app/api/webhooks/github/scan-impl', () => ({ scanRepository: mockScanRepository }))
vi.mock('@/lib/db', () => ({ db: { select: mockDbSelect } }))
vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', slug: 'slug', name: 'name', status: 'status', proxyEndpoint: 'proxy_endpoint' },
}))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn(), isNull: vi.fn() }))
vi.mock('@/lib/settlement/sessions', () => ({ expireStaleSessionsBatch: mockExpireSessions }))

import { POST as githubScanPOST } from '@/app/api/github/scan/route'
import { GET as cronGridbotGET } from '@/app/api/cron/gridbot/route'
import { POST as adminGridbotPOST } from '@/app/api/admin/gridbot/route'
import { POST as setupProxyPOST } from '@/app/api/admin/setup-proxy-endpoints/route'
import { GET as expireSessionsGET } from '@/app/api/cron/expire-sessions/route'

function req(method: 'GET' | 'POST', url: string, auth?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (auth) headers.authorization = auth
  return new NextRequest(`http://localhost${url}`, { method, headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
})

describe('github/scan auth (was untested — different 500 message preserved)', () => {
  it('500 "Endpoint not configured" on unset CRON_SECRET — never reaches the GitHub-App check', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await githubScanPOST(req('POST', '/api/github/scan'))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Endpoint not configured')
    expect(data.code).toBe('CONFIG_ERROR')
    expect(mockIsGitHubAppConfigured).not.toHaveBeenCalled()
    expect(mockScanRepository).not.toHaveBeenCalled()
  })

  it('401 on a bad token — never reaches the GitHub-App check', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const res = await githubScanPOST(req('POST', '/api/github/scan', 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockIsGitHubAppConfigured).not.toHaveBeenCalled()
  })
})

describe('cron/gridbot auth (collapsed: no-secret AND bad-token → single 401)', () => {
  it('401 on unset CRON_SECRET — never runs GridBot', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await cronGridbotGET(req('GET', '/api/cron/gridbot'))
    expect(res.status).toBe(401)
    expect(mockRunGridBot).not.toHaveBeenCalled()
  })

  it('401 on a bad token — never runs GridBot', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const res = await cronGridbotGET(req('GET', '/api/cron/gridbot', 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockRunGridBot).not.toHaveBeenCalled()
  })
})

describe('admin/gridbot auth (collapsed: no-secret AND bad-token → single 401)', () => {
  it('401 on unset CRON_SECRET — never runs GridBot', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await adminGridbotPOST(req('POST', '/api/admin/gridbot'))
    expect(res.status).toBe(401)
    expect(mockRunGridBot).not.toHaveBeenCalled()
  })

  it('401 on a bad token — never runs GridBot', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const res = await adminGridbotPOST(req('POST', '/api/admin/gridbot', 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockRunGridBot).not.toHaveBeenCalled()
  })
})

describe('admin/setup-proxy-endpoints auth (collapsed: no-secret AND bad-token → single 401)', () => {
  it('401 on unset CRON_SECRET — never queries the DB', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await setupProxyPOST(req('POST', '/api/admin/setup-proxy-endpoints'))
    expect(res.status).toBe(401)
    expect(mockDbSelect).not.toHaveBeenCalled()
  })

  it('401 on a bad token — never queries the DB', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const res = await setupProxyPOST(req('POST', '/api/admin/setup-proxy-endpoints', 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockDbSelect).not.toHaveBeenCalled()
  })
})

// LE-09 fail-open regression on a SEPARATE-BLOCK route (two distinct auth ifs).
// A dropped `return` in the no-secret branch would fall through to the handler on
// an unset secret; a dropped `return` in the unauthorized branch would fall through
// on a bad token. Asserting the protected work is never invoked catches both.
describe('expire-sessions fail-open regression (LE-09)', () => {
  it('500 on unset CRON_SECRET — never expires sessions', async () => {
    mockGetCronSecret.mockReturnValue(undefined)
    const res = await expireSessionsGET(req('GET', '/api/cron/expire-sessions'))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.code).toBe('CONFIG_ERROR')
    expect(mockExpireSessions).not.toHaveBeenCalled()
  })

  it('401 on a bad token — never expires sessions', async () => {
    mockGetCronSecret.mockReturnValue('correct-secret')
    const res = await expireSessionsGET(req('GET', '/api/cron/expire-sessions', 'Bearer wrong'))
    expect(res.status).toBe(401)
    expect(mockExpireSessions).not.toHaveBeenCalled()
  })
})
