/**
 * circle-nano direct-proxy SETTLE-IN-PATH (Phase 2, funds-safety 2026-06-01).
 *
 * The funds-safety fix: the direct proxy now SETTLES the EIP-3009 authorization
 * ON-CHAIN in-path (confirm-before-deliver) via a dedicated handleCircleNanoProxy,
 * then forwards + credits ONLY on a confirmed settle — so it never credits a
 * withdrawable developer balance (payouts draw on it) for USDC it never collected.
 * Mirrors handleX402Proxy. Supersedes the Phase-1 dark-gate.
 *
 * Harness: mock only the external boundaries + drive the REAL exported POST →
 * handleProxy → legacy dispatch chain (USE_UNIFIED_ADAPTERS off) → handleCircleNanoProxy.
 * executeCircleNanoSettlement is mocked (its own orchestration tests live in
 * lib/settlement/circle-nano/__tests__/settle.test.ts); parseCircleNanoProof is REAL,
 * so the proof header is a genuinely base64-decodable EIP-3009 blob.
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
  // forwardAndBill credit: db.update().set().where()  (tools + developers)
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
    execute: vi.fn(),
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
// The on-chain settlement orchestrator is mocked here (its viem/ledger/Redis
// branching is covered in settle.test.ts); this file pins the ROUTE contract:
// settle-before-credit, replay skip-credit, F2 pin, dark-gate, free pass-through.
vi.mock('@/lib/settlement/circle-nano/settle', () => ({
  executeCircleNanoSettlement: H.execute,
}))
vi.mock('@/lib/rate-limit', () => ({
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// handleCircleNanoProxy is route-private; drive the REAL exported POST → handleProxy →
// legacy dispatch chain (USE_UNIFIED_ADAPTERS off) → handleCircleNanoProxy.
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

/** A genuinely base64-decodable EIP-3009 proof so the REAL parseCircleNanoProof parses it. */
function mkProof(network: string): string {
  return Buffer.from(
    JSON.stringify({
      network,
      authorization: {
        from: PAYER,
        to: '0x' + 'a'.repeat(40),
        value: '500000',
        validAfter: '0',
        validBefore: '9999999999',
        nonce: '0x' + 'cd'.repeat(32),
      },
      signature: '0x' + 'ab'.repeat(65),
    }),
  ).toString('base64')
}
const MAINNET_PROOF = mkProof('eip155:8453')
const SEPOLIA_PROOF = mkProof('eip155:84532')

function makeReq(proof: string): NextRequest {
  return new Request('https://settlegrid.ai/api/proxy/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-circle-nano-auth': proof },
    body: JSON.stringify({ hello: 'world' }),
  }) as unknown as NextRequest
}

function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: 'demo' }) })
}

function stubFetch(status: number) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ result: 'ok' }), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    ),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  H.updateWhere.mockResolvedValue(undefined)
  H.insertValues.mockResolvedValue(undefined)
  // Offline verification PASSES (the kernel-grade verifier is mocked here).
  H.validateCircleNano.mockResolvedValue({
    valid: true,
    confirmationId: 'c1',
    payerAddress: PAYER,
    amountUsdc: '500000',
  })
  // Default: a FRESH on-chain settle (no alreadySettled → credit fires).
  H.execute.mockResolvedValue({ status: 'settled', txHash: '0xCNTX' })
  // Legacy dispatch (skip unified) so circle-nano reaches handleCircleNanoProxy;
  // recipient set so the dark-gate (isCircleNanoKernelEnabled) is OPEN.
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '0x' + '9'.repeat(40))
  stubFetch(200)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('circle-nano direct-proxy settle-in-path (Phase 2)', () => {
  it('PAID + on-chain settled → forwards, credits (gross), returns the tx-hash header', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(H.execute).toHaveBeenCalledTimes(1) // settled on-chain BEFORE delivery
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // forwarded only after settle
    expect(H.dbUpdate).toHaveBeenCalled() // credited (developers.balanceCents + tools.totalRevenueCents)
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xCNTX')
  })

  it('settle NOT confirmed (failed) → structured error, NOT forwarded, NOT credited', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    H.execute.mockResolvedValue({ status: 'failed', code: 'CIRCLE_NANO_SETTLEMENT_REVERTED', httpStatus: 402, reason: 'reverted' })
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('CIRCLE_NANO_SETTLEMENT_REVERTED')
    expect(globalThis.fetch).not.toHaveBeenCalled() // never delivered
    expect(H.dbUpdate).not.toHaveBeenCalled() // never credited
  })

  it('pending/unconfirmed settle → 502 error, not forwarded, not credited', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    H.execute.mockResolvedValue({ status: 'pending', code: 'CIRCLE_NANO_SETTLEMENT_PENDING_CONFIRMATION', httpStatus: 502, reason: 'unconfirmed' })
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(502)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  it('replay / concurrent-loser (alreadySettled) → STILL forwarded, but NOT re-credited (exactly-once)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    H.execute.mockResolvedValue({ status: 'settled', txHash: '0xCNTX', alreadySettled: true })
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // honor the paid request
    expect(H.dbUpdate).not.toHaveBeenCalled() // skipCredit — the flip winner already credited
  })

  it('settled on-chain but upstream returns non-2xx → no credit + onchain_settled_upstream_failed alert (F3)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    stubFetch(500)
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(500)
    expect(H.dbUpdate).not.toHaveBeenCalled() // settled USDC but undelivered → dev credited 0
    expect(H.logger.error).toHaveBeenCalledWith(
      'proxy.onchain_settled_upstream_failed',
      expect.objectContaining({ paymentMethod: 'circle-nano' }),
    )
  })

  it('F2: a Base SEPOLIA payload on a mainnet deploy → 402 NETWORK_UNSUPPORTED, settle never attempted', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    const res = await callPost(makeReq(SEPOLIA_PROOF))
    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.code).toBe('CIRCLE_NANO_NETWORK_UNSUPPORTED')
    expect(H.execute).not.toHaveBeenCalled() // never settles testnet USDC for real credit
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  it('dark-gate: recipient unset (rail not configured) → 503 CIRCLE_NANO_NOT_CONFIGURED, no settle/forward/credit', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '') // isCircleNanoKernelEnabled() → false
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('CIRCLE_NANO_NOT_CONFIGURED')
    expect(H.execute).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  it('FREE circle-nano (costCents<=0) → forwards, no settlement attempted (no money moves)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(0)])
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(H.execute).not.toHaveBeenCalled() // free path never settles on-chain
  })
})
