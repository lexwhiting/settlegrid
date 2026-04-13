/**
 * Tests for buildMultiProtocol402 (P1.K3).
 *
 * The spec's DoD lists four required test cases:
 *   - sg-balance only manifest
 *   - sg-balance + x402 manifest
 *   - sg-balance + x402 + mpp manifest
 *   - empty acceptedProtocols (error)
 *
 * Plus header-level assertions and body shape assertions that the
 * response matches settlement-layer-architecture.md §4.
 */
import { describe, it, expect } from 'vitest'
import { protocolRegistry } from '../adapters'
import type { ProtocolAdapter } from '../adapters/types'
import {
  buildMultiProtocol402,
  type PaymentRequiredBody,
  type BuildChallengeOptions,
  type AcceptEntry,
} from '../402-builder'
import type { PricingConfig } from '../types'

const BASE_RESOURCE = {
  url: 'https://tool.example/api/search',
  description: 'Full-text search over product catalog',
} as const

const BASE_PRICING: PricingConfig = {
  defaultCostCents: 5,
  methods: {
    search: { costCents: 5 },
    'deep-search': { costCents: 25 },
  },
}

async function readBody(response: Response): Promise<PaymentRequiredBody> {
  return (await response.json()) as PaymentRequiredBody
}

describe('buildMultiProtocol402', () => {
  // ─── sg-balance only manifest ─────────────────────────────────────────

  describe('sg-balance only manifest', () => {
    it('returns a 402 Response with a single sg-balance accept entry', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp'],
        pricing: BASE_PRICING,
      })

      expect(response.status).toBe(402)
      const body = await readBody(response)
      expect(body.x402Version).toBe(2)
      expect(body.error).toBe('payment_required')
      expect(body.resource).toEqual({
        url: BASE_RESOURCE.url,
        description: BASE_RESOURCE.description,
      })
      expect(body.accepts).toHaveLength(1)
      expect(body.accepts[0]).toEqual({
        scheme: 'sg-balance',
        provider: 'settlegrid',
        costCents: 5,
        topUpUrl: 'https://settlegrid.ai/top-up',
      })
    })

    it('sg-balance entry uses method-specific pricing when method is provided', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp'],
        pricing: BASE_PRICING,
        method: 'deep-search', // 25 cents instead of default 5
      })
      const body = await readBody(response)
      expect(body.accepts[0]).toMatchObject({
        scheme: 'sg-balance',
        costCents: 25,
      })
    })

    it('sets Content-Type, WWW-Authenticate, and X-SettleGrid-Protocol-Negotiation headers', () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp'],
        pricing: BASE_PRICING,
      })
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Payment realm="settlegrid", scheme="sg-balance"',
      )
      expect(response.headers.get('X-SettleGrid-Protocol-Negotiation')).toBe('v1')
    })
  })

  // ─── sg-balance + x402 manifest ───────────────────────────────────────

  describe('sg-balance + x402 manifest', () => {
    it('returns a 402 Response with both rails in declaration order', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp', 'x402'],
        pricing: BASE_PRICING,
      })

      expect(response.status).toBe(402)
      const body = await readBody(response)
      expect(body.accepts).toHaveLength(2)

      // Order matches the order of acceptedProtocols
      expect(body.accepts[0].scheme).toBe('sg-balance')
      expect(body.accepts[1].scheme).toBe('exact')
    })

    it('x402 entry includes network, amount, asset, payTo, and maxTimeoutSeconds fields', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['x402'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.accepts[0]).toMatchObject({
        scheme: 'exact',
        network: 'eip155:8453',
        asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        payTo: '0x0000000000000000000000000000000000000000',
        maxTimeoutSeconds: 300,
      })
      // amount is costCents * 10_000 (USDC 6-decimal base units)
      // 5 cents → 50000 base units → '50000'
      expect(body.accepts[0].amount).toBe('50000')
    })

    it('x402 amount is a string (not number) for bigint safety', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['x402'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      // amount is always a string because bigint JSON serialization
      // requires explicit conversion — numbers would overflow for
      // high-cost calls. 50000 base units is trivially small but the
      // type contract is string-only.
      expect(typeof body.accepts[0].amount).toBe('string')
    })

    it('WWW-Authenticate header lists both schemes comma-separated', () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp', 'x402'],
        pricing: BASE_PRICING,
      })
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Payment realm="settlegrid", scheme="sg-balance, exact"',
      )
    })
  })

  // ─── sg-balance + x402 + mpp manifest ─────────────────────────────────

  describe('sg-balance + x402 + mpp manifest', () => {
    it('returns a 402 Response with all three rails', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp', 'x402', 'mpp'],
        pricing: BASE_PRICING,
      })

      expect(response.status).toBe(402)
      const body = await readBody(response)
      expect(body.accepts).toHaveLength(3)

      const schemes = body.accepts.map((entry) => entry.scheme)
      expect(schemes).toEqual(['sg-balance', 'exact', 'mpp'])
    })

    it('mpp entry includes provider, amountCents, and currency', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mpp'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.accepts[0]).toEqual({
        scheme: 'mpp',
        provider: 'stripe',
        amountCents: 5,
        currency: 'USD',
      })
    })

    it('WWW-Authenticate header lists all three schemes', () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mcp', 'x402', 'mpp'],
        pricing: BASE_PRICING,
      })
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Payment realm="settlegrid", scheme="sg-balance, exact, mpp"',
      )
    })

    it('resource.description and resource.mimeType are included when provided', async () => {
      const response = buildMultiProtocol402({
        resource: {
          url: 'https://tool.example/api/search',
          description: 'Search API',
          mimeType: 'application/json',
        },
        acceptedProtocols: ['mcp'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.resource).toEqual({
        url: 'https://tool.example/api/search',
        description: 'Search API',
        mimeType: 'application/json',
      })
    })

    it('resource.description and resource.mimeType are omitted when undefined', async () => {
      const response = buildMultiProtocol402({
        resource: { url: 'https://tool.example/api/search' },
        acceptedProtocols: ['mcp'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.resource).toEqual({ url: 'https://tool.example/api/search' })
      // Neither field should exist at all in the serialized JSON so
      // that strict clients don't see `"description": undefined`
      expect('description' in body.resource).toBe(false)
      expect('mimeType' in body.resource).toBe(false)
    })
  })

  // ─── Empty acceptedProtocols (error) ──────────────────────────────────

  describe('empty acceptedProtocols error', () => {
    it('throws when acceptedProtocols is an empty array', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: [],
          pricing: BASE_PRICING,
        }),
      ).toThrow(/non-empty array/)
    })

    it('throws when acceptedProtocols is not an array at all', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          acceptedProtocols: undefined as any,
          pricing: BASE_PRICING,
        }),
      ).toThrow(/non-empty array/)
    })
  })

  // ─── Hostile-review regression coverage ──────────────────────────────
  //
  // Each test below maps to a specific finding in the P1.K3 hostile
  // review. The tests are grouped by finding label so a future refactor
  // that regresses any of them is traceable to the original bug.

  describe('hostile-review regression coverage', () => {
    // ─── H1/H2/M1: upfront input validation ──────────────────────────

    it('H1: throws TypeError when options is null', () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildMultiProtocol402(null as any),
      ).toThrow(TypeError)
    })

    it('H1: throws TypeError when options is undefined', () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildMultiProtocol402(undefined as any),
      ).toThrow(TypeError)
    })

    it('H1: throws TypeError when options is a primitive', () => {
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildMultiProtocol402(42 as any),
      ).toThrow(/must be a non-null object/)
    })

    it('H2: throws TypeError when resource is missing', () => {
      expect(() =>
        buildMultiProtocol402({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resource: null as any,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        }),
      ).toThrow(/options\.resource/)
    })

    it('H2: throws TypeError when resource is an array', () => {
      expect(() =>
        buildMultiProtocol402({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resource: [] as any,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        }),
      ).toThrow(/options\.resource/)
    })

    it('M1: throws TypeError when resource.url is empty string', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: { url: '' },
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        }),
      ).toThrow(/non-empty string/)
    })

    it('M1: throws TypeError when resource.url is a number', () => {
      expect(() =>
        buildMultiProtocol402({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resource: { url: 42 as any },
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        }),
      ).toThrow(/non-empty string/)
    })

    // ─── H5: pricing validation ──────────────────────────────────────

    it('H5: throws TypeError when pricing is null', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pricing: null as any,
        }),
      ).toThrow(/pricing/)
    })

    it('H5: throws TypeError when pricing has a negative defaultCostCents', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pricing: { defaultCostCents: -5 } as any,
        }),
      ).toThrow(/pricing/)
    })

    it('H5: throws TypeError when pricing has an unknown model', () => {
      expect(() =>
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pricing: { model: 'per-gigabyte', defaultCostCents: 1 } as any,
        }),
      ).toThrow(/pricing/)
    })

    // ─── H3: WWW-Authenticate header injection prevention ───────────

    it('H3: rejects an adapter-returned scheme with special characters', () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      expect(mcpAdapter).toBeDefined()
      // Swap the MCP adapter's buildChallenge to return a scheme that
      // would inject header attributes if the builder interpolated
      // it without sanitization.
      const original = mcpAdapter!.buildChallenge
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => ({
        scheme: 'evil", extra="injected',
        provider: 'settlegrid',
        costCents: 5,
      })
      try {
        expect(() =>
          buildMultiProtocol402({
            resource: BASE_RESOURCE,
            acceptedProtocols: ['mcp'],
            pricing: BASE_PRICING,
          }),
        ).toThrow(/scheme/)
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    it('H3: rejects an adapter-returned scheme with CRLF', () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => ({
        scheme: 'ok\r\nX-Evil: yes',
        costCents: 5,
      })
      try {
        expect(() =>
          buildMultiProtocol402({
            resource: BASE_RESOURCE,
            acceptedProtocols: ['mcp'],
            pricing: BASE_PRICING,
          }),
        ).toThrow(/scheme/)
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    it('H3: accepts well-formed schemes with alphanumerics, dots, hyphens, underscores', () => {
      // Built-in schemes already pass (sg-balance, exact, mpp) — this
      // test double-checks the pattern allows the full set of safe
      // characters so a future scheme name like `circle_nano-v2.1`
      // would still be accepted.
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => ({
        scheme: 'sg-balance_v2.1',
        costCents: 5,
      })
      try {
        expect(() =>
          buildMultiProtocol402({
            resource: BASE_RESOURCE,
            acceptedProtocols: ['mcp'],
            pricing: BASE_PRICING,
          }),
        ).not.toThrow()
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    // ─── H4: adapter return-value validation ────────────────────────

    it('H4: adapter returning null falls back to inline entry', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => null as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        expect(response.status).toBe(402)
        const body = await readBody(response)
        // Fallback entry uses scheme=protocol name and minimum fields
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    it('H4: adapter returning an array falls back to inline entry', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => [] as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    it('H4: adapter returning an object without scheme falls back to inline entry', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry =>
        ({ foo: 'bar' }) as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    it('H4: adapter with scheme field that is not a string falls back to inline entry', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry =>
        ({ scheme: 42 }) as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    // ─── M4: adapter throw handling ──────────────────────────────────

    it('M4: adapter throwing from buildChallenge falls back to inline entry', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry => {
        throw new Error('simulated adapter bug')
      }
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        expect(response.status).toBe(402)
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    // ─── M5: JSON.stringify safety ───────────────────────────────────

    it('M5: adapter returning a BigInt throws with a clear serialize message', () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      mcpAdapter!.buildChallenge = (_options: BuildChallengeOptions): AcceptEntry =>
        ({
          scheme: 'sg-balance',
          provider: 'settlegrid',
          // BigInt is not JSON-serializable; this should cause the
          // builder to produce a specific error pointing at the
          // serialization failure, not a generic crash.
          costCents: 5n,
        }) as unknown as AcceptEntry
      try {
        expect(() =>
          buildMultiProtocol402({
            resource: BASE_RESOURCE,
            acceptedProtocols: ['mcp'],
            pricing: BASE_PRICING,
          }),
        ).toThrow(/serialize/)
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })

    // ─── M2/M3: x402 defensive cost clamping ─────────────────────────

    it('M2: x402 adapter clamps negative costCents to 0', () => {
      const x402Adapter = protocolRegistry.get('x402')
      expect(x402Adapter).toBeDefined()
      // resolveOperationCost on a validated pricing config cannot
      // return negative values, but the x402 adapter's clamp is a
      // belt-and-suspenders guard. Exercise the clamp directly via
      // the adapter method with a hand-rolled pricing shape that
      // bypasses validatePricingConfig (the builder's entry guard).
      const entry = x402Adapter!.buildChallenge({
        resource: { url: 'https://x' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricing: { defaultCostCents: -10 } as any,
      })
      // amount should be '0' (the clamp fired)
      expect(entry.amount).toBe('0')
    })

    it('M3: x402 adapter handles NaN costCents without throwing RangeError', () => {
      const x402Adapter = protocolRegistry.get('x402')
      // Build a pricing that would produce NaN through tiered arithmetic
      // if the resolver didn't normalize it. Since resolveOperationCost
      // is not NaN-safe in all code paths, the x402 clamp is the
      // primary defense.
      const entry = x402Adapter!.buildChallenge({
        resource: { url: 'https://x' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricing: { defaultCostCents: Number.NaN } as any,
      })
      expect(entry.amount).toBe('0')
    })

    it('M3: x402 adapter handles Infinity costCents without throwing RangeError', () => {
      const x402Adapter = protocolRegistry.get('x402')
      const entry = x402Adapter!.buildChallenge({
        resource: { url: 'https://x' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricing: { defaultCostCents: Number.POSITIVE_INFINITY } as any,
      })
      expect(entry.amount).toBe('0')
    })

    it('M3: x402 adapter floors fractional costCents for BigInt safety', () => {
      const x402Adapter = protocolRegistry.get('x402')
      const entry = x402Adapter!.buildChallenge({
        resource: { url: 'https://x' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pricing: { defaultCostCents: 7.8 } as any,
      })
      // Math.floor(7.8) = 7 → amount = 7 * 10_000 = '70000'
      expect(entry.amount).toBe('70000')
    })

    // ─── Adapter not registered fallback ─────────────────────────────

    it('dispatcher falls back to inline entry when adapter.buildChallenge is deleted', async () => {
      const mcpAdapter = protocolRegistry.get('mcp')
      const original = mcpAdapter!.buildChallenge
      // Delete the method entirely to simulate a pre-buildChallenge
      // adapter that hasn't been upgraded.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mcpAdapter as any).buildChallenge = undefined
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcpAdapter!.buildChallenge = original
      }
    })
  })

  // ─── Test close-out coverage ──────────────────────────────────────────
  //
  // Gaps identified during the P1.K3 close-out audit that were not
  // reached by the happy-path suite or the hostile-review regression
  // block: method-specific pricing for non-mcp adapters, mixed
  // adapter states in a single call, primitive return values,
  // reverse-order acceptedProtocols, direct method-level calls, and
  // x402 boundary cost values.

  describe('test close-out coverage', () => {
    // ─── Method-specific pricing for non-mcp adapters ───────────────

    it('x402 entry uses method-specific pricing when method is provided', () => {
      const x402 = protocolRegistry.get('x402')
      expect(x402).toBeDefined()
      const entry = x402!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: BASE_PRICING,
        method: 'deep-search', // 25 cents instead of default 5
      })
      // 25 cents → 25 × 10_000 = 250000 USDC base units
      expect(entry.amount).toBe('250000')
    })

    it('mpp entry uses method-specific pricing when method is provided', () => {
      const mpp = protocolRegistry.get('mpp')
      expect(mpp).toBeDefined()
      const entry = mpp!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: BASE_PRICING,
        method: 'deep-search',
      })
      expect(entry).toMatchObject({
        scheme: 'mpp',
        provider: 'stripe',
        amountCents: 25,
        currency: 'USD',
      })
    })

    // ─── Mixed adapter states in a single call ──────────────────────

    it('one adapter throwing does not affect entries produced by other adapters', async () => {
      // Force the x402 adapter to throw mid-dispatch and verify mcp
      // and mpp still produce valid entries.
      const x402 = protocolRegistry.get('x402')
      const originalX402 = x402!.buildChallenge
      x402!.buildChallenge = () => {
        throw new Error('x402 simulated failure')
      }
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp', 'x402', 'mpp'],
          pricing: BASE_PRICING,
        })
        expect(response.status).toBe(402)
        const body = await readBody(response)
        expect(body.accepts).toHaveLength(3)
        // mcp → real sg-balance entry
        expect(body.accepts[0]).toMatchObject({
          scheme: 'sg-balance',
          provider: 'settlegrid',
          costCents: 5,
        })
        // x402 → inline fallback (scheme=protocol name, not 'exact')
        expect(body.accepts[1]).toEqual({ scheme: 'x402', costCents: 5 })
        // mpp → real mpp entry
        expect(body.accepts[2]).toMatchObject({
          scheme: 'mpp',
          provider: 'stripe',
          amountCents: 5,
          currency: 'USD',
        })
      } finally {
        x402!.buildChallenge = originalX402
      }
    })

    it('multiple adapters throwing independently each fall back to inline entries', async () => {
      const x402 = protocolRegistry.get('x402')
      const mpp = protocolRegistry.get('mpp')
      const originalX402 = x402!.buildChallenge
      const originalMpp = mpp!.buildChallenge
      x402!.buildChallenge = () => {
        throw new Error('x402 failure')
      }
      mpp!.buildChallenge = () => {
        throw new Error('mpp failure')
      }
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp', 'x402', 'mpp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts).toHaveLength(3)
        // mcp → normal entry
        expect(body.accepts[0].scheme).toBe('sg-balance')
        // x402 → inline fallback
        expect(body.accepts[1]).toEqual({ scheme: 'x402', costCents: 5 })
        // mpp → inline fallback
        expect(body.accepts[2]).toEqual({ scheme: 'mpp', costCents: 5 })
      } finally {
        x402!.buildChallenge = originalX402
        mpp!.buildChallenge = originalMpp
      }
    })

    // ─── Primitive adapter returns (not covered by H4 set) ──────────

    it('adapter returning a number falls back to inline entry', async () => {
      const mcp = protocolRegistry.get('mcp')
      const original = mcp!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcp!.buildChallenge = (() => 42) as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcp!.buildChallenge = original
      }
    })

    it('adapter returning a boolean falls back to inline entry', async () => {
      const mcp = protocolRegistry.get('mcp')
      const original = mcp!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcp!.buildChallenge = (() => true) as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcp!.buildChallenge = original
      }
    })

    it('adapter returning a string falls back to inline entry', async () => {
      const mcp = protocolRegistry.get('mcp')
      const original = mcp!.buildChallenge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mcp!.buildChallenge = (() => 'not-an-entry') as any
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        const body = await readBody(response)
        expect(body.accepts[0]).toEqual({ scheme: 'mcp', costCents: 5 })
      } finally {
        mcp!.buildChallenge = original
      }
    })

    // ─── Reverse-order acceptedProtocols ─────────────────────────────

    it('accepts[] order matches acceptedProtocols reverse order', async () => {
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['mpp', 'x402', 'mcp'], // reverse order
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.accepts.map((e) => e.scheme)).toEqual([
        'mpp',
        'exact',
        'sg-balance',
      ])
      // WWW-Authenticate header reflects reversed order too
      expect(response.headers.get('WWW-Authenticate')).toBe(
        'Payment realm="settlegrid", scheme="mpp, exact, sg-balance"',
      )
    })

    // ─── Direct method-level tests for Phase 1 adapters ─────────────

    it('MCPAdapter.buildChallenge returns the full sg-balance shape directly', () => {
      const mcp = protocolRegistry.get('mcp')
      const entry = mcp!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: BASE_PRICING,
      })
      expect(entry).toEqual({
        scheme: 'sg-balance',
        provider: 'settlegrid',
        costCents: 5,
        topUpUrl: 'https://settlegrid.ai/top-up',
      })
    })

    it('X402Adapter.buildChallenge returns the full exact-scheme shape directly', () => {
      const x402 = protocolRegistry.get('x402')
      const entry = x402!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: BASE_PRICING,
      })
      expect(entry).toEqual({
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '50000',
        asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        payTo: '0x0000000000000000000000000000000000000000',
        maxTimeoutSeconds: 300,
      })
    })

    it('MPPAdapter.buildChallenge returns the full mpp shape directly', () => {
      const mpp = protocolRegistry.get('mpp')
      const entry = mpp!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: BASE_PRICING,
      })
      expect(entry).toEqual({
        scheme: 'mpp',
        provider: 'stripe',
        amountCents: 5,
        currency: 'USD',
      })
    })

    // ─── x402 boundary cost values ──────────────────────────────────

    it('x402 amount for zero-cost pricing is "0"', () => {
      const x402 = protocolRegistry.get('x402')
      const entry = x402!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: { defaultCostCents: 0 },
      })
      expect(entry.amount).toBe('0')
    })

    it('x402 amount for a 1-cent pricing is "10000"', () => {
      const x402 = protocolRegistry.get('x402')
      const entry = x402!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: { defaultCostCents: 1 },
      })
      expect(entry.amount).toBe('10000')
    })

    it('x402 amount for a million-cent (10,000 USD) pricing scales correctly', () => {
      // 1_000_000 cents × 10_000 base units/cent = 10_000_000_000 base
      // units = 10,000 USDC. Tests that BigInt handles the large value
      // without losing precision or overflowing a 53-bit JS number.
      const x402 = protocolRegistry.get('x402')
      const entry = x402!.buildChallenge({
        resource: BASE_RESOURCE,
        pricing: { defaultCostCents: 1_000_000 },
      })
      expect(entry.amount).toBe('10000000000')
    })

    // ─── dispatchToAcceptEntry is called exactly once per protocol ──

    it('adapter.buildChallenge is called exactly once per entry in acceptedProtocols', async () => {
      const mcp = protocolRegistry.get('mcp')
      const original = mcp!.buildChallenge
      let callCount = 0
      mcp!.buildChallenge = (options) => {
        callCount++
        return original!.call(mcp!, options)
      }
      try {
        buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp'],
          pricing: BASE_PRICING,
        })
        expect(callCount).toBe(1)
      } finally {
        mcp!.buildChallenge = original
      }
    })

    it('adapter.buildChallenge is called once per acceptedProtocols entry even on duplicate protocols', async () => {
      // Callers SHOULDN'T pass duplicates, but if they do, each
      // occurrence should trigger an independent dispatch so the
      // resulting accepts[] has one entry per occurrence.
      const mcp = protocolRegistry.get('mcp')
      const original = mcp!.buildChallenge
      let callCount = 0
      mcp!.buildChallenge = (options) => {
        callCount++
        return original!.call(mcp!, options)
      }
      try {
        const response = buildMultiProtocol402({
          resource: BASE_RESOURCE,
          acceptedProtocols: ['mcp', 'mcp', 'mcp'],
          pricing: BASE_PRICING,
        })
        expect(callCount).toBe(3)
        const body = await readBody(response)
        expect(body.accepts).toHaveLength(3)
      } finally {
        mcp!.buildChallenge = original
      }
    })
  })

  // ─── Phase 2 protocols produce stub entries ───────────────────────────

  describe('Phase 2 protocol stubs', () => {
    it('Phase 2 protocols produce a fallback entry with scheme and costCents', async () => {
      // ap2, visa-tap, ucp, acp, mastercard-vi, circle-nano are not
      // wired into the Phase 1 kernel but the builder still advertises
      // them in the 402 for out-of-band clients that might support them.
      const response = buildMultiProtocol402({
        resource: BASE_RESOURCE,
        acceptedProtocols: ['ap2', 'visa-tap', 'ucp', 'acp', 'mastercard-vi', 'circle-nano'],
        pricing: BASE_PRICING,
      })
      const body = await readBody(response)
      expect(body.accepts).toHaveLength(6)
      for (const entry of body.accepts) {
        expect(typeof entry.scheme).toBe('string')
        expect(typeof entry.costCents).toBe('number')
      }
      // The schemes match the protocol names 1:1 for these fallback
      // entries (the real shapes will be filled in by P1.K4).
      expect(body.accepts.map((e) => e.scheme)).toEqual([
        'ap2',
        'visa-tap',
        'ucp',
        'acp',
        'mastercard-vi',
        'circle-nano',
      ])
    })
  })
})
