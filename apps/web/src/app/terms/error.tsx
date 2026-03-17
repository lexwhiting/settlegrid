'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

export default function TermsError({
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
        <h2 className="text-xl font-bold text-indigo dark:text-gray-100 mb-2">Terms of Service Error</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4" role="alert">
          Something went wrong loading the terms of service. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm font-medium"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-gray-300 dark:border-[#2E3148] text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 dark:bg-[#1A1D2E] transition-colors text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
