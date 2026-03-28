import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'About | SettleGrid — The Settlement Layer for the AI Economy',
  description:
    'SettleGrid is building the settlement layer for the AI economy. Our mission: make every AI service call a monetizable event. Solo founder, open pricing, developer-first, protocol-agnostic.',
  alternates: { canonical: 'https://settlegrid.ai/about' },
  keywords: [
    'about SettleGrid',
    'SettleGrid founder',
    'SettleGrid mission',
    'AI settlement layer',
    'AI economy infrastructure',
    'SettleGrid team',
  ],
  openGraph: {
    title: 'About | SettleGrid',
    description: 'Building the settlement layer for the AI economy.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About | SettleGrid',
    description: 'Building the settlement layer for the AI economy.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdOrganization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SettleGrid',
  url: 'https://settlegrid.ai',
  logo: 'https://settlegrid.ai/brand/icon-color.svg',
  description:
    'SettleGrid is the universal settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts for any AI service across 15 payment protocols.',
  foundingDate: '2026',
  sameAs: [
    'https://github.com/lexwhiting/settlegrid',
    'https://www.npmjs.com/package/@settlegrid/mcp',
  ],
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://settlegrid.ai/about' },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const values = [
  {
    title: 'Open Pricing',
    description:
      'No hidden fees. Progressive take rate published on the website. You know exactly what you keep at every revenue level. We earn when you earn.',
  },
  {
    title: 'Developer-First',
    description:
      '2 lines of code to start billing. TypeScript SDK, comprehensive docs, sandbox mode, and a free tier that never expires. We build for developers, not procurement departments.',
  },
  {
    title: 'Protocol-Agnostic',
    description:
      '15 payment protocols through one SDK. MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, REST, L402, Alipay Trust, KYAPay, EMVCo, and DRAIN. We believe the settlement layer should work with every protocol, not lock you into one.',
  },
  {
    title: 'Ship Fast, Iterate Publicly',
    description:
      'Public changelog, open-source SDK, transparent roadmap. We ship every day and share what we learn. The best infrastructure is built in the open.',
  },
] as const

const stats = [
  { value: '15', label: 'Payment Protocols' },
  { value: '6', label: 'Pricing Models' },
  { value: '8', label: 'Service Categories' },
  { value: '50K', label: 'Free Ops/Month' },
] as const

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />
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
        <div className="max-w-4xl mx-auto">
          {/* ---- Mission ---- */}
          <section className="mb-20">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6">
              Make every AI service call a monetizable event.
            </h1>
            <p className="text-xl text-gray-400 leading-relaxed max-w-3xl">
              That is the mission. AI agents are going to make trillions of service calls per
              year. Someone needs to build the infrastructure that tracks, bills, and settles
              every one of those calls fairly. That someone is SettleGrid.
            </p>
          </section>

          {/* ---- Vision ---- */}
          <section className="mb-20">
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 md:p-12">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-4">
                The Vision
              </h2>
              <p className="text-2xl md:text-3xl font-bold text-gray-100 leading-snug">
                The settlement layer for the AI economy.
              </p>
              <p className="text-gray-400 mt-4 leading-relaxed max-w-2xl">
                Every financial transaction between AI agents, tools, and services flows through
                a settlement layer. Just as Visa and Mastercard built the settlement layer for
                consumer payments, SettleGrid is building it for the AI economy. Protocol-agnostic.
                Real-time. Developer-first.
              </p>
            </div>
          </section>

          {/* ---- Story ---- */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">Why SettleGrid Exists</h2>
            <div className="space-y-4 text-gray-400 leading-relaxed">
              <p>
                The AI economy is generating trillions of service calls per year &mdash; LLM inferences,
                tool invocations, agent-to-agent workflows, media generation, browser automation. But the
                billing infrastructure hasn&apos;t kept up. Developers building AI services face a choice:
                spend weeks building metering, billing, and payout systems from scratch, or give up 15-30%
                to a marketplace that hosts your code and owns your customer relationship.
              </p>
              <p>
                Neither option is acceptable. The settlement layer for AI services should be invisible
                infrastructure &mdash; like Stripe is for payments or Cloudflare is for CDN. It should
                take two lines of code, support every payment protocol, and let developers keep the
                vast majority of their revenue.
              </p>
              <p>
                That&apos;s what SettleGrid is: a universal settlement layer that wraps any AI service
                with per-call billing, real-time metering, budget enforcement, and automated Stripe
                payouts &mdash; across 15 payment protocols. With a progressive take rate that starts
                at 0% because the platform should earn its share by delivering value, not by extracting
                it upfront.
              </p>
              <p>
                SettleGrid is built by developers, for developers. We use our own platform. We publish
                our pricing logic in the source code. We compete on product quality and developer
                experience, not on sales teams or vendor lock-in.
              </p>
            </div>
          </section>

          {/* ---- Values ---- */}
          <section className="mb-20">
            <h2 className="text-2xl font-bold text-gray-100 mb-8">Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((v) => (
                <div key={v.title} className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-amber-400 mb-2">{v.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{v.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ---- Stats ---- */}
          <section className="mb-20">
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-8 text-center">
                By the Numbers
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-3xl font-bold text-amber-400">{s.value}</div>
                    <div className="text-sm text-gray-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Join us
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Whether you are building your first AI tool or scaling an agent platform,
              SettleGrid is the infrastructure layer underneath. Start free, scale when ready.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg hover:bg-brand-dark transition-colors"
              >
                Start Building
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
