/**
 * P5.PAYOUTS-CLEANUP-4 — Connect-mode webhook for `payout.failed`.
 *
 * Path-2 separate endpoint at /api/billing/webhook/connect with its own
 * STRIPE_CONNECT_WEBHOOK_SECRET. Subscribed to connected-account
 * `payout.failed` events: when a developer's bank rejects the deposit
 * Stripe sent, flip developers.stripe_connect_status to
 * 'needs_reconnect' so the cron stops trying and the dashboard surfaces
 * a reconnect CTA.
 *
 * Coverage:
 *   - missing secret env var → 503 NOT_CONFIGURED
 *   - missing stripe-signature header → 400 MISSING_SIGNATURE
 *   - bad signature (constructEvent throws) → 400 INVALID_SIGNATURE
 *   - duplicate event ID → 200 + duplicate flag (idempotency gate)
 *   - payout.failed with no event.account → 200 + log + no DB change
 *   - payout.failed with unknown account → 200 + log + no DB change
 *   - payout.failed with already-flagged developer → 200 + idempotent log
 *   - payout.failed happy path → status flipped, error log emitted
 *   - handler throws after dedup commit → eventId deleted from
 *     processedWebhookEvents so Stripe's retry replays
 *   - unhandled event type → 200 + log
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockGetStripeConnectWebhookSecret,
  mockGetStripeClient,
  mockConstructEvent,
} = vi.hoisted(() => {
  const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    for: vi.fn().mockReturnThis(),
  }
  mockDb.transaction = vi.fn().mockImplementation(async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
    fn(mockDb),
  )

  const mockConstructEvent = vi.fn()

  return {
    mockDb,
    mockGetStripeConnectWebhookSecret: vi.fn().mockReturnValue('whsec_connect_test_secret'),
    mockGetStripeClient: vi.fn().mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    }),
    mockConstructEvent,
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    stripeConnectId: 'stripe_connect_id',
    stripeConnectStatus: 'stripe_connect_status',
    updatedAt: 'updated_at',
  },
  processedWebhookEvents: {
    eventId: 'event_id',
    source: 'source',
    eventType: 'event_type',
  },
}))
vi.mock('@/lib/env', () => ({
  getStripeConnectWebhookSecret: mockGetStripeConnectWebhookSecret,
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/rails', () => ({ getStripeClient: mockGetStripeClient }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
}))

import { POST as connectWebhookPOST } from '@/app/api/billing/webhook/connect/route'

function makeRequest(rawBody: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/billing/webhook/connect', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=test', ...headers },
    body: rawBody,
  })
}

interface FakeStripeEvent {
  id: string
  type: string
  account?: string
  data: { object: Record<string, unknown> }
}

function mockEvent(ev: FakeStripeEvent) {
  mockConstructEvent.mockReturnValueOnce(ev)
}

describe('Connect-mode webhook — /api/billing/webhook/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([])
    mockDb.insert.mockReturnThis()
    mockDb.values.mockReturnThis()
    mockDb.onConflictDoNothing.mockReturnThis()
    mockDb.returning.mockResolvedValue([{ eventId: 'evt_default' }]) // not duplicate
    mockDb.update.mockReturnThis()
    mockDb.set.mockReturnThis()
    mockDb.delete.mockReturnThis()
    mockDb.for.mockReturnThis()
    mockDb.transaction.mockImplementation(
      async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb),
    )
    mockGetStripeConnectWebhookSecret.mockReturnValue('whsec_connect_test_secret')
    mockGetStripeClient.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    })
  })

  describe('configuration + signature', () => {
    it('503 when STRIPE_CONNECT_WEBHOOK_SECRET is not set', async () => {
      mockGetStripeConnectWebhookSecret.mockReturnValueOnce(undefined)
      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.code).toBe('NOT_CONFIGURED')
    })

    it('400 when stripe-signature header is missing', async () => {
      const req = new NextRequest('http://localhost/api/billing/webhook/connect', {
        method: 'POST',
        body: '{}',
      })
      const res = await connectWebhookPOST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.code).toBe('MISSING_SIGNATURE')
    })

    it('400 when constructEvent throws (bad signature)', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature')
      })
      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.code).toBe('INVALID_SIGNATURE')
    })
  })

  describe('idempotency', () => {
    it('200 + duplicate flag on replay (insert returns no rows)', async () => {
      mockEvent({
        id: 'evt_dup',
        type: 'payout.failed',
        account: 'acct_x',
        data: { object: { id: 'po_1' } },
      })
      mockDb.returning.mockResolvedValueOnce([]) // duplicate

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.duplicate).toBe(true)
    })

    it('503 when idempotency ledger insert throws', async () => {
      mockEvent({
        id: 'evt_idem_fail',
        type: 'payout.failed',
        account: 'acct_x',
        data: { object: { id: 'po_1' } },
      })
      mockDb.returning.mockRejectedValueOnce(new Error('connection refused'))

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.code).toBe('IDEMPOTENCY_UNAVAILABLE')
    })
  })

  describe('payout.failed handling', () => {
    it('no event.account → 200 + log + no DB mutation', async () => {
      mockEvent({
        id: 'evt_no_acct',
        type: 'payout.failed',
        // account omitted — atypical but defensive
        data: { object: { id: 'po_no_acct' } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_no_acct' }])

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // No transaction was opened (handler bailed early on missing account).
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it('unknown account (no developer match) → 200 + log + no UPDATE', async () => {
      mockEvent({
        id: 'evt_unknown_acct',
        type: 'payout.failed',
        account: 'acct_orphan',
        data: { object: { id: 'po_orphan' } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_unknown_acct' }])
      mockDb.limit.mockResolvedValueOnce([]) // no developer found

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Transaction opened to do the lookup, but no UPDATE on developers.
      expect(mockDb.update).not.toHaveBeenCalled()
    })

    it("developer already 'needs_reconnect' → 200 + idempotent log + no UPDATE", async () => {
      mockEvent({
        id: 'evt_already_flagged',
        type: 'payout.failed',
        account: 'acct_x',
        data: { object: { id: 'po_x' } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_already_flagged' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'dev-1',
          email: 'dev@example.com',
          stripeConnectStatus: 'needs_reconnect',
        },
      ])

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockDb.update).not.toHaveBeenCalled()
    })

    it("'active' developer + payout.failed → flips to 'needs_reconnect'", async () => {
      mockEvent({
        id: 'evt_happy',
        type: 'payout.failed',
        account: 'acct_dev1',
        data: {
          object: {
            id: 'po_failed',
            failure_code: 'account_closed',
            failure_message: 'The bank account has been closed',
            amount: 5000,
            currency: 'usd',
          },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_happy' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'dev-1',
          email: 'dev@example.com',
          stripeConnectStatus: 'active',
        },
      ])

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockDb.update).toHaveBeenCalledTimes(1)
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeConnectStatus: 'needs_reconnect',
        }),
      )
    })

    it('handler throws after dedup commit → eventId deleted (Stripe retry replays)', async () => {
      mockEvent({
        id: 'evt_handler_crash',
        type: 'payout.failed',
        account: 'acct_dev1',
        data: { object: { id: 'po_crash' } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_handler_crash' }])
      // Force the transaction to throw — simulates a DB error after the
      // dedup row was committed.
      mockDb.transaction.mockImplementationOnce(async () => {
        throw new Error('connection lost')
      })

      const res = await connectWebhookPOST(makeRequest('{}'))
      // Top-level catch returns 500 (internalErrorResponse).
      expect(res.status).toBe(500)
      // CRITICAL: dedup row was deleted so Stripe's retry can replay.
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('unhandled events', () => {
    it('200 + log on unsubscribed event type (forward-compat with adding events later)', async () => {
      mockEvent({
        id: 'evt_unhandled',
        type: 'account.updated',
        account: 'acct_x',
        data: { object: { id: 'acct_x' } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_unhandled' }])

      const res = await connectWebhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      expect(mockDb.update).not.toHaveBeenCalled()
    })
  })
})
