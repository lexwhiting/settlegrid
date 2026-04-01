import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { MarketplaceContent } from './marketplace-content'
import { SpotlightCard } from './spotlight-card'

export const metadata: Metadata = {
  title: 'AI Services Marketplace | SettleGrid',
  description:
    'Discover AI tools, MCP servers, models, APIs, agent tools, and automations across 10+ ecosystems. Browse, compare, and monetize with transparent per-call pricing.',
  alternates: { canonical: 'https://settlegrid.ai/marketplace' },
  keywords: [
    'AI marketplace',
    'MCP server directory',
    'AI model marketplace',
    'API marketplace',
    'agent tool directory',
    'AI tools marketplace',
    'HuggingFace models',
    'npm AI packages',
    'PyPI AI tools',
    'AI service billing',
    'per-call pricing',
    'AI tool monetization',
  ],
  openGraph: {
    title: 'AI Services Marketplace | SettleGrid',
    description:
      'Browse AI tools, MCP servers, models, APIs, and automations across 10+ ecosystems with per-call pricing.',
    type: 'website',
    url: 'https://settlegrid.ai/marketplace',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Services Marketplace | SettleGrid',
    description:
      'Browse AI tools, MCP servers, models, APIs, and automations across 10+ ecosystems with per-call pricing.',
  },
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  // Normalize to string values
  const normalizedParams: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(params)) {
    normalizedParams[key] = Array.isArray(value) ? value[0] : value
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AI Services Marketplace',
    description:
      'Browse and compare AI tools, MCP servers, models, APIs, and automations on SettleGrid.',
    url: 'https://settlegrid.ai/marketplace',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <Navbar />

      <main className="flex-1 px-6 py-12 pt-14">
        <div className="max-w-7xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Hero */}
          <div className="text-center mb-12 rounded-2xl py-12 px-6">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4 font-display">
              The{' '}
              <span className="text-brand-light">AI Services</span>{' '}
              Marketplace
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Discover, compare, and monetize AI tools across every ecosystem.
              MCP servers, models, APIs, agent tools, and automations — all with
              universal settlement and transparent per-call pricing.
            </p>
          </div>

          {/* Tool of the Week Spotlight */}
          <Suspense fallback={null}>
            <SpotlightCard />
          </Suspense>

          {/* Marketplace Content (Server Component) */}
          <Suspense
            fallback={
              <div className="text-center py-20">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-r-transparent" />
                <p className="mt-4 text-sm text-gray-500">Loading marketplace...</p>
              </div>
            }
          >
            <MarketplaceContent searchParams={normalizedParams} />
          </Suspense>

          {/* Browse by type */}
          <div className="mt-16 mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Browse by Type
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { slug: 'mcp-servers', name: 'MCP Servers' },
                { slug: 'ai-models', name: 'AI Models' },
                { slug: 'apis', name: 'REST APIs' },
                { slug: 'packages', name: 'SDK Packages' },
              ].map((t) => (
                <Link
                  key={t.slug}
                  href={`/marketplace/${t.slug}`}
                  className="rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 text-center hover:border-amber-500/40 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-200">{t.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center mt-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              List your tool on SettleGrid
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Every registered tool gets its own marketplace page, SEO-optimized
              listing, and automatic cross-ecosystem visibility.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building — Free
              </Link>
              <Link
                href="/learn/handbook"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Read the Handbook
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
