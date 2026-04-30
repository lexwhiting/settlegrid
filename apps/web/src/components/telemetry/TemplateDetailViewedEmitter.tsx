'use client'

import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'
import { captureCanonicalEvent } from '@/lib/posthog'

interface Props {
  slug: string
  category: string
}

/**
 * P4.1 — Fires `template_detail_viewed` once per (slug, category)
 * mount. Server passes both as props from the static template
 * registry; we don't re-derive them client-side.
 *
 * Uses `usePostHog()` to read the instance from React context (per
 * spec step 4) so the capture is gated on provider mount.
 */
export function TemplateDetailViewedEmitter({ slug, category }: Props) {
  const posthog = usePostHog()
  useEffect(() => {
    captureCanonicalEvent(posthog, 'template_detail_viewed', {
      slug,
      category,
    })
  }, [posthog, slug, category])
  return null
}
