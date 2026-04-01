'use client'

import { useState, useCallback } from 'react'
import posthog from 'posthog-js'
import { POSTHOG_EVENTS } from '@/lib/experiments'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export function AcademicSignupForm() {
  const [email, setEmail] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [useCase, setUseCase] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setState('loading')
      setErrorMessage(null)

      try {
        const res = await fetch('/api/consumer/academic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            institutionName: institutionName.trim(),
            useCase: useCase.trim() || undefined,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setState('error')
          setErrorMessage(data?.error ?? 'Something went wrong. Please try again.')
          return
        }

        setState('success')

        // Track the signup
        if (posthog.__loaded) {
          posthog.capture(POSTHOG_EVENTS.ACADEMIC_SIGNUP, {
            institution: institutionName.trim(),
          })
        }
      } catch {
        setState('error')
        setErrorMessage('Network error. Please check your connection and try again.')
      }
    },
    [email, institutionName, useCase]
  )

  if (state === 'success') {
    return (
      <div className="text-center p-8 bg-white dark:bg-[#161822] rounded-xl border border-gray-200 dark:border-[#2A2D3E]">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-2">
          Account Activated!
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Check your email for your welcome guide and next steps.
          Your $500 in credits are ready to use.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-6 bg-white dark:bg-[#161822] rounded-xl border border-gray-200 dark:border-[#2A2D3E]"
    >
      {errorMessage && (
        <div
          className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <div>
        <label htmlFor="academic-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Academic Email
        </label>
        <input
          id="academic-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0C0E14] text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Must be a .edu or recognized institutional email
        </p>
      </div>

      <div>
        <label htmlFor="institution-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Institution Name
        </label>
        <input
          id="institution-name"
          type="text"
          required
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          placeholder="MIT, Stanford, University of Oxford..."
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0C0E14] text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <div>
        <label htmlFor="use-case" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Use Case <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="use-case"
          value={useCase}
          onChange={(e) => setUseCase(e.target.value)}
          placeholder="Research project, coursework, thesis..."
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0C0E14] text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={state === 'loading'}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {state === 'loading' ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647Z" />
            </svg>
            Verifying...
          </>
        ) : (
          'Activate Academic Account'
        )}
      </button>
    </form>
  )
}
