'use client'

import { useEffect } from 'react'
import { logger } from '@/lib/logger'

export default function Error({
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-indigo mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6" role="alert">An unexpected error occurred. Please try again.</p>
        <button
          onClick={reset}
          className="bg-brand text-white px-6 py-2 rounded-lg hover:bg-brand-dark transition-colors font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
