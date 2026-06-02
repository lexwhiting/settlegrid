/**
 * circle-nano direct-proxy DARK-GATE (Phase 1, funds-safety 2026-06-01).
 *
 * Pins the funds-safety guard: a PAID circle-nano request to the direct proxy MUST be
 * REJECTED (503 CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE) and NEVER credited — the proxy
 * verifies the EIP-3009 authorization OFFLINE but does NOT settle it on-chain, so a credit
 * here would be a phantom credit (payouts draw on developers.balanceCents). Free calls (no
 * money) still pass through. Mirrors the x402-proxy-settlement harness: mock only the
 * external boundaries + drive the REAL exported POST → handleProxy → legacy dispatch chain →
 * handleProtocolProxy('circle-nano').
 *
 * NOTE: Phase-1-scoped. Phase 2 makes the circle-nano proxy SETTLE on-chain in-path (a
 * dedicated handleCircleNanoProxy), at which point this dark-gate is removed and these
 * assertions are replaced by the settle-in-path tests.
 * See docs/tech-debt/circle-nano-funds-safety-build-plan-2026-06-01.md.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const PAYER = '0x' + '2'.repeat(40)

const H = vi.hoisted(() => {
  // lookupToolBySlug: db.select().from().innerJoin().where().limit() → [toolRow]
  const selectLimit = vi.fn()
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: selectLimit,
  }
  // forwardAndBill credit: db.update().set().where()
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  // recordProtocolInvocation: db.insert().values()
  const insertValues = vi.fn()
  const db = {
    select: () => selectChain,
    update: dbUpdate,
    insert: () => ({ values: insertValues }),
  }
  return {
    db,
    selectLimit,
    updateWhere,
    dbUpdate,
    insertValues,
    validateCircleNano: vi.fn(),
    genCircleNano402: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: H.db }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }),
  tryRedis: async () => null,
}))
vi.mock('@/lib/logger', () => ({ logger: H.logger }))
vi.mock('@/lib/circle-nano-proxy', () => ({
  isCircleNanoRequest: () => true,
  isCircleNanoEnabled: () => true,
  validateCircleNanoCredentialString: H.validateCircleNano,
  generateCircleNano402Response: H.genCircleNano402,
}))
// Importing the real rate-limit module builds an Upstash limiter at load; mock it so the
// proxy preamble (checkRateLimit) passes deterministically.
vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// handleProtocolProxy is route-private; drive the REAL exported POST → handleProxy →
// legacy dispatch chain (USE_UNIFIED_ADAPTERS off) → the circle-nano branch.
import { POST } from '../route'

function toolRow(costCents: number) {
  return {
    id: 'tool-1',
    name: 'Demo Tool',
    slug: 'demo',
    status: 'active',
    proxyEndpoint: 'https://upstream.example/api',
    developerId: 'dev-1',
    pricingConfig: { defaultCostCents: costCents },
    revenueSharePct: 100,
  }
}

function makeReq(): NextRequest {
  return new Request('https://settlegrid.ai/api/proxy/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-circle-nano-auth': 'eip3009-proof' },
    body: JSON.stringify({ hello: 'world' }),
  }) as unknown as NextRequest
}

function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: 'demo' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  H.updateWhere.mockResolvedValue(undefined)
  H.insertValues.mockResolvedValue(undefined)
  // Offline verification PASSES — so we reach the dark-gate (the guard is about
  // settlement, not validity).
  H.validateCircleNano.mockResolvedValue({
    valid: true,
    confirmationId: 'c1',
    payerAddress: PAYER,
    amountUsdc: '500000',
  })
  // Legacy dispatch chain (skip the unified adapter path) so circle-nano reaches
  // handleProtocolProxy('circle-nano').
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ result: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('circle-nano direct-proxy dark-gate (Phase 1)', () => {
  it('PAID circle-nano (costCents>0) → 503 CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE; NOT forwarded; NOT credited', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    const res = await callPost(makeReq())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('CIRCLE_NANO_PROXY_SETTLEMENT_UNAVAILABLE')
    expect(globalThis.fetch).not.toHaveBeenCalled() // never forwarded upstream
    expect(H.dbUpdate).not.toHaveBeenCalled() // phantom credit prevented (no balanceCents write)
    expect(H.logger.warn).toHaveBeenCalledWith(
      'proxy.circle_nano_proxy_settlement_unavailable',
      expect.objectContaining({ slug: 'demo' }),
    )
  })

  it('FREE circle-nano (costCents<=0) → still forwards (no money moves); dark-gate not triggered', async () => {
    H.selectLimit.mockResolvedValue([toolRow(0)])
    const res = await callPost(makeReq())
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // free path forwards unchanged
  })
})
