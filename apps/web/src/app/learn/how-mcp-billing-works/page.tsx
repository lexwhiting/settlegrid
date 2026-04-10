import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'How MCP Billing Works — Per-Call Payments for AI Tools | SettleGrid',
  description:
    'MCP billing is per-call payment infrastructure for AI tools built on the Model Context Protocol. Learn how billing layers intercept tool calls, meter usage, settle payments, and pay developers through Stripe Connect.',
  alternates: { canonical: 'https://settlegrid.ai/learn/how-mcp-billing-works' },
  keywords: [
    'MCP billing',
    'how MCP billing works',
    'MCP payment infrastructure',
    'per-call billing MCP',
    'AI tool billing',
    'MCP tool payments',
    'agent payment flow',
    'MCP metering',
    'MCP settlement',
  ],
  openGraph: {
    title: 'How MCP Billing Works — Per-Call Payments for AI Tools',
    description:
      'MCP billing is per-call payment infrastructure for AI tools. Learn how billing layers intercept tool calls, meter usage, settle payments, and pay developers.',
    type: 'article',
    url: 'https://settlegrid.ai/learn/how-mcp-billing-works',
    siteName: 'SettleGrid',
    publishedTime: '2026-03-28',
    modifiedTime: '2026-03-28',
    authors: ['SettleGrid Team'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How MCP Billing Works',
    description: 'Per-call payment infrastructure for AI tools built on the Model Context Protocol.',
  },
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD Schemas                                                            */
/* -------------------------------------------------------------------------- */

const jsonLdArticle = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'How MCP Billing Works',
  description:
    'MCP billing is per-call payment infrastructure for AI tools built on the Model Context Protocol. This guide explains the complete payment flow from tool call to developer payout.',
  author: {
    '@type': 'Person',
    name: 'SettleGrid Team',
    url: 'https://settlegrid.ai/about',
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
  datePublished: '2026-03-28',
  dateModified: '2026-03-28',
  url: 'https://settlegrid.ai/learn/how-mcp-billing-works',
  mainEntityOfPage: 'https://settlegrid.ai/learn/how-mcp-billing-works',
  keywords: [
    'MCP billing',
    'per-call billing',
    'AI tool payments',
    'MCP metering',
    'agent commerce',
  ],
  wordCount: 2800,
  articleSection: 'Developer Guides',
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
    { '@type': 'ListItem', position: 2, name: 'How MCP Billing Works', item: 'https://settlegrid.ai/learn/how-mcp-billing-works' },
  ],
}

const jsonLdFaq = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is MCP billing?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'MCP billing is per-call payment infrastructure for AI tools that use the Model Context Protocol. A billing layer wraps the tool handler, intercepts each call, verifies the caller has credits, meters the usage, and settles payment after the tool returns a successful response.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does per-call billing work for MCP tools?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'When an AI agent calls a billed MCP tool, the billing layer checks the caller\'s balance, executes the tool, records the usage event, deducts the per-call price from the caller\'s credits, and returns the result. Failed calls are not charged. The entire flow adds less than 50ms of latency.',
      },
    },
    {
      '@type': 'Question',
      name: 'What payment protocols does SettleGrid support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid supports 15 payment protocols: MCP, x402 (Coinbase), MPP (Stripe), A2A (Google), AP2, Visa TAP, UCP, ACP (OpenAI), Mastercard Agent Pay, Circle Nanopayments, REST, L402 (Bitcoin Lightning), Alipay Trust, KYAPay, EMVCo, and DRAIN.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do MCP tool developers get paid?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid pays tool developers through Stripe Connect. Earnings transfer to the developer\'s Stripe balance on a rolling 7-day schedule. The free tier offers 0% take rate on the first $1K/mo of revenue, meaning developers keep 100% of their earnings up to that threshold.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much latency does MCP billing add?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'SettleGrid adds less than 50ms of latency per call. The billing layer performs a single Redis lookup for balance verification (sub-millisecond), executes the tool handler, and batches metering events asynchronously. For serverless deployments, events are flushed at the end of the invocation.',
      },
    },
  ],
}

/* -------------------------------------------------------------------------- */
/*  Sections                                                                   */
/* -------------------------------------------------------------------------- */

const SECTIONS = [
  {
    id: 'what-is-mcp-billing',
    heading: 'What Is MCP Billing?',
    paragraphs: [
      'MCP billing is per-call payment infrastructure for AI tools built on the Model Context Protocol. It enables developers to charge a fixed amount for every successful invocation of their tool, turning free MCP servers into revenue-generating products. Over 12,770 MCP servers exist on PulseMCP alone, yet less than 5% generate any revenue. MCP billing solves this by making monetization as simple as adding two lines of code.',
      'The billing layer sits between the AI agent (the caller) and the MCP tool handler (the developer\'s code). When an agent calls a billed tool, the billing layer verifies the caller has sufficient credits, executes the tool, records the usage, and settles the payment. Failed calls are not charged. The entire flow adds less than 50ms of latency.',
      'SettleGrid is the leading MCP billing platform, supporting 15 payment protocols (MCP, x402, MPP, Visa TAP, and 11 others) through a single SDK integration. According to Anthropic, the MCP SDK has been downloaded over 97 million times, making MCP the dominant standard for AI tool calling.',
    ],
  },
  {
    id: 'payment-flow',
    heading: 'How Does the Payment Flow Work?',
    paragraphs: [
      'The MCP billing payment flow has six steps that execute in sequence on every tool call. Step 1: The AI agent discovers the tool through a registry, directory, or Discovery API and reads the pricing metadata. Step 2: The agent sends a tool call request to the MCP server. Step 3: The billing layer intercepts the request and checks the caller\'s credit balance against the tool\'s per-call price.',
      'Step 4: If the caller has sufficient credits, the billing layer passes the request to the tool handler and starts a metering event. Step 5: The tool handler executes and returns a result. Step 6: The billing layer records the completed event, deducts the price from the caller\'s balance, and returns the result to the agent. If the tool fails (throws an error or returns an error response), no charge is applied.',
      'This pay-on-success model ensures agents only pay for value received. It also incentivizes tool developers to build reliable, fast, and accurate tools, because unreliable tools generate fewer successful calls and therefore less revenue.',
    ],
  },
  {
    id: 'pricing-models',
    heading: 'What Pricing Models Are Available?',
    paragraphs: [
      'SettleGrid supports six pricing models for MCP tools. Per-call billing charges a fixed amount for each successful invocation (e.g., 5 cents per call). Per-token billing charges based on the number of tokens processed (useful for NLP and text analysis tools). Per-byte billing charges based on data volume (useful for file processing and data transfer tools).',
      'Per-second billing charges based on execution time (useful for compute-intensive tools like image generation). Tiered billing allows different prices for different methods within the same tool (e.g., a search method at 2 cents and an analyze method at 10 cents). Outcome-based billing charges only when a specific success condition is met (e.g., only charge for data enrichment when a match is found).',
      'Most MCP tool developers start with per-call billing because it is the simplest model to implement, the easiest for consumers to understand, and the most predictable for both parties. The median per-call price across the MCP ecosystem is 5 to 10 cents, though prices range from 0.5 cents for simple lookups to $5 for complex security analysis tools.',
    ],
  },
  {
    id: 'settlement-and-payouts',
    heading: 'How Do Settlement and Payouts Work?',
    paragraphs: [
      'Settlement is the process of transferring money from the consumer (the AI agent operator who pays for tool calls) to the developer (the person who built and hosts the tool). SettleGrid handles settlement automatically through Stripe Connect, the same infrastructure used by Shopify, Lyft, and other marketplaces.',
      'Consumers prepay credits into their SettleGrid balance. Each successful tool call deducts credits from the consumer\'s balance in real time. Developer earnings accumulate in their SettleGrid account and transfer to their Stripe balance on a rolling 7-day schedule. The free tier includes a 0% take rate on the first $1,000 per month of revenue.',
      'SettleGrid supports 15 payment protocols for the consumer side: MCP (native), x402 (Coinbase crypto), MPP (Stripe fiat), Visa TAP (card networks), and 11 others. Regardless of which protocol the consumer uses to pay, the developer always receives payouts through Stripe Connect in their local currency.',
    ],
  },
  {
    id: 'implementation',
    heading: 'How Do I Add Billing to My MCP Tool?',
    paragraphs: [
      'Adding SettleGrid billing to an existing MCP tool requires two lines of code. First, install the SDK: npm install @settlegrid/mcp. Then wrap your handler with the billing layer. The SDK exports a settlegrid.init() function that creates a billing context, and a sg.wrap() function that wraps your handler with metering and payment settlement.',
      'The wrap function is transparent: it passes the same input to your handler and returns the same output to the caller. Your tool code does not change at all. The only difference is that each successful call is now metered and billed. Rate-limited calls return structured error responses that agents can interpret and retry.',
      'After wrapping your handler, deploy your MCP server to any hosting provider (Vercel, Railway, Fly.io, or your own infrastructure) and publish to the SettleGrid marketplace with npx settlegrid publish. Your tool listing goes live within minutes and becomes discoverable by AI agents through the Discovery API, the MCP Discovery Server, and the explore marketplace.',
    ],
  },
  {
    id: 'protocol-negotiation',
    heading: 'How Does Multi-Protocol Payment Work?',
    paragraphs: [
      'AI agents use different payment protocols depending on their platform and configuration. A Claude agent might use MCP-native payments, a Stripe-integrated agent uses MPP, and a crypto-native agent uses x402. Without a billing platform, tool developers would need to implement each protocol separately.',
      'SettleGrid handles protocol negotiation automatically. When a consumer (agent) initiates a payment, SettleGrid detects the protocol from the request headers and metadata, validates the payment according to that protocol\'s rules, and settles the payment through the appropriate rail. The tool developer never interacts with protocol-specific code.',
      'A small number of protocols account for the majority of agent payment volume today: MCP (dominant for tool calling), MPP (Stripe, growing fast after March 2026 launch), and x402 (crypto, approximately $28K daily volume). Several emerging protocols handle edge cases and new use cases. SettleGrid supports a broad set so developers do not have to bet on any single one.',
    ],
  },
] as const

/* -------------------------------------------------------------------------- */
/*  Page Component                                                             */
/* -------------------------------------------------------------------------- */

export default function HowMcpBillingWorksPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
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

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">How MCP Billing Works</span>
          </nav>

          {/* Title */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                10 min read
              </span>
              <span className="text-[10px] text-gray-500">March 28, 2026</span>
              <span className="text-[10px] text-gray-500">
                by <a href="https://settlegrid.ai/about" className="text-gray-400 hover:text-gray-100 transition-colors">SettleGrid Team</a>
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              How MCP Billing Works
            </h1>
            <p className="text-lg text-gray-400">
              A complete guide to per-call payment infrastructure for AI tools built on the Model Context Protocol.
              From tool call to developer payout, explained step by step.
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              In this article
            </h2>
            <ol className="space-y-1.5">
              {SECTIONS.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {i + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Sections */}
          <div className="space-y-14">
            {SECTIONS.map((section, i) => (
              <section key={section.id} id={section.id}>
                <div className="flex items-baseline gap-3 mb-4 scroll-mt-24">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <h2 className="text-xl font-bold text-gray-100">
                    {section.heading}
                  </h2>
                </div>
                <div className="space-y-4 pl-11">
                  {section.paragraphs.map((paragraph, j) => (
                    <p key={j} className="text-gray-300 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-14 mb-10">
            <h2 className="text-xl font-bold text-gray-100 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {jsonLdFaq.mainEntity.map((faq, i) => (
                <div key={i} className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                  <h3 className="text-base font-semibold text-gray-100 mb-2">{faq.name}</h3>
                  <p className="text-gray-300 leading-relaxed">{faq.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-14 mb-10 rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Ready to add billing to your MCP tool?
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Two lines of code. 15 payment protocols. Up to 100% revenue share. Start earning from your AI tools today.
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

          {/* Related */}
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Related Articles</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/learn/blog/how-to-monetize-mcp-server"
                className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
              >
                <p className="text-xs text-gray-500 mb-1">8 min read</p>
                <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-snug">
                  How to Monetize an MCP Server in 2026
                </p>
              </Link>
              <Link
                href="/learn/blog/per-call-billing-ai-agents"
                className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
              >
                <p className="text-xs text-gray-500 mb-1">9 min read</p>
                <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-snug">
                  Per-Call Billing for AI Agents: The Developer&apos;s Guide
                </p>
              </Link>
              <Link
                href="/learn/blog/ai-agent-payment-protocols"
                className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
              >
                <p className="text-xs text-gray-500 mb-1">12 min read</p>
                <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-snug">
                  AI Agent Payment Protocols Compared (2026)
                </p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
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
