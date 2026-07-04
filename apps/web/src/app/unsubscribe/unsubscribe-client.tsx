'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'

// Friendly stream labels for the confirmation copy. Keyed by the `type`/`stream`
// query param the sender's unsubscribe link carries (SUPPRESSIBLE_STREAMS).
const STREAM_LABELS: Record<string, string> = {
  outreach: 'outreach',
  'consumer-digest': 'weekly digest',
  'weekly-report': 'weekly report',
  'abandoned-checkout': 'purchase reminder',
  newsletter: 'newsletter',
}

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  // Forward the SAME param the sender's link already carries (`type`; accept
  // `stream` as an alias) so /api/unsubscribe writes the CORRECT stream — the
  // fix for G6-2 (the client used to DISCARD it and suppress 'outreach').
  const stream = searchParams.get('type') ?? searchParams.get('stream') ?? ''
  const streamLabel = STREAM_LABELS[stream] ?? 'outreach'
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
      body: JSON.stringify(stream ? { email, stream } : { email }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) {
          setStatus(res.ok ? 'done' : 'error')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [email, stream])

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
              You won&apos;t receive any more {streamLabel} emails from SettleGrid.
              You can always explore tools directly at{' '}
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
