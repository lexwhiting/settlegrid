/**
 * Phantom-credit hardening — the G3-8 launch-gate regression test.
 *
 * Eight payment rails (AP2 · UCP · DRAIN · Visa-TAP · Alipay · KyaPay · EMVCo ·
 * L402) reach the shared credit boundary at route.ts:1976-1979 and credit a
 * WITHDRAWABLE `developers.balanceCents` on a structural-only `valid:true`
 * detection with NO external money collected — a balance the payout job pays out
 * as real USD. This test pins the dark-gate that closes that hole: with the rail's
 * ROUTING var SET but its `*_SETTLEMENT_ENABLED` var UNSET, an invocation must
 *
 *   (a) credit ZERO — the developer-balance UPDATE is never issued (delta == 0), and
 *   (b) NOT forward upstream (no `fetch` to the dev endpoint) — proving a hard
 *       refuse-503, not a `skipCredit`-style "free proxying"; and
 *   (c) return 503 SETTLEMENT_NOT_CONFIGURED.
 *
 * NO-OP TRAP GUARD (the #1 silent-failure risk): every dark-rail case stubs the
 * rail's ROUTING var SET (AP2_SIGNING_SECRET, UCP_API_KEY, …). A predicate that
 * aliased the routing var (or `isAp2Enabled()`) instead of a distinct
 * `*_SETTLEMENT_ENABLED` var would return true here → the gate would not fire →
 * credit + forward → this test FAILS RED. So a green run proves predicate
 * distinctness, not merely a 503.
 *
 * POSITIVE GUARDS (no regression): ACP + x402 (real-money rails) still credit;
 * Mastercard-VI still 503s via its OWN detection-stub path (never gated by us).
 *
 * Template: the real-POST-with-mocks x402-proxy-settlement.test.ts — drives the
 * REAL exported POST → handleProxy → LEGACY dispatch chain (USE_UNIFIED_ADAPTERS
 * off) → the real handlers + forwardAndBill, mocking only external boundaries (db,
 * redis, logger, rate-limit) and the per-rail detect/validate modules.
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
  // forwardAndBill legacy credit: db.update().set().where() (×2: tools + developers)
  const updateWhere = vi.fn()
  const updateChain = { set: () => updateChain, where: updateWhere }
  const dbUpdate = vi.fn(() => updateChain)
  // forwardAndBill on-chain (x402) credit runs in db.transaction(tx => tx.update…)
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
  const insertValues = vi.fn()
  const db = {
    select: () => selectChain,
    update: dbUpdate,
    transaction: dbTransaction,
    insert: () => ({ values: insertValues }),
  }

  const gen402 = () => new Response('{}', { status: 402, headers: { 'content-type': 'application/json' } })

  return {
    db,
    selectLimit,
    updateWhere,
    dbUpdate,
    dbTransaction,
    txReturning,
    insertValues,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    gen402,
    // ── per-rail detect / validate / enable knobs (default: not-detected) ──
    mppReq: vi.fn(() => false),
    mppValidate: vi.fn(),
    x402Req: vi.fn(() => false),
    x402Validate: vi.fn(),
    ap2Req: vi.fn(() => false),
    ap2Validate: vi.fn(),
    visaReq: vi.fn(() => false),
    visaValidate: vi.fn(),
    acpReq: vi.fn(() => false),
    acpValidate: vi.fn(),
    ucpReq: vi.fn(() => false),
    ucpEnabled: vi.fn(() => true),
    ucpValidate: vi.fn(),
    mcReq: vi.fn(() => false),
    mcEnabled: vi.fn(() => true),
    mcValidate: vi.fn(),
    mcStub: vi.fn(() => new Response(JSON.stringify({ status: 'protocol_detected' }), { status: 503 })),
    cnReq: vi.fn(() => false),
    cnValidate: vi.fn(),
    l402Req: vi.fn(() => false),
    l402Enabled: vi.fn(() => true),
    l402Validate: vi.fn(),
    alipayReq: vi.fn(() => false),
    alipayEnabled: vi.fn(() => true),
    alipayValidate: vi.fn(),
    kyaReq: vi.fn(() => false),
    kyaEnabled: vi.fn(() => true),
    kyaValidate: vi.fn(),
    emvcoReq: vi.fn(() => false),
    emvcoEnabled: vi.fn(() => true),
    emvcoValidate: vi.fn(),
    drainReq: vi.fn(() => false),
    drainEnabled: vi.fn(() => true),
    drainValidate: vi.fn(),
    // x402 on-chain settle chain (positive guard only)
    executeX402Settlement: vi.fn(),
    parseX402ExactPayload: vi.fn(),
    extractX402PaymentHeader: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ db: H.db }))
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }),
  tryRedis: async () => null,
}))
vi.mock('@/lib/logger', () => ({ logger: H.logger }))
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: (h: Headers) =>
    h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip',
  sdkLimiter: {},
  checkRateLimit: vi.fn(async () => ({ success: true })),
}))

// ── Per-rail detect/validate modules (control which rail the legacy chain hits) ──
vi.mock('@/lib/mpp', () => ({
  isMppRequest: H.mppReq,
  validateMppPayment: H.mppValidate,
  generateMpp402Response: H.gen402,
}))
vi.mock('@/lib/x402-proxy', () => ({
  isX402Request: H.x402Req,
  validateX402Payment: H.x402Validate,
  generateX402_402Response: H.gen402,
}))
vi.mock('@/lib/settlement/x402/parse', () => ({
  parseX402ExactPayload: H.parseX402ExactPayload,
  extractX402PaymentHeader: H.extractX402PaymentHeader,
}))
vi.mock('@/lib/settlement/x402/orchestrate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/settlement/x402/orchestrate')>()
  return { executeX402Settlement: H.executeX402Settlement, x402OperationId: actual.x402OperationId }
})
vi.mock('@/lib/ap2-proxy', () => ({
  isAp2Request: H.ap2Req,
  validateAp2Payment: H.ap2Validate,
  generateAp2_402Response: H.gen402,
}))
vi.mock('@/lib/visa-tap-proxy', () => ({
  isVisaTapRequest: H.visaReq,
  validateVisaTapPayment: H.visaValidate,
  generateVisaTap402Response: H.gen402,
}))
vi.mock('@/lib/acp-proxy', () => ({
  isAcpRequest: H.acpReq,
  validateAcpPayment: H.acpValidate,
  generateAcp402Response: H.gen402,
}))
vi.mock('@/lib/ucp-proxy', () => ({
  isUcpRequest: H.ucpReq,
  isUcpEnabled: H.ucpEnabled,
  validateUcpPayment: H.ucpValidate,
  generateUcp402Response: H.gen402,
}))
vi.mock('@/lib/mastercard-proxy', () => ({
  isMastercardRequest: H.mcReq,
  isMastercardEnabled: H.mcEnabled,
  mastercardAdapter: { buildDetectionStubResponse: H.mcStub },
  validateMastercardPayment: H.mcValidate,
  generateMastercard402Response: H.gen402,
}))
vi.mock('@/lib/circle-nano-proxy', () => ({
  isCircleNanoRequest: H.cnReq,
  validateCircleNanoCredentialString: H.cnValidate,
  generateCircleNano402Response: H.gen402,
}))
vi.mock('@/lib/l402-proxy', () => ({
  isL402Request: H.l402Req,
  isL402Enabled: H.l402Enabled,
  validateL402Payment: H.l402Validate,
  generateL402_402Response: async () => H.gen402(),
}))
vi.mock('@/lib/alipay-proxy', () => ({
  isAlipayRequest: H.alipayReq,
  isAlipayEnabled: H.alipayEnabled,
  validateAlipayPayment: H.alipayValidate,
  generateAlipay402Response: H.gen402,
}))
vi.mock('@/lib/kyapay-proxy', () => ({
  isKyaPayRequest: H.kyaReq,
  isKyaPayEnabled: H.kyaEnabled,
  validateKyaPayPayment: H.kyaValidate,
  generateKyaPay402Response: H.gen402,
}))
vi.mock('@/lib/emvco-proxy', () => ({
  isEmvcoRequest: H.emvcoReq,
  isEmvcoEnabled: H.emvcoEnabled,
  validateEmvcoPayment: H.emvcoValidate,
  generateEmvco402Response: H.gen402,
}))
vi.mock('@/lib/drain-proxy', () => ({
  isDrainRequest: H.drainReq,
  isDrainEnabled: H.drainEnabled,
  validateDrainPayment: H.drainValidate,
  generateDrain402Response: H.gen402,
}))

// Drive the REAL route entry (handleXxxProxy are route-private).
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

function makeReq(): NextRequest {
  return new Request('https://settlegrid.ai/api/proxy/demo', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-payment-detect': '1' },
    body: JSON.stringify({ hello: 'world' }),
  }) as unknown as NextRequest
}

function callPost(req: NextRequest) {
  return POST(req, { params: Promise.resolve({ slug: 'demo' }) })
}

function okJsonResponse(): Response {
  return new Response(JSON.stringify({ result: 'ok' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Re-establish default rail mocks each test (vi.clearAllMocks resets call history
 * but NOT prior `.mockReturnValue`s, so a per-test detect-true would otherwise leak
 * across tests). All detections OFF, all module-enables ON, all validators return a
 * generic `valid:true` (so a pre-gate RED run reaches forwardAndBill + credits).
 */
function resetRailMocks() {
  H.mppReq.mockReturnValue(false)
  H.x402Req.mockReturnValue(false)
  H.ap2Req.mockReturnValue(false)
  H.visaReq.mockReturnValue(false)
  H.acpReq.mockReturnValue(false)
  H.ucpReq.mockReturnValue(false)
  H.mcReq.mockReturnValue(false)
  H.cnReq.mockReturnValue(false)
  H.l402Req.mockReturnValue(false)
  H.alipayReq.mockReturnValue(false)
  H.kyaReq.mockReturnValue(false)
  H.emvcoReq.mockReturnValue(false)
  H.drainReq.mockReturnValue(false)
  H.ucpEnabled.mockReturnValue(true)
  H.mcEnabled.mockReturnValue(true)
  H.l402Enabled.mockReturnValue(true)
  H.alipayEnabled.mockReturnValue(true)
  H.kyaEnabled.mockReturnValue(true)
  H.emvcoEnabled.mockReturnValue(true)
  H.drainEnabled.mockReturnValue(true)
  H.ap2Validate.mockResolvedValue({ valid: true })
  H.visaValidate.mockResolvedValue({ valid: true })
  H.ucpValidate.mockResolvedValue({ valid: true })
  H.alipayValidate.mockResolvedValue({ valid: true })
  H.kyaValidate.mockResolvedValue({ valid: true })
  H.emvcoValidate.mockResolvedValue({ valid: true })
  H.drainValidate.mockResolvedValue({ valid: true })
  H.l402Validate.mockResolvedValue({ valid: true })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRailMocks()
  H.selectLimit.mockResolvedValue([TOOL_ROW])
  H.updateWhere.mockResolvedValue(undefined)
  H.insertValues.mockResolvedValue(undefined)
  H.txReturning.mockResolvedValue([{ id: 'x' }])
  // Legacy dispatch chain (skip the unified adapter path).
  vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
  // ── ROUTING vars SET for ALL 8 gated rails (the no-op-trap trip wire). A
  //    settlement predicate aliased to any of these would return true → RED. ──
  vi.stubEnv('AP2_SIGNING_SECRET', 'routing-secret')
  vi.stubEnv('UCP_API_KEY', 'routing-key')
  vi.stubEnv('DRAIN_ENABLED', 'true')
  vi.stubEnv('VISA_TAP_API_KEY', 'routing-key')
  vi.stubEnv('ALIPAY_APP_ID', 'routing-app-id')
  vi.stubEnv('KYAPAY_VERIFICATION_KEY', 'routing-key')
  vi.stubEnv('EMVCO_ENABLED', 'true')
  vi.stubEnv('L402_ENABLED', 'true')
  // NB: no *_SETTLEMENT_ENABLED stubbed → every settlement gate stays DARK.
  vi.stubGlobal('fetch', vi.fn(async () => okJsonResponse()))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

// Each dark rail: which detect knob to flip so the legacy chain routes to it.
const DARK_RAILS: Array<{ label: string; detect: () => void }> = [
  { label: 'AP2', detect: () => H.ap2Req.mockReturnValue(true) },
  { label: 'UCP', detect: () => H.ucpReq.mockReturnValue(true) },
  { label: 'DRAIN', detect: () => H.drainReq.mockReturnValue(true) },
  { label: 'Visa-TAP', detect: () => H.visaReq.mockReturnValue(true) },
  { label: 'Alipay', detect: () => H.alipayReq.mockReturnValue(true) },
  { label: 'KyaPay', detect: () => H.kyaReq.mockReturnValue(true) },
  { label: 'EMVCo', detect: () => H.emvcoReq.mockReturnValue(true) },
  { label: 'L402', detect: () => H.l402Req.mockReturnValue(true) },
]

describe('phantom-credit dark-gate — 8 no-money rails refuse-503 with routing SET / settlement UNSET', () => {
  for (const rail of DARK_RAILS) {
    it(`${rail.label}: valid detection → 503, NO credit (balanceCents delta 0), NO upstream forward`, async () => {
      rail.detect()
      const res = await callPost(makeReq())

      // (c) honest 503 — the settlement-not-configured refuse, not a 402/200.
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.code).toBe('SETTLEMENT_NOT_CONFIGURED')
      // (a) balanceCents delta == 0 — NO credit UPDATE (legacy or on-chain) issued.
      expect(H.dbUpdate).not.toHaveBeenCalled()
      expect(H.dbTransaction).not.toHaveBeenCalled()
      // (b) upstream NOT forwarded → a hard refuse, not skipCredit "free proxying".
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })
  }
})

describe('phantom-credit dark-gate — positive guards (no regression on real-money / always-503 rails)', () => {
  it('ACP (real Stripe money) still forwards + credits — NOT gated', async () => {
    vi.stubEnv('ACP_STRIPE_KEY', 'sk_test_acp') // isAcpEnabled routing gate
    H.acpReq.mockReturnValue(true)
    H.acpValidate.mockResolvedValue({
      valid: true,
      paymentIntentId: 'pi_1',
      checkoutSessionId: 'cs_1',
      customerId: 'cus_1',
    })
    const res = await callPost(makeReq())
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // forwarded
    expect(H.dbUpdate).toHaveBeenCalled() // legacy dev+tool credit issued
  })

  it('x402 (real on-chain money) still settles + credits — NOT gated', async () => {
    // x402 routing + settlement capability (real capability vars, unlike the 8).
    vi.stubEnv('SETTLEGRID_GAS_WALLET_KEY', '0x' + '1'.repeat(64))
    vi.stubEnv('SETTLEGRID_PAYMENT_ADDRESS', RECIPIENT)
    vi.stubEnv('SETTLEGRID_X402_ALLOW_TESTNET', '')
    H.x402Req.mockReturnValue(true)
    H.x402Validate.mockResolvedValue({
      valid: true,
      payerAddress: PAYER,
      network: 'eip155:8453',
      scheme: 'exact',
      amountUsdc: '500000',
    })
    H.extractX402PaymentHeader.mockReturnValue('header-value')
    H.parseX402ExactPayload.mockReturnValue({
      x402Version: 2,
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        signature: '0x' + 'ab'.repeat(65),
        authorization: {
          from: PAYER,
          to: RECIPIENT,
          value: '500000',
          validAfter: '0',
          validBefore: '9999999999',
          nonce: '0x' + 'cd'.repeat(32),
        },
      },
    })
    H.executeX402Settlement.mockResolvedValue({ status: 'settled', txHash: '0xTX', creditCents: 50 })
    const res = await callPost(makeReq())
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1) // forwarded
    expect(H.dbTransaction).toHaveBeenCalledTimes(1) // on-chain credit txn ran
    expect(H.executeX402Settlement).toHaveBeenCalledTimes(1)
  })

  it('Mastercard-VI still 503s via its OWN detection-stub path — never reaches our gate', async () => {
    H.mcReq.mockReturnValue(true)
    H.mcValidate.mockResolvedValue({ valid: false, error: { code: 'MC_NOT_YET_SUPPORTED' } })
    const res = await callPost(makeReq())
    expect(res.status).toBe(503)
    // It went through Mastercard's detection-stub, NOT our SETTLEMENT_NOT_CONFIGURED gate.
    expect(H.mcStub).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.code).not.toBe('SETTLEMENT_NOT_CONFIGURED')
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(H.dbUpdate).not.toHaveBeenCalled()
  })
})
