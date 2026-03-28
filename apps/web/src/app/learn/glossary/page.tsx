import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Glossary | SettleGrid — AI Service Settlement Terms Defined',
  description:
    'Definitions for AI service settlement, metering, progressive take rate, smart proxy, multi-hop settlement, agent identity (KYA), MCP, protocol-agnostic billing, and more.',
  alternates: { canonical: 'https://settlegrid.ai/learn/glossary' },
  keywords: [
    'AI settlement glossary',
    'what is MCP',
    'what is per-call billing',
    'AI metering definition',
    'progressive take rate explained',
    'smart proxy definition',
    'agent identity KYA',
    'multi-hop settlement',
    'protocol-agnostic billing',
    'tool discovery AI',
    'settlement pulse',
    'cost-based routing',
    'outcome-based billing',
    'budget controller AI',
    'agent firewall',
  ],
  openGraph: {
    title: 'Glossary | SettleGrid',
    description: 'Key terms in AI service settlement, billing, and agent payments.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glossary | SettleGrid',
    description: 'Key terms in AI service settlement, billing, and agent payments.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const glossaryTerms = [
  {
    name: 'AI Service Settlement',
    definition:
      'The process of tracking, billing, and distributing payment for individual AI service calls across providers, consumers, and intermediaries. Settlement transforms every API call, tool invocation, or agent action into a monetizable event with real-time metering and automatic payouts.',
    link: '/solutions',
  },
  {
    name: 'Metering',
    definition:
      'Real-time measurement of AI service usage at the individual call level. SettleGrid meters every invocation in under 50 milliseconds using atomic Redis operations, tracking call count, token usage, byte transfer, or execution time depending on the pricing model.',
    link: '/learn/how-to/how-to-create-mcp-tool',
  },
  {
    name: 'Per-Call Billing',
    definition:
      'A pricing model where consumers are charged for each individual service invocation rather than through subscriptions or prepaid credits. Per-call billing aligns costs with actual usage and is the most common model for AI tools and APIs.',
    link: '/learn/how-to/how-to-set-pricing',
  },
  {
    name: 'Progressive Take Rate',
    definition:
      'A revenue-sharing model where the platform fee increases gradually with revenue brackets rather than applying a flat percentage. SettleGrid charges 0% on the first $1,000/month, 2% on $1K-$10K, 2.5% on $10K-$50K, and 5% above $50K. This means developers always keep more than they would on a flat-rate platform.',
    link: '/pricing',
  },
  {
    name: 'Smart Proxy',
    definition:
      'A reverse proxy that adds billing, metering, and access control to any existing API endpoint without code changes. Developers point their API URL at the Smart Proxy, configure pricing, and SettleGrid handles authentication, balance checks, and usage tracking transparently.',
    link: '/start',
  },
  {
    name: 'Multi-Hop Settlement',
    definition:
      'Automatic payment distribution across a chain of AI agents or services where Agent A calls Agent B which calls Agent C. SettleGrid tracks the full call chain and distributes revenue to each participant based on their contribution, supporting up to 10 hops per session.',
    link: '/solutions/agent-to-agent',
  },
  {
    name: 'Agent Identity (KYA)',
    definition:
      'Know Your Agent (KYA) is a verification framework for AI agents that establishes identity, capabilities, and trust level before allowing financial transactions. KYA enables per-agent budgets, spending controls, and audit trails for agent-to-agent commerce.',
    link: '/solutions/agent-to-agent',
  },
  {
    name: 'Cost-Based Routing',
    definition:
      'An optimization strategy that automatically selects the cheapest AI service provider meeting quality thresholds for a given request. Cost-based routing compares price, latency, and reliability across registered providers and routes the call to the optimal endpoint.',
    link: '/explore',
  },
  {
    name: 'Fallback Chain',
    definition:
      'An ordered list of alternative AI service providers that are tried in sequence when the primary provider is unavailable or fails. SettleGrid automatically manages failover, retries, and billing across the fallback chain without consumer-side code changes.',
    link: '/explore',
  },
  {
    name: 'Settlement Pulse',
    definition:
      'A real-time heartbeat of settlement activity across the SettleGrid network. The settlement pulse tracks transaction volume, revenue flow, active tools, and network health, providing both operators and developers with live observability into the AI economy.',
    link: '/changelog',
  },
  {
    name: 'Tool Discovery',
    definition:
      'The process by which AI agents and consumers find, evaluate, and connect to available AI services. SettleGrid provides a Discovery API, a public showcase, and machine-readable service cards that enable programmatic discovery across categories, pricing models, and protocols.',
    link: '/learn/discovery',
  },
  {
    name: 'MCP (Model Context Protocol)',
    definition:
      'An open protocol originally created by Anthropic that standardizes how AI models interact with external tools and data sources. MCP defines a structured interface for tool discovery, invocation, and response handling. SettleGrid adds a billing and settlement layer on top of MCP.',
    link: '/learn/protocols/mcp',
  },
  {
    name: 'Protocol-Agnostic',
    definition:
      'An architecture that works across multiple payment and communication protocols without requiring protocol-specific code. SettleGrid is protocol-agnostic, supporting 15 protocols (MCP, x402, AP2, MPP, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle, REST) through a single unified SDK.',
    link: '/learn/protocols',
  },
  {
    name: 'Take Rate',
    definition:
      'The percentage of revenue that a platform retains from transactions processed through it. Traditional marketplaces charge 10-30% flat. SettleGrid uses a progressive take rate starting at 0% on the first $1,000/month of developer revenue.',
    link: '/pricing',
  },
  {
    name: 'Revenue Share',
    definition:
      'The split of revenue between the service provider (developer) and the platform. On SettleGrid, developers keep up to 100% of their revenue on the first $1,000/month and 95-98% above that, compared to 85% on marketplace-style competitors.',
    link: '/learn/compare/mcp-billing-platforms-2026',
  },
  {
    name: 'Outcome-Based Billing',
    definition:
      'A pricing model where the consumer pays based on the result or outcome of the AI service rather than the computation performed. For example, paying only when an AI successfully extracts the requested data or completes a task. SettleGrid supports outcome-based billing as one of six pricing models.',
    link: '/learn/how-to/how-to-set-pricing',
  },
  {
    name: 'Budget Controller',
    definition:
      'A real-time spending limit system that prevents AI agents or consumers from exceeding predetermined budgets. SettleGrid enforces budgets at the per-call level with atomic balance checks, ensuring agents cannot overspend even under concurrent request load.',
    link: '/use-cases',
  },
  {
    name: 'Agent Firewall',
    definition:
      'A security layer that validates, rate-limits, and filters AI agent requests before they reach the underlying service. The agent firewall combines KYA identity verification, budget enforcement, rate limiting, and anomaly detection to protect both providers and consumers.',
    link: '/solutions/agent-to-agent',
  },
] as const

const jsonLdDefinedTermSet = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'SettleGrid AI Settlement Glossary',
  description: 'Key terms and definitions for AI service settlement, billing, and agent payments.',
  url: 'https://settlegrid.ai/learn/glossary',
  hasDefinedTerm: glossaryTerms.map((term) => ({
    '@type': 'DefinedTerm',
    name: term.name,
    description: term.definition,
    url: `https://settlegrid.ai/learn/glossary#${term.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  })),
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'Learn', item: 'https://settlegrid.ai/learn' },
    { '@type': 'ListItem', position: 3, name: 'Glossary', item: 'https://settlegrid.ai/learn/glossary' },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function GlossaryPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdDefinedTermSet) }} />
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
          {/* Breadcrumb */}
          <nav className="text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li><Link href="/" className="hover:text-gray-100 transition-colors">Home</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-100">Glossary</li>
            </ol>
          </nav>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-4">
            Glossary
          </h1>
          <p className="text-lg text-gray-400 mb-12 max-w-3xl">
            Key terms and definitions for AI service settlement, metering, billing, and the
            agent payment ecosystem.
          </p>

          {/* ---- Term List ---- */}
          <div className="space-y-8 mb-20">
            {glossaryTerms.map((term) => {
              const anchor = term.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
              return (
                <div
                  key={term.name}
                  id={anchor}
                  className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 scroll-mt-24"
                >
                  <h2 className="text-lg font-semibold text-amber-400 mb-2">{term.name}</h2>
                  <p className="text-gray-400 leading-relaxed text-sm mb-3">{term.definition}</p>
                  <Link
                    href={term.link}
                    className="text-sm font-medium text-brand hover:text-brand-dark transition-colors"
                  >
                    Learn more &rarr;
                  </Link>
                </div>
              )
            })}
          </div>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Ready to build with SettleGrid?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Start with the free tier. 50,000 operations per month, progressive take rate
              starting at 0%.
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
