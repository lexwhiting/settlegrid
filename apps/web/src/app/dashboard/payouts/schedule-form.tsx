'use client'

/**
 * P3.RAIL3 — Payout schedule form (client component).
 *
 * Renders a small inline form with:
 *   - interval selector (manual / daily / weekly / monthly)
 *   - weekday picker (visible only when interval=weekly)
 *   - month-day picker (visible only when interval=monthly)
 *
 * Submits to POST /api/payouts/schedule. The backend is idempotent
 * (hostile (a)) so a double-click resolves to a single Stripe call;
 * the UI also disables the submit button while in flight to avoid
 * the round-trip in the first place.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

type Interval = 'manual' | 'daily' | 'weekly' | 'monthly'
type Weekday = (typeof WEEKDAYS)[number]

export interface ScheduleFormProps {
  initialInterval: Interval
  initialWeekday: Weekday | null
  initialMonthDay: number | null
}

export default function ScheduleForm({
  initialInterval,
  initialWeekday,
  initialMonthDay,
}: ScheduleFormProps) {
  const [interval, setIntervalValue] = useState<Interval>(initialInterval)
  const [weekday, setWeekday] = useState<Weekday>(initialWeekday ?? 'monday')
  const [monthDay, setMonthDay] = useState<number>(initialMonthDay ?? 1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const body =
      interval === 'manual' || interval === 'daily'
        ? { interval }
        : interval === 'weekly'
          ? { interval, weekday }
          : { interval, monthDay }

    try {
      const res = await fetch('/api/payouts/schedule', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Failed to update schedule')
        return
      }
      setSuccess(
        data?.applied === false
          ? 'Schedule unchanged (already current).'
          : 'Payout schedule updated.',
      )
      // Refresh the server-component page so the cached schedule value re-renders.
      startTransition(() => router.refresh())
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4"
      aria-label="Payout schedule form"
    >
      <div>
        <label
          htmlFor="payout-interval"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Schedule
        </label>
        <select
          id="payout-interval"
          value={interval}
          onChange={(e) => setIntervalValue(e.target.value as Interval)}
          disabled={submitting}
          className="block w-full max-w-xs rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1D2A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="manual">Manual (you trigger payouts)</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {interval === 'weekly' && (
        <div>
          <label
            htmlFor="payout-weekday"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Day of week
          </label>
          <select
            id="payout-weekday"
            value={weekday}
            onChange={(e) => setWeekday(e.target.value as Weekday)}
            disabled={submitting}
            className="block w-full max-w-xs rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1D2A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {WEEKDAYS.map((d) => (
              <option key={d} value={d}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {interval === 'monthly' && (
        <div>
          <label
            htmlFor="payout-monthday"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Day of month (1–31)
          </label>
          <input
            id="payout-monthday"
            type="number"
            min={1}
            max={31}
            value={monthDay}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isInteger(n) && n >= 1 && n <= 31) setMonthDay(n)
            }}
            disabled={submitting}
            className="block w-32 rounded-md border border-gray-300 dark:border-[#2A2D3E] bg-white dark:bg-[#1A1D2A] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Day 31 falls back to the last day of shorter months.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving…' : 'Save schedule'}
      </button>

      {error && (
        <div
          role="alert"
          className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-md p-3"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-md p-3"
        >
          {success}
        </div>
      )}
    </form>
  )
}
