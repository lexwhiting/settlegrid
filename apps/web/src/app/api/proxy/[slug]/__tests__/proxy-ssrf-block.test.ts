/**
 * Per-rail SSRF block → billing test (G2-2, LBD-3).
 *
 * Asserts the PREPAID money-path invariant: when a tool's stored proxyEndpoint
 * is a private/reserved literal, the synchronous guard in lookupToolBySlug
 * rejects it BEFORE any on-chain settlement — so x402 (PREPAID/irreversible)
 * NEVER settles, NEVER forwards, and NEVER credits. A fetch-time block on a
 * prepaid rail would otherwise be charged-but-undelivered (F3); rejecting
 * pre-settlement keeps the buyer un-charged.
 *
 * Mirrors the x402-proxy-settlement harness (mock only the external boundaries +
 * drive the REAL exported POST → handleProxy → handleX402Proxy).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const PAYER = '0x' + '2'.repeat(40)
const RECIPIENT = '0x' + '1'.repeat(40)

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
    executeX402Settlement: vi.fn(),
    validateX402Payment: vi.fn(),
    generateX402_402Response: vi.fn(),
    parseX402ExactPayload: vi.fn(),
    extractX402PaymentHeader: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }
})

vi.mock('@/lib/db', () => ({ db: H.db }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }),
  tryRedis: async () => null,
}))
vi.mock('@/lib/logger', () => ({ logger: H.logger }))
vi.mock('@/lib/x402-proxy', () => ({
  isX402Request: () => true,
  validateX402Payment: H.validateX402Payment,
  generateX402_402Response: H.generateX402_402Response,
}))
vi.mock('@/lib/settlement/x402/orchestrate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/settlement/x402/orchestrate')>()
  return { executeX402Settlement: H.executeX402Settlement, x402OperationId: actual.x402OperationId }
})
vi.mock('@/lib/settlement/x402/parse', () => ({
  parseX402ExactPayload: H.parseX402ExactPayload,
  extractX402PaymentHeader: H.extractX402PaymentHeader,
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
  revenueSharePct: 100,
}

const MAINNET_PAYLOAD = {
  x402Version: 2,
  scheme: 'exact' as const,
  network: 'eip155:8453',
  payload: {
    signature: ('0x' + 'ab'.repeat(65)) as `0x${string}`,
    authorization: {
      from: PAYER as `0x${string}`,
      to: RECIPIENT as `0x${string}`,
      value: '500000',
      validAfter: '0',
      validBefore: '9999999999',
      nonce: ('0x' + 'cd'.repeat(32)) as `0x${string}`,
    },
  },
}

function makeReq(): NextRequest {
  return new Request('https://settlegrid.ai/api/proxy/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'payment-signature': 'sig' },
    body: JSON.stringify({ hello: 'world' }),
  }) as unknown as NextRequest
}

function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: 'demo' }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  H.insertValues.mockResolvedValue(undefined)
  // Wire the WHOLE downstream so it WOULD settle+forward+credit if not blocked —
  // the guard at lookupToolBySlug is then the only thing that can stop it (teeth).
  H.validateX402Payment.mockResolvedValue({
    valid: true,
    payerAddress: PAYER,
    network: 'eip155:8453',
    scheme: 'exact',
    amountUsdc: '500000',
  })
  H.extractX402PaymentHeader.mockReturnValue('header-value')
  H.parseX402ExactPayload.mockReturnValue(MAINNET_PAYLOAD)
  H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: 50 })
  vi.stubEnv('SETTLEGRID_GAS_WALLET_KEY', '0x' + '1'.repeat(64))
  vi.stubEnv('SETTLEGRID_PAYMENT_ADDRESS', RECIPIENT)
  vi.stubEnv('SETTLEGRID_X402_ALLOW_TESTNET', '')
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  // If any test fails to block, a real upstream forward would call fetch — make
  // that observable (and harmless) rather than a real egress.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const PRIVATE_ENDPOINTS = [
  'http://169.254.169.254/', // cloud metadata literal
  'http://127.0.0.1/internal', // loopback
  'http://2130706433/', // decimal-encoded 127.0.0.1
  'http://192.168.0.10/', // RFC1918
  'http://[::1]/', // IPv6 loopback
]

describe('x402 (PREPAID/on-chain) — private endpoint rejects PRE-SETTLEMENT', () => {
  it.each(PRIVATE_ENDPOINTS)('blocks %s before any settle/forward/credit', async (endpoint) => {
    H.selectLimit.mockResolvedValue([{ ...TOOL_ROW, proxyEndpoint: endpoint }])

    const res = await callPost(makeReq())

    expect(res.status).toBe(502) // UPSTREAM_BLOCKED
    // The crux: NO irreversible settle, NO forward, NO credit — buyer un-charged.
    expect(H.executeX402Settlement).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbTransaction).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  it('allows a public endpoint to settle + forward (no over-block — proves the guard is the cause)', async () => {
    H.selectLimit.mockResolvedValue([{ ...TOOL_ROW, proxyEndpoint: 'https://api.public-tool.com/run' }])
    const res = await callPost(makeReq())
    // Same downstream mocks as the block cases, but a PUBLIC endpoint → the path
    // reaches settlement + forward. So the ONLY difference that blocks the
    // private cases above is the lookupToolBySlug guard (airtight teeth).
    expect(res.status).not.toBe(502)
    expect(H.executeX402Settlement).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
