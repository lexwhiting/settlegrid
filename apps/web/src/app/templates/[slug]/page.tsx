import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { GALLERY_ENABLED } from '@/env'
import { getRegistry, getTemplateBySlug } from '@/lib/registry'
import { DeployButton } from '@/components/templates/DeployButton'
import { CopyInstallCommand } from '@/components/templates/CopyInstallCommand'
import { TemplateDetailViewedEmitter } from '@/components/telemetry/TemplateDetailViewedEmitter'

export const dynamic = 'force-static'

/**
 * Net monthly revenue (USD) for `calls` invocations at `priceCents`/call
 * under SettleGrid's progressive take rate — 0% on the first $1,000/mo of
 * revenue, then 2–5% above it. Uses the conservative top of the band (5%)
 * so the displayed estimate is never overstated.
 */
function netMonthlyRevenueUsd(priceCents: number, calls: number): number {
  const grossUsd = (calls * priceCents) / 100
  const feeUsd = grossUsd > 1000 ? (grossUsd - 1000) * 0.05 : 0
  return grossUsd - feeUsd
}

/** Format a USD amount as a whole-dollar, comma-grouped string. */
function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

export function generateStaticParams() {
  const registry = getRegistry()
  return registry.templates.map((t) => ({ slug: t.slug }))
}

export function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Metadata | Promise<Metadata> {
  return (async () => {
    const { slug } = await params
    const template = getTemplateBySlug(slug)
    if (!template) {
      return { title: 'Template Not Found | SettleGrid' }
    }
    return {
      title: `${template.name} — MCP Template | SettleGrid`,
      description: template.description,
      alternates: {
        canonical: `https://settlegrid.ai/templates/${slug}`,
      },
      openGraph: {
        title: `${template.name} — MCP Template`,
        description: template.description,
        url: `https://settlegrid.ai/templates/${slug}`,
        images: [{ url: '/social/og-templates.png', alt: template.name }],
      },
    }
  })()
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  if (!GALLERY_ENABLED) {
    notFound()
  }

  const { slug } = await params
  const template = getTemplateBySlug(slug)

  if (!template) {
    notFound()
  }

  const dirSlug = `settlegrid-${slug}`

  // Pricing \u2014 `perCallCents` is the headline per-call price; `methods` is
  // the per-method price map (present on regenerated manifests). When the
  // method costs vary, the headline becomes a "from <min>\u00A2" range.
  const perCallCents =
    template.pricing.model === 'per-call'
      ? template.pricing.perCallUsdCents
      : undefined
  const methods = template.pricing.methods
  const methodCosts = methods
    ? Object.values(methods).map((m) => m.costCents)
    : []
  const minMethodCost =
    methodCosts.length > 0 ? Math.min(...methodCosts) : undefined
  const methodCostsVary =
    minMethodCost !== undefined && minMethodCost !== Math.max(...methodCosts)
  const pricingDisplay = perCallCents
    ? methodCostsVary && minMethodCost !== undefined
      ? `from ${minMethodCost}\u00A2/call`
      : `${perCallCents}\u00A2/call`
    : template.pricing.model === 'free'
      ? 'Free'
      : template.pricing.model

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TemplateDetailViewedEmitter slug={slug} category={template.category} />
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-24">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link
              href="/templates"
              className="text-sm text-muted-foreground hover:text-[#E5A336] transition-colors"
            >
              &larr; Back to Templates
            </Link>
          </div>

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-foreground mb-2">
                  {template.name}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {template.description}
                </p>
              </div>
              {template.featured && <Badge variant="default">Featured</Badge>}
            </div>

            <div className="flex items-center gap-3 flex-wrap mt-4">
              <Badge variant="secondary">{template.category}</Badge>
              <span className="text-sm text-muted-foreground">
                {template.runtime} &middot; {template.languages.join(', ')}
              </span>
              <span className="text-sm font-medium text-[#E5A336]">
                {pricingDisplay}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mb-10 flex-wrap">
            <DeployButton template={template} />
            <a
              href={template.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-secondary transition-colors"
            >
              View Source
            </a>
          </div>

          {/* Quickstart */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Quickstart
            </h2>
            <CopyInstallCommand slug={slug} />
            <div className="mt-4 rounded-lg border border-border bg-[#0C0E14] p-4 overflow-x-auto">
              <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-2">
                Or clone directly
              </p>
              <pre className="text-sm font-mono text-gray-300">
                <code>
                  {`git clone ${template.repo.url}\ncd ${dirSlug}\nnpm install && cp .env.example .env\nnpm run dev`}
                </code>
              </pre>
            </div>
          </section>

          {/* Capabilities */}
          {template.capabilities.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Capabilities
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {template.capabilities.map((cap: string) => (
                  <Badge key={cap} variant="outline">
                    {cap}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {template.tags.length > 0 && (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Tags
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                {template.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Monetization */}
          {perCallCents ? (
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Monetization
              </h2>
              <div className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm text-muted-foreground mb-5">
                  SettleGrid takes{' '}
                  <span className="font-medium text-foreground">0%</span> on
                  your first $1,000/mo of revenue, then 2&ndash;5%
                  (volume-tiered) above it. Estimated monthly revenue at{' '}
                  {perCallCents}&#162;/call:
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[1000, 10000, 100000].map((calls) => (
                    <div key={calls}>
                      <p className="text-2xl font-semibold text-foreground">
                        {formatUsd(netMonthlyRevenueUsd(perCallCents, calls))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {calls.toLocaleString('en-US')} calls/mo
                      </p>
                    </div>
                  ))}
                </div>

                {methods && Object.keys(methods).length > 0 && (
                  <div className="mt-6 border-t border-border pt-6">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                      Per-method pricing
                    </p>
                    <div className="divide-y divide-border rounded-lg border border-border">
                      {Object.entries(methods).map(([method, m]) => (
                        <div
                          key={method}
                          className="flex items-center justify-between gap-4 px-4 py-2.5"
                        >
                          <span className="text-sm">
                            <code className="text-foreground">{method}</code>
                            {m.displayName && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {m.displayName}
                              </span>
                            )}
                          </span>
                          <span className="whitespace-nowrap text-sm font-medium text-[#E5A336]">
                            {m.costCents}&#162;/call
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {/* Author */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Author
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground">
                {template.author.name}
              </span>
              {template.author.github && (
                <a
                  href={`https://github.com/${template.author.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#E5A336] hover:underline"
                >
                  @{template.author.github}
                </a>
              )}
            </div>
          </section>

          {/* Standalone Value */}
          <section className="mb-10 rounded-lg border border-border bg-card p-6">
            <h2 className="text-xl font-semibold text-foreground mb-3">
              Standalone Value
            </h2>
            <p className="text-sm text-muted-foreground">
              This template works without SettleGrid. You can remove the billing
              layer at any time — <strong>no lock-in</strong>. See the{' '}
              <a
                href={`https://github.com/settlegrid/${dirSlug}/blob/main/remove-settlegrid.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E5A336] hover:underline"
              >
                removal guide
              </a>{' '}
              for step-by-step instructions.
            </p>
          </section>

          {/* License */}
          <section className="text-center text-sm text-muted-foreground">
            MIT License &middot; Built with{' '}
            <Link href="/" className="text-[#E5A336] hover:underline">
              SettleGrid
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}
