import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const { mockCheckRateLimit, mockGetCronSecret } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 }),
  mockGetCronSecret: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/env', () => ({
  getCronSecret: mockGetCronSecret,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// db mock — these handlers should NEVER reach DB queries when the kill
// switch is off. The mock throws if select is called so the test fails
// loudly if the early-exit branch is broken.
const dbThrow = () => {
  throw new Error('db.select must NOT be called when CLAIM_EMAILS_ENABLED is off')
}
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(dbThrow),
    update: vi.fn().mockImplementation(dbThrow),
    insert: vi.fn().mockImplementation(dbThrow),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  tools: {
    id: 'id',
    slug: 'slug',
    sourceEcosystem: 'source_ecosystem',
    sourceRepoUrl: 'source_repo_url',
    toolType: 'tool_type',
    name: 'name',
    status: 'status',
    claimEmailSentAt: 'claim_email_sent_at',
    claimToken: 'claim_token',
    claimFollowUpCount: 'claim_follow_up_count',
    lastFollowUpAt: 'last_follow_up_at',
    updatedAt: 'updated_at',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNotNull: vi.fn(),
  sql: Object.assign(vi.fn().mockReturnValue('sql'), { join: vi.fn(), raw: vi.fn() }),
  lt: vi.fn(),
}))

// Redis mock — also throws if reached so we verify the early exit happens
// before any Redis call.
const redisThrow = () => {
  throw new Error('redis must NOT be called when CLAIM_EMAILS_ENABLED is off')
}
vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn().mockReturnValue({
    get: vi.fn().mockImplementation(redisThrow),
    set: vi.fn().mockImplementation(redisThrow),
    incr: vi.fn().mockImplementation(redisThrow),
    expire: vi.fn().mockImplementation(redisThrow),
  }),
}))

// Email send mock — also throws so we verify no email is sent on the
// kill-switch-off path.
const emailThrow = () => {
  throw new Error('sendEmail must NOT be called when CLAIM_EMAILS_ENABLED is off')
}
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockImplementation(emailThrow),
  FROM_OUTREACH: 'outreach@settlegrid.ai',
  FROM_TRANSACTIONAL: 'noreply@settlegrid.ai',
  claimToolOutreachEmail: vi.fn(),
  claimAiModelEmail: vi.fn(),
  claimPackageEmail: vi.fn(),
  claimApiServiceEmail: vi.fn(),
  claimAgentToolEmail: vi.fn(),
  claimFollowUpE2: vi.fn(),
  claimFollowUpE3: vi.fn(),
  claimFollowUpE4: vi.fn(),
}))

vi.mock('@/lib/ecosystem-email-resolver', () => ({
  resolveCreatorEmailWithBackfill: vi.fn(),
  resolveCreatorEmail: vi.fn(),
}))

vi.mock('@/lib/indexer-quality', () => ({
  readIndexerQualityScores: vi.fn().mockResolvedValue({}),
  computeWeightedPriority: vi.fn().mockReturnValue(0),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string, authHeader: string): NextRequest {
  const headers: Record<string, string> = { authorization: authHeader }
  return new NextRequest(`http://localhost:3005${url}`, { method: 'GET', headers })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('claim emails kill switch — claim-outreach', () => {
  const ORIGINAL_ENV = process.env.CLAIM_EMAILS_ENABLED

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockGetCronSecret.mockReturnValue('test-cron-secret')
  })

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CLAIM_EMAILS_ENABLED
    } else {
      process.env.CLAIM_EMAILS_ENABLED = ORIGINAL_ENV
    }
  })

  it('returns skipped:true when CLAIM_EMAILS_ENABLED is unset (default OFF)', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED

    const { GET } = await import('@/app/api/cron/claim-outreach/route')
    const response = await GET(
      makeRequest('/api/cron/claim-outreach', 'Bearer test-cron-secret')
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('kill_switch')
    expect(data.flag).toBe('CLAIM_EMAILS_ENABLED')
  })

  it('returns skipped:true when CLAIM_EMAILS_ENABLED is "false"', async () => {
    process.env.CLAIM_EMAILS_ENABLED = 'false'

    const { GET } = await import('@/app/api/cron/claim-outreach/route')
    const response = await GET(
      makeRequest('/api/cron/claim-outreach', 'Bearer test-cron-secret')
    )

    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('returns skipped:true for non-"true" values like "1" or "yes"', async () => {
    for (const value of ['1', 'yes', 'TRUE', 'True', '']) {
      process.env.CLAIM_EMAILS_ENABLED = value

      const { GET } = await import('@/app/api/cron/claim-outreach/route')
      const response = await GET(
        makeRequest('/api/cron/claim-outreach', 'Bearer test-cron-secret')
      )

      const data = await response.json()
      expect(data.skipped, `value=${JSON.stringify(value)} should be skipped`).toBe(true)
    }
  })

  it('still rejects unauthorized requests when kill switch is off', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED

    const { GET } = await import('@/app/api/cron/claim-outreach/route')
    const response = await GET(
      makeRequest('/api/cron/claim-outreach', 'Bearer wrong-secret')
    )

    expect(response.status).toBe(401)
  })

  it('still returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/claim-outreach/route')
    const response = await GET(
      makeRequest('/api/cron/claim-outreach', 'Bearer anything')
    )

    expect(response.status).toBe(500)
  })
})

describe('claim emails kill switch — claim-follow-up', () => {
  const ORIGINAL_ENV = process.env.CLAIM_EMAILS_ENABLED

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
    mockGetCronSecret.mockReturnValue('test-cron-secret')
  })

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CLAIM_EMAILS_ENABLED
    } else {
      process.env.CLAIM_EMAILS_ENABLED = ORIGINAL_ENV
    }
  })

  it('returns skipped:true when CLAIM_EMAILS_ENABLED is unset (default OFF)', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED

    const { GET } = await import('@/app/api/cron/claim-follow-up/route')
    const response = await GET(
      makeRequest('/api/cron/claim-follow-up', 'Bearer test-cron-secret')
    )

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.skipped).toBe(true)
    expect(data.reason).toBe('kill_switch')
    expect(data.flag).toBe('CLAIM_EMAILS_ENABLED')
  })

  it('returns skipped:true when CLAIM_EMAILS_ENABLED is "false"', async () => {
    process.env.CLAIM_EMAILS_ENABLED = 'false'

    const { GET } = await import('@/app/api/cron/claim-follow-up/route')
    const response = await GET(
      makeRequest('/api/cron/claim-follow-up', 'Bearer test-cron-secret')
    )

    const data = await response.json()
    expect(data.skipped).toBe(true)
  })

  it('still rejects unauthorized requests when kill switch is off', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED

    const { GET } = await import('@/app/api/cron/claim-follow-up/route')
    const response = await GET(
      makeRequest('/api/cron/claim-follow-up', 'Bearer wrong-secret')
    )

    expect(response.status).toBe(401)
  })

  it('still returns 500 when CRON_SECRET is not configured', async () => {
    delete process.env.CLAIM_EMAILS_ENABLED
    mockGetCronSecret.mockReturnValue(null)

    const { GET } = await import('@/app/api/cron/claim-follow-up/route')
    const response = await GET(
      makeRequest('/api/cron/claim-follow-up', 'Bearer anything')
    )

    expect(response.status).toBe(500)
  })
})
