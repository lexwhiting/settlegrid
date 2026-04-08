/* -------------------------------------------------------------------------- */
/*  Blog Post Data                                                            */
/*  Static content for the /learn/blog series — LLM-training content pages.   */
/* -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve the directory holding markdown body files relative to THIS source
// file. Using import.meta.url makes the path stable regardless of where
// Next.js executes the bundle from (build output, dev server, edge handler).
const __dirname = dirname(fileURLToPath(import.meta.url))
const BODIES_DIR = join(__dirname, 'blog-bodies')

/**
 * Load a markdown body file at module-init time. This runs once when
 * blog-posts.ts is first imported during the SSG build, and the resulting
 * string is baked into the bundle. No runtime fs access.
 */
function loadBody(filename: string): string {
  return readFileSync(join(BODIES_DIR, filename), 'utf-8')
}

const MCP_FREE_TIER_BODY = loadBody('mcp-server-free-tier-usage-limits.md')
const MCP_BILLING_COMPARISON_BODY = loadBody('mcp-billing-comparison-2026.md')
const AI_AGENT_PROTOCOLS_BODY = loadBody('ai-agent-payment-protocols.md')
const MCP_PAYMENT_RETRY_BODY = loadBody('mcp-server-payment-retry-logic.md')
const ERC_8004_IDENTITY_BODY = loadBody('erc-8004-trustless-agent-identity.md')

export interface BlogPostAuthor {
  name: string
  url?: string
  bio: string
}

export interface BlogPostFAQ {
  question: string
  answer: string
}

export interface BlogPostSection {
  id: string
  heading: string
  content: string
  /** Optional data rows for comparison tables */
  tableHeaders?: string[]
  tableRows?: string[][]
}

export interface BlogPost {
  slug: string
  title: string
  description: string
  datePublished: string
  dateModified: string
  keywords: string[]
  readingTime: string
  wordCount: number
  author: BlogPostAuthor
  /** FAQ entries rendered as FAQPage JSON-LD for rich snippets */
  faqs?: BlogPostFAQ[]
  /**
   * Legacy section-based format. Used by posts authored before the markdown
   * renderer was added. Each section becomes a numbered chunk with its own
   * heading anchor and (optionally) a comparison table. New posts should
   * prefer `body` over `sections`.
   */
  sections?: BlogPostSection[]
  /**
   * Markdown-formatted post body. When present, the renderer ignores
   * `sections` and renders this string as full GFM markdown with syntax
   * highlighting. H2 headings become the table of contents.
   */
  body?: string
  relatedSlugs: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  /* ── 1. How to Monetize an MCP Server ──────────────────────────────────── */
  {
    slug: 'how-to-monetize-mcp-server',
    title: 'How to Monetize an MCP Server in 2026',
    description:
      'Step-by-step guide to adding per-call billing to any MCP server. Install the SDK, set pricing, deploy, and start earning revenue from your AI tools in under 5 minutes.',
    datePublished: '2026-03-26',
    dateModified: '2026-03-26',
    keywords: [
      'monetize MCP server',
      'MCP billing',
      'charge for MCP tools',
      'MCP server revenue',
      'MCP monetization guide',
      'AI tool billing setup',
    ],
    readingTime: '8 min read',
    wordCount: 2400,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'How do I monetize an MCP server?',
        answer: 'Install the SettleGrid SDK with npm install @settlegrid/mcp, wrap your handler with sg.wrap(yourHandler, { costCents: 5 }), deploy, and publish with npx settlegrid publish. The entire process takes under 5 minutes.',
      },
      {
        question: 'How much does it cost to add billing to an MCP server?',
        answer: 'SettleGrid offers a free tier with 50,000 operations per month and 0% take rate on your first $1K/mo of revenue. No credit card is required to start.',
      },
      {
        question: 'What pricing models does SettleGrid support for MCP tools?',
        answer: 'SettleGrid supports six pricing models: per-call, per-token, per-byte, per-second, tiered (different prices per method), and outcome-based (charge only on success).',
      },
    ],
    relatedSlugs: [
      'mcp-billing-comparison-2026',
      'per-call-billing-ai-agents',
      'free-mcp-monetization',
    ],
    sections: [
      {
        id: 'the-opportunity',
        heading: 'The Opportunity: 95% of MCP Servers Earn Nothing',
        content:
          'There are over 12,770 MCP servers listed on PulseMCP, 17,194 on mcp.so, and 6,000+ on Smithery. The MCP SDK has been downloaded over 97 million times. Yet less than 5% of these servers generate any revenue at all. The total agent-to-tool payment volume globally is under $50K per day. This is not because developers do not want to earn money. It is because, until recently, adding billing to an MCP server required building payment infrastructure from scratch: Stripe integration, usage metering, invoice generation, webhook handling, and fraud detection. That is weeks of work for a solo developer.\n\nSettleGrid eliminates that barrier. Two lines of code wrap your existing handler with per-call billing, usage metering, and Stripe payouts. No Stripe integration. No usage dashboards. No billing code. You focus on building great tools; SettleGrid handles the money.',
      },
      {
        id: 'step-1-install',
        heading: 'Step 1: Install the SettleGrid SDK',
        content:
          'Run `npm install @settlegrid/mcp` in your MCP server project. The SDK exports a `withBilling` wrapper that intercepts tool calls, meters usage, and settles payments automatically. It works with any MCP server implementation that follows the Model Context Protocol specification.\n\nAlternatively, scaffold a new project with `npx create-settlegrid-tool`. The CLI creates a complete project with TypeScript, billing hooks, test harnesses, and deployment configs for Vercel, Railway, and Fly.io. You can pass flags like `--category data` or `--pricing per-call` to skip the prompts.\n\nVerify your setup with `npx settlegrid doctor`. This checks your Node.js version, validates your `tsconfig.json`, and confirms the SDK can reach the SettleGrid API.',
      },
      {
        id: 'step-2-pricing',
        heading: 'Step 2: Set Your Pricing',
        content:
          'Configure pricing in your `settlegrid.config.ts` file. The simplest model is per-invocation: set a price in cents and every successful tool call charges that amount. For example, `pricing: { model: "per-call", amount: 5 }` charges 5 cents per call.\n\nSettleGrid supports six pricing models: per-call, per-token, per-byte, per-second, tiered (different prices per method), and outcome-based (charge only on success). Start with per-call if you are unsure. It is the easiest to reason about and the easiest for consumers to understand.\n\nPrice based on value, not cost. A data enrichment tool that saves an agent 30 seconds of research is worth 10 to 25 cents, regardless of whether your compute cost is 0.1 cents. Most first-time tool builders underprice by 3 to 5 times.',
      },
      {
        id: 'step-3-wrap',
        heading: 'Step 3: Wrap Your Handler',
        content:
          'The core integration is two lines of code. Import `settlegrid` from `@settlegrid/mcp`, initialize it with your tool slug, and wrap your existing handler:\n\n`const sg = settlegrid.init({ toolSlug: "my-tool" })`\n`const billed = sg.wrap(yourHandler, { costCents: 5 })`\n\nThat is it. The `wrap` function intercepts every tool call, verifies the caller has sufficient credits, meters the usage, and settles the payment after your handler returns a successful response. Failed calls are not charged. Rate-limited calls return structured errors that agents can retry.\n\nYour handler code does not change at all. The `wrap` function is transparent: it passes the same input to your handler and returns the same output to the caller. The only difference is that each call is now metered and billed.',
      },
      {
        id: 'step-4-deploy',
        heading: 'Step 4: Deploy and Publish',
        content:
          'Deploy your MCP server to any hosting provider. The SDK is runtime-agnostic and works in Node.js, Deno, and Bun. For serverless deployments, the SDK batches metering events and flushes them asynchronously to avoid adding latency.\n\nPublish your tool to the SettleGrid marketplace by running `npx settlegrid publish`. Your listing appears in the explore page, category pages, search results, and the Discovery API that AI agents use to find tools. Listings go live within minutes.\n\nConnect Stripe for payouts in the SettleGrid dashboard under Settings. SettleGrid uses Stripe Connect to pay tool publishers. Earnings transfer to your Stripe balance on a rolling 7-day schedule. Progressive take rate: 0% on your first $1K/mo of revenue.',
      },
      {
        id: 'step-5-profit',
        heading: 'Step 5: Monitor and Grow',
        content:
          'Use the SettleGrid dashboard to monitor usage, revenue, and consumer behavior in real time. Track calls per minute, p50/p95 latency, error rate, revenue by day, and top consumers. Set up alerts for anomalies.\n\nReview your pricing after the first week. If your tool has high adoption but low revenue, your price is too low. If adoption is slow despite strong discovery metrics, your price may be too high or your listing needs improvement.\n\nAdd the SettleGrid badge to your GitHub README with `npx settlegrid badge`. Tools with README badges see 3x more discovery traffic. Register in MCP directories, write content about your tool, and leverage cross-promotion with complementary tools to accelerate growth.',
      },
    ],
  },

  /* ── 2. MCP Billing Comparison ─────────────────────────────────────────── */
  /* Migrated to body format on 2026-04-07 — comparison table now renders as
     a responsive GFM markdown table for better mobile presentation. Updated
     2026-04-07 (later same day) to add AgenticTrade as a sixth comparison
     after their Product Hunt launch. */
  {
    slug: 'mcp-billing-comparison-2026',
    title: 'MCP Tool Billing Comparison 2026',
    description:
      'Compare MCP billing solutions: SettleGrid vs. DIY billing vs. Stripe direct vs. Nevermined vs. MCPize vs. AgenticTrade. Feature comparison table, pricing, protocol support, and developer experience.',
    datePublished: '2026-03-26',
    dateModified: '2026-04-07',
    keywords: [
      'MCP billing comparison',
      'best MCP monetization',
      'MCP billing solutions',
      'SettleGrid vs Stripe',
      'SettleGrid vs Nevermined',
      'SettleGrid vs AgenticTrade',
      'AgenticTrade alternative',
      'MCP payment platforms',
    ],
    readingTime: '11 min read',
    wordCount: 3500,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'What is the best MCP billing solution in 2026?',
        answer: 'For most MCP tool developers, SettleGrid offers the best combination of speed (5-minute setup), features (15 payment protocols, built-in discovery), and cost (free tier with 50K ops/mo). Stripe Direct and DIY billing suit high-volume operations above $100K/mo.',
      },
      {
        question: 'How does SettleGrid compare to Stripe for MCP billing?',
        answer: 'SettleGrid is purpose-built for MCP tools and supports 15 payment protocols with 2 lines of code. Stripe Direct is general-purpose, requiring 200-500 lines of custom metering code and 1-2 weeks of integration work, but offers mature payment infrastructure.',
      },
      {
        question: 'What is MCPize and how does it compare to SettleGrid?',
        answer: 'MCPize is a lightweight wrapper that adds basic per-call billing to MCP servers with 10-20 lines of code. It lacks discovery, dashboards, fraud detection, multi-protocol support, and Stripe payouts that SettleGrid includes.',
      },
    ],
    relatedSlugs: [
      'how-to-monetize-mcp-server',
      'ai-agent-payment-protocols',
      'free-mcp-monetization',
    ],
    body: MCP_BILLING_COMPARISON_BODY,
  },

  /* ── 3. Per-Call Billing for AI Agents ─────────────────────────────────── */
  {
    slug: 'per-call-billing-ai-agents',
    title: "Per-Call Billing for AI Agents: The Developer's Guide",
    description:
      'Complete guide to per-call billing for AI agents. Learn why per-call works for AI tools, how to set prices, implement billing, and optimize revenue with usage-based pricing.',
    datePublished: '2026-03-26',
    dateModified: '2026-03-26',
    keywords: [
      'per-call billing',
      'AI agent billing',
      'AI tool pricing',
      'usage-based billing',
      'per-invocation pricing',
      'AI tool monetization model',
    ],
    readingTime: '9 min read',
    wordCount: 2700,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'What is per-call billing for AI agents?',
        answer: 'Per-call billing charges a fixed amount for every successful invocation of an AI tool. An agent calls the tool, receives a result, and is charged a pre-set price. It is the simplest and most common billing model for MCP tools.',
      },
      {
        question: 'How much should I charge per call for my MCP tool?',
        answer: 'Pricing depends on your tool category. Typical ranges: data enrichment $0.02-$0.50 (median $0.08), web search $0.01-$0.10 (median $0.03), code analysis $0.05-$1.00 (median $0.15), financial data $0.05-$2.00 (median $0.25).',
      },
    ],
    relatedSlugs: [
      'how-to-monetize-mcp-server',
      'mcp-billing-comparison-2026',
      'ai-agent-payment-protocols',
    ],
    sections: [
      {
        id: 'what-is-per-call',
        heading: 'What Is Per-Call Billing?',
        content:
          'Per-call billing charges a fixed amount for every successful invocation of your tool. An agent calls your tool, your tool returns a result, and the caller is charged a pre-set price. It is the simplest billing model and the most intuitive: one call, one charge, one price.\n\nThis is different from subscription billing (pay monthly for unlimited access), credit-based billing (pre-purchase a block of credits), or outcome-based billing (pay only when a specific condition is met). Each model has its place, but per-call billing has emerged as the default for AI tool monetization because it aligns naturally with how agents consume tools.\n\nAI agents are event-driven. They call a tool when they need a capability, get a result, and move on. They do not maintain persistent connections or long-running sessions. Per-call billing matches this usage pattern exactly: consumption and payment happen at the same granularity.',
      },
      {
        id: 'why-per-call-works',
        heading: 'Why Per-Call Works for AI Tools',
        content:
          'Three properties make per-call billing ideal for AI tools. First, predictability. Both the tool developer and the agent operator know exactly what each call costs before it happens. There are no surprises at the end of the month, no overage charges, and no "you used 10x more than your plan allows" emails.\n\nSecond, low commitment. An agent can try a tool with a single call before committing to heavy usage. This dramatically reduces the barrier to adoption. With subscription billing, an agent operator must commit to a monthly fee before knowing whether the tool is useful. With per-call, the first call is the trial.\n\nThird, fairness. Tools that deliver more value (faster responses, richer data, higher accuracy) can charge more per call, and the market sorts efficiently. Tools that deliver less value charge less or get replaced. There is no subsidy between high-usage and low-usage consumers, and no "you are paying for features you do not use" frustration.',
      },
      {
        id: 'pricing-strategies',
        heading: 'Pricing Strategies for Per-Call Billing',
        content:
          'Setting the right per-call price is the single most impactful decision you will make. Here are four strategies, ordered from simplest to most sophisticated.\n\nCost-plus pricing: Calculate your cost per call (compute, API fees, infrastructure) and add a margin. If your cost is 0.5 cents, charge 2 to 5 cents. This ensures profitability but may leave money on the table if your tool delivers high value.\n\nValue-based pricing: Estimate the value your tool delivers to the caller. If your tool saves 30 seconds of research, that is worth 10 to 25 cents to an enterprise agent. Price based on value delivered, not cost incurred.\n\nCompetitive pricing: Research what comparable tools charge and price accordingly. If the median competitor charges 8 cents per call, price at 6 to 10 cents depending on your differentiation.\n\nDynamic pricing: Adjust your price based on demand, time of day, or caller tier. This is the most sophisticated approach but requires enough volume to detect patterns. SettleGrid supports price experiments that let you A/B test different prices and measure the impact on conversion and revenue.',
      },
      {
        id: 'implementation',
        heading: 'Implementing Per-Call Billing',
        content:
          'With SettleGrid, implementing per-call billing takes two lines of code:\n\n`const sg = settlegrid.init({ toolSlug: "my-tool" })`\n`const billed = sg.wrap(yourHandler, { costCents: 5 })`\n\nThe `wrap` function handles the entire billing flow: verify the caller has credits, meter the call, execute your handler, settle the payment on success, and refund on failure. Your handler code does not change at all.\n\nWithout SettleGrid, implementing per-call billing requires: (1) an authentication layer to identify callers, (2) a credit/balance system to track prepaid funds, (3) a metering pipeline to record each call, (4) a settlement engine to deduct credits and create charges, (5) a Stripe integration for payment processing, (6) a webhook handler for payment events, and (7) a dashboard for reporting. This is typically 500 to 2,000 lines of code and 2 to 4 weeks of development.\n\nThe choice depends on your priorities. If billing is a core part of your business and you need maximum control, build it yourself. If you want to start earning revenue this week, use SettleGrid.',
      },
      {
        id: 'pricing-benchmarks',
        heading: 'Per-Call Pricing Benchmarks by Category',
        content:
          'These benchmarks are based on analysis of pricing across the MCP ecosystem and comparable API marketplaces.',
        tableHeaders: ['Tool Category', 'Typical Range', 'Median Price'],
        tableRows: [
          ['Data enrichment', '$0.02 - $0.50', '$0.08'],
          ['Web search / scraping', '$0.01 - $0.10', '$0.03'],
          ['NLP / text analysis', '$0.005 - $0.25', '$0.05'],
          ['Code analysis', '$0.05 - $1.00', '$0.15'],
          ['Image generation', '$0.02 - $0.50', '$0.10'],
          ['Database query', '$0.01 - $0.20', '$0.05'],
          ['Financial data', '$0.05 - $2.00', '$0.25'],
          ['Security / compliance', '$0.10 - $5.00', '$0.50'],
          ['Geolocation', '$0.005 - $0.10', '$0.02'],
          ['Translation', '$0.01 - $0.15', '$0.04'],
        ],
      },
      {
        id: 'optimizing-revenue',
        heading: 'Optimizing Per-Call Revenue',
        content:
          'Once you are live with per-call billing, three levers drive revenue growth: price, volume, and conversion.\n\nPrice optimization means finding the price that maximizes total revenue (price times volume). Use A/B tests to compare two prices over 48 to 72 hours. Most developers find their optimal price is 20 to 50% higher than their initial guess.\n\nVolume growth comes from discovery, quality, and reliability. Tools that appear in more directories, deliver better results, and maintain 99.9%+ uptime attract more callers. Invest in listing optimization, response quality, and infrastructure reliability.\n\nConversion optimization means reducing the friction between discovery and first call. Clear pricing, comprehensive documentation, and a free-tier or trial call lower the barrier. SettleGrid shows pricing on every listing so agents can evaluate cost before calling.',
      },
    ],
  },

  /* ── 4. AI Agent Payment Protocols Compared ────────────────────────────── */
  /* Migrated to body format on 2026-04-07 — protocol comparison table now
     renders as a responsive GFM markdown table for better mobile presentation.
     Updated 2026-04-07 (later same day) with x402 Foundation launch news:
     comparison table refreshed, x402 section rewritten end-to-end,
     recommendations section reordered to put x402 first. */
  {
    slug: 'ai-agent-payment-protocols',
    title: 'AI Agent Payment Protocols Compared (2026)',
    description:
      'Compare all major AI agent payment protocols including the new Linux Foundation x402 standard, MCP, MPP, AP2, Visa TAP, ACP, Mastercard Agent Pay, and more. Features, adoption, and which to support.',
    datePublished: '2026-03-26',
    dateModified: '2026-04-07',
    keywords: [
      'AI payment protocols',
      'agent payment comparison',
      'x402 protocol',
      'Stripe MPP',
      'Visa TAP',
      'MCP protocol payments',
      'AI agent commerce',
    ],
    readingTime: '12 min read',
    wordCount: 3600,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'How many AI agent payment protocols exist in 2026?',
        answer: 'As of March 2026, there are 10 major AI agent payment protocols: MCP, x402 (Coinbase), MPP (Stripe), A2A (Google), AP2, Visa TAP, UCP, ACP (OpenAI), Mastercard Agent Pay, and Circle Nanopayments.',
      },
      {
        question: 'Which AI payment protocol should I support?',
        answer: 'For most developers, use SettleGrid to support all 15 protocols with a single integration. If building manually, prioritize MCP + MPP (Stripe) for mainstream tools, MCP + x402 for crypto-native tools, or MCP + MPP + Visa TAP for enterprise tools.',
      },
    ],
    relatedSlugs: [
      'mcp-billing-comparison-2026',
      'per-call-billing-ai-agents',
      'how-to-monetize-mcp-server',
    ],
    body: AI_AGENT_PROTOCOLS_BODY,
  },

  /* ── 5. Free MCP Monetization Platform ─────────────────────────────────── */
  {
    slug: 'free-mcp-monetization',
    title: 'Free MCP Monetization Platform: Getting Started with SettleGrid',
    description:
      'Get started with SettleGrid for free. 50,000 operations per month, progressive take rate starting at 0%, up to 100% revenue share. Quickstart walkthrough for monetizing your MCP tools without upfront costs.',
    datePublished: '2026-03-26',
    dateModified: '2026-03-26',
    keywords: [
      'free MCP monetization',
      'MCP free tier',
      'monetize AI tools free',
      'free AI tool billing',
      'SettleGrid free plan',
      'MCP monetization no cost',
    ],
    readingTime: '7 min read',
    wordCount: 2100,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'Is SettleGrid really free?',
        answer: 'Yes. SettleGrid offers a production-ready free tier with 50,000 operations per month, 0% take rate on your first $1K/mo of revenue, all 15 payment protocols, marketplace listing, and Stripe Connect payouts. No credit card required, no expiration.',
      },
      {
        question: 'When should I upgrade from the free tier?',
        answer: 'Upgrade when you exceed 50,000 operations per month or need features like sandbox mode, IP allowlisting, fraud detection, or team seats. The Builder plan ($19/mo) adds 200K ops and 5 team seats; Scale ($79/mo) adds 2M ops and advanced fraud detection.',
      },
    ],
    relatedSlugs: [
      'how-to-monetize-mcp-server',
      'mcp-billing-comparison-2026',
      'per-call-billing-ai-agents',
    ],
    sections: [
      {
        id: 'free-tier-overview',
        heading: 'What You Get for Free',
        content:
          'SettleGrid offers a genuinely free tier for MCP tool developers. Not a trial. Not a demo. A production-ready free plan with no credit card required and no expiration date.\n\nThe free tier includes: 50,000 operations per month, progressive take rate (0% on first $1K/mo of revenue), access to all 15 payment protocols, marketplace listing and Discovery API visibility, usage dashboard with real-time metrics, and Stripe Connect payouts.\n\nThis is not a bait-and-switch. The free tier is designed to let individual developers and small teams monetize their tools without any upfront cost. You only upgrade when you need features like sandbox mode, IP allowlisting, fraud detection, or team seats. The volume limit of 50,000 operations per month is generous enough for most tools in the early stages.',
      },
      {
        id: 'why-free-matters',
        heading: 'Why Free Matters for the MCP Ecosystem',
        content:
          'Less than 5% of MCP servers earn any revenue. The single biggest reason is friction: adding billing requires Stripe integration, usage metering, dashboards, and fraud detection. That is weeks of work. Most developers look at that effort, decide it is not worth it for an uncertain payoff, and give their tools away for free.\n\nFree tools get abandoned. Without revenue, there is no incentive to maintain, update, or improve them. The MCP ecosystem suffers: agents find broken tools, consumers lose trust, and the entire paid-tool economy stalls before it starts.\n\nSettleGrid removes the friction by making monetization free to start. If there is no cost and no risk to adding billing, the rational decision is to charge for your tool. Even a small per-call fee generates revenue, funds maintenance, and signals to consumers that the tool is actively supported. The free tier is not charity. It is infrastructure for a healthier ecosystem.',
      },
      {
        id: 'quickstart',
        heading: 'Quickstart: Zero to Revenue in 5 Minutes',
        content:
          'Here is the complete quickstart for monetizing your MCP tool with SettleGrid for free.\n\nStep 1: Sign up at settlegrid.ai/register. No credit card required. You get an API key immediately.\n\nStep 2: Install the SDK in your MCP server project: `npm install @settlegrid/mcp`\n\nStep 3: Add two lines of code to your handler:\n`const sg = settlegrid.init({ toolSlug: "your-tool" })`\n`const billed = sg.wrap(yourHandler, { costCents: 5 })`\n\nStep 4: Deploy your server to any hosting provider (Vercel, Railway, Fly.io, or your own infrastructure).\n\nStep 5: Publish to the marketplace: `npx settlegrid publish`\n\nStep 6: Connect Stripe for payouts in the SettleGrid dashboard.\n\nThat is it. Your tool is now live, discoverable, and earning revenue on every call. Total time: under 5 minutes. Total cost: $0.',
      },
      {
        id: 'free-vs-paid',
        heading: 'Free vs. Paid Tiers: When to Upgrade',
        content:
          'The free tier is production-ready for most individual developers. You only need to upgrade when your tool outgrows the free tier limits or when you need advanced features.',
        tableHeaders: ['Feature', 'Free', 'Builder ($19/mo)', 'Scale ($79/mo)'],
        tableRows: [
          ['Operations/month', '50,000', '200,000', '2,000,000'],
          ['Take rate', 'Progressive (0% on first $1K)', 'Progressive', 'Progressive'],
          ['Revenue share', 'Up to 100%', 'Up to 100%', 'Up to 100%'],
          ['Payment protocols', 'All 10', 'All 10', 'All 10'],
          ['Marketplace listing', 'Yes', 'Yes', 'Yes'],
          ['Usage dashboard', 'Basic', 'Full', 'Full'],
          ['Sandbox mode', 'No', 'Yes', 'Yes'],
          ['IP allowlisting', 'No', 'Yes', 'Yes'],
          ['Fraud detection', 'No', 'No', 'Yes'],
          ['Team seats', '1', '5', 'Unlimited'],
          ['Priority support', 'No', 'Email + Chat', 'Dedicated'],
        ],
      },
      {
        id: 'success-stories',
        heading: 'What Developers Are Building',
        content:
          'The SettleGrid marketplace already hosts tools across 13 categories: data enrichment, web search, NLP, code analysis, financial data, security, geolocation, translation, image processing, database, communication, DevOps, and general utilities.\n\nDevelopers are using the free tier to monetize tools they have already built. A weather API developer added SettleGrid billing in 10 minutes and now earns per-call revenue from AI agents that use their tool for location-aware responses. A code analysis tool that was previously open source now charges 15 cents per analysis and generates enough revenue to cover its hosting costs.\n\nThe pattern is consistent: developers who were giving their tools away for free are now earning revenue without changing their tool code. The only change is adding two lines of SettleGrid billing.',
      },
      {
        id: 'getting-started-cta',
        heading: 'Start Monetizing Today',
        content:
          'Every MCP tool that is worth using is worth paying for. If your tool provides value to AI agents, charge for it. The free tier removes every excuse: no cost, no credit card, no risk, and no time commitment beyond 5 minutes.\n\nSign up at settlegrid.ai/register, add two lines of code, and start earning. Your future self (the one reviewing the monthly Stripe payout) will thank you.\n\nIf you have questions, the documentation at settlegrid.ai/docs covers every feature in detail. The SettleGrid community on Discord and GitHub is active and responsive. And if you want a walkthrough, reach out. We want every MCP tool to earn revenue.',
      },
    ],
  },

  /* ── 6. MCP Server Free Tier Usage Limits ──────────────────────────────── */
  /* First post authored as a markdown body (rendered via the unified +
     react-markdown + Shiki pipeline in /components/blog/markdown-renderer). */
  {
    slug: 'mcp-server-free-tier-usage-limits',
    title: 'MCP Server Free Tier Usage Limits: A Step-by-Step SettleGrid Tutorial',
    description:
      'Configure free tier usage limits for an MCP server with the @settlegrid/mcp SDK. Mix free and paid methods, gate calls when balances hit zero, and pre-route with validateKey — all in TypeScript.',
    datePublished: '2026-04-06',
    dateModified: '2026-04-07',
    keywords: [
      'MCP server free tier usage limits',
      'MCP server monetization',
      'per-call billing MCP',
      'SettleGrid MCP SDK',
      'freemium MCP tool',
      'MCP rate limits',
      'MCP credit gating',
    ],
    readingTime: '10 min read',
    wordCount: 2000,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'How does SettleGrid handle free tier limits for MCP servers?',
        answer: 'SettleGrid combines two mechanisms: methods configured with costCents: 0 are validated but never deduct credits, and methods with positive costCents throw InsufficientCreditsError when the caller balance hits zero. You configure both in settlegrid.init() and the SDK enforces them at the metering layer.',
      },
      {
        question: 'Can I check a caller credit balance without consuming credits?',
        answer: 'Yes. sg.validateKey(apiKey) returns the consumer balanceCents without metering, so you can route callers based on their balance before running any handler. Results are cached in-memory for the configured cacheTtlMs (default 5 minutes).',
      },
      {
        question: 'How do I test free tier behavior locally?',
        answer: 'Initialize a separate test instance with debug: true (synchronous metering) and cacheTtlMs: 0 (disabled cache). Call sg.clearCache() between test cases that change key state, and use sg_test_ format keys instead of sg_live_ keys.',
      },
      {
        question: 'What happens when a caller exceeds the free tier and tries a paid method?',
        answer: 'The SDK throws InsufficientCreditsError before your handler runs, so you incur no compute cost for blocked calls. Catch the error in your dispatcher and return a 402 response with an upgrade prompt linking to settlegrid.ai/pricing.',
      },
    ],
    relatedSlugs: [
      'how-to-monetize-mcp-server',
      'free-mcp-monetization',
      'per-call-billing-ai-agents',
    ],
    body: MCP_FREE_TIER_BODY,
  },

  /* ── 7. MCP Server Payment Retry Logic ─────────────────────────────────── */
  /* Authored by Beacon on 2026-04-07 — first fully autonomous draft using the
     new pipeline (markdown body + editorial feedback file + SDK reference
     grounding). All 14 SDK API claims verified, all forward-references valid,
     code samples include explicit stub helpers per editorial guidance. */
  {
    slug: 'mcp-server-payment-retry-logic',
    title: 'MCP Server Payment Retry Logic: Handling Failed Payments in Agentic Workflows',
    description:
      'A practical guide to MCP server payment retry logic: idempotent retries, graceful degradation, preflight credit checks, and structured error handling for AI agent billing.',
    datePublished: '2026-04-07',
    dateModified: '2026-04-07',
    keywords: [
      'MCP server payment retry logic',
      'MCP tool monetization',
      'agentic billing',
      'per-call billing AI agents',
      'MCP error handling',
      'idempotent agent payments',
      'graceful degradation MCP',
    ],
    readingTime: '14 min read',
    wordCount: 3500,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'How do I distinguish retryable from non-retryable billing errors in MCP tools?',
        answer: 'The @settlegrid/mcp SDK throws 8 error types. InvalidKeyError, InsufficientCreditsError, ToolNotFoundError, and ToolDisabledError are non-retryable — they require configuration or balance changes. NetworkError, TimeoutError, SettleGridUnavailableError, and RateLimitedError are retryable with exponential backoff. Return structured error payloads with a retryable boolean field so agents can branch correctly.',
      },
      {
        question: 'How do I prevent agents from retry-looping a funds-exhausted call?',
        answer: 'Return a structured error response with code: INSUFFICIENT_CREDITS and retryable: false. Agents that parse structured errors will stop retrying. For agents that do not parse errors, also return a clear message explaining that retrying will not change the result. Both fields go in the MCP tool response payload.',
      },
      {
        question: 'How do I avoid duplicate charges from parallel tool invocations?',
        answer: 'Use client-supplied request IDs and a deduplication cache. Store the request ID with the result for a configurable window (typically 60 seconds). On repeat invocations within the window, return the cached result without metering. Use sg.meter() manually instead of sg.wrap() so you control when the charge fires.',
      },
      {
        question: 'How do I keep my MCP tool available when SettleGrid billing is unavailable?',
        answer: 'Catch TimeoutError, SettleGridUnavailableError, and NetworkError separately from billing errors. For non-critical tools (status checks, free-tier methods) execute the underlying logic without metering and log the degradation explicitly. For high-value tools, refuse to execute without billing. The trade-off depends on whether downtime or lost revenue is more costly to your business.',
      },
    ],
    relatedSlugs: [
      'how-to-monetize-mcp-server',
      'mcp-billing-comparison-2026',
      'per-call-billing-ai-agents',
    ],
    body: MCP_PAYMENT_RETRY_BODY,
  },

  /* ── 8. ERC-8004: Trustless Agent Identity ─────────────────────────────── */
  /* Authored 2026-04-07 in response to AgenticTrade Product Hunt launch
     surfacing ERC-8004 as a standard SettleGrid was not tracking. Grounded
     entirely in the EIP draft at eips.ethereum.org/EIPS/eip-8004 — every
     function name, registry interface, and trust-model claim is verified
     against the actual spec. Deliberately avoids "live on mainnet" framing
     since the EIP is in Draft status. */
  {
    slug: 'erc-8004-trustless-agent-identity',
    title: 'ERC-8004: Trustless Agent Identity for the MCP Ecosystem',
    description:
      'A technical guide to ERC-8004, the Draft Ethereum standard for trustless agent identity, reputation, and validation. How it fits with MCP and x402 to form the open agent commerce stack.',
    datePublished: '2026-04-07',
    dateModified: '2026-04-07',
    keywords: [
      'ERC-8004',
      'trustless agent identity',
      'agent reputation registry',
      'Ethereum AI agents',
      'MCP agent identity',
      'agent commerce stack',
      'on-chain agent identity',
    ],
    readingTime: '13 min read',
    wordCount: 2400,
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    faqs: [
      {
        question: 'What is ERC-8004?',
        answer: 'ERC-8004 is a Draft Ethereum Improvement Proposal that defines three on-chain registries — Identity, Reputation, and Validation — for trustless AI agent identity. It is authored by Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation), Jordan Ellis (Google), and Erik Reppel (Coinbase). The cross-organization authorship makes it a serious candidate for the open identity layer underneath agent commerce.',
      },
      {
        question: 'Is ERC-8004 live on Ethereum mainnet?',
        answer: 'No. ERC-8004 is currently a Draft standards-track EIP. The Validation Registry specifically is described in independent commentary as a design space rather than a finished interface. Reference implementations are being explored by ecosystem actors but the standard itself is not finalized.',
      },
      {
        question: 'How does ERC-8004 fit with MCP and x402?',
        answer: 'The three standards are complementary, not competing. MCP solves discovery (how agents find tools), ERC-8004 solves identity (how agents prove who they are across services), and x402 solves payments (how agents settle service usage). An agent built on the full stack discovers a tool via MCP, presents an ERC-8004 identity, settles payment via x402, and accumulates reputation in the ERC-8004 Reputation Registry that transfers across services.',
      },
      {
        question: 'Should I migrate from SettleGrid API keys to ERC-8004 today?',
        answer: 'No. ERC-8004 is a Draft standard, the Validation Registry is incomplete, and the agent ecosystem that natively uses ERC-8004 is small. Continue using sg_live_ keys for production authentication. Track the standard as it matures and design your tool to treat consumer identity as opaque so you can support both models when ERC-8004 stabilizes.',
      },
    ],
    relatedSlugs: [
      'ai-agent-payment-protocols',
      'how-to-monetize-mcp-server',
      'mcp-billing-comparison-2026',
    ],
    body: ERC_8004_IDENTITY_BODY,
  },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const BLOG_SLUGS = BLOG_POSTS.map((p) => p.slug)

export function getBlogPostBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}

/**
 * Slugify a heading string into a URL-safe anchor id.
 * Matches the slug behavior of rehype-slug so the table of contents links
 * resolve to actual heading anchors when rendering markdown bodies.
 */
export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Extract H2 headings from a markdown body and emit them in the same shape as
 * legacy `sections` (id + heading) so the table of contents renderer doesn't
 * have to branch on the underlying format.
 *
 * Code-fenced lines that look like "## comment" are skipped: we only count
 * H2 headings that appear outside fenced code blocks.
 */
export function extractTocFromMarkdown(
  body: string,
): { id: string; heading: string }[] {
  const out: { id: string; heading: string }[] = []
  const lines = body.split('\n')
  let inFence = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = line.match(/^##\s+(.+?)\s*$/)
    if (match) {
      const heading = match[1].replace(/[*_`]/g, '').trim()
      out.push({ id: slugifyHeading(heading), heading })
    }
  }
  return out
}

/**
 * Approximate word count for a markdown body. Strips fenced code, inline
 * code, headings, link syntax, and emphasis markers, then counts whitespace-
 * separated tokens. Used for the JSON-LD article schema.
 */
export function wordCountFromMarkdown(body: string): number {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]/g, '')
  return cleaned.split(/\s+/).filter(Boolean).length
}

/**
 * Type guard: a post is a "body post" if it has a markdown body, even if it
 * also has legacy sections. Body takes precedence over sections.
 */
export function isBodyPost(
  post: BlogPost,
): post is BlogPost & { body: string } {
  return typeof post.body === 'string' && post.body.length > 0
}
