/**
 * V-N3-erasure — daily payer-anonymize cron handler. Cron-secret auth gating +
 * DARK-flag pin (flag OFF ⇒ zero DB access through the route) + delegation to
 * runPayerAnonymization. The transform/predicate themselves are covered by
 * anonymize-payer.test.ts. Uses the REAL verifyCronAuth + env getters (CRON_SECRET
 * + the flag via process.env) and a mocked db, so the dark gate is proven
 * end-to-end through the route.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockDb, mockCheckRateLimit, plan } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), update: vi.fn() },
  mockCheckRateLimit: vi.fn(),
  plan: { selectRows: [] as unknown[] },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
}))

import { GET } from '../route'

function selectChain(rows: unknown[]) {
  const c: Record<string, unknown> = {}
  c.from = () => c
  c.where = () => c
  c.orderBy = () => c
  c.limit = () => c
  ;(c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(rows).then(res, rej)
  return c
}
function req(auth?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (auth) headers['authorization'] = auth
  return new NextRequest('http://localhost/api/cron/payer-anonymize', { headers })
}

const savedSecret = process.env.CRON_SECRET
const savedFlag = process.env.LEDGER_PAYER_ANONYMIZE_ENABLED
beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'
  delete process.env.LEDGER_PAYER_ANONYMIZE_ENABLED // DARK by default
  delete process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS
  plan.selectRows = []
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  mockDb.select.mockImplementation(() => selectChain(plan.selectRows))
})
afterEach(() => {
  if (savedSecret === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = savedSecret
  if (savedFlag === undefined) delete process.env.LEDGER_PAYER_ANONYMIZE_ENABLED
  else process.env.LEDGER_PAYER_ANONYMIZE_ENABLED = savedFlag
})

describe('payer-anonymize cron', () => {
  it('429 when rate-limited (and never reads the table)', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1000, remaining: 0, reset: 0 })
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(429)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('401 without the cron-secret bearer (and never reads the table)', async () => {
    const res = await GET(req())
    expect(res.status).toBe(401)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('500 when CRON_SECRET is unset (fail-closed; never reads the table)', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req('Bearer anything'))
    expect(res.status).toBe(500)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('DARK: authorized but flag OFF ⇒ 200 no-op { anonymized:0, enabled:false } and ZERO DB access', async () => {
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(false)
    expect(body.anonymized).toBe(0)
    expect(mockDb.select).not.toHaveBeenCalled()
    expect(mockDb.update).not.toHaveBeenCalled()
  })

  it('flag ON + empty table ⇒ 200 enabled:true, anonymized:0, and the table WAS scanned', async () => {
    process.env.LEDGER_PAYER_ANONYMIZE_ENABLED = 'true'
    plan.selectRows = []
    const res = await GET(req('Bearer test-secret'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enabled).toBe(true)
    expect(body.anonymized).toBe(0)
    expect(mockDb.select).toHaveBeenCalled()
  })
})
