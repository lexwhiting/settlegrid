/**
 * P3.RAIL1 — Stripe Connect onboarding entry page.
 *
 * Server Component. The eligibility decision happens HERE on the
 * server, not in the client — that's the "not skippable" guarantee.
 * A developer landing on this page with a `country` + `entity` query
 * pair gets routed:
 *
 *   - eligible (Express / Standard / Custom) → render the
 *     "Continue with Stripe" CTA, which kicks off the existing
 *     `/api/stripe/connect` POST flow.
 *   - ineligible → redirect to `/onboarding/waitlist?country=X&entity=Y`
 *     before any Stripe-side traffic.
 *
 * Without `country` + `entity`, the page renders the country/entity
 * selection form; submitting it sends the developer back to this
 * same page with the values as query params.
 *
 * The form posts via GET (search params) so the server-side route
 * decision IS the page render — there is no client-only branching
 * step a malicious client could short-circuit.
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  routeDeveloper,
  UnsupportedCountryError,
  InvalidInputError,
  type StripeAccountType,
} from '@settlegrid/rails'
import { ContinueButton } from './continue-button'

export const metadata = {
  title: 'Onboard with Stripe Connect — SettleGrid',
  description:
    'Connect your Stripe account to start receiving developer payouts on SettleGrid.',
}

export const dynamic = 'force-dynamic'

interface OnboardingPageProps {
  searchParams: Promise<{
    country?: string
    entity?: string
    currency?: string
  }>
}

const ACCOUNT_TYPE_COPY: Record<
  StripeAccountType,
  { headline: string; body: string }
> = {
  express: {
    headline: 'Stripe Connect Express is ready for your country.',
    body: 'You will be redirected to Stripe to verify your identity. Stripe handles disputes and money transmission; SettleGrid issues 1099s and pays out tool revenue automatically.',
  },
  standard: {
    headline: 'Stripe Connect Standard is the right fit for your country.',
    body: "Standard means you'll manage your own Stripe dashboard, including disputes and custom payout schedules. This is the same Stripe account you would set up directly. SettleGrid integrates by application fee.",
  },
  custom: {
    headline: 'Stripe Connect Custom (platform-managed onboarding).',
    body: 'Your country requires a Custom account. We will guide you through a platform-managed onboarding flow. A SettleGrid representative will email you within one business day.',
  },
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const params = await searchParams
  const rawCountry = params.country?.trim() ?? ''
  const entity = params.entity?.trim() ?? ''
  const currency = (params.currency?.trim() || 'USD').slice(0, 8)

  // H7 fix — clamp at the presentation boundary so a 3-letter
  // 'usa' coming back through the form's `defaultValue` doesn't
  // overflow the 2-char input. The router still validates + throws
  // below; this is purely so re-renders on error are cosmetically
  // clean.
  const truncatedCountry = rawCountry.slice(0, 2)

  // No selection yet — render the form.
  if (!rawCountry || !entity) {
    return <CountryEntityForm prefillCountry={truncatedCountry} prefillEntity={entity} />
  }

  // H4 fix — defense-in-depth: validate the entity-type at the
  // presentation boundary BEFORE the router's runtime check. The
  // router is still authoritative; this prevents an unsafe `as`
  // cast from creeping into other call sites that copy this code.
  if (entity !== 'individual' && entity !== 'company') {
    return (
      <CountryEntityForm
        prefillCountry={truncatedCountry}
        prefillEntity={undefined}
        error="Please select either Individual or Registered company / LLC."
      />
    )
  }
  const validatedEntity: 'individual' | 'company' = entity

  // Server-side eligibility check. This runs even if a client
  // skipped the /api/eligibility call — non-skippable by design.
  // The router does its own input validation + normalization (uppercase,
  // 2-letter, etc.); we hand it the raw user input so its error
  // messages reflect what the user actually typed.
  let accountType: StripeAccountType
  try {
    const decision = routeDeveloper({
      countryIso: rawCountry,
      entityType: validatedEntity,
      preferredCurrency: currency,
    })
    accountType = decision.accountType
  } catch (err) {
    if (err instanceof InvalidInputError) {
      // H6 fix — name the bad field + tell the user the expected
      // shape so they can correct their input on the first retry
      // instead of looping on the same generic message. err.field
      // is one of the closed validation field names; safe to render.
      const fieldLabel = (
        {
          countryIso: 'Country code',
          preferredCurrency: 'Preferred currency',
          entityType: 'Entity type',
        } as Record<string, string>
      )[err.field] ?? err.field
      return (
        <CountryEntityForm
          prefillCountry={truncatedCountry}
          prefillEntity={validatedEntity}
          error={`${fieldLabel} doesn't look right. We expected an ISO-3166 alpha-2 code (e.g., US, GB, DE). Please try again.`}
        />
      )
    }
    if (err instanceof UnsupportedCountryError) {
      const safeCountry = encodeURIComponent(err.countryIso)
      const safeEntity = encodeURIComponent(err.entityType)
      const safeReason = encodeURIComponent(err.waitlistReason)
      // Server-side redirect — the developer never sees a "Continue
      // with Stripe" button for an unsupported combination.
      redirect(
        `/onboarding/waitlist?country=${safeCountry}&entity=${safeEntity}&reason=${safeReason}`,
      )
    }
    // Unexpected — fail-closed: redirect to a generic waitlist
    // rather than letting the developer through to a Stripe form.
    redirect(`/onboarding/waitlist?country=${encodeURIComponent(truncatedCountry)}&entity=${encodeURIComponent(validatedEntity)}&reason=internal_error`)
  }

  const copy = ACCOUNT_TYPE_COPY[accountType]
  return (
    <main className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">
          You&apos;re eligible for Stripe Connect.
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {truncatedCountry.toUpperCase()} · {validatedEntity}
        </p>
        <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-300">{copy.headline}</p>
          <p className="mt-2 text-sm text-white/70">{copy.body}</p>
        </div>
        <div className="mt-8 flex flex-col gap-3">
          {/* The ContinueButton client component POSTs JSON to
              /api/stripe/connect, which runs the same routeDeveloper
              eligibility check as /api/eligibility. This is the
              "in every path" guarantee + hostile (a) non-skippable
              guarantee — even a hostile client cannot reach Stripe
              without the server-side router approving the combination
              first. The account-type decision is the router's, never
              this client form's. */}
          <ContinueButton
            countryIso={truncatedCountry.toUpperCase()}
            entityType={validatedEntity}
            preferredCurrency={currency.toUpperCase()}
          />
          <Link
            href="/onboarding"
            className="text-center text-xs text-white/50 hover:text-white/80 transition-colors"
          >
            ← Change country or entity type
          </Link>
        </div>
      </div>
    </main>
  )
}

function CountryEntityForm({
  prefillCountry,
  prefillEntity,
  error,
}: {
  prefillCountry?: string
  prefillEntity?: string
  error?: string
}) {
  return (
    <main className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <h1 className="text-2xl font-semibold tracking-tight">
          Get paid on SettleGrid.
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Tell us where you&apos;re based so we can pick the right Stripe Connect
          account type for your country.
        </p>
        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        ) : null}
        <form action="/onboarding" method="GET" className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-white/70">
              Country (ISO-3166 alpha-2)
            </span>
            <input
              type="text"
              name="country"
              required
              maxLength={2}
              minLength={2}
              defaultValue={prefillCountry ?? ''}
              placeholder="US"
              autoComplete="country"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm uppercase text-white placeholder:text-white/30 focus:border-amber-500/60 focus:outline-none"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-xs font-semibold text-white/70">
              Entity type
            </legend>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="entity"
                value="individual"
                required
                defaultChecked={prefillEntity === 'individual' || !prefillEntity}
                className="accent-amber-500"
              />
              <span className="text-sm text-white/90">Individual / sole proprietor</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="entity"
                value="company"
                required
                defaultChecked={prefillEntity === 'company'}
                className="accent-amber-500"
              />
              <span className="text-sm text-white/90">Registered company / LLC</span>
            </label>
          </fieldset>
          <button
            type="submit"
            className="mt-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-[#0A0E1A] hover:bg-amber-400 transition-colors"
          >
            Check eligibility
          </button>
        </form>
        <p className="mt-6 text-xs text-white/40">
          We use Stripe Connect for payouts. If your country isn&apos;t yet
          supported, we&apos;ll add you to a waitlist instead of sending you
          to a broken Stripe form.
        </p>
      </div>
    </main>
  )
}
