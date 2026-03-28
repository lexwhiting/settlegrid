import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Start Earning — Monetize Any AI Service in 60 Seconds | SettleGrid',
  description:
    'Paste your API endpoint, set your price, and start earning in 60 seconds. No code, no approval process. SettleGrid auto-detects your service type and suggests optimal pricing.',
  alternates: { canonical: 'https://settlegrid.ai/start' },
  openGraph: {
    title: 'Start Earning — Monetize Any AI Service in 60 Seconds',
    description:
      'Paste. Price. Publish. Monetize any AI service with zero code in under 60 seconds.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Start Earning — Monetize Any AI Service in 60 Seconds',
    description:
      'Paste. Price. Publish. Monetize any AI service with zero code in under 60 seconds.',
  },
}

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
