import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { CATEGORIES, CATEGORY_SLUGS, getCategoryBySlug, type CategoryDefinition } from '@/lib/categories'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((cat) => ({ slug: `monetize-${cat}-tools` }))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCategoryFromSlug(slug: string): CategoryDefinition | null {
  const match = slug.match(/^monetize-(.+)-tools$/)
  if (!match) return null
  return getCategoryBySlug(match[1]) ?? null
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = parseCategoryFromSlug(slug)
  if (!category) return { title: 'Guide Not Found | SettleGrid' }

  const title = `How to Monetize ${category.name} Tools | SettleGrid`
  const description = `Complete guide to monetizing ${category.name.toLowerCase()} MCP tools on SettleGrid. Pricing strategies, market sizing, revenue benchmarks, and step-by-step integration.`

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/guides/${slug}` },
    keywords: [
      ...category.keywords,
      'monetization guide',
      'pricing strategy',
      'revenue benchmarks',
      'MCP tool billing',
    ],
    openGraph: {
      title,
      description,
      type: 'article',
      url: `https://settlegrid.ai/guides/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

// ─── Guide Content Generator ────────────────────────────────────────────────

interface GuideSection {
  heading: string
  content: string[]
}

function getGuideContent(cat: CategoryDefinition): GuideSection[] {
  return [
    {
      heading: 'Why This Category',
      content: [cat.guideIntro],
    },
    {
      heading: 'Recommended Pricing Models',
      content: [
        getPricingAdvice(cat.slug),
      ],
    },
    {
      heading: 'Market Opportunity',
      content: [
        getMarketOpportunity(cat.slug),
      ],
    },
    {
      heading: 'Revenue Benchmarks',
      content: [
        getRevenueBenchmarks(cat.slug),
      ],
    },
    {
      heading: 'Step-by-Step: From Zero to Revenue',
      content: [
        'Getting your first paying agent takes five steps:',
        '1. Build your MCP server with the capability you want to monetize. Use `npx create-settlegrid-tool` to scaffold a project with billing pre-wired.',
        '2. Choose a pricing model. For most tools, per-invocation is the simplest starting point. You can switch to per-token or tiered pricing later.',
        '3. Register on SettleGrid and connect your Stripe account. This takes under 5 minutes.',
        '4. Deploy your server and publish your tool. SettleGrid generates a storefront page, handles metering, and processes payments automatically.',
        '5. Promote your tool via its auto-generated explore page, category listing, and README badge.',
      ],
    },
    {
      heading: 'Pricing Strategy Tips',
      content: [
        getPricingTips(cat.slug),
      ],
    },
    {
      heading: 'Competitive Positioning',
      content: [
        getCompetitiveAdvice(cat.slug),
      ],
    },
  ]
}

function getPricingAdvice(slug: string): string {
  const models: Record<string, string> = {
    data: 'Per-invocation is the standard for data tools. Charge 1-10\u00A2 per query for basic lookups, 10-50\u00A2 for enriched responses with joins or aggregations, and $1+ for real-time streaming feeds. Consider tiered pricing if your tool has both simple lookups and complex analytics methods.',
    nlp: 'Per-token pricing aligns costs with value for NLP tools. Charge $0.001-0.01 per 1K tokens for text classification, $0.01-0.05 for summarization, and $0.05-0.20 for translation. Alternatively, per-invocation works well for fixed-scope operations like sentiment analysis.',
    image: 'Per-invocation at premium rates (25-100\u00A2 per call) works best for image tools because compute costs are higher. For image generation, outcome-based pricing (charge more for high-resolution outputs) can increase ARPU. Per-byte pricing suits tools that process variable-size images.',
    code: 'Per-invocation at 5-25\u00A2 per call is standard for code tools. Tiered pricing per method works well when you have both fast operations (formatting, 2\u00A2) and slow operations (full analysis, 25\u00A2). Outcome-based pricing (charge only on successful lint/test passes) can differentiate your tool.',
    search: 'Per-invocation at 2-15\u00A2 per query is the natural model for search tools. Charge more for semantic search (which requires embedding computation) vs. keyword search. Tiered pricing works when you offer both basic and enriched results (with snippets, metadata, or relevance scores).',
    finance: 'Finance tools command premium pricing: 10-100\u00A2 per query for market data, $1+ for complex financial computations. Per-second pricing works for streaming market feeds. Outcome-based pricing (charge only on successful trade execution or fraud detection) can maximize revenue.',
    science: 'Per-invocation at 10-50\u00A2 for data lookups, $1+ for compute-intensive simulations. Per-second pricing suits long-running computations. Science tools often have high per-call costs but low volume — price to cover compute with margin, not to maximize call count.',
    media: 'Per-byte or per-second pricing aligns with the variable cost of media processing. Charge $0.01-0.05 per MB for audio transcription, $0.05-0.20 per minute for video analysis. Image generation tools work well with per-invocation at 10-50\u00A2.',
    security: 'Security tools justify premium pricing because the cost of NOT using them is high. Charge 25-100\u00A2 per scan, $1+ for comprehensive vulnerability assessments. Per-invocation is standard, but tiered pricing per severity level (basic scan vs. deep analysis) can increase ARPU.',
    communication: 'Per-invocation at 1-5\u00A2 per message for email/SMS, 0.5-2\u00A2 for push notifications. Volume-based tiers (first 1K messages at 2\u00A2, next 10K at 1\u00A2) encourage adoption. Tiered pricing per channel (email cheaper than SMS) matches your underlying costs.',
    productivity: 'Per-invocation at 2-10\u00A2 per call is standard. Productivity tools benefit from tiered pricing per method because operations vary in complexity: a quick date format (1\u00A2) vs. a full document merge (15\u00A2). Keep the entry price low to encourage high-frequency use.',
    analytics: 'Per-invocation at 5-25\u00A2 for standard queries, 50\u00A2-$2 for complex aggregations or visualizations. Per-second pricing suits long-running analytics jobs. Tiered pricing per query complexity (simple count vs. multi-dimensional pivot) aligns cost with value.',
    utility: 'Utility tools should price low and aim for volume: 0.5-3\u00A2 per call. These are called thousands of times per workflow, so even fractional-cent pricing generates meaningful revenue. Per-byte pricing works for encoding/compression tools where input size varies.',
  }
  return models[slug] ?? models.utility!
}

function getMarketOpportunity(slug: string): string {
  const markets: Record<string, string> = {
    data: 'The data API market is projected to reach $69.5B by 2028. AI agents are the fastest-growing consumer segment because they make API calls at machine speed — a single agent workflow can make 100+ data API calls per task. Early movers in the MCP data tool space will capture disproportionate market share.',
    nlp: 'The NLP market is expected to reach $112B by 2030. Every AI agent that processes human language — customer support bots, research assistants, content creators — needs NLP tools. The MCP protocol makes it trivial for agents to discover and call your NLP tool, removing the traditional integration barrier.',
    image: 'The computer vision market is forecast at $41B by 2030. AI agents are increasingly multimodal, meaning they process images alongside text. Any agent that interacts with the physical world (screenshots, photos, documents) needs vision tools — and MCP makes them instantly accessible.',
    code: 'The developer tools market exceeds $25B annually and is growing 20%+ YoY. AI coding assistants (Cursor, GitHub Copilot, Claude) are the primary buyers of code analysis tools. Every time a developer uses an AI code assistant, it potentially calls multiple MCP tools — linters, formatters, test runners.',
    search: 'The enterprise search market is $7.5B and growing at 14% CAGR. AI agents are the new power users of search — a single research task can generate 20+ search queries. RAG (Retrieval-Augmented Generation) pipelines are especially hungry for search tools, calling them on every user query.',
    finance: 'The fintech API market exceeds $20B. Financial data is uniquely valuable because it\'s time-sensitive and accuracy-critical. AI agents in trading, risk analysis, and accounting need real-time financial data — and they\'ll pay premium rates for reliability.',
    science: 'The scientific computing market is $12B and growing. Research AI agents need specialized tools for literature search, data analysis, and simulation. The niche nature of science tools means less competition and higher willingness to pay.',
    media: 'The media processing market is $15B and accelerating with AI adoption. Multimodal AI agents need audio transcription, video analysis, and content generation. The compute costs of media processing justify higher per-call pricing.',
    security: 'The cybersecurity market is $267B by 2028. Every AI agent handling sensitive operations needs security tools — threat scanning, compliance checking, vulnerability detection. Organizations will pay premium rates for security tools because the alternative (a breach) costs orders of magnitude more.',
    communication: 'The CPaaS (Communications Platform as a Service) market is $29B. AI agents that interact with humans need to send emails, SMS, and notifications. Communication tools have clear per-message pricing models that are well-understood by buyers.',
    productivity: 'The productivity software market is $96B globally. AI assistants are becoming the primary interface for productivity tasks — scheduling, document processing, task management. Every AI assistant interaction is a potential tool call.',
    analytics: 'The business intelligence market is $33B. AI agents that answer business questions need analytics tools to query data, generate visualizations, and calculate metrics. The value of a single business insight can justify substantial per-query pricing.',
    utility: 'Utility tools are the long tail of the MCP ecosystem. They\'re called in nearly every agent workflow as building blocks — encoding, validation, formatting, conversion. Individual call value is low, but aggregate volume is massive. The top utility tools on npm see millions of downloads weekly.',
  }
  return markets[slug] ?? markets.utility!
}

function getRevenueBenchmarks(slug: string): string {
  const benchmarks: Record<string, string> = {
    data: 'At 5\u00A2 per call and 10,000 daily queries, a data tool earns ~$500/month. Top data API providers on similar platforms report $2K-$15K/month. The key is reaching critical mass: once agents discover your tool, query volume compounds because agents share tool recommendations via MCP registries.',
    nlp: 'At $0.005 per 1K tokens and average 500-token inputs, an NLP tool processing 50K requests/day earns ~$3,750/month. Language tools tend to have high retention because switching costs are high — agents calibrate their prompts to a specific tool\'s output format.',
    image: 'At 50\u00A2 per call and 2,000 daily requests, an image tool earns ~$30K/month. Image tools have higher per-call revenue but lower volume than text tools. Focus on reliability and speed — agents will pay more for a tool that responds in <2 seconds vs. 10 seconds.',
    code: 'At 10\u00A2 per call and 5,000 daily invocations, a code tool earns ~$15K/month. Code tools benefit from strong lock-in: once a developer configures their AI assistant to use your linter or formatter, they rarely switch. Focus on language coverage and accuracy.',
    search: 'At 5\u00A2 per query and 20,000 daily searches, a search tool earns ~$30K/month. Search tools scale well because RAG pipelines call them on every user query. The key metric is result quality — agents will pay more for a search tool that returns relevant results on the first call.',
    finance: 'At 25\u00A2 per call and 5,000 daily queries, a finance tool earns ~$37.5K/month. Financial data tools can command premium pricing because accuracy is non-negotiable. Even small inaccuracies in financial data can cause significant losses for the agents using them.',
    science: 'At 25\u00A2 per call and 1,000 daily queries, a science tool earns ~$7.5K/month. Science tools have lower volume but higher willingness to pay. Researchers and research agents value specialized tools that would take months to build in-house.',
    media: 'At $0.05 per MB and average 5MB inputs, a media tool processing 5,000 files/day earns ~$37.5K/month. Media tools have high compute costs, so ensure your pricing covers infrastructure with healthy margins.',
    security: 'At 50\u00A2 per scan and 3,000 daily scans, a security tool earns ~$45K/month. Security tools have the highest willingness-to-pay in the MCP ecosystem because the consequences of not scanning are severe. Focus on comprehensive coverage and fast response times.',
    communication: 'At 2\u00A2 per message and 50,000 daily messages, a communication tool earns ~$30K/month. Communication tools scale linearly with agent adoption — as more AI agents handle customer interactions, message volume grows proportionally.',
    productivity: 'At 5\u00A2 per call and 10,000 daily invocations, a productivity tool earns ~$15K/month. Productivity tools benefit from high call frequency — a single agent workflow can invoke formatting, parsing, and transformation tools dozens of times per task.',
    analytics: 'At 15\u00A2 per query and 5,000 daily queries, an analytics tool earns ~$22.5K/month. Analytics tools are sticky: once an organization\'s AI agents are configured to use your analytics tool for reporting, switching is costly because it requires re-calibrating dashboards and reports.',
    utility: 'At 1\u00A2 per call and 100,000 daily invocations, a utility tool earns ~$30K/month. The math of utility tools is simple: low price, massive volume. The top utility tools are called millions of times per day because they\'re building blocks in every workflow.',
  }
  return benchmarks[slug] ?? benchmarks.utility!
}

function getPricingTips(slug: string): string {
  const tips: Record<string, string> = {
    data: 'Start with a free tier (100 calls/day) to let agents discover your tool, then charge for production volume. Price per data richness: a basic lat/long lookup should cost less than a fully enriched geolocation response with timezone, weather, and demographics.',
    nlp: 'Offer a free tier for short texts (<100 tokens) to encourage adoption, then charge for longer inputs. Consider offering a "batch" discount for agents that send multiple texts in one call — this reduces your overhead while increasing per-call revenue.',
    image: 'Price by output quality: standard resolution at base price, high-resolution at 2-3x. For vision/analysis tools, charge by complexity — a simple classification (1 label) should cost less than full scene understanding (objects, relationships, OCR).',
    code: 'Bundle complementary operations: offer a "full analysis" method that runs lint + format + type-check for a single higher price, alongside individual methods at lower prices. Developers will pay for convenience. Language-specific tools can charge more than generic ones.',
    search: 'Price by result depth: basic search (title + URL) at base price, enriched search (snippets + metadata + relevance scores) at 2-3x. Offer a "deep search" method for agents that need comprehensive results across multiple sources.',
    finance: 'Real-time data commands 5-10x the price of delayed data. Offer both tiers. For complex computations (risk models, portfolio analysis), per-second pricing ensures you cover compute costs even on long-running calculations.',
    science: 'Academic pricing (50% discount for .edu domains) can drive adoption in the research community, which generates citations and referrals. For compute-intensive tools, per-second pricing with a minimum charge prevents unprofitable short-burst calls.',
    media: 'Offer previews: let agents process the first 30 seconds of audio or a thumbnail-resolution image for free, then charge for full processing. This "try before you buy" model dramatically increases conversion from discovery to paid usage.',
    security: 'Never offer a free tier for security tools — it attracts abuse. Instead, offer a paid trial (first 100 scans at 50% off). Price by depth: quick scan at base price, comprehensive assessment at 5-10x. Organizations budget for security, so don\'t underprice.',
    communication: 'Price at or slightly below CPaaS competitors (Twilio, SendGrid) to win on value. Offer volume discounts to encourage agents to route all messages through your tool. Channel-specific pricing (email < push < SMS) matches your underlying costs.',
    productivity: 'Keep entry prices low (1-5\u00A2) to maximize call frequency. Productivity tools succeed by being called thousands of times per day. Offer a monthly subscription as an alternative to per-call pricing for high-volume users.',
    analytics: 'Price by query complexity: simple counts at 5\u00A2, multi-dimensional aggregations at 50\u00A2, full report generation at $2+. Cache results for identical queries and don\'t charge twice — this builds trust and encourages agents to call your tool more frequently.',
    utility: 'Race to the bottom on price (0.5-2\u00A2) and win on reliability and speed. Utility tools are commodities — agents will switch to a cheaper alternative if yours isn\'t the fastest. Optimize for p99 latency under 100ms.',
  }
  return tips[slug] ?? tips.utility!
}

function getCompetitiveAdvice(slug: string): string {
  const advice: Record<string, string> = {
    data: 'Differentiate by covering data sources that aren\'t easily available via free APIs. Government data (USDA, SEC, EPA), proprietary datasets, and real-time aggregations across multiple sources create defensible moats. Don\'t compete on generic weather or geocoding — those are commoditized.',
    nlp: 'Differentiate by specializing in a domain: legal NLP, medical NLP, financial NLP. General-purpose NLP is commoditized by LLMs themselves, but domain-specific NLP with specialized vocabularies and fine-tuned models commands premium pricing.',
    image: 'Differentiate by speed and specialization. General image classification is commoditized, but niche use cases — medical imaging, satellite analysis, document OCR with specific formats — have less competition and higher pricing power.',
    code: 'Differentiate by language depth. A Python-only tool that handles every edge case (type checking, import sorting, docstring generation, test generation) beats a generic multi-language tool that does shallow analysis. Deep expertise in one language creates switching costs.',
    search: 'Differentiate by index freshness and domain coverage. A search tool that indexes in real-time and covers niche sources (academic papers, patents, regulatory filings) beats generic web search. Proprietary crawling infrastructure is a moat.',
    finance: 'Differentiate by data exclusivity and calculation accuracy. Financial data from alternative sources (satellite imagery, social sentiment, supply chain signals) commands premium pricing. Ensure calculations match industry-standard formulas — even small discrepancies destroy trust.',
    science: 'Differentiate by peer validation. Science tools that cite their methodologies, publish validation papers, and are endorsed by researchers have unassailable positioning. The academic community\'s trust is hard to earn but harder to lose.',
    media: 'Differentiate by format support and quality. A transcription tool that handles 50 languages with speaker diarization beats one that only does English. Quality metrics (WER for transcription, FID for generation) should be prominently displayed.',
    security: 'Differentiate by coverage breadth and update frequency. A vulnerability scanner that covers CVEs within 24 hours of disclosure beats one that updates weekly. Real-time threat intelligence feeds create sticky subscriptions.',
    communication: 'Differentiate by deliverability and reliability. Email tools compete on inbox placement rates, SMS tools on delivery confirmation, push tools on latency. Publish your delivery metrics — agents will route to the most reliable channel.',
    productivity: 'Differentiate by integration depth. A calendar tool that understands timezone edge cases, recurring meeting patterns, and conflict resolution beats a simple CRUD wrapper. The devil is in the details for productivity tools.',
    analytics: 'Differentiate by visualization quality and insight depth. An analytics tool that returns not just numbers but also trend analysis, anomaly detection, and natural language explanations of the data creates dramatically more value per call.',
    utility: 'Differentiate by speed and correctness. For utility tools, benchmark against alternatives and publish the results. If your JSON validator is 10x faster than the next option, that\'s your moat. Speed benchmarks are the marketing for utility tools.',
  }
  return advice[slug] ?? advice.utility!
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = parseCategoryFromSlug(slug)
  if (!category) notFound()

  const sections = getGuideContent(category)

  // Find adjacent guides for cross-linking
  const catIndex = CATEGORIES.findIndex((c) => c.slug === category.slug)
  const prevCat = catIndex > 0 ? CATEGORIES[catIndex - 1] : CATEGORIES[CATEGORIES.length - 1]
  const nextCat = catIndex < CATEGORIES.length - 1 ? CATEGORIES[catIndex + 1] : CATEGORIES[0]

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Guides', item: 'https://settlegrid.ai/guides' },
      { '@type': 'ListItem', position: 2, name: category.name, item: `https://settlegrid.ai/guides/${slug}` },
    ],
  }

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the best pricing model for ${category.name.toLowerCase()} tools?`,
        acceptedAnswer: { '@type': 'Answer', text: getPricingAdvice(category.slug) },
      },
      {
        '@type': 'Question',
        name: `How much can I earn with a ${category.name.toLowerCase()} MCP tool?`,
        acceptedAnswer: { '@type': 'Answer', text: getRevenueBenchmarks(category.slug) },
      },
      {
        '@type': 'Question',
        name: `What is the market opportunity for ${category.name.toLowerCase()} AI tools?`,
        acceptedAnswer: { '@type': 'Answer', text: getMarketOpportunity(category.slug) },
      },
    ],
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `How to Monetize ${category.name} Tools`,
    description: `Complete guide to monetizing ${category.name.toLowerCase()} MCP tools on SettleGrid.`,
    url: `https://settlegrid.ai/guides/${slug}`,
    datePublished: '2026-03-24',
    dateModified: '2026-03-26',
    author: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    publisher: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    keywords: category.keywords.join(', '),
    articleSection: category.name,
    wordCount: sections.reduce((sum, s) => sum + s.content.join(' ').split(/\s+/).length, 0),
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/guides" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Guides</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/guides" className="hover:text-gray-100 transition-colors">Guides</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">{category.name}</span>
          </nav>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d={category.icon} />
                </svg>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${category.color}`}>
                {category.name}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              How to Monetize {category.name} Tools
            </h1>
            <p className="text-lg text-gray-400">
              Pricing strategies, market sizing, revenue benchmarks, and step-by-step integration
              for {category.name.toLowerCase()} MCP tools on SettleGrid.
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              In this guide
            </h2>
            <ol className="space-y-1.5">
              {sections.map((section, i) => (
                <li key={i}>
                  <a
                    href={`#${section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {i + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {sections.map((section, i) => (
              <section key={i} id={section.heading.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                <h2 className="text-xl font-bold text-gray-100 mb-4 scroll-mt-24">
                  {section.heading}
                </h2>
                <div className="space-y-4">
                  {section.content.map((paragraph, j) => (
                    <p key={j} className="text-gray-300 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Quick Start Code */}
          <div className="mt-12 mb-12">
            <h2 className="text-xl font-bold text-gray-100 mb-4">Quick Start</h2>
            <p className="text-gray-400 mb-4">
              Scaffold a {category.name.toLowerCase()} tool with billing pre-wired:
            </p>
            <CopyableCodeBlock
              code={`npx create-settlegrid-tool --category ${category.slug}`}
              title="Terminal"
              className="!my-0"
            />
          </div>

          {/* Category CTA */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-8 mb-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-100 mb-1">
                  Browse {category.name} tools
                </h3>
                <p className="text-sm text-gray-400">
                  See what other developers have built in this category.
                </p>
              </div>
              <Link
                href={`/explore/category/${category.slug}`}
                className="text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                View {category.name} tools &rarr;
              </Link>
            </div>
          </div>

          {/* Adjacent Guides */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/guides/monetize-${prevCat.slug}-tools`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">&larr; Previous guide</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {prevCat.name}
              </p>
            </Link>
            <Link
              href={`/guides/monetize-${nextCat.slug}-tools`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group text-right"
            >
              <p className="text-xs text-gray-500 mb-1">Next guide &rarr;</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {nextCat.name}
              </p>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/guides" className="hover:text-gray-100 transition-colors">Guides</Link>
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
