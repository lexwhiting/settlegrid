import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

export const metadata: Metadata = {
  title: 'Compare AI Billing Platforms | SettleGrid',
  description:
    'Compare SettleGrid with xpay.sh, Nevermined, Stripe MPP, and Zuplo. See feature-by-feature breakdowns of AI service billing platforms.',
  alternates: { canonical: 'https://settlegrid.ai/marketplace/compare' },
  keywords: [
    'AI billing comparison',
    'MCP server billing',
    'xpay alternative',
    'Nevermined alternative',
    'Stripe MPP alternative',
    'Zuplo alternative',
    'AI tool monetization',
    'API billing platform comparison',
  ],
  openGraph: {
    title: 'Compare AI Billing Platforms | SettleGrid',
    description:
      'Feature-by-feature comparisons of SettleGrid vs leading AI billing platforms.',
    type: 'website',
    url: 'https://settlegrid.ai/marketplace/compare',
  },
}

const COMPETITORS = [
  {
    slug: 'vs-xpay',
    name: 'xpay.sh',
    description: 'x402 crypto payment protocol for AI APIs',
    highlight: '15 protocols vs 1',
  },
  {
    slug: 'vs-nevermined',
    name: 'Nevermined',
    description: 'Blockchain-based AI agent payment infrastructure',
    highlight: 'Minutes to revenue vs days',
  },
  {
    slug: 'vs-stripe-mpp',
    name: 'Stripe MPP',
    description: 'Metered Payment Protocol from Stripe',
    highlight: 'AI-specific vs general-purpose',
  },
  {
    slug: 'vs-zuplo',
    name: 'Zuplo',
    description: 'API gateway with monetization features',
    highlight: '10+ ecosystem crawlers vs manual',
  },
]

export default function ComparePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Compare AI Billing Platforms',
    description:
      'Feature-by-feature comparisons of SettleGrid vs leading AI billing platforms.',
    url: 'https://settlegrid.ai/marketplace/compare',
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
            <Link href="/marketplace" className="hidden sm:inline text-sm font-medium text-amber-400 transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
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
        <div className="max-w-4xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

          <nav className="mb-6 text-sm text-gray-500">
            <Link href="/marketplace" className="hover:text-gray-300 transition-colors">Marketplace</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-300">Compare</span>
          </nav>

          <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4 font-display">
            Compare AI Billing Platforms
          </h1>
          <p className="text-lg text-gray-400 mb-10 max-w-2xl">
            See how SettleGrid stacks up against the leading AI service billing
            platforms. Feature-by-feature comparisons to help you choose the right
            monetization infrastructure.
          </p>

          <div className="grid gap-4">
            {COMPETITORS.map((comp) => (
              <Link
                key={comp.slug}
                href={`/marketplace/compare/${comp.slug}`}
                className="group rounded-xl border border-[#2A2D3E] bg-[#161822] p-6 hover:border-amber-500/40 transition-all hover:shadow-[0_4px_16px_-2px_rgba(229,163,54,0.12)]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                      SettleGrid vs {comp.name}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1">{comp.description}</p>
                  </div>
                  <div className="hidden sm:flex flex-col items-end">
                    <span className="text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
                      {comp.highlight}
                    </span>
                    <span className="text-xs text-gray-500 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      View comparison &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Missing a comparison? We add new ones regularly.
            </p>
            <Link
              href="/marketplace"
              className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
            >
              Back to Marketplace
            </Link>
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
