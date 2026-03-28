import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'The MCP Monetization Handbook — How to Monetize MCP Servers & AI Tools',
  description:
    'The definitive guide to monetizing MCP servers and AI tools. Pricing models, code examples, revenue benchmarks, and growth strategies. Free, open, and actionable.',
  alternates: { canonical: 'https://settlegrid.ai/learn/handbook' },
  keywords: [
    'how to monetize MCP server',
    'MCP monetization',
    'monetize AI tools',
    'MCP server billing',
    'AI tool pricing',
    'MCP payment',
    'AI agent revenue',
    'Model Context Protocol monetization',
    'MCP server pricing',
    'AI API billing',
    'per-call billing AI',
    'MCP server income',
  ],
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD Article Schema                                                     */
/* -------------------------------------------------------------------------- */

const jsonLdArticle = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'The MCP Monetization Handbook',
  description:
    'The definitive guide to monetizing MCP servers and AI tools. Covers pricing models, SDK integration, revenue benchmarks, growth strategies, and advanced topics like multi-hop settlement and fraud detection.',
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
  datePublished: '2026-03-24',
  dateModified: '2026-03-24',
  url: 'https://settlegrid.ai/learn/handbook',
  mainEntityOfPage: 'https://settlegrid.ai/learn/handbook',
  keywords: [
    'MCP monetization',
    'AI tool billing',
    'Model Context Protocol',
    'per-call billing',
    'AI agent payments',
  ],
  articleSection: 'Developer Guides',
  wordCount: 5000,
}

/* -------------------------------------------------------------------------- */
/*  Reusable components                                                        */
/* -------------------------------------------------------------------------- */

function ChapterHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <div id={id} className="scroll-mt-24 mb-6 mt-16 first:mt-0">
      <p className="text-sm font-semibold text-amber-400 tracking-wide uppercase mb-1">
        Chapter {number}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-100">{title}</h2>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 border-l-4 border-amber-500 bg-amber-500/5 rounded-r-lg px-5 py-4 text-sm text-gray-300 leading-relaxed">
      {children}
    </div>
  )
}

function PricingBenchmarkRow({
  category,
  range,
  examples,
}: {
  category: string
  range: string
  examples: string
}) {
  return (
    <tr className="border-b border-[#2A2D3E]/50 last:border-b-0">
      <td className="py-3 px-4 font-medium text-gray-200">{category}</td>
      <td className="py-3 px-4 text-amber-400 font-semibold">{range}</td>
      <td className="py-3 px-4 text-gray-400">{examples}</td>
    </tr>
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

export default function HandbookPage() {
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
              Free guide &middot; 7 chapters &middot; Code examples included
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4 leading-tight">
              The MCP Monetization{' '}
              <span className="text-amber-400">Handbook</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              Everything you need to turn your AI tools into revenue.
              Pricing models, code examples, growth strategies, and benchmarks
              from 1,017 open-source MCP servers.
            </p>
          </div>

          {/* ================================================================ */}
          {/*  Table of Contents                                               */}
          {/* ================================================================ */}
          <nav className="mb-16 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6" aria-label="Table of contents">
            <p className="text-xs font-semibold text-amber-400 tracking-wide uppercase mb-4">Contents</p>
            <ol className="space-y-2.5 list-decimal list-inside">
              <TocLink href="#why-monetize">Why Monetize Your MCP Tools?</TocLink>
              <TocLink href="#pricing-model">Choosing Your Pricing Model</TocLink>
              <TocLink href="#setup">Setting Up SettleGrid (5 Minutes)</TocLink>
              <TocLink href="#first-revenue">From Zero to First Revenue</TocLink>
              <TocLink href="#growth">Growing Your Tool Business</TocLink>
              <TocLink href="#advanced">Advanced Topics</TocLink>
              <TocLink href="#templates">Templates &amp; Quick Starts</TocLink>
            </ol>
          </nav>

          {/* ================================================================ */}
          {/*  Chapter 1: Why Monetize                                         */}
          {/* ================================================================ */}
          <ChapterHeading id="why-monetize" number={1} title="Why Monetize Your MCP Tools?" />

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">The Opportunity</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            There are over 10,000 MCP servers in the wild. Fewer than 5% have any form of monetization.
            The rest are free, underfunded, and maintained by developers burning spare-time goodwill.
            That is a market failure, not a feature.
          </p>
          <p className="text-gray-300 leading-relaxed mb-4">
            The MCP ecosystem is the fastest-growing tool standard in the AI economy.
            Every major AI lab (Anthropic, OpenAI, Google, Mistral) supports it.
            Every major IDE (Cursor, Windsurf, VS Code) integrates it.
            The protocol has won. The payment layer has not been built yet.
          </p>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">AI Agents Are the New API Consumers</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Traditional APIs are called by humans writing code. MCP tools are called by AI agents
            acting autonomously. An agent running a research workflow might invoke 10-50 tools
            in a single session. Each invocation is a revenue event.
          </p>
          <p className="text-gray-300 leading-relaxed mb-4">
            The shift from human-driven to agent-driven API consumption means:
          </p>
          <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-2 mb-4 ml-4">
            <li><strong className="text-gray-100">Higher volume</strong> — agents call tools hundreds of times per day, not a few times per week</li>
            <li><strong className="text-gray-100">Price insensitivity</strong> — agents optimize for outcome, not cost per call</li>
            <li><strong className="text-gray-100">24/7 usage</strong> — no downtime, no weekends, no vacation</li>
            <li><strong className="text-gray-100">Composability</strong> — one agent&apos;s output is another agent&apos;s input, creating chains that all need settlement</li>
          </ul>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">Revenue Potential</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Based on analysis of 1,017 open-source MCP servers and existing paid API services,
            here are realistic per-call revenue benchmarks by tool type:
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#2A2D3E] mb-6">
            <table className="w-full text-sm" role="table" aria-label="Revenue benchmarks by tool type">
              <thead>
                <tr className="border-b border-[#2A2D3E] bg-[#161822]">
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Tool Type</th>
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Price Range</th>
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Examples</th>
                </tr>
              </thead>
              <tbody>
                <PricingBenchmarkRow category="Simple lookups" range="1-3 cents" examples="DNS lookup, IP geolocation, currency conversion" />
                <PricingBenchmarkRow category="Web search & scraping" range="2-10 cents" examples="Search engines, web scraping, link extraction" />
                <PricingBenchmarkRow category="Data enrichment" range="5-15 cents" examples="Company data, contact info, domain analysis" />
                <PricingBenchmarkRow category="Document analysis" range="5-25 cents" examples="PDF parsing, OCR, contract extraction" />
                <PricingBenchmarkRow category="AI-powered analysis" range="10-50 cents" examples="Sentiment analysis, code review, summarization" />
                <PricingBenchmarkRow category="Multi-step workflows" range="25 cents - $1+" examples="Full research reports, complex data pipelines" />
              </tbody>
            </table>
          </div>

          <Callout>
            <strong className="text-amber-400">Example:</strong> A web search MCP tool charging 5 cents per call,
            used by 100 agents making 50 calls/day each, generates <strong className="text-amber-400">$7,500/month</strong>.
            With SettleGrid&apos;s progressive take rate (0% on first $1K/mo), you keep every cent. 50K ops/month on the free tier.
          </Callout>

          {/* ================================================================ */}
          {/*  Chapter 2: Pricing Model                                        */}
          {/* ================================================================ */}
          <ChapterHeading id="pricing-model" number={2} title="Choosing Your Pricing Model" />

          <p className="text-gray-300 leading-relaxed mb-6">
            SettleGrid supports six pricing models. The right one depends on your tool&apos;s value delivery pattern.
          </p>

          <div className="space-y-6">
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Per-Invocation <span className="text-xs font-normal text-amber-400 ml-2">Most common</span></h3>
              <p className="text-sm text-gray-400 mb-3">A fixed price for every call, regardless of input size or processing time. Simple, predictable, and easy for consumers to budget.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> Search tools, lookups, CRUD operations, simple transformations</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> Web search tool at 5 cents/call</p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Per-Token</h3>
              <p className="text-sm text-gray-400 mb-3">Charge based on input/output token count. Fair pricing that scales with usage intensity.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> LLM wrappers, text processing, translation services</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> Summarization tool at $0.001 per 1K tokens</p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Per-Byte</h3>
              <p className="text-sm text-gray-400 mb-3">Charge based on data volume transferred or processed. Natural fit for file and data tools.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> File conversion, image processing, data export</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> PDF converter at $0.01 per MB</p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Per-Second</h3>
              <p className="text-sm text-gray-400 mb-3">Charge based on compute time consumed. Aligns cost with resource usage.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> Video processing, simulation, ML inference, compute-heavy tasks</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> Video transcription at $0.02 per second</p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Tiered <span className="text-xs font-normal text-amber-400 ml-2">Per-method pricing</span></h3>
              <p className="text-sm text-gray-400 mb-3">Different prices for different tool methods. Lets you charge more for expensive operations.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> Multi-method tools with varying compute costs</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> Database tool: read at 1 cent, write at 5 cents, complex query at 10 cents</p>
            </div>

            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Outcome-Based <span className="text-xs font-normal text-amber-400 ml-2">Pay for results</span></h3>
              <p className="text-sm text-gray-400 mb-3">Charge only when the tool delivers a successful result. Zero risk for consumers — maximum alignment.</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Best for:</strong> High-value, variable-success tasks like lead generation, data extraction, code generation</p>
              <p className="text-sm text-gray-300"><strong className="text-gray-100">Example:</strong> Lead enrichment tool: free if no data found, 25 cents on success</p>
            </div>
          </div>

          <Callout>
            <strong className="text-amber-400">Recommendation:</strong> Start with per-invocation pricing.
            It is the easiest to understand, easiest to implement, and what consumers expect.
            You can always switch to a more sophisticated model later.
          </Callout>

          {/* ================================================================ */}
          {/*  Chapter 3: Setting Up SettleGrid                                */}
          {/* ================================================================ */}
          <ChapterHeading id="setup" number={3} title="Setting Up SettleGrid (5 Minutes)" />

          <p className="text-gray-300 leading-relaxed mb-6">
            Three steps to go from open-source tool to paid API product.
          </p>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">Step 1: Install the SDK</h3>
          <CopyableCodeBlock code="npm install @settlegrid/mcp" title="Terminal" />

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">Step 2: Register Your Tool</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Create a free account at{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
              settlegrid.ai/register
            </Link>
            , then create a tool with a unique slug and your pricing configuration. No credit card required.
          </p>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">Step 3: Wrap Your Handler</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Add two lines to your MCP server to enable per-call billing:
          </p>

          <CopyableCodeBlock
            title="server.ts — MCP Tool"
            language="TypeScript"
            code={`import settlegrid from '@settlegrid/mcp'

// Initialize with your tool slug and pricing
const sg = settlegrid.init({
  toolSlug: 'my-web-search',
  pricing: {
    defaultCostCents: 5,   // 5 cents per call
    methods: {
      deepSearch: 15,      // 15 cents for deep search
    },
  },
})

// Wrap your handler — billing is automatic
const search = sg.wrap(async (query: string) => {
  const results = await performSearch(query)
  return results
})

// That's it. Every call is metered and billed.`}
          />

          <p className="text-gray-300 leading-relaxed mt-6 mb-4">
            For REST APIs, use the middleware approach:
          </p>

          <CopyableCodeBlock
            title="route.ts — Next.js API Route"
            language="TypeScript"
            code={`import { settlegridMiddleware } from '@settlegrid/mcp'

const billing = settlegridMiddleware({
  toolSlug: 'my-api',
  costCents: 5,
})

export async function POST(request: Request) {
  // Validate key and check credits
  const { error } = await billing(request)
  if (error) return error

  // Your logic here
  const data = await processRequest(request)
  return Response.json(data)
}`}
          />

          {/* ================================================================ */}
          {/*  Chapter 4: From Zero to First Revenue                           */}
          {/* ================================================================ */}
          <ChapterHeading id="first-revenue" number={4} title="From Zero to First Revenue" />

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">1. Create Your Tool</h3>
              <p className="text-gray-300 leading-relaxed">
                Pick something you already know how to build. The best monetized tools solve a specific,
                painful problem. A web scraper that cleans and structures output. A code review tool
                that catches real bugs. A data enrichment API that returns verified information.
                Do not try to build a platform — build a function.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">2. Set Your Pricing</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                Use the benchmarks from Chapter 1 as a starting point.
                Your price should cover your compute cost and leave room for margin.
                A good rule of thumb: charge at least 3-5x your per-call cost.
              </p>
              <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-5">
                <p className="text-sm font-semibold text-gray-100 mb-2">Revenue Calculator (Quick Math)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-gray-400 mb-1">100 agents x 20 calls/day</p>
                    <p className="text-amber-400 font-bold text-lg">2,000 calls/day</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 mb-1">At 5 cents/call</p>
                    <p className="text-amber-400 font-bold text-lg">$100/day</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-400 mb-1">Monthly revenue</p>
                    <p className="text-amber-400 font-bold text-lg">$3,000/month</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">3. Test in Sandbox Mode</h3>
              <p className="text-gray-300 leading-relaxed">
                SettleGrid supports sandbox mode with test API keys (prefixed <code className="text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">sg_test_</code>).
                Test keys meter usage without real charges. Verify your integration
                works end-to-end before going live.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">4. Go Live</h3>
              <p className="text-gray-300 leading-relaxed">
                Switch from test keys to live keys. Connect your Stripe account for payouts.
                Your tool is now earning revenue on every call.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">5. Get Your First Consumer</h3>
              <p className="text-gray-300 leading-relaxed">
                List your tool on the{' '}
                <Link href="/tools" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                  SettleGrid Showcase
                </Link>
                . Share it on MCP registries (Smithery, Glama, mcp.so).
                Post it on relevant communities. The first consumer is the hardest — after that, word of mouth kicks in.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">6. Your First Payout</h3>
              <p className="text-gray-300 leading-relaxed">
                SettleGrid has a $1 minimum payout — the lowest of any AI monetization platform.
                Once your balance hits $1, you can withdraw to your Stripe account.
                Daily, weekly, or monthly payout schedules are available.
              </p>
            </div>
          </div>

          <div className="mt-6 mb-6 rounded-xl overflow-hidden border border-[#2A2D3E] shadow-lg">
            <img
              src="/screenshots/Dashboard 2.jpg"
              alt="Developer dashboard showing revenue analytics and payout history"
              className="w-full"
              loading="lazy"
            />
          </div>

          {/* ================================================================ */}
          {/*  Chapter 5: Growing Your Tool Business                           */}
          {/* ================================================================ */}
          <ChapterHeading id="growth" number={5} title="Growing Your Tool Business" />

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">List on MCP Registries</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                The three largest MCP registries drive meaningful discovery traffic:
              </p>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4">
                <li><strong className="text-gray-100">Smithery</strong> (smithery.ai) — the largest registry, strong Claude Desktop integration</li>
                <li><strong className="text-gray-100">Glama</strong> (glama.ai/mcp/servers) — well-organized directory with quality reviews</li>
                <li><strong className="text-gray-100">mcp.so</strong> — community-driven, good for niche tools</li>
              </ul>
              <p className="text-gray-300 leading-relaxed mt-3">
                When listing, emphasize that your tool is paid and reliable.
                Paid tools signal quality — consumers trust tools backed by revenue because the developer has incentive to maintain them.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Marketing Your Tool</h3>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4">
                <li><strong className="text-gray-100">GitHub README</strong> — include a &quot;Pricing&quot; section with clear per-call costs and a link to purchase credits</li>
                <li><strong className="text-gray-100">Blog posts</strong> — write about the problem your tool solves, not the tool itself</li>
                <li><strong className="text-gray-100">Social media</strong> — share use cases and results on X/Twitter, Reddit, and Hacker News</li>
                <li><strong className="text-gray-100">Demo videos</strong> — record a 2-minute video of your tool in action inside Claude or Cursor</li>
                <li><strong className="text-gray-100">Community engagement</strong> — answer questions in Discord servers and forums where your target users hang out</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Pricing Optimization</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                Start lower than you think you should. Early adoption is more valuable than early revenue.
                Once you have consistent usage:
              </p>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4">
                <li>Raise prices 10-20% and monitor churn — if no one leaves, raise again</li>
                <li>Add premium methods at higher price points</li>
                <li>Offer volume discounts via tiered pricing for high-usage consumers</li>
                <li>A/B test different price points by creating tool variants</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Cross-Tool Referrals</h3>
              <p className="text-gray-300 leading-relaxed">
                SettleGrid includes a built-in referral system.
                Refer other developers to the platform and earn a percentage of their revenue.
                Build a network of complementary tools that recommend each other.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">SettleGrid&apos;s Discovery Ecosystem</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                Your tools are automatically discoverable by AI agents and consumers through
                SettleGrid&apos;s built-in discovery infrastructure. The{' '}
                <Link href="/tools" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                  Showcase
                </Link>
                {' '}is the public catalog where consumers browse and search for tools.
                The <strong className="text-gray-100">Discovery API</strong> lets third-party directories
                and integrations embed your tools programmatically. The{' '}
                <strong className="text-gray-100">MCP Discovery Server</strong> enables AI agents to find
                and invoke your tools by capability, meaning agents can discover your tool without
                any human in the loop.
              </p>
              <p className="text-gray-300 leading-relaxed">
                Combined with{' '}
                <Link href="/dev" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                  developer profiles
                </Link>
                , README badges, and reputation tiers (Bronze through Platinum), these channels
                form a distribution engine that grows your visibility as you build trust.
                Read the full{' '}
                <Link href="/learn/discovery" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
                  How to Get Discovered
                </Link>
                {' '}guide for step-by-step instructions on maximizing your tool&apos;s reach.
              </p>
              <div className="mt-6 mb-6 rounded-xl overflow-hidden border border-[#2A2D3E] shadow-lg">
                <img
                  src="/screenshots/Tools.jpg"
                  alt="SettleGrid Showcase with published tools and verified badges"
                  className="w-full"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Chapter 6: Advanced Topics                                      */}
          {/* ================================================================ */}
          <ChapterHeading id="advanced" number={6} title="Advanced Topics" />

          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Multi-Hop Settlement</h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                When Agent A calls your tool, which calls Tool B, which calls Tool C, everyone needs to get paid.
                SettleGrid handles multi-hop settlement atomically — all participants settle or none do.
                Revenue splits are resolved in real time across the entire chain.
              </p>
              <CopyableCodeBlock
                title="Multi-hop chain"
                code={`// Agent A → Your Tool (5¢) → Tool B (3¢) → Tool C (2¢)
// Total cost: 10¢ — each developer paid atomically
// No manual reconciliation. No delayed settlements.`}
              />
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Protocol-Agnostic Billing</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                SettleGrid supports 15 payment protocols out of the box. Your tool works with any of them
                without protocol-specific code:
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
                {['MCP', 'MPP', 'x402', 'AP2', 'Visa TAP', 'UCP', 'ACP', 'MC Agent Pay', 'Nanopayments', 'REST', 'L402', 'Alipay Trust', 'KYAPay', 'EMVCo', 'DRAIN'].map((p) => (
                  <div key={p} className="bg-[#161822] border border-[#2A2D3E] rounded-lg px-3 py-2 text-center text-xs font-semibold text-gray-300">
                    {p}
                  </div>
                ))}
              </div>
              <p className="text-gray-300 leading-relaxed">
                Backed by Anthropic, Google, Stripe, Visa, Mastercard, Coinbase, OpenAI, and Circle.
                One SDK handles every protocol — zero vendor lock-in.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Budget Enforcement &amp; Consumer Controls</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                Consumers can set hard budget limits on API keys. When the budget is exhausted,
                calls return a 402 error — no surprise bills. Consumers can also enable auto-refill
                to keep usage seamless.
              </p>
              <CopyableCodeBlock
                title="Budget enforcement"
                code={`// Consumer creates a key with a $50 budget
// After $50 in usage, calls return 402
// Auto-refill: automatically add $50 when balance < $5`}
              />
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Fraud Detection</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                SettleGrid includes a three-check fraud detection system:
              </p>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4">
                <li><strong className="text-gray-100">Rate spike detection</strong> — flags unusual usage patterns</li>
                <li><strong className="text-gray-100">New-key velocity</strong> — monitors rapid key creation</li>
                <li><strong className="text-gray-100">Duplicate deduplication</strong> — catches replay attacks</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-100 mb-3">Enterprise Features</h3>
              <p className="text-gray-300 leading-relaxed mb-3">
                For tool developers serving enterprise customers:
              </p>
              <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4">
                <li><strong className="text-gray-100">RBAC</strong> — role-based access control for teams</li>
                <li><strong className="text-gray-100">Audit logging</strong> — full trail with CSV export for SOC 2</li>
                <li><strong className="text-gray-100">IP allowlisting</strong> — lock keys to specific IP ranges</li>
                <li><strong className="text-gray-100">Webhook events</strong> — real-time notifications for usage, payouts, and alerts</li>
                <li><strong className="text-gray-100">Health monitoring</strong> — uptime checks with configurable alert thresholds</li>
              </ul>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Chapter 7: Templates & Quick Starts                             */}
          {/* ================================================================ */}
          <ChapterHeading id="templates" number={7} title="Templates & Quick Starts" />

          <p className="text-gray-300 leading-relaxed mb-6">
            Do not start from scratch. SettleGrid provides production-ready templates
            with billing already wired in.
          </p>

          <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-gray-100 mb-4">17 Templates Available</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold text-amber-400 tracking-wide uppercase mb-2">MCP Templates (13)</p>
                <ul className="space-y-1.5 text-gray-300">
                  <li>Web search &amp; scraping</li>
                  <li>Document analysis</li>
                  <li>Database query</li>
                  <li>Code generation</li>
                  <li>Image generation</li>
                  <li>Data enrichment</li>
                  <li>File conversion</li>
                  <li>Email &amp; messaging</li>
                  <li>Calendar &amp; scheduling</li>
                  <li>Payment processing</li>
                  <li>Weather &amp; geolocation</li>
                  <li>Translation</li>
                  <li>Monitoring &amp; alerts</li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400 tracking-wide uppercase mb-2">REST Templates (4)</p>
                <ul className="space-y-1.5 text-gray-300">
                  <li>Next.js API route</li>
                  <li>Express middleware</li>
                  <li>AI proxy service</li>
                  <li>Dual protocol (MCP + REST)</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed mb-4">
            Browse all templates on the{' '}
            <Link href="/templates/" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
              Templates page
            </Link>
            .
          </p>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">1,017 Open-Source Servers</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            We have cataloged 1,017 open-source MCP servers that can be monetized.
            Browse the full database on the{' '}
            <Link href="/tools" className="text-amber-400 hover:text-amber-300 underline underline-offset-2">
              SettleGrid Showcase
            </Link>
            {' '}to find tools in your domain or get inspiration for new tools.
          </p>

          <h3 className="text-xl font-bold text-gray-100 mt-8 mb-3">CLI Scaffolder</h3>
          <p className="text-gray-300 leading-relaxed mb-4">
            Scaffold a new monetized tool in one command:
          </p>
          <CopyableCodeBlock code="npx create-settlegrid-tool" title="Terminal" />
          <p className="text-gray-300 leading-relaxed mt-4">
            The CLI will ask for your tool name, pricing model, and preferred template.
            It generates a complete project with SettleGrid billing pre-configured,
            tests, and a README ready for publication.
          </p>

          {/* ================================================================ */}
          {/*  Footer CTA                                                      */}
          {/* ================================================================ */}
          <div className="mt-20 mb-8 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-4">
              Start building — free forever
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              50,000 operations/month. Progressive take rate. No credit card.
              Your AI tools deserve to earn money.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3.5 rounded-lg text-lg hover:bg-brand-dark transition-all shadow-lg shadow-brand/25"
              >
                Create Free Account
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center border-2 border-gray-600 text-gray-300 font-semibold px-8 py-3.5 rounded-lg text-lg hover:border-gray-400 hover:text-white transition-colors"
              >
                Read the Docs
              </Link>
            </div>
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
            <Link href="/learn" className="hover:text-gray-300 transition-colors">Learn</Link>
            <Link href="/docs" className="hover:text-gray-300 transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
