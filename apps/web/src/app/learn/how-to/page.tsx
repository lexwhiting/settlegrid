import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { HOWTO_GUIDES } from '@/lib/howto-guides'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'How-To Guides — Step-by-Step Tutorials for AI Tool Builders | SettleGrid',
  description:
    'Step-by-step how-to guides for building, deploying, pricing, promoting, and scaling monetized AI tools on SettleGrid. From first tool to sustainable revenue.',
  alternates: { canonical: 'https://settlegrid.ai/learn/how-to' },
  keywords: [
    'how to build MCP tool',
    'MCP tool tutorial',
    'deploy MCP server guide',
    'AI tool pricing guide',
    'MCP tool discovery',
    'scale AI tool revenue',
    'SettleGrid how-to',
    'MCP monetization tutorial',
  ],
  openGraph: {
    title: 'How-To Guides | SettleGrid',
    description: 'Step-by-step guides for building, deploying, pricing, and scaling monetized AI tools.',
    type: 'website',
    url: 'https://settlegrid.ai/learn/how-to',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How-To Guides | SettleGrid',
    description: 'Step-by-step guides for building, deploying, pricing, and scaling monetized AI tools.',
  },
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default function HowToHubPage() {
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
      { '@type': 'ListItem', position: 2, name: 'How-To Guides', item: 'https://settlegrid.ai/learn/how-to' },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'How-To Guides for AI Tool Builders',
    description:
      'Step-by-step how-to guides for building, deploying, pricing, promoting, and scaling monetized AI tools on SettleGrid.',
    url: 'https://settlegrid.ai/learn/how-to',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: HOWTO_GUIDES.map((guide, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: guide.title,
        url: `https://settlegrid.ai/learn/how-to/${guide.slug}`,
      })),
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">How-To Guides</span>
          </nav>

          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              How-To Guides
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Step-by-step tutorials that walk you from zero to revenue.
              Build, deploy, price, promote, and scale your AI tools on SettleGrid.
            </p>
          </div>

          {/* Guide grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {HOWTO_GUIDES.map((guide, i) => (
              <Link
                key={guide.slug}
                href={`/learn/how-to/${guide.slug}`}
                className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={guide.icon} />
                    </svg>
                  </div>
                  <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                    {guide.steps.length} steps
                  </span>
                </div>
                <h2 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                  {guide.title}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
                  {guide.description}
                </p>
                <p className="text-xs text-amber-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  Guide {i + 1} of {HOWTO_GUIDES.length} &rarr;
                </p>
              </Link>
            ))}
          </div>

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <Link
              href="/guides"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Monetization Guides
              </h3>
              <p className="text-sm text-gray-400">
                Category-specific pricing strategies, market sizing, and revenue benchmarks for every tool type.
              </p>
            </Link>
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
              href="/docs"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                API Documentation
              </h3>
              <p className="text-sm text-gray-400">
                Full SDK reference, API endpoints, authentication, and integration examples.
              </p>
            </Link>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Ready to build your first tool?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Scaffold a complete MCP server with billing pre-wired. Free tier includes 50,000 operations per month.
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

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/guides" className="hover:text-gray-100 transition-colors">Guides</Link>
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
