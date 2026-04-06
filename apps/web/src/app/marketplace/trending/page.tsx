import Link from 'next/link'
import type { Metadata } from 'next'
import { sql, desc } from 'drizzle-orm'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { db } from '@/lib/db'
import { tools, invocations } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { getCategoryBySlug } from '@/lib/categories'

export const metadata: Metadata = {
  title: 'Trending AI Tools This Week | SettleGrid',
  description:
    'Discover the most popular AI tools, MCP servers, and APIs on SettleGrid this week. See top tools by popularity and newly added tools.',
  alternates: { canonical: 'https://settlegrid.ai/marketplace/trending' },
  openGraph: {
    title: 'Trending AI Tools This Week | SettleGrid',
    description:
      'Discover the most popular AI tools, MCP servers, and APIs on SettleGrid this week.',
    type: 'website',
    url: 'https://settlegrid.ai/marketplace/trending',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trending AI Tools This Week | SettleGrid',
    description:
      'Discover the most popular AI tools, MCP servers, and APIs on SettleGrid this week.',
  },
}

// ── Types ──────────────────────────────────────────────────────────────────

interface TrendingTool {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  toolType: string
  popularity: number
  popularityLabel: string
}

interface NewTool {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  toolType: string
  createdAt: Date
}

interface CategoryCount {
  category: string
  toolCount: number
}

// ── Data Fetching ──────────────────────────────────────────────────────────

const LOOKBACK_DAYS = 7
const TOP_LIMIT = 10

/**
 * Returns the most popular tools. Prefers invocation data from the last 7 days
 * when available; otherwise falls back to crawl_metadata popularity signals
 * (downloads, stars) from the source ecosystem.
 */
async function getPopularTools(): Promise<TrendingTool[]> {
  const oneWeekAgo = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Try invocation-based ranking first
    const invocationRows = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: sql<string | null>`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`,
        toolType: tools.toolType,
        popularity: sql<number>`count(${invocations.id})::int`,
      })
      .from(invocations)
      .innerJoin(tools, sql`${invocations.toolId} = ${tools.id}`)
      .where(
        sql`${invocations.createdAt} >= ${oneWeekAgo}::timestamptz
          AND ${invocations.isTest} = false
          AND ${tools.status} IN ('active', 'unclaimed')`
      )
      .groupBy(tools.id, tools.name, tools.slug, tools.description, sql`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`, tools.toolType)
      .orderBy(sql`count(${invocations.id}) DESC`)
      .limit(TOP_LIMIT)

    if (invocationRows.length >= 3) {
      return invocationRows.map((r) => ({
        ...r,
        popularityLabel: `${r.popularity.toLocaleString()} calls this week`,
      }))
    }

    // Fallback: rank by crawl_metadata popularity signals.
    // Use regexp guard to safely cast JSONB text values that might be non-numeric.
    const POPULARITY_EXPR = sql.raw(`
      CASE WHEN crawl_metadata->>'popularityCount' ~ '^[0-9]+$'
           THEN (crawl_metadata->>'popularityCount')::bigint ELSE 0 END
      + CASE WHEN crawl_metadata->>'usageCount' ~ '^[0-9]+$'
             THEN (crawl_metadata->>'usageCount')::bigint ELSE 0 END
      + CASE WHEN crawl_metadata->>'starCount' ~ '^[0-9]+$'
             THEN (crawl_metadata->>'starCount')::bigint ELSE 0 END * 100
    `)

    const metadataRows = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: sql<string | null>`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`,
        toolType: tools.toolType,
        popularity: sql<number>`(${POPULARITY_EXPR})::int`,
      })
      .from(tools)
      .where(
        sql`${tools.status} IN ('active', 'unclaimed')
          AND ${tools.crawlMetadata} IS NOT NULL
          AND (${POPULARITY_EXPR}) > 0`
      )
      .orderBy(sql`(${POPULARITY_EXPR}) DESC`)
      .limit(TOP_LIMIT)

    return metadataRows.map((r) => {
      const pop = r.popularity ?? 0
      const label = pop >= 1_000_000
        ? `${(pop / 1_000_000).toFixed(1)}M downloads`
        : pop >= 1_000
          ? `${(pop / 1_000).toFixed(0)}K downloads`
          : `${pop.toLocaleString()} downloads`
      return { ...r, popularityLabel: label }
    })
  } catch (err) {
    logger.error('trending.popular_tools_failed', {}, err)
    return []
  }
}

async function getNewlyAddedTools(): Promise<NewTool[]> {
  const oneWeekAgo = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  try {
    const rows = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: sql<string | null>`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`,
        toolType: tools.toolType,
        createdAt: tools.createdAt,
      })
      .from(tools)
      .where(
        sql`${tools.createdAt} >= ${oneWeekAgo}::timestamptz
          AND ${tools.status} IN ('active', 'unclaimed')`
      )
      .orderBy(desc(tools.createdAt))
      .limit(TOP_LIMIT)

    return rows
  } catch (err) {
    logger.error('trending.new_tools_failed', {}, err)
    return []
  }
}

async function getCategoryBreakdown(): Promise<CategoryCount[]> {
  try {
    const rows = await db
      .select({
        category: sql<string>`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`,
        toolCount: sql<number>`count(*)::int`,
      })
      .from(tools)
      .where(
        sql`${tools.status} IN ('active', 'unclaimed')
          AND COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory') IS NOT NULL`
      )
      .groupBy(sql`COALESCE(${tools.category}, ${tools.crawlMetadata}->>'detectedCategory')`)
      .orderBy(sql`count(*) DESC`)
      .limit(TOP_LIMIT)

    return rows.filter((r): r is CategoryCount => r.category !== null)
  } catch (err) {
    logger.error('trending.category_breakdown_failed', {}, err)
    return []
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export default async function TrendingPage() {
  const [popularTools, newTools, categoryBreakdown] = await Promise.all([
    getPopularTools(),
    getNewlyAddedTools(),
    getCategoryBreakdown(),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Trending AI Tools on SettleGrid',
    description: 'Top AI tools by popularity this week on SettleGrid.',
    url: 'https://settlegrid.ai/marketplace/trending',
    numberOfItems: popularTools.length,
    itemListElement: popularTools.map((tool, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: tool.name,
      url: `https://settlegrid.ai/tools/${tool.slug}`,
    })),
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <Navbar />

      <main className="flex-1 px-6 py-12 pt-14">
        <div className="max-w-5xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
          />

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <Link
                href="/marketplace"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                Marketplace
              </Link>
              <span className="text-gray-600">/</span>
              <span className="text-sm text-gray-300">Trending</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-3 font-display">
              Trending This Week
            </h1>
            <p className="text-gray-400 max-w-2xl">
              The most popular AI tools, newest additions, and top categories on SettleGrid.
            </p>
          </div>

          {/* Popular Tools */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                <path d="M12 18a3.75 3.75 0 0 0 .495-7.468 5.99 5.99 0 0 0-1.925 3.547 5.975 5.975 0 0 1-2.133-1.001A3.75 3.75 0 0 0 12 18Z" />
              </svg>
              Most Popular
            </h2>
            {popularTools.length === 0 ? (
              <p className="text-gray-500 text-sm">No popularity data available yet.</p>
            ) : (
              <div className="space-y-2">
                {popularTools.map((tool, idx) => {
                  const catDef = tool.category ? getCategoryBySlug(tool.category) : null
                  return (
                    <Link
                      key={tool.id}
                      href={`/tools/${tool.slug}`}
                      className="flex items-center gap-4 rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 hover:border-amber-500/40 transition-colors group"
                    >
                      <span className="text-lg font-bold text-gray-600 w-8 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors truncate">
                            {tool.name}
                          </span>
                          {catDef && (
                            <span className="hidden sm:inline text-xs text-gray-500 bg-[#0C0E14] px-2 py-0.5 rounded-full">
                              {catDef.name}
                            </span>
                          )}
                        </div>
                        {tool.description && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {tool.description.slice(0, 120)}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-amber-400 whitespace-nowrap">
                        {tool.popularityLabel}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Newly Added Tools */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New This Week
            </h2>
            {newTools.length === 0 ? (
              <p className="text-gray-500 text-sm">No new tools added this week.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newTools.map((tool) => {
                  const catDef = tool.category ? getCategoryBySlug(tool.category) : null
                  return (
                    <Link
                      key={tool.id}
                      href={`/tools/${tool.slug}`}
                      className="rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 hover:border-green-500/40 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-100 group-hover:text-green-400 transition-colors truncate text-sm">
                          {tool.name}
                        </span>
                        {catDef && (
                          <span className="text-xs text-gray-500 bg-[#0C0E14] px-2 py-0.5 rounded-full">
                            {catDef.name}
                          </span>
                        )}
                      </div>
                      {tool.description && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {tool.description.slice(0, 150)}
                        </p>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Top Categories */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-gray-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              Top Categories
            </h2>
            {categoryBreakdown.length === 0 ? (
              <p className="text-gray-500 text-sm">No category data available yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {categoryBreakdown.map((cat) => {
                  const catDef = getCategoryBySlug(cat.category)
                  return (
                    <Link
                      key={cat.category}
                      href={`/explore/category/${cat.category}`}
                      className="rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 text-center hover:border-blue-500/40 transition-colors group"
                    >
                      <span className="block text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">
                        {catDef?.name ?? cat.category}
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {cat.toolCount.toLocaleString()} {cat.toolCount === 1 ? 'tool' : 'tools'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-xl font-bold text-gray-100 mb-2">
              Want your tool on this list?
            </h2>
            <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm">
              List your AI tool, MCP server, or API on SettleGrid and start earning per-call revenue.
            </p>
            <Link
              href="/register"
              className="inline-block bg-brand text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building — Free
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
