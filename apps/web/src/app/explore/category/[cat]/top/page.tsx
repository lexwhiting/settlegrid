import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { CATEGORY_SLUGS, getCategoryBySlug } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getEffectiveCostCents } from '@/lib/pricing-utils'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((cat) => ({ cat }))
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface RankedTool {
  name: string
  slug: string
  description: string | null
  currentVersion: string
  totalInvocations: number
  developerName: string | null
  effectiveCostCents: number | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getTopTools(categorySlug: string): Promise<RankedTool[]> {
  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        currentVersion: tools.currentVersion,
        totalInvocations: tools.totalInvocations,
        pricingConfig: tools.pricingConfig,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.status, 'active'), eq(tools.category, categorySlug)))
      .orderBy(desc(tools.totalInvocations))
      .limit(200)

    return rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      description: r.description,
      currentVersion: r.currentVersion,
      totalInvocations: r.totalInvocations,
      developerName: r.developerName,
      effectiveCostCents: getEffectiveCostCents(r.pricingConfig),
    }))
  } catch {
    return []
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return cents < 100
    ? `${cents}\u00A2`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatInvocations(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>
}): Promise<Metadata> {
  const { cat } = await params
  const category = getCategoryBySlug(cat)
  if (!category) return { title: 'Category Not Found | SettleGrid' }

  const title = `Top ${category.name} Tools | SettleGrid`
  const description = `Discover the most popular ${category.name.toLowerCase()} MCP tools on SettleGrid. Ranked by total usage so you can find the best and most battle-tested tools for your AI agents.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/explore/category/${cat}/top` },
    keywords: [
      `best ${category.name.toLowerCase()} MCP tools`,
      `top ${category.name.toLowerCase()} API`,
      `popular ${category.name.toLowerCase()} tools`,
      'best MCP tools',
      'SettleGrid',
    ],
    openGraph: { title, description, type: 'website', url: `https://settlegrid.ai/explore/category/${cat}/top` },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function TopCategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>
}) {
  const { cat } = await params
  const category = getCategoryBySlug(cat)
  if (!category) notFound()

  const rankedTools = await getTopTools(cat)

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: category.name, item: `https://settlegrid.ai/explore/category/${cat}` },
      { '@type': 'ListItem', position: 3, name: 'Top', item: `https://settlegrid.ai/explore/category/${cat}/top` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Top ${category.name} Tools on SettleGrid`,
    description: `${category.name} MCP tools ranked by popularity.`,
    url: `https://settlegrid.ai/explore/category/${cat}/top`,
    numberOfItems: rankedTools.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: rankedTools.slice(0, 20).map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      url: `https://settlegrid.ai/tools/${tool.slug}`,
    })),
  }

  // Calculate total invocations across all tools for percentage bars
  const maxInvocations = rankedTools.length > 0
    ? Math.max(...rankedTools.map((t) => t.totalInvocations))
    : 1

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

      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/explore/category/${cat}`} className="hover:text-gray-100 transition-colors">{category.name}</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">Top</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m4.31.023A17.96 17.96 0 0 0 12 13.5a17.96 17.96 0 0 0-8.57-3.749" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  Top {category.name} Tools
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {rankedTools.length} tool{rankedTools.length !== 1 ? 's' : ''} ranked by popularity
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-400 max-w-3xl">
              The most used {category.name.toLowerCase()} MCP tools on SettleGrid.
              Ranked by total invocations &mdash; more usage means more battle-tested reliability.
            </p>
          </div>

          {/* Ranking Tabs */}
          <div className="flex items-center gap-2 mb-8">
            <Link href={`/explore/category/${cat}/cheapest`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Cheapest</Link>
            <span className="text-sm font-semibold bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg">Most Popular</span>
            <Link href={`/explore/category/${cat}/reliable`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Most Reliable</Link>
          </div>

          {/* Tool Rankings */}
          {rankedTools.length > 0 ? (
            <div className="space-y-3 mb-16">
              {rankedTools.map((tool, i) => {
                const barWidth = maxInvocations > 0
                  ? Math.max(2, Math.round((tool.totalInvocations / maxInvocations) * 100))
                  : 2
                return (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group flex items-center gap-4 bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <span className="text-2xl font-bold text-gray-600 w-10 text-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors truncate">
                          {tool.name}
                        </h3>
                        <span className="text-xs text-gray-500 font-mono shrink-0">v{tool.currentVersion}</span>
                      </div>
                      {tool.description && (
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">{tool.description}</p>
                      )}
                      {/* Usage bar */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-[#252836] rounded-full h-2 max-w-xs">
                          <div
                            className="bg-amber-500/60 rounded-full h-2 transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs text-amber-400 font-semibold whitespace-nowrap">
                          {formatInvocations(tool.totalInvocations)} calls
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-amber-400">
                        {tool.effectiveCostCents != null ? formatCents(tool.effectiveCostCents) : 'Variable'}
                      </span>
                      <p className="text-xs text-gray-500">per call</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-12 text-center mb-16">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m4.31.023A17.96 17.96 0 0 0 12 13.5a17.96 17.96 0 0 0-8.57-3.749" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">No {category.name} tools yet</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Be the first to publish a {category.name.toLowerCase()} tool on SettleGrid.
              </p>
              <Link href="/register" className="inline-flex items-center bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors">
                Publish a Tool
              </Link>
            </div>
          )}

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/explore/category/${cat}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">Browse all</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {category.name} tools on SettleGrid
              </p>
            </Link>
            <Link
              href={`/guides/monetize-${cat}-tools`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">Guide</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                How to monetize {category.name.toLowerCase()} tools
              </p>
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
