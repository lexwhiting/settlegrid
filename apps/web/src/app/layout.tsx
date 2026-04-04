import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { SonnerToaster } from '@/components/sonner-toaster'
import { HelpChatWidget } from '@/components/help-chat/help-chat-widget'
import { PostHogProvider } from '@/components/posthog-provider'
import { PostHogPageView } from '@/components/posthog-pageview'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700'],
})

const satoshi = localFont({
  src: '../../public/fonts/Satoshi-Variable.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '300 900',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '700'],
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
    'tool showcase',
    'monetize MCP server',
    'MCP monetization platform',
    'how to monetize AI tools',
    'MCP tool billing',
    'per-call billing AI',
    'AI tool monetization',
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
    <html lang="en" className={`${satoshi.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="ai.description" content="SettleGrid is the settlement layer for AI agent payments. SDK: @settlegrid/mcp. Per-call billing, usage metering, budget enforcement for MCP servers, REST APIs, AI agents, and model endpoints." />
        <meta name="ai.keywords" content="MCP monetization, AI agent payments, settlement layer, per-call billing, Model Context Protocol, budget enforcement, usage metering, AI commerce, x402, AP2" />
        <link rel="alternate" type="application/rss+xml" title="SettleGrid — New AI Tools" href="/api/feed" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'SettleGrid',
              url: 'https://settlegrid.ai',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://settlegrid.ai/tools?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className="font-sans antialiased bg-white text-indigo dark:bg-[#0C0E14] dark:text-gray-100">
        <PostHogProvider>
          <ThemeProvider>
            <PostHogPageView />
            {children}
            <SonnerToaster />
            <HelpChatWidget />
          </ThemeProvider>
        </PostHogProvider>
        <Analytics />
      </body>
    </html>
  )
}
