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
  pricingConfig: unknown
  totalInvocations: number
  developerName: string | null
  effectiveCostCents: number | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getCheapestTools(categorySlug: string): Promise<RankedTool[]> {
  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        currentVersion: tools.currentVersion,
        pricingConfig: tools.pricingConfig,
        totalInvocations: tools.totalInvocations,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.status, 'active'), eq(tools.category, categorySlug)))
      .orderBy(desc(tools.totalInvocations))
      .limit(200)

    return rows
      .map((r) => ({
        name: r.name,
        slug: r.slug,
        description: r.description,
        currentVersion: r.currentVersion,
        pricingConfig: r.pricingConfig,
        totalInvocations: r.totalInvocations,
        developerName: r.developerName,
        effectiveCostCents: getEffectiveCostCents(r.pricingConfig),
      }))
      .sort((a, b) => {
        // Tools with deterministic pricing first, sorted by cost ascending
        if (a.effectiveCostCents != null && b.effectiveCostCents != null) {
          return a.effectiveCostCents - b.effectiveCostCents
        }
        if (a.effectiveCostCents != null) return -1
        if (b.effectiveCostCents != null) return 1
        return 0
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

  const title = `Cheapest ${category.name} Tools | SettleGrid`
  const description = `Compare the cheapest ${category.name.toLowerCase()} MCP tools on SettleGrid. Sorted by per-call cost so you can find the most affordable option for your AI agents.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/explore/category/${cat}/cheapest` },
    keywords: [
      `cheapest ${category.name.toLowerCase()} MCP tools`,
      `affordable ${category.name.toLowerCase()} API`,
      `${category.name.toLowerCase()} tool pricing`,
      'cheap MCP tools',
      'SettleGrid pricing',
    ],
    openGraph: { title, description, type: 'website', url: `https://settlegrid.ai/explore/category/${cat}/cheapest` },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function CheapestCategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>
}) {
  const { cat } = await params
  const category = getCategoryBySlug(cat)
  if (!category) notFound()

  const rankedTools = await getCheapestTools(cat)

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: category.name, item: `https://settlegrid.ai/explore/category/${cat}` },
      { '@type': 'ListItem', position: 3, name: 'Cheapest', item: `https://settlegrid.ai/explore/category/${cat}/cheapest` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Cheapest ${category.name} Tools on SettleGrid`,
    description: `${category.name} MCP tools sorted by price, lowest first.`,
    url: `https://settlegrid.ai/explore/category/${cat}/cheapest`,
    numberOfItems: rankedTools.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
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
            <span className="text-gray-100">Cheapest</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  Cheapest {category.name} Tools
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {rankedTools.length} tool{rankedTools.length !== 1 ? 's' : ''} sorted by price
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-400 max-w-3xl">
              Find the most affordable {category.name.toLowerCase()} MCP tools on SettleGrid.
              Sorted by effective per-call cost so you can optimize your agent&apos;s budget.
            </p>
          </div>

          {/* Ranking Tabs */}
          <div className="flex items-center gap-2 mb-8">
            <span className="text-sm font-semibold bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg">Cheapest</span>
            <Link href={`/explore/category/${cat}/top`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Most Popular</Link>
            <Link href={`/explore/category/${cat}/reliable`} className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors">Most Reliable</Link>
          </div>

          {/* Pricing Comparison Table */}
          {rankedTools.length > 0 ? (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] overflow-hidden mb-16">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left text-gray-500 font-medium px-6 py-4 w-12">#</th>
                      <th className="text-left text-gray-500 font-medium px-6 py-4">Tool</th>
                      <th className="text-left text-gray-500 font-medium px-6 py-4">Developer</th>
                      <th className="text-right text-gray-500 font-medium px-6 py-4">Cost / Call</th>
                      <th className="text-right text-gray-500 font-medium px-6 py-4">Usage</th>
                      <th className="text-left text-gray-500 font-medium px-6 py-4">Version</th>
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
                          <span className="font-semibold text-green-400">
                            {tool.effectiveCostCents != null ? formatCents(tool.effectiveCostCents) : 'Variable'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-400">
                          {tool.totalInvocations > 0 ? formatInvocations(tool.totalInvocations) : '--'}
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">v{tool.currentVersion}</td>
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
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
