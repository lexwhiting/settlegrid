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
    slug: 'vs-diy',
    title: 'SettleGrid vs Building Your Own',
    description:
      'Why spend 2-4 weeks building metering, balance management, and Stripe Connect integration when you can ship in 2 lines of code?',
  },
  {
    slug: 'vs-nevermined',
    title: 'SettleGrid vs Nevermined',
    description:
      'Both platforms enable AI agent payments, but SettleGrid covers 10 protocols with sub-50ms metering while Nevermined focuses on on-chain settlement.',
  },
  {
    slug: 'vs-stripe',
    title: 'SettleGrid vs Stripe Billing',
    description:
      'Stripe is great for SaaS subscriptions. SettleGrid is purpose-built for per-call AI tool billing with native MCP support and real-time budget enforcement.',
  },
] as const

export default function CompareIndexPage() {
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
                className="group block bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-6 hover:border-brand/60 transition-colors"
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
      <footer className="border-t border-[#2E3148] px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Marketplace</Link>
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
