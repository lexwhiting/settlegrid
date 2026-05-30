/**
 * P5 — integration tests for the AP2 facilitator routes
 * (/api/ap2/verify, /api/ap2/settle).
 *
 * These routes are the kernel→facilitator destination for AP2 in the
 * self-hosted SDK model. Tests mock the DB (tool lookup), env enablement,
 * rate limiter, and the credential validator so the focus is the ROUTE
 * contract: envelope parsing, server-authoritative tool/cost lookup, and
 * the raw `{ valid }` / SettlementResult shapes the kernel expects. The
 * VDC crypto itself is covered in packages/mcp ap2-adapter.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const {
  mockDb,
  mockCheckRateLimit,
  mockIsAp2Enabled,
  mockValidate,
  mockRecordSettlement,
} = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  },
  mockCheckRateLimit: vi.fn(),
  mockIsAp2Enabled: vi.fn(),
  mockValidate: vi.fn(),
  mockRecordSettlement: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: {
    name: 'name',
    slug: 'slug',
    status: 'status',
    pricingConfig: 'pricing_config',
    developerId: 'developer_id',
  },
}))
vi.mock('@/lib/rate-limit', () => ({
  apiLimiter: {},
  checkRateLimit: mockCheckRateLimit,
}))
vi.mock('@/lib/env', () => ({ isAp2Enabled: mockIsAp2Enabled }))
vi.mock('@/lib/ap2-proxy', () => ({
  validateAp2CredentialString: mockValidate,
}))
vi.mock('@/lib/settlement/ledger', () => ({
  recordSettlementEntryAsync: mockRecordSettlement,
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}))

import { POST as verifyPOST } from '@/app/api/ap2/verify/route'
import { POST as settlePOST } from '@/app/api/ap2/settle/route'

const ACTIVE_TOOL = {
  name: 'Demo Tool',
  slug: 'demo',
  status: 'active',
  pricingConfig: { defaultCostCents: 50 },
  developerId: 'dev-uuid-1',
}

/** Configure the mocked drizzle chain to resolve a given tool row (or none). */
function setTool(row: unknown | null) {
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue(row === null ? [] : [row])
}

function makeReq(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const VERIFY_ENVELOPE = {
  toolSlug: 'demo',
  method: 'demo.invocation',
  paymentContext: {
    protocol: 'ap2',
    payment: { type: 'vdc', proof: 'vdc.header.sig' },
  },
}

const SETTLE_ENVELOPE = {
  ...VERIFY_ENVELOPE,
  handlerResult: { ok: true },
  latencyMs: 42,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({
    success: true,
    limit: 1000,
    remaining: 999,
    reset: 0,
  })
  mockIsAp2Enabled.mockReturnValue(true)
  setTool(ACTIVE_TOOL)
})

describe('POST /api/ap2/verify', () => {
  it('returns raw { valid: true } for a valid VDC', async () => {
    mockValidate.mockResolvedValue({
      valid: true,
      consumerId: 'c-1',
      transactionId: 'tx-1',
    })
    const res = await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(true)
  })

  it('resolves cost server-side and passes the VDC + tool config to the validator', async () => {
    mockValidate.mockResolvedValue({ valid: true })
    await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    expect(mockValidate).toHaveBeenCalledWith(
      'vdc.header.sig',
      expect.objectContaining({ slug: 'demo', costCents: 50 }),
    )
  })

  it('returns { valid: false } + the validator error code on rejection (HTTP 200)', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'AP2_CREDENTIAL_INVALID', message: 'bad sig' },
    })
    const res = await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    // 200 (not a non-2xx) so the kernel reads `valid`, not a 503.
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('AP2_CREDENTIAL_INVALID')
  })

  it('short-circuits with AP2_NOT_CONFIGURED when AP2 is disabled', async () => {
    mockIsAp2Enabled.mockReturnValue(false)
    const res = await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('AP2_NOT_CONFIGURED')
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('rejects an unknown / inactive tool without validating', async () => {
    setTool(null)
    const res = await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('AP2_PROVIDER_ERROR')
    expect(mockValidate).not.toHaveBeenCalled()
  })

  it('returns 429 when rate-limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 1, remaining: 0, reset: 0 })
    const res = await verifyPOST(makeReq('/api/ap2/verify', VERIFY_ENVELOPE))
    expect(res.status).toBe(429)
  })
})

describe('POST /api/ap2/settle', () => {
  it('returns a raw SettlementResult for a valid VDC', async () => {
    mockValidate.mockResolvedValue({ valid: true, transactionId: 'tx-9' })
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(json.operationId).toBe('tx-9')
    expect(typeof json.costCents).toBe('number')
    expect(json.metadata.protocol).toBe('ap2')
    expect(json.metadata.settlementType).toBe('real-time')
  })

  it('mints an operationId when the validator returns none', async () => {
    mockValidate.mockResolvedValue({ valid: true })
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    const json = await res.json()
    expect(typeof json.operationId).toBe('string')
    expect(json.operationId.length).toBeGreaterThan(0)
  })

  it('returns 402 when re-verification fails at settle time', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'AP2_CREDENTIAL_EXPIRED', message: 'expired' },
    })
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(402)
    const json = await res.json()
    expect(json.code).toBe('AP2_CREDENTIAL_EXPIRED')
  })

  it('returns 503 when AP2 is disabled', async () => {
    mockIsAp2Enabled.mockReturnValue(false)
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(503)
  })

  it('returns 404 for an unknown / inactive tool', async () => {
    setTool(null)
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(404)
  })

  // ─── P3.K4 (A1) unified-ledger write ──────────────────────────────────
  it("records a 'settled' ledger entry keyed by the VDC operationId on success", async () => {
    mockValidate.mockResolvedValue({ valid: true, transactionId: 'tx-9' })
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    expect(mockRecordSettlement).toHaveBeenCalledTimes(1)
    expect(mockRecordSettlement).toHaveBeenCalledWith(
      expect.objectContaining({
        invocationId: 'tx-9',
        rail: 'ap2',
        protocol: 'ap2',
        amountCents: 50,
        currency: 'USD',
        takeBps: 0,
        status: 'settled',
        accountId: 'dev-uuid-1',
      }),
    )
  })

  it('does NOT write the ledger when costCents resolves to 0', async () => {
    setTool({ ...ACTIVE_TOOL, pricingConfig: null })
    mockValidate.mockResolvedValue({ valid: true, transactionId: 'tx-0' })
    const res = await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(res.status).toBe(200)
    expect(mockRecordSettlement).not.toHaveBeenCalled()
  })

  it('does NOT write the ledger when settle-time re-verification fails', async () => {
    mockValidate.mockResolvedValue({
      valid: false,
      error: { code: 'AP2_CREDENTIAL_EXPIRED', message: 'expired' },
    })
    await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    expect(mockRecordSettlement).not.toHaveBeenCalled()
  })

  it('mints a UUID ledger key when the validator returns no transactionId', async () => {
    mockValidate.mockResolvedValue({ valid: true })
    await settlePOST(makeReq('/api/ap2/settle', SETTLE_ENVELOPE))
    const arg = mockRecordSettlement.mock.calls[0]?.[0]
    expect(arg.invocationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })
})
