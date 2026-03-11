'use client'

import { useState, useCallback } from 'react'
import { SettleGridLogo } from '@/components/ui/logo'

export default function GatePage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      setLoading(true)

      try {
        const res = await fetch('/api/gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        })

        if (res.ok) {
          window.location.href = '/'
        } else {
          const data = await res.json()
          setError(data.error || 'Invalid password')
        }
      } catch {
        setError('Something went wrong. Please try again.')
      } finally {
        setLoading(false)
      }
    },
    [password]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo">
      {/* Ambient gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full opacity-[0.08]"
          style={{
            background: 'radial-gradient(circle, #10B981 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute right-1/4 top-1/4 h-[300px] w-[300px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, #34D399 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-12 flex flex-col items-center">
          <SettleGridLogo variant="mark" size={48} className="mb-6" />
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Settle<span className="text-brand">Grid</span>
          </h1>
          <p className="mt-2 text-sm tracking-wide text-gray-400">
            The Settlement Layer for the AI Economy
          </p>
        </div>

        {/* Gate form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="gate-password" className="sr-only">
              Access password
            </label>
            <input
              id="gate-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter access password"
              autoFocus
              autoComplete="off"
              required
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3.5 text-sm text-white placeholder-gray-500 backdrop-blur-sm transition-colors duration-200 focus:border-brand focus:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-brand"
              aria-label="Access password"
              aria-describedby={error ? 'gate-error' : undefined}
            />
          </div>

          {error && (
            <p
              id="gate-error"
              role="alert"
              className="text-center text-sm text-red-400"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-brand px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-indigo disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-25"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-75"
                  />
                </svg>
                Verifying...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <p className="mt-10 text-center text-xs text-gray-500 opacity-60">
          Private beta access only
        </p>
      </div>
    </div>
  )
}
