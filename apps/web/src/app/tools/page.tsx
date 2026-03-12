'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

export default function MarketplacePage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), feature: 'marketplace' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Something went wrong. Please try again.')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors">
              Docs
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-indigo">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-lg w-full">
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
              <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-indigo mb-3">Tool Marketplace</h1>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">Coming Soon</p>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              When the SettleGrid developer ecosystem reaches critical mass, you will be
              able to discover, compare, and integrate tools from other developers directly
              from this marketplace.
            </p>

            {submitted ? (
              <div className="rounded-lg bg-brand/5 border border-brand/20 p-4">
                <p className="text-sm font-medium text-brand-text">
                  You are on the list. We will notify you when the marketplace launches.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <label htmlFor="marketplace-notify-email" className="sr-only">Email address</label>
                  <input
                    id="marketplace-notify-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="flex-1 h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-10 px-5 rounded-md bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors shrink-0 disabled:opacity-50"
                  >
                    {loading ? 'Submitting...' : 'Notify me'}
                  </button>
                </div>
                {error && (
                  <p className="text-sm text-red-600" role="alert">{error}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/tools" className="hover:text-indigo transition-colors">Marketplace</Link>
            <Link href="/docs" className="hover:text-indigo transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-indigo transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
