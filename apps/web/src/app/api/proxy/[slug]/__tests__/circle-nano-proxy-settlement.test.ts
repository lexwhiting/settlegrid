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
  // forwardAndBill legacy credit: db.update().set().where()  (tools + developers)
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  // (T) forwardAndBill ON-CHAIN credit: db.transaction(tx => tx.update(table)
  // .set(vals).where(cond)[.returning()]) — dev + tools + credited_at marker in
  // ONE txn (shape specified per R2 audit improvement #1; mirrors the x402 twin).
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
  // recordProtocolInvocation: db.insert().values()
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
  validateCircleNanoCredentialString: H.validateCircleNano,
  generateCircleNano402Response: H.genCircleNano402,
}))
// The on-chain settlement orchestrator is mocked here (its viem/ledger/Redis
// branching is covered in settle.test.ts); this file pins the ROUTE contract:
// settle-before-credit, replay skip-credit, F2 pin, dark-gate, free pass-through.
vi.mock('@/lib/settlement/circle-nano/settle', async (importOriginal) => {
  // (T) — route.ts now imports the PURE deterministic operation-id builder from
  // this module; pass the REAL one through (importActual) so the marker keys
  // the exact id the orchestrator would write (R2 audit fix B4).
  const actual = await importOriginal<typeof import('@/lib/settlement/circle-nano/settle')>()
  return { executeCircleNanoSettlement: H.execute, circleNanoOperationId: actual.circleNanoOperationId }
})
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// handleCircleNanoProxy is route-private; drive the REAL exported POST → handleProxy →
// legacy dispatch chain (USE_UNIFIED_ADAPTERS off) → handleCircleNanoProxy.
import { POST } from '../route'
// The REAL builder (importActual passthrough above) — computes the exact
// operation_id the marker WHERE must key (② seal MEDIUM: cond asserted).
import { circleNanoOperationId } from '@/lib/settlement/circle-nano/settle'

/** Flatten a REAL drizzle SQL cond into bound params + text (drizzle ^0.38). */
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

/**
 * (V-N2b) The credited amount in `sql`${col} + ${N}`` is interpolated as a RAW
 * NUMBER chunk (NOT a bound Param, unlike eq()'s values), so flattenCond can't see
 * it. Pull the lone numeric queryChunk — the credit operand — directly.
 */
function creditAmountOf(node: unknown): number | undefined {
  const chunks = (node as { queryChunks?: unknown[] })?.queryChunks
  if (!Array.isArray(chunks)) return undefined
  return chunks.find((c) => typeof c === 'number') as number | undefined
}

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
  // Default: a FRESH on-chain settle (no alreadySettled → credit fires). (V-N2b)
  // the orchestrator resolves creditCents (fresh-submit == costCents 50).
  H.execute.mockResolvedValue({ status: 'settled', txHash: '0xCNTX', creditCents: 50 })
  // (T) txn chain default: dev UPDATE returning [{id}] (row matched ⇒ the
  // marker runs), marker returning [{id}] (marked ⇒ no unmatched alert).
  H.txReturning.mockResolvedValue([{ id: 'x' }])
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
    // (T) fresh on-chain flip → the TRANSACTION branch: developers THEN tools
    // THEN the credited_at marker; ZERO direct db.update calls.
    expect(H.dbUpdate).not.toHaveBeenCalled()
    expect(H.dbTransaction).toHaveBeenCalledTimes(1)
    expect(H.txUpdate).toHaveBeenCalledTimes(3)
    const txSetCalls = H.txSet.mock.calls.map((c) => c[0] as Record<string, unknown>)
    expect(txSetCalls[0]).toHaveProperty('balanceCents') // 1st: developers (lock-order pin)
    expect(txSetCalls[1]).toHaveProperty('totalRevenueCents') // 2nd: tools
    expect(txSetCalls[2]).toHaveProperty('creditedAt') // 3rd: the marker
    // (V-N2b) the credited VALUE is the orchestrator-resolved creditCents (50 here).
    expect(creditAmountOf(txSetCalls[0].balanceCents)).toBe(50)
    expect(creditAmountOf(txSetCalls[1].totalRevenueCents)).toBe(50)
    // (② seal MEDIUM) the marker WHERE itself: keyed by the EXACT operation_id
    // (real builder over this test's proof fields) + rail + settled + IS NULL.
    const marker = flattenCond(H.txWhere.mock.calls[2]?.[0])
    expect(marker.params).toContain(
      circleNanoOperationId({
        network: 'eip155:8453',
        authorization: {
          from: PAYER, to: '0x' + 'a'.repeat(40), value: '500000',
          validAfter: '0', validBefore: '9999999999', nonce: '0x' + 'cd'.repeat(32),
        },
        signature: ('0x' + 'ab'.repeat(65)) as `0x${string}`,
      } as Parameters<typeof circleNanoOperationId>[0]),
    )
    expect(marker.params).toContain('circle-nano')
    expect(marker.params).toContain('settled')
    expect(marker.text.join(' ')).toContain('is null')
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xCNTX')
    // B4 SEMANTIC GUARD: the proxy attributes settlement rows to the OWNING
    // DEVELOPER (toolRow.developerId) — the PERMANENT account_id semantic;
    // see RailSettlementRow.accountId + reconcile.test.ts's reconciler pin.
    expect(H.execute).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'dev-1', toolId: 'tool-1' }),
    )
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
    expect(H.dbTransaction).not.toHaveBeenCalled() // (T) no marker txn either
  })

  it('settled on-chain but upstream returns non-2xx → no credit + onchain_settled_upstream_failed alert (F3)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    stubFetch(500)
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(500)
    expect(H.dbUpdate).not.toHaveBeenCalled() // settled USDC but undelivered → dev credited 0
    expect(H.dbTransaction).not.toHaveBeenCalled() // (T) and no marker txn
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

  // B1.1 set/unset (legacy path): recipient unset (rail DARK) → the legacy dispatch gate (now
  // keyed on isCircleNanoKernelEnabled) does NOT route circle-nano, so the request FALLS THROUGH
  // to the other rails / API-key flow EXACTLY as when circle-nano is disabled — never served as
  // circle-nano. The handler's :2015 503 dark-gate (the frozen funds-safety money boundary) is now
  // provably SHADOWED by this dispatch gate: both dispatch paths require recipient-set, so :2015's
  // 503 branch is unreachable-by-construction defense-in-depth (byte-identical/unedited; its 503
  // semantics remain covered by the kernel settle:91/verify:93 suites). CIRCLE_NANO_API_KEY set is
  // irrelevant post-fix. (Pre-fix this returned a circle-nano 503 — the carried bug this re-pin flips.)
  it('B1.1 set/unset (legacy): recipient unset → circle-nano NOT dispatched, request falls through (no circle-nano 503/402), money path untouched', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '') // isCircleNanoKernelEnabled() → false
    const res = await callPost(makeReq(MAINNET_PROOF))
    // Falls through "exactly as when disabled": no rail matches + no API key → the API-key
    // flow's 401, NOT the circle-nano dark-gate 503 (the pre-fix bug). Empirically confirmed.
    expect(res.status).toBe(401)
    const body = await res.json().catch(() => ({}))
    expect(body.code).not.toBe('CIRCLE_NANO_NOT_CONFIGURED')
    expect(H.execute).not.toHaveBeenCalled() // never settled
    expect(H.genCircleNano402).not.toHaveBeenCalled() // no circle-nano 402 emitted
    expect(globalThis.fetch).not.toHaveBeenCalled() // not forwarded as circle-nano
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })

  // B1.1 unset/set (legacy path): API key UNSET but recipient SET → circle-nano STILL serves. Proves
  // the dispatch gate keys on the RECIPIENT, not the API key (the AND-trap: AND-ing the now-vestigial
  // key would wrongly dark a fully-serviceable configured rail).
  it('B1.1 unset/set (legacy): API key unset but recipient set → circle-nano still serves (recipient gate, not API key)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(H.execute).toHaveBeenCalledTimes(1)
    expect(res.headers.get('X-SettleGrid-Tx-Hash')).toBe('0xCNTX')
  })

  it('FREE circle-nano (costCents<=0) → forwards, no settlement attempted (no money moves)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(0)])
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(H.execute).not.toHaveBeenCalled() // free path never settles on-chain
  })

  it('(V-N2b §7.4) recovery-confirm: the handler bridges outcome.creditCents → the twin credits the RECORDED value (30), NOT costCents (50); the invocation records 30', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    H.execute.mockResolvedValue({ status: 'settled', txHash: '0xCNTX', creditCents: 30 })
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(H.dbTransaction).toHaveBeenCalledTimes(1)
    const txSetCalls = H.txSet.mock.calls.map((c) => c[0] as Record<string, unknown>)
    expect(creditAmountOf(txSetCalls[0].balanceCents)).toBe(30) // dev balance += 30 (recorded), NOT 50
    expect(creditAmountOf(txSetCalls[1].totalRevenueCents)).toBe(30) // tool revenue += 30
    const invocationRow = H.insertValues.mock.calls[0][0] as Record<string, unknown>
    expect(invocationRow.costCents).toBe(30) // §7.10
  })

  it('(V-N2b §7.5) DEFER: outcome.creditCents null → NO credit txn (credited_at untouched), still forwarded (200)', async () => {
    H.selectLimit.mockResolvedValue([toolRow(50)])
    H.execute.mockResolvedValue({ status: 'settled', txHash: '0xCNTX', creditCents: null })
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // still delivered (buyer paid once)
    expect(H.dbTransaction).not.toHaveBeenCalled() // DEFER — no balance / revenue / marker
    expect(H.dbUpdate).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    const invocationRow = H.insertValues.mock.calls[0][0] as Record<string, unknown>
    expect(invocationRow.costCents).toBe(50) // §7.10 defer → the quoted cost (unchanged)
  })
})

// B1.1 — the SAME gate-coherence on the PROD-DEFAULT dispatch path. useUnifiedAdapters() defaults
// TRUE (env.ts), so prod routes via tryUnifiedAdapterDispatch → the unified enabledMap circle-nano
// binding → (REAL protocolRegistry.detect on the x-circle-nano-auth header) → handleCircleNanoProxy.
// These pin the unified enabledMap binding to the recipient gate end-to-end (a unified-vs-legacy
// dispatch divergence surfaces here).
describe('B1.1 — prod-default UNIFIED dispatch path (the unified enabledMap circle-nano binding)', () => {
  it('set/unset (unified): recipient unset → circle-nano NOT dispatched, request falls through (no circle-nano 503/402)', async () => {
    vi.stubEnv('USE_UNIFIED_ADAPTERS', undefined as unknown as string) // unset → defaults TRUE (prod path)
    H.selectLimit.mockResolvedValue([toolRow(50)])
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '') // recipient unset
    const res = await callPost(makeReq(MAINNET_PROOF))
    // Falls through to the API-key flow's 401 (NOT the circle-nano 503), via the unified enabledMap gate.
    expect(res.status).toBe(401)
    const body = await res.json().catch(() => ({}))
    expect(body.code).not.toBe('CIRCLE_NANO_NOT_CONFIGURED')
    expect(H.execute).not.toHaveBeenCalled()
    expect(H.genCircleNano402).not.toHaveBeenCalled()
  })

  it('unset/set (unified): API key unset but recipient set → circle-nano still serves (recipient gate, not API key)', async () => {
    vi.stubEnv('USE_UNIFIED_ADAPTERS', undefined as unknown as string) // unset → defaults TRUE (prod path)
    H.selectLimit.mockResolvedValue([toolRow(50)])
    const res = await callPost(makeReq(MAINNET_PROOF))
    expect(res.status).toBe(200)
    expect(H.execute).toHaveBeenCalledTimes(1)
  })
})
