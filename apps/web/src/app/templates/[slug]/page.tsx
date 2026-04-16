import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { Badge } from '@/components/ui/badge'
import { GALLERY_ENABLED } from '@/env'
import { getRegistry, getTemplateBySlug } from '@/lib/registry'
import { DeployButton } from '@/components/templates/DeployButton'

export const dynamic = 'force-static'

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
  const pricingDisplay =
    template.pricing.model === 'per-call' && template.pricing.perCallUsdCents
      ? `${template.pricing.perCallUsdCents}\u00A2/call`
      : template.pricing.model === 'free'
        ? 'Free'
        : template.pricing.model

  return (
    <div className="min-h-screen flex flex-col bg-background">
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
            <div className="rounded-lg border border-border bg-[#0C0E14] p-4 overflow-x-auto">
              <pre className="text-sm font-mono text-gray-300">
                <code>
                  {`npx create-settlegrid-tool --template ${slug}\n\n# Or clone directly:\ngit clone ${template.repo.url}\ncd ${dirSlug}\nnpm install && cp .env.example .env\nnpm run dev`}
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
                {template.capabilities.map((cap) => (
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
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Monetization */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Monetization
            </h2>
            <div className="rounded-lg border border-border bg-card p-6">
              <p className="text-sm text-muted-foreground mb-4">
                At the default {pricingDisplay} pricing:
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-semibold text-foreground">$8</p>
                  <p className="text-xs text-muted-foreground">1K calls/mo</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">$80</p>
                  <p className="text-xs text-muted-foreground">10K calls/mo</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-foreground">$800</p>
                  <p className="text-xs text-muted-foreground">
                    100K calls/mo
                  </p>
                </div>
              </div>
            </div>
          </section>

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
