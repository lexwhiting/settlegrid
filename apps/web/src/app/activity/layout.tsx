import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marketplace Activity — SettleGrid',
  description:
    'See real-time marketplace activity on SettleGrid. New tools published, recent API calls, and developer activity.',
  alternates: { canonical: 'https://settlegrid.ai/activity' },
  openGraph: {
    title: 'Marketplace Activity — SettleGrid',
    description: 'See real-time marketplace activity on SettleGrid.',
    url: 'https://settlegrid.ai/activity',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Marketplace Activity — SettleGrid',
    description: 'See real-time marketplace activity on SettleGrid.',
  },
}

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children
}
