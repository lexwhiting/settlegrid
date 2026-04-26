'use client'

/**
 * Notify-me form for the Mastercard Verifiable Intent rollout.
 *
 * POSTs to ``/api/waitlist`` with ``feature: 'mastercard-vi-rollout'``.
 * Reuses the existing waitlist endpoint so persistence, email, and
 * demand-signal forwarding are already wired — this component is just
 * a thin client-side capture form.
 */

import { useState, type FormEvent } from 'react'

export function NotifyMeForm() {
  const [email, setEmail] = useState('')
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
          feature: 'mastercard-vi-rollout',
          waitlistReason: 'Mastercard Verifiable Intent — notify on validation rollout',
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
      setError('Could not reach the waitlist endpoint. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-200">
        Got it. We&apos;ll email you the moment Mastercard VI validation lands.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1 sm:flex-1">
        <span className="text-sm font-medium text-zinc-300">
          Email me when validation ships
        </span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
          aria-label="Email address"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Notify me'}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-400 sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  )
}
