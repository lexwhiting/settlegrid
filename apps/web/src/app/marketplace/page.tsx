import Link from 'next/link'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SettleGridLogo } from '@/components/ui/logo'
import { MarketplaceContent } from './marketplace-content'

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
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/marketplace"
              className="hidden sm:inline text-sm font-medium text-amber-400 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/marketplace/compare/vs-xpay"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Compare
            </Link>
            <Link
              href="/tools"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Showcase
            </Link>
            <Link
              href="/docs"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/learn"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4 font-display">
              The AI Services Marketplace
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Discover, compare, and monetize AI tools across every ecosystem.
              MCP servers, models, APIs, agent tools, and automations — all with
              universal settlement and transparent per-call pricing.
            </p>
          </div>

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

          {/* Comparisons section */}
          <div className="mt-16 mb-8">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              How SettleGrid Compares
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { slug: 'vs-xpay', name: 'xpay.sh' },
                { slug: 'vs-nevermined', name: 'Nevermined' },
                { slug: 'vs-stripe-mpp', name: 'Stripe MPP' },
                { slug: 'vs-zuplo', name: 'Zuplo' },
              ].map((comp) => (
                <Link
                  key={comp.slug}
                  href={`/marketplace/compare/${comp.slug}`}
                  className="rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 text-center hover:border-amber-500/40 transition-colors"
                >
                  <span className="text-xs text-gray-500 block">vs</span>
                  <span className="text-sm font-medium text-gray-200">{comp.name}</span>
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

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/marketplace" className="hover:text-gray-100 transition-colors">
              Marketplace
            </Link>
            <Link href="/tools" className="hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
