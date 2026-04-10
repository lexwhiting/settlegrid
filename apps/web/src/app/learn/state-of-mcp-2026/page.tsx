import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'State of MCP Monetization 2026 — Data Report | SettleGrid',
  description:
    'Data-driven report on the MCP monetization landscape in 2026. 12,770+ servers, 97M+ SDK downloads, less than 5% monetized. Protocol landscape, revenue benchmarks, and the $385B opportunity.',
  alternates: { canonical: 'https://settlegrid.ai/learn/state-of-mcp-2026' },
  keywords: [
    'MCP monetization 2026',
    'state of MCP',
    'MCP ecosystem report',
    'MCP server statistics',
    'AI tool monetization data',
    'agent payment volume',
    'MCP revenue benchmarks',
    'agentic commerce',
  ],
  openGraph: {
    title: 'State of MCP Monetization 2026 — Data Report',
    description:
      '12,770+ servers. 97M+ SDK downloads. Less than 5% monetized. The definitive data report on MCP monetization in 2026.',
    type: 'article',
    url: 'https://settlegrid.ai/learn/state-of-mcp-2026',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'State of MCP Monetization 2026 — Data Report',
    description:
      '12,770+ servers. 97M+ SDK downloads. Less than 5% monetized. The definitive data report on MCP monetization in 2026.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD Article Schema                                                     */
/* -------------------------------------------------------------------------- */

const jsonLdArticle = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'State of MCP Monetization 2026',
  description:
    'Data-driven report on the MCP monetization landscape in 2026. Ecosystem size, payment volume, protocol landscape, revenue benchmarks, and the opportunity ahead.',
  author: {
    '@type': 'Organization',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
  },
  publisher: {
    '@type': 'Organization',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
    logo: {
      '@type': 'ImageObject',
      url: 'https://settlegrid.ai/brand/icon-color.svg',
    },
  },
  datePublished: '2026-03-26',
  dateModified: '2026-03-26',
  url: 'https://settlegrid.ai/learn/state-of-mcp-2026',
  mainEntityOfPage: 'https://settlegrid.ai/learn/state-of-mcp-2026',
  keywords: [
    'MCP monetization',
    'MCP ecosystem',
    'agent payments',
    'AI tool billing',
    'agentic commerce',
  ],
  articleSection: 'Research Reports',
  wordCount: 4200,
}

/* -------------------------------------------------------------------------- */
/*  Reusable components                                                        */
/* -------------------------------------------------------------------------- */

function StatCard({ value, label, sublabel }: { value: string; label: string; sublabel?: string }) {
  return (
    <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 text-center">
      <p className="text-3xl sm:text-4xl font-bold text-amber-400 mb-1">{value}</p>
      <p className="text-sm font-semibold text-gray-200">{label}</p>
      {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
    </div>
  )
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl sm:text-3xl font-bold text-gray-100 mb-4 mt-16 scroll-mt-24">
      {children}
    </h2>
  )
}

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="text-gray-400 hover:text-amber-400 transition-colors text-sm">
        {children}
      </a>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function StateOfMcp2026Page() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main content ---- */}
      <main className="flex-1 px-6 py-16">
        <article className="max-w-3xl mx-auto">
          <nav className="mb-8 text-sm text-gray-400" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-amber-400 transition-colors">&larr; Back to Learn</Link>
          </nav>

          {/* ================================================================ */}
          {/*  Hero                                                            */}
          {/* ================================================================ */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              Data Report &middot; March 2026
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4 leading-tight">
              State of MCP{' '}
              <span className="text-amber-400">Monetization</span>{' '}
              2026
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              The definitive data report on the MCP monetization landscape.
              12,770+ servers. 97M+ SDK downloads. Less than 5% monetized.
              Where the money is, where it is not, and what is about to change.
            </p>
          </div>

          {/* ================================================================ */}
          {/*  Key Stats                                                       */}
          {/* ================================================================ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            <StatCard value="12,770+" label="MCP Servers" sublabel="PulseMCP registry" />
            <StatCard value="97M+" label="SDK Downloads" sublabel="npm total" />
            <StatCard value="<5%" label="Monetized" sublabel="of all MCP servers" />
            <StatCard value="<$50K/day" label="Global Volume" sublabel="agent-to-tool payments" />
          </div>

          {/* ================================================================ */}
          {/*  Table of Contents                                               */}
          {/* ================================================================ */}
          <nav className="mb-16 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6" aria-label="Table of contents">
            <p className="text-xs font-semibold text-amber-400 tracking-wide uppercase mb-4">Contents</p>
            <ol className="space-y-2.5 list-decimal list-inside">
              <TocLink href="#ecosystem-size">The MCP Ecosystem by the Numbers</TocLink>
              <TocLink href="#monetization-state">The Monetization State: Less Than 5%</TocLink>
              <TocLink href="#protocol-landscape">The Protocol Landscape</TocLink>
              <TocLink href="#revenue-benchmarks">Revenue Benchmarks</TocLink>
              <TocLink href="#opportunity">The Opportunity</TocLink>
              <TocLink href="#whats-changing">What Is Changing in 2026</TocLink>
              <TocLink href="#key-takeaways">Key Takeaways</TocLink>
            </ol>
          </nav>

          {/* ================================================================ */}
          {/*  Section 1: Ecosystem Size                                       */}
          {/* ================================================================ */}
          <SectionHeading id="ecosystem-size">The MCP Ecosystem by the Numbers</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            The Model Context Protocol has achieved remarkable adoption in under 18 months.
            The numbers tell a clear story: developers are building MCP tools at scale, and the ecosystem
            is growing faster than any previous tool-calling standard.
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border border-[#2A2D3E] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#161822] text-left">
                  <th className="py-3 px-4 font-semibold text-gray-200">Registry</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">MCP Servers Listed</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D3E]/50">
                <tr><td className="py-3 px-4 text-gray-300">PulseMCP</td><td className="py-3 px-4 text-amber-400 font-semibold">12,770+</td><td className="py-3 px-4 text-gray-400">Largest public registry</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">mcp.so</td><td className="py-3 px-4 text-amber-400 font-semibold">17,194+</td><td className="py-3 px-4 text-gray-400">Includes duplicates across registries</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Smithery</td><td className="py-3 px-4 text-amber-400 font-semibold">6,000+</td><td className="py-3 px-4 text-gray-400">Curated directory</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">npm SDK downloads</td><td className="py-3 px-4 text-amber-400 font-semibold">97M+</td><td className="py-3 px-4 text-gray-400">Total @modelcontextprotocol downloads</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-gray-300 leading-relaxed mb-6">
            Accounting for overlap across registries, the unique number of MCP servers is estimated at
            15,000 to 20,000. These servers span every category of developer tooling: data enrichment,
            web search, NLP, code analysis, financial data, security, geolocation, and more. The
            ecosystem is diverse, active, and growing.
          </p>

          {/* ================================================================ */}
          {/*  Section 2: Monetization State                                    */}
          {/* ================================================================ */}
          <SectionHeading id="monetization-state">The Monetization State: Less Than 5%</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            Despite the explosive growth in MCP server count, monetization has barely begun.
            Less than 5% of MCP servers earn a single dollar. The total agent-to-tool payment volume
            globally is under $50,000 per day across all protocols and platforms combined.
          </p>

          <div className="my-6 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-lg px-5 py-4 text-sm text-gray-300 leading-relaxed">
            <strong className="text-amber-400">The core problem:</strong> Developers are building
            valuable tools and giving them away. Not because they do not want revenue, but because
            adding billing infrastructure is too much work for uncertain payoff.
          </div>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border border-[#2A2D3E] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#161822] text-left">
                  <th className="py-3 px-4 font-semibold text-gray-200">Platform</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Daily Volume</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D3E]/50">
                <tr><td className="py-3 px-4 text-gray-300">x402 (Coinbase)</td><td className="py-3 px-4 text-amber-400 font-semibold">~$28K/day</td><td className="py-3 px-4 text-gray-400">Half is gamified/artificial (CoinDesk investigation)</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Stripe MPP</td><td className="py-3 px-4 text-amber-400 font-semibold">Unknown</td><td className="py-3 px-4 text-gray-400">Launched March 18 -- 8 days old, no public data</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">OpenAI ACP</td><td className="py-3 px-4 text-amber-400 font-semibold">Negligible</td><td className="py-3 px-4 text-gray-400">Only 12 Shopify merchants activated</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Apify Store</td><td className="py-3 px-4 text-amber-400 font-semibold">~$2K/mo top</td><td className="py-3 px-4 text-gray-400">Strongest real signal of MCP tool monetization</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">MCPize</td><td className="py-3 px-4 text-amber-400 font-semibold">Unknown</td><td className="py-3 px-4 text-gray-400">No public data</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Nevermined</td><td className="py-3 px-4 text-amber-400 font-semibold">Unknown</td><td className="py-3 px-4 text-gray-400">No public data</td></tr>
              </tbody>
            </table>
          </div>

          {/* ================================================================ */}
          {/*  Section 3: Protocol Landscape                                    */}
          {/* ================================================================ */}
          <SectionHeading id="protocol-landscape">The Protocol Landscape</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            The agent payment protocol landscape exploded in March 2026. Three major payment
            infrastructure players launched agent payment products in a single month, joining
            several existing protocols. The result is a fragmented landscape of 10+ competing
            standards, each backed by different incentives and ecosystems.
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border border-[#2A2D3E] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#161822] text-left">
                  <th className="py-3 px-4 font-semibold text-gray-200">Protocol</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Backed By</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Status (Mar 2026)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D3E]/50">
                <tr><td className="py-3 px-4 text-gray-300">x402</td><td className="py-3 px-4 text-gray-300">Coinbase</td><td className="py-3 px-4 text-gray-400">$28K/day, half gamified</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Stripe MPP</td><td className="py-3 px-4 text-gray-300">Stripe</td><td className="py-3 px-4 text-gray-400">Launched March 18, 100+ services</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">OpenAI ACP</td><td className="py-3 px-4 text-gray-300">OpenAI</td><td className="py-3 px-4 text-gray-400">12 merchants, scaled back</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Visa TAP</td><td className="py-3 px-4 text-gray-300">Visa</td><td className="py-3 px-4 text-gray-400">Pilot phase, enterprise focus</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Mastercard Agent Pay</td><td className="py-3 px-4 text-gray-300">Mastercard</td><td className="py-3 px-4 text-gray-400">First live EU agent payment, March 2026</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">A2A</td><td className="py-3 px-4 text-gray-300">Google</td><td className="py-3 px-4 text-gray-400">Multi-agent orchestration focus</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Circle Nanopayments</td><td className="py-3 px-4 text-gray-300">Circle</td><td className="py-3 px-4 text-gray-400">USDC stablecoin, sub-cent micropayments</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-gray-300 leading-relaxed mb-6">
            The fragmentation creates a real challenge for tool developers: which protocols should
            you support? Every protocol you add reaches more agents, but implementing multiple
            payment integrations is expensive and time-consuming. This is precisely the problem
            SettleGrid solves with a single SDK that supports multiple agent payment protocols.
          </p>

          {/* ================================================================ */}
          {/*  Section 4: Revenue Benchmarks                                    */}
          {/* ================================================================ */}
          <SectionHeading id="revenue-benchmarks">Revenue Benchmarks</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            Real revenue data for MCP tool developers is scarce, but a few data points
            paint a picture of what is possible today and what the trajectory looks like.
          </p>

          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border border-[#2A2D3E] rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#161822] text-left">
                  <th className="py-3 px-4 font-semibold text-gray-200">Benchmark</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Revenue</th>
                  <th className="py-3 px-4 font-semibold text-gray-200">Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2D3E]/50">
                <tr><td className="py-3 px-4 text-gray-300">Apify top developers</td><td className="py-3 px-4 text-amber-400 font-semibold">~$2K/month</td><td className="py-3 px-4 text-gray-400">Strongest real signal of MCP tool earnings</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">RapidAPI trajectory</td><td className="py-3 px-4 text-amber-400 font-semibold">5 years to $6M</td><td className="py-3 px-4 text-gray-400">Took 5 years to reach meaningful scale</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">Apify $1M challenge</td><td className="py-3 px-4 text-amber-400 font-semibold">704 developers</td><td className="py-3 px-4 text-gray-400">Attracted developers who understand monetization</td></tr>
                <tr><td className="py-3 px-4 text-gray-300">MCP marketplace volume</td><td className="py-3 px-4 text-amber-400 font-semibold">~$0</td><td className="py-3 px-4 text-gray-400">No MCP marketplace has demonstrated meaningful paid usage</td></tr>
              </tbody>
            </table>
          </div>

          <div className="my-6 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-lg px-5 py-4 text-sm text-gray-300 leading-relaxed">
            <strong className="text-amber-400">Key insight:</strong> The revenue benchmark for
            MCP tools today is effectively zero. But the infrastructure for payments is being built
            right now by the largest payment companies in the world. The question is not <em>if</em> agent
            commerce will happen, but <em>when</em> and <em>who will capture it</em>.
          </div>

          {/* ================================================================ */}
          {/*  Section 5: The Opportunity                                       */}
          {/* ================================================================ */}
          <SectionHeading id="opportunity">The Opportunity</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            The numbers reveal an enormous gap between supply (15,000+ MCP servers) and
            monetization (less than 5% earning anything). This gap is the opportunity.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <p className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-2">Developer Pool</p>
              <p className="text-2xl font-bold text-gray-100 mb-2">5,000 - 10,000</p>
              <p className="text-sm text-gray-400">
                Unique MCP developers who have built tools but have no revenue path. They have invested
                time building something valuable and are giving it away for free.
              </p>
            </div>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <p className="text-sm font-semibold text-amber-400 uppercase tracking-wide mb-2">Unmonetized Rate</p>
              <p className="text-2xl font-bold text-gray-100 mb-2">95%+</p>
              <p className="text-sm text-gray-400">
                Of the entire MCP ecosystem is working for free. Not because they choose to, but
                because the billing infrastructure did not exist until now.
              </p>
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed mb-6">
            For context, the npm ecosystem went through a similar phase. Open source packages were
            free by default, and the sustainability crisis that followed led to burnout, abandoned
            projects, and security vulnerabilities in critical infrastructure. The MCP ecosystem is
            at the same inflection point, with one critical difference: the payment infrastructure
            is being built <em>before</em> the crisis, not after.
          </p>

          {/* ================================================================ */}
          {/*  Section 6: What Is Changing                                      */}
          {/* ================================================================ */}
          <SectionHeading id="whats-changing">What Is Changing in 2026</SectionHeading>

          <p className="text-gray-300 leading-relaxed mb-6">
            Five catalysts are converging to transform MCP monetization from theoretical to practical:
          </p>

          <div className="space-y-6 mb-8">
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold">1</span>
                <h3 className="font-bold text-gray-100">Stripe MPP Launch (March 18)</h3>
              </div>
              <p className="text-sm text-gray-400 pl-11">
                Stripe launched the Merchant Payment Protocol with 100+ services and Visa support.
                Stripe processes payments for millions of businesses. When Stripe builds agent
                payment infrastructure, the market follows.
              </p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold">2</span>
                <h3 className="font-bold text-gray-100">Visa TAP + Mastercard Agent Suite</h3>
              </div>
              <p className="text-sm text-gray-400 pl-11">
                Both card networks are building agent payment infrastructure. Mastercard completed the
                first live agent payment in Europe in March 2026. When Visa and Mastercard move,
                enterprise adoption follows.
              </p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold">3</span>
                <h3 className="font-bold text-gray-100">Claude Marketplace (March 6)</h3>
              </div>
              <p className="text-sm text-gray-400 pl-11">
                Anthropic launched the Claude Marketplace with enterprise-only access and zero
                commission. Six partners at launch. This normalizes the concept of buying tools
                through your AI vendor.
              </p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold">4</span>
                <h3 className="font-bold text-gray-100">MCP Dev Summit (April 2-3, NYC)</h3>
              </div>
              <p className="text-sm text-gray-400 pl-11">
                95 sessions, every MCP stakeholder in one room. The first major in-person gathering
                of the MCP developer community will catalyze partnerships, integrations, and
                ecosystem development.
              </p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold">5</span>
                <h3 className="font-bold text-gray-100">Morgan Stanley: $385B by 2030</h3>
              </div>
              <p className="text-sm text-gray-400 pl-11">
                Morgan Stanley projects agentic commerce at $385 billion by 2030. McKinsey reports
                84% of enterprises are comfortable with autonomous agent decisions. The institutional
                money is positioning for this market.
              </p>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Section 7: Key Takeaways                                         */}
          {/* ================================================================ */}
          <SectionHeading id="key-takeaways">Key Takeaways</SectionHeading>

          <div className="space-y-4 mb-12">
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold shrink-0">1.</span>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-gray-100">The ecosystem is massive but unmonetized.</strong>{' '}
                12,770+ MCP servers, 97M+ SDK downloads, but less than 5% earn any revenue. The supply side
                is built. The monetization layer is not.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold shrink-0">2.</span>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-gray-100">Global agent payment volume is under $50K/day.</strong>{' '}
                The agent-pays-for-tools behavior barely exists. Most volume is concentrated in x402
                (half artificial) and Stripe MPP (too new for data).
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold shrink-0">3.</span>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-gray-100">The infrastructure is being built right now.</strong>{' '}
                Stripe, Visa, Mastercard, Coinbase, and Anthropic all launched agent payment products in
                March 2026. The rails are going in.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold shrink-0">4.</span>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-gray-100">5,000-10,000 developers need a revenue path.</strong>{' '}
                These developers have already built tools. They need billing infrastructure that takes
                minutes, not weeks, to integrate.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400 font-bold shrink-0">5.</span>
              <p className="text-gray-300 leading-relaxed">
                <strong className="text-gray-100">The window is open.</strong>{' '}
                Agentic commerce is projected at $385B by 2030. Developers who start monetizing now will
                have established revenue, reputation, and consumer relationships by the time the
                market scales.
              </p>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  CTA                                                              */}
          {/* ================================================================ */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Start Monetizing Your MCP Tools
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Two lines of code. 15 payment protocols. Up to 100% revenue share.
              Join the 5% of MCP developers who are earning from their tools.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Read the Docs
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center bg-[#161822] text-amber-400 border border-amber-500/30 px-6 py-3 rounded-lg font-semibold hover:border-amber-500/60 transition-colors"
              >
                Sign Up Free
              </Link>
            </div>
          </div>

          {/* Related content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/learn/mcp-zero-problem"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">Related</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm">
                The MCP Ecosystem&apos;s $0 Problem
              </p>
            </Link>
            <Link
              href="/learn/blog/how-to-monetize-mcp-server"
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">Guide</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm">
                How to Monetize an MCP Server in 2026
              </p>
            </Link>
          </div>
        </article>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            <SettleGridLogo variant="compact" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-gray-300 transition-colors">Docs</Link>
            <Link href="/learn" className="hover:text-gray-300 transition-colors">Learn</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
