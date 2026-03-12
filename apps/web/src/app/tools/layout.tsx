import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Marketplace | SettleGrid',
  description: 'Discover, compare, and integrate monetized AI tools from the SettleGrid marketplace.',
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
