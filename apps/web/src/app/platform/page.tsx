import type { Metadata } from 'next'
import Link from 'next/link'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { PlatformHero } from '@/components/marketing/platform/platform-hero'
import { PlatformProblem } from '@/components/marketing/platform/platform-problem'
import { PlatformHowItWorks } from '@/components/marketing/platform/platform-how-it-works'
import { PlatformChannels } from '@/components/marketing/platform/platform-channels'
import { PlatformEconomics } from '@/components/marketing/platform/platform-economics'
import { PlatformAgents } from '@/components/marketing/platform/platform-agents'
import { PlatformAnalytics } from '@/components/marketing/platform/platform-analytics'

export const metadata: Metadata = {
  title: 'Platform — The AI Tool Distribution Platform | SettleGrid',
  description:
    'Wrap one function. Get billing, discovery, and distribution across every channel where AI tools are found. 10 channels, multi-protocol settlement, 95-100% revenue share.',
  alternates: { canonical: 'https://settlegrid.ai/platform' },
  keywords: [
    'AI tool distribution',
    'AI tool marketplace',
    'MCP tool distribution',
    'AI tool billing',
    'agent discovery API',
    'AI tool monetization',
    'MCP server marketplace',
    'developer platform',
    'AI economy',
  ],
  openGraph: {
    title: 'Platform — The AI Tool Distribution Platform | SettleGrid',
    description:
      'Wrap one function. Get billing, discovery, and distribution across every channel where AI tools are found.',
    type: 'website',
    siteName: 'SettleGrid',
    url: 'https://settlegrid.ai/platform',
    images: [{ url: '/api/og?title=Platform', width: 1200, height: 630, alt: 'SettleGrid Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Platform — The AI Tool Distribution Platform | SettleGrid',
    description:
      'Wrap one function. Get billing, discovery, and distribution across every channel where AI tools are found.',
    images: ['/api/og?title=Platform'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'The AI Tool Distribution Platform',
  description:
    'Wrap one function. Get billing, discovery, and distribution across every channel where AI tools are found. 10 channels, multi-protocol settlement, 95-100% revenue share.',
  url: 'https://settlegrid.ai/platform',
  isPartOf: {
    '@type': 'WebSite',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
  },
  provider: {
    '@type': 'Organization',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
  },
}

export default function PlatformPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PlatformHero />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformProblem />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformHowItWorks />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformChannels />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformEconomics />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformAgents />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>
      <PlatformAnalytics />
      <div className="w-full max-w-5xl mx-auto px-6"><div className="border-t border-border" /></div>

      {/* CTA Section */}
      <section className="py-16 lg:py-24">
        <div className="w-full max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col items-center text-center gap-6">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-balance">
              Start distributing
            </h2>
            <p className="text-lg text-muted-foreground">
              Free forever. Set up in 90 seconds.
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Link
                href="/start"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
              >
                Get started
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
              >
                View docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}
