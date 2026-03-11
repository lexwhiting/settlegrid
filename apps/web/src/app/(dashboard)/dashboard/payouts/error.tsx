'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function PayoutsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('page_error', {}, error)
  }, [error])

  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold text-indigo mb-2">Payouts Error</h2>
      <p className="text-gray-600 mb-4" role="alert">
        Something went wrong loading payouts. Please try again.
      </p>
      <button
        onClick={reset}
        className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
