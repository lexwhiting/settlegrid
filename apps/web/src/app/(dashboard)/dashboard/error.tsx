'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', {
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold text-indigo mb-2">Dashboard Error</h2>
      <p className="text-gray-600 mb-4" role="alert">Something went wrong loading the dashboard.</p>
      <button
        onClick={reset}
        className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
