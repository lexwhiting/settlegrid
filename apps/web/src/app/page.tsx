import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CodeSnippet } from '@/components/marketing/code-snippet'
import { RevealSection } from '@/components/marketing/home-sections'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'

export const metadata: Metadata = {
  title: 'SettleGrid — The Settlement Layer for the AI Economy',
  description:
    'Meter, settle, and split revenue across any AI service — MCP tools, REST APIs, AI agents, model endpoints. One SDK. Every protocol.',
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
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-brand text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-indigo dark:text-gray-100 text-lg mb-2">{title}</h3>
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
    <div className="group p-6 rounded-xl border border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E] hover:border-brand/40 hover:shadow-md transition-all duration-200 dark:hover:border-brand/50">
      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-indigo dark:text-gray-100 mb-2">{title}</h3>
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
    <div className="p-6 rounded-xl border border-gray-200 dark:border-[#2E3148] bg-white dark:bg-[#1A1D2E]">
      <h3 className="font-semibold text-lg text-indigo dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">{description}</p>
      <CopyableCodeBlock code={code} className="!my-0" />
    </div>
  )
}

function ComparisonTable() {
  const features = [
    { name: 'Protocol support', settlegrid: 'MCP, x402, AP2, REST', stripe: 'REST only', nevermined: 'x402 / DeFi', paid: 'MCP only' },
    { name: 'Real-time metering', settlegrid: '<50ms Redis', stripe: 'Batch only', nevermined: 'On-chain', paid: 'Per-call' },
    { name: 'Multi-hop settlement', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Agent identity (KYA)', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Outcome-based billing', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Fiat + crypto ledger', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Stripe Connect payouts', settlegrid: true, stripe: true, nevermined: false, paid: false },
    { name: 'Per-method pricing', settlegrid: true, stripe: true, nevermined: false, paid: true },
    { name: 'Auto-refill credits', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'IP allowlisting', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Fraud detection', settlegrid: true, stripe: true, nevermined: false, paid: false },
    { name: 'Sandbox mode', settlegrid: true, stripe: true, nevermined: false, paid: true },
    { name: 'Open-source SDK', settlegrid: true, stripe: false, nevermined: true, paid: false },
    { name: 'Budget enforcement', settlegrid: true, stripe: false, nevermined: false, paid: false },
    { name: 'Revenue split (85%+)', settlegrid: true, stripe: false, nevermined: false, paid: false },
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table" aria-label="Feature comparison">
        <thead>
          <tr className="border-b border-gray-200 dark:border-[#2E3148]">
            <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Feature</th>
            <th scope="col" className="text-center py-3 px-4 font-semibold text-brand-text">SettleGrid</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stripe Billing</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Nevermined</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Paid.ai</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.name} className="border-b border-gray-100 dark:border-[#2E3148]/50">
              <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{f.name}</td>
              <td className="text-center py-3 px-4">{renderCell(f.settlegrid)}</td>
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
      description: 'For experimenting and prototyping',
      features: [
        '1 service',
        '1,000 operations/month',
        'Per-call billing',
        'Basic dashboard',
        '85% revenue share',
      ],
      cta: 'Start Free',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Builder',
      price: '$29',
      period: '/month',
      description: 'For solo developers shipping services',
      features: [
        '5 services',
        '50,000 operations/month',
        'Full analytics',
        'Webhook events',
        'Sandbox mode',
        '85% revenue share',
      ],
      cta: 'Start Building',
      href: '/register',
      highlighted: false,
    },
    {
      name: 'Scale',
      price: '$99',
      period: '/month',
      description: 'For teams with growing usage',
      features: [
        'Unlimited services',
        '500,000 operations/month',
        'Priority webhooks',
        'IP allowlisting',
        'CSV export',
        'Referral system',
        '87% revenue share',
      ],
      cta: 'Get Started',
      href: '/register',
      highlighted: true,
    },
    {
      name: 'Platform',
      price: '$299',
      period: '/month',
      description: 'For enterprises and platforms',
      features: [
        'Unlimited everything',
        'Dedicated support',
        '99.9% SLA',
        'Fraud detection',
        'Audit logging',
        'Custom integrations',
        '90% revenue share',
      ],
      cta: 'Contact Sales',
      href: '/register',
      highlighted: false,
    },
  ]

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 mb-4">Simple, Transparent Pricing</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-10 max-w-xl mx-auto">
        Start free. Scale as you grow. You always keep the majority of your revenue.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`p-6 rounded-xl border-2 text-left relative ${
              tier.highlighted
                ? 'border-brand shadow-lg shadow-brand/10'
                : 'border-gray-200 dark:border-[#2E3148]'
            }`}
          >
            {tier.highlighted && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand text-white text-xs font-semibold px-3 py-1 rounded-full">
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
        ))}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  SVG icon helpers (Heroicons-style, 24x24 viewBox)                         */
/* -------------------------------------------------------------------------- */

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
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
    <div className="min-h-screen flex flex-col">
      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4 dark:bg-[#0F1117]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <SettleGridLogo variant="horizontal" size={32} />
          <div className="flex items-center gap-4">
            <Link href="/tools" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
              Docs
            </Link>
            <ThemeToggle />
            <Link href="/login" className="hidden sm:inline text-sm font-medium text-indigo dark:text-gray-300 hover:text-brand-dark dark:hover:text-brand-light transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ================================================================ */}
        {/*  1. Hero — Dark with gradient mesh                               */}
        {/* ================================================================ */}
        <section className="relative px-6 py-24 bg-indigo overflow-hidden">
          {/* CSS-only gradient mesh background */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16, 185, 129, 0.3), transparent),
                radial-gradient(ellipse 60% 40% at 80% 50%, rgba(14, 165, 233, 0.15), transparent),
                radial-gradient(ellipse 50% 60% at 10% 80%, rgba(139, 92, 246, 0.1), transparent)
              `,
            }}
          />
          <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white dark:bg-[#1A1D2E]/10 text-brand-light border border-white/20 text-xs font-semibold px-3 py-1 rounded-full mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                </span>
                Early Access
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
                The Settlement Layer for the{' '}
                <span className="text-brand-light">AI Economy</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Meter, settle, and split revenue across any AI service — MCP tools,
                REST APIs, AI agents, model endpoints. One SDK. Every protocol.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
                  Start Building
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center border-2 border-white/30 text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-white/10 transition-colors">
                  Read Docs
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-400">
                <span>&#10003; Free tier</span>
                <span>&#10003; No credit card</span>
                <span>&#10003; Any AI protocol</span>
              </div>
              <div className="flex items-center gap-4 mt-4">
                <a
                  href="https://github.com/settlegrid/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors border border-white/15 rounded-full px-3 py-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                  Open Source SDK
                </a>
                <a
                  href="https://www.npmjs.com/package/@settlegrid/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors border border-white/15 rounded-full px-3 py-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0h-2.666V8.667h5.334v5.332h-2.668v-4h-1.332v4h1.332zm12-5.332v4h-1.332v-4H20v4h-1.334v-4h-1.332v5.332H24V8.666h-1.334z" />
                  </svg>
                  @settlegrid/mcp
                </a>
              </div>
            </div>
            <div>
              <CodeSnippet />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  2. Protocol logo bar                                            */}
        {/* ================================================================ */}
        <section className="px-6 py-12 border-b border-gray-200 dark:border-[#2E3148]">
          <RevealSection>
            <div className="max-w-4xl mx-auto">
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-8">One SDK. Every protocol.</p>
              <div className="flex items-center justify-center gap-8 sm:gap-12 flex-wrap">
                {[
                  { name: 'MCP', label: 'Model Context Protocol' },
                  { name: 'x402', label: 'Coinbase x402' },
                  { name: 'AP2', label: 'Google Agent Payments' },
                  { name: 'Visa TAP', label: 'Visa Token Agent Payments' },
                  { name: 'Stripe', label: 'Stripe Connect' },
                  { name: 'REST', label: 'Any REST API' },
                ].map((proto) => (
                  <span
                    key={proto.name}
                    title={proto.label}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors font-semibold text-base sm:text-lg select-none"
                  >
                    {proto.name}
                  </span>
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
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Monetize any AI service in 5 minutes
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-xl mx-auto">
                Three steps to go from open-source function to paid API product.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <StepCard
                  step="1"
                  title="Wrap Any AI Service"
                  description="Install the SDK, configure pricing, and wrap your handler — MCP tool, REST API, AI agent, or model endpoint. One import, five lines of code."
                />
                <StepCard
                  step="2"
                  title="Consumers Buy Credits"
                  description="Fiat via Stripe or crypto via x402/USDC. Consumers pre-fund credit balances with auto-refill. You get an 85% revenue share."
                />
                <StepCard
                  step="3"
                  title="Revenue Flows Automatically"
                  description="Real-time metering on every call. Automatic revenue splits across multi-agent chains. Instant payouts to your bank or wallet."
                />
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
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Core Platform
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-2xl mx-auto">
                Six capabilities that make SettleGrid the commerce layer for AI.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CoreCard
                  icon={<Icon d={iconMetering} />}
                  title="Real-Time Metering"
                  description="Sub-50ms Redis metering on every API call. Pre-funded credit balances with auto-refill. Atomic balance checks, deductions, and usage recording in a single pipeline."
                />
                <CoreCard
                  icon={<Icon d={iconProtocol} />}
                  title="Protocol-Agnostic"
                  description="Native support for MCP, x402 (Coinbase), AP2 (Google), Visa TAP, and any REST API. One SDK, every protocol. No vendor lock-in."
                />
                <CoreCard
                  icon={<Icon d={iconMultiHop} />}
                  title="Multi-Hop Settlement"
                  description="Atomic settlement across multi-agent workflows. Agent A calls B calls C — everyone gets paid or no one does. Revenue splits resolved in real time."
                />
                <CoreCard
                  icon={<Icon d={iconIdentity} />}
                  title="Agent Identity (KYA)"
                  description="Know Your Agent verification compatible with AgentFacts, Skyfire JWT, and DID standards. Trust scoring and budget delegation for autonomous agents."
                />
                <CoreCard
                  icon={<Icon d={iconOutcome} />}
                  title="Outcome-Based Billing"
                  description="Charge only when AI delivers results. Define success criteria, verify outcomes, handle disputes. Move beyond per-call to value-based pricing."
                />
                <CoreCard
                  icon={<Icon d={iconEnterprise} />}
                  title="Enterprise Ready"
                  description="Organizations, RBAC, SOC 2 readiness, GDPR compliance, cost allocation, and white-label. Built for teams that need governance and control."
                />
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
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Built for the AI Economy
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-16 max-w-2xl mx-auto">
                From one-line integration to multi-currency settlement — SettleGrid handles every layer.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HighlightBlock
                  title="One-Line Integration"
                  description="Wrap any function, handler, or endpoint. Monetized in seconds."
                  code={`settlegrid.wrap(handler, { costCents: 5 })`}
                />
                <HighlightBlock
                  title="x402 Facilitator"
                  description="The first facilitator that adds metering, budgets, and analytics to the x402 payment protocol."
                  code={`POST /api/x402/verify\n{ "paymentHeader": "...", "resource": "/api/v1/data" }`}
                />
                <HighlightBlock
                  title="Multi-Currency Settlement"
                  description="USD, EUR, GBP, JPY, USDC — fiat and crypto in one unified ledger. Automatic conversion and reconciliation."
                  code={`pricing: {\n  currency: "USD",\n  defaultCostCents: 5,\n  acceptCrypto: ["USDC", "USDT"]\n}`}
                />
                <HighlightBlock
                  title="AP2 Credentials Provider"
                  description="Part of Google's 180+ partner Agent Payments ecosystem. SettleGrid acts as a credentials provider for AP2-enabled agents."
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
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                Developer Experience
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-12 max-w-xl mx-auto">
                Everything else you need, built in from day one.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 max-w-3xl mx-auto">
                {dxFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span className="text-brand-text shrink-0">&#10003;</span>
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
        <section className="px-6 py-24 bg-indigo text-white">
          <RevealSection>
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div>
                  <h2 className="text-3xl font-bold mb-4">Built for Enterprise</h2>
                  <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                    SettleGrid meets the security and compliance requirements of the most
                    demanding organizations. Native support for AP2, Visa TAP, and x402 means
                    your agents can transact across any protocol with enterprise-grade controls.
                  </p>
                  <ul className="space-y-4">
                    {[
                      { label: 'Fraud detection', desc: 'Three-check system: rate spike detection, new-key velocity, duplicate deduplication' },
                      { label: 'Tiered rate limiting', desc: 'Per-plan sliding-window limits (Free through Enterprise) with automatic 429 responses' },
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
                        <svg className="w-3.5 h-3.5 text-brand-light" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 text-center mb-4">
                How SettleGrid Compares
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-center mb-10 max-w-xl mx-auto">
                Purpose-built for AI service monetization across every protocol.
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
        <section className="px-6 py-24">
          <RevealSection>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-indigo dark:text-gray-100 mb-4">
                Ready to monetize your AI services?
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-3">
                Join developers earning revenue from every API call. Free to start,
                pay only when you earn.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Free tier. No credit card. Works with any AI protocol.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
                  Start Building
                </Link>
                <Link href="/tools" className="inline-flex items-center justify-center border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold px-8 py-3 rounded-lg text-lg hover:border-indigo hover:text-indigo dark:hover:border-gray-400 dark:hover:text-white transition-colors">
                  Browse Marketplace
                </Link>
              </div>
            </div>
          </RevealSection>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link href="/tools" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Marketplace</Link>
            <Link href="/docs" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo dark:hover:text-gray-200 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
