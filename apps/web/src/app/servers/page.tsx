import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { ServerSearch } from '@/components/server-search'
import type { CatalogEntry } from '@/components/server-search'
import catalogData from '../../../public/server-catalog.json'

/* ── Metadata ──────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: '1,017 Open-Source MCP Templates | SettleGrid',
  description:
    'Browse 1,017 open-source MCP server templates with SettleGrid billing pre-wired. Fork, customize, and start earning.',
  alternates: { canonical: 'https://settlegrid.ai/servers' },
  keywords: [
    'MCP servers',
    'open source MCP',
    'AI tool servers',
    'SettleGrid billing',
    'Model Context Protocol',
    'AI monetization',
  ],
  openGraph: {
    title: '1,017 Open-Source MCP Templates | SettleGrid',
    description:
      'Browse 1,017 open-source MCP server templates with SettleGrid billing pre-wired. Fork, customize, and start earning.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: '1,017 Open-Source MCP Templates | SettleGrid',
    description:
      'Browse 1,017 open-source MCP server templates with SettleGrid billing pre-wired. Fork, customize, and start earning.',
  },
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

const servers = catalogData as CatalogEntry[]

export default function ServersPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E] sticky top-0 z-50 backdrop-blur-lg">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/tools"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Showcase
            </Link>
            <Link
              href="/servers"
              className="hidden sm:inline text-sm font-medium text-emerald-400 transition-colors"
              aria-current="page"
            >
              Templates
            </Link>
            <Link
              href="/developers"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Developers
            </Link>
            <Link
              href="/docs"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/learn"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
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

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* ── Hero ───────────────────────────────────────────────── */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              1,017 Open-Source MCP Templates
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Fork any template, add your API key, deploy to Vercel.
              Settle<span className="text-emerald-400">Grid</span> billing is
              pre-wired &mdash; start earning on every call.
            </p>
          </div>

          {/* ── Search + Filter + Grid (client component) ──────────── */}
          <ServerSearch servers={servers} />

          {/* ── Bottom CTA ─────────────────────────────────────────── */}
          <div className="mt-16 rounded-xl border border-[#2E3148] bg-gradient-to-br from-[#1A1D2E] to-[#0F1117] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Want to monetize your own tool?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Register for a free account, wrap your functions with the SDK, and
              start earning on every call.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building -- Free
              </Link>
              <Link
                href="/learn/handbook"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2E3148] hover:border-gray-500 transition-colors"
              >
                Read the Monetization Handbook
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#2E3148] px-6 py-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/servers" className="hover:text-gray-100 transition-colors">
              Templates
            </Link>
            <Link href="/developers" className="hover:text-gray-100 transition-colors">
              Developers
            </Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/faq" className="hover:text-gray-100 transition-colors">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
