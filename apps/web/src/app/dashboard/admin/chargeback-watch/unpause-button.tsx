'use client'

/**
 * P3.RAIL3 — Unpause button (founder-only).
 *
 * Hostile (c): the auto-pause mechanism set by
 * scripts/chargeback-velocity.ts must be reversible without a DB
 * shell. This button posts to /api/admin/chargeback-watch/unpause
 * with the developerId; on success it triggers a router.refresh()
 * so the row falls off the watch list.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export interface UnpauseButtonProps {
  developerId: string
}

export default function UnpauseButton({ developerId }: UnpauseButtonProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function onClick() {
    if (submitting) return
    if (
      !confirm(
        'Reverse the auto-pause for this developer? They can onboard new tools again immediately.',
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/chargeback-watch/unpause', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ developerId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Unpause failed')
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError('Network error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting}
        className="inline-flex items-center rounded-md border border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Unpausing…' : 'Unpause'}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  )
}
