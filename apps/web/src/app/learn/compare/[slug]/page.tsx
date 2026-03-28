import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Comparison data for each slug                                             */
/* -------------------------------------------------------------------------- */

interface FeatureRow {
  feature: string
  settlegrid: string
  competitor: string
}

interface ComparisonData {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  competitorName: string
  introParagraph: string
  features: FeatureRow[]
  settlegridPros: string[]
  competitorPros: string[]
  verdict: string
}

interface MultiComparisonData {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  introParagraph: string
  platforms: {
    name: string
    revenueShare: string
    pricingModels: string
    protocols: string
    freeTier: string
    hosting: string
    sdkLines: string
    latency: string
  }[]
  settlegridPros: string[]
  verdict: string
}

const multiComparisons: Record<string, MultiComparisonData> = {
  'mcp-billing-platforms-2026': {
    slug: 'mcp-billing-platforms-2026',
    title: 'MCP Billing Platforms Compared 2026',
    metaTitle: 'Best MCP Monetization Platform 2026 — All Platforms Compared | SettleGrid',
    metaDescription:
      'The definitive comparison of MCP billing and monetization platforms in 2026. SettleGrid, Nevermined, MCPize, Paid.ai, Moesif, Masumi, and PaidMCP compared across revenue share, pricing models, protocols, and more.',
    introParagraph:
      'The MCP ecosystem is maturing fast, and developers have more options than ever for monetizing their AI tools. But the platforms differ dramatically in revenue share, pricing flexibility, protocol support, and developer experience. This is the definitive comparison of every major MCP monetization platform in 2026 — so you can choose the right one for your use case.',
    platforms: [
      {
        name: 'SettleGrid',
        revenueShare: 'Up to 100%',
        pricingModels: '6 (per-call, per-token, per-byte, per-second, tiered, outcome)',
        protocols: '10 (MCP, x402, MPP, A2A, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle)',
        freeTier: '50K ops/mo, progressive rate',
        hosting: 'Bring your own',
        sdkLines: '2 lines',
        latency: '<50ms',
      },
      {
        name: 'Nevermined',
        revenueShare: '93.5\u201399%',
        pricingModels: '2 (per-call, credits)',
        protocols: '2 (x402, A2A)',
        freeTier: 'Limited free tier',
        hosting: 'Bring your own',
        sdkLines: 'SDK + config',
        latency: 'On-chain',
      },
      {
        name: 'MCPize',
        revenueShare: '85%',
        pricingModels: '2 (per-call, subscription)',
        protocols: '1 (MCP)',
        freeTier: 'No',
        hosting: 'Managed (MCPize hosts)',
        sdkLines: 'Upload + configure',
        latency: 'Variable',
      },
      {
        name: 'Paid.ai',
        revenueShare: 'Not disclosed',
        pricingModels: '1 (outcome-based)',
        protocols: '1 (MCP)',
        freeTier: 'No',
        hosting: 'Managed',
        sdkLines: 'SDK + dashboard',
        latency: 'Not disclosed',
      },
      {
        name: 'Moesif',
        revenueShare: 'N/A (analytics fee)',
        pricingModels: '3 (per-call, subscription, usage-based)',
        protocols: '1 (REST)',
        freeTier: '100K events/mo',
        hosting: 'Bring your own',
        sdkLines: '10\u201320 lines',
        latency: 'Async',
      },
      {
        name: 'Masumi',
        revenueShare: 'Not disclosed',
        pricingModels: '1 (per-call)',
        protocols: '1 (A2A)',
        freeTier: 'No',
        hosting: 'On-chain (Cardano)',
        sdkLines: 'Smart contracts',
        latency: 'On-chain',
      },
      {
        name: 'PaidMCP',
        revenueShare: '~90%',
        pricingModels: '1 (per-call)',
        protocols: '1 (MCP)',
        freeTier: 'No',
        hosting: 'Proxy',
        sdkLines: 'Config file',
        latency: 'Proxy overhead',
      },
    ],
    settlegridPros: [
      'Highest revenue share in category (up to 100%)',
      'Most pricing model flexibility (6 models vs 1\u20133 for competitors)',
      'Broadest protocol support (15 protocols vs 1\u20132 for competitors)',
      'Only platform with a truly free tier (50K ops/mo with progressive take rate)',
      'Fastest metering latency (sub-50ms Redis)',
      '2-line SDK integration \u2014 simplest developer experience',
      'Bring-your-own-hosting \u2014 no vendor lock-in',
    ],
    verdict:
      'SettleGrid leads across every dimension that matters for MCP tool monetization in 2026: revenue share (up to 100% with progressive take rates), pricing flexibility, protocol coverage, free tier (50K ops/mo), and developer experience. If you are choosing a platform to monetize AI tools, SettleGrid is the most comprehensive option available. The free tier means you can start today with zero cost and zero risk.',
  },
}

const comparisons: Record<string, ComparisonData> = {
  'vs-diy': {
    slug: 'vs-diy',
    title: 'SettleGrid vs Building Your Own AI Billing',
    metaTitle: 'SettleGrid vs Building Your Own AI Billing | SettleGrid',
    metaDescription:
      'Compare SettleGrid to building your own per-call billing system. Setup time, metering, payouts, fraud detection, and total cost of ownership.',
    competitorName: 'DIY',
    introParagraph:
      'Every developer who monetizes an AI tool faces the same question: build or buy? Building your own billing infrastructure means wiring up metering, balance management, Stripe Connect payouts, fraud detection, and budget enforcement from scratch. SettleGrid replaces all of that with two lines of code. Here is a detailed breakdown of what each path involves.',
    features: [
      { feature: 'Setup time', settlegrid: '2 lines of code', competitor: '2\u20134 weeks' },
      { feature: 'Per-call metering', settlegrid: '<50ms Redis', competitor: 'Build from scratch' },
      { feature: 'Credit balance management', settlegrid: 'Built-in', competitor: 'Build from scratch' },
      { feature: 'Stripe Connect payouts', settlegrid: 'Automatic', competitor: 'Manual integration' },
      { feature: 'Fraud detection', settlegrid: '12 signals', competitor: 'Build from scratch' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'Build from scratch' },
      { feature: 'Multi-protocol support', settlegrid: '15 protocols', competitor: 'One at a time' },
      { feature: 'Maintenance burden', settlegrid: 'Zero', competitor: 'Ongoing' },
      { feature: 'Cost', settlegrid: '$0\u201379/mo', competitor: 'Engineering time' },
    ],
    settlegridPros: [
      'Ship monetization in minutes instead of weeks',
      'Battle-tested metering and fraud detection out of the box',
      'Automatic payouts without Stripe Connect boilerplate',
      'Free tier with 50K operations per month and progressive take rate',
    ],
    competitorPros: [
      'Full control over every implementation detail',
      'No external dependency for billing logic',
      'May make sense at extreme scale with a dedicated billing team',
    ],
    verdict:
      'For the vast majority of AI tool developers, building your own billing is a distraction from building your product. SettleGrid handles the undifferentiated heavy lifting so you can focus on what makes your tool valuable. The free tier means you can start without any cost, and the time saved pays for itself many times over.',
  },
  'vs-nevermined': {
    slug: 'vs-nevermined',
    title: 'SettleGrid vs Nevermined',
    metaTitle:
      'SettleGrid vs Nevermined: AI Agent Payment Platforms Compared | SettleGrid',
    metaDescription:
      'Feature-by-feature comparison of SettleGrid and Nevermined for AI agent payments. Protocols, metering speed, pricing, and SDK simplicity.',
    competitorName: 'Nevermined',
    introParagraph:
      'Both SettleGrid and Nevermined enable payments between AI agents. Nevermined focuses on crypto-native, on-chain settlement via x402 and A2A protocols. SettleGrid takes a protocol-agnostic approach, supporting 15 payment protocols with sub-50ms Redis metering and both fiat and crypto settlement. Here is how they compare across key dimensions.',
    features: [
      { feature: 'Take rate', settlegrid: '0\u20135% (progressive)', competitor: '1\u20136.5%' },
      { feature: 'Protocol support', settlegrid: '15 protocols', competitor: 'x402 / A2A' },
      { feature: 'Metering speed', settlegrid: '<50ms Redis', competitor: 'On-chain' },
      { feature: 'SDK simplicity', settlegrid: '2 lines of code', competitor: 'SDK + config' },
      { feature: 'Fiat support', settlegrid: 'Yes (Stripe)', competitor: 'Limited' },
      { feature: 'Crypto support', settlegrid: 'Yes (x402/USDC)', competitor: 'Yes (Base/Polygon)' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Free tier', settlegrid: '50K ops, progressive rate', competitor: 'Limited free' },
    ],
    settlegridPros: [
      'Supports 15 protocols (MCP, x402, AP2, MPP, Visa TAP, UCP, and more)',
      'Sub-50ms metering for real-time per-call billing',
      'Works with fiat and crypto out of the box',
      'Budget enforcement prevents runaway agent spending',
    ],
    competitorPros: [
      'Deep crypto-native integration with Base and Polygon',
      'Strong on-chain auditability',
      'Purpose-built for the x402 ecosystem',
    ],
    verdict:
      'Choose Nevermined if your use case is purely crypto-native and on-chain settlement is a requirement. Choose SettleGrid if you need fiat support, broader protocol coverage, sub-50ms metering, or budget enforcement. Most developers shipping AI tools today need all of these, which is why SettleGrid covers a wider set of real-world scenarios.',
  },
  'vs-stripe': {
    slug: 'vs-stripe',
    title: 'SettleGrid vs Stripe Billing for AI Tools',
    metaTitle: 'SettleGrid vs Stripe Billing for AI Tools | SettleGrid',
    metaDescription:
      'Compare SettleGrid to Stripe Billing for AI tool monetization. Per-call metering, MCP support, agent identity, budget enforcement, and setup complexity.',
    competitorName: 'Stripe Billing',
    introParagraph:
      'Stripe is the gold standard for online payments and works brilliantly for SaaS subscriptions. But AI tools have fundamentally different billing needs: per-call metering, real-time balance checks, agent identity, and multi-hop settlement. SettleGrid is purpose-built for this world. Here is a side-by-side comparison.',
    features: [
      { feature: 'Per-call metering', settlegrid: 'Built-in <50ms', competitor: 'Build yourself' },
      { feature: 'Real-time balance checks', settlegrid: 'Atomic Redis', competitor: 'Build yourself' },
      { feature: 'MCP support', settlegrid: 'Native SDK', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'x402 / crypto', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Setup for AI billing', settlegrid: '2 lines of code', competitor: 'Weeks of development' },
    ],
    settlegridPros: [
      'Purpose-built for per-call AI tool billing',
      'Native MCP and multi-protocol support',
      'Real-time atomic balance checks and budget enforcement',
      'Agent identity (Know Your Agent) built in',
    ],
    competitorPros: [
      'Industry-leading payment processing reliability',
      'Best-in-class subscription billing',
      'Massive ecosystem of integrations',
      'Well-suited for traditional SaaS products',
    ],
    verdict:
      'Stripe is an incredible platform, and SettleGrid actually uses Stripe Connect under the hood for fiat settlement. The difference is that SettleGrid adds the AI-specific layer on top: per-call metering, real-time budget enforcement, MCP support, and agent identity. If you are billing for AI tool usage, SettleGrid saves you from building that entire layer yourself on top of Stripe.',
  },
  'vs-mcpize': {
    slug: 'vs-mcpize',
    title: 'SettleGrid vs MCPize',
    metaTitle: 'SettleGrid vs MCPize: MCP Monetization Platforms Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and MCPize for MCP tool monetization. Revenue share, hosting model, protocol support, pricing flexibility, and developer experience.',
    competitorName: 'MCPize',
    introParagraph:
      'MCPize is a hosted marketplace that deploys, hosts, and monetizes your MCP server for you. SettleGrid is an SDK and infrastructure layer that lets you monetize any AI service while hosting wherever you want. The core difference: MCPize is a managed marketplace (85% revenue share), while SettleGrid is infrastructure you own (up to 100% revenue share with progressive take rates). Here is a detailed comparison.',
    features: [
      { feature: 'Revenue share', settlegrid: 'Up to 100%', competitor: '85%' },
      { feature: 'Hosting model', settlegrid: 'Bring your own', competitor: 'MCPize hosts for you' },
      { feature: 'Protocol support', settlegrid: '15 protocols', competitor: 'MCP only' },
      { feature: 'Pricing models', settlegrid: '6 models', competitor: 'Per-call + subscription' },
      { feature: 'Discovery / marketplace', settlegrid: 'Discovery API + showcase', competitor: 'Built-in marketplace' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, progressive rate', competitor: 'No' },
      { feature: 'Vendor lock-in', settlegrid: 'None (self-hosted)', competitor: 'High (MCPize hosts)' },
      { feature: 'SDK integration', settlegrid: '2 lines of code', competitor: 'Upload + configure' },
    ],
    settlegridPros: [
      'Keep up to 100% of revenue (progressive take rate) vs 85% on MCPize',
      'Host anywhere \u2014 no vendor lock-in to a single marketplace',
      '15 payment protocols vs MCP-only on MCPize',
      '6 pricing models (per-call, per-token, per-byte, per-second, tiered, outcome)',
      'Free tier with 50K ops/month and progressive take rate',
    ],
    competitorPros: [
      'Zero infrastructure to manage \u2014 MCPize deploys and hosts your server',
      'Built-in marketplace with consumer discovery',
      'Simple onboarding for developers who want a fully managed experience',
    ],
    verdict:
      'MCPize is a good choice if you want a fully managed marketplace experience and are willing to give up 15% of revenue for the convenience. SettleGrid is the better choice if you want to maximize revenue (up to 100% with progressive take rates vs 85%), support multiple protocols beyond MCP, or maintain control over your hosting and infrastructure. For most developers, the revenue difference adds up quickly.',
  },
  'vs-paid-ai': {
    slug: 'vs-paid-ai',
    title: 'SettleGrid vs Paid.ai',
    metaTitle: 'SettleGrid vs Paid.ai: AI Tool Monetization Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and Paid.ai for AI tool billing. Pricing model flexibility, protocol support, revenue share, free tier, and SDK simplicity.',
    competitorName: 'Paid.ai',
    introParagraph:
      'Paid.ai, founded by Manny Medina (Outreach founder) with $21M in seed funding, focuses on outcome-based billing for AI tools \u2014 you only pay when the AI delivers results. SettleGrid supports outcome-based billing AND five other pricing models, across 15 payment protocols. Here is how they compare.',
    features: [
      { feature: 'Pricing models', settlegrid: '6 models', competitor: 'Outcome-based only' },
      { feature: 'Protocol support', settlegrid: '15 protocols', competitor: 'MCP' },
      { feature: 'Revenue share', settlegrid: 'Up to 100%', competitor: 'Not disclosed' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, progressive rate', competitor: 'No' },
      { feature: 'SDK integration', settlegrid: '2 lines of code', competitor: 'SDK + dashboard' },
      { feature: 'Metering latency', settlegrid: '<50ms', competitor: 'Not disclosed' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
    ],
    settlegridPros: [
      'Supports 6 pricing models: per-call, per-token, per-byte, per-second, tiered, AND outcome-based',
      '15 payment protocols vs MCP-only on Paid.ai',
      'Transparent progressive take rate (0-5%) with a free tier at 50K ops/mo',
      'Sub-50ms metering latency for real-time billing',
      'Budget enforcement and agent identity built in',
    ],
    competitorPros: [
      'Laser-focused on outcome-based billing \u2014 strong narrative for results-based AI',
      'Well-funded ($21M seed) with experienced founder (Manny Medina)',
      'Simple mental model: pay only when AI delivers results',
    ],
    verdict:
      'If your use case is exclusively outcome-based billing and nothing else, Paid.ai has a compelling story. But most AI tools need flexible pricing \u2014 a search tool charges per call, an LLM proxy charges per token, a compute service charges per second. SettleGrid supports all six pricing models including outcomes, plus 15 payment protocols, a free tier, and transparent revenue sharing. For developers who want maximum flexibility, SettleGrid is the more complete platform.',
  },
  'vs-moesif': {
    slug: 'vs-moesif',
    title: 'SettleGrid vs Moesif',
    metaTitle: 'SettleGrid vs Moesif: API Monetization Platforms Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and Moesif for API and AI tool monetization. MCP-native support, integration complexity, metering latency, pricing models, and free tier.',
    competitorName: 'Moesif',
    introParagraph:
      'Moesif (acquired by WSO2) is an API analytics platform that has added billing and monetization features. SettleGrid is purpose-built for AI tool monetization with an MCP-native SDK. The key difference: Moesif is analytics-first adding billing; SettleGrid is billing-first with analytics. Here is a detailed breakdown.',
    features: [
      { feature: 'Primary focus', settlegrid: 'AI tool billing', competitor: 'API analytics' },
      { feature: 'MCP-native support', settlegrid: 'Yes (native SDK)', competitor: 'No' },
      { feature: 'Integration complexity', settlegrid: '2 lines of code', competitor: '10\u201320 lines + dashboard config' },
      { feature: 'Pricing models', settlegrid: '6 models', competitor: '3 (per-call, subscription, usage)' },
      { feature: 'Protocol support', settlegrid: '15 protocols', competitor: 'REST only' },
      { feature: 'Metering latency', settlegrid: '<50ms (synchronous)', competitor: 'Async (analytics pipeline)' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, progressive rate', competitor: '100K events/mo (analytics only)' },
      { feature: 'Budget enforcement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Revenue share', settlegrid: 'Up to 100%', competitor: 'N/A (analytics fee model)' },
    ],
    settlegridPros: [
      'Purpose-built for AI tool monetization, not retrofitted from analytics',
      'MCP-native SDK \u2014 2-line integration vs 10\u201320 lines for Moesif',
      '15 payment protocols including MCP, x402, and A2A',
      'Sub-50ms synchronous metering vs async analytics pipeline',
      'Budget enforcement and agent identity built in',
    ],
    competitorPros: [
      'Deep API analytics with user behavior insights and funnel analysis',
      'Mature product with years of iteration on API observability',
      'Backed by WSO2 ecosystem (API gateway, identity server)',
      'Better suited if your primary need is analytics with billing as a secondary feature',
    ],
    verdict:
      'Moesif is an excellent API analytics platform that happens to do billing. SettleGrid is a purpose-built AI billing platform that happens to do analytics. If your primary need is deep API observability with billing as an add-on, Moesif is a solid choice. If your primary need is monetizing AI tools with the simplest possible integration, MCP-native support, and real-time metering, SettleGrid is the right platform. Most AI tool developers prioritize billing over analytics, which is why SettleGrid is the better fit.',
  },
  'vs-stripe-metronome': {
    slug: 'vs-stripe-metronome',
    title: 'SettleGrid vs Stripe Metronome',
    metaTitle: 'SettleGrid vs Stripe Metronome: Usage-Based Billing for AI Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and Stripe Metronome (acquired by Stripe for $1B) for AI service billing. Setup time, pricing models, discovery, protocol support, and take rate.',
    competitorName: 'Stripe Metronome',
    introParagraph:
      'Stripe acquired Metronome for $1 billion, signaling how critical usage-based billing has become. Metronome is enterprise-grade usage-based billing designed for complex pricing at scale. SettleGrid is purpose-built for the AI economy: a 2-line SDK with progressive pricing, AI-native discovery and metering, and support for 15 payment protocols. Both platforms handle usage-based billing, but they serve very different worlds.',
    features: [
      { feature: 'Setup time', settlegrid: '2 lines of code', competitor: 'Weeks (enterprise onboarding)' },
      { feature: 'Pricing models', settlegrid: '6 (per-call, per-token, per-byte, per-second, tiered, outcome)', competitor: 'Usage-based (custom metering events)' },
      { feature: 'AI tool discovery', settlegrid: 'Built-in marketplace + Discovery API', competitor: 'No' },
      { feature: 'Protocol support', settlegrid: '15 protocols (MCP, x402, AP2, A2A, etc.)', competitor: 'Stripe ecosystem only' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, $0 forever', competitor: 'No (enterprise pricing)' },
      { feature: 'Take rate', settlegrid: '0\u20135% progressive', competitor: 'Stripe fees + Metronome platform fee' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Budget enforcement', settlegrid: 'Real-time, per-agent', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Target market', settlegrid: 'AI tool developers (indie to scale)', competitor: 'Enterprise SaaS companies' },
    ],
    settlegridPros: [
      '2-line SDK integration vs weeks of enterprise onboarding for Metronome',
      'Progressive take rate starting at 0% on first $1K/mo \u2014 free to start',
      '15 payment protocols including crypto (x402) and agent-native (A2A, AP2)',
      'Built-in AI tool discovery marketplace and showcase',
      'Agent identity, budget enforcement, and multi-hop settlement for agent-to-agent workflows',
      'Purpose-built for AI service billing, not adapted from SaaS billing',
    ],
    competitorPros: [
      'Backed by Stripe \u2014 $1B acquisition validates the usage-based billing market',
      'Enterprise-grade infrastructure with proven reliability at massive scale',
      'Deep Stripe ecosystem integration (Billing, Connect, Revenue Recognition)',
      'Custom metering and complex pricing logic for enterprise contracts',
      'Strong fit for traditional SaaS companies with complex usage-based pricing',
    ],
    verdict:
      'Stripe Metronome is an exceptional choice for enterprise SaaS companies that need complex usage-based billing within the Stripe ecosystem. But if you are building AI tools, agent services, or MCP servers, SettleGrid is purpose-built for your world: a 2-line SDK, 15 payment protocols, AI-native discovery, progressive pricing starting at 0%, and agent-specific features like budget enforcement and multi-hop settlement. Metronome bills for SaaS usage. SettleGrid settles AI service calls.',
  },
  'vs-orb': {
    slug: 'vs-orb',
    title: 'SettleGrid vs Orb',
    metaTitle: 'SettleGrid vs Orb: Usage-Based Billing for AI Tools Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and Orb for AI service billing. Event-based metering, protocol support, pricing flexibility, discovery marketplace, and developer experience.',
    competitorName: 'Orb',
    introParagraph:
      'Orb is a powerful usage-based billing platform built around event-based metering. Backed by $44M in funding, Orb serves companies like Vercel and Replit with flexible, SQL-defined pricing. SettleGrid is purpose-built for AI service settlement: a 2-line SDK with multi-protocol support, AI-native discovery, progressive pricing, and agent-specific features. Both platforms excel at usage-based billing, but for different ecosystems.',
    features: [
      { feature: 'Setup time', settlegrid: '2 lines of code', competitor: 'Days (event schema + plan config)' },
      { feature: 'Pricing definition', settlegrid: 'Declarative (slug + price)', competitor: 'SQL-based (flexible but complex)' },
      { feature: 'AI tool discovery', settlegrid: 'Built-in marketplace + Discovery API', competitor: 'No' },
      { feature: 'Protocol support', settlegrid: '15 protocols (MCP, x402, AP2, A2A, etc.)', competitor: 'REST webhooks' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, $0 forever', competitor: 'No (enterprise pricing)' },
      { feature: 'Take rate', settlegrid: '0\u20135% progressive', competitor: 'Platform fee (not disclosed)' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Budget enforcement', settlegrid: 'Real-time, per-agent', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Metering latency', settlegrid: '<50ms (synchronous Redis)', competitor: 'Event ingestion (async)' },
    ],
    settlegridPros: [
      '2-line SDK vs days of event schema and plan configuration for Orb',
      'Progressive take rate starting at 0% \u2014 no platform fees until you earn over $1K/mo',
      '10 AI payment protocols vs REST-only webhooks on Orb',
      'Built-in AI tool discovery marketplace and developer showcase',
      'Sub-50ms synchronous metering vs async event ingestion',
      'Agent-native features: identity, budget enforcement, multi-hop settlement',
    ],
    competitorPros: [
      'Extremely flexible SQL-based pricing \u2014 can model almost any billing logic',
      'Well-funded ($44M) with enterprise customers like Vercel and Replit',
      'Mature invoicing, revenue recognition, and billing automation',
      'Strong fit for complex B2B SaaS with custom pricing per contract',
      'Detailed usage analytics and real-time dashboards',
    ],
    verdict:
      'Orb is an outstanding billing platform for B2B SaaS companies with complex, custom pricing that need SQL-level flexibility in defining their billing logic. But if you are monetizing AI tools, MCP servers, or agent services, SettleGrid is built specifically for that: 2 lines of code, 15 payment protocols, a discovery marketplace, progressive pricing from 0%, and agent-native features like budget enforcement. Orb bills for SaaS events. SettleGrid settles AI service calls.',
  },
  'vs-lago': {
    slug: 'vs-lago',
    title: 'SettleGrid vs Lago',
    metaTitle: 'SettleGrid vs Lago: Usage-Based Billing for AI Compared | SettleGrid',
    metaDescription:
      'Compare SettleGrid and Lago for AI tool monetization. Open-source vs managed, protocol support, discovery marketplace, infrastructure requirements, and pricing.',
    competitorName: 'Lago',
    introParagraph:
      'Lago is an open-source usage-based billing platform that can be self-hosted or used as a cloud service. It is a strong choice for companies that want full control over their billing infrastructure. SettleGrid is a managed platform purpose-built for AI service settlement: zero infrastructure to manage, 15 payment protocols, AI-native discovery, and a 2-line SDK. The core question: do you want to run billing infrastructure, or ship AI tools?',
    features: [
      { feature: 'Setup time', settlegrid: '2 lines of code', competitor: 'Hours\u2013days (self-host) or minutes (cloud)' },
      { feature: 'Infrastructure', settlegrid: 'Fully managed, zero ops', competitor: 'Self-hosted (Postgres, Redis, Sidekiq) or cloud' },
      { feature: 'AI tool discovery', settlegrid: 'Built-in marketplace + Discovery API', competitor: 'No' },
      { feature: 'Protocol support', settlegrid: '15 protocols (MCP, x402, AP2, A2A, etc.)', competitor: 'REST API events' },
      { feature: 'Free tier', settlegrid: '50K ops/mo, $0 forever', competitor: 'Open-source (free self-hosted)' },
      { feature: 'Take rate', settlegrid: '0\u20135% progressive', competitor: 'Cloud pricing or self-host costs' },
      { feature: 'Agent identity (KYA)', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Budget enforcement', settlegrid: 'Real-time, per-agent', competitor: 'No' },
      { feature: 'Multi-hop settlement', settlegrid: 'Yes', competitor: 'No' },
      { feature: 'Source code', settlegrid: 'Open-source SDK', competitor: 'Fully open-source (AGPL)' },
    ],
    settlegridPros: [
      'Zero infrastructure to manage \u2014 no Postgres, Redis, or Sidekiq to operate',
      '2-line SDK vs deploying and maintaining a billing microservice',
      '10 AI payment protocols including crypto and agent-native protocols',
      'Built-in AI tool discovery marketplace and developer showcase',
      'Agent-native features: identity, budget enforcement, multi-hop settlement',
      'Progressive take rate starting at 0% \u2014 aligned incentives (SettleGrid earns when you earn)',
    ],
    competitorPros: [
      'Fully open-source (AGPL) \u2014 complete control over code and data',
      'Self-hostable \u2014 run on your own infrastructure with no external dependencies',
      'No take rate on self-hosted \u2014 only your infrastructure costs',
      'Flexible event-based metering with custom aggregation',
      'Good fit for teams with DevOps capacity who want full billing control',
    ],
    verdict:
      'Lago is an excellent choice if you have the DevOps capacity to run your own billing infrastructure and want complete control over the source code. But most AI tool developers do not want to become billing infrastructure operators. SettleGrid lets you skip that entirely: 2 lines of code, zero infrastructure, 15 payment protocols, a discovery marketplace, and AI-specific features like agent identity and budget enforcement. If your goal is to monetize AI tools quickly, SettleGrid gets you there faster with less operational burden.',
  },
}

const allSlugs = [...Object.keys(comparisons), ...Object.keys(multiComparisons)]

/* -------------------------------------------------------------------------- */
/*  Static params + metadata                                                  */
/* -------------------------------------------------------------------------- */

export function generateStaticParams() {
  return allSlugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = comparisons[slug]
  const multi = multiComparisons[slug]
  const entry = data ?? multi
  if (!entry) return { title: 'Comparison Not Found | SettleGrid' }

  const keywords: string[] = []
  if (slug === 'mcp-billing-platforms-2026') {
    keywords.push('best MCP monetization platform', 'MCP billing comparison 2026', 'MCP monetization platforms compared')
  }
  if (slug === 'vs-mcpize') {
    keywords.push('SettleGrid vs MCPize', 'MCPize alternative', 'MCP marketplace comparison')
  }
  if (slug === 'vs-paid-ai') {
    keywords.push('SettleGrid vs Paid.ai', 'Paid.ai alternative', 'outcome-based AI billing')
  }
  if (slug === 'vs-moesif') {
    keywords.push('SettleGrid vs Moesif', 'Moesif alternative', 'API monetization comparison')
  }
  if (slug === 'vs-stripe-metronome') {
    keywords.push('SettleGrid vs Stripe Metronome', 'Stripe Metronome alternative', 'AI usage-based billing', 'Metronome billing comparison')
  }
  if (slug === 'vs-orb') {
    keywords.push('SettleGrid vs Orb', 'Orb billing alternative', 'usage-based billing AI tools', 'Orb comparison')
  }
  if (slug === 'vs-lago') {
    keywords.push('SettleGrid vs Lago', 'Lago alternative', 'open-source billing comparison', 'Lago vs SettleGrid')
  }

  return {
    title: entry.metaTitle,
    description: entry.metaDescription,
    alternates: { canonical: `https://settlegrid.ai/learn/compare/${slug}` },
    ...(keywords.length > 0 ? { keywords } : {}),
    openGraph: {
      title: entry.metaTitle,
      description: entry.metaDescription,
      type: 'article',
      siteName: 'SettleGrid',
    },
    twitter: {
      card: 'summary_large_image',
      title: entry.metaTitle,
      description: entry.metaDescription,
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function CheckIcon() {
  return (
    <svg
      className="w-5 h-5 text-amber-400 mx-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-label="Yes"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      className="w-5 h-5 text-red-400 mx-auto"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-label="No"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

/** Render a cell value — show a check/x if the value is exactly Yes/No, otherwise show text. */
function CellValue({ value, isSettleGrid }: { value: string; isSettleGrid: boolean }) {
  if (value === 'Yes') return <CheckIcon />
  if (value === 'No') return <XIcon />
  return (
    <span className={isSettleGrid ? 'text-gray-100 font-medium' : 'text-gray-400'}>
      {value}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  JSON-LD helpers                                                           */
/* -------------------------------------------------------------------------- */

function buildArticleJsonLd(title: string, description: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    author: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    publisher: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    url: `https://settlegrid.ai/learn/compare/${slug}`,
    datePublished: '2026-03-26',
    dateModified: '2026-03-26',
  }
}

function buildBreadcrumbJsonLd(slug: string, title: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://settlegrid.ai' },
      { '@type': 'ListItem', position: 2, name: 'Comparisons', item: 'https://settlegrid.ai/learn/compare' },
      { '@type': 'ListItem', position: 3, name: title, item: `https://settlegrid.ai/learn/compare/${slug}` },
    ],
  }
}

/* -------------------------------------------------------------------------- */
/*  Multi-comparison page component                                           */
/* -------------------------------------------------------------------------- */

function MultiComparisonContent({ data }: { data: MultiComparisonData }) {
  const jsonLdArticle = buildArticleJsonLd(data.title, data.metaDescription, data.slug)
  const jsonLdBreadcrumb = buildBreadcrumbJsonLd(data.slug, data.title)

  const columns = ['Platform', 'Revenue Share', 'Pricing Models', 'Protocols', 'Free Tier', 'Hosting', 'SDK Lines', 'Latency'] as const
  const columnKeys = ['name', 'revenueShare', 'pricingModels', 'protocols', 'freeTier', 'hosting', 'sdkLines', 'latency'] as const

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-gray-100 transition-colors">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/learn/compare" className="hover:text-gray-100 transition-colors">Comparisons</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-100">{data.slug}</li>
        </ol>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6">{data.title}</h1>
      <p className="text-lg text-gray-400 leading-relaxed mb-12 max-w-3xl">{data.introParagraph}</p>

      {/* ---- Full Matrix Table ---- */}
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="MCP billing platforms feature matrix">
            <thead>
              <tr className="border-b border-[#2A2D3E]">
                {columns.map((col) => (
                  <th key={col} className={`text-left font-medium px-4 py-4 whitespace-nowrap ${col === 'Platform' ? 'text-gray-400' : 'text-gray-400'}`}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.platforms.map((platform, i) => (
                <tr
                  key={platform.name}
                  className={`${i < data.platforms.length - 1 ? 'border-b border-[#252836]' : ''} ${platform.name === 'SettleGrid' ? 'bg-amber-500/5' : ''}`}
                >
                  {columnKeys.map((key) => (
                    <td key={key} className={`px-4 py-4 ${platform.name === 'SettleGrid' ? 'text-gray-100 font-medium' : 'text-gray-400'} ${key === 'name' ? 'font-semibold whitespace-nowrap' : ''}`}>
                      {platform.name === 'SettleGrid' && key === 'name' ? (
                        <span className="text-amber-400">{platform[key]}</span>
                      ) : (
                        platform[key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Why SettleGrid ---- */}
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-12">
        <h2 className="text-lg font-semibold text-amber-400 mb-4">Why SettleGrid Leads</h2>
        <ul className="space-y-3">
          {data.settlegridPros.map((pro) => (
            <li key={pro} className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              <span className="text-gray-300 leading-relaxed">{pro}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---- Verdict ---- */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">The Verdict</h2>
        <p className="text-gray-400 leading-relaxed max-w-3xl">{data.verdict}</p>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  1-vs-1 comparison content component                                       */
/* -------------------------------------------------------------------------- */

function SingleComparisonContent({ data }: { data: ComparisonData }) {
  const jsonLdArticle = buildArticleJsonLd(data.title, data.metaDescription, data.slug)
  const jsonLdBreadcrumb = buildBreadcrumbJsonLd(data.slug, data.title)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-gray-100 transition-colors">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/learn/compare" className="hover:text-gray-100 transition-colors">Comparisons</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-100">{data.slug}</li>
        </ol>
      </nav>

      <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6">{data.title}</h1>
      <p className="text-lg text-gray-400 leading-relaxed mb-12 max-w-3xl">{data.introParagraph}</p>

      {/* ---- Comparison Table ---- */}
      <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden mb-12">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label={`Feature comparison: SettleGrid vs ${data.competitorName}`}>
            <thead>
              <tr className="border-b border-[#2A2D3E]">
                <th className="text-left text-gray-400 font-medium px-6 py-4 w-1/3">Feature</th>
                <th className="text-center text-amber-400 font-semibold px-6 py-4 w-1/3">SettleGrid</th>
                <th className="text-center text-gray-400 font-medium px-6 py-4 w-1/3">{data.competitorName}</th>
              </tr>
            </thead>
            <tbody>
              {data.features.map((row, i) => (
                <tr key={row.feature} className={i < data.features.length - 1 ? 'border-b border-[#252836]' : ''}>
                  <td className="px-6 py-4 text-gray-300 font-medium">{row.feature}</td>
                  <td className="px-6 py-4 text-center"><CellValue value={row.settlegrid} isSettleGrid /></td>
                  <td className="px-6 py-4 text-center"><CellValue value={row.competitor} isSettleGrid={false} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Pros Sections ---- */}
      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-amber-400 mb-4">Why SettleGrid</h2>
          <ul className="space-y-3">
            {data.settlegridPros.map((pro) => (
              <li key={pro} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-gray-300 leading-relaxed">{pro}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Why {data.competitorName}</h2>
          <ul className="space-y-3">
            {data.competitorPros.map((pro) => (
              <li key={pro} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="text-gray-400 leading-relaxed">{pro}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ---- Verdict ---- */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">The Verdict</h2>
        <p className="text-gray-400 leading-relaxed max-w-3xl">{data.verdict}</p>
      </section>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = comparisons[slug]
  const multi = multiComparisons[slug]
  if (!data && !multi) notFound()

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={32} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/learn/compare"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Comparisons
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
          {data ? <SingleComparisonContent data={data} /> : <MultiComparisonContent data={multi!} />}

          {/* ---- CTA ---- */}
          <section className="bg-gradient-to-br from-[#161822] to-[#0C0E14] border border-[#2A2D3E] rounded-xl p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold text-gray-100 mb-4">
              Ready to monetize your AI tools?
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Start with the free tier — 50,000 operations per month, progressive
              take rate starting at 0%. No credit card required.
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
