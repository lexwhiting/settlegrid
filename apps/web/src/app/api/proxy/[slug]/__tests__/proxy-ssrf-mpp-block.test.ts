/**
 * Per-rail SSRF block → billing test (G2-2, LBD-3) — MPP (Stripe PREPAID) rail.
 *
 * MPP captures the Stripe SPT inside validateMppPayment BEFORE the upstream
 * fetch, so a private/reserved proxyEndpoint MUST be rejected by the PRE-CAPTURE
 * assertSafeUrlSync in handleMppProxy — BEFORE validateMppPayment runs —
 * otherwise the buyer is charged-but-undelivered (F3). The x402 sibling
 * (proxy-ssrf-block.test.ts) covers the on-chain prepaid rail; this closes the
 * MPP gap. LBD-3 mandates asserting the actual charge outcome PER RAIL.
 *
 * Teeth: moving the assertSafeUrlSync below validateMppPayment in handleMppProxy
 * makes the block cases RED (capture would run before the block).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const H = vi.hoisted(() => {
  const selectLimit = vi.fn()
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: selectLimit,
  }
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  const dbTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb({ update: vi.fn() }))
  const insertValues = vi.fn()
  const db = {
    select: () => selectChain,
    update: dbUpdate,
    transaction: dbTransaction,
    insert: () => ({ values: insertValues }),
  }
  return {
    db,
    selectLimit,
    dbUpdate,
    dbTransaction,
    insertValues,
    isMppRequest: vi.fn(() => true),
    validateMppPayment: vi.fn(),
    generateMpp402Response: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: H.db }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }),
  tryRedis: async () => null,
}))
vi.mock('@/lib/logger', () => ({ logger: H.logger }))
vi.mock('@/lib/mpp', () => ({
  isMppRequest: H.isMppRequest,
  validateMppPayment: H.validateMppPayment,
  generateMpp402Response: H.generateMpp402Response,
}))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

import { POST } from '../route'

const TOOL_ROW = {
  id: 'tool-1',
  name: 'Demo Tool',
  slug: 'demo',
  status: 'active',
  proxyEndpoint: 'https://upstream.example/api',
  developerId: 'dev-1',
  pricingConfig: { defaultCostCents: 50 },
}

function makeReq(): NextRequest {
  return new Request('https://settlegrid.ai/api/proxy/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mpp-token': 'tok' },
    body: JSON.stringify({ hello: 'world' }),
  }) as unknown as NextRequest
}

const callPost = (req: NextRequest) => POST(req, { params: Promise.resolve({ slug: 'demo' }) })

beforeEach(() => {
  vi.clearAllMocks()
  H.isMppRequest.mockReturnValue(true)
  H.insertValues.mockResolvedValue(undefined)
  // If the guard fails to block, validateMppPayment (the Stripe SPT capture)
  // would run — make the non-blocked outcome observable + harmless (402).
  H.validateMppPayment.mockResolvedValue({ valid: false, error: { code: 'PAYMENT_REQUIRED' } })
  H.generateMpp402Response.mockReturnValue(
    new Response(JSON.stringify({ error: 'payment required' }), { status: 402 }),
  )
  vi.stubEnv('STRIPE_MPP_SECRET', 'sk_test_mpp') // isMppEnabled() → true
  vi.stubEnv('MPP_RECIPIENT_ID', 'rec_1')
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const PRIVATE_ENDPOINTS = [
  'http://169.254.169.254/', // cloud metadata literal
  'http://127.0.0.1/x', // loopback
  'http://2130706433/', // decimal-encoded 127.0.0.1
  'http://192.168.0.10/', // RFC1918
  'http://[::1]/', // IPv6 loopback
]

describe('MPP (Stripe PREPAID) — private endpoint rejects PRE-CAPTURE', () => {
  it.each(PRIVATE_ENDPOINTS)('blocks %s BEFORE validateMppPayment captures', async (endpoint) => {
    H.selectLimit.mockResolvedValue([{ ...TOOL_ROW, proxyEndpoint: endpoint }])

    const res = await callPost(makeReq())

    expect(res.status).toBe(502) // UPSTREAM_BLOCKED
    // The crux: the Stripe SPT capture NEVER runs → buyer is un-charged.
    expect(H.validateMppPayment).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('a public endpoint reaches validateMppPayment (no over-block — proves the guard is the cause)', async () => {
    H.selectLimit.mockResolvedValue([{ ...TOOL_ROW, proxyEndpoint: 'https://api.public-tool.com/run' }])

    const res = await callPost(makeReq())

    // Same mocks as the block cases, but a PUBLIC endpoint reaches capture — so
    // the ONLY thing blocking the private cases is the pre-capture guard.
    expect(res.status).not.toBe(502)
    expect(H.validateMppPayment).toHaveBeenCalledTimes(1)
  })
})
