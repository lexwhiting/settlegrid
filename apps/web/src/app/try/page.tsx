import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CATEGORIES } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { eq, sql, desc, and } from 'drizzle-orm'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Try 50+ AI Tools Free — No Credit Card | SettleGrid',
  description:
    'Every AI tool on SettleGrid has per-call pricing. Try any tool with free trial credits — no credit card required. Browse MCP tools for data, NLP, code, finance, and more.',
  alternates: { canonical: 'https://settlegrid.ai/try' },
  keywords: [
    'try MCP tools free',
    'AI tool trial',
    'free API testing',
    'MCP tool marketplace',
    'free AI tools',
    'no credit card AI tools',
    'per-call API pricing',
  ],
  openGraph: {
    title: 'Try 50+ AI Tools Free — No Credit Card | SettleGrid',
    description:
      'Every tool has per-call pricing. Try any tool with free trial credits. No credit card required.',
    type: 'website',
    url: 'https://settlegrid.ai/try',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Try 50+ AI Tools Free — No Credit Card',
    description:
      'Every tool has per-call pricing. Try any tool with free trial credits. No credit card required.',
  },
}

/* -------------------------------------------------------------------------- */
/*  Data Fetching                                                              */
/* -------------------------------------------------------------------------- */

interface ToolPreview {
  name: string
  slug: string
  description: string | null
  category: string | null
  pricingConfig: unknown
}

async function getCategoryCounts(): Promise<Map<string, number>> {
  try {
    const counts = await db
      .select({
        category: tools.category,
        count: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(and(eq(tools.status, 'active'), sql`${tools.category} IS NOT NULL`))
      .groupBy(tools.category)

    return new Map(counts.map((c) => [c.category!, c.count]))
  } catch {
    return new Map()
  }
}

async function getFeaturedTools(): Promise<ToolPreview[]> {
  try {
    return await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        pricingConfig: tools.pricingConfig,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.totalInvocations))
      .limit(9)
  } catch {
    return []
  }
}

async function getTotalToolCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tools)
      .where(eq(tools.status, 'active'))
    return row?.count ?? 0
  } catch {
    return 0
  }
}

function getPriceLabel(pricingConfig: unknown): string {
  if (!pricingConfig || typeof pricingConfig !== 'object') return 'Free'
  const config = pricingConfig as Record<string, unknown>
  if (typeof config.defaultCostCents === 'number' && config.defaultCostCents > 0) {
    return `$${(config.defaultCostCents / 100).toFixed(config.defaultCostCents < 100 ? 2 : 0)}/call`
  }
  return 'Free'
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function TryToolsPage() {
  const [countMap, featuredTools, totalTools] = await Promise.all([
    getCategoryCounts(),
    getFeaturedTools(),
    getTotalToolCount(),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Try AI Tools Free',
    description:
      'Try 50+ AI tools with per-call pricing. Free trial credits, no credit card required.',
    url: 'https://settlegrid.ai/try',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up free</Link>
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
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Try <span className="text-amber-400">{totalTools > 0 ? `${totalTools}+` : '50+'}</span> AI tools — free, no credit card
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-4">
              Every tool on SettleGrid has per-call pricing. Try any tool with free trial credits.
              No subscriptions, no credit card, no risk.
            </p>
            <p className="text-sm text-gray-500 max-w-xl mx-auto">
              Sign up for a free account, get 50,000 operations per month, and start testing any tool instantly.
              Pay only when you scale — and even then, developers keep 100% of their first $1K/month.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {[
              {
                step: '1',
                title: 'Create a free account',
                description: 'No credit card required. Get 50,000 free operations per month.',
                icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
              },
              {
                step: '2',
                title: 'Browse & discover tools',
                description: 'Search by category, keyword, or use case. Every tool shows transparent pricing.',
                icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
              },
              {
                step: '3',
                title: 'Call any tool instantly',
                description: 'Use the API, SDK, or connect through your AI agent. Pay per call, not per month.',
                icon: 'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z',
              },
            ].map((item) => (
              <div key={item.step} className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-100 mb-2">{item.title}</h2>
                <p className="text-sm text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Category Grid */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
              Browse tools by category
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {CATEGORIES.map((cat) => {
                const count = countMap.get(cat.slug) ?? 0
                return (
                  <Link
                    key={cat.slug}
                    href={`/explore/category/${cat.slug}`}
                    className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                            {cat.name}
                          </h3>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cat.color}`}>
                            {count}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                          {cat.description.split('.')[0]}.
                        </p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Featured Tools */}
          {featuredTools.length > 0 && (
            <div className="mb-16">
              <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
                Popular tools to try
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <h3 className="font-semibold text-gray-100 mb-1 group-hover:text-amber-400 transition-colors">
                      {tool.name}
                    </h3>
                    {tool.description && (
                      <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-3">
                        {tool.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      {tool.category && (
                        <span className="text-xs text-gray-500">{tool.category}</span>
                      )}
                      <span className="text-xs font-medium text-amber-400">
                        {getPriceLabel(tool.pricingConfig)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Ready to try any tool?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Create a free account to start calling tools immediately. No credit card, no commitments.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Create a Free Account
              </Link>
              <Link
                href="/explore"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Browse All Tools
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
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
