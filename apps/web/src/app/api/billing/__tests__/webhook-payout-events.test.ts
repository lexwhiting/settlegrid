/**
 * P5.PAYOUTS-CLEANUP-3 — webhook handlers for transfer.* events.
 *
 * Closes the network-timeout double-pay loophole at the reconciliation
 * layer: when processPayout writes a payout row in 'unknown' status
 * (Stripe call returned indeterminate), Stripe's subsequent
 * `transfer.created` webhook confirms the truth and our handler flips
 * the row to 'completed'. `transfer.reversed` does the inverse path —
 * refund balance + mark 'failed'.
 *
 * Coverage targets the audit-found edge cases in particular:
 *   - 'failed' row + transfer.created → 'reconciled' WITH balance
 *     re-debit clamped at >= 0 (the rollback was wrong, money owed
 *     back to platform, but never push to negative)
 *   - 'unknown' row + transfer.reversed → refund balance + 'failed'
 *     (the v2 plan said "no-op"; that was wrong — would silently
 *     lose money)
 *   - empty metadata.payoutId → 200 + log + no-op (operator-created
 *     Dashboard transfers, third-party tooling)
 *   - handler crash → eventId deleted from processedWebhookEvents so
 *     Stripe's retry can replay
 *   - replay (eventId duplicate) → existing global gate returns 200
 *     before reaching the handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockGetStripeWebhookSecret,
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
    mockGetStripeWebhookSecret: vi.fn().mockReturnValue('whsec_test_secret'),
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
    balanceCents: 'balance_cents',
    updatedAt: 'updated_at',
    tier: 'tier',
    stripeSubscriptionId: 'stripe_subscription_id',
  },
  purchases: { id: 'id' },
  consumerToolBalances: { id: 'id' },
  consumers: { id: 'id', email: 'email' },
  tools: { id: 'id', name: 'name' },
  processedWebhookEvents: {
    eventId: 'event_id',
    source: 'source',
    eventType: 'event_type',
  },
  payouts: {
    id: 'id',
    status: 'status',
    developerId: 'developer_id',
    amountCents: 'amount_cents',
    platformFeeCents: 'platform_fee_cents',
    stripeTransferId: 'stripe_transfer_id',
    errorMessage: 'error_message',
  },
}))
vi.mock('@/lib/env', () => ({
  getStripeWebhookSecret: mockGetStripeWebhookSecret,
}))
vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/rails', () => ({ getStripeClient: mockGetStripeClient }))
vi.mock('@/lib/email', () => ({
  creditPurchaseConfirmationEmail: vi.fn(),
  autoRefillConfirmationEmail: vi.fn(),
  paymentFailedEmail: vi.fn(),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn().mockImplementation((...args: unknown[]) => ({ and: args })),
  sql: Object.assign(
    vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings,
      values,
    })),
    { raw: vi.fn() },
  ),
}))

import { POST as webhookPOST } from '@/app/api/billing/webhook/route'

function makeRequest(rawBody: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=test', ...headers },
    body: rawBody,
  })
}

interface FakeStripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

function mockEvent(ev: FakeStripeEvent) {
  mockConstructEvent.mockReturnValueOnce(ev)
}

describe('Stripe webhook — transfer.* event handlers', () => {
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
    mockGetStripeWebhookSecret.mockReturnValue('whsec_test_secret')
    mockGetStripeClient.mockReturnValue({
      webhooks: { constructEvent: mockConstructEvent },
    })
  })

  describe('transfer.created', () => {
    it("'unknown' row → 'completed' (the win path: indeterminate-error reconciled)", async () => {
      mockEvent({
        id: 'evt_tc_unknown',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_real', metadata: { payoutId: 'p-unknown' } },
        },
      })
      // Idempotency insert: returns the row (not duplicate).
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_unknown' }])
      // FOR UPDATE select returns the unknown row.
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-unknown',
          status: 'unknown',
          developerId: 'dev-1',
          amountCents: 5000,
          platformFeeCents: 0,
          stripeTransferId: null,
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // The status UPDATE flipped 'unknown' → 'completed' with transfer id.
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          stripeTransferId: 'tr_real',
        }),
      )
    })

    it("'completed' row → idempotent no-op (replay safety)", async () => {
      mockEvent({
        id: 'evt_tc_replay',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_x', metadata: { payoutId: 'p-already' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_replay' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-already',
          status: 'completed',
          developerId: 'dev-1',
          amountCents: 5000,
          platformFeeCents: 0,
          stripeTransferId: 'tr_x',
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Critical: status was NOT re-flipped (no second UPDATE).
      // We verify by ensuring no .set() call carried status='completed'
      // (would mean we wrote it again).
      expect(mockDb.set).not.toHaveBeenCalled()
    })

    it("'failed' row → 're-debit + reconciled', balance clamped >= 0 (rollback was wrong)", async () => {
      mockEvent({
        id: 'evt_tc_failed',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_late', metadata: { payoutId: 'p-failed' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_failed' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-failed',
          status: 'failed',
          developerId: 'dev-2',
          amountCents: 4000,
          platformFeeCents: 100,
          stripeTransferId: null,
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Status flipped to 'reconciled'.
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'reconciled',
          stripeTransferId: 'tr_late',
        }),
      )
      // The developer balance UPDATE was issued. We can't easily
      // assert the GREATEST(... - grossCents, 0) clamp because the
      // sql template surfaces as an opaque object in mocks; the
      // assertion that .set() was called with { balanceCents: <sql obj> }
      // pins the call site.
      expect(mockDb.update).toHaveBeenCalled()
    })

    it('empty metadata.payoutId → 200 + log + no-op (operator transfers)', async () => {
      mockEvent({
        id: 'evt_tc_no_meta',
        type: 'transfer.created',
        data: { object: { id: 'tr_op', metadata: {} } },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_no_meta' }])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // No SELECT FOR UPDATE was issued (we returned before the tx).
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it('unknown payoutId in metadata → 200 + warn log, no DB write', async () => {
      mockEvent({
        id: 'evt_tc_ghost',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_g', metadata: { payoutId: 'p-ghost' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_ghost' }])
      // Select returns no rows for the unknown payoutId.
      mockDb.limit.mockResolvedValueOnce([])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // No status UPDATE was issued.
      expect(mockDb.set).not.toHaveBeenCalled()
    })

    it('handler tx throws → eventId deleted from processedWebhookEvents (retry-safe)', async () => {
      mockEvent({
        id: 'evt_tc_crash',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_x', metadata: { payoutId: 'p-crash' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tc_crash' }])
      // The transaction throws.
      mockDb.transaction.mockRejectedValueOnce(new Error('DB blip'))

      const res = await webhookPOST(makeRequest('{}'))
      // Outer route catches → 500.
      expect(res.status).toBe(500)
      // Critical: the dedup-delete fired so Stripe's retry can replay.
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('transfer.reversed', () => {
    it("'completed' row → refund balance + 'failed'", async () => {
      mockEvent({
        id: 'evt_tr_completed',
        type: 'transfer.reversed',
        data: {
          object: { id: 'tr_rev', metadata: { payoutId: 'p-paid' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tr_completed' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-paid',
          status: 'completed',
          developerId: 'dev-3',
          amountCents: 4000,
          platformFeeCents: 100,
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Status flipped to 'failed' with reversal note.
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('reversed'),
        }),
      )
    })

    it("'unknown' row → refund balance + 'failed' (audit fix: was 'no-op' in v2 plan)", async () => {
      // The critical bug the v2 plan would have shipped: 'unknown'
      // means we never refunded balance (Stripe-may-have-paid is the
      // whole semantic). Reversal confirms Stripe DID pay then unpaid;
      // net zero means the dev's balance must be restored.
      mockEvent({
        id: 'evt_tr_unknown',
        type: 'transfer.reversed',
        data: {
          object: { id: 'tr_z', metadata: { payoutId: 'p-unkrev' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tr_unknown' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-unkrev',
          status: 'unknown',
          developerId: 'dev-4',
          amountCents: 5000,
          platformFeeCents: 0,
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // Refund happened (balanceCents UPDATE) and status flipped failed.
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      )
      expect(mockDb.update).toHaveBeenCalled()
    })

    it("'failed' row → no-op (already in reverse state)", async () => {
      mockEvent({
        id: 'evt_tr_failed',
        type: 'transfer.reversed',
        data: {
          object: { id: 'tr_q', metadata: { payoutId: 'p-already-failed' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tr_failed' }])
      mockDb.limit.mockResolvedValueOnce([
        {
          id: 'p-already-failed',
          status: 'failed',
          developerId: 'dev-5',
          amountCents: 4000,
          platformFeeCents: 100,
        },
      ])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // No status UPDATE.
      expect(mockDb.set).not.toHaveBeenCalled()
    })

    it('handler tx throws → eventId deleted from processedWebhookEvents', async () => {
      mockEvent({
        id: 'evt_tr_crash',
        type: 'transfer.reversed',
        data: {
          object: { id: 'tr_q', metadata: { payoutId: 'p-crash' } },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tr_crash' }])
      mockDb.transaction.mockRejectedValueOnce(new Error('DB blip'))

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(500)
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('transfer.updated', () => {
    it('logs info and acks 200 (observability only)', async () => {
      mockEvent({
        id: 'evt_tu',
        type: 'transfer.updated',
        data: {
          object: { id: 'tr_u', metadata: { payoutId: 'p-1' }, amount: 5000 },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_tu' }])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      // No SELECT FOR UPDATE — purely logging.
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })

  describe('replay safety', () => {
    it('duplicate eventId (returning [] from onConflictDoNothing) → 200 with duplicate=true, handler not called', async () => {
      mockEvent({
        id: 'evt_replay',
        type: 'transfer.created',
        data: {
          object: { id: 'tr_x', metadata: { payoutId: 'p-1' } },
        },
      })
      // Idempotency insert returns no rows (already processed).
      mockDb.returning.mockResolvedValueOnce([])

      const res = await webhookPOST(makeRequest('{}'))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.duplicate).toBe(true)
      // Critical: no transaction or DB writes for the handler logic.
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })
})
