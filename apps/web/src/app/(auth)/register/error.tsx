'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

export default function RegisterError({
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-[#161822]">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Registration Error</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md" role="alert">
          Something went wrong loading registration. This is usually temporary.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            Back to Home
          </Link>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          If this keeps happening, email <a href="mailto:support@settlegrid.ai" className="text-brand hover:underline">support@settlegrid.ai</a>
        </p>
      </div>
    </div>
  )
}
