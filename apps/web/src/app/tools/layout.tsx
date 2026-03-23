import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Showcase | SettleGrid',
  description: 'Explore AI tools built on SettleGrid. See what developers are monetizing with per-call billing.',
  alternates: { canonical: 'https://settlegrid.ai/tools' },
  keywords: ['AI tools', 'MCP tools', 'SettleGrid showcase', 'monetized APIs', 'AI agent tools'],
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
