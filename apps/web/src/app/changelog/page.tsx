import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Changelog | SettleGrid — What We Shipped',
  description:
    'The SettleGrid public changelog. Every feature, improvement, and fix we ship. Universal AI service settlement, smart proxy, cost-based routing, progressive pricing, and more.',
  alternates: { canonical: 'https://settlegrid.ai/changelog' },
  keywords: [
    'SettleGrid changelog',
    'SettleGrid updates',
    'SettleGrid releases',
    'AI billing platform updates',
    'SettleGrid new features',
  ],
  openGraph: {
    title: 'Changelog | SettleGrid',
    description: 'Every feature, improvement, and fix we ship.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Changelog | SettleGrid',
    description: 'Every feature, improvement, and fix we ship.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'Changelog', item: 'https://settlegrid.ai/changelog' },
  ],
}

const jsonLdWebPage = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'SettleGrid Changelog',
  description: 'Public changelog for SettleGrid. Features, improvements, and fixes.',
  url: 'https://settlegrid.ai/changelog',
  publisher: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

type Badge = 'Feature' | 'Improvement' | 'Fix'

interface ChangelogEntry {
  date: string
  title: string
  description: string
  badge: Badge
}

const badgeColors: Record<Badge, string> = {
  Feature: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Improvement: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  Fix: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const entries: ChangelogEntry[] = [
  {
    date: '2026-03-26',
    title: 'Pricing Page & Revenue Calculator',
    description:
      'Dedicated pricing page with full plan breakdown, progressive take rate visualization, revenue comparison tables, and pricing FAQ. See exactly what you keep at every revenue level.',
    badge: 'Feature',
  },
  {
    date: '2026-03-26',
    title: 'Use Cases, Glossary & About Pages',
    description:
      '6 use case stories for different builder personas, an 18-term glossary of AI settlement concepts, and a founder story page. New entry points for organic discovery.',
    badge: 'Feature',
  },
  {
    date: '2026-03-26',
    title: 'Competitor Comparison Expansion',
    description:
      'Added comparisons against Stripe Metronome ($1B acquisition), Orb ($44M funding), and Lago (open-source). Now 10 comparison pages covering every major billing alternative.',
    badge: 'Feature',
  },
  {
    date: '2026-03-25',
    title: 'Universal AI Service Settlement',
    description:
      'Expanded from MCP-only to universal settlement. SettleGrid now bills any AI service: LLM inference, browser automation, media generation, code execution, data APIs, agent-to-agent workflows, and communication services. One SDK, 15 protocols.',
    badge: 'Feature',
  },
  {
    date: '2026-03-24',
    title: 'Smart Proxy',
    description:
      'Zero-code billing via reverse proxy. Point your API URL at the Smart Proxy, configure pricing, and SettleGrid handles authentication, balance checks, and metering transparently. No SDK required.',
    badge: 'Feature',
  },
  {
    date: '2026-03-23',
    title: 'Cost-Based Routing',
    description:
      'Find the cheapest tool meeting quality thresholds. The routing engine compares price, latency, and reliability across registered providers and routes calls to the optimal endpoint.',
    badge: 'Feature',
  },
  {
    date: '2026-03-22',
    title: 'Transaction Explorer',
    description:
      'Real-time observability dashboard with anomaly detection. View every settlement, filter by tool, consumer, protocol, and time range. Anomaly detection flags unusual spending patterns automatically.',
    badge: 'Feature',
  },
  {
    date: '2026-03-21',
    title: 'Progressive Pricing',
    description:
      '0% take rate on first $1,000/month. Replaced the flat 3% take rate with progressive brackets: 0% on $0-$1K, 2% on $1K-$10K, 2.5% on $10K-$50K, 5% above $50K. Developers keep significantly more revenue.',
    badge: 'Improvement',
  },
  {
    date: '2026-03-20',
    title: 'Paste. Price. Publish.',
    description:
      '60-second onboarding flow. Paste your tool endpoint, set a price, and publish. SettleGrid handles everything else: metering, billing, payouts, discovery, fraud detection.',
    badge: 'Improvement',
  },
  {
    date: '2026-03-19',
    title: 'Gamification & Achievement Badges',
    description:
      '12 achievement badges for developer milestones: First Tool, First Revenue, 1K Calls, 10K Calls, 5-Star Rating, Multi-Protocol, and more. Visible on developer profiles and the showcase.',
    badge: 'Feature',
  },
  {
    date: '2026-03-18',
    title: 'Amber-Gold Brand Identity',
    description:
      'New visual identity with amber-gold accent color, dark theme, and refined typography. Consistent brand across all marketing pages, dashboard, and documentation.',
    badge: 'Improvement',
  },
  {
    date: '2026-03-17',
    title: '10-Protocol Support',
    description:
      'Added support for Visa TAP, UCP, ACP, Mastercard Agent Pay, and Circle Nanopayments. SettleGrid now supports 10 payment protocols through a single SDK: MCP, x402, MPP, AP2, A2A, Visa TAP, UCP, ACP, Mastercard Agent Pay, and Circle.',
    badge: 'Feature',
  },
  {
    date: '2026-03-16',
    title: 'Multi-Hop Settlement',
    description:
      'Automatic payment distribution across agent chains. When Agent A calls Agent B calls Agent C, each agent in the chain gets their share. Supports up to 10 hops per session.',
    badge: 'Feature',
  },
  {
    date: '2026-03-15',
    title: 'Agent Identity (KYA)',
    description:
      'Know Your Agent verification framework. Establishes identity, capabilities, and trust level before allowing financial transactions. Enables per-agent budgets and spending controls.',
    badge: 'Feature',
  },
  {
    date: '2026-03-14',
    title: 'Fraud Detection Hardening',
    description:
      '12-signal fraud detection with IP reputation, velocity checks, geographic anomaly detection, device fingerprinting, and behavioral analysis. Automatic blocking with manual appeal.',
    badge: 'Improvement',
  },
]

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ChangelogPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebPage) }} />
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
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4">
            Changelog
          </h1>
          <p className="text-lg text-gray-400 mb-12">
            Everything we ship. Features, improvements, and fixes.
          </p>

          {/* ---- Timeline ---- */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-[#2A2D3E]" aria-hidden="true" />

            <div className="space-y-8">
              {entries.map((entry) => (
                <div key={`${entry.date}-${entry.title}`} className="relative pl-12">
                  {/* Dot */}
                  <div className="absolute left-[11px] top-6 w-[10px] h-[10px] rounded-full bg-amber-400 ring-4 ring-[#0C0E14]" aria-hidden="true" />

                  <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <time className="text-xs text-gray-500 font-mono" dateTime={entry.date}>
                        {entry.date}
                      </time>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeColors[entry.badge]}`}
                      >
                        {entry.badge}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-gray-100 mb-2">{entry.title}</h2>
                    <p className="text-gray-400 leading-relaxed text-sm">{entry.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
