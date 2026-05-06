'use client'

/**
 * P5.PAYOUTS-3 — "Trigger payout" button.
 *
 * Self-serve manual payout trigger for developers. POSTs to
 * /api/payouts/trigger which delegates to processPayout. The route
 * applies SELECT FOR UPDATE + partial-unique-index serialization
 * (Phase 1), so a double-click can't double-pay — the second click
 * returns 409 PAYOUT_IN_PROGRESS, surfaced as a non-destructive toast.
 *
 * The parent page only mounts this component when:
 *   stripeConnectStatus === 'active' && balanceCents >= payoutMinimumCents
 * so the button is never shown when ineligible. We still treat the
 * server-side eligibility checks as authoritative — the route can
 * reject (e.g. balance changed mid-flight) and we just toast the
 * error.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useToast } from '@/components/ui/toast'

interface TriggerPayoutResponse {
  success?: boolean
  payout?: { amountCents: number; platformFeeCents: number; stripeTransferId: string }
  error?: string
  code?: string
}

export interface TriggerPayoutButtonProps {
  /** Display the developer's current balance in the disclosure text. */
  balanceCents: number
  /** Disable the button if balance < min; the parent decides to mount us anyway. */
  payoutMinimumCents: number
}

export default function TriggerPayoutButton({
  balanceCents,
  payoutMinimumCents,
}: TriggerPayoutButtonProps) {
  const { toast } = useToast()
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const eligible = balanceCents >= payoutMinimumCents
  const disabled = submitting || !eligible

  async function onClick() {
    if (disabled) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/payouts/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = (await res.json().catch(() => ({}))) as TriggerPayoutResponse

      if (!res.ok) {
        // Map known codes to friendly toasts. Anything else falls back
        // to the server's error message — already plain-text safe.
        const friendly =
          data.code === 'PAYOUT_IN_PROGRESS'
            ? 'A payout is already in progress. Refresh to see status.'
            : data.code === 'BELOW_MINIMUM'
              ? 'Balance is below the minimum payout threshold.'
              : data.code === 'NEEDS_RECONNECT'
                ? 'Stripe Connect needs reconnection. Visit Settings.'
                : (data.error ?? 'Payout failed. Please try again.')
        toast(friendly, 'error')
        return
      }

      const amount = data.payout?.amountCents ?? 0
      toast(`Payout sent: $${(amount / 100).toFixed(2)}`, 'success')
      // Refresh server data so the history table + balance update.
      router.refresh()
    } catch {
      toast('Network error. Please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Sending payout…' : 'Trigger payout now'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Available balance: <strong>${(balanceCents / 100).toFixed(2)}</strong>.
        {' '}Minimum payout: ${(payoutMinimumCents / 100).toFixed(2)}.
      </p>
    </div>
  )
}
