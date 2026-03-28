'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ClaimButtonProps {
  token: string
  toolName: string
}

/**
 * Client-side "Claim This Tool" button.
 *
 * Flow:
 * 1. User clicks "Claim This Tool"
 * 2. POST /api/tools/claim with the token
 * 3. If 401: redirect to login with return URL
 * 4. If success: redirect to dashboard/tools to set pricing
 * 5. If already claimed: show error message
 */
export function ClaimButton({ token, toolName }: ClaimButtonProps) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleClaim = useCallback(async () => {
    setState('loading')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/tools/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (res.status === 401) {
        // Not authenticated: redirect to login with return URL
        const returnUrl = encodeURIComponent(`/claim/${token}`)
        router.push(`/auth/login?returnUrl=${returnUrl}`)
        return
      }

      if (!res.ok) {
        const message =
          data?.error ?? 'Something went wrong. Please try again.'
        setState('error')
        setErrorMessage(message)
        return
      }

      setState('success')

      // Redirect to dashboard to set pricing
      const redirectUrl = data?.redirectUrl ?? '/dashboard/tools'
      setTimeout(() => {
        router.push(redirectUrl)
      }, 1500)
    } catch {
      setState('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    }
  }, [token, router])

  if (state === 'success') {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          {toolName} claimed successfully!
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Redirecting to your dashboard...
        </p>
      </div>
    )
  }

  return (
    <div>
      {errorMessage && (
        <div
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleClaim}
        disabled={state === 'loading'}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
            </svg>
            Claiming...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Claim This Tool
          </>
        )}
      </button>
    </div>
  )
}
