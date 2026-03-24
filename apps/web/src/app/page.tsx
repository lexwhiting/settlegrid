import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CodeSnippet } from '@/components/marketing/code-snippet'
import { RevealSection } from '@/components/marketing/home-sections'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { NpmInstallBar } from '@/components/marketing/npm-install-bar'

export const metadata: Metadata = {
  title: 'SettleGrid — Monetize AI Tools with 2 Lines of Code',
  description:
    'The settlement layer for AI agent payments. Per-call billing, usage metering, and automated payouts for MCP tools, REST APIs, and AI agents. Free forever — 25K ops/month, 0% fees. 10 protocols. Open source SDK.',
  alternates: { canonical: 'https://settlegrid.ai' },
  keywords: [
    'MCP monetization',
    'AI agent payments',
    'settlement layer',
    'per-call billing',
    'AI tool billing',
    'Model Context Protocol',
    'x402',
    'AP2',
    'developer tools',
    'API monetization',
    'usage-based billing',
    'AI economy',
  ],
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD Structured Data for AI/Search Discovery                           */
/* -------------------------------------------------------------------------- */

const jsonLdSoftwareApplication = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SettleGrid',
  description:
    'The settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts across 10 protocols — MCP, x402, AP2, MPP, Visa TAP, UCP, and more. Developer keeps 95%. Free tier keeps 100%.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  url: 'https://settlegrid.ai',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free forever — 25,000 operations/month, 0% take rate, unlimited tools. Most developers never need to upgrade.',
    },
    {
      '@type': 'Offer',
      name: 'Starter',
      price: '9',
      priceCurrency: 'USD',
      description: '100,000 operations/month, 5% take rate',
    },
    {
      '@type': 'Offer',
      name: 'Growth',
      price: '29',
      priceCurrency: 'USD',
      description: '500,000 operations/month, IP allowlisting',
    },
    {
      '@type': 'Offer',
      name: 'Scale',
      price: '79',
      priceCurrency: 'USD',
      description: '2,000,000 operations/month, fraud detection',
    },
  ],
  author: {
    '@type': 'Organization',
    name: 'Alerterra, LLC',
    url: 'https://settlegrid.ai',
  },
  downloadUrl: 'https://www.npmjs.com/package/@settlegrid/mcp',
  softwareVersion: '0.1.1',
  license: 'https://opensource.org/licenses/MIT',
}

const jsonLdOrganization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SettleGrid',
  url: 'https://settlegrid.ai',
  logo: 'https://settlegrid.ai/brand/icon-color.svg',
  description:
    'SettleGrid is the protocol-agnostic settlement layer for the AI economy. One SDK. Ten protocols. Developer keeps 95%. Supports MCP, x402, AP2, MPP, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, and REST.',
  sameAs: [
    'https://github.com/lexwhiting/settlegrid',
    'https://www.npmjs.com/package/@settlegrid/mcp',
  ],
}

const jsonLdProduct = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'SettleGrid SDK',
  description:
    '@settlegrid/mcp — TypeScript SDK for adding per-call billing, usage metering, and budget enforcement to any MCP tool, REST API, or AI agent.',
  brand: { '@type': 'Brand', name: 'SettleGrid' },
  url: 'https://settlegrid.ai',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '0',
    highPrice: '79',
    priceCurrency: 'USD',
    offerCount: 4,
  },
}

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is SettleGrid?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid is the settlement layer for AI agent payments. It lets developers monetize any AI service — MCP tools, REST APIs, AI agents, model endpoints — with per-call billing, usage metering, budget enforcement, and automated Stripe payouts.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I monetize my MCP server?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Install the @settlegrid/mcp SDK (npm install @settlegrid/mcp), call settlegrid.init() with your tool slug and pricing, then wrap your handler with sg.wrap(). Every call is automatically metered and billed. You keep 95% of revenue — or 100% on the Free tier.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the best settlement layer for AI agent payments?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid is purpose-built for AI agent payments with sub-50ms metering, multi-protocol support (MCP, x402, AP2, Visa TAP, REST), budget enforcement, agent identity (KYA), multi-hop settlement, and fraud detection. Free tier available with 0% take rate.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does SettleGrid cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid offers four plans: Free ($0, 25K ops/month, 0% take rate), Starter ($9/mo, 100K ops), Growth ($29/mo, 500K ops), and Scale ($79/mo, 2M ops). Developers keep 95-100% of revenue. Need more? Email support@settlegrid.ai.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which AI payment protocols does SettleGrid support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid supports 10 protocols out of the box: MCP (Model Context Protocol), x402, AP2 (Anthropic Agent Protocol), MPP (Stripe Model Provider Protocol), Visa TAP, UCP (Unified Checkout Protocol), ACP, Mastercard Agent Pay, Circle Nanopayments, and standard REST APIs. One SDK handles all of them — no protocol-specific code required.',
      },
    },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Reusable blocks                                                           */
/* -------------------------------------------------------------------------- */

function StepCard({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="text-center relative">
      <div className="w-14 h-14 rounded-2xl bg-brand text-white font-bold text-lg flex items-center justify-center mx-auto mb-5 shadow-lg shadow-brand/20">
        {step}
      </div>
      <h3 className="font-bold text-indigo dark:text-gray-100 text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}

function CoreCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group p-6 rounded-xl border border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] hover:border-brand/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 dark:hover:border-brand/50">
      <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
        {icon}
      </div>
      <h3 className="font-bold text-indigo dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}

function HighlightBlock({
  title,
  description,
  code,
}: {
  title: string
  description: string
  code: string
}) {
  return (
    <div className="group p-6 rounded-xl border border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] hover:border-brand/30 hover:shadow-md transition-all duration-200">
      <h3 className="font-bold text-lg text-indigo dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{description}</p>
      <CopyableCodeBlock code={code} className="!my-0" />
    </div>
  )
}

function ComparisonTable() {
  const features = [
    { name: 'Protocol support', settlegrid: '10 protocols (MCP, MPP, x402, AP2, TAP, UCP, ACP, MC, Nano, REST)', stripe: 'MPP + REST', nevermined: 'x402 / DeFi', paid: 'MCP only' },
    { name: 'Real-time metering', settlegrid: '<50ms Redis', stripe: 'Batch only', nevermined: 'On-chain', paid: 'Per-call' },
    { name: 'Multi-hop settlement', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Agent identity (KYA)', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Outcome-based billing', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Fiat + crypto ledger', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: '$1 minimum payout (lowest in AI)', settlegrid: true, stripe: true, nevermined: false, paid: false },
    { name: 'Per-method pricing', settlegrid: true, stripe: true, nevermined: false, paid: true },
    { name: 'Auto-refill credits', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'IP allowlisting', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Fraud detection', settlegrid: true, stripe: true, nevermined: false, paid: false },
    { name: 'Sandbox mode', settlegrid: true, stripe: true, nevermined: false, paid: true },
    { name: 'Open-source SDK', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Budget enforcement', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Revenue split (95%+)', settlegrid: true, stripe: false, nevermined: false, paid: false },
  ]

  function renderCell(val: boolean | string) {
    if (typeof val === 'string') {
      return <span className="text-xs text-gray-600 dark:text-gray-300">{val}</span>
    }
    return val
      ? <span className="text-brand-text font-bold" aria-label="Yes">&#10003;</span>
      : <span className="text-gray-400" aria-label="No">&#8212;</span>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-[#2E3148]">
      <table className="w-full text-sm" role="table" aria-label="Feature comparison">
        <thead>
          <tr className="border-b border-gray-200 dark:border-[#2E3148] bg-gray-50 dark:bg-[#1A1D2E]">
            <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Feature</th>
            <th scope="col" className="text-center py-3 px-4 font-bold text-brand-text dark:text-brand-light bg-brand/5 dark:bg-brand/10">SettleGrid</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stripe Billing</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Nevermined</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Paid.ai</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.name} className="comparison-row border-b border-gray-100 dark:border-[#2E3148]/50 last:border-b-0">
              <td className="py-3 px-4 text-gray-700 dark:text-gray-300 font-medium">{f.name}</td>
              <td className="text-center py-3 px-4 bg-brand/5 dark:bg-brand/10">{renderCell(f.settlegrid)}</td>
              <td className="text-center py-3 px-4">{renderCell(f.stripe)}</td>
              <td className="text-center py-3 px-4">{renderCell(f.nevermined)}</td>
              <td className="text-center py-3 px-4">{renderCell(f.paid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PricingSection() {
  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Ship and validate without spending a cent',
      features: [
        'Unlimited tools',
        '25,000 operations/month',
        'Per-call billing & full dashboard',
        '0% take rate — keep 100%',
        'No credit card ever',
      ],
      cta: 'Start Free',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Starter',
      price: '$9',
      period: '/month',
      description: 'For developers earning their first revenue',
      features: [
        'Unlimited tools',
        '100,000 operations/month',
        'Full analytics',
        'Webhook events',
        'Sandbox mode',
        '5% take rate — keep 95%',
      ],
      cta: 'Start Building',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Growth',
      price: '$29',
      period: '/month',
      description: 'For tools gaining real traction',
      features: [
        'Unlimited tools',
        '500,000 operations/month',
        'Priority webhooks',
        'IP allowlisting',
        'CSV export',
        'Referral system',
        '5% take rate — keep 95%',
      ],
      cta: 'Get Started',
      href: '/register',
      highlighted: true,
    },
    {
      name: 'Scale',
      price: '$79',
      period: '/month',
      description: 'For high-volume production services',
      features: [
        'Unlimited tools',
        '2,000,000 operations/month',
        'Fraud detection',
        'Audit logging',
        'Dedicated support',
        '5% take rate (negotiable)',
      ],
      cta: 'Get Started',
      href: '/register',
      highlighted: false,
    },
  ]

  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-brand tracking-wide uppercase mb-2">Pricing</p>
      <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 mb-4">Free Forever for Most Developers</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-xl mx-auto">
        25,000 ops/month at zero cost, zero fees, zero take rate. No credit card required.
      </p>
      <p className="text-sm font-medium text-brand-text dark:text-brand-light mb-10">
        At scale, you still keep 95% of every transaction.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
        {tiers.map((tier, i) => (
          <RevealSection key={tier.name} delay={i * 0.08}>
          <div
            className={`p-6 rounded-xl border-2 text-left relative transition-all hover:shadow-md h-full ${
              tier.highlighted
                ? 'border-brand shadow-lg shadow-brand/15 bg-brand/[0.02] dark:bg-brand/[0.05] scale-[1.02]'
                : 'border-gray-200 dark:border-[#2E3148]'
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1 rounded-full shadow-sm">
                Most Popular
              </div>
            )}
            <h3 className="font-semibold text-lg text-indigo dark:text-gray-100">{tier.name}</h3>
            <div className="mt-2 mb-1">
              <span className="text-3xl font-bold text-indigo dark:text-gray-100">{tier.price}</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{tier.period}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{tier.description}</p>
            <Link
              href={tier.href}
              className={`block w-full text-center py-2 rounded-lg text-sm font-semibold transition-colors mb-4 ${
                tier.highlighted
                  ? 'bg-brand text-white hover:bg-brand-dark'
                  : 'bg-gray-100 dark:bg-[#252836] text-indigo dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-[#2E3148]'
              }`}
            >
              {tier.cta}
            </Link>
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          </RevealSection>
        ))}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
        Need higher limits or a custom arrangement?{' '}
        <a href="mailto:support@settlegrid.ai" className="text-brand hover:text-brand-dark font-medium transition-colors">
          Let&apos;s talk
        </a>
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  SVG icon helpers (Heroicons-style, 24x24 viewBox)                         */
/* -------------------------------------------------------------------------- */

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

// Bolt — Real-time metering
const iconMetering = "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
// Globe — Protocol-agnostic
const iconProtocol = "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.47.732-3.565"
// Arrows — Multi-hop settlement
const iconMultiHop = "M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
// Fingerprint — Agent identity
const iconIdentity = "M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a48.667 48.667 0 0 0-1.182 6.013M12 10.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm-5.97 6.03a48.107 48.107 0 0 0-1.28 6.21m9.5-13.74a3.001 3.001 0 0 0-4.5 0m4.5 0a3.001 3.001 0 0 1 .018 4.236M7.75 8.79a3.001 3.001 0 0 0-.018 4.236m8.236-3.026a48.305 48.305 0 0 1 .75 6.5m-6.968-5.5a48.093 48.093 0 0 0-.75 6.5"
// Check-badge — Outcome billing
const iconOutcome = "M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"
// Building — Enterprise
const iconEnterprise = "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"

/* -------------------------------------------------------------------------- */
/*  Developer Experience checklist items                                      */
/* -------------------------------------------------------------------------- */

const dxFeatures = [
  'Per-method pricing', 'Budget enforcement', 'Auto-refill',
  'IP allowlisting', 'Fraud detection', 'Webhook events',
  'Health monitoring', 'Audit logging', 'API key management',
  'Revenue analytics', 'Referral tracking', 'Developer profiles',
  'OpenAPI 3.1 spec', 'SSE streaming', 'Multi-currency',
  'Dark mode dashboard', 'Cmd+K palette', 'CSV export',
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftwareApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
      />

      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4 dark:bg-[#0F1117] sticky top-0 z-50 bg-white/80 dark:bg-[#0F1117]/80 backdrop-blur-lg">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center"><SettleGridLogo variant="horizontal" size={32} /></Link>
          <div className="flex items-center gap-5">
            <Link href="/tools" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Showcase
            </Link>
            <Link href="/servers" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Templates
            </Link>
            <Link href="/docs" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="/learn" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Learn
            </Link>
            <Link href="/login" className="hidden sm:inline text-sm font-medium text-indigo dark:text-gray-300 hover:text-brand-dark dark:hover:text-brand-light transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25">
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ================================================================ */}
        {/*  1. Hero — Dark with animated gradient mesh + grid              */}
        {/* ================================================================ */}
        <section className="relative px-6 pt-20 pb-24 bg-indigo overflow-hidden">
          {/* Layer 1: Haikei stacked waves — static texture at the bottom */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: 'url(/hero-waves.svg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center bottom',
              backgroundRepeat: 'no-repeat',
            }}
          />
          {/* Layer 2: Animated gradient mesh — drifting glow on top */}
          <div className="absolute inset-0 opacity-40 hero-gradient-mesh" />
          {/* Layer 3: Subtle dot grid overlay for depth */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Top glow accent line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-brand/60 to-transparent" />

          <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-white/[0.07] text-brand-light border border-white/15 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                </span>
                Now in Early Access — Free forever tier available
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-white mb-6 leading-[1.08]">
                Monetize AI tools with{' '}
                <span className="text-brand-light">2 lines of code</span>
              </h1>

              {/* Subtext */}
              <p className="text-lg sm:text-xl text-gray-300 mb-4 leading-relaxed max-w-lg">
                The settlement layer for AI agent payments. Per-call billing, usage metering, and automated payouts for MCP tools, REST APIs, and AI agents.
              </p>

              {/* Stat bar */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-6 text-sm">
                <span className="text-brand-light font-semibold">Free forever</span>
                <span className="text-white/20">|</span>
                <span className="text-white font-semibold">1,017 <span className="text-gray-400 font-normal">templates</span></span>
                <span className="text-white/20">|</span>
                <span className="text-white font-semibold">10 <span className="text-gray-400 font-normal">protocols</span></span>
                <span className="text-white/20">|</span>
                <span className="text-white font-semibold">Built-in <span className="text-gray-400 font-normal">discovery</span></span>
                <span className="text-white/20">|</span>
                <span className="text-white font-semibold">&lt;50ms <span className="text-gray-400 font-normal">metering</span></span>
              </div>

              {/* npm install bar with copy */}
              <NpmInstallBar />

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3.5 rounded-lg text-lg hover:bg-brand-dark transition-all shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5">
                  Start Building — Free
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center border-2 border-white/25 text-white font-semibold px-8 py-3.5 rounded-lg text-lg hover:bg-white/10 hover:border-white/40 transition-all">
                  Read the Docs
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-7 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  No credit card
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  25K ops/month free
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Open source SDK
                </span>
              </div>

              {/* Source links */}
              <div className="flex items-center gap-4 mt-4">
                <a
                  href="https://github.com/lexwhiting/settlegrid"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors border border-white/15 rounded-full px-3 py-1.5 hover:border-white/30"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </a>
                <a
                  href="https://www.npmjs.com/package/@settlegrid/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors border border-white/15 rounded-full px-3 py-1.5 hover:border-white/30"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0h-2.666V8.667h5.334v5.332h-2.668v-4h-1.332v4h1.332zm12-5.332v4h-1.332v-4H20v4h-1.334v-4h-1.332v5.332H24V8.666h-1.334z" />
                  </svg>
                  @settlegrid/mcp
                </a>
              </div>
            </div>
            <div className="relative">
              {/* Glow behind code block */}
              <div className="absolute -inset-4 rounded-2xl bg-brand/[0.06] blur-2xl" />
              <div className="relative">
                <CodeSnippet />
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  2. Protocol logo bar                                            */}
        {/* ================================================================ */}
        <section className="px-6 py-16 border-b border-gray-200 dark:border-[#2E3148]">
          <RevealSection>
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10">
                <p className="text-sm font-semibold text-brand tracking-wide uppercase mb-2">Protocol-Agnostic</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-indigo dark:text-gray-100 mb-3">One SDK. Ten Protocols. Zero Vendor Lock-in.</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">Backed by Anthropic, Google, Stripe, Visa, Mastercard, Coinbase, OpenAI, and Circle. Wrap once, settle everywhere.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { name: 'MCP', backer: 'Anthropic', href: 'https://modelcontextprotocol.io', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="4" r="2" fill="currentColor"/><circle cx="14" cy="24" r="2" fill="currentColor"/><circle cx="4" cy="14" r="2" fill="currentColor"/><circle cx="24" cy="14" r="2" fill="currentColor"/><line x1="14" y1="6" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="14" y1="19" x2="14" y2="22" stroke="currentColor" strokeWidth="1.5"/><line x1="6" y1="14" x2="9" y2="14" stroke="currentColor" strokeWidth="1.5"/><line x1="19" y1="14" x2="22" y2="14" stroke="currentColor" strokeWidth="1.5"/></svg> },
                  { name: 'MPP', backer: 'Stripe + Tempo', href: 'https://docs.stripe.com/payments/machine/mpp', color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M4 14h20M14 4v20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 8l12 12M20 8L8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/><circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.6"/></svg> },
                  { name: 'x402', backer: 'Coinbase', href: 'https://www.x402.org', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="4" y="10" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M4 14h20" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M13 6v-2M15 6v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> },
                  { name: 'AP2', backer: 'Google', href: 'https://ap2-protocol.org', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M14 4L24 9v10l-10 5L4 19V9l10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="14" cy="14" r="3" fill="currentColor" opacity="0.5"/><path d="M14 4v7M4 9l7 5M24 9l-7 5M14 24v-7M4 19l7-5M24 19l-7-5" stroke="currentColor" strokeWidth="1" opacity="0.3"/></svg> },
                  { name: 'Visa TAP', backer: 'Visa', href: 'https://developer.visa.com/capabilities/trusted-agent-protocol', color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M9 14a5 5 0 0110 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M6 14a8 8 0 0116 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/><path d="M3 14a11 11 0 0122 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/><circle cx="14" cy="18" r="2.5" fill="currentColor"/></svg> },
                  { name: 'UCP', backer: 'Google + Shopify', href: 'https://ucp.dev', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="15" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="5" y="15" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><rect x="15" y="15" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="14" r="2" fill="currentColor" opacity="0.6"/></svg> },
                  { name: 'ACP', backer: 'OpenAI + Stripe', href: 'https://www.agenticcommerce.dev', color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M10 14l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                  { name: 'MC Agent Pay', backer: 'Mastercard', href: 'https://www.mastercard.com/us/en/business/artificial-intelligence/mastercard-agent-pay.html', color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="11" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/><circle cx="17" cy="14" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.7"/><path d="M14 9.5v9" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/></svg> },
                  { name: 'Nanopayments', backer: 'Circle (USDC)', href: 'https://www.circle.com/nanopayments', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/30',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M16.5 11.5a3.5 3.5 0 00-5 0M11.5 16.5a3.5 3.5 0 005 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="14" y1="7" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="14" y1="19" x2="14" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                  { name: 'REST', backer: 'Any HTTP API', href: '/docs', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700/50',
                    icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><path d="M7 10l-3 4 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 10l3 4-3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 7l-4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                ].map((proto, i) => (
                  <RevealSection key={proto.name} delay={i * 0.07}>
                    <a
                      href={proto.href}
                      target={proto.href.startsWith('/') ? undefined : '_blank'}
                      rel={proto.href.startsWith('/') ? undefined : 'noopener noreferrer'}
                      className={`protocol-card group flex flex-col items-center gap-2 rounded-xl border px-3 py-5 hover:scale-[1.04] ${proto.color}`}
                    >
                      <span className="mb-1">{proto.icon}</span>
                      <span className="text-sm sm:text-base font-bold tracking-tight">{proto.name}</span>
                      <span className="text-[10px] sm:text-xs font-semibold opacity-80 text-center leading-tight">{proto.backer}</span>
                    </a>
                  </RevealSection>
                ))}
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  3. How it works — 3-step flow                                   */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <RevealSection>
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">How It Works</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                From zero to revenue in 5 minutes
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
                Three steps to go from open-source function to paid API product.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div>
                  <StepCard
                    step="1"
                    title="Install & Wrap"
                    description="npm install the SDK, set your pricing, and wrap your handler. MCP tool, REST API, or AI agent — five lines of code, any protocol."
                  />
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Or scaffold a complete project instantly:</p>
                    <code className="inline-block text-sm bg-gray-100 dark:bg-[#252836] px-3 py-1.5 rounded-lg font-mono text-brand dark:text-emerald-400">npx create-settlegrid-tool</code>
                  </div>
                </div>
                <StepCard
                  step="2"
                  title="Users Pay Per Call"
                  description="Consumers pre-fund credits via Stripe or crypto (x402/USDC). Auto-refill keeps usage seamless. You keep 95% of every transaction."
                />
                <StepCard
                  step="3"
                  title="Get Paid Automatically"
                  description="Every call is metered in real time. Revenue splits across multi-agent chains settle atomically. $1 minimum payout — the lowest of any AI monetization platform."
                />
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  3b. 1,017 Open-Source Servers callout                          */}
        {/* ================================================================ */}
        <section className="px-6 py-16 border-b border-gray-200 dark:border-[#2E3148] bg-cloud dark:bg-[#0F1117]">
          <RevealSection>
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 mb-6">
                <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z" />
                </svg>
              </div>
              <p className="text-5xl sm:text-6xl font-bold text-indigo dark:text-gray-100 mb-3">
                1,017
              </p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Open-Source MCP Server Templates
              </p>
              <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-6">
                Fork any template, add your API key, and deploy. SettleGrid billing is pre-wired
                &mdash; every template is a monetizable tool waiting to launch.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-4">
                <Link href="/servers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark transition-colors">
                  Browse the catalog
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <a href="https://github.com/lexwhiting/settlegrid/tree/main/open-source-servers" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-200 transition-colors">
                  View on GitHub
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
                <Link href="/learn/handbook" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-200 transition-colors">
                  Read the Monetization Handbook
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  3c. How Your Tools Get Found — discovery channels               */}
        {/* ================================================================ */}
        <section className="px-6 py-20 border-b border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#0F1117]">
          <RevealSection>
            <div className="max-w-5xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">Discovery</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                How Your Tools Get Found
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-2xl mx-auto">
                Three channels bring consumers and AI agents to your tools &mdash; automatically.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Showcase & Search */}
                <div className="bg-gray-50 dark:bg-[#1A1D2E] border border-gray-200 dark:border-[#2E3148] rounded-xl p-8">
                  <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-indigo dark:text-gray-100 text-lg mb-2">Showcase &amp; Search</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    Active tools appear in the SettleGrid Showcase. Consumers browse, search by category, and purchase credits directly.
                  </p>
                  <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors">
                    Browse Showcase
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>

                {/* Card 2: Discovery API */}
                <div className="bg-gray-50 dark:bg-[#1A1D2E] border border-gray-200 dark:border-[#2E3148] rounded-xl p-8">
                  <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-indigo dark:text-gray-100 text-lg mb-2">Discovery API</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                    Any directory, integration, or app can query your tools programmatically.
                  </p>
                  <code className="block text-xs bg-gray-100 dark:bg-[#252836] px-3 py-2 rounded-lg font-mono text-brand dark:text-emerald-400 mb-4">
                    GET /api/v1/discover
                  </code>
                  <Link href="/docs#discovery" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors">
                    API Docs
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>

                {/* Card 3: AI Agent Discovery */}
                <div className="bg-gray-50 dark:bg-[#1A1D2E] border border-gray-200 dark:border-[#2E3148] rounded-xl p-8">
                  <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-indigo dark:text-gray-100 text-lg mb-2">AI Agent Discovery</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3">
                    AI agents find your tools natively via the MCP Discovery Server. Add one line to any MCP client and your tools are findable.
                  </p>
                  <code className="block text-xs bg-gray-100 dark:bg-[#252836] px-3 py-2 rounded-lg font-mono text-brand dark:text-emerald-400 mb-4">
                    npx @settlegrid/discovery
                  </code>
                  <Link href="/learn/discovery" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors">
                    Learn More
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Bottom callout */}
              <div className="mt-10 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1A1D2E] border border-gray-200 dark:border-[#2E3148] rounded-lg inline-flex items-center gap-2 px-5 py-3">
                  <svg className="w-4 h-4 text-brand shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Every active tool is automatically indexed across all three channels. No extra configuration.
                </p>
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  4. Core Platform — 6 cards in 2x3 grid                         */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-cloud dark:bg-[#0F1117]">
          <RevealSection>
            <div className="max-w-5xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">Core Platform</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Built Different From the Ground Up
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-2xl mx-auto">
                Six capabilities purpose-built for AI agent payments that no other platform offers together.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon: iconMetering, title: 'Real-Time Metering', description: 'Sub-50ms Redis metering on every API call. Pre-funded credit balances with auto-refill. Atomic balance checks, deductions, and usage recording in a single pipeline.' },
                  { icon: iconProtocol, title: 'Protocol-Agnostic', description: 'Native support for 10 protocols: MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, and REST. One SDK. Zero vendor lock-in.' },
                  { icon: iconMultiHop, title: 'Multi-Hop Settlement', description: 'Atomic settlement across multi-agent workflows. Agent A calls B calls C — everyone gets paid or no one does. Revenue splits resolved in real time.' },
                  { icon: iconIdentity, title: 'Agent Identity (KYA)', description: 'Know Your Agent verification compatible with AgentFacts, Skyfire JWT, and DID standards. Trust scoring and budget delegation for autonomous agents.' },
                  { icon: iconOutcome, title: 'Outcome-Based Billing', description: 'Charge only when AI delivers results. Define success criteria, verify outcomes, handle disputes. Move beyond per-call to value-based pricing.' },
                  { icon: iconEnterprise, title: 'Enterprise Ready', description: 'Organizations, RBAC, SOC 2 readiness, GDPR compliance, cost allocation, and white-label. Built for teams that need governance and control.' },
                ].map((card, i) => (
                  <RevealSection key={card.title} delay={i * 0.08}>
                    <CoreCard
                      icon={<Icon d={card.icon} />}
                      title={card.title}
                      description={card.description}
                    />
                  </RevealSection>
                ))}
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  5. Built for the AI Economy — 2-col visual highlights           */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <RevealSection>
            <div className="max-w-5xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">Deep Integration</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Native Protocol Support, Not Just Wrappers
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-2xl mx-auto">
                First-class support for x402, AP2, and multi-currency settlement. Not bolted on — built in.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HighlightBlock
                  title="Wrap Anything in One Line"
                  description="Any function, handler, or endpoint becomes a paid API product. One line. Any protocol."
                  code={`settlegrid.wrap(handler, { costCents: 5 })`}
                />
                <HighlightBlock
                  title="x402 Facilitator"
                  description="The first x402 facilitator with metering, budgets, and analytics built in. Accept Coinbase crypto payments natively."
                  code={`POST /api/x402/verify\n{ "paymentHeader": "...", "resource": "/api/v1/data" }`}
                />
                <HighlightBlock
                  title="Multi-Currency Settlement"
                  description="Accept USD, EUR, GBP, JPY, and USDC through one unified ledger. Automatic conversion and reconciliation."
                  code={`pricing: {\n  currency: "USD",\n  defaultCostCents: 5,\n  acceptCrypto: ["USDC", "USDT"]\n}`}
                />
                <HighlightBlock
                  title="Google AP2 Credentials Provider"
                  description="Part of Google's 180+ partner Agent Payments ecosystem. Issue credentials for AP2-enabled agents to transact with your tools."
                  code={`// Google AP2 credential flow\nconst cred = await settlegrid.ap2.issue({\n  agentId: "agent-xyz",\n  budget: { usd: 100 }\n})`}
                />
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  6. Developer Experience — compact checklist                     */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-cloud dark:bg-[#0F1117]">
          <RevealSection>
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">Developer Experience</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                18 Features You Would Have Built Yourself
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-12 max-w-xl mx-auto">
                Every feature a developer needs for production monetization, included on every plan.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4 max-w-3xl mx-auto">
                {dxFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-brand-text shrink-0 font-bold">&#10003;</span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  7. Enterprise section                                           */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-indigo text-white relative overflow-hidden">
          {/* Subtle grid for enterprise section */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <RevealSection>
            <div className="max-w-6xl mx-auto relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <p className="text-sm font-semibold text-brand-light tracking-wide uppercase mb-2">Security</p>
                  <h2 className="text-3xl font-bold mb-4">Security Your Compliance Team Will Love</h2>
                  <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                    Enterprise-grade security and compliance from day one. SOC 2 ready, HMAC-signed webhooks, SHA-256 key hashing, and tiered rate limiting across all 10 protocols.
                  </p>
                  <ul className="space-y-4">
                    {[
                      { label: 'Fraud detection', desc: 'Three-check system: rate spike detection, new-key velocity, duplicate deduplication' },
                      { label: 'Tiered rate limiting', desc: 'Per-plan sliding-window limits (Free through Scale) with automatic 429 responses' },
                      { label: 'IP allowlisting', desc: 'Lock API keys to specific IP ranges and CIDR blocks' },
                      { label: 'HMAC-SHA256 webhooks', desc: 'Cryptographically signed event payloads you can verify' },
                      { label: 'Audit logging', desc: 'Full audit trail with CSV export for SOC 2 evidence collection' },
                      { label: 'SHA-256 key hashing', desc: 'API keys are hashed at rest — we never store plaintext' },
                      { label: 'Multi-protocol settlement', desc: 'MCP, x402, AP2, Visa TAP, and REST — all settled through one ledger' },
                      { label: 'Sandbox mode', desc: 'Test integrations without real charges or side effects' },
                    ].map((item) => (
                      <li key={item.label} className="flex items-start gap-3">
                        <span className="text-brand-light mt-1 font-bold" aria-hidden="true">&#10003;</span>
                        <div>
                          <span className="font-semibold">{item.label}</span>
                          <span className="text-gray-400"> — {item.desc}</span>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {/* Security/Trust badges */}
                  <div className="flex flex-wrap items-center gap-4 mt-8">
                    {[
                      'SOC 2 Ready',
                      'HMAC-SHA256',
                      'SHA-256 at Rest',
                      '99.9% SLA',
                    ].map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex items-center gap-1.5 bg-white/5 border border-white/20 rounded-full px-3 py-1.5 text-xs font-medium text-white/80"
                      >
                        <svg className="w-3.5 h-3.5 text-brand-light" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
                <CopyableCodeBlock
                  className="!my-0"
                  language="Python"
                  code={`# Verify webhook signature
import hmac, hashlib

signature = hmac.new(
    webhook_secret.encode(),
    request.body,
    hashlib.sha256
).hexdigest()

assert signature == request.headers[
    'X-SettleGrid-Signature'
]`}
                />
              </div>
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  8. Comparison table                                             */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <RevealSection>
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-semibold text-brand tracking-wide uppercase text-center mb-2">Comparison</p>
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                The Only Platform That Does It All
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-10 max-w-xl mx-auto">
                Purpose-built for AI agent payments. 15 features. 10 protocols. Nobody else comes close.
              </p>
              <ComparisonTable />
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  9. Pricing                                                      */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-cloud dark:bg-[#0F1117]">
          <RevealSection>
            <div className="max-w-6xl mx-auto">
              <PricingSection />
            </div>
          </RevealSection>
        </section>

        {/* ================================================================ */}
        {/*  10. CTA                                                         */}
        {/* ================================================================ */}
        <section className="px-6 py-24 relative overflow-hidden">
          {/* Background accent */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-brand/[0.03] to-transparent" />
          <RevealSection>
            <div className="max-w-3xl mx-auto text-center relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-indigo dark:text-gray-100 mb-4">
                Your AI tools deserve to earn money
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-3">
                Every API call, metered. Every developer, paid.
                Start with the free tier — upgrade when your revenue demands it.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                No credit card. No vendor lock-in. Ship in 5 minutes.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-10 py-3.5 rounded-lg text-lg hover:bg-brand-dark transition-all shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/30 hover:-translate-y-0.5">
                  Start Building — Free
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-8 py-3.5 rounded-lg text-lg hover:border-indigo hover:text-indigo dark:hover:border-gray-400 dark:hover:text-white transition-colors">
                  Read the Docs
                </Link>
              </div>
              {/* Final trust line */}
              <p className="mt-8 text-xs text-gray-400 dark:text-gray-500">
                MIT-licensed SDK. Open source on GitHub. Backed by Stripe Connect. $1 minimum payout.
              </p>
            </div>
          </RevealSection>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <SettleGridLogo variant="compact" size={32} />
              <span className="hidden sm:inline text-sm text-gray-400 dark:text-gray-500">The settlement layer for AI agent payments</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <Link href="/tools" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Showcase</Link>
              <Link href="/servers" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Templates</Link>
              <Link href="/docs" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Docs</Link>
              <Link href="/learn/handbook" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Handbook</Link>
              <Link href="/learn" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Learn</Link>
              <Link href="/faq" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">FAQ</Link>
              <a href="https://github.com/lexwhiting/settlegrid" target="_blank" rel="noopener noreferrer" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">GitHub</a>
              <Link href="/privacy" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Terms</Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-[#2E3148]/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
            <p>&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
            <p>Built with Stripe Connect, Redis, and TypeScript.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
