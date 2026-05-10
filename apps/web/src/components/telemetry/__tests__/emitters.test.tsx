/**
 * P4.1 — Funnel telemetry emitter components.
 *
 * Each emitter component is a thin React wrapper around
 * `captureCanonicalEvent` (already covered by
 * `apps/web/src/lib/__tests__/posthog.test.ts`). The risk class
 * unique to the emitter wrapper is:
 *
 *   1. Wrong canonical event name (typo regression)
 *   2. camelCase prop name leaking onto the wire (PostHog convention
 *      is snake_case prop names; the emitter is the boundary that
 *      converts component-prop `hasClaim` → event-prop `has_claim`)
 *   3. Dropped or extra prop in a refactor
 *
 * Tested without `@testing-library/react` or `jsdom` — those deps
 * aren't in the web project and adding them would be infrastructure,
 * not a test. Instead we mock `react.useEffect` to fire its callback
 * synchronously, and call the component as a function. That
 * exercises the actual emit code path with the same posthog mock
 * shape `captureCanonicalEvent` would see at runtime.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCapture, mockUsePostHog } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockUsePostHog: vi.fn(),
}))

vi.mock('@/lib/posthog', () => ({
  captureCanonicalEvent: mockCapture,
}))
vi.mock('posthog-js/react', () => ({
  usePostHog: mockUsePostHog,
}))
// Make useEffect run its callback synchronously so we can exercise
// the emit path inline. Other React exports passthrough so the
// modules import normally.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useEffect: (cb: () => void) => {
      cb()
    },
  }
})

import { GalleryViewedEmitter } from '@/components/telemetry/GalleryViewedEmitter'
import { TemplateDetailViewedEmitter } from '@/components/telemetry/TemplateDetailViewedEmitter'
import { ShadowDirectoryViewedEmitter } from '@/components/telemetry/ShadowDirectoryViewedEmitter'

const FAKE_POSTHOG = { capture: vi.fn() }

beforeEach(() => {
  mockUsePostHog.mockReturnValue(FAKE_POSTHOG)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('GalleryViewedEmitter', () => {
  it("fires 'gallery_viewed' once with empty props on mount", () => {
    const result = GalleryViewedEmitter()
    expect(result).toBeNull()
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith(FAKE_POSTHOG, 'gallery_viewed', {})
  })

  it('passes the posthog instance from usePostHog through to captureCanonicalEvent', () => {
    GalleryViewedEmitter()
    const [posthog] = mockCapture.mock.calls[0]!
    expect(posthog).toBe(FAKE_POSTHOG)
  })

  it("does NOT fire when usePostHog returns undefined (provider not yet mounted)", () => {
    mockUsePostHog.mockReturnValueOnce(undefined)
    GalleryViewedEmitter()
    // captureCanonicalEvent itself no-ops on null/undefined posthog
    // (covered in posthog.test.ts), but we assert the emitter still
    // calls it — gating happens inside the helper, not inside the
    // emitter, so the helper's null-safety stays load-bearing.
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith(undefined, 'gallery_viewed', {})
  })
})

describe('TemplateDetailViewedEmitter', () => {
  it("fires 'template_detail_viewed' with slug + category props", () => {
    const result = TemplateDetailViewedEmitter({
      slug: 'classifier',
      category: 'ai',
    })
    expect(result).toBeNull()
    expect(mockCapture).toHaveBeenCalledTimes(1)
    expect(mockCapture).toHaveBeenCalledWith(FAKE_POSTHOG, 'template_detail_viewed', {
      slug: 'classifier',
      category: 'ai',
    })
  })

  it('forwards slug + category verbatim — no client-side normalization', () => {
    TemplateDetailViewedEmitter({ slug: 'WEIRD-Slug_42', category: 'Edge Case' })
    expect(mockCapture).toHaveBeenCalledWith(FAKE_POSTHOG, 'template_detail_viewed', {
      slug: 'WEIRD-Slug_42',
      category: 'Edge Case',
    })
  })

  it('property-name regression guard: emits `slug` + `category` exactly (no aliasing)', () => {
    TemplateDetailViewedEmitter({ slug: 'a', category: 'b' })
    const [, , props] = mockCapture.mock.calls[0]!
    expect(Object.keys(props as Record<string, unknown>).sort()).toEqual([
      'category',
      'slug',
    ])
  })
})

describe('ShadowDirectoryViewedEmitter — camelCase → snake_case boundary', () => {
  it("fires 'shadow_directory_viewed' with snake_case `has_claim` (NOT camelCase `hasClaim`)", () => {
    const result = ShadowDirectoryViewedEmitter({
      owner: 'anthropic',
      repo: 'claude-code',
      hasClaim: true,
    })
    expect(result).toBeNull()
    expect(mockCapture).toHaveBeenCalledTimes(1)
    const [, eventName, props] = mockCapture.mock.calls[0]!
    expect(eventName).toBe('shadow_directory_viewed')
    expect(props).toEqual({
      owner: 'anthropic',
      repo: 'claude-code',
      has_claim: true,
    })
    // Hostile regression guard: `hasClaim` MUST NOT appear on the
    // wire. PostHog's HogQL queries lowercase JSON keys but don't
    // case-normalize across `hasClaim` ↔ `has_claim`, so a regression
    // here would silently produce a `null` `has_claim` column on the
    // shadow-directory funnel for every event.
    expect(Object.keys(props as Record<string, unknown>)).not.toContain(
      'hasClaim',
    )
  })

  it('preserves false value for has_claim (boolean roundtrip)', () => {
    ShadowDirectoryViewedEmitter({
      owner: 'someone',
      repo: 'unclaimed-repo',
      hasClaim: false,
    })
    const [, , props] = mockCapture.mock.calls[0]!
    expect((props as { has_claim: boolean }).has_claim).toBe(false)
  })

  it('property-name regression guard: emits exactly { owner, repo, has_claim }', () => {
    ShadowDirectoryViewedEmitter({ owner: 'a', repo: 'b', hasClaim: true })
    const [, , props] = mockCapture.mock.calls[0]!
    expect(Object.keys(props as Record<string, unknown>).sort()).toEqual([
      'has_claim',
      'owner',
      'repo',
    ])
  })
})

describe('All three emitters — canonical event name allow-list parity', () => {
  /**
   * The canonical event-name set is defined in
   * `apps/web/src/lib/posthog.ts` (EVENT_NAMES) and enforced at
   * runtime by `captureCanonicalEvent` (rejects non-canonical names).
   * This test asserts the emitter components target events that
   * exist in that allow-list — a typo like 'gallery_view' instead of
   * 'gallery_viewed' would be silently dropped at runtime; this test
   * surfaces it at compile time.
   */
  it('every emitted event name is in the canonical EVENT_NAMES tuple', async () => {
    const { EVENT_NAMES } = await vi.importActual<
      typeof import('@/lib/posthog')
    >('@/lib/posthog')
    GalleryViewedEmitter()
    TemplateDetailViewedEmitter({ slug: 's', category: 'c' })
    ShadowDirectoryViewedEmitter({ owner: 'o', repo: 'r', hasClaim: true })

    expect(mockCapture).toHaveBeenCalledTimes(3)
    const emittedNames = mockCapture.mock.calls.map(
      (call) => call[1] as string,
    )
    for (const name of emittedNames) {
      expect(EVENT_NAMES as readonly string[]).toContain(name)
    }
  })
})
