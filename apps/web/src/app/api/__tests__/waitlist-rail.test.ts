/**
 * P3.RAIL1 — /api/waitlist rail-specific extension tests.
 *
 * The route was extended to accept `countryIso`, `entityType`,
 * `preferredCurrency`, `waitlistReason` for the rail waitlist flow.
 * These tests verify:
 *   - Rail-specific submission persists country/entity into metadata
 *   - Pre-RAIL1 payloads (email + feature only) still work with metadata=null
 *   - Slack/Discord webhooks fire when env vars are configured
 *   - Slack/Discord webhooks are skipped when env vars are absent
 *   - Email is redacted before going to Slack
 *   - The rail-specific email template is used when feature='stripe-connect-rail'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockCheckRateLimit,
  mockSendEmail,
  mockRailWaitlistEmail,
  mockGenericWaitlistEmail,
  mockSendSlack,
  mockSendDiscord,
} = vi.hoisted(() => {
  const mockDb = {
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoNothing: vi.fn(),
    returning: vi.fn(),
  }
  for (const key of Object.keys(mockDb)) {
    ;(mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
  }
  // Final terminal — `.returning(...)` resolves to an array of rows
  // for new inserts, [] for ON CONFLICT DO NOTHING hits. Tests that
  // need the duplicate-suppression branch override this mock.
  mockDb.returning.mockResolvedValue([{ id: 'new-id' }])
  return {
    mockDb,
    mockCheckRateLimit: vi
      .fn()
      .mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
    mockSendEmail: vi.fn().mockResolvedValue(true),
    mockRailWaitlistEmail: vi
      .fn()
      .mockReturnValue({ subject: 'rail subj', html: '<p>rail</p>' }),
    mockGenericWaitlistEmail: vi
      .fn()
      .mockReturnValue({ subject: 'generic subj', html: '<p>generic</p>' }),
    mockSendSlack: vi.fn().mockResolvedValue(true),
    mockSendDiscord: vi.fn().mockResolvedValue(true),
  }
})

vi.mock('@/lib/db', () => ({
  db: mockDb,
  schema: {},
}))

vi.mock('@/lib/db/schema', () => ({
  waitlistSignups: { email: 'email', feature: 'feature' },
}))

vi.mock('@/lib/rate-limit', () => ({
  authLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))

vi.mock('@/lib/email', () => ({
  sendEmail: mockSendEmail,
  waitlistConfirmationEmail: mockGenericWaitlistEmail,
  railWaitlistEmail: mockRailWaitlistEmail,
}))

vi.mock('@/lib/notifications', () => ({
  sendSlackNotification: mockSendSlack,
  sendDiscordNotification: mockSendDiscord,
}))

const mockIsWebhookUrlSafe = vi.hoisted(() =>
  vi.fn().mockReturnValue(true),
)
const mockLoggerWarn = vi.hoisted(() => vi.fn())

vi.mock('@/lib/webhooks', () => ({
  isWebhookUrlSafe: mockIsWebhookUrlSafe,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mockLoggerWarn,
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { POST as waitlistPost } from '@/app/api/waitlist/route'

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3005/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/waitlist (rail-specific extension)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: 0,
    })
    // Re-establish the chain after clearAllMocks. Each chainable
    // mock returns the same `mockDb` so `.insert(...).values(...)
    // .onConflictDoNothing(...).returning(...)` resolves to the
    // configured `[{ id }]` array (= a new signup).
    for (const key of Object.keys(mockDb)) {
      ;(mockDb as Record<string, ReturnType<typeof vi.fn>>)[key].mockReturnValue(mockDb)
    }
    mockDb.returning.mockResolvedValue([{ id: 'new-id' }])
    delete process.env.WAITLIST_SLACK_WEBHOOK_URL
    delete process.env.WAITLIST_DISCORD_WEBHOOK_URL
    mockIsWebhookUrlSafe.mockReturnValue(true)
    mockLoggerWarn.mockClear()
  })

  it('persists country + entity-type into metadata when feature=stripe-connect-rail', async () => {
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
        preferredCurrency: 'INR',
        waitlistReason: 'country_not_supported_for_entity_type',
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        metadata: expect.objectContaining({
          countryIso: 'IN',
          entityType: 'individual',
          preferredCurrency: 'INR',
          waitlistReason: 'country_not_supported_for_entity_type',
          feature: 'stripe-connect-rail',
        }),
      }),
    )
  })

  it('uses railWaitlistEmail template for rail signups', async () => {
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    expect(mockRailWaitlistEmail).toHaveBeenCalledWith(
      'sandeep@example.com',
      'IN',
      'individual',
    )
    expect(mockGenericWaitlistEmail).not.toHaveBeenCalled()
  })

  it('falls back to generic waitlistConfirmationEmail when country/entity absent', async () => {
    await waitlistPost(
      makeReq({
        email: 'someone@example.com',
        feature: 'showcase',
      }),
    )
    expect(mockGenericWaitlistEmail).toHaveBeenCalledWith(
      'someone@example.com',
      'showcase',
    )
    expect(mockRailWaitlistEmail).not.toHaveBeenCalled()
  })

  it('preserves backward compatibility: pre-RAIL1 showcase payload still works', async () => {
    const res = await waitlistPost(
      makeReq({
        email: 'someone@example.com',
        feature: 'showcase',
      }),
    )
    expect(res.status).toBe(200)
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'someone@example.com',
        feature: 'showcase',
        metadata: null,
      }),
    )
  })

  it('does NOT post to Slack when WAITLIST_SLACK_WEBHOOK_URL is not set', async () => {
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    // Allow microtask flush for fire-and-forget
    await new Promise((r) => setImmediate(r))
    expect(mockSendSlack).not.toHaveBeenCalled()
  })

  it('posts to Slack with redacted email when WAITLIST_SLACK_WEBHOOK_URL is set', async () => {
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/abc'
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    await new Promise((r) => setImmediate(r))
    expect(mockSendSlack).toHaveBeenCalledTimes(1)
    const [, message] = mockSendSlack.mock.calls[0]
    expect(message).toContain('country=IN')
    expect(message).toContain('entity=individual')
    // Email redacted: only first char + domain
    expect(message).toContain('s***@example.com')
    expect(message).not.toContain('sandeep@example.com')
  })

  it('posts to Discord when WAITLIST_DISCORD_WEBHOOK_URL is set', async () => {
    process.env.WAITLIST_DISCORD_WEBHOOK_URL =
      'https://discord.com/api/webhooks/123/abc'
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    await new Promise((r) => setImmediate(r))
    expect(mockSendDiscord).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed countryIso (not 2 letters)', async () => {
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'USA',
        entityType: 'individual',
      }),
    )
    expect(res.status).toBe(422)
  })

  it('rejects unknown entityType (Zod enum)', async () => {
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'sole-proprietor',
      }),
    )
    expect(res.status).toBe(422)
  })

  it('rate-limits via authLimiter (5/min)', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: 0,
    })
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
      }),
    )
    expect(res.status).toBe(429)
  })

  it('returns 200 even when slack post fails (fire-and-forget)', async () => {
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/abc'
    mockSendSlack.mockRejectedValueOnce(new Error('slack down'))
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    expect(res.status).toBe(200)
  })

  it('Slack post for non-rail signup uses "—" fallback for missing country/entity', async () => {
    // Coverage for the `metadata?.countryIso ?? '—'` fallback in
    // fireDemandSignals — exercised when feature is non-rail (so
    // metadata is null) AND Slack webhook is configured.
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/abc'
    await waitlistPost(
      makeReq({
        email: 'someone@example.com',
        feature: 'showcase', // non-rail → metadata null
      }),
    )
    await new Promise((r) => setImmediate(r))
    expect(mockSendSlack).toHaveBeenCalledTimes(1)
    const [, message] = mockSendSlack.mock.calls[0]
    expect(message).toContain('country=—')
    expect(message).toContain('entity=—')
    expect(message).toContain('feature=showcase')
  })

  it('H1 fix: rate-limit key uses x-forwarded-for first hop only (XFF spoof guard)', async () => {
    const req = new NextRequest('http://localhost:3005/api/waitlist', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.7, 10.0.0.1, 172.16.0.1',
      },
      body: JSON.stringify({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    })
    await waitlistPost(req)
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      'waitlist:203.0.113.7',
    )
  })

  it('H3 fix: logs WARN when WAITLIST_DISCORD_WEBHOOK_URL is set but flagged unsafe', async () => {
    process.env.WAITLIST_DISCORD_WEBHOOK_URL = 'http://localhost:11211/x'
    mockIsWebhookUrlSafe.mockReturnValue(false)
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    await new Promise((r) => setImmediate(r))
    expect(mockSendDiscord).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'waitlist.discord_webhook_rejected',
      expect.objectContaining({ reason: expect.any(String) }),
    )
  })

  it('H3 fix: logs WARN when WAITLIST_SLACK_WEBHOOK_URL is set but flagged unsafe', async () => {
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'http://localhost:11211/x'
    mockIsWebhookUrlSafe.mockReturnValue(false)
    await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    await new Promise((r) => setImmediate(r))
    // Slack post must NOT fire (SSRF guard) BUT a warning must log
    // so the operator sees the rejection.
    expect(mockSendSlack).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'waitlist.slack_webhook_rejected',
      expect.objectContaining({ reason: expect.any(String) }),
    )
  })

  it('H2 fix: duplicate signup does NOT re-fire email or Slack post (returning empty array)', async () => {
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/abc'
    // Simulate the .returning() branch where ON CONFLICT DO NOTHING
    // suppressed the insert — empty array means "already on waitlist".
    mockDb.returning.mockResolvedValueOnce([])
    const res = await waitlistPost(
      makeReq({
        email: 'sandeep@example.com',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    await new Promise((r) => setImmediate(r))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyOnWaitlist).toBe(true)
    expect(body.success).toBe(true)
    // Email + Slack must NOT have fired (spam vector).
    expect(mockRailWaitlistEmail).not.toHaveBeenCalled()
    expect(mockGenericWaitlistEmail).not.toHaveBeenCalled()
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockSendSlack).not.toHaveBeenCalled()
  })

  it('redactEmail handles malformed email gracefully (no domain split)', async () => {
    process.env.WAITLIST_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/T0/B0/abc'
    // Zod's email validator should reject 'no-at-sign' at parseBody;
    // verify we get 422 not a crash inside redactEmail.
    const res = await waitlistPost(
      makeReq({
        email: 'no-at-sign',
        feature: 'stripe-connect-rail',
        countryIso: 'IN',
        entityType: 'individual',
      }),
    )
    expect(res.status).toBe(422)
  })
})
