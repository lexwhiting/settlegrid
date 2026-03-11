'use client'

import { useEffect } from 'react'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Settings page error:', error)
  }, [error])

  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-bold text-indigo mb-2">Settings Error</h2>
      <p className="text-gray-600 mb-4">Something went wrong loading settings.</p>
      <div role="alert" className="text-sm text-red-600 mb-4">
        {error.message || 'An unexpected error occurred.'}
      </div>
      <button
        onClick={reset}
        className="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors text-sm font-medium"
      >
        Try again
      </button>
    </div>
  )
}
