import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Use Cases | SettleGrid — How Developers Monetize AI Services',
  description:
    'See how indie developers, AI startups, enterprises, and open-source maintainers use SettleGrid to monetize their AI tools, APIs, and agent services with per-call billing and progressive pricing.',
  alternates: { canonical: 'https://settlegrid.ai/use-cases' },
  keywords: [
    'AI tool monetization use cases',
    'monetize AI API',
    'MCP server billing',
    'agent-to-agent payments',
    'AI service billing use cases',
    'open-source monetization',
    'API monetization examples',
    'usage-based billing AI',
  ],
  openGraph: {
    title: 'Use Cases | SettleGrid',
    description: 'How developers monetize AI services with SettleGrid.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Use Cases | SettleGrid',
    description: 'How developers monetize AI services with SettleGrid.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD                                                                    */
/* -------------------------------------------------------------------------- */

const jsonLdCollectionPage = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'SettleGrid Use Cases',
  description:
    'How developers, startups, enterprises, and open-source maintainers use SettleGrid to monetize AI services.',
  url: 'https://settlegrid.ai/use-cases',
  publisher: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
    { '@type': 'ListItem', position: 2, name: 'Use Cases', item: 'https://settlegrid.ai/use-cases' },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const useCases = [
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: 'Indie Developer',
    headline: 'Monetize your side project API',
    description:
      'You built a useful tool on the weekend. Now people want to use it. Wrap it with 2 lines of SettleGrid SDK and start earning per call. Progressive take rate means 0% on your first $1,000 per month. No infrastructure to manage. No Stripe Connect boilerplate. Just code and revenue.',
    example: 'A weather API, a code formatter, a PDF converter, a web scraper.',
    keyBenefit: 'Ship billing in 5 minutes, not 5 weeks',
    cta: 'Start earning →',
    href: '/start',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    title: 'AI Startup',
    headline: 'Usage-based billing for your AI product',
    description:
      'Your AI product charges per token, per inference, or per generation. SettleGrid gives you 6 pricing models out of the box: per-call, per-token, per-byte, per-second, tiered, and outcome-based. Sub-50ms metering means your users see real-time balance updates. Budget enforcement prevents runaway costs.',
    example: 'An LLM inference API, an image generation service, a code analysis tool.',
    keyBenefit: '6 pricing models, sub-50ms metering, budget enforcement',
    cta: 'See pricing models →',
    href: '/pricing',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
      </svg>
    ),
    title: 'Enterprise',
    headline: 'Agent budget control and cost allocation',
    description:
      'Your organization deploys dozens of AI agents. SettleGrid provides per-agent budgets, cost allocation, audit trails, and real-time spending controls. Know Your Agent (KYA) identity verification ensures only authorized agents can spend. Multi-hop settlement handles complex agent chains.',
    example: 'Internal AI tools, department-level budget caps, compliance reporting.',
    keyBenefit: 'Per-agent budgets, KYA identity, audit trails',
    cta: 'Explore solutions →',
    href: '/solutions/agent-to-agent',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: 'Open Source Maintainer',
    headline: 'Earn from your open-source tools',
    description:
      'You maintain a popular open-source library. With SettleGrid, you can offer a hosted version with per-call billing while keeping the source code free. The free tier means your users can try it without any cost barrier, and progressive take rates mean you keep most of the revenue.',
    example: 'A hosted version of a CLI tool, a managed API wrapper, a premium tier.',
    keyBenefit: 'Free tier for users, progressive rates for you',
    cta: 'See how it works →',
    href: '/docs',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    title: 'API Wrapper',
    headline: 'Turn any API into a paid service',
    description:
      'You combine multiple APIs into something more valuable than the parts. SettleGrid handles the billing so you can focus on the integration. Per-call, per-token, or tiered pricing. Smart Proxy mode means zero code changes for simple wrappers.',
    example: 'A unified search API, a data enrichment service, a multi-model LLM router.',
    keyBenefit: 'Smart Proxy for zero-code billing',
    cta: 'Try Smart Proxy →',
    href: '/start',
  },
  {
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: 'Multi-Agent Workflows',
    headline: 'Settlement for agent-to-agent workflows',
    description:
      'When Agent A calls Agent B which calls Agent C, who pays whom? SettleGrid handles multi-hop settlement automatically. Each agent in the chain gets their share. Multiple agent payment protocols including MCP, x402, AP2, L402, and KYAPay ensure agents can pay each other across platforms.',
    example: 'A research agent chain, an orchestrator calling specialist agents, a marketplace.',
    keyBenefit: 'Multi-hop settlement, multiple agent payment protocols, automatic revenue splits',
    cta: 'Learn about protocols →',
    href: '/learn/protocols',
  },
] as const

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function UseCasesPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdCollectionPage) }} />
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
              Built for every AI builder
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Whether you are a solo developer monetizing a side project or an enterprise
              managing agent budgets, SettleGrid adapts to your use case.
            </p>
          </div>

          {/* ---- Use Case Cards ---- */}
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-8 hover:border-amber-500/30 transition-colors"
              >
                <div className="text-amber-400 mb-4">{uc.icon}</div>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  {uc.title}
                </span>
                <h2 className="text-xl font-bold text-gray-100 mt-2 mb-3">{uc.headline}</h2>
                <p className="text-gray-400 leading-relaxed text-sm mb-4">{uc.description}</p>
                <div className="bg-[#0C0E14] rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Example</p>
                  <p className="text-sm text-gray-300">{uc.example}</p>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-amber-400 font-medium">{uc.keyBenefit}</span>
                </div>
                <Link
                  href={uc.href}
                  className="inline-flex items-center text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {uc.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Your use case. Your pricing. Your revenue.
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Start with the free tier. 50,000 operations per month, progressive take rate
              starting at 0%. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg hover:bg-brand-dark transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center border border-[#2A2D3E] text-gray-300 font-medium px-8 py-3 rounded-lg hover:border-gray-400 hover:text-gray-100 transition-colors"
              >
                See Pricing
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
