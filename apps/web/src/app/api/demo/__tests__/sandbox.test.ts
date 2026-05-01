/**
 * P4.K1 — tests for the sandbox catch-all (/api/demo/sandbox/[...path]).
 *
 * The sandbox is the kernel's outbound destination in the demo. Each
 * test invokes the route handler directly with a constructed Request
 * and asserts the JSON shape the kernel expects (validateKey,
 * SettlementResult, etc.).
 *
 * Hostile-review F-test: also asserts the file imports nothing from
 * production payment paths (db, stripe, settlement, fraud).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { POST } from '@/app/api/demo/sandbox/[...path]/route'
import { DEMO_TOOL_SECRET } from '@/lib/demo-kernel-config'

function makeContext(path: string[]): {
  params: Promise<{ path: string[] }>
} {
  return { params: Promise.resolve({ path }) }
}

function makeReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3005/api/demo/sandbox/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

describe('sandbox /api/sdk/validate-key', () => {
  it('returns valid=true with deterministic ids for a non-empty key', async () => {
    const res = await POST(
      makeReq({ apiKey: 'sk_test_demo' }),
      makeContext(['api', 'sdk', 'validate-key']),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(true)
    expect(json.consumerId).toBe('demo-consumer-id')
    expect(json.toolId).toBe('demo-tool-id')
    expect(json.keyId).toBe('demo-key-id')
    expect(typeof json.balanceCents).toBe('number')
    expect(json.balanceCents).toBeGreaterThan(0)
  })

  it('returns valid=false for an empty key (so the kernel InvalidKeyError path can be exercised)', async () => {
    const res = await POST(
      makeReq({ apiKey: '' }),
      makeContext(['api', 'sdk', 'validate-key']),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.valid).toBe(false)
    expect(json.balanceCents).toBe(0)
  })
})

describe('sandbox /api/sdk/meter', () => {
  it('returns success=true with an invocationId and remainingBalance', async () => {
    const res = await POST(
      makeReq({ method: 'demo.invocation' }),
      makeContext(['api', 'sdk', 'meter']),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(typeof json.invocationId).toBe('string')
    expect(json.invocationId).toMatch(/^demo-inv-/)
    expect(json.costCents).toBe(5)
    expect(json.remainingBalanceCents).toBe(99_995)
  })
})

describe('sandbox /api/x402/verify and /api/mpp/verify', () => {
  it.each(['x402', 'mpp'])(
    '%s verify returns valid=true when toolSecret matches',
    async (protocol) => {
      const res = await POST(
        makeReq(
          { toolSlug: 'demo-sandbox-tool' },
          { authorization: `Bearer ${DEMO_TOOL_SECRET}` },
        ),
        makeContext(['api', protocol, 'verify']),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.valid).toBe(true)
    },
  )

  it.each(['x402', 'mpp'])(
    '%s verify returns 401 when toolSecret is missing',
    async (protocol) => {
      const res = await POST(
        makeReq({}),
        makeContext(['api', protocol, 'verify']),
      )
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.code).toBe('SANDBOX_AUTH')
    },
  )

  it.each(['x402', 'mpp'])(
    '%s verify returns 401 when Authorization header is the wrong secret',
    async (protocol) => {
      const res = await POST(
        makeReq({}, { authorization: 'Bearer not-the-real-secret' }),
        makeContext(['api', protocol, 'verify']),
      )
      expect(res.status).toBe(401)
    },
  )
})

describe('sandbox /api/x402/settle and /api/mpp/settle', () => {
  it.each(['x402', 'mpp'])(
    '%s settle returns a SettlementResult with the right metadata.protocol',
    async (protocol) => {
      const res = await POST(
        makeReq(
          { method: 'demo.invocation' },
          { authorization: `Bearer ${DEMO_TOOL_SECRET}` },
        ),
        makeContext(['api', protocol, 'settle']),
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.status).toBe('settled')
      expect(typeof json.operationId).toBe('string')
      expect(json.operationId).toMatch(/^demo-op-/)
      expect(json.costCents).toBe(5)
      expect(json.metadata.protocol).toBe(protocol)
      expect(json.metadata.settlementType).toBe('real-time')
      expect(json.metadata.toolSlug).toBe('demo-sandbox-tool')
    },
  )

  it('rejects settle without auth (401)', async () => {
    const res = await POST(
      makeReq({}),
      makeContext(['api', 'x402', 'settle']),
    )
    expect(res.status).toBe(401)
  })
})

describe('sandbox unknown path', () => {
  it('returns 404 with the list of known routes', async () => {
    const res = await POST(
      makeReq({}),
      makeContext(['api', 'made-up', 'route']),
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('unknown-sandbox-path')
    expect(json.received).toBe('/api/made-up/route')
    expect(Array.isArray(json.knownRoutes)).toBe(true)
  })
})

describe('hostile-review: sandbox file imports nothing from payment infrastructure', () => {
  // A regression guard. If a future commit accidentally imports the
  // production db, stripe, or settlement modules into the sandbox
  // route, this assertion fails immediately. The demo's whole safety
  // story hinges on this isolation.
  const sandboxSrc = readFileSync(
    resolve(__dirname, '../sandbox/[...path]/route.ts'),
    'utf8',
  )
  const FORBIDDEN = [
    "from '@/lib/db'",
    'from "@/lib/db"',
    "from '@/lib/db/",
    "from '@/lib/stripe'",
    "from '@/lib/settlement",
    "from '@/lib/fraud'",
    "from '@/lib/audit'",
    "from 'stripe'",
    "from '@stripe",
  ]
  it.each(FORBIDDEN)('does not import %s', (forbidden) => {
    expect(sandboxSrc.includes(forbidden)).toBe(false)
  })
})
