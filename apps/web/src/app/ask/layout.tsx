import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ask SettleGrid — Try AI Tools Free',
  description:
    'Ask a question and see SettleGrid AI tools in action. Free to try — no account required.',
  alternates: { canonical: 'https://settlegrid.ai/ask' },
  openGraph: {
    title: 'Ask SettleGrid — Try AI Tools Free',
    description: 'Ask a question and see SettleGrid AI tools in action.',
    url: 'https://settlegrid.ai/ask',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Ask SettleGrid — Try AI Tools Free',
    description: 'Ask a question and see SettleGrid AI tools in action.',
  },
}

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return children
}
