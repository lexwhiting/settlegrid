'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { SettleGridLogo } from '@/components/ui/logo'

export default function AcademyLessonError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the failure so Sentry (configured app-wide) picks it up.
    // The renderer-level error boundary catches render throws from
    // MarkdownRenderer too — typically bad markdown in a lesson body.
    console.error('Academy lesson render error:', error)
  }, [error])

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/learn"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 text-center">
          <h1 className="text-6xl font-bold text-gray-700 mb-4">500</h1>
          <h2 className="text-lg font-semibold text-gray-100 mb-2">
            This lesson failed to render
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Something went wrong while loading this Academy lesson. The
            rest of the site is unaffected.
          </p>
          {error.digest && (
            <p className="text-[10px] font-mono text-gray-500 mb-6">
              digest: {error.digest}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
            >
              Try again
            </button>
            <Link
              href="/learn"
              className="inline-flex items-center bg-[#0C0E14] text-amber-400 border border-amber-500/30 px-5 py-2.5 rounded-lg font-semibold hover:border-amber-500/60 transition-colors"
            >
              Back to Learn
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
