'use client'

/**
 * P3.RAIL1 — Client form for the rail-specific waitlist signup.
 *
 * POSTs to `/api/waitlist` with `feature: 'stripe-connect-rail'`.
 * The server-side route handles persistence, email, and Slack/Discord
 * demand-signal posting; this component is a thin form wrapper that
 * collects email + (optionally) lets the user adjust country/entity
 * before submission.
 */

import { useState, type FormEvent } from 'react'

interface WaitlistFormProps {
  initialCountry: string
  initialEntity: 'individual' | 'company'
  initialReason: string
}

export function WaitlistForm({
  initialCountry,
  initialEntity,
  initialReason,
}: WaitlistFormProps) {
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState(initialCountry)
  const [entity, setEntity] = useState<'individual' | 'company'>(initialEntity)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          feature: 'stripe-connect-rail',
          countryIso: country.trim().toUpperCase() || undefined,
          entityType: entity,
          waitlistReason: initialReason,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message =
          body && typeof body.error === 'string' ? body.error : 'Signup failed.'
        setError(message)
        return
      }
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div
        role="status"
        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
      >
        You&apos;re on the waitlist. We sent a confirmation to{' '}
        <span className="font-semibold">{email}</span>. We&apos;ll email you the
        moment a payment rail covering your country lands.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/70">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          maxLength={320}
          placeholder="you@example.com"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-500/60 focus:outline-none"
          disabled={submitting}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-white/70">Country</span>
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          autoComplete="country"
          maxLength={2}
          minLength={2}
          placeholder="US"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm uppercase text-white placeholder:text-white/30 focus:border-amber-500/60 focus:outline-none"
          disabled={submitting}
        />
      </label>
      <fieldset className="flex flex-col gap-2" disabled={submitting}>
        <legend className="text-xs font-semibold text-white/70">Entity type</legend>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="entity"
            value="individual"
            checked={entity === 'individual'}
            onChange={() => setEntity('individual')}
            className="accent-amber-500"
          />
          <span className="text-sm text-white/90">Individual / sole proprietor</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="entity"
            value="company"
            checked={entity === 'company'}
            onChange={() => setEntity('company')}
            className="accent-amber-500"
          />
          <span className="text-sm text-white/90">Registered company / LLC</span>
        </label>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-[#0A0E1A] hover:bg-amber-400 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Join the waitlist'}
      </button>
    </form>
  )
}
