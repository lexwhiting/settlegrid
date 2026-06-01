/**
 * x402 proxy-level integration test — the seal-audit's OWED gate.
 *
 * Exercises the REAL handleX402Proxy + forwardAndBill (the production billing
 * surface the orchestrator-level Base-Sepolia e2e never touched — exactly where
 * the seal-audit found F1–F3). The team's other proxy tests source-scan or test
 * extracted logic because route.ts is heavy; here we mock only the external
 * boundaries (db, redis, logger, the x402 verifier/parser, the settle
 * orchestrator) + stub the two gate env vars + fetch, and drive the real handler:
 *
 *   - F1 fresh settle  → forwarded + exactly ONE gross dev/tool credit + tx-hash header;
 *   - F1 replay (alreadySettled) → forwarded but NOT re-credited (cost header 0);
 *   - non-settled (failed/pending) → x402 error, NO forward, NO credit;
 *   - F3 5xx-after-settle → NO credit + the onchain_settled_upstream_failed alert;
 *   - F3 credit-UPDATE throws → the onchain_credit_lost_after_settle alert;
 *   - F2 testnet network → 402 X402_NETWORK_UNSUPPORTED, settle never attempted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NextRequest } from 'next/server'

const PAYER = '0x' + '2'.repeat(40)
const RECIPIENT = '0x' + '1'.repeat(40)

const H = vi.hoisted(() => {
  // lookupToolBySlug: db.select().from().innerJoin().where().limit() → [toolRow]
  const selectLimit = vi.fn()
  const selectChain = {
    from: () => selectChain,
    innerJoin: () => selectChain,
    where: () => selectChain,
    limit: selectLimit,
  }
  // forwardAndBill credit: db.update().set().where()  (×2: tools + developers)
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  // recordProtocolInvocation: db.insert().values().then().catch()
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
vi.mock('@/lib/settlement/x402/orchestrate', () => ({ executeX402Settlement: H.executeX402Settlement }))
vi.mock('@/lib/settlement/x402/parse', () => ({
  parseX402ExactPayload: H.parseX402ExactPayload,
  extractX402PaymentHeader: H.extractX402PaymentHeader,
}))
// Importing the real rate-limit module builds an Upstash limiter at load; mock it
// so the proxy preamble (checkRateLimit) passes deterministically.
vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// handleX402Proxy is route-private (Next.js rejects non-standard route.ts exports),
// so we drive the REAL exported POST entry → handleProxy → legacy dispatch chain →
// handleX402Proxy (USE_UNIFIED_ADAPTERS off + MPP/circle-nano disabled below).
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

// Drive the real route entry. slug param is a Promise in the App Router signature.
function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: 'demo' }) })
}

function okJsonResponse(): Response {
  return new Response(JSON.stringify({ result: 'ok' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  H.selectLimit.mockResolvedValue([TOOL_ROW])
  H.updateWhere.mockResolvedValue(undefined)
  H.insertValues.mockResolvedValue(undefined)
  H.validateX402Payment.mockResolvedValue({
    valid: true,
    payerAddress: PAYER,
    network: 'eip155:8453',
    scheme: 'exact',
    amountUsdc: '500000',
  })
  H.extractX402PaymentHeader.mockReturnValue('header-value')
  H.parseX402ExactPayload.mockReturnValue(MAINNET_PAYLOAD)
  // x402 settlement enable-gate (real env getters read these at call time).
  vi.stubEnv('SETTLEGRID_GAS_WALLET_KEY', '0x' + '1'.repeat(64))
  vi.stubEnv('SETTLEGRID_PAYMENT_ADDRESS', RECIPIENT)
  // testnet flag OFF → non-mainnet rejected (F2).
  vi.stubEnv('SETTLEGRID_X402_ALLOW_TESTNET', '')
  // Legacy dispatch chain (skip the unified adapter path) so x402 reaches handleX402Proxy.
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse()))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('handleX402Proxy — settled path forwards + credits exactly once', () => {
  it('fresh settle → forwards, credits dev+tool ONCE (gross 50), tx-hash + cost headers', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    const res = await callPost(makeReq())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // forwarded upstream
    expect(H.dbUpdate).toHaveBeenCalledTimes(2) // tools + developers credited
    expect(res.status).toBe(200)
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xTX')
    expect(res.headers.get('X-SettleGrid-Cost-Cents')).toBe('50') // GROSS credit
  })

  it('replay (alreadySettled) → still forwards but does NOT re-credit (F1); cost header 0', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX', alreadySettled: true })
    const res = await callPost(makeReq())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // buyer paid once → still delivered
    expect(H.dbUpdate).not.toHaveBeenCalled() // NOT re-credited
    expect(res.status).toBe(200)
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xTX')
    expect(res.headers.get('X-SettleGrid-Cost-Cents')).toBe('0')
  })
})

describe('handleX402Proxy — non-settled never forwards or credits', () => {
  it('failed outcome → x402 error with the code, NO forward, NO credit', async () => {
    H.executeX402Settlement.mockResolvedValue({
      status: 'failed',
      code: 'X402_AMOUNT_MISMATCH',
      httpStatus: 402,
      reason: 'value must equal cost',
    })
    const res = await callPost(makeReq())
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error.code).toBe('X402_AMOUNT_MISMATCH')
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  it('pending outcome → x402 error (502), NO forward, NO credit', async () => {
    H.executeX402Settlement.mockResolvedValue({
      status: 'pending',
      code: 'X402_SETTLEMENT_PENDING_CONFIRMATION',
      httpStatus: 502,
      reason: 'broadcast unconfirmed',
    })
    const res = await callPost(makeReq())
    expect(res.status).toBe(502)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })
})

describe('handleX402Proxy — F3 settle-then-upstream-fail (charged, not delivered)', () => {
  it('upstream 5xx after settle → NO credit + onchain_settled_upstream_failed alert', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('upstream boom', { status: 502, headers: { 'content-type': 'text/plain' } }),
    )
    const res = await callPost(makeReq())
    expect(res.status).toBe(502)
    expect(H.dbUpdate).not.toHaveBeenCalled() // upstream failed → no credit
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.onchain_settled_upstream_failed',
      expect.objectContaining({ txHash: '0xTX', payer: PAYER, costCents: 50, upstreamStatus: 502 }),
    )
  })

  it('billing UPDATE throws after settle+deliver → onchain_credit_lost_after_settle alert (buyer still served)', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    H.updateWhere.mockRejectedValue(new Error('db down')) // the credit UPDATE throws
    const res = await callPost(makeReq())
    expect(res.status).toBe(200) // delivered; we do NOT fail the buyer's served request
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.onchain_credit_lost_after_settle',
      expect.objectContaining({ txHash: '0xTX', payer: PAYER, costCents: 50 }),
    )
  })
})

describe('handleX402Proxy — F2 production network-pin', () => {
  it('testnet (eip155:84532) payload → 402 X402_NETWORK_UNSUPPORTED, settle NEVER attempted', async () => {
    H.parseX402ExactPayload.mockReturnValue({ ...MAINNET_PAYLOAD, network: 'eip155:84532' })
    const res = await callPost(makeReq())
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.error.code).toBe('X402_NETWORK_UNSUPPORTED')
    expect(H.executeX402Settlement).not.toHaveBeenCalled() // rejected BEFORE settle
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('mainnet (eip155:8453) payload → passes the pin → settle attempted', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    await callPost(makeReq())
    expect(H.executeX402Settlement).toHaveBeenCalledTimes(1)
  })
})
