/**
 * G3-2 regression — consumer/referral/apply $25×2 credit.
 *
 * Pins the check-then-act TOCTOU closed: crediting happens inside one
 * db.transaction, the referee update is null-gated (WHERE referred_by IS NULL)
 * and rowCount-checked, and the referrer is credited ONLY after a 1-row referee
 * update (and is itself rowCount-gated → credit-both-or-neither). A concurrent
 * second apply matches 0 rows and credits NO ONE.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockTx, mockCheckRateLimit, mockRequireConsumer, mockLogger } = vi.hoisted(() => {
  const mockTx = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  }
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
  }
  return {
    mockDb,
    mockTx,
    mockCheckRateLimit: vi.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }),
    mockRequireConsumer: vi.fn().mockResolvedValue({ id: 'referee-1', email: 'referee@example.com' }),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/db/schema', () => ({
  consumers: {
    id: 'id',
    referralCode: 'referral_code',
    referredByConsumerId: 'referred_by_consumer_id',
    globalBalanceCents: 'global_balance_cents',
  },
}))

vi.mock('@/lib/middleware/auth', () => ({ requireConsumer: mockRequireConsumer }))

vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
  getClientIp: () => '203.0.113.9',
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((c: unknown) => ({ isNull: c })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings, values })),
    { raw: vi.fn() }
  ),
}))

import { POST } from '@/app/api/consumer/referral/apply/route'
import { isNull } from 'drizzle-orm'

function makeRequest(referralCode = 'ref_abcdef123456') {
  return new NextRequest('http://localhost/api/consumer/referral/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ referralCode }),
  })
}

/** Fast-path SELECTs: currentConsumer (not-yet-referred), then referrer. */
function selectsSee(current: unknown[], referrer: unknown[]) {
  mockDb.limit.mockResolvedValueOnce(current).mockResolvedValueOnce(referrer)
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks resets call history but NOT the mockResolvedValueOnce queue.
  // Reset the two sequence-sensitive mocks so an unconsumed value from a
  // short-circuiting test (e.g. the fast-path already-referred case never
  // reads the referrer SELECT) can't leak into the next test.
  mockDb.limit.mockReset()
  mockTx.returning.mockReset()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 })
  mockRequireConsumer.mockResolvedValue({ id: 'referee-1', email: 'referee@example.com' })
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx))
  mockTx.update.mockReturnThis()
  mockTx.set.mockReturnThis()
  mockTx.where.mockReturnThis()
})

describe('POST /api/consumer/referral/apply — G3-2', () => {
  it('credits referee AND referrer once on a first successful apply', async () => {
    selectsSee(
      [{ id: 'referee-1', referredByConsumerId: null }],
      [{ id: 'referrer-1', referralCode: 'ref_abcdef123456' }]
    )
    // referee update hits 1 row, then referrer update hits 1 row.
    mockTx.returning.mockResolvedValueOnce([{ id: 'referee-1' }]).mockResolvedValueOnce([{ id: 'referrer-1' }])

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.creditedCents).toBe(2500)
    // Both credits happened, inside exactly one transaction.
    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.update).toHaveBeenCalledTimes(2)
    // The referee update is null-gated (the real TOCTOU guard).
    expect(isNull).toHaveBeenCalledWith('referred_by_consumer_id')
  })

  it('TOCTOU teeth: a concurrent second apply matches 0 rows → credits NO ONE', async () => {
    // Fast-path SELECT still sees null (read before the other txn committed),
    // but the null-gated UPDATE matches 0 rows — the other apply won.
    selectsSee(
      [{ id: 'referee-1', referredByConsumerId: null }],
      [{ id: 'referrer-1', referralCode: 'ref_abcdef123456' }]
    )
    mockTx.returning.mockResolvedValueOnce([]) // referee update: 0 rows

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.alreadyReferred).toBe(true)
    expect(json.creditedCents).toBeUndefined()
    // Referee update attempted once and lost; referrer NEVER credited.
    expect(mockTx.update).toHaveBeenCalledTimes(1)
  })

  it('short-circuits an already-referred referee at the fast path (no txn)', async () => {
    selectsSee([{ id: 'referee-1', referredByConsumerId: 'referrer-9' }], [])
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.alreadyReferred).toBe(true)
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('rejects self-referral (400, no txn)', async () => {
    selectsSee(
      [{ id: 'referee-1', referredByConsumerId: null }],
      [{ id: 'referee-1', referralCode: 'ref_abcdef123456' }] // referrer === caller
    )
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('SELF_REFERRAL')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('rejects an invalid referral code (400, no txn)', async () => {
    selectsSee([{ id: 'referee-1', referredByConsumerId: null }], []) // referrer not found
    const res = await POST(makeRequest())
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('INVALID_REFERRAL_CODE')
    expect(mockDb.transaction).not.toHaveBeenCalled()
  })

  it('rolls back (500) if the referrer row vanishes inside the txn — credit-both-or-neither', async () => {
    selectsSee(
      [{ id: 'referee-1', referredByConsumerId: null }],
      [{ id: 'referrer-1', referralCode: 'ref_abcdef123456' }]
    )
    // referee update hits 1 row, but the referrer update hits 0 rows (deleted).
    mockTx.returning.mockResolvedValueOnce([{ id: 'referee-1' }]).mockResolvedValueOnce([])

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
    // The referrer rowCount gate threw → the whole txn aborts (referee not credited).
    expect(mockTx.update).toHaveBeenCalledTimes(2)
  })
})
