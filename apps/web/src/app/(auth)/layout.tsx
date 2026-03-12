import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | SettleGrid',
  description: 'Sign in or create an account on SettleGrid to monetize your AI tools.',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
