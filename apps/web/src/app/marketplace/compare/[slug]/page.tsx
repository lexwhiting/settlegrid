import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'

// ─── Comparison definitions ────────────────────────────────────────────────

interface ComparisonFeature {
  name: string
  settlegrid: string
  competitor: string
  advantage: 'settlegrid' | 'competitor' | 'neutral'
}

interface ComparisonPage {
  slug: string
  competitor: string
  competitorUrl: string
  tagline: string
  description: string
  features: ComparisonFeature[]
  verdict: string
}

const COMPARISONS: Record<string, ComparisonPage> = {
  'vs-xpay': {
    slug: 'vs-xpay',
    competitor: 'xpay.sh',
    competitorUrl: 'https://xpay.sh',
    tagline: 'SettleGrid vs xpay.sh: AI Service Billing Compared',
    description:
      'Compare SettleGrid and xpay.sh for AI service billing. See how SettleGrid\'s 15 payment protocols, universal crawlers, and progressive take rates stack up against xpay.sh.',
    features: [
      { name: 'Payment Protocols', settlegrid: '15 protocols (MCP, MPP, x402, AP2, Visa TAP, etc.)', competitor: 'x402 only', advantage: 'settlegrid' },
      { name: 'Pricing Models', settlegrid: '6 models (per-call, per-token, per-byte, per-second, tiered, outcome)', competitor: 'Per-call only', advantage: 'settlegrid' },
      { name: 'Take Rate', settlegrid: 'Progressive: 0% to $100, then 2-5%', competitor: 'Fixed percentage', advantage: 'settlegrid' },
      { name: 'Tool Discovery', settlegrid: '10+ ecosystem crawlers (HuggingFace, npm, PyPI, GitHub, Apify, etc.)', competitor: 'Manual registration', advantage: 'settlegrid' },
      { name: 'Marketplace', settlegrid: 'Full marketplace with search, filtering, SEO pages', competitor: 'No marketplace', advantage: 'settlegrid' },
      { name: 'Smart Proxy', settlegrid: 'Transparent billing proxy with auto-metering', competitor: 'Requires SDK integration', advantage: 'settlegrid' },
      { name: 'Budget Controls', settlegrid: 'Per-user spending limits, auto-refill, alerts', competitor: 'Basic limits', advantage: 'settlegrid' },
      { name: 'Webhooks', settlegrid: 'Real-time event webhooks with retry', competitor: 'Limited events', advantage: 'settlegrid' },
      { name: 'Crypto Payments', settlegrid: 'L402, Circle Nano, Drain protocol', competitor: 'x402 (crypto-first)', advantage: 'neutral' },
      { name: 'Open Source', settlegrid: 'Proprietary with public API', competitor: 'Open source', advantage: 'competitor' },
    ],
    verdict:
      'SettleGrid offers broader protocol support and a richer ecosystem with 10+ crawlers and a full marketplace. xpay.sh is a good choice for crypto-native x402 payments, but SettleGrid covers more billing models and provides better developer tooling for mainstream adoption.',
  },
  'vs-nevermined': {
    slug: 'vs-nevermined',
    competitor: 'Nevermined',
    competitorUrl: 'https://nevermined.io',
    tagline: 'SettleGrid vs Nevermined: AI Agent Payment Infrastructure',
    description:
      'Compare SettleGrid and Nevermined for AI agent payment infrastructure. See how each platform handles billing, settlement, and monetization for AI services.',
    features: [
      { name: 'Payment Model', settlegrid: 'Per-call billing with 6 pricing models', competitor: 'Token-based credits system', advantage: 'settlegrid' },
      { name: 'Protocol Support', settlegrid: '15 payment protocols', competitor: 'Custom token protocol', advantage: 'settlegrid' },
      { name: 'Tool Discovery', settlegrid: '10+ ecosystem crawlers, automated directory', competitor: 'Manual agent registration', advantage: 'settlegrid' },
      { name: 'Blockchain Integration', settlegrid: 'Optional (L402, Circle Nano)', competitor: 'Core architecture (required)', advantage: 'neutral' },
      { name: 'Enterprise Readiness', settlegrid: 'Stripe Connect, traditional payment rails', competitor: 'Blockchain-first, emerging enterprise', advantage: 'settlegrid' },
      { name: 'Time to Revenue', settlegrid: 'Minutes (claim listing, set price, go live)', competitor: 'Longer setup with token mechanics', advantage: 'settlegrid' },
      { name: 'Decentralization', settlegrid: 'Centralized settlement for speed', competitor: 'Decentralized by design', advantage: 'competitor' },
      { name: 'AI Agent Support', settlegrid: 'MCP-native, A2A protocol support', competitor: 'Agent-native with DID', advantage: 'neutral' },
      { name: 'Marketplace SEO', settlegrid: 'Programmatic SEO across 10+ ecosystems', competitor: 'No public marketplace', advantage: 'settlegrid' },
      { name: 'Developer Onboarding', settlegrid: 'GitHub App auto-detect, 3-click claim', competitor: 'Manual integration required', advantage: 'settlegrid' },
    ],
    verdict:
      'SettleGrid excels at rapid developer onboarding and mainstream payment rails, while Nevermined offers deeper decentralization. For most AI tool builders, SettleGrid\'s speed-to-revenue and protocol diversity make it the practical choice.',
  },
  'vs-stripe-mpp': {
    slug: 'vs-stripe-mpp',
    competitor: 'Stripe Metered Payment Protocol',
    competitorUrl: 'https://stripe.com',
    tagline: 'SettleGrid vs Stripe MPP: Metered Billing for AI',
    description:
      'Compare SettleGrid and Stripe MPP for metered AI service billing. SettleGrid is purpose-built for AI tools while Stripe MPP is a general-purpose metering add-on.',
    features: [
      { name: 'AI-Specific Design', settlegrid: 'Purpose-built for AI tools and MCP servers', competitor: 'General-purpose metered billing', advantage: 'settlegrid' },
      { name: 'Tool Discovery', settlegrid: 'Automated crawling of 10+ AI ecosystems', competitor: 'No discovery or marketplace', advantage: 'settlegrid' },
      { name: 'Protocol Support', settlegrid: '15 protocols including MCP, x402, A2A', competitor: 'Stripe billing only', advantage: 'settlegrid' },
      { name: 'Marketplace', settlegrid: 'Full-featured AI services marketplace', competitor: 'No marketplace', advantage: 'settlegrid' },
      { name: 'Payment Infrastructure', settlegrid: 'Stripe Connect (leverage Stripe\'s rails)', competitor: 'Full Stripe ecosystem', advantage: 'competitor' },
      { name: 'Take Rate', settlegrid: 'Progressive: 0% to $100, then 2-5%', competitor: 'Stripe standard fees (2.9% + 30c)', advantage: 'settlegrid' },
      { name: 'Smart Proxy', settlegrid: 'Transparent metering proxy', competitor: 'Requires manual meter event reporting', advantage: 'settlegrid' },
      { name: 'Claim Flow', settlegrid: 'Claim-your-listing for existing tools', competitor: 'Build from scratch', advantage: 'settlegrid' },
      { name: 'Global Coverage', settlegrid: 'Via Stripe Connect (190+ countries)', competitor: '46+ countries natively', advantage: 'competitor' },
      { name: 'Maturity', settlegrid: 'New platform, fast-moving', competitor: 'Battle-tested, widely adopted', advantage: 'competitor' },
    ],
    verdict:
      'SettleGrid is purpose-built for the AI tools ecosystem with automated discovery, claiming, and a marketplace. Stripe MPP is more mature but generic. SettleGrid actually uses Stripe Connect under the hood, so you get Stripe reliability with AI-specific features on top.',
  },
  'vs-zuplo': {
    slug: 'vs-zuplo',
    competitor: 'Zuplo',
    competitorUrl: 'https://zuplo.com',
    tagline: 'SettleGrid vs Zuplo: API Monetization Platforms',
    description:
      'Compare SettleGrid and Zuplo for API monetization. See how SettleGrid\'s AI-focused marketplace compares to Zuplo\'s API gateway approach.',
    features: [
      { name: 'Focus', settlegrid: 'AI tools and MCP server monetization', competitor: 'General API gateway and monetization', advantage: 'settlegrid' },
      { name: 'Tool Discovery', settlegrid: '10+ ecosystem crawlers', competitor: 'No discovery, manual API registration', advantage: 'settlegrid' },
      { name: 'Protocol Support', settlegrid: '15 AI-specific protocols (MCP, x402, etc.)', competitor: 'REST/GraphQL gateway', advantage: 'settlegrid' },
      { name: 'Marketplace', settlegrid: 'Built-in marketplace with SEO', competitor: 'Developer portal only', advantage: 'settlegrid' },
      { name: 'API Gateway', settlegrid: 'Smart Proxy with billing', competitor: 'Full-featured API gateway with policies', advantage: 'competitor' },
      { name: 'Rate Limiting', settlegrid: 'Budget-based limits', competitor: 'Advanced rate limiting policies', advantage: 'competitor' },
      { name: 'Developer Portal', settlegrid: 'Dashboard + marketplace pages', competitor: 'Customizable developer portal', advantage: 'neutral' },
      { name: 'Pricing Models', settlegrid: '6 models (per-call, per-token, tiered, outcome, etc.)', competitor: 'Subscription + usage-based', advantage: 'settlegrid' },
      { name: 'Take Rate', settlegrid: 'Progressive: 0% to $100', competitor: 'Platform subscription pricing', advantage: 'settlegrid' },
      { name: 'OpenAPI Support', settlegrid: 'Auto-detect from URLs', competitor: 'Native OpenAPI support', advantage: 'competitor' },
    ],
    verdict:
      'SettleGrid is the clear choice for AI tool developers who want marketplace distribution and AI-native billing. Zuplo is better for teams that need a full API gateway with advanced policies. The two can even complement each other — use Zuplo as your gateway, SettleGrid for monetization and discovery.',
  },
}

const COMPARISON_SLUGS = Object.keys(COMPARISONS)

// ─── Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = COMPARISONS[slug]
  if (!page) return {}

  return {
    title: `${page.tagline} | SettleGrid`,
    description: page.description,
    alternates: { canonical: `https://settlegrid.ai/marketplace/compare/${slug}` },
    keywords: [
      'SettleGrid',
      page.competitor,
      'AI billing comparison',
      'MCP server monetization',
      'AI tool marketplace',
      'API billing platform',
      `${page.competitor} alternative`,
      `${page.competitor} vs SettleGrid`,
    ],
    openGraph: {
      title: page.tagline,
      description: page.description,
      type: 'website',
      url: `https://settlegrid.ai/marketplace/compare/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.tagline,
      description: page.description,
    },
  }
}

export function generateStaticParams() {
  return COMPARISON_SLUGS.map((slug) => ({ slug }))
}

// ─── Page ─────────────────────────────────────────────────────────────────

function AdvantageIndicator({ advantage }: { advantage: 'settlegrid' | 'competitor' | 'neutral' }) {
  if (advantage === 'settlegrid') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
        SettleGrid wins
      </span>
    )
  }
  if (advantage === 'competitor') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" />
          <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" />
        </svg>
        Competitor edge
      </span>
    )
  }
  return (
    <span className="text-xs font-medium text-gray-500">
      Even
    </span>
  )
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = COMPARISONS[slug]
  if (!page) notFound()

  const settlegridWins = page.features.filter((f) => f.advantage === 'settlegrid').length
  const competitorWins = page.features.filter((f) => f.advantage === 'competitor').length
  const totalFeatures = page.features.length

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.tagline,
    description: page.description,
    url: `https://settlegrid.ai/marketplace/compare/${slug}`,
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    about: [
      { '@type': 'SoftwareApplication', name: 'SettleGrid', url: 'https://settlegrid.ai' },
      { '@type': 'SoftwareApplication', name: page.competitor, url: page.competitorUrl },
    ],
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/marketplace" className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25">
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/marketplace" className="hover:text-gray-300 transition-colors">Marketplace</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-500">Compare</span>
            <span className="mx-2">/</span>
            <span className="text-gray-300">{page.competitor}</span>
          </nav>

          {/* Hero */}
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4 font-display">
            {page.tagline}
          </h1>
          <p className="text-lg text-gray-400 mb-8 max-w-2xl">{page.description}</p>

          {/* Score summary */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{settlegridWins}</div>
              <div className="text-sm text-gray-400 mt-1">SettleGrid wins</div>
            </div>
            <div className="rounded-xl border border-[#2A2D3E] bg-[#161822] p-4 text-center">
              <div className="text-3xl font-bold text-gray-400">{totalFeatures - settlegridWins - competitorWins}</div>
              <div className="text-sm text-gray-400 mt-1">Even</div>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{competitorWins}</div>
              <div className="text-sm text-gray-400 mt-1">{page.competitor} wins</div>
            </div>
          </div>

          {/* Feature comparison table */}
          <div className="overflow-x-auto rounded-xl border border-[#2A2D3E]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2A2D3E] bg-[#161822]">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-1/4">Feature</th>
                  <th className="px-4 py-3 text-left text-amber-400 font-medium w-1/3">SettleGrid</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium w-1/3">{page.competitor}</th>
                  <th className="px-4 py-3 text-center text-gray-400 font-medium w-28">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {page.features.map((feature, i) => (
                  <tr
                    key={feature.name}
                    className={`border-b border-[#2A2D3E] ${
                      i % 2 === 0 ? 'bg-[#0C0E14]' : 'bg-[#161822]/50'
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-200">{feature.name}</td>
                    <td className={`px-4 py-3 ${feature.advantage === 'settlegrid' ? 'text-emerald-300' : 'text-gray-400'}`}>
                      {feature.settlegrid}
                    </td>
                    <td className={`px-4 py-3 ${feature.advantage === 'competitor' ? 'text-emerald-300' : 'text-gray-400'}`}>
                      {feature.competitor}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AdvantageIndicator advantage={feature.advantage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Verdict */}
          <div className="mt-10 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
            <h2 className="text-lg font-semibold text-amber-400 mb-2">Our Verdict</h2>
            <p className="text-gray-300 leading-relaxed">{page.verdict}</p>
          </div>

          {/* Other comparisons */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">Other Comparisons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COMPARISON_SLUGS.filter((s) => s !== slug).map((otherSlug) => {
                const other = COMPARISONS[otherSlug]
                return (
                  <Link
                    key={otherSlug}
                    href={`/marketplace/compare/${otherSlug}`}
                    className="rounded-lg border border-[#2A2D3E] bg-[#161822] px-4 py-3 hover:border-amber-500/40 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-200">
                      SettleGrid vs {other.competitor}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building on SettleGrid
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              No credit card required. First $100 in revenue is commission-free.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/marketplace" className="hover:text-gray-100 transition-colors">Marketplace</Link>
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
