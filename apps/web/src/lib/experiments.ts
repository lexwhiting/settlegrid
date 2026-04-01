/**
 * PostHog feature flag experiments for A/B testing.
 *
 * Defines experiment configurations and a server-side helper
 * for resolving variants. Actual flag management is done in
 * the PostHog dashboard — this module provides typed access
 * and a central registry of active experiments.
 */

// ── Experiment Definitions ────────────────────────────────────────────────────

export interface ExperimentVariant {
  key: string
  label: string
}

export interface Experiment {
  /** PostHog feature flag key */
  flagKey: string
  /** Human-readable name */
  name: string
  /** What we're testing */
  description: string
  /** Possible variants (including control) */
  variants: ExperimentVariant[]
  /** Which variant is control */
  controlVariant: string
  /** Metric to measure */
  primaryMetric: string
}

export const EXPERIMENTS: Record<string, Experiment> = {
  'homepage-cta-text': {
    flagKey: 'homepage-cta-text',
    name: 'Homepage CTA Text',
    description: 'Test different CTA button text on the homepage hero section',
    variants: [
      { key: 'control', label: 'Get started' },
      { key: 'start-free', label: 'Start free' },
      { key: 'try-now', label: 'Try it now' },
    ],
    controlVariant: 'control',
    primaryMetric: 'signup_click_rate',
  },
  'pricing-highlight': {
    flagKey: 'pricing-highlight',
    name: 'Pricing Page Highlight',
    description: 'Test which pricing tier is visually highlighted on the pricing page',
    variants: [
      { key: 'control', label: 'No highlight' },
      { key: 'scale', label: 'Scale tier highlighted' },
      { key: 'builder', label: 'Builder tier highlighted' },
    ],
    controlVariant: 'control',
    primaryMetric: 'plan_selection_rate',
  },
  'ask-capture-timing': {
    flagKey: 'ask-capture-timing',
    name: 'Ask SettleGrid Email Capture Timing',
    description: 'Test when to show the email capture prompt in Ask SettleGrid',
    variants: [
      { key: 'control', label: 'After first result' },
      { key: 'after-second', label: 'After second result' },
    ],
    controlVariant: 'control',
    primaryMetric: 'email_capture_rate',
  },
} as const

/**
 * Resolves the experiment variant for a given flag and distinct ID.
 *
 * This function calls the PostHog Decide API server-side. It is safe
 * to call from API routes and server components. Returns the control
 * variant if PostHog is not configured or if the request fails.
 */
export async function getExperimentVariant(
  flagKey: string,
  distinctId: string
): Promise<string> {
  const experiment = EXPERIMENTS[flagKey]
  const controlVariant = experiment?.controlVariant ?? 'control'

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

  if (!posthogKey) {
    return controlVariant
  }

  try {
    const res = await fetch(`${posthogHost}/decide?v=3`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: posthogKey,
        distinct_id: distinctId,
      }),
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      return controlVariant
    }

    const data = (await res.json()) as {
      featureFlags?: Record<string, string | boolean>
    }

    const flagValue = data.featureFlags?.[flagKey]

    if (typeof flagValue === 'string') {
      return flagValue
    }

    // Boolean flags: true = enabled (not a multivariate experiment)
    if (typeof flagValue === 'boolean') {
      return flagValue ? 'enabled' : controlVariant
    }

    return controlVariant
  } catch {
    // Network error or timeout — return control
    return controlVariant
  }
}

// ── PostHog Event Names ────────────────────────────────────────────────────────
// Centralised registry of custom event names for consistency.

export const POSTHOG_EVENTS = {
  TOOL_CLAIMED: 'tool_claimed',
  CREDIT_PURCHASED: 'credit_purchased',
  ASK_EMAIL_CAPTURED: 'ask_email_captured',
  ACADEMIC_SIGNUP: 'academic_signup',
  EXPERIMENT_EXPOSURE: '$experiment_exposure',
} as const
