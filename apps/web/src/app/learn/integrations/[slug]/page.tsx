import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { INTEGRATION_GUIDES, INTEGRATION_SLUGS, getIntegrationGuideBySlug } from '@/lib/integration-guides'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return INTEGRATION_SLUGS.map((slug) => ({ slug }))
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const guide = getIntegrationGuideBySlug(slug)
  if (!guide) return { title: 'Integration Not Found | SettleGrid' }

  const title = `${guide.title} | SettleGrid`

  return {
    title,
    description: guide.description,
    alternates: { canonical: `https://settlegrid.ai/learn/integrations/${slug}` },
    keywords: guide.keywords,
    openGraph: {
      title,
      description: guide.description,
      type: 'article',
      url: `https://settlegrid.ai/learn/integrations/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: guide.description,
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/**
 * Renders paragraph text with inline `code` spans.
 * Splits on backtick-delimited segments and wraps code in <code>.
 */
function renderParagraph(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="bg-[#0D1117] text-amber-400 text-sm px-1.5 py-0.5 rounded font-mono"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

function languageBadge(lang: 'typescript' | 'python' | 'both') {
  if (lang === 'both') return 'TypeScript + Python'
  if (lang === 'python') return 'Python'
  return 'TypeScript'
}

function codeLanguageLabel(lang: string) {
  if (lang === 'typescript') return 'TypeScript'
  if (lang === 'python') return 'Python'
  return lang
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function IntegrationGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const guide = getIntegrationGuideBySlug(slug)
  if (!guide) notFound()

  // Adjacent guides for prev/next navigation
  const guideIndex = INTEGRATION_GUIDES.findIndex((g) => g.slug === guide.slug)
  const prevGuide = guideIndex > 0
    ? INTEGRATION_GUIDES[guideIndex - 1]
    : INTEGRATION_GUIDES[INTEGRATION_GUIDES.length - 1]
  const nextGuide = guideIndex < INTEGRATION_GUIDES.length - 1
    ? INTEGRATION_GUIDES[guideIndex + 1]
    : INTEGRATION_GUIDES[0]

  // ── JSON-LD: HowTo schema ──────────────────────────────────────────────
  const jsonLdHowTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: guide.description,
    url: `https://settlegrid.ai/learn/integrations/${slug}`,
    totalTime: `PT${guide.steps.length * 10}M`,
    step: guide.steps.map((step, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: step.heading,
      text: step.content.split('\n\n')[0],
      url: `https://settlegrid.ai/learn/integrations/${slug}#${slugify(step.heading)}`,
    })),
    author: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
      logo: {
        '@type': 'ImageObject',
        url: 'https://settlegrid.ai/brand/icon-color.svg',
      },
    },
    datePublished: '2026-03-26',
    dateModified: '2026-03-26',
  }

  // ── JSON-LD: BreadcrumbList ─────────────────────────────────────────────
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
      { '@type': 'ListItem', position: 2, name: 'Framework Integrations', item: 'https://settlegrid.ai/learn/integrations' },
      { '@type': 'ListItem', position: 3, name: guide.framework, item: `https://settlegrid.ai/learn/integrations/${slug}` },
    ],
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdHowTo) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <Link href="/learn/integrations" className="hover:text-gray-100 transition-colors">Integrations</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100 truncate max-w-[200px]">{guide.framework}</span>
          </nav>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={guide.icon} />
                </svg>
              </div>
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                {guide.steps.length}-step guide
              </span>
              <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5">
                {languageBadge(guide.language)}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              {guide.title}
            </h1>
            <p className="text-lg text-gray-400">
              {guide.description}
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              In this guide
            </h2>
            <ol className="space-y-1.5">
              {guide.steps.map((step, i) => (
                <li key={i}>
                  <a
                    href={`#${slugify(step.heading)}`}
                    className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {i + 1}. {step.heading}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#code-examples"
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Code Examples
                </a>
              </li>
            </ol>
          </div>

          {/* Steps */}
          <div className="space-y-14">
            {guide.steps.map((step, i) => (
              <section key={i} id={slugify(step.heading)}>
                <div className="flex items-baseline gap-3 mb-4 scroll-mt-24">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <h2 className="text-xl font-bold text-gray-100">
                    {step.heading}
                  </h2>
                </div>
                <div className="space-y-4 pl-11">
                  {step.content.split('\n\n').map((paragraph, j) => (
                    <p key={j} className="text-gray-300 leading-relaxed">
                      {renderParagraph(paragraph, `step-${i}-p-${j}`)}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Code Examples */}
          <section id="code-examples" className="mt-14 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">Code Examples</h2>
            <div className="space-y-6">
              {guide.codeExamples.map((example, i) => (
                <div key={i} className="bg-[#161822] rounded-xl border border-[#2A2D3E] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2D3E]">
                    <h3 className="text-sm font-semibold text-gray-100">{example.title}</h3>
                    <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5">
                      {codeLanguageLabel(example.language)}
                    </span>
                  </div>
                  <pre className="p-4 overflow-x-auto text-sm leading-relaxed">
                    <code className="text-gray-300 font-mono">{example.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-14 mb-10 rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Ready to integrate?
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Sign up for SettleGrid, get your API key, and start using paid tools in {guide.framework}. Free tier includes 50,000 operations per month.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building — Free
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-semibold border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>

          {/* Adjacent Guides */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/learn/integrations/${prevGuide.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">&larr; Previous integration</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm">
                {prevGuide.framework}
              </p>
            </Link>
            <Link
              href={`/learn/integrations/${nextGuide.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group text-right"
            >
              <p className="text-xs text-gray-500 mb-1">Next integration &rarr;</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm">
                {nextGuide.framework}
              </p>
            </Link>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/guides" className="hover:text-gray-100 transition-colors">Guides</Link>
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
