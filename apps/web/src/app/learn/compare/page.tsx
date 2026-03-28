import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'SettleGrid Comparisons — How We Stack Up | SettleGrid',
  description:
    'See how SettleGrid compares to building your own billing, Nevermined, Stripe Billing, and more. Feature-by-feature comparisons for AI tool monetization.',
  alternates: { canonical: 'https://settlegrid.ai/learn/compare' },
}

const comparisons = [
  {
    slug: 'mcp-billing-platforms-2026',
    title: 'MCP Billing Platforms Compared 2026',
    description:
      'The definitive comparison of every major MCP monetization platform: SettleGrid, Nevermined, MCPize, Paid.ai, Moesif, Masumi, and PaidMCP. Full feature matrix with revenue share, pricing models, protocols, and more.',
  },
  {
    slug: 'vs-diy',
    title: 'SettleGrid vs Building Your Own',
    description:
      'Why spend 2-4 weeks building metering, balance management, and Stripe Connect integration when you can ship in 2 lines of code?',
  },
  {
    slug: 'vs-nevermined',
    title: 'SettleGrid vs Nevermined',
    description:
      'Both platforms enable AI agent payments, but SettleGrid covers 15 protocols with sub-50ms metering while Nevermined focuses on on-chain settlement.',
  },
  {
    slug: 'vs-stripe',
    title: 'SettleGrid vs Stripe Billing',
    description:
      'Stripe is great for SaaS subscriptions. SettleGrid is purpose-built for per-call AI tool billing with native MCP support and real-time budget enforcement.',
  },
  {
    slug: 'vs-mcpize',
    title: 'SettleGrid vs MCPize',
    description:
      'MCPize is a hosted marketplace with 85% revenue share. SettleGrid is an SDK with up to 100% revenue share (progressive take rate) that works with any hosting provider and supports 15 protocols.',
  },
  {
    slug: 'vs-paid-ai',
    title: 'SettleGrid vs Paid.ai',
    description:
      'Paid.ai focuses on outcome-based billing. SettleGrid supports 6 pricing models including outcomes, plus 15 payment protocols and a free tier with 0% fees.',
  },
  {
    slug: 'vs-moesif',
    title: 'SettleGrid vs Moesif',
    description:
      'Moesif is an API analytics platform adding billing. SettleGrid is purpose-built for AI tool monetization with a 2-line MCP-native SDK and sub-50ms metering.',
  },
  {
    slug: 'vs-stripe-metronome',
    title: 'SettleGrid vs Stripe Metronome',
    description:
      'Stripe acquired Metronome for $1B to own enterprise usage-based billing. SettleGrid is purpose-built for AI services: 2-line SDK, 15 protocols, progressive pricing from 0%, and AI-native discovery.',
  },
  {
    slug: 'vs-orb',
    title: 'SettleGrid vs Orb',
    description:
      'Orb offers powerful SQL-based event metering for B2B SaaS. SettleGrid is built for AI tool monetization: 2-line SDK, 15 protocols, a discovery marketplace, and progressive take rates.',
  },
  {
    slug: 'vs-lago',
    title: 'SettleGrid vs Lago',
    description:
      'Lago is open-source usage-based billing you can self-host. SettleGrid is a managed platform with zero infrastructure, 10 AI protocols, discovery marketplace, and a 2-line SDK.',
  },
] as const

export default function CompareIndexPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
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
          <nav className="mb-8 text-sm text-gray-400" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-amber-400 transition-colors">&larr; Back to Learn</Link>
          </nav>
          <h1 className="text-4xl font-bold text-gray-100 mb-4">
            How SettleGrid Compares
          </h1>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl">
            Honest, feature-by-feature comparisons so you can decide whether
            SettleGrid is the right settlement layer for your AI tools.
          </p>

          <div className="grid gap-6">
            {comparisons.map((c) => (
              <Link
                key={c.slug}
                href={`/learn/compare/${c.slug}`}
                className="group block bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 hover:border-brand/60 transition-colors"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-2 group-hover:text-brand transition-colors">
                  {c.title}
                </h2>
                <p className="text-gray-400 leading-relaxed">{c.description}</p>
                <span className="inline-block mt-4 text-sm font-medium text-brand">
                  Read comparison &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-8">
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
