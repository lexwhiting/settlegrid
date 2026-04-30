/**
 * P2.RAIL1 — Rails registry tests.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildRailRegistry,
  requireRail,
  listRails,
  RESERVED_RAIL_IDS,
} from '../registry'
import type { StripeClient } from '../stripe-connect'

function buildMockStripe(): StripeClient {
  return {
    accounts: { create: vi.fn(), retrieve: vi.fn() },
    accountLinks: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    webhooks: { constructEvent: vi.fn() },
  } as unknown as StripeClient
}

describe('buildRailRegistry', () => {
  it('throws when opts is missing', () => {
    expect(() =>
      buildRailRegistry(undefined as unknown as Parameters<typeof buildRailRegistry>[0]),
    ).toThrowError(/opts/)
  })

  it('throws when stripeConnect opts are missing', () => {
    expect(() =>
      buildRailRegistry({} as Parameters<typeof buildRailRegistry>[0]),
    ).toThrowError(/stripeConnect/)
  })

  it('populates only stripe-connect in Phase 2', () => {
    const registry = buildRailRegistry({
      stripeConnect: { stripe: buildMockStripe(), appUrl: 'https://x' },
    })
    expect(registry['stripe-connect']).toBeDefined()
    expect(registry['paddle']).toBeUndefined()
    expect(registry['lemon-squeezy']).toBeUndefined()
    expect(registry['wise-batch']).toBeUndefined()
  })

  it('the stripe-connect adapter has the right id', () => {
    const registry = buildRailRegistry({
      stripeConnect: { stripe: buildMockStripe(), appUrl: 'https://x' },
    })
    expect(registry['stripe-connect']?.id).toBe('stripe-connect')
  })
})

describe('requireRail', () => {
  const registry = buildRailRegistry({
    stripeConnect: { stripe: buildMockStripe(), appUrl: 'https://x' },
  })

  it('returns the adapter when present', () => {
    const adapter = requireRail(registry, 'stripe-connect')
    expect(adapter.id).toBe('stripe-connect')
  })

  it('throws a descriptive error when the rail is not configured', () => {
    expect(() => requireRail(registry, 'paddle')).toThrowError(
      /Rail adapter 'paddle' is not configured/,
    )
  })

  it('error message suggests adding to buildRailRegistry options', () => {
    expect(() => requireRail(registry, 'wise-batch')).toThrowError(
      /add it to buildRailRegistry/,
    )
  })
})

describe('listRails', () => {
  it('returns only populated rail IDs', () => {
    const registry = buildRailRegistry({
      stripeConnect: { stripe: buildMockStripe(), appUrl: 'https://x' },
    })
    expect(listRails(registry)).toEqual(['stripe-connect'])
  })

  it('returns empty for an empty registry', () => {
    expect(listRails({})).toEqual([])
  })
})

describe('RESERVED_RAIL_IDS', () => {
  it('lists the reserved future rails', () => {
    expect(RESERVED_RAIL_IDS).toEqual([
      'paddle',
      'lemon-squeezy',
      'wise-batch',
      'razorpay-route',
      'flutterwave',
    ])
  })

  it('does not include stripe-connect (that is the populated rail)', () => {
    expect(RESERVED_RAIL_IDS).not.toContain('stripe-connect')
  })
})
