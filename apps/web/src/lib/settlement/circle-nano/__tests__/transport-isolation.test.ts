/**
 * (U) — LB-1 transport-isolation pins.
 *
 * publicClientFor serves BOTH live settle paths (x402 + circle-nano ride this engine with the
 * buyer on the line) while confirmSettlementTx (reconciler-only) uses the bounded twin. This
 * suite spies viem's `http` itself and pins the CALL SHAPES:
 *   - every live-path transport build passes NO options (viem defaults — 10s × 3 retries is
 *     deliberate there); this test FAILS if the live transport options ever drift;
 *   - the reconciler's confirm path passes exactly { timeout: RECONCILER_RPC_TIMEOUT_MS,
 *     retryCount: RECONCILER_RPC_RETRY_COUNT } — value-pinned to 3_000 / 1 so a silent constant
 *     edit is loud (the worst-case arithmetic 6.15s/call · 12.3s/row vs the 20s tail depends on
 *     these exact numbers; empirical grounding in .audit/u-build/probe-timeout-arithmetic.txt).
 *
 * The factory spreads importOriginal (sibling parity with settle-engine.test.ts) and the client
 * factories return stubs, so the entry points run their REAL code paths up to the asserts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockHttp, mockCreatePublicClient, mockCreateWalletClient, mockReadContract, mockWaitForReceipt, mockWriteContract, mockGetReceipt } = vi.hoisted(() => {
  const mockReadContract = vi.fn()
  const mockWaitForReceipt = vi.fn()
  const mockWriteContract = vi.fn()
  const mockGetReceipt = vi.fn()
  return {
    mockHttp: vi.fn(),
    // (②-fix) the client factories CAPTURE their config too: a live-path drift
    // injected at the CLIENT level (pollingInterval / cacheTime / batch) never
    // touches http()'s args — the key-set pins below make it loud. The typed
    // config param is load-bearing: a zero-arg vi.fn() infers Parameters<[]>
    // and bricks the mock.calls[0][0] key-set asserts under tsc.
    mockCreatePublicClient: vi.fn((_config: Record<string, unknown>) => ({
      readContract: mockReadContract,
      waitForTransactionReceipt: mockWaitForReceipt,
      getTransactionReceipt: mockGetReceipt,
    })),
    mockCreateWalletClient: vi.fn((_config: Record<string, unknown>) => ({ writeContract: mockWriteContract })),
    mockReadContract,
    mockWaitForReceipt,
    mockWriteContract,
    mockGetReceipt,
  }
})

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    http: mockHttp,
    createPublicClient: mockCreatePublicClient,
    createWalletClient: mockCreateWalletClient,
  }
})
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: () => ({ address: '0xGA50000000000000000000000000000000000001' }),
}))

import {
  submitCircleNanoOnChain,
  confirmCircleNanoTx,
  confirmSettlementTx,
  RECONCILER_RPC_TIMEOUT_MS,
  RECONCILER_RPC_RETRY_COUNT,
} from '../settle-engine'
import type { CircleNanoProof } from '@settlegrid/mcp'

const RPC_URL = 'https://rpc.test'
const TXH = ('0x' + 'ab'.repeat(32)) as `0x${string}`
const FROM = '0xAbCdEf0000000000000000000000000000000001' as `0x${string}`
const NONCE = ('0x' + 'cd'.repeat(32)) as `0x${string}`

const PROOF: CircleNanoProof = {
  network: 'eip155:84532',
  authorization: {
    from: FROM,
    to: '0xReCiPiEnT000000000000000000000000000000002',
    value: '500000',
    validAfter: '0',
    validBefore: '9999999999',
    nonce: NONCE,
  },
  signature: '0x' + 'ab'.repeat(65),
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SETTLEGRID_GAS_WALLET_KEY = '0x' + '01'.repeat(32)
  process.env.SETTLEGRID_BASE_SEPOLIA_RPC_URL = RPC_URL
  mockReadContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === 'authorizationState') return false
    if (functionName === 'balanceOf') return 10n ** 12n
    throw new Error(`unexpected readContract: ${functionName}`)
  })
  mockWriteContract.mockResolvedValue('0xTX')
  mockWaitForReceipt.mockResolvedValue({ status: 'success' })
  mockGetReceipt.mockResolvedValue({ status: 'success' })
})

describe('(U) transport isolation — live paths byte-identical, reconciler bounded', () => {
  it('LIVE submit path (both rails ride it): every http() build is OPTION-FREE — viem defaults', async () => {
    const r = await submitCircleNanoOnChain(PROOF)
    expect(r).toEqual({ kind: 'settled', txHash: '0xTX' })
    // public client (guards + receipt wait) AND wallet client (submit) — both transports built.
    expect(mockHttp.mock.calls.length).toBeGreaterThanOrEqual(2)
    for (const call of mockHttp.mock.calls) {
      expect(call[0]).toBe(RPC_URL)
      expect(call.length).toBe(1) // NO options arg — fails if live transport options ever drift
    }
    // (②-fix) client-level key-set pins: drift injected at createPublicClient /
    // createWalletClient (pollingInterval / cacheTime / batch) never touches
    // http()'s args — pin the exact config keys instead.
    expect(mockCreatePublicClient).toHaveBeenCalledTimes(1)
    expect(Object.keys(mockCreatePublicClient.mock.calls[0][0]).sort()).toEqual(['chain', 'transport'])
    expect(mockCreateWalletClient).toHaveBeenCalledTimes(1)
    expect(Object.keys(mockCreateWalletClient.mock.calls[0][0]).sort()).toEqual(['account', 'chain', 'transport'])
  })

  it('LIVE re-wait path (confirmCircleNanoTx): option-free http()', async () => {
    const r = await confirmCircleNanoTx(PROOF, TXH)
    expect(r).toEqual({ kind: 'settled', txHash: TXH })
    expect(mockHttp).toHaveBeenCalledTimes(1)
    expect(mockHttp.mock.calls[0][0]).toBe(RPC_URL)
    expect(mockHttp.mock.calls[0].length).toBe(1)
    expect(Object.keys(mockCreatePublicClient.mock.calls[0][0]).sort()).toEqual(['chain', 'transport'])
  })

  it('RECONCILER confirm path: http() carries exactly the bounded options, value-pinned 3_000/1', async () => {
    // Value pins first: the budget arithmetic (6.15s/call · 12.3s/row vs the 20s tail) depends on
    // these exact numbers — a silent constant edit must be loud.
    expect(RECONCILER_RPC_TIMEOUT_MS).toBe(3_000)
    expect(RECONCILER_RPC_RETRY_COUNT).toBe(1)
    const r = await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })
    expect(r).toEqual({ kind: 'settled', txHash: TXH })
    expect(mockHttp).toHaveBeenCalledTimes(1)
    expect(mockHttp.mock.calls[0][0]).toBe(RPC_URL)
    expect(mockHttp.mock.calls[0][1]).toEqual({
      timeout: RECONCILER_RPC_TIMEOUT_MS,
      retryCount: RECONCILER_RPC_RETRY_COUNT,
    })
    // (②-fix) the bounded twin builds its client with the same two keys — no
    // client-level options on either factory.
    expect(Object.keys(mockCreatePublicClient.mock.calls[0][0]).sort()).toEqual(['chain', 'transport'])
  })

  it('seam separation in one pass: live calls stay option-free while the reconciler call is bounded', async () => {
    await submitCircleNanoOnChain(PROOF)
    const liveCalls = mockHttp.mock.calls.length
    expect(liveCalls).toBeGreaterThanOrEqual(2)
    await confirmSettlementTx('eip155:84532', TXH, { from: FROM, nonce: NONCE })
    expect(mockHttp.mock.calls.length).toBe(liveCalls + 1)
    for (const call of mockHttp.mock.calls.slice(0, liveCalls)) {
      expect(call.length).toBe(1) // additive, not shared: the live shape is untouched
    }
    const reconcilerCall = mockHttp.mock.calls[liveCalls]
    expect(reconcilerCall[1]).toEqual({
      timeout: RECONCILER_RPC_TIMEOUT_MS,
      retryCount: RECONCILER_RPC_RETRY_COUNT,
    })
  })
})
