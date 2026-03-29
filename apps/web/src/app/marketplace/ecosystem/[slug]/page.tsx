import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { SettleGridLogo } from '@/components/ui/logo'
import { MarketplaceContent } from '../../marketplace-content'

/* ─── Ecosystem config ──────────────────────────────────────────────────────── */

const ECOSYSTEM_MAP: Record<
  string,
  {
    ecosystem: string
    label: string
    hero: string
    description: string
    accentColor: string
    accentBg: string
    accentBorder: string
  }
> = {
  huggingface: {
    ecosystem: 'huggingface',
    label: 'Hugging Face',
    hero: 'Models and datasets from Hugging Face',
    description:
      'Browse AI models and datasets from the Hugging Face ecosystem. Monetize model inference and dataset access with SettleGrid.',
    accentColor: 'text-yellow-400',
    accentBg: 'bg-yellow-500/10',
    accentBorder: 'border-yellow-500/30',
  },
  npm: {
    ecosystem: 'npm',
    label: 'npm',
    hero: 'JavaScript and TypeScript AI packages',
    description:
      'Discover AI-related npm packages and SDKs. Add per-call billing to any npm package with SettleGrid.',
    accentColor: 'text-red-400',
    accentBg: 'bg-red-500/10',
    accentBorder: 'border-red-500/30',
  },
  pypi: {
    ecosystem: 'pypi',
    label: 'PyPI',
    hero: 'Python AI packages and libraries',
    description:
      'Browse Python AI packages from PyPI. Monetize Python library usage with per-call billing and metering.',
    accentColor: 'text-blue-400',
    accentBg: 'bg-blue-500/10',
    accentBorder: 'border-blue-500/30',
  },
  smithery: {
    ecosystem: 'smithery',
    label: 'Smithery',
    hero: 'MCP servers from Smithery',
    description:
      'Discover MCP servers published on Smithery. Every server can be monetized through SettleGrid.',
    accentColor: 'text-orange-400',
    accentBg: 'bg-orange-500/10',
    accentBorder: 'border-orange-500/30',
  },
  apify: {
    ecosystem: 'apify',
    label: 'Apify',
    hero: 'Web scrapers and automations from Apify',
    description:
      'Browse Apify actors for web scraping, data extraction, and automation. Add per-run billing with SettleGrid.',
    accentColor: 'text-green-400',
    accentBg: 'bg-green-500/10',
    accentBorder: 'border-green-500/30',
  },
  'mcp-registry': {
    ecosystem: 'mcp-registry',
    label: 'MCP Registry',
    hero: 'Official MCP Registry servers',
    description:
      'Browse tools from the official MCP Registry. Monetize any registered MCP server with SettleGrid.',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/30',
  },
  pulsemcp: {
    ecosystem: 'pulsemcp',
    label: 'PulseMCP',
    hero: 'MCP servers from PulseMCP',
    description:
      'Discover MCP servers tracked by PulseMCP. Add per-call billing and settlement with SettleGrid.',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500/10',
    accentBorder: 'border-violet-500/30',
  },
  replicate: {
    ecosystem: 'replicate',
    label: 'Replicate',
    hero: 'AI models hosted on Replicate',
    description:
      'Browse machine learning models from Replicate. Monetize model predictions with per-call billing.',
    accentColor: 'text-slate-300',
    accentBg: 'bg-slate-500/10',
    accentBorder: 'border-slate-500/30',
  },
  openrouter: {
    ecosystem: 'openrouter',
    label: 'OpenRouter',
    hero: 'LLM endpoints from OpenRouter',
    description:
      'Access language models from OpenRouter. Add metered billing and budget enforcement with SettleGrid.',
    accentColor: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/30',
  },
  github: {
    ecosystem: 'github',
    label: 'GitHub',
    hero: 'Open-source AI tools from GitHub',
    description:
      'Discover open-source AI tools published on GitHub. Claim and monetize your repositories with SettleGrid.',
    accentColor: 'text-gray-300',
    accentBg: 'bg-gray-500/10',
    accentBorder: 'border-gray-500/30',
  },
}

const VALID_SLUGS = Object.keys(ECOSYSTEM_MAP)

/* ─── Metadata ──────────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const config = ECOSYSTEM_MAP[slug]
  if (!config) return {}

  return {
    title: `${config.label} Ecosystem | AI Marketplace | SettleGrid`,
    description: config.description,
    alternates: { canonical: `https://settlegrid.ai/marketplace/ecosystem/${slug}` },
    keywords: [
      config.label,
      `${config.label} AI tools`,
      'AI marketplace',
      'per-call billing',
      `${config.label} monetization`,
    ],
    openGraph: {
      title: `${config.label} Ecosystem | AI Marketplace | SettleGrid`,
      description: config.description,
      type: 'website',
      url: `https://settlegrid.ai/marketplace/ecosystem/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${config.label} Ecosystem | AI Marketplace | SettleGrid`,
      description: config.description,
    },
  }
}

export function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }))
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default async function EcosystemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const config = ECOSYSTEM_MAP[slug]
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
    url: `https://settlegrid.ai/marketplace/ecosystem/${slug}`,
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
            <span className="text-gray-500">Ecosystems</span>
            <span className="mx-2">/</span>
            <span className="text-gray-300">{config.label}</span>
          </nav>

          {/* Hero with ecosystem accent */}
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
            <div
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${config.accentBg} mb-4 relative`}
            >
              <span className={`text-2xl font-bold font-mono ${config.accentColor}`}>
                {config.label.length <= 4
                  ? config.label
                  : config.label
                      .split(' ')
                      .map((w) => w[0])
                      .join('')}
              </span>
            </div>
            <h1 className="relative text-4xl sm:text-5xl font-bold text-gray-100 mb-4 font-display">
              {config.label}
            </h1>
            <p className="relative text-lg text-gray-400 max-w-2xl mx-auto">{config.hero}</p>
            {/* Gold gradient accent line below hero */}
            <div
              className="mx-auto mt-6 max-w-xs h-[2px] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, #C4891E 20%, #E5A336 50%, #C4891E 80%, transparent)',
              }}
            />
          </div>

          {/* Content */}
          <Suspense
            fallback={
              <div className="text-center py-20">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-r-transparent" />
                <p className="mt-4 text-sm text-gray-500">Loading {config.label} tools...</p>
              </div>
            }
          >
            <MarketplaceContent
              fixedEcosystem={config.ecosystem}
              showTypeTabs={true}
              basePath={`/marketplace/ecosystem/${slug}`}
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
