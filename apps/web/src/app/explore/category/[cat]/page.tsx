import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { CATEGORIES, CATEGORY_SLUGS, getCategoryBySlug } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((cat) => ({ cat }))
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CategoryTool {
  name: string
  slug: string
  description: string | null
  currentVersion: string
  totalInvocations: number
  verified: boolean
  developerName: string | null
  developerSlug: string | null
  pricingModel: string | null
  defaultCostCents: number | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getCategoryTools(categorySlug: string): Promise<CategoryTool[]> {
  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        currentVersion: tools.currentVersion,
        totalInvocations: tools.totalInvocations,
        verified: tools.verified,
        pricingConfig: tools.pricingConfig,
        developerName: developers.name,
        developerSlug: developers.slug,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.status, 'active'), eq(tools.category, categorySlug)))
      .orderBy(desc(tools.totalInvocations))
      .limit(200)

    return rows.map((r) => {
      const pc = (r.pricingConfig && typeof r.pricingConfig === 'object') ? (r.pricingConfig as Record<string, unknown>) : null
      return {
        name: r.name,
        slug: r.slug,
        description: r.description,
        currentVersion: r.currentVersion,
        totalInvocations: r.totalInvocations,
        verified: r.verified,
        developerName: r.developerName,
        developerSlug: r.developerSlug ?? null,
        pricingModel: typeof pc?.model === 'string' ? pc.model : null,
        defaultCostCents: typeof pc?.defaultCostCents === 'number' && Number.isFinite(pc.defaultCostCents) ? pc.defaultCostCents : null,
      }
    })
  } catch {
    return []
  }
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

  return {
    title: `${category.name} AI Tools | SettleGrid`,
    description: category.description,
    alternates: { canonical: `https://settlegrid.ai/explore/category/${cat}` },
    keywords: category.keywords,
    openGraph: {
      title: `${category.name} AI Tools | SettleGrid`,
      description: category.description,
      type: 'website',
      url: `https://settlegrid.ai/explore/category/${cat}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${category.name} AI Tools | SettleGrid`,
      description: category.description,
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPrice(model: string | null, cents: number | null): string {
  if (model === 'per-token') return 'Per token'
  if (model === 'per-byte') return 'Per MB'
  if (model === 'per-second') return 'Per second'
  if (model === 'tiered') return 'Tiered'
  if (model === 'outcome') return 'Outcome-based'
  if (cents == null || cents === 0) return 'Free'
  return cents < 100
    ? `${cents}\u00A2/call`
    : `$${(cents / 100).toFixed(2)}/call`
}

function formatInvocations(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>
}) {
  const { cat } = await params
  const category = getCategoryBySlug(cat)
  if (!category) notFound()

  const categoryTools = await getCategoryTools(cat)

  // Find adjacent categories for cross-linking
  const catIndex = CATEGORIES.findIndex((c) => c.slug === cat)
  const prevCat = catIndex > 0 ? CATEGORIES[catIndex - 1] : CATEGORIES[CATEGORIES.length - 1]
  const nextCat = catIndex < CATEGORIES.length - 1 ? CATEGORIES[catIndex + 1] : CATEGORIES[0]

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: category.name, item: `https://settlegrid.ai/explore/category/${cat}` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} AI Tools`,
    description: category.description,
    url: `https://settlegrid.ai/explore/category/${cat}`,
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    numberOfItems: categoryTools.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: categoryTools.slice(0, 20).map((tool, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tool.name,
        url: `https://settlegrid.ai/tools/${tool.slug}`,
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

      <main className="flex-1 px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">{category.name}</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  {category.name} Tools
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {categoryTools.length} tool{categoryTools.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-400 max-w-3xl">
              {category.description}
            </p>
          </div>

          {/* Tool List */}
          {categoryTools.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
              {categoryTools.map((tool) => (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                      {tool.name}
                    </h3>
                    {tool.verified && (
                      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24" aria-label="Verified">
                        <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {tool.description && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-2">
                      {tool.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-mono">v{tool.currentVersion}</span>
                      {tool.totalInvocations > 0 && (
                        <span className="text-xs text-gray-500">{formatInvocations(tool.totalInvocations)} calls</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-amber-400">
                      {formatPrice(tool.pricingModel, tool.defaultCostCents)}
                    </span>
                  </div>
                  {/* Developer name hidden until multi-developer adoption */}
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-12 text-center mb-16">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">
                No {category.name} tools yet
              </h2>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Be the first to publish a {category.name.toLowerCase()} tool on SettleGrid and get featured in this category.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                Publish a Tool
              </Link>
            </div>
          )}

          {/* Guide CTA */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-8 mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-100 mb-1">
                  How to monetize {category.name.toLowerCase()} tools
                </h3>
                <p className="text-sm text-gray-400">
                  Pricing strategies, market sizing, and revenue benchmarks for {category.name.toLowerCase()} MCP tools.
                </p>
              </div>
              <Link
                href={`/guides/monetize-${cat}-tools`}
                className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                Read the guide &rarr;
              </Link>
            </div>
          </div>

          {/* Adjacent Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/explore/category/${prevCat.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">&larr; Previous category</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{prevCat.name}</p>
            </Link>
            <Link
              href={`/explore/category/${nextCat.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group text-right"
            >
              <p className="text-xs text-gray-500 mb-1">Next category &rarr;</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{nextCat.name}</p>
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
