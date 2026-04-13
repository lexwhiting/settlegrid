/**
 * Kernel demo — E2E client test.
 *
 * Uses Hono's `app.request()` to exercise the server in-process (no
 * TCP listener required). Global `fetch` is mocked so the kernel's
 * SDK calls (/api/sdk/validate-key, /api/sdk/meter) and facilitator
 * calls (/api/x402/verify, /api/x402/settle) return canned success
 * responses without a real SettleGrid backend.
 *
 * The test verifies the three core kernel paths:
 *   1. No payment  → 402 multi-protocol manifest (3 accepts entries)
 *   2. sg-balance   → 200 with billing metadata (operationId, cost)
 *   3. x402         → 200 with settlement (operationId, txHash)
 *
 * Exit 0 on success, exit 1 on any assertion failure.
 *
 * Run:  npx tsx client-test.ts   OR   npm test
 */

// ─── Mock fetch BEFORE importing the server ──────────────────────────────
//
// The server module initializes settlegrid.init() at import time, which
// does NOT make any HTTP calls — but the kernel's handle() does. We mock
// fetch here so every call the kernel makes during the tests below gets
// a canned response. The mock is installed BEFORE the server import so
// the module-level protocolRegistry auto-registration (which is
// synchronous and does not call fetch) is unaffected.

const originalFetch = globalThis.fetch

globalThis.fetch = async (
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url

  // SDK validate-key endpoint
  if (url.includes('/api/sdk/validate-key')) {
    return new Response(
      JSON.stringify({
        valid: true,
        consumerId: 'demo-consumer',
        toolId: 'demo-tool',
        keyId: 'demo-key',
        balanceCents: 100_000,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // SDK meter endpoint
  if (url.includes('/api/sdk/meter')) {
    return new Response(
      JSON.stringify({
        success: true,
        remainingBalanceCents: 99_995,
        costCents: 5,
        invocationId: 'demo-inv-001',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // x402 facilitator verify
  if (url.includes('/api/x402/verify')) {
    return new Response(
      JSON.stringify({ valid: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // x402 facilitator settle
  if (url.includes('/api/x402/settle')) {
    return new Response(
      JSON.stringify({
        status: 'settled',
        operationId: 'demo-op-x402',
        costCents: 5,
        txHash: '0xdemo',
        metadata: {
          protocol: 'x402',
          latencyMs: 10,
          settlementType: 'real-time',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Unmocked URL — fall through to real fetch
  return originalFetch(input, init)
}

// ─── Now import the server (fetch is already mocked) ─────────────────────

import { app } from './server.js'

// ─── Helpers ─────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
}

function makeX402PaymentSignature(): string {
  return Buffer.from(
    JSON.stringify({
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        authorization: {
          from: '0x1234567890abcdef1234567890abcdef12345678',
        },
      },
    }),
  ).toString('base64')
}

// ─── Test runner ─────────────────────────────────────────────────────────

async function run(): Promise<void> {
  console.log('═══ SettleGrid Kernel E2E Demo ═══\n')

  // ─── Test 1: No payment → 402 ──────────────────────────────────────

  console.log('Test 1: POST /search without payment headers → 402')
  const res1 = await app.request('/search', { method: 'POST' })
  assert(res1.status === 402, `Expected 402, got ${res1.status}`)

  const body1 = (await res1.json()) as {
    x402Version: number
    error: string
    accepts: Array<{ scheme: string }>
  }
  assert(body1.x402Version === 2, 'x402Version should be 2')
  assert(body1.error === 'payment_required', 'error should be payment_required')
  assert(Array.isArray(body1.accepts), 'accepts should be an array')
  assert(
    body1.accepts.length === 3,
    `accepts should have 3 entries, got ${body1.accepts.length}`,
  )
  const schemes = body1.accepts.map((a) => a.scheme).join(', ')
  console.log('  ✓ Got 402 with multi-protocol manifest')
  console.log(`  ✓ Accepts: ${schemes}`)

  // ─── Test 2: sg-balance → 200 ─────────────────────────────────────

  console.log('\nTest 2: POST /search with x-api-key → 200 (sg-balance)')
  const res2 = await app.request('/search', {
    method: 'POST',
    headers: { 'x-api-key': 'sg_live_demo_key' },
  })
  assert(res2.status === 200, `Expected 200, got ${res2.status}`)

  const body2 = (await res2.json()) as { operationId: string }
  assert(
    body2.operationId === 'demo-inv-001',
    'Should have operationId from meter',
  )
  const costHeader = res2.headers.get('X-SettleGrid-Cost-Cents')
  console.log('  ✓ Got 200 with billing metadata')
  console.log(`  ✓ Operation ID: ${body2.operationId}`)
  console.log(`  ✓ Cost: ${costHeader} cents`)

  // ─── Test 3: x402 → 200 ───────────────────────────────────────────

  console.log('\nTest 3: POST /search with payment-signature → 200 (x402)')
  const res3 = await app.request('/search', {
    method: 'POST',
    headers: { 'payment-signature': makeX402PaymentSignature() },
  })
  assert(res3.status === 200, `Expected 200, got ${res3.status}`)

  const body3 = (await res3.json()) as {
    operationId: string
    txHash: string
  }
  assert(
    body3.operationId === 'demo-op-x402',
    'Should have x402 operationId from settle',
  )
  console.log('  ✓ Got 200 with x402 settlement')
  console.log(`  ✓ Tx hash: ${body3.txHash}`)

  // ─── Done ──────────────────────────────────────────────────────────

  console.log('\n═══ All 3 E2E tests passed ═══')
}

run()
  .catch((err: Error) => {
    console.error('\n✗ E2E test failed:', err.message)
    process.exit(1)
  })
  .finally(() => {
    globalThis.fetch = originalFetch
  })
