'use client'

import { useState } from 'react'

interface BuyCreditsButtonProps {
  toolId: string
  amountCents: number
  label: string
}

export function BuyCreditsButton({ toolId, amountCents, label }: BuyCreditsButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handlePurchase() {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId, amountCents }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to start checkout. Please log in first.')
        return
      }
      const checkoutUrl = data.checkoutUrl ?? data.url
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        alert('No checkout URL returned. Please try again.')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handlePurchase}
      disabled={loading}
      className="block w-full py-3 px-4 text-center bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Redirecting...' : label}
    </button>
  )
}
