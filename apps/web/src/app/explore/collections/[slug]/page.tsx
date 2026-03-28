import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { COLLECTIONS, COLLECTION_SLUGS, getCollectionBySlug } from '@/lib/collections'
import { getCategoryBySlug } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return COLLECTION_SLUGS.map((slug) => ({ slug }))
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CollectionTool {
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

async function getCollectionTools(toolSlugs: string[]): Promise<CollectionTool[]> {
  if (toolSlugs.length === 0) return []

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
      .where(and(eq(tools.status, 'active'), inArray(tools.slug, toolSlugs)))
      .limit(50)

    // Preserve the editorial ordering from the collection definition
    const toolMap = new Map(rows.map((r) => [r.slug, r]))
    return toolSlugs
      .map((s) => toolMap.get(s))
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map((r) => {
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
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const collection = getCollectionBySlug(slug)
  if (!collection) return { title: 'Collection Not Found | SettleGrid' }

  return {
    title: `${collection.title} | SettleGrid`,
    description: collection.description,
    alternates: { canonical: `https://settlegrid.ai/explore/collections/${slug}` },
    keywords: collection.keywords,
    openGraph: {
      title: `${collection.title} | SettleGrid`,
      description: collection.description,
      type: 'website',
      url: `https://settlegrid.ai/explore/collections/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${collection.title} | SettleGrid`,
      description: collection.description,
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

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const collection = getCollectionBySlug(slug)
  if (!collection) notFound()

  const collectionTools = await getCollectionTools(collection.toolSlugs)

  // Adjacent collections for prev/next navigation
  const colIndex = COLLECTIONS.findIndex((c) => c.slug === slug)
  const prevCol = colIndex > 0 ? COLLECTIONS[colIndex - 1] : COLLECTIONS[COLLECTIONS.length - 1]
  const nextCol = colIndex < COLLECTIONS.length - 1 ? COLLECTIONS[colIndex + 1] : COLLECTIONS[0]

  // Related categories
  const relatedCats = collection.relatedCategories
    .map((s) => getCategoryBySlug(s))
    .filter((c): c is NonNullable<typeof c> => c != null)

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: 'Collections', item: 'https://settlegrid.ai/explore/collections' },
      { '@type': 'ListItem', position: 3, name: collection.title, item: `https://settlegrid.ai/explore/collections/${slug}` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: collection.title,
    description: collection.description,
    url: `https://settlegrid.ai/explore/collections/${slug}`,
    numberOfItems: collectionTools.length,
    itemListElement: collectionTools.map((tool, i) => ({
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
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <span aria-hidden="true">/</span>
            <Link href="/explore/collections" className="hover:text-gray-100 transition-colors">Collections</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">{collection.title.split(' for ')[0]}</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={collection.icon} />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  {collection.title}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {collectionTools.length} tool{collectionTools.length !== 1 ? 's' : ''} featured
                </p>
              </div>
            </div>
          </div>

          {/* Editorial Intro */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-10">
            <p className="text-gray-300 leading-relaxed">
              {collection.intro}
            </p>
          </div>

          {/* Tool List */}
          {collectionTools.length > 0 ? (
            <div className="mb-16">
              <h2 className="text-xl font-bold text-gray-100 mb-6">Featured Tools</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {collectionTools.map((tool, i) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-mono w-5 shrink-0">#{i + 1}</span>
                        <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                          {tool.name}
                        </h3>
                      </div>
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
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-12 text-center mb-16">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={collection.icon} />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">
                Tools coming soon
              </h2>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                We&apos;re curating the best tools for this collection. Register your tool and it could be featured here.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                Publish a Tool
              </Link>
            </div>
          )}

          {/* Related Categories */}
          {relatedCats.length > 0 && (
            <div className="mb-10">
              <h2 className="text-lg font-bold text-gray-100 mb-4">Related Categories</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {relatedCats.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/explore/category/${cat.slug}`}
                    className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{cat.name}</p>
                        <p className="text-xs text-gray-400">{cat.description.split('.')[0]}.</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Guide CTA */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-8 mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-100 mb-1">
                  Looking for more tools?
                </h3>
                <p className="text-sm text-gray-400">
                  Browse all collections or explore tools by category to find exactly what your AI agent needs.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/explore/collections"
                  className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
                >
                  All collections &rarr;
                </Link>
                <Link
                  href="/guides"
                  className="text-sm font-semibold text-gray-400 hover:text-gray-300 transition-colors whitespace-nowrap"
                >
                  Guides &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Adjacent Collections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/explore/collections/${prevCol.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">&larr; Previous collection</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{prevCol.title}</p>
            </Link>
            <Link
              href={`/explore/collections/${nextCol.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group text-right"
            >
              <p className="text-xs text-gray-500 mb-1">Next collection &rarr;</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">{nextCol.title}</p>
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
