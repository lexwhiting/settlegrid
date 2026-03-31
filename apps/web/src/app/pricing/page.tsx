import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Pricing | SettleGrid — AI Tool Billing That Grows With You',
  description:
    'SettleGrid pricing: Free forever at 50K ops/month. Progressive take rate starts at 0% on your first $1K/mo. Builder ($19/mo) and Scale ($79/mo) plans for growing businesses. See exactly what you keep at every revenue level.',
  alternates: { canonical: 'https://settlegrid.ai/pricing' },
  keywords: [
    'SettleGrid pricing',
    'AI tool billing pricing',
    'MCP billing cost',
    'usage-based billing pricing',
    'AI agent payment pricing',
    'per-call billing cost',
    'AI monetization platform pricing',
    'progressive take rate',
  ],
  openGraph: {
    title: 'Pricing | SettleGrid',
    description:
      'Free forever at 50K ops/month. Progressive take rate starts at 0%. See exactly what you keep.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing | SettleGrid',
    description: 'Free forever at 50K ops/month. Progressive take rate starts at 0%.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdProduct = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'SettleGrid',
  description:
    'The universal settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts for AI services across 15 payment protocols.',
  brand: { '@type': 'Brand', name: 'SettleGrid' },
  url: 'https://settlegrid.ai/pricing',
  offers: [
    {
      '@type': 'Offer',
      name: 'Free',
      price: '0',
      priceCurrency: 'USD',
      description:
        'Free forever. 50,000 operations/month, unlimited tools, progressive take rate starting at 0%, full dashboard.',
    },
    {
      '@type': 'Offer',
      name: 'Builder',
      price: '19',
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
      description:
        '200,000 operations/month, sandbox mode, Slack/Discord notifications, health alerts, benchmarking, revenue forecasting, priority listing, white-label widget.',
    },
    {
      '@type': 'Offer',
      name: 'Scale',
      price: '79',
      priceCurrency: 'USD',
      priceSpecification: { '@type': 'UnitPriceSpecification', billingDuration: 'P1M' },
      description:
        '2,000,000 operations/month, advanced analytics, consumer insights, fraud detection, anomaly alerts, data export, audit logs, team access, dedicated support.',
    },
  ],
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://settlegrid.ai/pricing' },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for side projects and experimentation.',
    features: [
      'Unlimited tools',
      '50,000 operations/month',
      'Per-call billing',
      'Full dashboard',
      'Progressive take rate (0% on first $1K)',
      '1 webhook endpoint',
      '7-day log retention',
      'Community support',
    ],
    cta: 'Start Free',
    ctaHref: '/register',
    highlight: false,
  },
  {
    name: 'Builder',
    price: '$19',
    period: '/month',
    description: 'For developers earning revenue and scaling up.',
    features: [
      'Everything in Free',
      '200,000 operations/month',
      'Sandbox mode (test keys)',
      'Slack & Discord notifications',
      'Health alerts for your tools',
      'Category benchmarking',
      'Revenue forecasting',
      'Priority marketplace listing',
      'White-label pricing widget',
      '3 webhook endpoints',
      '30-day log retention',
      'Priority email support',
    ],
    cta: 'Start Building',
    ctaHref: '/register',
    highlight: true,
  },
  {
    name: 'Scale',
    price: '$79',
    period: '/month',
    description: 'For teams and high-volume AI services.',
    features: [
      'Everything in Builder',
      '2,000,000 operations/month',
      'Advanced analytics (10 metrics)',
      'Consumer insights (churn, LTV, at-risk)',
      'Anomaly detection alerts',
      'Fraud detection (12 signals)',
      'Data export (GDPR)',
      'Audit logs',
      'IP allowlisting',
      'Enhanced weekly reports',
      'Custom webhook headers',
      'Team access (up to 5 members)',
      '10 webhook endpoints',
      '90-day log retention',
      'Dedicated support & SLA guarantee',
    ],
    cta: 'Go Scale',
    ctaHref: '/register',
    highlight: false,
  },
] as const

const takeRateBrackets = [
  { bracket: '$0 \u2013 $1,000', rate: '0%', youKeep: '100%', example: '$1,000 revenue \u2192 you keep $1,000' },
  { bracket: '$1,001 \u2013 $10,000', rate: '2%', youKeep: '98%', example: '$5,000 revenue \u2192 you keep $4,920' },
  { bracket: '$10,001 \u2013 $50,000', rate: '2.5%', youKeep: '97.5%', example: '$25,000 revenue \u2192 you keep $24,445' },
  { bracket: '$50,001+', rate: '5%', youKeep: '95%', example: '$100,000 revenue \u2192 you keep $96,830' },
] as const

const revenueExamples = [
  { monthly: '$500', settlegrid: '$500', mcpize: '$425', note: 'SettleGrid: 0% take. MCPize: 15% take.' },
  { monthly: '$2,000', settlegrid: '$1,980', mcpize: '$1,700', note: '0% on first $1K + 2% on next $1K.' },
  { monthly: '$10,000', settlegrid: '$9,820', mcpize: '$8,500', note: 'Progressive brackets save you $1,320/mo.' },
  { monthly: '$50,000', settlegrid: '$48,620', mcpize: '$42,500', note: 'At scale, you keep $6,120 more per month.' },
  { monthly: '$100,000', settlegrid: '$97,080', mcpize: '$85,000', note: 'You keep $12,080 more per month vs 15% flat.' },
] as const

const faqs = [
  {
    q: 'What is the progressive take rate?',
    a: 'Instead of a flat percentage, SettleGrid uses revenue brackets. Your first $1,000/month has a 0% take rate \u2014 you keep everything. As you earn more, a small percentage applies only to the revenue above each threshold. This means you always keep more than you would with a flat-rate competitor.',
  },
  {
    q: 'Is the Free plan really free forever?',
    a: 'Yes. The Free plan includes 50,000 operations per month, unlimited tools, a full dashboard, and the progressive take rate. No credit card required. No trial period. Most individual developers never need to upgrade.',
  },
  {
    q: 'When should I upgrade to Builder or Scale?',
    a: 'Upgrade when you hit the operation limit on your current plan. Builder gives you 200K ops/month and sandbox mode for $19/mo. Scale gives you 2M ops/month and fraud detection for $79/mo. The progressive take rate is the same across all plans.',
  },
  {
    q: 'How does SettleGrid compare to a 15% flat take rate?',
    a: 'On a 15% flat rate (like MCPize), you lose $1,500 on $10,000 in revenue. On SettleGrid, you lose only $180 \u2014 because the first $1,000 is free and only the amount above each bracket is charged. At $100K/mo, you keep $12,080 more with SettleGrid.',
  },
  {
    q: 'Are there any hidden fees?',
    a: 'No. The plan price (if any) plus the progressive take rate is the complete cost. Stripe payment processing fees (2.9% + $0.30) are separate and charged by Stripe, not by SettleGrid. There are no setup fees, no per-tool fees, and no minimum commitments.',
  },
] as const

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function PricingPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdProduct) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4">
              Pricing that grows with you
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Start free. Keep 100% of your first $1,000 every month. Progressive take rates
              mean you always keep more than you would on a flat-rate platform.
            </p>
          </div>

          {/* ---- Plan Cards ---- */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-8 flex flex-col ${
                  plan.highlight
                    ? 'bg-gradient-to-b from-amber-500/10 to-[#161822] border-2 border-amber-500/40 ring-1 ring-amber-500/20'
                    : 'bg-[#161822] border border-[#2A2D3E]'
                }`}
              >
                {plan.highlight && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-4">
                    Most Popular
                  </span>
                )}
                <h2 className="text-2xl font-bold text-gray-100">{plan.name}</h2>
                <div className="mt-2 mb-4">
                  <span className="text-4xl font-bold text-gray-100">{plan.price}</span>
                  <span className="text-gray-400 ml-1">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-400 mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-3 text-sm">
                      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-gray-300">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.ctaHref}
                  className={`text-center font-semibold py-3 rounded-lg transition-colors ${
                    plan.highlight
                      ? 'bg-brand text-white hover:bg-brand-dark'
                      : 'border border-[#2A2D3E] text-gray-300 hover:border-gray-400 hover:text-gray-100'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* ---- Progressive Take Rate Table ---- */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-gray-100 mb-4 text-center">
              Progressive Take Rate
            </h2>
            <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
              Your first $1,000 every month is always free. Above that, only the incremental
              revenue in each bracket is charged.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Progressive take rate brackets">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left font-medium text-gray-400 px-6 py-4">Revenue Bracket</th>
                      <th className="text-center font-medium text-gray-400 px-6 py-4">Take Rate</th>
                      <th className="text-center font-medium text-gray-400 px-6 py-4">You Keep</th>
                      <th className="text-left font-medium text-gray-400 px-6 py-4">Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {takeRateBrackets.map((row, i) => (
                      <tr key={row.bracket} className={i < takeRateBrackets.length - 1 ? 'border-b border-[#252836]' : ''}>
                        <td className="px-6 py-4 text-gray-100 font-medium">{row.bracket}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={row.rate === '0%' ? 'text-amber-400 font-bold' : 'text-gray-300'}>
                            {row.rate}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-300">{row.youKeep}</td>
                        <td className="px-6 py-4 text-gray-400">{row.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ---- Revenue Comparison: SettleGrid vs Competitors ---- */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-gray-100 mb-4 text-center">
              What You Keep: SettleGrid vs 15% Flat Rate
            </h2>
            <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
              Most marketplace platforms charge 10-15% flat. Here is what you actually keep at
              different revenue levels.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Revenue comparison at different levels">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left font-medium text-gray-400 px-6 py-4">Monthly Revenue</th>
                      <th className="text-center font-medium text-amber-400 px-6 py-4">You Keep (SettleGrid)</th>
                      <th className="text-center font-medium text-gray-400 px-6 py-4">You Keep (15% Flat)</th>
                      <th className="text-left font-medium text-gray-400 px-6 py-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueExamples.map((row, i) => (
                      <tr key={row.monthly} className={i < revenueExamples.length - 1 ? 'border-b border-[#252836]' : ''}>
                        <td className="px-6 py-4 text-gray-100 font-medium">{row.monthly}</td>
                        <td className="px-6 py-4 text-center text-amber-400 font-semibold">{row.settlegrid}</td>
                        <td className="px-6 py-4 text-center text-gray-400">{row.mcpize}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs">{row.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ---- FAQ ---- */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold text-gray-100 mb-8 text-center">
              Pricing FAQ
            </h2>
            <div className="max-w-3xl mx-auto space-y-6">
              {faqs.map((faq) => (
                <div key={faq.q} className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">{faq.q}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Start free. Scale when ready.
            </h2>
            <p className="text-gray-400 mb-4 max-w-xl mx-auto">
              50,000 operations per month, progressive take rate starting at 0%.
              No credit card required.
            </p>
            <p className="text-sm text-amber-400/80 mb-8">
              Invite developers and both get 5,000 free operations.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg hover:bg-brand-dark transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center border border-[#2A2D3E] text-gray-300 font-medium px-8 py-3 rounded-lg hover:border-gray-400 hover:text-gray-100 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-8 mt-16">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
