/**
 * G3-5 — retry-safety for checkout.session.completed consumer-credit writes.
 *
 * The bug: the global event-id idempotency marker is committed BEFORE the
 * switch runs (route.ts:~114). If a consumer-credit write then throws, the
 * outer catch returns 500 → Stripe retries, but the marker is already
 * committed → the retry hits the dedup gate → 200 duplicate → the credit is
 * skipped FOREVER (consumer paid, balance never incremented).
 *
 * The fix (mirroring transfer.*): wrap each checkout write-path in a
 * db.transaction and, on failure, DELETE the processedWebhookEvents marker +
 * re-throw so Stripe's 500-triggered retry re-runs and actually credits.
 *
 * DC-24 teeth (per the plan audit, §5.5 FOLD 4): in this isolated-mock
 * harness `insert.returning` and `delete` are independent vi.fn()s with NO
 * shared state and `transaction` is a pass-through (no real rollback). So the
 * real teeth are the delete-call assertions — failure ⇒ delete + 500;
 * success ⇒ NO delete + the credit write ran exactly once. We do NOT rely on
 * two-drive causality and do NOT claim this proves transactional rollback
 * (that is a §S integration item).
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
  purchases: { id: 'id', stripePaymentIntentId: 'stripe_payment_intent_id' },
  consumerToolBalances: {
    id: 'id',
    consumerId: 'consumer_id',
    toolId: 'tool_id',
    balanceCents: 'balance_cents',
  },
  consumers: { id: 'id', email: 'email', globalBalanceCents: 'global_balance_cents' },
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
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
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

// A completed credit-PURCHASE checkout session (per-tool balance credit path).
function creditPurchaseEvent(id: string): FakeStripeEvent {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_purchase',
        mode: 'payment',
        payment_intent: 'pi_123',
        metadata: {
          purchaseId: 'pur-1',
          consumerId: 'con-1',
          toolId: 'tool-1',
          amountCents: '5000',
        },
      },
    },
  }
}

// A completed credit-PACK checkout session (global balance credit path).
// pack_100 → priceCents 9500 / creditCents 10000.
function creditPackEvent(id: string): FakeStripeEvent {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_pack',
        mode: 'payment',
        amount_total: 9500,
        metadata: {
          type: 'credit_pack',
          consumerId: 'con-1',
          packId: 'pack_100',
          creditAmountCents: '10000',
        },
      },
    },
  }
}

// Count how many .set() calls carried the given credit column — the actual
// consumer-credit write (distinct from the purchases-status .set()).
function creditWriteCount(column: 'balanceCents' | 'globalBalanceCents'): number {
  return mockDb.set.mock.calls.filter(
    ([arg]) => arg && typeof arg === 'object' && column in (arg as Record<string, unknown>),
  ).length
}

describe('Stripe webhook — checkout.session.completed retry-safety (G3-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.select.mockReturnThis()
    mockDb.from.mockReturnThis()
    mockDb.where.mockReturnThis()
    mockDb.limit.mockResolvedValue([]) // fire-and-forget lookups resolve empty → no email
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

  describe('credit-purchase path (consumerToolBalances)', () => {
    it('credit write throws → dedup marker DELETED + 500 (Stripe retry re-credits)', async () => {
      mockEvent(creditPurchaseEvent('evt_cpur_fail'))
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpur_fail' }]) // not duplicate
      // The credit tx rejects (transient DB failure during the credit).
      mockDb.transaction.mockRejectedValueOnce(new Error('DB blip'))

      const res = await webhookPOST(makeRequest('{}'))

      // Outer route catches the re-thrown error → retryable 500.
      expect(res.status).toBe(500)
      // THE TEETH: the dedup marker was deleted so Stripe's retry replays.
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('success → NO dedup delete + the balance credit ran exactly once', async () => {
      mockEvent(creditPurchaseEvent('evt_cpur_ok'))
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpur_ok' }]) // not duplicate
      // existingBalance SELECT (inside the tx) → a row exists → increment path.
      mockDb.limit.mockResolvedValueOnce([{ id: 'ctb-1' }])

      const res = await webhookPOST(makeRequest('{}'))

      expect(res.status).toBe(200)
      // On success the marker must stay so a later same-id event dedups.
      expect(mockDb.delete).not.toHaveBeenCalled()
      // The consumer-credit write ran exactly once (not the purchases .set()).
      expect(creditWriteCount('balanceCents')).toBe(1)
    })
  })

  describe('credit-pack path (consumers.globalBalanceCents)', () => {
    it('credit write throws → dedup marker DELETED + 500 (Stripe retry re-credits)', async () => {
      mockEvent(creditPackEvent('evt_cpack_fail'))
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpack_fail' }]) // not duplicate
      mockDb.transaction.mockRejectedValueOnce(new Error('DB blip'))

      const res = await webhookPOST(makeRequest('{}'))

      expect(res.status).toBe(500)
      expect(mockDb.delete).toHaveBeenCalled()
    })

    it('success → NO dedup delete + the global-balance credit ran exactly once', async () => {
      mockEvent(creditPackEvent('evt_cpack_ok'))
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpack_ok' }]) // not duplicate

      const res = await webhookPOST(makeRequest('{}'))

      expect(res.status).toBe(200)
      expect(mockDb.delete).not.toHaveBeenCalled()
      expect(creditWriteCount('globalBalanceCents')).toBe(1)
    })
  })

  describe('non-retryable ACK guards must NOT delete the marker', () => {
    it('credit-pack amount mismatch → 200 + no credit + no dedup delete', async () => {
      // amount_total (9000) ≠ pack_100 priceCents (9500) → manipulation guard.
      mockEvent({
        id: 'evt_cpack_mismatch',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_bad',
            mode: 'payment',
            amount_total: 9000,
            metadata: {
              type: 'credit_pack',
              consumerId: 'con-1',
              packId: 'pack_100',
              creditAmountCents: '10000',
            },
          },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpack_mismatch' }])

      const res = await webhookPOST(makeRequest('{}'))

      expect(res.status).toBe(200)
      // No credit and no marker delete — this is a deliberate non-retryable ACK.
      expect(creditWriteCount('globalBalanceCents')).toBe(0)
      expect(mockDb.delete).not.toHaveBeenCalled()
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it('credit-purchase missing metadata → 200 + no credit + no dedup delete', async () => {
      mockEvent({
        id: 'evt_cpur_nometa',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_nometa',
            mode: 'payment',
            metadata: {}, // no purchaseId/consumerId/toolId/amountCents
          },
        },
      })
      mockDb.returning.mockResolvedValueOnce([{ eventId: 'evt_cpur_nometa' }])

      const res = await webhookPOST(makeRequest('{}'))

      expect(res.status).toBe(200)
      expect(mockDb.delete).not.toHaveBeenCalled()
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })
})
