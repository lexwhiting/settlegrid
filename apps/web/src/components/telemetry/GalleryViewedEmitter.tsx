'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { captureCanonicalEvent } from '@/lib/posthog'

/**
 * P4.1 — Fires the canonical `gallery_viewed` event once per mount.
 *
 * Reads the PostHog instance via `usePostHog()` (per spec step 4).
 * The hook returns the same instance the `<PostHogProvider>` in the
 * root layout initialized; until provider mount it returns
 * undefined and the helper no-ops.
 *
 * The event carries no properties (per spec). Browser distinct_id
 * comes from PostHog's anonymous cookie, set by the provider at
 * `apps/web/src/components/posthog-provider.tsx`.
 *
 * React 18 strict-mode double-invokes effects in dev only. The
 * extra capture is dev-only noise; production fires once per
 * navigation.
 */
export function GalleryViewedEmitter() {
  const posthog = usePostHog()
  useEffect(() => {
    captureCanonicalEvent(posthog, 'gallery_viewed', {})
  }, [posthog])
  return null
}
