import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Comparison data for each slug                                             */
/* -------------------------------------------------------------------------- */

interface FeatureRow {
  feature: string
  settlegrid: string
  competitor: string
}

interface ComparisonData {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  competitorName: string
  introParagraph: string
  features: FeatureRow[]
  settlegridPros: string[]
  competitorPros: string[]
  verdict: string
}

const comparisons: Record<string, ComparisonData> = {
  'vs-diy': {
    slug: 'vs-diy',
    title: 'SettleGrid vs Building Your Own AI Billing',
    metaTitle: 'SettleGrid vs Building Your Own AI Billing | SettleGrid',
    metaDescription:
      'Compare SettleGrid to building your own per-call billing system. Setup time, metering, payouts, fraud detection, and total cost of ownership.',
    competitorName: 'DIY',
    introParagraph:
      'Every developer who monetizes an AI tool faces the same question: build or buy? Building your own billing infrastructure means wiring up metering, balance management, Stripe Connect payouts, fraud detection, and budget enforcement from scratch. SettleGrid replaces all of that with two lines of code. Here is a detailed breakdown of what each path involves.',
    features: [
      { feature: 'Setup time', settlegrid: '2 lines of code', competitor: '2\u20134 weeks' },
      { feature: 'Per-call metering', settlegrid: '<50ms Redis', competitor: 'Build from scratch' },
      { feature: 'Credit balance management', settlegrid: 'Built-in', competitor: 'Build from scratch' },
      { feature: 'Stripe Connect payouts', settlegrid: 'Automatic', competitor: 'Manual integration' },
      { feature: 'Fraud detection', settlegrid: '12 signals', competitor: 'Build from scratch' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'Build from scratch' },
      { feature: 'Multi-protocol support', settlegrid: '10 protocols', competitor: 'One at a time' },
      { feature: 'Maintenance burden', settlegrid: 'Zero', competitor: 'Ongoing' },
      { feature: 'Cost', settlegrid: '$0\u201379/mo', competitor: 'Engineering time' },
    ],
    settlegridPros: [
      'Ship monetization in minutes instead of weeks',
      'Battle-tested metering and fraud detection out of the box',
      'Automatic payouts without Stripe Connect boilerplate',
      'Free tier with 25K operations per month at 0% fees',
    ],
    competitorPros: [
      'Full control over every implementation detail',
      'No external dependency for billing logic',
      'May make sense at extreme scale with a dedicated billing team',
    ],
    verdict:
      'For the vast majority of AI tool developers, building your own billing is a distraction from building your product. SettleGrid handles the undifferentiated heavy lifting so you can focus on what makes your tool valuable. The free tier means you can start without any cost, and the time saved pays for itself many times over.',
  },
  'vs-nevermined': {
    slug: 'vs-nevermined',
    title: 'SettleGrid vs Nevermined',
    metaTitle:
      'SettleGrid vs Nevermined: AI Agent Payment Platforms Compared | SettleGrid',
    metaDescription:
      'Feature-by-feature comparison of SettleGrid and Nevermined for AI agent payments. Protocols, metering speed, pricing, and SDK simplicity.',
    competitorName: 'Nevermined',
    introParagraph:
      'Both SettleGrid and Nevermined enable payments between AI agents. Nevermined focuses on crypto-native, on-chain settlement via x402 and A2A protocols. SettleGrid takes a protocol-agnostic approach, supporting 10 payment protocols with sub-50ms Redis metering and both fiat and crypto settlement. Here is how they compare across key dimensions.',
    features: [
      { feature: 'Take rate', settlegrid: '0\u20135%', competitor: '1\u20136.5%' },
      { feature: 'Protocol support', settlegrid: '10 protocols', competitor: 'x402 / A2A' },
      { feature: 'Metering speed', settlegrid: '<50ms Redis', competitor: 'On-chain' },
      { feature: 'SDK simplicity', settlegrid: '2 lines of code', competitor: 'SDK + config' },
      { feature: 'Fiat support', settlegrid: 'Yes (Stripe)', competitor: 'Limited' },
      { feature: 'Crypto support', settlegrid: 'Yes (x402/USDC)', competitor: 'Yes (Base/Polygon)' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Free tier', settlegrid: '25K ops, 0% fee', competitor: 'Limited free' },
    ],
    settlegridPros: [
      'Supports 10 protocols (MCP, x402, AP2, MPP, Visa TAP, UCP, and more)',
      'Sub-50ms metering for real-time per-call billing',
      'Works with fiat and crypto out of the box',
      'Budget enforcement prevents runaway agent spending',
    ],
    competitorPros: [
      'Deep crypto-native integration with Base and Polygon',
      'Strong on-chain auditability',
      'Purpose-built for the x402 ecosystem',
    ],
    verdict:
      'Choose Nevermined if your use case is purely crypto-native and on-chain settlement is a requirement. Choose SettleGrid if you need fiat support, broader protocol coverage, sub-50ms metering, or budget enforcement. Most developers shipping AI tools today need all of these, which is why SettleGrid covers a wider set of real-world scenarios.',
  },
  'vs-stripe': {
    slug: 'vs-stripe',
    title: 'SettleGrid vs Stripe Billing for AI Tools',
    metaTitle: 'SettleGrid vs Stripe Billing for AI Tools | SettleGrid',
    metaDescription:
      'Compare SettleGrid to Stripe Billing for AI tool monetization. Per-call metering, MCP support, agent identity, budget enforcement, and setup complexity.',
    competitorName: 'Stripe Billing',
    introParagraph:
      'Stripe is the gold standard for online payments and works brilliantly for SaaS subscriptions. But AI tools have fundamentally different billing needs: per-call metering, real-time balance checks, agent identity, and multi-hop settlement. SettleGrid is purpose-built for this world. Here is a side-by-side comparison.',
    features: [
      { feature: 'Per-call metering', settlegrid: 'Built-in <50ms', competitor: 'Build yourself' },
      { feature: 'Real-time balance checks', settlegrid: 'Atomic Redis', competitor: 'Build yourself' },
      { feature: 'MCP support', settlegrid: 'Native SDK', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'x402 / crypto', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Setup for AI billing', settlegrid: '2 lines of code', competitor: 'Weeks of development' },
    ],
    settlegridPros: [
      'Purpose-built for per-call AI tool billing',
      'Native MCP and multi-protocol support',
      'Real-time atomic balance checks and budget enforcement',
      'Agent identity (Know Your Agent) built in',
    ],
    competitorPros: [
      'Industry-leading payment processing reliability',
      'Best-in-class subscription billing',
      'Massive ecosystem of integrations',
      'Well-suited for traditional SaaS products',
    ],
    verdict:
      'Stripe is an incredible platform, and SettleGrid actually uses Stripe Connect under the hood for fiat settlement. The difference is that SettleGrid adds the AI-specific layer on top: per-call metering, real-time budget enforcement, MCP support, and agent identity. If you are billing for AI tool usage, SettleGrid saves you from building that entire layer yourself on top of Stripe.',
  },
}

const validSlugs = Object.keys(comparisons)

/* -------------------------------------------------------------------------- */
/*  Static params + metadata                                                  */
/* -------------------------------------------------------------------------- */

export function generateStaticParams() {
  return validSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = comparisons[slug]
  if (!data) return { title: 'Comparison Not Found | SettleGrid' }
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: { canonical: `https://settlegrid.ai/learn/compare/${slug}` },
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      type: 'article',
      siteName: 'SettleGrid',
    },
    twitter: {
      card: 'summary_large_image',
      title: data.metaTitle,
      description: data.metaDescription,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-emerald-400 mx-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-label="Yes"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      className="w-5 h-5 text-red-400 mx-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-label="No"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

/** Render a cell value — show a check/x if the value is exactly Yes/No, otherwise show text. */
function CellValue({ value, isSettleGrid }: { value: string; isSettleGrid: boolean }) {
  if (value === 'Yes') return <CheckIcon />
  if (value === 'No') return <XIcon />
  return (
    <span className={isSettleGrid ? 'text-gray-100 font-medium' : 'text-gray-400'}>
      {value}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = comparisons[slug]
  if (!data) notFound()

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/learn/compare"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Comparisons
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
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-gray-100 transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href="/learn/compare"
                  className="hover:text-gray-100 transition-colors"
                >
                  Comparisons
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-100">{data.slug}</li>
            </ol>
          </nav>

          {/* H1 */}
          <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6">
            {data.title}
          </h1>

          {/* Intro */}
          <p className="text-lg text-gray-400 leading-relaxed mb-12 max-w-3xl">
            {data.introParagraph}
          </p>

          {/* ---- Comparison Table ---- */}
          <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl overflow-hidden mb-12">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={`Feature comparison: SettleGrid vs ${data.competitorName}`}>
                <thead>
                  <tr className="border-b border-[#2E3148]">
                    <th className="text-left text-gray-400 font-medium px-6 py-4 w-1/3">
                      Feature
                    </th>
                    <th className="text-center text-emerald-400 font-semibold px-6 py-4 w-1/3">
                      SettleGrid
                    </th>
                    <th className="text-center text-gray-400 font-medium px-6 py-4 w-1/3">
                      {data.competitorName}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.features.map((row, i) => (
                    <tr
                      key={row.feature}
                      className={
                        i < data.features.length - 1
                          ? 'border-b border-[#252836]'
                          : ''
                      }
                    >
                      <td className="px-6 py-4 text-gray-300 font-medium">
                        {row.feature}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={row.settlegrid} isSettleGrid />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CellValue value={row.competitor} isSettleGrid={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Pros Sections ---- */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* SettleGrid Pros */}
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-emerald-400 mb-4">
                Why SettleGrid
              </h2>
              <ul className="space-y-3">
                {data.settlegridPros.map((pro) => (
                  <li key={pro} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-gray-300 leading-relaxed">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Competitor Pros */}
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-300 mb-4">
                Why {data.competitorName}
              </h2>
              <ul className="space-y-3">
                {data.competitorPros.map((pro) => (
                  <li key={pro} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500 shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    <span className="text-gray-400 leading-relaxed">{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ---- Verdict ---- */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">The Verdict</h2>
            <p className="text-gray-400 leading-relaxed max-w-3xl">
              {data.verdict}
            </p>
          </section>

          {/* ---- Prose placeholder for founder to expand ---- */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">
              Deep Dive
            </h2>
            <div className="bg-[#1A1D2E] border border-dashed border-[#2E3148] rounded-xl p-8 text-center text-gray-500">
              <p className="text-sm">
                {/* TODO: Founder — expand this section with 500-1000 words of detailed analysis */}
                Detailed prose content will go here. Cover specific use cases,
                code examples, migration guides, and customer testimonials.
              </p>
            </div>
          </section>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#1A1D2E] to-[#0F1117] border border-[#2E3148] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Ready to monetize your AI tools?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Start with the free tier — 25,000 operations per month, 0% take
              rate. No credit card required.
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
                className="inline-flex items-center justify-center border border-[#2E3148] text-gray-300 font-medium px-8 py-3 rounded-lg hover:border-gray-400 hover:text-gray-100 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </section>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2E3148] px-6 py-8 mt-16">
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
