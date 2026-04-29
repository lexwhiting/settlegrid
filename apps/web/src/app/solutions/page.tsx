import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { getCategoryBySlug } from '@/lib/categories'
import { SOLUTIONS } from '@/lib/solutions'

export const metadata: Metadata = {
  title: 'AI Service Billing Solutions | SettleGrid',
  description:
    'Per-call billing solutions for every AI service category. LLM inference, browser automation, media generation, agent-to-agent settlement, and more.',
  alternates: { canonical: 'https://settlegrid.ai/solutions' },
  keywords: [
    'AI billing solutions',
    'LLM billing',
    'AI service metering',
    'per-token billing',
    'agent billing',
    'API monetization',
    'AI cost management',
  ],
  openGraph: {
    title: 'AI Service Billing Solutions | SettleGrid',
    description:
      'Per-call billing solutions for every AI service category. From LLM inference to agent-to-agent settlement.',
    type: 'website',
    url: 'https://settlegrid.ai/solutions',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Service Billing Solutions | SettleGrid',
    description: 'Per-call billing for LLM inference, browser automation, media generation, and more.',
  },
}

export default function SolutionsHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'AI Service Billing Solutions',
    description:
      'Per-call billing solutions for every AI service category on SettleGrid.',
    url: 'https://settlegrid.ai/solutions',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    numberOfItems: SOLUTIONS.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: SOLUTIONS.map((solution, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: getCategoryBySlug(solution.slug)?.name ?? solution.slug,
        url: `https://settlegrid.ai/solutions/${solution.slug}`,
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
              Solutions for Every AI Service
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              SettleGrid bills any async function. Choose your service category to see exactly
              how <span className="text-amber-400 font-semibold">sg.wrap()</span> adds
              per-call billing to your stack.
            </p>
          </div>

          {/* Solution Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-16">
            {SOLUTIONS.map((solution) => {
              const cat = getCategoryBySlug(solution.slug)
              return (
                <Link
                  key={solution.slug}
                  href={`/solutions/${solution.slug}`}
                  className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors flex flex-col"
                >
                  <div className="flex items-start gap-3 mb-4">
                    {cat && (
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <svg
                          className="w-5 h-5 text-amber-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors leading-tight">
                        {cat?.name ?? solution.slug}
                      </h2>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold mt-1 ${cat?.color ?? 'bg-gray-500/15 text-gray-400 border-gray-500/25'}`}>
                        {solution.billingModel}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-3 flex-1">
                    {solution.subtext.split('.')[0]}.
                  </p>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#252836]">
                    <span className="text-xs text-gray-500">{solution.providers.length} providers</span>
                    <span className="text-xs font-semibold text-amber-400">{solution.tam.split(' ')[0]}</span>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <Link
              href="/explore"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Browse MCP Tools
              </h3>
              <p className="text-sm text-gray-400">
                Explore monetized MCP tools across 13 categories with transparent per-call pricing and usage stats.
              </p>
            </Link>
            <Link
              href="/docs"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Developer Documentation
              </h3>
              <p className="text-sm text-gray-400">
                Complete API reference, SDK guides, and integration tutorials for adding billing to any service.
              </p>
            </Link>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Settlement infrastructure for AI tools
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              If your service has an async function, SettleGrid can bill it. Two lines of code. No contracts. No minimums.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building -- Free
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
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
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
