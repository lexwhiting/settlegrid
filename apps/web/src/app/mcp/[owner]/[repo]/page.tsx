import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { getAllShadowEntries, getShadowEntry } from '@/lib/shadow-index'
import { SHADOW_BUILD_LIMIT } from '@/env'

export const dynamic = 'force-static'
export const dynamicParams = false

export async function generateStaticParams() {
  const entries = await getAllShadowEntries(SHADOW_BUILD_LIMIT)
  if (entries.length === 0) {
    // Placeholder so the build doesn't fail on empty DB
    return [{ owner: '_placeholder', repo: '_placeholder' }]
  }
  // Deduplicate by owner+repo (multiple sources may have the same pair)
  const seen = new Set<string>()
  const params: { owner: string; repo: string }[] = []
  for (const e of entries) {
    const key = `${e.owner}/${e.repo}`
    if (seen.has(key)) continue
    seen.add(key)
    params.push({ owner: e.owner, repo: e.repo })
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>
}): Promise<Metadata> {
  const { owner, repo } = await params
  const entry = await getShadowEntry(owner, repo)
  if (!entry) {
    return { title: 'MCP Server Not Found | SettleGrid' }
  }

  const title = `${entry.name} — Monetize with SettleGrid`
  const description =
    entry.description ??
    `${entry.name} by ${entry.owner} — add per-call billing with SettleGrid`

  const noindex = !entry.settlegridAvailable

  return {
    title,
    description,
    alternates: { canonical: entry.sourceUrl ?? undefined },
    openGraph: {
      title,
      description,
      url: `https://settlegrid.ai/mcp/${owner}/${repo}`,
      images: [{ url: '/social/og-mcp.png', alt: entry.name }],
    },
    twitter: { card: 'summary_large_image', title, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    other: {
      'script:ld+json': JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: entry.name,
        description,
        url: entry.sourceUrl,
        applicationCategory: 'DeveloperApplication',
        author: { '@type': 'Person', name: entry.owner },
        ...(entry.stars != null
          ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: Math.min(5, 1 + Math.log10(Math.max(1, entry.stars))),
                bestRating: 5,
                ratingCount: entry.stars,
              },
            }
          : {}),
      }),
    },
  }
}

export default async function ShadowDetailPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>
}) {
  const { owner, repo } = await params

  // Placeholder route for empty DB
  if (owner === '_placeholder' && repo === '_placeholder') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6 py-16 pt-24">
          <p className="text-muted-foreground">Shadow directory is being populated.</p>
        </main>
        <Footer />
      </div>
    )
  }

  const entry = await getShadowEntry(owner, repo)
  if (!entry) notFound()

  const tags = (entry.tags as string[] | null) ?? []
  const npxCommand = `npx settlegrid add github:${owner}/${repo}`

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link
              href="/mcp"
              className="text-sm text-muted-foreground hover:text-[#E5A336] transition-colors"
            >
              &larr; MCP Directory
            </Link>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground mb-2">
              {entry.name}
            </h1>
            <p className="text-sm text-muted-foreground mb-3">
              <a
                href={entry.sourceUrl ?? `https://github.com/${owner}/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E5A336] hover:underline"
              >
                {owner}/{repo}
              </a>
            </p>
            {entry.description && (
              <p className="text-lg text-muted-foreground">
                {entry.description}
              </p>
            )}
          </div>

          {/* Stats + Tags */}
          <div className="flex items-center gap-3 flex-wrap mb-10">
            {entry.stars != null && (
              <Badge variant="secondary">
                {entry.stars.toLocaleString()} stars
              </Badge>
            )}
            {entry.downloads != null && (
              <Badge variant="secondary">
                {entry.downloads.toLocaleString()} downloads
              </Badge>
            )}
            {entry.category && (
              <Badge variant="outline">{entry.category}</Badge>
            )}
            {tags.slice(0, 8).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Monetize CTA */}
          <section className="mb-10 rounded-lg border border-[#E5A336]/30 bg-[#E5A336]/5 p-8">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Monetize this with SettleGrid
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Add per-call billing to this MCP server in under 5 minutes.
              Every AI agent call generates revenue.
            </p>
            <div className="rounded-md border border-border bg-[#0C0E14] p-4 overflow-x-auto mb-4">
              <pre className="text-sm font-mono text-gray-300">
                <code>{npxCommand}</code>
              </pre>
            </div>
            <Link
              href="/start"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
            >
              Get Started — Free
            </Link>
          </section>

          {/* Why this works */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Why this works
            </h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-[#E5A336] font-medium">1.</span>
                SettleGrid wraps each tool call with metering — no code rewrite needed
              </li>
              <li className="flex gap-2">
                <span className="text-[#E5A336] font-medium">2.</span>
                AI agents pay per call via their SettleGrid balance or x402 protocol
              </li>
              <li className="flex gap-2">
                <span className="text-[#E5A336] font-medium">3.</span>
                Revenue accumulates in your dashboard; payouts via Stripe Connect
              </li>
            </ul>
          </section>

          {/* Source attribution */}
          <section className="text-sm text-muted-foreground border-t border-border pt-6">
            <p>
              Source:{' '}
              <a
                href={entry.sourceUrl ?? `https://github.com/${owner}/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E5A336] hover:underline"
              >
                {entry.sourceUrl ?? `github.com/${owner}/${repo}`}
              </a>
              {' '}&middot;{' '}
              Indexed from {entry.source}
              {entry.lastUpdated && (
                <> &middot; Last updated {entry.lastUpdated.toISOString().split('T')[0]}</>
              )}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
