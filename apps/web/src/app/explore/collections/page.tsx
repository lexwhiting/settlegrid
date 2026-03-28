import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { COLLECTIONS } from '@/lib/collections'

export const metadata: Metadata = {
  title: 'Curated Collections — Best AI Tools by Use Case | SettleGrid',
  description:
    'Hand-picked collections of the best AI tools and APIs for specific use cases. Weather APIs, code analysis, data enrichment, security toolkits, and financial data feeds — curated for AI agents.',
  alternates: { canonical: 'https://settlegrid.ai/explore/collections' },
  keywords: [
    'curated AI tool collections',
    'best AI APIs by category',
    'MCP tool collections',
    'AI agent toolkits',
    'curated API lists',
    'best tools for AI agents',
  ],
  openGraph: {
    title: 'Curated Collections — Best AI Tools by Use Case | SettleGrid',
    description:
      'Hand-picked collections of the best AI tools and APIs for specific use cases. Curated for AI agents with per-call pricing.',
    type: 'website',
    url: 'https://settlegrid.ai/explore/collections',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Curated Collections — Best AI Tools by Use Case | SettleGrid',
    description:
      'Hand-picked collections of the best AI tools and APIs for specific use cases. Curated for AI agents with per-call pricing.',
  },
}

export default function CollectionsHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Curated AI Tool Collections',
    description:
      'Hand-picked collections of the best AI tools and APIs for specific use cases on SettleGrid.',
    url: 'https://settlegrid.ai/explore/collections',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    numberOfItems: COLLECTIONS.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: COLLECTIONS.map((col, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: col.title,
        url: `https://settlegrid.ai/explore/collections/${col.slug}`,
      })),
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">Collections</span>
          </nav>

          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Curated Collections
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Hand-picked collections of the best AI tools for specific use cases.
              Each collection is editorially curated to help you find the right tools fast.
            </p>
          </div>

          {/* Collection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {COLLECTIONS.map((col) => (
              <Link
                key={col.slug}
                href={`/explore/collections/${col.slug}`}
                className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={col.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors leading-tight mb-1">
                      {col.title}
                    </h2>
                    <span className="inline-flex items-center rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/25 px-2 py-0.5 text-xs font-semibold">
                      {col.toolSlugs.length} tools
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
                  {col.description.split('.')[0]}.
                </p>
                <div className="mt-4 text-xs font-medium text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  View collection &rarr;
                </div>
              </Link>
            ))}
          </div>

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <Link
              href="/explore"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Browse by Category
              </h3>
              <p className="text-sm text-gray-400">
                Explore all monetized AI tools across 13 categories with transparent per-call pricing.
              </p>
            </Link>
            <Link
              href="/guides"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Monetization Guides
              </h3>
              <p className="text-sm text-gray-400">
                Category-specific guides on pricing strategy, market sizing, and revenue optimization.
              </p>
            </Link>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Want your tool featured?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Register your tool on SettleGrid and it could be included in a curated collection — gaining editorial visibility and SEO-driven traffic.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Publish a Tool
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
