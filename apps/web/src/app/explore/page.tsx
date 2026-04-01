import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { CATEGORIES } from '@/lib/categories'
import { COLLECTIONS } from '@/lib/collections'
import { ExploreCategoryFilter } from '@/components/explore-category-filter'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, sql, and, desc } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Explore AI Tools & Services | SettleGrid',
  description:
    'Discover and compare monetized AI tools and services across 21 categories. Browse MCP tools, LLM inference, browser automation, media generation, and more — all with transparent per-call pricing.',
  alternates: { canonical: 'https://settlegrid.ai/explore' },
  keywords: [
    'AI tool directory',
    'MCP tool marketplace',
    'monetized AI tools',
    'AI agent tools',
    'MCP server directory',
    'per-call API billing',
    'AI service billing',
    'LLM inference billing',
  ],
  openGraph: {
    title: 'Explore AI Tools & Services | SettleGrid',
    description: 'Browse monetized AI tools and services across 21 categories with transparent per-call pricing.',
    type: 'website',
    url: 'https://settlegrid.ai/explore',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore AI Tools & Services | SettleGrid',
    description: 'Browse monetized AI tools and services across 21 categories with transparent per-call pricing.',
  },
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

interface RecentTool {
  name: string
  slug: string
  description: string | null
  category: string | null
  currentVersion: string
  developerName: string | null
}

async function getRecentTools(): Promise<RecentTool[]> {
  try {
    return await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        currentVersion: tools.currentVersion,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.createdAt))
      .limit(6)
  } catch {
    return []
  }
}

export default async function ExplorePage() {
  const [countMap, totalTools, recentTools] = await Promise.all([
    getCategoryCounts(),
    getTotalToolCount(),
    getRecentTools(),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Explore AI Tools',
    description: 'Browse monetized AI tools across 13 categories on SettleGrid.',
    url: 'https://settlegrid.ai/explore',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    numberOfItems: totalTools,
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-14">
        <div className="max-w-6xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Explore AI Tools & Services
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Browse <span className="text-amber-400 font-semibold">{totalTools}</span> monetized
              AI tools across {CATEGORIES.length} categories. Every tool has transparent per-call pricing
              and works with any MCP-compatible agent.
            </p>
          </div>

          {/* Category Grid with Filter */}
          <ExploreCategoryFilter
            categories={CATEGORIES}
            countMap={Object.fromEntries(countMap)}
          />

          {/* Curated Collections */}
          <div className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-100">Curated Collections</h2>
              <Link
                href="/explore/collections"
                className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {COLLECTIONS.map((col) => (
                <Link
                  key={col.slug}
                  href={`/explore/collections/${col.slug}`}
                  className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <svg className="w-4.5 h-4.5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={col.icon} />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors leading-tight text-sm">
                        {col.title}
                      </h3>
                      <span className="text-xs text-gray-500">{col.toolSlugs.length} tools</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed line-clamp-2">
                    {col.description.split('.')[0]}.
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recently Added */}
          {recentTools.length > 0 && (
            <div className="mb-16">
              <h2 className="text-2xl font-bold text-gray-100 mb-6">Recently Added</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recentTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{tool.name}</h3>
                      {tool.category && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold shrink-0 ml-2">
                          {tool.category}
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-3">{tool.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                      <span className="text-xs text-gray-500 font-mono">v{tool.currentVersion}</span>
                      <span className="text-xs text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View tool &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            <Link
              href="/tools"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Full Tool Showcase
              </h3>
              <p className="text-sm text-gray-400">
                Search, filter, and compare every tool on SettleGrid with real-time pricing and reviews.
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
              List your tool on SettleGrid
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Every registered tool automatically gets its own SEO-optimized page, category listing, and directory visibility.
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
