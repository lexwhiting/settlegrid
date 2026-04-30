'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { captureCanonicalEvent } from '@/lib/posthog'

interface Props {
  owner: string
  repo: string
  hasClaim: boolean
}

/**
 * P4.1 — Fires `shadow_directory_viewed` on mount. `has_claim` is
 * the marketplace-status flag from the server (true when the repo
 * has a claimed SettleGrid tool listing). The funnel uses this to
 * separate organic SEO traffic from claimed-tool reactivation.
 *
 * Uses `usePostHog()` to read the instance from React context (per
 * spec step 4).
 */
export function ShadowDirectoryViewedEmitter({ owner, repo, hasClaim }: Props) {
  const posthog = usePostHog()
  useEffect(() => {
    captureCanonicalEvent(posthog, 'shadow_directory_viewed', {
      owner,
      repo,
      has_claim: hasClaim,
    })
  }, [posthog, owner, repo, hasClaim])
  return null
}
