import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'SettleGrid — The Settlement Layer for the AI Economy',
  description:
    'SettleGrid enables AI tool developers to monetize their tools with per-call billing, ' +
    'automated payouts, and a unified API gateway. The settlement layer for the AI economy.',
  keywords: [
    'AI tools',
    'API monetization',
    'per-call billing',
    'developer platform',
    'AI economy',
    'MCP',
    'tool marketplace',
  ],
  icons: {
    icon: '/logos/favicon-color.svg',
    apple: '/logos/icon-color.svg',
  },
  openGraph: {
    title: 'SettleGrid — The Settlement Layer for the AI Economy',
    description:
      'Monetize your AI tools with per-call billing, automated payouts, and a unified API gateway.',
    type: 'website',
    images: [{ url: '/social/og-image.svg', width: 1200, height: 630, alt: 'SettleGrid' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SettleGrid — The Settlement Layer for the AI Economy',
    description:
      'Monetize your AI tools with per-call billing, automated payouts, and a unified API gateway.',
    images: ['/social/og-image.svg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="font-sans antialiased bg-white text-indigo">
        {children}
      </body>
    </html>
  )
}
