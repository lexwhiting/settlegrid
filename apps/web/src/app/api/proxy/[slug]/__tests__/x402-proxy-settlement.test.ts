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
  // forwardAndBill legacy credit: db.update().set().where()  (×2: tools + developers)
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  // (T) forwardAndBill ON-CHAIN credit: db.transaction(tx => tx.update(table)
  // .set(vals).where(cond)[.returning()]) — developers + tools + the credited_at
  // marker in ONE txn. The shape is SPECIFIED (set captures vals, where captures
  // cond, returning resolves rows) so a harness TypeError can never vacuously
  // green the F3 path (R2 audit improvement #1 / DC-05 bare-mock-chain class).
  const txReturning = vi.fn()
  const txSet = vi.fn()
  const txWhere = vi.fn()
  const txUpdate = vi.fn(() => ({
    set: (vals: unknown) => {
      txSet(vals)
      return {
        where: (cond: unknown) => {
          txWhere(cond)
          return Object.assign(Promise.resolve(undefined), { returning: txReturning })
        },
      }
    },
  }))
  const dbTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb({ update: txUpdate }))
  // recordProtocolInvocation: db.insert().values().then().catch()
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
    updateWhere,
    dbUpdate,
    dbTransaction,
    txUpdate,
    txSet,
    txWhere,
    txReturning,
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
  // (T) — route.ts now imports the PURE deterministic operation-id builder from
  // this module; pass the REAL one through (importActual) so the marker keys
  // the exact id the orchestrator would write (R2 audit fix B4).
  const actual = await importOriginal<typeof import('@/lib/settlement/x402/orchestrate')>()
  return { executeX402Settlement: H.executeX402Settlement, x402OperationId: actual.x402OperationId }
})
vi.mock('@/lib/settlement/x402/parse', () => ({
  parseX402ExactPayload: H.parseX402ExactPayload,
  extractX402PaymentHeader: H.extractX402PaymentHeader,
}))
// Importing the real rate-limit module builds an Upstash limiter at load; mock it
// so the proxy preamble (checkRateLimit) passes deterministically.
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// handleX402Proxy is route-private (Next.js rejects non-standard route.ts exports),
// so we drive the REAL exported POST entry → handleProxy → legacy dispatch chain →
// handleX402Proxy (USE_UNIFIED_ADAPTERS off + MPP/circle-nano disabled below).
import { POST } from '../route'
// The REAL builder (importActual passthrough above) — computes the exact
// operation_id the marker WHERE must key (② seal MEDIUM: cond asserted, not
// just captured).
import { x402OperationId } from '@/lib/settlement/x402/orchestrate'

/**
 * Flatten a REAL drizzle SQL condition into its bound param values + text
 * chunks (drizzle-orm ^0.38: SQL.queryChunks of Param{value,encoder} /
 * StringChunk{value[]} / nested SQL). Test-only introspection, version-pinned.
 */
function flattenCond(node: unknown, acc = { params: [] as unknown[], text: [] as string[] }) {
  if (!node || typeof node !== 'object') return acc
  const n = node as Record<string, unknown>
  if (Array.isArray(n.queryChunks)) {
    for (const c of n.queryChunks as unknown[]) flattenCond(c, acc)
    return acc
  }
  if ('encoder' in n && 'value' in n) acc.params.push(n.value)
  else if (Array.isArray(n.value)) acc.text.push((n.value as unknown[]).join(''))
  return acc
}

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
  // (T) — txn chain defaults: dev UPDATE returning [{id}] (row matched ⇒ the
  // marker runs), marker returning [{id}] (marked ⇒ no unmatched alert).
  H.txReturning.mockResolvedValue([{ id: 'x' }])
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
  it('fresh settle → forwards, credits dev+tool+marker in ONE txn (gross 50), tx-hash + cost headers', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    const res = await callPost(makeReq())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // forwarded upstream
    // (T) fresh on-chain flip → the TRANSACTION branch: developers THEN tools
    // THEN the credited_at marker; ZERO direct db.update calls (the legacy
    // Promise.all path is for non-settlement rails only).
    expect(H.dbUpdate).not.toHaveBeenCalled()
    expect(H.dbTransaction).toHaveBeenCalledTimes(1)
    expect(H.txUpdate).toHaveBeenCalledTimes(3)
    const txSetCalls = H.txSet.mock.calls.map((c) => c[0] as Record<string, unknown>)
    expect(txSetCalls[0]).toHaveProperty('balanceCents') // 1st: developers (lock-order pin)
    expect(txSetCalls[1]).toHaveProperty('totalRevenueCents') // 2nd: tools
    expect(txSetCalls[2]).toHaveProperty('creditedAt') // 3rd: the marker
    expect(txSetCalls[2].creditedAt).toBeInstanceOf(Date)
    // (② seal MEDIUM) the marker WHERE itself, not just its SET: keyed by the
    // EXACT operation_id the orchestrator wrote (real builder on this test's
    // payload) + rail + settled + the credited_at IS NULL guard.
    const marker = flattenCond(H.txWhere.mock.calls[2]?.[0])
    expect(marker.params).toContain(
      x402OperationId({
        network: MAINNET_PAYLOAD.network,
        authorization: MAINNET_PAYLOAD.payload.authorization,
        signature: MAINNET_PAYLOAD.payload.signature,
      }),
    )
    expect(marker.params).toContain('x402')
    expect(marker.params).toContain('settled')
    expect(marker.text.join(' ')).toContain('is null')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xTX')
    expect(res.headers.get('X-SettleGrid-Cost-Cents')).toBe('50') // GROSS credit
    // B4 SEMANTIC GUARD: the proxy attributes settlement rows to the OWNING
    // DEVELOPER (toolRow.developerId) — the PERMANENT account_id semantic;
    // see RailSettlementRow.accountId + reconcile.test.ts's reconciler pin.
    expect(H.executeX402Settlement).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'dev-1', toolId: 'tool-1' }),
    )
  })

  it('replay (alreadySettled) → still forwards but does NOT re-credit (F1); cost header 0', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX', alreadySettled: true })
    const res = await callPost(makeReq())
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // buyer paid once → still delivered
    expect(H.dbUpdate).not.toHaveBeenCalled() // NOT re-credited
    expect(H.dbTransaction).not.toHaveBeenCalled() // (T) no marker txn either
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
    expect(H.dbTransaction).not.toHaveBeenCalled() // (T) and no marker txn
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.onchain_settled_upstream_failed',
      expect.objectContaining({ txHash: '0xTX', payer: PAYER, costCents: 50, upstreamStatus: 502 }),
    )
  })

  it('credit TRANSACTION throws after settle+deliver → onchain_credit_lost_after_settle alert (buyer still served)', async () => {
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX' })
    // (T) — the failure injection moves INTO the transaction (the on-chain
    // credit no longer flows through the legacy db.update chain): the dev
    // UPDATE's returning() rejects → the whole txn (credit+marker) rolls back.
    H.txReturning.mockRejectedValueOnce(new Error('db down'))
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
