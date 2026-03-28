import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { db } from '@/lib/db'
import { tools, developers } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getCategoryBySlug } from '@/lib/categories'
import { FRAMEWORKS, getFrameworkBySlug, generateCodeExample } from '@/lib/frameworks'
import { getEffectiveCostCents } from '@/lib/pricing-utils'

// ─── Static Generation ──────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    // Limit to top 100 tools × 6 frameworks = 600 static pages; rest are ISR
    const topTools = await db
      .select({ slug: tools.slug })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .orderBy(desc(tools.totalInvocations))
      .limit(100)

    const params: { slug: string; framework: string }[] = []
    for (const tool of topTools) {
      if (!tool.slug) continue
      for (const fw of FRAMEWORKS) {
        params.push({ slug: tool.slug, framework: fw.slug })
      }
    }
    return params
  } catch {
    return []
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ToolRow {
  name: string
  slug: string
  description: string | null
  category: string | null
  currentVersion: string
  pricingConfig: unknown
  totalInvocations: number
  developerName: string | null
  developerSlug: string | null
}

// ─── Data ───────────────────────────────────────────────────────────────────

async function getToolBySlug(slug: string): Promise<ToolRow | null> {
  try {
    const rows = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        currentVersion: tools.currentVersion,
        pricingConfig: tools.pricingConfig,
        totalInvocations: tools.totalInvocations,
        developerName: developers.name,
        developerSlug: developers.slug,
      })
      .from(tools)
      .innerJoin(developers, eq(tools.developerId, developers.id))
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    return rows[0] ?? null
  } catch {
    return null
  }
}

async function getRelatedTools(category: string, excludeSlug: string) {
  try {
    return await db
      .select({ name: tools.name, slug: tools.slug })
      .from(tools)
      .where(and(eq(tools.status, 'active'), eq(tools.category, category)))
      .orderBy(desc(tools.totalInvocations))
      .limit(6)
      .then((rows) => rows.filter((r) => r.slug !== excludeSlug).slice(0, 5))
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

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; framework: string }>
}): Promise<Metadata> {
  const { slug, framework: fwSlug } = await params
  const [tool, fw] = await Promise.all([
    getToolBySlug(slug),
    Promise.resolve(getFrameworkBySlug(fwSlug)),
  ])
  if (!tool || !fw) return { title: 'Not Found | SettleGrid' }

  const title = `How to use ${tool.name} with ${fw.name} | SettleGrid`
  const description = `Step-by-step guide to integrating ${tool.name} into your ${fw.name} agent. Includes ${fw.language} code examples, pricing info, and setup instructions.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/tools/${slug}/with/${fwSlug}` },
    keywords: [
      `${tool.name} ${fw.name}`,
      `${fw.name} MCP tool`,
      `${tool.name} integration`,
      `${fw.name} agent tools`,
      'MCP tool integration',
      'SettleGrid',
    ],
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://settlegrid.ai/tools/${slug}/with/${fwSlug}`,
    },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ToolFrameworkPage({
  params,
}: {
  params: Promise<{ slug: string; framework: string }>
}) {
  const { slug, framework: fwSlug } = await params
  const fw = getFrameworkBySlug(fwSlug)
  if (!fw) notFound()

  const tool = await getToolBySlug(slug)
  if (!tool) notFound()

  const categoryDef = tool.category ? getCategoryBySlug(tool.category) : undefined
  const effectiveCost = getEffectiveCostCents(tool.pricingConfig)
  const codeExample = generateCodeExample(fw, tool.slug, tool.name)
  const relatedTools = tool.category ? await getRelatedTools(tool.category, tool.slug) : []
  const otherFrameworks = FRAMEWORKS.filter((f) => f.slug !== fw.slug)

  // ─── Structured Data ────────────────────────────────────────────────────

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Tools', item: 'https://settlegrid.ai/tools' },
      { '@type': 'ListItem', position: 2, name: tool.name, item: `https://settlegrid.ai/tools/${tool.slug}` },
      { '@type': 'ListItem', position: 3, name: `with ${fw.name}`, item: `https://settlegrid.ai/tools/${tool.slug}/with/${fw.slug}` },
    ],
  }

  const jsonLdHowTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to use ${tool.name} with ${fw.name}`,
    description: `Integrate ${tool.name} into your ${fw.name} agent using SettleGrid's per-call billing.`,
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Install the framework',
        text: `Install ${fw.name} with: ${fw.installCommand}`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Get your SettleGrid API key',
        text: 'Sign up at settlegrid.ai and purchase credits for this tool. Generate an API key from your Consumer Dashboard.',
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Register the tool in your agent',
        text: `Add ${tool.name} as a tool in your ${fw.name} agent using the code example below.`,
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: 'Run your agent',
        text: `Execute your ${fw.name} agent. SettleGrid will meter each call and deduct from your credit balance automatically.`,
      },
    ],
    tool: {
      '@type': 'HowToTool',
      name: tool.name,
    },
    totalTime: 'PT10M',
    supply: [
      { '@type': 'HowToSupply', name: 'SettleGrid API key' },
      { '@type': 'HowToSupply', name: `${fw.name} (${fw.language})` },
    ],
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdHowTo) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Tools</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/tools/${tool.slug}`} className="hover:text-gray-100 transition-colors">{tool.name}</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">with {fw.name}</span>
          </nav>

          {/* Hero */}
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-3">
              How to use {tool.name} with {fw.name}
            </h1>
            <p className="text-lg text-gray-400 max-w-3xl">
              Integrate <strong className="text-gray-200">{tool.name}</strong> into your{' '}
              <strong className="text-gray-200">{fw.name}</strong> agent with SettleGrid&apos;s
              per-call billing. No subscriptions, no minimums &mdash; pay only for what you use.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Tool Overview */}
              <section className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-3">About {tool.name}</h2>
                {tool.description && (
                  <p className="text-gray-400 leading-relaxed mb-4">{tool.description}</p>
                )}
                <div className="flex flex-wrap gap-3">
                  {categoryDef && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
                      {categoryDef.name}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-[#2A2D3E] text-gray-400 px-2.5 py-0.5 text-xs font-mono">
                    v{tool.currentVersion}
                  </span>
                  {tool.developerName && (
                    <span className="text-xs text-gray-500">
                      by{' '}
                      {tool.developerSlug ? (
                        <Link href={`/dev/${tool.developerSlug}`} className="text-amber-400 hover:underline">{tool.developerName}</Link>
                      ) : (
                        tool.developerName
                      )}
                    </span>
                  )}
                </div>
              </section>

              {/* Framework Info */}
              <section className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-3">About {fw.name}</h2>
                <p className="text-gray-400 leading-relaxed mb-3">{fw.description}</p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
                    {fw.language}
                  </span>
                </div>
              </section>

              {/* Step-by-Step Integration */}
              <section className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-6">Integration Guide</h2>

                <div className="space-y-6">
                  {/* Step 1 */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">1</span>
                      <h3 className="font-semibold text-gray-100">Install {fw.name}</h3>
                    </div>
                    <CopyableCodeBlock title="Terminal" code={fw.installCommand} />
                  </div>

                  {/* Step 2 */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">2</span>
                      <h3 className="font-semibold text-gray-100">Get your SettleGrid API key</h3>
                    </div>
                    <p className="text-sm text-gray-400 ml-10">
                      <Link href={`/tools/${tool.slug}`} className="text-amber-400 hover:underline">Purchase credits</Link> for {tool.name}, then generate an API key from your{' '}
                      <Link href="/consumer" className="text-amber-400 hover:underline">Consumer Dashboard</Link>.
                    </p>
                  </div>

                  {/* Step 3 */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">3</span>
                      <h3 className="font-semibold text-gray-100">Register {tool.name} in your {fw.name} agent</h3>
                    </div>
                    <CopyableCodeBlock title={fw.language} code={codeExample} />
                  </div>

                  {/* Step 4 */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-400 text-sm font-bold">4</span>
                      <h3 className="font-semibold text-gray-100">Run your agent</h3>
                    </div>
                    <p className="text-sm text-gray-400 ml-10">
                      Execute your {fw.name} agent. SettleGrid automatically meters each call to{' '}
                      {tool.name} and deducts from your credit balance. No rate limits beyond your
                      purchased credits.
                    </p>
                  </div>
                </div>
              </section>

              {/* Pricing */}
              <section className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-3">Pricing</h2>
                <div className="flex items-center justify-between py-3 border-b border-[#252836]">
                  <span className="text-gray-400">Cost per call</span>
                  <span className="font-semibold text-amber-400">
                    {effectiveCost != null ? formatCents(effectiveCost) : 'Variable'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  No subscriptions or minimums. Credits never expire.{' '}
                  <Link href={`/tools/${tool.slug}`} className="text-amber-400 hover:underline">
                    See full pricing details
                  </Link>.
                </p>
              </section>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* CTA */}
              <div className="bg-[#161822] rounded-xl border-2 border-amber-500/40 p-6 sticky top-8">
                <h3 className="font-semibold text-gray-100 mb-2">Try {tool.name}</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Purchase credits and start using {tool.name} in your {fw.name} agent today.
                </p>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="block w-full text-center bg-brand text-white px-4 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
                >
                  View {tool.name} &rarr;
                </Link>
              </div>

              {/* Other Frameworks */}
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h3 className="font-semibold text-gray-100 mb-3">Other Frameworks</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Use {tool.name} with other agent frameworks:
                </p>
                <ul className="space-y-2">
                  {otherFrameworks.map((f) => (
                    <li key={f.slug}>
                      <Link
                        href={`/tools/${tool.slug}/with/${f.slug}`}
                        className="flex items-center justify-between text-sm text-gray-400 hover:text-amber-400 transition-colors py-1"
                      >
                        <span>{f.name}</span>
                        <span className="text-xs text-gray-600">{f.language}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Related Tools */}
              {relatedTools.length > 0 && (
                <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                  <h3 className="font-semibold text-gray-100 mb-3">
                    Related {categoryDef?.name ?? ''} Tools
                  </h3>
                  <ul className="space-y-2">
                    {relatedTools.map((rt) => (
                      <li key={rt.slug}>
                        <Link
                          href={`/tools/${rt.slug}/with/${fw.slug}`}
                          className="text-sm text-gray-400 hover:text-amber-400 transition-colors block py-1"
                        >
                          {rt.name} with {fw.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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
