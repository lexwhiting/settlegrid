import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { FRAMEWORKS, FRAMEWORK_SLUGS, getFrameworkBySlug } from '@/lib/frameworks'
import { getCategoryBySlug } from '@/lib/categories'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { getEffectiveCostCents } from '@/lib/pricing-utils'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return FRAMEWORK_SLUGS.map((framework) => ({ framework }))
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToolCard {
  name: string
  slug: string
  description: string | null
  category: string | null
  currentVersion: string
  totalInvocations: number
  verified: boolean
  developerName: string | null
  effectiveCostCents: number | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getActiveTools(): Promise<ToolCard[]> {
  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        currentVersion: tools.currentVersion,
        totalInvocations: tools.totalInvocations,
        verified: tools.verified,
        pricingConfig: tools.pricingConfig,
        developerName: developers.name,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.totalInvocations))
      .limit(200)

    return rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      description: r.description,
      category: r.category,
      currentVersion: r.currentVersion,
      totalInvocations: r.totalInvocations,
      verified: r.verified,
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
  params: Promise<{ framework: string }>
}): Promise<Metadata> {
  const { framework: fwSlug } = await params
  const fw = getFrameworkBySlug(fwSlug)
  if (!fw) return { title: 'Framework Not Found | SettleGrid' }

  const title = `Best MCP Tools for ${fw.name} Agents | SettleGrid`
  const description = `Discover the best MCP tools for ${fw.name} agents on SettleGrid. Browse tools with ${fw.language} integration guides, per-call pricing, and one-click setup.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/explore/for/${fwSlug}` },
    keywords: [
      `best MCP tools for ${fw.name}`,
      `${fw.name} agent tools`,
      `${fw.name} MCP integration`,
      `best tools for ${fw.name}`,
      'MCP tools directory',
      'SettleGrid',
    ],
    openGraph: { title, description, type: 'website', url: `https://settlegrid.ai/explore/for/${fwSlug}` },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function FrameworkToolsPage({
  params,
}: {
  params: Promise<{ framework: string }>
}) {
  const { framework: fwSlug } = await params
  const fw = getFrameworkBySlug(fwSlug)
  if (!fw) notFound()

  const allTools = await getActiveTools()
  const otherFrameworks = FRAMEWORKS.filter((f) => f.slug !== fw.slug)

  // Group tools by category
  const toolsByCategory = new Map<string, ToolCard[]>()
  for (const tool of allTools) {
    const cat = tool.category ?? 'other'
    const existing = toolsByCategory.get(cat)
    if (existing) {
      existing.push(tool)
    } else {
      toolsByCategory.set(cat, [tool])
    }
  }

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Explore', item: 'https://settlegrid.ai/explore' },
      { '@type': 'ListItem', position: 2, name: `For ${fw.name}`, item: `https://settlegrid.ai/explore/for/${fwSlug}` },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Best MCP Tools for ${fw.name} Agents`,
    description: `MCP tools compatible with ${fw.name} (${fw.language}).`,
    url: `https://settlegrid.ai/explore/for/${fwSlug}`,
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    numberOfItems: allTools.length,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: allTools.slice(0, 20).map((tool, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: tool.name,
        url: `https://settlegrid.ai/tools/${tool.slug}/with/${fwSlug}`,
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
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">For {fw.name}</span>
          </nav>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-100">
                  Best MCP Tools for {fw.name}
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                  {allTools.length} tool{allTools.length !== 1 ? 's' : ''} with {fw.language} integration
                </p>
              </div>
            </div>
            <p className="text-lg text-gray-400 max-w-3xl">
              {fw.description} Browse all SettleGrid tools with ready-to-use {fw.name} integration
              code. Each tool includes a step-by-step setup guide.
            </p>
          </div>

          {/* Framework Info Bar */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-100 mb-1">Quick Setup</h2>
                <p className="text-sm text-gray-400">
                  Install {fw.name}, pick a tool below, and follow the integration guide.
                </p>
              </div>
              <code className="text-sm font-mono bg-[#0D1117] text-amber-300 px-4 py-2 rounded-lg border border-[#252836] whitespace-nowrap">
                {fw.installCommand}
              </code>
            </div>
          </div>

          {/* Framework Switcher */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            {FRAMEWORKS.map((f) => (
              f.slug === fw.slug ? (
                <span key={f.slug} className="text-sm font-semibold bg-amber-500/15 text-amber-400 px-3 py-1.5 rounded-lg whitespace-nowrap">
                  {f.name}
                </span>
              ) : (
                <Link
                  key={f.slug}
                  href={`/explore/for/${f.slug}`}
                  className="text-sm font-medium text-gray-400 hover:text-gray-100 px-3 py-1.5 rounded-lg hover:bg-[#161822] transition-colors whitespace-nowrap"
                >
                  {f.name}
                </Link>
              )
            ))}
          </div>

          {/* Tool Cards by Category */}
          {allTools.length > 0 ? (
            <div className="space-y-12 mb-16">
              {Array.from(toolsByCategory.entries()).map(([catSlug, catTools]) => {
                const categoryDef = getCategoryBySlug(catSlug)
                return (
                  <section key={catSlug}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-gray-100">
                        {categoryDef?.name ?? 'Other'}
                      </h2>
                      {categoryDef && (
                        <Link
                          href={`/explore/category/${catSlug}`}
                          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          View all &rarr;
                        </Link>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {catTools.map((tool) => (
                        <Link
                          key={tool.slug}
                          href={`/tools/${tool.slug}/with/${fw.slug}`}
                          className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors truncate">
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
                              {categoryDef && (
                                <span className="text-xs rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5 font-medium">
                                  {categoryDef.name}
                                </span>
                              )}
                              {tool.totalInvocations > 0 && (
                                <span className="text-xs text-gray-500">{formatInvocations(tool.totalInvocations)} calls</span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-amber-400">
                              {tool.effectiveCostCents != null ? formatCents(tool.effectiveCostCents) : 'Variable'}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-12 text-center mb-16">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">No tools available yet</h2>
              <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                Be the first to publish an MCP tool on SettleGrid and get featured on this page.
              </p>
              <Link href="/register" className="inline-flex items-center bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors">
                Publish a Tool
              </Link>
            </div>
          )}

          {/* Other Frameworks */}
          <div className="mb-10">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Other Frameworks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {otherFrameworks.map((f) => (
                <Link
                  key={f.slug}
                  href={`/explore/for/${f.slug}`}
                  className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
                >
                  <h3 className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors mb-1">
                    {f.name}
                  </h3>
                  <p className="text-xs text-gray-500 mb-2">{f.language}</p>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    {f.description}
                  </p>
                </Link>
              ))}
            </div>
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
