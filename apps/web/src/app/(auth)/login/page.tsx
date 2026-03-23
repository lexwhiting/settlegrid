'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SettleGridLogo } from '@/components/ui/logo'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  // Pre-fill email from URL params (e.g., ?email=user@example.com)
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    const redirect = searchParams.get('redirect') ?? '/dashboard'
    router.push(redirect)
    router.refresh()
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email address above, then click "Forgot password?"')
      return
    }
    setError(null)
    setResetLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/settings`,
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setResetSent(true)
    }
    setResetLoading(false)
  }

  return (
    <div className="bg-white dark:bg-[#1A1D2E] rounded-xl shadow-lg border border-gray-200 dark:border-[#2E3148] p-8">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <Link href="/">
          <SettleGridLogo variant="horizontal" size={32} />
        </Link>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-indigo dark:text-gray-100">
          Sign in to SettleGrid
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Welcome back. Sign in to continue.
        </p>
      </div>

      {/* OAuth buttons -- PROMINENT, at top */}
      <div className="space-y-3 mb-6">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#252836] px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2E3148] hover:border-brand/40 dark:hover:border-brand/40 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('github')}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#252836] px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2E3148] hover:border-brand/40 dark:hover:border-brand/40 transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          Continue with GitHub
        </button>
      </div>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-[#2E3148]" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white dark:bg-[#1A1D2E] text-gray-500 dark:text-gray-500">
            or continue with email
          </span>
        </div>
      </div>

      {/* Password reset confirmation */}
      {resetSent && (
        <div className="rounded-lg bg-brand/5 dark:bg-brand/10 border border-brand/20 p-3 text-sm text-brand-text dark:text-brand-light mb-4">
          Password reset link sent to <strong>{email}</strong>. Check your inbox.
        </div>
      )}

      {/* Email/password form -- SECONDARY, below divider */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#252836] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-xs font-medium text-brand hover:text-brand-dark dark:text-brand-light disabled:opacity-50"
            >
              {resetLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 dark:border-[#2E3148] bg-white dark:bg-[#252836] px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            placeholder="Your password"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand hover:bg-brand-dark text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-brand hover:text-brand-dark dark:text-brand-light">
          Sign up
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="dark min-h-screen flex items-center justify-center px-4 bg-[#0F1117] text-gray-100">
      <div className="w-full max-w-md">
        <Suspense fallback={
          <div className="bg-white dark:bg-[#1A1D2E] rounded-xl shadow-lg border border-gray-200 dark:border-[#2E3148] p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 dark:bg-[#252836] rounded w-48 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-[#252836] rounded w-64 mx-auto" />
              <div className="h-12 bg-gray-200 dark:bg-[#252836] rounded" />
              <div className="h-12 bg-gray-200 dark:bg-[#252836] rounded" />
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
