/**
 * UNMOCKED end-to-end smoke for the Circle Nano rail.
 *
 * Unlike route.test.ts (which mocks the verifier), this drives a REAL viem-
 * signed EIP-3009 proof through the REAL route → REAL circle-nano-proxy →
 * REAL parseCircleNanoProof → REAL verifyCircleNanoAuthorization (viem). The
 * only mocks are the unavoidable ones: the DB tool row, the recipient env, and
 * (for the kernel path) the fetch transport. The crypto, parsing, validation,
 * dispatch, and response formatting all run for real.
 *
 *   Level A — real route handlers + real verifier (positive, wrong-payee, settle)
 *   Level B — full kernel dispatch → real route handlers via a fetch shim
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { privateKeyToAccount } from 'viem/accounts'

const { mockDb, mockCheckRateLimit } = vi.hoisted(() => ({
  mockDb: { select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn() },
  mockCheckRateLimit: vi.fn(),
}))

const RECIPIENT = '0x1111111111111111111111111111111111111111'

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: { name: 'name', slug: 'slug', status: 'status', pricingConfig: 'pricing_config' },
}))
vi.mock('@/lib/rate-limit', () => ({ apiLimiter: {}, checkRateLimit: mockCheckRateLimit, getClientIp: (h: Headers) => h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip')?.trim() || 'unknown-ip' }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn((a: unknown, b: unknown) => ({ a, b })) }))
// Mock ONLY env (recipient + enablement + appUrl). The verifier + proxy are REAL.
vi.mock('@/lib/env', () => ({
  isCircleNanoKernelEnabled: () => true,
  getCircleNanoRecipient: () => RECIPIENT,
  getAppUrl: () => 'http://localhost:3005',
}))

import { POST as verifyPOST } from '@/app/api/circle-nano/verify/route'
import { POST as settlePOST } from '@/app/api/circle-nano/settle/route'
import { createDispatchKernel, settlegrid } from '@settlegrid/mcp'

// ── a real EIP-3009 signature (Base mainnet USDC domain) ─────────────────────
const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
} as const
const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

async function signedProofBlob(to = RECIPIENT, value = '10000'): Promise<string> {
  const authorization = {
    from: account.address,
    to,
    value,
    validAfter: '0',
    // Real route → real verifier uses the real Date.now() clock (no injected now),
    // so use a within-cap window relative to it (now + 300s, well under the 3600s
    // V-N1 cap). A fixed far-future literal would now reject as VALIDBEFORE_TOO_FAR.
    validBefore: String(Math.floor(Date.now() / 1000) + 300),
    nonce: `0x${'33'.repeat(32)}`,
  }
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce as `0x${string}`,
    },
  })
  // The wire format the adapter/route expect: base64(JSON) envelope.
  return Buffer.from(
    JSON.stringify({ network: 'eip155:8453', authorization, signature }),
  ).toString('base64')
}

function setTool() {
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.limit.mockResolvedValue([
    { name: 'Demo', slug: 'demo', status: 'active', pricingConfig: { defaultCostCents: 1 } },
  ]) // 1¢ = 10000 base units; the proof authorizes exactly 10000
}

function envelope(proof: string) {
  return {
    toolSlug: 'demo',
    method: 'demo.invocation',
    paymentContext: { protocol: 'circle-nano', payment: { type: 'nanopayment', proof } },
  }
}

function makeReq(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3005${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 1000, remaining: 999, reset: 0 })
  setTool()
})

describe('Level A — real route + real verifier (no verifier mock)', () => {
  it('verify accepts a genuinely-signed proof end-to-end', async () => {
    const proof = await signedProofBlob()
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', envelope(proof)))
    expect(res.status).toBe(200)
    expect((await res.json()).valid).toBe(true)
  })

  it('verify REJECTS a valid signature that pays a third party (real payee check)', async () => {
    const proof = await signedProofBlob('0x2222222222222222222222222222222222222222')
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', envelope(proof)))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('CIRCLE_NANO_WRONG_RECIPIENT')
  })

  it('settle returns a real SettlementResult for a genuinely-signed proof', async () => {
    // The mocked tool row has no developerId, so settle takes the free/
    // unattributed path: real verifier passes, then settled with NO on-chain
    // submit (no gas wallet / network needed here). The REAL on-chain settlement
    // path is exercised in lib/settlement/circle-nano/__tests__/settle*.test.ts.
    const proof = await signedProofBlob()
    const res = await settlePOST(
      makeReq('/api/circle-nano/settle', { ...envelope(proof), latencyMs: 7 }),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('settled')
    expect(json.metadata.protocol).toBe('circle-nano')
    expect(json.metadata.settlementType).toBe('real-time')
    expect(json.txHash).toBeUndefined()
  })

  // Enforce-exact (parity with x402): circle-nano now requires value === cost.
  // An over-authorized proof (value > required) was previously TOLERATED and
  // over-collected the payer (the full value moves on-chain; the dev is credited
  // only cost; the excess was silently retained). It is now rejected at the shared
  // verify gate (validateCircleNanoCredentialString → verifyEip3009Authorization
  // exactAmount:true), which gates BOTH the kernel /verify + /settle routes AND the
  // direct proxy. These two cases drive the REAL verifier (no mock) — the A1 lesson.
  it('verify REJECTS an over-authorized proof (enforce-exact: value > cost)', async () => {
    // cost 1¢ = 10000 base units required; this proof authorizes 20000 (2¢).
    const proof = await signedProofBlob(RECIPIENT, '20000')
    const res = await verifyPOST(makeReq('/api/circle-nano/verify', envelope(proof)))
    expect(res.status).toBe(200) // /verify returns its verdict at HTTP 200
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.code).toBe('CIRCLE_NANO_AMOUNT_MISMATCH')
  })

  it('settle REJECTS an over-authorized proof (enforce-exact, 402) before any on-chain submit', async () => {
    // The settle route re-verifies through the SAME gate, so an over-auth 402s
    // BEFORE reaching executeCircleNanoSettlement — no bypass, no over-collection.
    const proof = await signedProofBlob(RECIPIENT, '20000')
    const res = await settlePOST(
      makeReq('/api/circle-nano/settle', { ...envelope(proof), latencyMs: 7 }),
    )
    expect(res.status).toBe(402)
    expect((await res.json()).code).toBe('CIRCLE_NANO_AMOUNT_MISMATCH')
  })
})

describe('Level B — full kernel dispatch → real route handlers (fetch shim, real verifier)', () => {
  it('kernel detect → verify → handler → settle → 200, all real except DB + transport', async () => {
    const proofBlob = await signedProofBlob()

    // Shim the kernel's outbound fetch to call the REAL route handlers.
    const fetchShim = vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace('http://kernel.test', '')
      const req = makeReqRaw(url, init)
      if (path.endsWith('/api/circle-nano/verify')) return verifyPOST(req)
      if (path.endsWith('/api/circle-nano/settle')) return settlePOST(req)
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchShim)

    try {
      const sg = settlegrid.init({
        toolSlug: 'demo',
        pricing: { defaultCostCents: 1 },
        toolSecret: 'tool_secret_cnano',
        apiUrl: 'http://kernel.test',
      })
      const kernel = createDispatchKernel(sg)

      const req = new Request('http://localhost/api/tool/run', {
        method: 'POST',
        headers: {
          'x-settlegrid-protocol': 'circle-nano',
          'x-circle-nano-auth': proofBlob,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ method: 'demo.invocation' }),
      })
      const handler = vi.fn().mockResolvedValue({ ok: true })
      const response = await kernel.handle(req, handler)

      expect(response.status).toBe(200)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(response.headers.get('X-SettleGrid-Protocol')).toBe('circle-nano')
      // verify + settle each hit the real handler once.
      const calls = fetchShim.mock.calls.map((c) => String(c[0]))
      expect(calls.some((u) => u.endsWith('/api/circle-nano/verify'))).toBe(true)
      expect(calls.some((u) => u.endsWith('/api/circle-nano/settle'))).toBe(true)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

// NextRequest from the kernel's (url, init) — preserves method/headers/body.
function makeReqRaw(url: string, init: RequestInit): NextRequest {
  return new NextRequest(url, {
    method: init.method ?? 'POST',
    headers: (init.headers as Record<string, string>) ?? {},
    body: init.body as string,
  })
}
