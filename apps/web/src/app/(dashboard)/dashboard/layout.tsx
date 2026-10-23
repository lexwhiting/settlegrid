import type { ReactNode } from 'react'
import type { Metadata } from 'next'

// Server layout so this client-rendered page gets its own tab title.
export const metadata: Metadata = { title: 'Dashboard | SettleGrid' }

export default function Layout({ children }: { children: ReactNode }) {
  return children
}
