'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const [status, setStatus] = useState<'processing' | 'done' | 'error' | 'no-email'>('processing')

  useEffect(() => {
    if (!email || !email.includes('@')) {
      setStatus('no-email')
      return
    }

    const controller = new AbortController()

    fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setStatus(res.ok ? 'done' : 'error')
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [email])

  return (
    <div className="min-h-screen bg-indigo flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="font-display font-bold text-xl text-text-primary">Settle</span>
          <span className="font-display font-bold text-xl text-brand">Grid</span>
        </div>

        {status === 'processing' && (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-4">Unsubscribing...</h1>
            <p className="text-text-secondary">One moment.</p>
          </>
        )}

        {status === 'done' && (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-4">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-text-secondary mb-6 leading-relaxed">
              You won&apos;t receive any more outreach emails from SettleGrid.
              If you change your mind, you can always visit your tool&apos;s listing
              page directly at{' '}
              <a href="https://settlegrid.ai/marketplace" className="text-brand hover:text-brand-light underline">
                settlegrid.ai/marketplace
              </a>.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-4">
              Something went wrong
            </h1>
            <p className="text-text-secondary mb-6 leading-relaxed">
              We couldn&apos;t process your unsubscribe request. Please try again or contact{' '}
              <a href="mailto:support@settlegrid.ai" className="text-brand hover:text-brand-light underline">
                support@settlegrid.ai
              </a>.
            </p>
          </>
        )}

        {status === 'no-email' && (
          <>
            <h1 className="text-2xl font-bold text-text-primary mb-4">
              Unsubscribe
            </h1>
            <p className="text-text-secondary mb-6 leading-relaxed">
              If you received an outreach email from SettleGrid and would like to unsubscribe,
              please click the unsubscribe link in that email. You can also contact{' '}
              <a href="mailto:support@settlegrid.ai" className="text-brand hover:text-brand-light underline">
                support@settlegrid.ai
              </a>{' '}
              to be removed.
            </p>
          </>
        )}

        <p className="text-text-muted text-sm mt-6">
          <a href="https://settlegrid.ai" className="text-brand hover:text-brand-light underline">
            settlegrid.ai
          </a>
        </p>
      </div>
    </div>
  )
}

export function UnsubscribeClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-indigo flex items-center justify-center px-6">
        <p className="text-text-secondary">Loading...</p>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  )
}
