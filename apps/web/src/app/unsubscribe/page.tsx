import type { Metadata } from 'next'
import { UnsubscribeClient } from './unsubscribe-client'

export const metadata: Metadata = {
  title: 'Unsubscribe — SettleGrid',
  description: 'Unsubscribe from SettleGrid outreach emails.',
  robots: { index: false, follow: false },
}

export default function UnsubscribePage() {
  return <UnsubscribeClient />
}
