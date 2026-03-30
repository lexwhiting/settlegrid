import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribe — SettleGrid',
  description: 'Unsubscribe from SettleGrid outreach emails.',
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen bg-indigo flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="font-display font-bold text-xl text-text-primary">Settle</span>
          <span className="font-display font-bold text-xl text-brand">Grid</span>
        </div>

        <h1 className="text-2xl font-bold text-text-primary mb-4">
          You&apos;ve been unsubscribed
        </h1>

        <p className="text-text-secondary mb-6 leading-relaxed">
          You won&apos;t receive any more outreach emails from SettleGrid.
          If you change your mind, you can always visit your tool&apos;s listing
          page directly at <a href="https://settlegrid.ai/marketplace" className="text-brand hover:text-brand-light underline">settlegrid.ai/marketplace</a>.
        </p>

        <p className="text-text-muted text-sm">
          If you keep receiving emails after unsubscribing, please contact{' '}
          <a href="mailto:support@settlegrid.ai" className="text-brand hover:text-brand-light underline">
            support@settlegrid.ai
          </a>.
        </p>
      </div>
    </div>
  )
}
