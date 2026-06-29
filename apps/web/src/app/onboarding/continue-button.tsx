'use client'

/**
 * P3.RAIL1 — "Continue with Stripe" button on the /onboarding page.
 *
 * Posts country / entity / preferred-currency as JSON to
 * `/api/stripe/connect` so the route can run the same
 * `routeDeveloper()` eligibility check `/api/eligibility` runs.
 * The button is the ONLY way the UI initiates Connect — direct POSTs
 * to `/api/stripe/connect` from a hostile client still hit the same
 * server-side gate (defense in depth).
 *
 * On 200: redirects to the Stripe-issued onboarding URL.
 * On 403 (INELIGIBLE): redirects to the waitlist URL the route
 * supplied in the response body. The router result is the source of
 * truth; the button does NOT make its own account-type decision.
 */

import { useState } from 'react'
import { isSafeRelativePath } from '@/lib/safe-redirect'

/**
 * H5 fix — defense-in-depth. The server today only emits Stripe URLs
 * (Connect onboarding) or our own `/onboarding/waitlist?...` paths.
 * If a future regression in /api/stripe/connect's response-shaping
 * code emitted an arbitrary URL, this client would otherwise turn
 * into an open-redirect proxy. Restrict navigation to the URL shapes
 * we actually expect.
 */
function isAllowedRedirect(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
    return false
  }
  // Same-origin path — delegated to the shared validator (single leading
  // '/', not '//' protocol-relative, not '/\' backslash, no control chars).
  // This feeds a bare `window.location.assign`, so the path check must match
  // the auth-redirect rule exactly; the previous local copy omitted the
  // backslash clause (G2-3 SEAM drift).
  if (isSafeRelativePath(url)) return true
  // Stripe Connect onboarding URLs only. The Stripe SDK returns URLs
  // under connect.stripe.com / dashboard.stripe.com. Strict prefix
  // match prevents `https://evil.com#connect.stripe.com/...` games.
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'connect.stripe.com' ||
        parsed.hostname === 'dashboard.stripe.com' ||
        parsed.hostname.endsWith('.stripe.com'))
    )
  } catch {
    return false
  }
}

interface ContinueButtonProps {
  countryIso: string
  entityType: 'individual' | 'company'
  preferredCurrency: string
}

export function ContinueButton({
  countryIso,
  entityType,
  preferredCurrency,
}: ContinueButtonProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryIso,
          entityType,
          preferredCurrency,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (res.status === 200 && typeof body.url === 'string') {
        if (!isAllowedRedirect(body.url)) {
          setError(
            'Onboarding URL was rejected by the client safety check. Please refresh and try again.',
          )
          return
        }
        window.location.assign(body.url)
        return
      }
      if (res.status === 403 && typeof body.waitlistUrl === 'string') {
        // Ineligible — server-side router rejected this combo.
        // The waitlist URL is server-supplied, but we still gate it
        // through `isAllowedRedirect` so a future server-side bug
        // can't accidentally turn this client into an open-redirect.
        if (!isAllowedRedirect(body.waitlistUrl)) {
          setError(
            'Waitlist redirect was rejected by the client safety check. Please refresh and try again.',
          )
          return
        }
        window.location.assign(body.waitlistUrl)
        return
      }
      setError(
        typeof body.error === 'string'
          ? body.error
          : `Onboarding failed (HTTP ${res.status}). Please try again.`,
      )
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-[#0A0E1A] hover:bg-amber-400 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Connecting...' : 'Continue with Stripe'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </>
  )
}
