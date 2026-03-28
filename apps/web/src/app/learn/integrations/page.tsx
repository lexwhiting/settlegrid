import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { INTEGRATION_GUIDES } from '@/lib/integration-guides'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Framework Integrations — Use SettleGrid Tools in AI Agent Frameworks | SettleGrid',
  description:
    'Use paid SettleGrid tools in popular AI agent frameworks. Integration guides for smolagents, LangChain, and CrewAI with step-by-step tutorials and code examples.',
  alternates: { canonical: 'https://settlegrid.ai/learn/integrations' },
  keywords: [
    'SettleGrid integrations',
    'AI agent framework tools',
    'smolagents MCP tools',
    'LangChain SettleGrid',
    'CrewAI MCP tools',
    'MCP tool integration',
    'AI agent paid tools',
    'framework integration guide',
  ],
  openGraph: {
    title: 'Framework Integrations | SettleGrid',
    description: 'Use paid SettleGrid tools in smolagents, LangChain, and CrewAI. Step-by-step integration guides.',
    type: 'website',
    url: 'https://settlegrid.ai/learn/integrations',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Framework Integrations | SettleGrid',
    description: 'Use paid SettleGrid tools in smolagents, LangChain, and CrewAI. Step-by-step integration guides.',
  },
}

/* -------------------------------------------------------------------------- */
/*  Language badge helper                                                      */
/* -------------------------------------------------------------------------- */

function languageBadge(lang: 'typescript' | 'python' | 'both') {
  if (lang === 'both') return 'TypeScript + Python'
  if (lang === 'python') return 'Python'
  return 'TypeScript'
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default function IntegrationsHubPage() {
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
      { '@type': 'ListItem', position: 2, name: 'Framework Integrations', item: 'https://settlegrid.ai/learn/integrations' },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Framework Integrations for SettleGrid',
    description:
      'Integration guides for using paid SettleGrid tools in popular AI agent frameworks including smolagents, LangChain, and CrewAI.',
    url: 'https://settlegrid.ai/learn/integrations',
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: INTEGRATION_GUIDES.map((guide, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: guide.title,
        url: `https://settlegrid.ai/learn/integrations/${guide.slug}`,
      })),
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">Framework Integrations</span>
          </nav>

          {/* Hero */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Framework Integrations
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Use paid SettleGrid tools natively in popular AI agent frameworks.
              Discover tools, call them from your agents, and let SettleGrid handle billing.
            </p>
          </div>

          {/* Guide grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {INTEGRATION_GUIDES.map((guide) => (
              <Link
                key={guide.slug}
                href={`/learn/integrations/${guide.slug}`}
                className="group bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d={guide.icon} />
                    </svg>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                      {guide.steps.length} steps
                    </span>
                    <span className="text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5">
                      {languageBadge(guide.language)}
                    </span>
                  </div>
                </div>
                <h2 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                  {guide.framework}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
                  {guide.description}
                </p>
                <p className="text-xs text-amber-400 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  View guide &rarr;
                </p>
              </Link>
            ))}
          </div>

          {/* How it works */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-8 mb-16">
            <h2 className="text-xl font-bold text-gray-100 mb-6">How Framework Integrations Work</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm mb-3">1</div>
                <h3 className="font-semibold text-gray-100 mb-2">Discover</h3>
                <p className="text-sm text-gray-400">
                  Your framework connects to SettleGrid&apos;s Discovery API or MCP server
                  and discovers available tools by category or keyword.
                </p>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm mb-3">2</div>
                <h3 className="font-semibold text-gray-100 mb-2">Call</h3>
                <p className="text-sm text-gray-400">
                  When your agent calls a tool, the request routes through SettleGrid&apos;s
                  proxy. Authentication, balance checks, and upstream forwarding happen automatically.
                </p>
              </div>
              <div>
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold text-sm mb-3">3</div>
                <h3 className="font-semibold text-gray-100 mb-2">Settle</h3>
                <p className="text-sm text-gray-400">
                  SettleGrid meters usage, deducts from your balance, and pays the
                  tool developer. You see every call and cost in your dashboard.
                </p>
              </div>
            </div>
          </div>

          {/* Cross-links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <Link
              href="/learn/how-to"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                How-To Guides
              </h3>
              <p className="text-sm text-gray-400">
                Step-by-step tutorials for building, deploying, pricing, and scaling your AI tools.
              </p>
            </Link>
            <Link
              href="/learn/protocols"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                Protocol Guides
              </h3>
              <p className="text-sm text-gray-400">
                Deep dives into all 10 AI payment protocols SettleGrid supports.
              </p>
            </Link>
            <Link
              href="/docs"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
            >
              <h3 className="font-semibold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                API Documentation
              </h3>
              <p className="text-sm text-gray-400">
                Full SDK reference, API endpoints, authentication, and integration examples.
              </p>
            </Link>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Ready to integrate?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Sign up for SettleGrid, get your API key, and start using paid tools in your AI agents. Free tier includes 50,000 operations per month.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building — Free
            </Link>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/guides" className="hover:text-gray-100 transition-colors">Guides</Link>
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
