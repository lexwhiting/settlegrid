import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'

/* -------------------------------------------------------------------------- */
/*  Protocol Data                                                             */
/* -------------------------------------------------------------------------- */

interface Protocol {
  slug: string
  name: string
  fullName: string
  backer: string
  status: 'Production' | 'Ready' | 'Testnet' | 'Pending'
  overview: string
  howItWorks: string
  integration: string
  detectionHeader: string
  identityType: string
  paymentType: string
  color: string
  codeExample: string
}

const PROTOCOLS: Protocol[] = [
  {
    slug: 'mcp',
    name: 'MCP',
    fullName: 'Model Context Protocol',
    backer: 'Anthropic',
    status: 'Production',
    overview:
      'MCP is the open standard for connecting AI assistants to external tools and data sources. When Claude, ChatGPT, or any AI assistant needs to search the web, query a database, or call an API, it uses MCP. SettleGrid adds per-call billing to any MCP server with 2 lines of code.',
    howItWorks:
      'An MCP server exposes "tools" — functions that AI assistants can call. When an assistant needs a capability (like web search or code analysis), it discovers available MCP servers and calls their tools with structured arguments. The server processes the request and returns results.\n\nThe protocol uses JSON-RPC 2.0 over stdio or HTTP transports. Each tool declares its name, description, and input schema so that AI models can decide when and how to invoke it. MCP servers can also expose "resources" (read-only data) and "prompts" (reusable templates).\n\nSettleGrid wraps this flow with automatic metering: every tool call is validated, charged, and recorded. The SDK intercepts the JSON-RPC call, checks credits, executes your handler, and meters usage — all before the response is returned to the AI assistant.',
    integration:
      "SettleGrid's SDK wraps your MCP tool handler with billing. The sg.wrap() function intercepts each call, validates the consumer's API key, checks their credit balance, executes your handler, and meters the usage — all in under 50ms. No changes to your tool's logic required. The consumer passes their API key in the MCP _meta field, and SettleGrid handles the rest.",
    detectionHeader: 'x-api-key / _meta.settlegrid-api-key',
    identityType: 'api-key',
    paymentType: 'credit-balance',
    color: 'text-orange-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-web-search',
  pricing: { defaultCostCents: 5 },
})

// Wrap your existing handler — billing is automatic
const search = sg.wrap(async (args: { query: string }) => {
  const results = await searchWeb(args.query)
  return { content: [{ type: 'text', text: JSON.stringify(results) }] }
}, { method: 'search' })`,
  },
  {
    slug: 'mpp',
    name: 'MPP',
    fullName: 'Machine Payments Protocol',
    backer: 'Stripe + Tempo',
    status: 'Production',
    overview:
      'MPP (Machine Payments Protocol) is Stripe and Tempo Labs\' protocol for enabling autonomous machine-to-machine payments. It allows AI agents to pay for services using Stripe-backed payment methods without human intervention, combining Stripe\'s payment infrastructure with Tempo\'s agent orchestration layer.',
    howItWorks:
      'MPP extends Stripe\'s existing payment rails to support autonomous agent transactions. A "model provider" (the AI agent\'s host) registers payment credentials with Stripe, receives an MPP token, and passes it along when the agent calls external services. The service provider verifies the token with Stripe and charges the model provider\'s account.\n\nThe protocol uses Stripe\'s existing infrastructure for settlement, compliance, and dispute resolution. This means developers get Stripe-grade payment processing with full PCI compliance, automatic currency conversion, and established fraud protection.\n\nMPP tokens carry embedded spending limits, expiration times, and scope constraints — so agents can only spend within pre-approved budgets. Every transaction is recorded in the Stripe dashboard alongside regular business payments.',
    integration:
      "SettleGrid acts as an MPP service provider, accepting MPP tokens alongside its native API keys. When an agent presents an MPP token, SettleGrid validates it with Stripe, checks the embedded spending limits, executes your tool, and settles the payment through Stripe's ledger. Your tool receives the same payout via Stripe Connect regardless of whether the consumer used an API key or an MPP token.",
    detectionHeader: 'Authorization: Bearer mpp_*',
    identityType: 'mpp-token',
    paymentType: 'stripe-direct',
    color: 'text-violet-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'data-enrichment',
  pricing: { defaultCostCents: 10 },
  // MPP tokens are accepted automatically
  // alongside standard sg_live_* API keys
})

const enrich = sg.wrap(async (args: { domain: string }) => {
  const company = await lookupCompany(args.domain)
  return { content: [{ type: 'text', text: JSON.stringify(company) }] }
}, { method: 'enrich' })`,
  },
  {
    slug: 'x402',
    name: 'x402',
    fullName: 'HTTP 402 Payment Required',
    backer: 'Coinbase',
    status: 'Production',
    overview:
      'x402 is Coinbase\'s open protocol for machine-to-machine payments using the HTTP 402 status code. When an AI agent hits a paid endpoint, it receives a 402 response with on-chain payment instructions. The agent pays with USDC, and the server verifies the payment before serving the response. SettleGrid is the first x402 facilitator that adds metering, budgets, and analytics on top.',
    howItWorks:
      'The x402 flow begins when an AI agent sends a request to a paid endpoint without a payment header. The server responds with HTTP 402 and a JSON body specifying the price, accepted tokens (USDC, USDT), chain IDs, and a payment address. The agent constructs an on-chain transaction, signs it, and resends the request with the payment proof in a custom header.\n\nThe server verifies the on-chain payment (checking amount, recipient, and confirmation status) before processing the request. This creates a trustless, permissionless payment channel between any two machines on the internet.\n\nSettleGrid extends x402 with credit-based budgets, rate limiting, and analytics. Instead of raw on-chain verification on every call, consumers can pre-fund a credit balance with USDC and SettleGrid handles the metering. This reduces gas costs and latency while maintaining the crypto-native payment model.',
    integration:
      "SettleGrid supports x402 natively. When a consumer's agent sends an x402 payment header, SettleGrid verifies the on-chain transaction, credits the developer's balance, and meters the invocation. Developers receive payouts in fiat via Stripe Connect or in USDC — regardless of how the consumer paid. Three API endpoints handle the flow: /api/x402/verify, /api/x402/settle, and /api/x402/supported.",
    detectionHeader: 'X-402-Payment / X-Payment-*',
    identityType: 'wallet-address',
    paymentType: 'on-chain (USDC/USDT)',
    color: 'text-blue-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'blockchain-analytics',
  pricing: { defaultCostCents: 25 },
  // x402 payments are verified automatically
  // Consumer agents pay with USDC on-chain
})

const analyze = sg.wrap(async (args: { address: string }) => {
  const analysis = await analyzeWallet(args.address)
  return { content: [{ type: 'text', text: JSON.stringify(analysis) }] }
}, { method: 'analyze-wallet' })`,
  },
  {
    slug: 'ap2',
    name: 'AP2',
    fullName: 'Agent Payments Protocol',
    backer: 'Google',
    status: 'Ready',
    overview:
      'AP2 is Google\'s Agent Payments protocol that enables AI agents to transact with service providers within Google\'s ecosystem. It provides a credential-based payment framework where agents receive budget-capped credentials from their principals (users or organizations) and spend them autonomously across a network of 180+ partner service providers.',
    howItWorks:
      'In the AP2 model, a "principal" (the user or organization controlling the agent) issues credentials to the agent with embedded spending limits, time constraints, and scope restrictions. When the agent needs to pay for a service, it presents these credentials to the service provider. The provider verifies the credentials with Google\'s AP2 infrastructure, processes the request, and charges the principal\'s account.\n\nAP2 supports delegated authority chains — Agent A can delegate a portion of its budget to Agent B, which can further delegate to Agent C. Each delegation narrows the spending scope, creating a tree of constrained budgets that prevents runaway spending.\n\nThe protocol integrates with Google Pay for consumer-facing payments and Google Cloud Billing for enterprise accounts, giving it access to Google\'s existing payment infrastructure and compliance framework.',
    integration:
      "SettleGrid acts as an AP2 credentials provider. When a Google-ecosystem agent presents AP2 credentials, SettleGrid validates them against Google's AP2 infrastructure, checks the embedded budget cap, executes your tool, and records the charge. Developers do not need to implement any AP2-specific logic — the SettleGrid protocol adapter handles credential verification, budget checking, and settlement transparently.",
    detectionHeader: 'Authorization: AP2 <credential>',
    identityType: 'ap2-credential',
    paymentType: 'delegated-budget',
    color: 'text-green-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'document-analysis',
  pricing: { defaultCostCents: 15 },
  // AP2 credentials are validated automatically
  // Google agents pay via delegated budgets
})

const analyze = sg.wrap(async (args: { documentUrl: string }) => {
  const summary = await analyzeDocument(args.documentUrl)
  return { content: [{ type: 'text', text: summary }] }
}, { method: 'analyze-document' })`,
  },
  {
    slug: 'visa-tap',
    name: 'Visa TAP',
    fullName: 'Token Agent Payments',
    backer: 'Visa',
    status: 'Ready',
    overview:
      'Visa TAP (Token Agent Payments) is Visa\'s protocol for tokenized agent-to-agent payments. It extends Visa\'s tokenization infrastructure to AI agents, allowing them to authenticate and pay for services using Visa-issued tokens with embedded identity verification, spending limits, and merchant category restrictions.',
    howItWorks:
      'Visa TAP builds on Visa\'s existing tokenization platform. An agent\'s principal (the human or organization) requests a TAP token from their Visa-issuing bank. The token carries the agent\'s identity, the cardholder\'s authorization, spending limits, and allowed merchant categories. When the agent calls a service, it presents the TAP token.\n\nThe service provider sends the token to Visa\'s TAP verification endpoint, which confirms the token is valid, the spending limit has not been exceeded, and the merchant category is allowed. If all checks pass, Visa authorizes the transaction and the service processes the request.\n\nSettlement follows standard Visa rails — the cardholder is charged, the merchant receives funds through their acquirer, and Visa\'s dispute resolution process applies. This means every agent payment is backed by the same protections as a regular Visa transaction.',
    integration:
      "SettleGrid supports Visa TAP tokens as an identity type in its KYA (Know Your Agent) system. When an agent presents a TAP token, SettleGrid verifies it with Visa's infrastructure, maps the token to an internal consumer identity, checks credit balance or authorizes a Visa charge, and meters the invocation. Developers receive payouts through Stripe Connect as usual.",
    detectionHeader: 'X-Visa-TAP-Token / Authorization: TAP <token>',
    identityType: 'visa-tap-token',
    paymentType: 'visa-authorization',
    color: 'text-yellow-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'travel-booking',
  pricing: {
    defaultCostCents: 50,
    methods: {
      'search-flights': { costCents: 10 },
      'book-flight': { costCents: 200 },
    },
  },
  // Visa TAP tokens are verified automatically
})

const searchFlights = sg.wrap(async (args: { origin: string; dest: string }) => {
  const flights = await searchFlightAPI(args.origin, args.dest)
  return { content: [{ type: 'text', text: JSON.stringify(flights) }] }
}, { method: 'search-flights' })`,
  },
  {
    slug: 'ucp',
    name: 'UCP',
    fullName: 'Universal Commerce Protocol',
    backer: 'Google + Shopify',
    status: 'Ready',
    overview:
      'UCP (Universal Commerce Protocol) is a joint initiative by Google and Shopify to create a standardized commerce layer for AI agents. It defines how agents discover products, compare prices, negotiate terms, and complete purchases across any merchant — essentially building a universal checkout for the AI economy.',
    howItWorks:
      'UCP defines three phases of an agent commerce transaction: Discovery (the agent queries a UCP-compatible catalog for products/services matching criteria), Negotiation (the agent and merchant exchange offers, counteroffers, and terms using structured UCP messages), and Settlement (the agent commits to a purchase and the payment is processed through the merchant\'s payment provider).\n\nFor AI tool monetization, the "product" is a tool invocation. The agent discovers available tools via UCP catalogs, checks pricing and terms, and initiates a purchase (invocation) using the UCP settlement flow. This creates a catalog-native experience where agents can shop for the best tool at the best price.\n\nUCP supports dynamic pricing, bulk discounts, and subscription models — giving developers more flexibility than simple per-call billing.',
    integration:
      "SettleGrid exposes your tool as a UCP-compatible service. When a UCP agent discovers your tool in the catalog, SettleGrid returns your pricing, terms, and availability. When the agent initiates a purchase, SettleGrid handles the settlement flow, meters the invocation, and records the transaction. Developers get UCP catalog visibility without building any UCP-specific infrastructure.",
    detectionHeader: 'X-UCP-Session / Authorization: UCP <session>',
    identityType: 'ucp-session',
    paymentType: 'ucp-settlement',
    color: 'text-emerald-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'product-research',
  pricing: {
    defaultCostCents: 8,
    methods: {
      'search': { costCents: 3 },
      'compare': { costCents: 8 },
      'deep-analysis': { costCents: 20 },
    },
  },
  // UCP sessions are managed automatically
})

const compare = sg.wrap(async (args: { products: string[] }) => {
  const comparison = await compareProducts(args.products)
  return { content: [{ type: 'text', text: JSON.stringify(comparison) }] }
}, { method: 'compare' })`,
  },
  {
    slug: 'acp',
    name: 'ACP',
    fullName: 'Agentic Commerce Protocol',
    backer: 'OpenAI + Stripe',
    status: 'Ready',
    overview:
      'ACP (Agentic Commerce Protocol) is a joint initiative by OpenAI and Stripe to enable AI agents to purchase goods and services autonomously. It combines OpenAI\'s agent framework with Stripe\'s payment infrastructure to create a seamless commerce layer where agents can discover, evaluate, and pay for services on behalf of their users.',
    howItWorks:
      'ACP defines a three-party model: the Consumer Agent (acting on behalf of a user), the Service Provider (offering a tool or service), and the Payment Facilitator (Stripe). The consumer agent discovers available services through ACP-compatible registries, evaluates them based on price, quality, and trust signals, and initiates a transaction.\n\nWhen the agent decides to purchase, it sends an ACP transaction request containing the service ID, the user\'s payment authorization, and any negotiated terms. Stripe processes the payment, the service provider fulfills the request, and the agent receives the result — all in a single round-trip.\n\nACP includes built-in dispute resolution, refund flows, and trust scoring. Agents build reputation over time based on payment history and behavior, which service providers can use to offer preferential pricing or priority access.',
    integration:
      "SettleGrid integrates with ACP as a service provider. Your tool is registered in ACP-compatible registries with pricing metadata, and when an OpenAI-powered agent initiates a transaction, SettleGrid validates the ACP payment authorization with Stripe, executes your tool, and meters the invocation. Revenue settles through Stripe Connect alongside all other SettleGrid payouts.",
    detectionHeader: 'Authorization: ACP <transaction-id>',
    identityType: 'acp-transaction',
    paymentType: 'stripe-acp',
    color: 'text-teal-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'code-review',
  pricing: {
    defaultCostCents: 30,
    methods: {
      'lint': { costCents: 5 },
      'security-scan': { costCents: 30 },
      'full-review': { costCents: 50 },
    },
  },
  // ACP transactions are validated automatically
})

const securityScan = sg.wrap(async (args: { repoUrl: string }) => {
  const findings = await scanRepository(args.repoUrl)
  return { content: [{ type: 'text', text: JSON.stringify(findings) }] }
}, { method: 'security-scan' })`,
  },
  {
    slug: 'mastercard-agent-pay',
    name: 'Mastercard Agent Pay',
    fullName: 'Mastercard Agent Pay',
    backer: 'Mastercard',
    status: 'Pending',
    overview:
      'Mastercard Agent Pay is Mastercard\'s framework for enabling AI agents to make verified, intent-based payments. It uses Mastercard\'s Verifiable Intent technology to ensure that every agent payment reflects the genuine intent of the human principal, preventing unauthorized or runaway spending by autonomous agents.',
    howItWorks:
      'Mastercard Agent Pay introduces a "Verifiable Intent" layer between the agent and the payment. Before an agent can make a payment, the principal must sign a structured intent document specifying the allowed merchant categories, maximum transaction amount, time window, and geographic restrictions. This intent is cryptographically signed and stored on Mastercard\'s infrastructure.\n\nWhen the agent initiates a payment, it presents the intent document along with the transaction details. Mastercard verifies that the transaction falls within the intent\'s constraints — if the amount exceeds the limit, the merchant category is not allowed, or the time window has expired, the payment is rejected.\n\nThis approach solves the "runaway agent" problem: even if an agent is compromised or malfunctions, it cannot spend beyond what the principal explicitly authorized. Every transaction is logged with a link back to the original intent document for audit purposes.',
    integration:
      "SettleGrid supports Mastercard Agent Pay intents as an authentication method. When an agent presents a Verifiable Intent token, SettleGrid validates it with Mastercard's infrastructure, checks that your tool's merchant category is allowed, verifies the spending limit, and processes the payment. Developers receive payouts through Stripe Connect as with all other protocols.",
    detectionHeader: 'X-MC-Agent-Intent / Authorization: MCAP <intent>',
    identityType: 'mc-verifiable-intent',
    paymentType: 'mastercard-authorization',
    color: 'text-red-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'financial-analysis',
  pricing: {
    defaultCostCents: 40,
    methods: {
      'market-summary': { costCents: 10 },
      'portfolio-analysis': { costCents: 40 },
      'risk-assessment': { costCents: 75 },
    },
  },
  // Mastercard Agent Pay intents are verified automatically
})

const portfolioAnalysis = sg.wrap(async (args: { holdings: string[] }) => {
  const analysis = await analyzePortfolio(args.holdings)
  return { content: [{ type: 'text', text: JSON.stringify(analysis) }] }
}, { method: 'portfolio-analysis' })`,
  },
  {
    slug: 'circle-nanopayments',
    name: 'Circle Nanopayments',
    fullName: 'Circle Nanopayments',
    backer: 'Circle (USDC)',
    status: 'Testnet',
    overview:
      'Circle Nanopayments is Circle\'s infrastructure for sub-cent USDC transactions optimized for AI agent micropayments. It uses payment channels and batched settlement to enable transactions as small as fractions of a cent — making it economical for AI agents to pay per-token, per-byte, or per-millisecond for services.',
    howItWorks:
      'Traditional on-chain transactions have a floor cost (gas fees) that makes sub-cent payments impractical. Circle Nanopayments solves this with payment channels: the consumer opens a channel by depositing USDC into a smart contract, then sends signed payment authorizations (off-chain) for each micro-transaction. The service provider accumulates these authorizations and settles on-chain periodically.\n\nThis amortizes gas costs across thousands of micro-transactions, making per-token pricing (e.g., $0.001 per token) economically viable. Channels can be topped up, and settlement frequency is configurable — from real-time to daily batches.\n\nCircle provides the USDC infrastructure, smart contract templates, and SDKs for both the payer and payee. The protocol is designed specifically for high-frequency, low-value transactions like AI inference, data streaming, and API calls.',
    integration:
      "SettleGrid supports Circle Nanopayments as a payment method for consumers who prefer USDC micropayments. When a consumer opens a nanopayment channel, SettleGrid manages the channel state, accumulates payment authorizations per tool call, and settles on-chain at configurable intervals. Developers receive payouts in fiat or USDC, and the entire nanopayment flow is abstracted behind the same sg.wrap() interface.",
    detectionHeader: 'X-Circle-Channel / Authorization: NANO <channel-id>',
    identityType: 'usdc-channel',
    paymentType: 'nanopayment-channel (USDC)',
    color: 'text-sky-400',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'llm-proxy',
  pricing: {
    // Sub-cent pricing enabled by nanopayments
    defaultCostCents: 0.1, // $0.001 per call
    methods: {
      'tokenize': { costCents: 0.01 },
      'embed': { costCents: 0.5 },
      'generate': { costCents: 2 },
    },
  },
  // Circle Nanopayment channels are managed automatically
})

const embed = sg.wrap(async (args: { text: string }) => {
  const embedding = await generateEmbedding(args.text)
  return { content: [{ type: 'text', text: JSON.stringify(embedding) }] }
}, { method: 'embed' })`,
  },
  {
    slug: 'rest',
    name: 'REST',
    fullName: 'REST API (Any HTTP Service)',
    backer: 'Any HTTP API',
    status: 'Production',
    overview:
      'SettleGrid supports any standard REST API as a first-class protocol. If your service exposes HTTP endpoints (Express, Fastify, Next.js, Hono, Flask, Rails — anything), you can add per-call billing with SettleGrid\'s REST middleware. No MCP server required, no protocol adapters needed — just HTTP request/response with billing built in.',
    howItWorks:
      'The REST integration uses SettleGrid\'s settlegridMiddleware() function, which wraps your HTTP route handler with billing logic. On every incoming request, the middleware extracts the API key from the x-api-key header (or Authorization: Bearer), validates the key and credit balance via SettleGrid\'s API, and either allows the request through or returns a 401/402 error.\n\nAfter your handler processes the request and returns a response, the middleware fires an asynchronous metering event to record the invocation. The metering is non-blocking — it does not add latency to the response.\n\nThe REST middleware works with any Node.js HTTP framework. For Express, it attaches as standard middleware. For Next.js App Router, it runs at the top of your route handler. For other languages (Python, Go, Ruby), you can call the SettleGrid REST API directly.',
    integration:
      "Use settlegridMiddleware() from '@settlegrid/mcp/rest' to wrap any HTTP route handler. The middleware handles key extraction, validation, balance checking, and metering automatically. It works with Express, Fastify, Next.js, Hono, and any other Node.js framework. For non-Node environments, call POST /api/sdk/validate-key and POST /api/sdk/meter directly.",
    detectionHeader: 'x-api-key / Authorization: Bearer sg_*',
    identityType: 'api-key',
    paymentType: 'credit-balance',
    color: 'text-gray-400',
    codeExample: `import { NextRequest, NextResponse } from 'next/server'
import { settlegridMiddleware } from '@settlegrid/mcp/rest'

const billing = settlegridMiddleware({
  toolSlug: 'my-rest-api',
  pricing: { defaultCostCents: 10 },
})

export async function POST(request: NextRequest) {
  // Billing middleware — validates key + deducts credits
  await billing(request)

  const body = await request.json()
  const result = await processRequest(body)
  return NextResponse.json({ result, metered: true })
}`,
  },
]

/* -------------------------------------------------------------------------- */
/*  Static generation                                                          */
/* -------------------------------------------------------------------------- */

export function generateStaticParams() {
  return PROTOCOLS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const protocol = PROTOCOLS.find((p) => p.slug === slug)
  if (!protocol) return { title: 'Protocol Not Found | SettleGrid' }

  return {
    title: `${protocol.name} — ${protocol.fullName} | SettleGrid Protocol Guide`,
    description: `Learn how SettleGrid integrates with ${protocol.fullName} (${protocol.backer}). ${protocol.overview.slice(0, 140)}...`,
    alternates: { canonical: `https://settlegrid.ai/learn/protocols/${slug}` },
    keywords: [
      protocol.name,
      protocol.fullName,
      protocol.backer,
      'SettleGrid',
      'AI agent payments',
      'protocol integration',
      `${protocol.name} billing`,
      `${protocol.name} monetization`,
      'per-call billing',
      'AI tool monetization',
    ],
    openGraph: {
      title: `${protocol.name} — ${protocol.fullName} | SettleGrid`,
      description: `How SettleGrid integrates with ${protocol.fullName} by ${protocol.backer}. Per-call billing, metering, and payouts.`,
      type: 'article',
      siteName: 'SettleGrid',
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Status badge                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: Protocol['status'] }) {
  const styles: Record<Protocol['status'], string> = {
    Production: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Ready: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Testnet: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Pending: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default async function ProtocolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const protocolIndex = PROTOCOLS.findIndex((p) => p.slug === slug)
  if (protocolIndex === -1) notFound()

  const protocol = PROTOCOLS[protocolIndex]
  const prev = protocolIndex > 0 ? PROTOCOLS[protocolIndex - 1] : null
  const next = protocolIndex < PROTOCOLS.length - 1 ? PROTOCOLS[protocolIndex + 1] : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `${protocol.name} — ${protocol.fullName}`,
    description: protocol.overview,
    author: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    publisher: { '@type': 'Organization', name: 'SettleGrid', url: 'https://settlegrid.ai' },
    mainEntityOfPage: `https://settlegrid.ai/learn/protocols/${slug}`,
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E]">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
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
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main content ---- */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Link href="/learn/protocols" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
              &larr; All Protocols
            </Link>
          </div>

          {/* Title block */}
          <div className="mb-12">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className={`text-4xl sm:text-5xl font-bold ${protocol.color}`}>
                {protocol.name}
              </h1>
              <StatusBadge status={protocol.status} />
            </div>
            <p className="text-xl text-gray-300 mb-2">
              {protocol.fullName}
              <span className="text-gray-500"> — {protocol.backer}</span>
            </p>
          </div>

          {/* Overview */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Overview</h2>
            <p className="text-gray-400 leading-relaxed text-lg">{protocol.overview}</p>
          </section>

          {/* How it works */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">How It Works</h2>
            <div className="text-gray-400 leading-relaxed space-y-4">
              {protocol.howItWorks.split('\n\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>

          {/* How SettleGrid integrates */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">How SettleGrid Integrates</h2>
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-6">
              <p className="text-gray-300 leading-relaxed">{protocol.integration}</p>
            </div>
          </section>

          {/* Key specs table */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Key Specs</h2>
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['Protocol', `${protocol.name} — ${protocol.fullName}`],
                    ['Backer', protocol.backer],
                    ['Detection Header', protocol.detectionHeader],
                    ['Identity Type', protocol.identityType],
                    ['Payment Type', protocol.paymentType],
                    ['Status', protocol.status],
                  ].map(([label, value], i) => (
                    <tr key={label} className={i % 2 === 0 ? 'bg-[#1A1D2E]' : 'bg-[#151823]'}>
                      <td className="px-6 py-3 font-medium text-gray-300 whitespace-nowrap w-48">{label}</td>
                      <td className="px-6 py-3 text-gray-400 font-mono text-xs">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Code example */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Code Example</h2>
            <p className="text-gray-400 mb-4">
              Here is how a developer&apos;s tool works with {protocol.name} via SettleGrid:
            </p>
            <CopyableCodeBlock
              code={protocol.codeExample}
              language="typescript"
              title={`${protocol.slug}-example.ts`}
            />
          </section>

          {/* CTA */}
          <section className="mb-16">
            <div className="bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-100 mb-3">
                Start monetizing with SettleGrid
              </h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                Free forever — 25,000 ops/month, 0% fees. Add billing to your {protocol.name} tool in under 5 minutes.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
              >
                Get Started Free
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </section>

          {/* Prev / Next navigation */}
          <nav className="flex items-center justify-between border-t border-[#2E3148] pt-8">
            {prev ? (
              <Link href={`/learn/protocols/${prev.slug}`} className="group flex flex-col">
                <span className="text-xs text-gray-500 mb-1">&larr; Previous</span>
                <span className="text-sm font-medium text-gray-300 group-hover:text-emerald-400 transition-colors">
                  {prev.name} — {prev.fullName}
                </span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link href={`/learn/protocols/${next.slug}`} className="group flex flex-col text-right">
                <span className="text-xs text-gray-500 mb-1">Next &rarr;</span>
                <span className="text-sm font-medium text-gray-300 group-hover:text-emerald-400 transition-colors">
                  {next.name} — {next.fullName}
                </span>
              </Link>
            ) : (
              <div />
            )}
          </nav>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-gray-500">
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
