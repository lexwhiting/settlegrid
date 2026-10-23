import type { ReactNode } from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Audit Log | SettleGrid' }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
