import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SettleGridLogo } from '@/components/ui/logo'
import { MarketplaceContent } from '../marketplace-content'

/* ─── URL slug → tool_type mapping ──────────────────────────────────────────── */

const TYPE_MAP: Record<string, { toolType: string; label: string; hero: string; description: string }> = {
  'mcp-servers': {
    toolType: 'mcp-server',
    label: 'MCP Servers',
    hero: 'Discover and monetize MCP servers',
    description:
      'Browse MCP servers built on the Model Context Protocol. Every server can be monetized with per-call billing through SettleGrid.',
  },
  'ai-models': {
    toolType: 'ai-model',
    label: 'AI Models',
    hero: 'Find and deploy AI models',
    description:
      'Explore AI models from HuggingFace, Replicate, OpenRouter, and more. Each model can be metered and billed per-inference.',
  },
  apis: {
    toolType: 'rest-api',
    label: 'REST APIs',
    hero: 'Monetize REST APIs with per-call billing',
    description:
      'Discover REST APIs across every category. Add per-call billing, usage metering, and budget enforcement with one SDK.',
  },
  'agent-tools': {
    toolType: 'agent-tool',
    label: 'Agent Tools',
    hero: 'Tools built for AI agents',
    description:
      'Browse tools designed for autonomous AI agents. Each tool supports structured invocations, billing, and settlement.',
  },
  packages: {
    toolType: 'sdk-package',
    label: 'SDK Packages',
    hero: 'SDK packages and libraries',
    description:
      'Find npm, PyPI, and other packages that integrate with the AI ecosystem. Monetize with usage-based billing.',
  },
  automations: {
    toolType: 'automation',
    label: 'Automations',
    hero: 'AI-powered automations and workflows',
    description:
      'Discover automations from Apify and other platforms. Run web scrapers, data pipelines, and workflows with per-run billing.',
  },
  datasets: {
    toolType: 'dataset',
    label: 'Datasets',
    hero: 'Datasets for AI training and inference',
    description:
      'Browse datasets from HuggingFace and other sources. Monetize dataset access with per-query or per-download billing.',
  },
  extensions: {
    toolType: 'extension',
    label: 'Extensions',
    hero: 'Extensions and plugins',
    description:
      'Discover extensions that add capabilities to AI platforms and tools. Each extension can be monetized per-use.',
  },
}

const VALID_SLUGS = Object.keys(TYPE_MAP)

/* ─── Metadata ──────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const { type } = await params
  const config = TYPE_MAP[type]
  if (!config) return {}

  return {
    title: `${config.label} | AI Marketplace | SettleGrid`,
    description: config.description,
    alternates: { canonical: `https://settlegrid.ai/marketplace/${type}` },
    keywords: [
      config.label,
      'AI marketplace',
      'per-call billing',
      'AI tool monetization',
      `${config.label} directory`,
    ],
    openGraph: {
      title: `${config.label} | AI Marketplace | SettleGrid`,
      description: config.description,
      type: 'website',
      url: `https://settlegrid.ai/marketplace/${type}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${config.label} | AI Marketplace | SettleGrid`,
      description: config.description,
    },
  }
}

export function generateStaticParams() {
  return VALID_SLUGS.map((type) => ({ type }))
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default async function MarketplaceTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { type } = await params
  const config = TYPE_MAP[type]
  if (!config) notFound()

  const rawParams = await searchParams
  const normalizedParams: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(rawParams)) {
    normalizedParams[key] = Array.isArray(value) ? value[0] : value
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${config.label} — AI Marketplace`,
    description: config.description,
    url: `https://settlegrid.ai/marketplace/${type}`,
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/marketplace"
              className="hidden sm:inline text-sm font-medium text-amber-400 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/tools"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Showcase
            </Link>
            <Link
              href="/docs"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/marketplace" className="hover:text-gray-300 transition-colors">
              Marketplace
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-300">{config.label}</span>
          </nav>

          {/* Hero */}
          <div className="relative text-center mb-12 rounded-2xl py-12 px-6 overflow-hidden">
            {/* Caustic light background */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: [
                  'radial-gradient(ellipse 30% 20% at 20% 30%, rgba(245,201,99,0.08), transparent)',
                  'radial-gradient(ellipse 25% 35% at 70% 60%, rgba(229,163,54,0.06), transparent)',
                  'radial-gradient(ellipse 20% 15% at 50% 80%, rgba(14,165,233,0.04), transparent)',
                  'radial-gradient(ellipse 35% 25% at 80% 20%, rgba(245,201,99,0.05), transparent)',
                ].join(', '),
              }}
            />
            {/* Gold flow accent line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #E5A336 30%, #F5C963 50%, #E5A336 70%, transparent)',
              }}
            />
            <h1 className="relative text-4xl sm:text-5xl font-bold text-gray-100 mb-4 font-display">
              <span style={{ color: '#F5C963' }}>{config.label}</span>
            </h1>
            <p className="relative text-lg text-gray-400 max-w-2xl mx-auto">{config.hero}</p>
          </div>

          {/* Content */}
          <Suspense
            fallback={
              <div className="text-center py-20">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-r-transparent" />
                <p className="mt-4 text-sm text-gray-500">Loading {config.label.toLowerCase()}...</p>
              </div>
            }
          >
            <MarketplaceContent
              fixedType={config.toolType}
              showTypeTabs={false}
              basePath={`/marketplace/${type}`}
              searchParams={normalizedParams}
            />
          </Suspense>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/marketplace" className="hover:text-gray-100 transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
