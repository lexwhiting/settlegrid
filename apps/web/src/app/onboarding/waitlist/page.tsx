/**
 * P3.RAIL1 — Waitlist page for developers in Stripe-unsupported
 * country+entity combinations.
 *
 * Server Component shell + client form. The shell reads the URL
 * search params (country, entity, reason) populated by the
 * `/onboarding` redirect and uses them to render country-specific
 * copy + pre-fill the form. Submission posts to `/api/waitlist` with
 * `feature: 'stripe-connect-rail'` and the country/entity in the
 * metadata jsonb column.
 *
 * # Hostile-lens contracts
 *
 *   - **No reflected XSS:** `country`, `entity`, and `reason` flow
 *     from query params into JSX. React auto-escapes interpolated
 *     strings, but we additionally normalize `country` to uppercase
 *     ISO-3166 alpha-2 and `entity` to the closed enum
 *     `'individual' | 'company'` server-side before rendering.
 *     Anything that fails the normalization renders as a generic
 *     fallback rather than echoing user-controlled bytes.
 *   - **Bypass-tolerant:** if a client lands here directly without
 *     query params, the form still works (collects a generic email
 *     waitlist signup with `feature: 'stripe-connect-rail'`). The
 *     Phase 5 telemetry cohort that DOES have country/entity is
 *     filtered server-side; direct-landed signups join the same
 *     row but with `metadata: null`.
 */

import { WaitlistForm } from './waitlist-form'

export const metadata = {
  title: 'Waitlist — SettleGrid',
  description:
    'Stripe Connect doesn\'t yet support your country / entity-type combination. Join the waitlist and we\'ll email you when it\'s ready.',
}

interface WaitlistPageProps {
  searchParams: Promise<{
    country?: string
    entity?: string
    reason?: string
  }>
}

const ENTITY_DISPLAY: Record<string, string> = {
  individual: 'individual',
  company: 'business',
}

const REASON_COPY: Record<string, string> = {
  country_not_supported_for_entity_type:
    'Stripe Connect doesn\'t yet support that country/entity-type combination.',
  preferred_currency_not_supported:
    'Stripe Connect doesn\'t yet support payouts in that currency.',
  internal_error:
    'We had trouble reading your eligibility. We\'ve added you to the waitlist as a precaution.',
}

function normalizeCountry(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const upper = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(upper) ? upper : undefined
}

function normalizeEntity(
  raw: string | undefined,
): 'individual' | 'company' | undefined {
  if (raw === 'individual' || raw === 'company') return raw
  return undefined
}

function normalizeReason(raw: string | undefined): string {
  if (!raw) return REASON_COPY.country_not_supported_for_entity_type
  return REASON_COPY[raw] ?? REASON_COPY.country_not_supported_for_entity_type
}

export default async function WaitlistPage({
  searchParams,
}: WaitlistPageProps) {
  const params = await searchParams
  const country = normalizeCountry(params.country)
  const entity = normalizeEntity(params.entity)
  const reasonCopy = normalizeReason(params.reason)
  const entityDisplay = entity ? ENTITY_DISPLAY[entity] : undefined

  return (
    <main className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Not yet supported
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {country && entityDisplay
              ? `Stripe Connect doesn't yet cover ${entityDisplay} accounts in ${country}.`
              : "Your country isn't supported yet."}
          </h1>
          <p className="mt-2 text-sm text-white/70">{reasonCopy}</p>
        </div>

        <p className="mt-6 text-sm text-white/70">
          Join the waitlist and we&apos;ll email you the moment a payment rail
          covering your country lands. Stripe expands its supported-countries
          matrix every few months; we also track waitlist demand by country to
          decide which non-Stripe rails to integrate.
        </p>

        <div className="mt-6">
          <WaitlistForm
            initialCountry={country ?? ''}
            initialEntity={entity ?? 'individual'}
            initialReason={params.reason ?? 'country_not_supported_for_entity_type'}
          />
        </div>

        <p className="mt-6 text-xs text-white/40">
          By submitting, you agree we&apos;ll email you about Stripe Connect
          coverage for your country. We will not share your email with anyone
          else and you can unsubscribe at any time.
        </p>
      </div>
    </main>
  )
}
