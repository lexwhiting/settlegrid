import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CATEGORIES } from '@/lib/categories'
import { HOWTO_GUIDES } from '@/lib/howto-guides'

export const metadata: Metadata = {
  title: 'Monetization Guides | SettleGrid',
  description:
    'Category-specific guides on how to monetize AI tools with SettleGrid. Pricing strategies, market sizing, revenue benchmarks, and best practices for every tool category.',
  alternates: { canonical: 'https://settlegrid.ai/guides' },
  keywords: [
    'monetize AI tools',
    'MCP tool pricing',
    'AI tool revenue',
    'per-call billing guide',
    'AI tool business model',
    'MCP monetization',
  ],
  openGraph: {
    title: 'Monetization Guides | SettleGrid',
    description: 'Category-specific guides on pricing, market sizing, and revenue optimization for AI tools.',
    type: 'website',
    url: 'https://settlegrid.ai/guides',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monetization Guides | SettleGrid',
    description: 'Category-specific guides on pricing, market sizing, and revenue optimization for AI tools.',
  },
}

export default function GuidesPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AI Tool Monetization Guides',
    description: 'Category-specific guides on how to monetize AI tools with SettleGrid.',
    url: 'https://settlegrid.ai/guides',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: CATEGORIES.map((cat, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `How to Monetize ${cat.name} Tools`,
        url: `https://settlegrid.ai/guides/monetize-${cat.slug}-tools`,
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

          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Monetization Guides
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Category-specific guides on pricing strategies, market sizing, revenue benchmarks, and
              best practices for monetizing AI tools on SettleGrid.
            </p>
          </div>

          {/* Guide Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/guides/monetize-${cat.slug}-tools`}
                className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                </div>
                <h2 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                  How to Monetize {cat.name} Tools
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
                  {cat.guideIntro}
                </p>
                <p className="text-xs text-amber-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Read guide &rarr;
                </p>
              </Link>
            ))}
          </div>

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <Link
              href="/learn/handbook"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                MCP Monetization Handbook
              </h3>
              <p className="text-sm text-gray-400">
                The complete guide to pricing strategy, SDK integration, growth tactics, and revenue benchmarks.
              </p>
            </Link>
            <Link
              href="/learn/discovery"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Discovery Guide
              </h3>
              <p className="text-sm text-gray-400">
                Maximize your tool&apos;s visibility across directories, search engines, and AI assistants.
              </p>
            </Link>
          </div>

          {/* How-To Guides */}
          <div className="mb-16">
            <h2 className="text-xl font-bold text-gray-100 mb-2">How-To Guides</h2>
            <p className="text-sm text-gray-400 mb-6">
              Step-by-step tutorials for building, deploying, pricing, and scaling your AI tools.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {HOWTO_GUIDES.map((guide) => (
                <Link
                  key={guide.slug}
                  href={`/learn/how-to/${guide.slug}`}
                  className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={guide.icon} />
                      </svg>
                    </div>
                    <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                      {guide.steps.length} steps
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-100 mb-1 group-hover:text-amber-400 transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                    {guide.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Ready to start earning?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Turn your MCP tools into revenue streams. Free tier includes 50,000 operations per month.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building — Free
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
