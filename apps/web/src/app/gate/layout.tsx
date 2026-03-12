import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Access | SettleGrid',
  description: 'Enter your access password to continue.',
}

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return children
}
