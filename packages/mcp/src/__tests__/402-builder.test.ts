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
import {
  buildMultiProtocol402,
  type PaymentRequiredBody,
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

    it('x402 entry includes network, asset, amount, and payTo fields', async () => {
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
