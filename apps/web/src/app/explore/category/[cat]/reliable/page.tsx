import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { CATEGORY_SLUGS, getCategoryBySlug } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools, developers, toolHealthChecks } from '@/lib/db/schema'
import { eq, and, desc, sql, count } from 'drizzle-orm'
import { getEffectiveCostCents } from '@/lib/pricing-utils'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((cat) => ({ cat }))
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReliableTool {
  name: string
  slug: string
  description: string | null
  currentVersion: string
  totalInvocations: number
  developerName: string | null
  effectiveCostCents: number | null
  totalChecks: number
  upChecks: number
  uptimePct: number
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getReliableTools(categorySlug: string): Promise<ReliableTool[]> {
  try {
    // First get the tools in this category
    const toolRows = await db
      .select({
        id: tools.id,
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

    if (toolRows.length === 0) return []

    // Get health check stats per tool using a subquery
    const toolIds = toolRows.map((t) => t.id)
    const healthStats = await db
      .select({
        toolId: toolHealthChecks.toolId,
        totalChecks: count(),
        upChecks: sql<number>`count(*) filter (where ${toolHealthChecks.status} = 'up')`.as('up_checks'),
      })
      .from(toolHealthChecks)
      .where(sql`${toolHealthChecks.toolId} = ANY(${toolIds})`)
      .groupBy(toolHealthChecks.toolId)
      .limit(200)

    const healthMap = new Map(healthStats.map((h) => [h.toolId, h]))

    return toolRows
      .map((r) => {
        const health = healthMap.get(r.id)
        const totalChecks = health ? Number(health.totalChecks) : 0
        const upChecks = health ? Number(health.upChecks) : 0
        const uptimePct = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : 100

        return {
          name: r.name,
          slug: r.slug,
          description: r.description,
          currentVersion: r.currentVersion,
          totalInvocations: r.totalInvocations,
          developerName: r.developerName,
          effectiveCostCents: getEffectiveCostCents(r.pricingConfig),
          totalChecks,
          upChecks,
          uptimePct,
        }
      })
      .sort((a, b) => {
        // Sort by uptime descending, then by total checks descending (more data = more reliable signal)
        if (a.uptimePct !== b.uptimePct) return b.uptimePct - a.uptimePct
        return b.totalChecks - a.totalChecks
      })
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

function uptimeColor(pct: number): string {
  if (pct >= 99) return 'text-green-400'
  if (pct >= 95) return 'text-yellow-400'
  return 'text-red-400'
}

function uptimeBgColor(pct: number): string {
  if (pct >= 99) return 'bg-green-500/60'
  if (pct >= 95) return 'bg-yellow-500/60'
  return 'bg-red-500/60'
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

  const title = `Most Reliable ${category.name} Tools | SettleGrid`
  const description = `Find the most reliable ${category.name.toLowerCase()} API tools on SettleGrid. Ranked by uptime and health check success rate so you can build dependable AI agents.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/explore/category/${cat}/reliable` },
    keywords: [
      `reliable ${category.name.toLowerCase()} API tools`,
      `${category.name.toLowerCase()} tool uptime`,
      `dependable ${category.name.toLowerCase()} MCP`,
      'reliable MCP tools',
      'SettleGrid reliability',
    ],
    openGraph: { title, description, type: 'website', url: `https://settlegrid.ai/explore/category/${cat}/reliable` },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ReliableCategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>
}) {
  const { cat } = await params
  const category = getCategoryBySlug(cat)
  if (!category) notFound()

  const rankedTools = await getReliableTools(cat)

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: category.name, item: `https://settlegrid.ai/explore/category/${cat}` },
      { '@type': 'ListItem', position: 3, name: 'Most Reliable', item: `https://settlegrid.ai/explore/category/${cat}/reliable` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Most Reliable ${category.name} Tools on SettleGrid`,
    description: `${category.name} MCP tools ranked by uptime and reliability.`,
    url: `https://settlegrid.ai/explore/category/${cat}/reliable`,
    numberOfItems: rankedTools.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: rankedTools.slice(0, 20).map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: tool.name,
      url: `https://settlegrid.ai/tools/${tool.slug}`,
    })),
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
            <span className="text-gray-100">Most Reliable</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  Most Reliable {category.name} Tools
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {rankedTools.length} tool{rankedTools.length !== 1 ? 's' : ''} ranked by uptime
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-400 max-w-3xl">
              The most dependable {category.name.toLowerCase()} MCP tools on SettleGrid.
              Ranked by health check uptime so you can build agents that don&apos;t break.
            </p>
          </div>

          {/* Ranking Tabs */}
          <div className="flex items-center gap-2 mb-8">
            <Link href={`/explore/category/${cat}/cheapest`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Cheapest</Link>
            <Link href={`/explore/category/${cat}/top`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Most Popular</Link>
            <span className="text-sm font-semibold bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg">Most Reliable</span>
          </div>

          {/* Reliability Table */}
          {rankedTools.length > 0 ? (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] overflow-hidden mb-16">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left text-gray-500 font-medium px-6 py-4 w-12">#</th>
                      <th className="text-left text-gray-500 font-medium px-6 py-4">Tool</th>
                      <th className="text-left text-gray-500 font-medium px-6 py-4">Developer</th>
                      <th className="text-right text-gray-500 font-medium px-6 py-4">Uptime</th>
                      <th className="text-right text-gray-500 font-medium px-6 py-4">Health Checks</th>
                      <th className="text-right text-gray-500 font-medium px-6 py-4">Cost / Call</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedTools.map((tool, i) => (
                      <tr key={tool.slug} className="border-b border-[#252836] last:border-0 hover:bg-[#1A1D2A] transition-colors">
                        <td className="px-6 py-4 text-gray-500 font-mono">{i + 1}</td>
                        <td className="px-6 py-4">
                          <Link href={`/tools/${tool.slug}`} className="font-medium text-gray-100 hover:text-amber-400 transition-colors">
                            {tool.name}
                          </Link>
                          {tool.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{tool.description}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-400">{tool.developerName ?? 'Unknown'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-[#252836] rounded-full h-2">
                              <div
                                className={`${uptimeBgColor(tool.uptimePct)} rounded-full h-2`}
                                style={{ width: `${tool.uptimePct}%` }}
                              />
                            </div>
                            <span className={`font-semibold ${uptimeColor(tool.uptimePct)}`}>
                              {tool.totalChecks > 0 ? `${tool.uptimePct}%` : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400 font-mono text-xs">
                          {tool.totalChecks > 0 ? `${tool.upChecks}/${tool.totalChecks}` : '--'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-amber-400">
                            {tool.effectiveCostCents != null ? formatCents(tool.effectiveCostCents) : 'Variable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-12 text-center mb-16">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
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
