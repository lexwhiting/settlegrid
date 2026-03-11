'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Documentation error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-indigo mb-2">Documentation Error</h2>
        <p className="text-gray-600 mb-4">Something went wrong loading the documentation.</p>
        <div role="alert" className="text-sm text-red-600 mb-4">
          {error.message || 'An unexpected error occurred.'}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm font-medium"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
