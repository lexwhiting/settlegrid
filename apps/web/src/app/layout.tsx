import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'),
  icons: {
    icon: [
      { url: '/brand/favicon-color.svg', type: 'image/svg+xml' },
      { url: '/logos/favicon-color.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: '/brand/icon-color.svg',
    shortcut: '/brand/favicon-color.svg',
  },
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'SettleGrid — The Settlement Layer for the AI Economy',
    description:
      'Monetize your AI tools with per-call billing, automated payouts, and a unified API gateway.',
    type: 'website',
    siteName: 'SettleGrid',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'SettleGrid' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SettleGrid — The Settlement Layer for the AI Economy',
    description:
      'Monetize your AI tools with per-call billing, automated payouts, and a unified API gateway.',
    images: ['/api/og'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={outfit.variable}>
        <body className="font-sans antialiased bg-white text-indigo">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
