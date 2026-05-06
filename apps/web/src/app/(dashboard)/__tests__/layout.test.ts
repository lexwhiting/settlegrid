/**
 * Dashboard layout — buildBottomNavItems tests.
 *
 * The sidebar's "Set up payouts" item is conditionally surfaced
 * based on the developer's Stripe Connect status. Without these
 * tests it's easy to flip the condition by accident and either:
 *   - hide the link from new developers (regress to the
 *     pre-fix discoverability bug), or
 *   - show it perpetually after onboarding completes (sidebar clutter
 *     for paid developers).
 *
 * Pure-function tests against the helper extracted from the layout —
 * no React Testing Library dependency.
 */
import { describe, it, expect } from 'vitest'
import { buildBottomNavItems, ONBOARDING_NAV_ITEM, baseBottomNavItems } from '../layout-nav'

describe('buildBottomNavItems', () => {
  it('hides the onboarding item while status is loading (null)', () => {
    // Default while /api/auth/developer/me is in flight. Hiding by
    // default avoids a flicker for already-onboarded developers
    // ("show → fetch → hide"). The trade-off: brand-new developers
    // wait ~1s before the link appears. The dashboard overview's
    // onboarding checklist is the redundant entry point that doesn't
    // depend on this fetch.
    const items = buildBottomNavItems(null)
    expect(items).toEqual(baseBottomNavItems)
    expect(items.some((i) => i.href === '/onboarding')).toBe(false)
  })

  it('hides the onboarding item once status is active', () => {
    // Onboarding done — drop the link so the sidebar isn't cluttered.
    const items = buildBottomNavItems('active')
    expect(items).toEqual(baseBottomNavItems)
    expect(items.some((i) => i.href === '/onboarding')).toBe(false)
  })

  it.each(['not_started', 'pending', 'restricted', ''])(
    'shows the onboarding item when status is %j (anything not "active")',
    (status) => {
      const items = buildBottomNavItems(status)
      expect(items[0]).toEqual(ONBOARDING_NAV_ITEM)
      expect(items.length).toBe(baseBottomNavItems.length + 1)
    },
  )

  it('surfaces onboarding ABOVE the regular Settings/Profile items', () => {
    // High visual weight for new developers — the "Set up payouts"
    // call to action should be the first item in the bottom group,
    // not buried below Docs/Settings/Profile.
    const items = buildBottomNavItems('not_started')
    expect(items[0].href).toBe('/onboarding')
  })

  it('points the onboarding item at /onboarding (the canonical entry per P3.RAIL1)', () => {
    // Pin the exact href — if a future refactor changes ONBOARDING_NAV_ITEM
    // to point at /api/stripe/connect or /dashboard/settings#payouts,
    // we regress to the pre-fix broken-CTA bug. This test fails loud.
    expect(ONBOARDING_NAV_ITEM.href).toBe('/onboarding')
  })

  it('does NOT mark the onboarding item as external (same-tab navigation)', () => {
    // External:true would open /onboarding in a new tab via target=_blank.
    // The onboarding flow includes a Stripe redirect → ideally happens
    // in the same tab so the visitor returns to /dashboard cleanly.
    expect(ONBOARDING_NAV_ITEM.external).toBeUndefined()
  })
})
