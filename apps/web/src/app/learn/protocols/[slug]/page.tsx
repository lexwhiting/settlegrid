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
      'MPP (Machine Payments Protocol) is Stripe and Tempo Labs\' protocol for enabling autonomous machine-to-machine payments. Launched March 18, 2026, it is the most significant payment protocol for AI agent commerce because of Stripe\'s massive distribution and Visa\'s planned extension. SettleGrid has a deep, native MPP integration — every SettleGrid tool automatically accepts Stripe Shared Payment Tokens (SPTs) alongside traditional API keys with zero configuration.',
    howItWorks:
      'MPP extends Stripe\'s existing payment rails to support autonomous agent transactions. A "model provider" (the AI agent\'s host) registers payment credentials with Stripe, receives a Shared Payment Token (SPT), and passes it along when the agent calls external services. The service provider verifies the SPT with Stripe and charges the model provider\'s account.\n\nThe protocol uses Stripe\'s existing infrastructure for settlement, compliance, and dispute resolution. This means developers get Stripe-grade payment processing with full PCI compliance, automatic currency conversion, and established fraud protection.\n\nSPTs carry embedded spending limits, expiration times, and scope constraints — so agents can only spend within pre-approved budgets. Every transaction is recorded in the Stripe dashboard alongside regular business payments.\n\nWhen an agent calls a SettleGrid tool without valid payment, it receives a standard HTTP 402 response with MPP headers (X-Payment-Protocol, X-Payment-Amount, X-Payment-Currency) that tell the agent exactly how to pay. The agent then re-sends the request with a valid SPT in the X-Payment-Token header. SettleGrid verifies the SPT, captures the payment, forwards the request to the upstream tool, and returns the result — all in a single round-trip.',
    integration:
      'SettleGrid has a deep, native MPP integration. Every tool on the platform automatically accepts Stripe Shared Payment Tokens (SPTs) via the Smart Proxy — no configuration needed. When an agent presents an SPT via X-Payment-Token header or Authorization: Bearer spt_*, SettleGrid validates it with Stripe\'s MPP API, verifies the spending limits, captures the payment, forwards the request to the upstream tool, and records the invocation with paymentMethod: \'mpp\'. If the token is missing or invalid, SettleGrid returns a proper MPP 402 response with pricing information so the agent can negotiate payment. Developers receive payouts via Stripe Connect regardless of payment method. SettleGrid also publishes a /.well-known/mpp.json manifest for MPP directory registration.',
    detectionHeader: 'X-Payment-Token: spt_* / Authorization: Bearer spt_* / X-Payment-Protocol: MPP/1.0',
    identityType: 'mpp-token',
    paymentType: 'stripe-direct',
    color: 'text-violet-400',
    codeExample: `// Agent paying for a SettleGrid tool via MPP
// No SDK needed — just HTTP headers

const response = await fetch('https://settlegrid.ai/api/proxy/data-enrichment', {
  method: 'POST',
  headers: {
    // MPP payment via Stripe Shared Payment Token
    'X-Payment-Protocol': 'MPP/1.0',
    'X-Payment-Token': 'spt_live_abc123...',
    'X-Payment-Amount': '10',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ domain: 'example.com' }),
})

// If payment is valid, you get the tool response directly.
// If not, you get a 402 with X-Payment-Amount header telling
// you the price, so your agent can negotiate.

// Developer side — zero config needed:
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'data-enrichment',
  pricing: { defaultCostCents: 10 },
  // MPP Shared Payment Tokens are accepted automatically
  // alongside standard sg_live_* API keys — no extra code
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
    color: 'text-amber-400',
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
    // Slug preserved as 'mastercard-agent-pay' for URL compatibility with
    // existing external links; the display name has been updated to the
    // canonical "Mastercard Verifiable Intent" per P1.MKT1 honest framing.
    slug: 'mastercard-agent-pay',
    name: 'Mastercard Verifiable Intent',
    fullName: 'Mastercard Verifiable Intent',
    backer: 'Mastercard',
    status: 'Pending',
    overview:
      "Mastercard Verifiable Intent is Mastercard's framework for enabling AI agents to make verified, intent-based payments. It uses a signed Verifiable Intent document between the principal and the agent to ensure that every agent payment reflects the genuine intent of the human principal, preventing unauthorized or runaway spending by autonomous agents. (Earlier press coverage called this \"Mastercard Agent Pay\"; the canonical product / spec name is \"Verifiable Intent.\")",
    howItWorks:
      'Mastercard Verifiable Intent introduces a signed-intent layer between the agent and the payment. Before an agent can make a payment, the principal must sign a structured intent document specifying the allowed merchant categories, maximum transaction amount, time window, and geographic restrictions. This intent is cryptographically signed and stored on Mastercard\'s infrastructure.\n\nWhen the agent initiates a payment, it presents the intent document along with the transaction details. Mastercard verifies that the transaction falls within the intent\'s constraints — if the amount exceeds the limit, the merchant category is not allowed, or the time window has expired, the payment is rejected.\n\nThis approach solves the "runaway agent" problem: even if an agent is compromised or malfunctions, it cannot spend beyond what the principal explicitly authorized. Every transaction is logged with a link back to the original intent document for audit purposes.',
    integration:
      "SettleGrid supports Mastercard Verifiable Intent as an authentication method. When an agent presents a Verifiable Intent token, SettleGrid validates it with Mastercard's infrastructure, checks that your tool's merchant category is allowed, verifies the spending limit, and processes the payment. Developers receive payouts through Stripe Connect as with all other protocols.",
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
  // Mastercard Verifiable Intent tokens are verified automatically
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
  {
    slug: 'l402',
    name: 'L402',
    fullName: 'L402 Lightning Payments',
    backer: 'Lightning Labs (Bitcoin)',
    status: 'Ready',
    overview:
      'L402 (formerly LSAT) is Lightning Labs\' protocol for native Bitcoin Lightning payments over HTTP. It uses the HTTP 402 status code with Lightning invoices and cryptographic macaroons to enable fully pseudonymous, per-request payments. No API keys, no signup, no KYC — just pay-per-use via the Lightning Network. SettleGrid is the first multi-protocol billing platform with deep L402 support, allowing any AI tool to accept Bitcoin alongside fiat and stablecoin payments.',
    howItWorks:
      'The L402 flow begins when an agent calls a paid endpoint without credentials. The server returns HTTP 402 with a WWW-Authenticate header containing two components: a macaroon (a cryptographic bearer token with embedded caveats like expiry time, tool slug, and amount) and a Lightning invoice (a BOLT-11 payment request for the exact amount in satoshis).\n\nThe agent pays the Lightning invoice through the Bitcoin Lightning Network, which settles in seconds. Payment produces a preimage — the cryptographic proof of payment. The agent then re-sends the original request with an Authorization: L402 <macaroon>:<preimage> header.\n\nThe server verifies the macaroon\'s HMAC signature chain, checks that caveats are satisfied (correct tool, not expired, correct amount), and validates the preimage against the payment hash. If all checks pass, the request is processed.\n\nMacaroons support delegation — an agent can add additional caveats (further restrictions) before passing the macaroon to a sub-agent, enabling hierarchical payment authorization without server interaction.',
    integration:
      'SettleGrid has a deep L402 integration with full macaroon minting and verification. Every tool on the platform can accept Lightning payments via the Smart Proxy. When an agent presents L402 credentials, SettleGrid verifies the HMAC-SHA256 macaroon signature chain, checks caveats (tool slug, expiry, amount), validates the preimage format, and records the invocation. If LND_REST_URL is configured, real Lightning invoices are generated via the LND REST API; otherwise, mock invoices are used for development.',
    detectionHeader: 'Authorization: L402 <macaroon>:<preimage> / Authorization: LSAT <macaroon>:<preimage>',
    identityType: 'pseudonymous (macaroon)',
    paymentType: 'bitcoin-lightning',
    color: 'text-yellow-500',
    codeExample: `// Agent paying for a SettleGrid tool via L402 (Bitcoin Lightning)
// Step 1: Call the endpoint — get a 402 with Lightning invoice

const initial = await fetch('https://settlegrid.ai/api/proxy/data-enrichment', {
  method: 'POST',
  headers: { 'x-settlegrid-protocol': 'l402' },
  body: JSON.stringify({ domain: 'example.com' }),
})
// Returns 402 with WWW-Authenticate: L402 macaroon="...", invoice="lnbc..."

const { macaroon, invoice } = await initial.json()

// Step 2: Pay the Lightning invoice (via your LN wallet/node)
const preimage = await payLightningInvoice(invoice)

// Step 3: Re-send with L402 credentials
const result = await fetch('https://settlegrid.ai/api/proxy/data-enrichment', {
  method: 'POST',
  headers: {
    'Authorization': \`L402 \${macaroon}:\${preimage}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ domain: 'example.com' }),
})`,
  },
  {
    // Slug preserved as 'alipay-trust' for URL compatibility with existing
    // external links; the display name and overview have been updated to
    // the canonical "ACTP — Agentic Commerce Trust Protocol" per
    // P1.MKT1 honest framing.
    slug: 'alipay-trust',
    name: 'ACTP',
    fullName: 'Agentic Commerce Trust Protocol (Alipay / Ant Group)',
    backer: 'Alipay (Ant Group)',
    status: 'Pending',
    overview:
      "ACTP — the Agentic Commerce Trust Protocol — is Alipay's (Ant Group's) agentic commerce framework that extends MCP with delegated payment authorization. It enables AI agents to transact on behalf of users through Alipay's rails. The protocol uses Alipay Agent Tokens — delegated authorization credentials that allow agents to make payments within pre-approved budgets. (Earlier internal SettleGrid drafts referred to this as \"Alipay Trust Protocol\"; the canonical spec name is \"Agentic Commerce Trust Protocol\" / ACTP.)",
    howItWorks:
      "ACTP uses a delegated authorization model. A user (the principal) grants an AI agent an Alipay Agent Token through the Alipay authorization flow. The token carries embedded spending limits, time constraints, merchant category restrictions, and the user's payment preference (balance, credit, or Huabei installments).\n\nWhen the agent calls a service, it presents the Agent Token in the x-alipay-agent-token header. The service verifies the token with Alipay's Open Platform API, which confirms the token's validity, checks spending limits, and authorizes the charge. Payment is settled through Alipay's existing rails.\n\nThe protocol supports multi-currency settlement (CNY, USD, EUR) and integrates with Alipay's existing merchant infrastructure, giving service providers access to Alipay's massive user base without separate payment integration.",
    integration:
      "SettleGrid tracks ACTP as an emerging rail; the Smart Proxy has detection wiring for Alipay Agent Tokens. When an agent presents an Alipay Agent Token, SettleGrid validates the token structure and (when Alipay partnership credentials are configured) verifies it with Alipay's Open Platform API. The tool invocation is metered and the developer receives payouts through Stripe Connect or Alipay merchant settlement. Requires ALIPAY_APP_ID and ALIPAY_PRIVATE_KEY environment variables for full API verification.",
    detectionHeader: 'x-alipay-agent-token / Authorization: Bearer alipay_*',
    identityType: 'alipay-agent-token',
    paymentType: 'alipay-rails',
    color: 'text-blue-500',
    codeExample: `// Agent paying for a SettleGrid tool via ACTP (Agentic Commerce Trust Protocol)

const response = await fetch('https://settlegrid.ai/api/proxy/market-research', {
  method: 'POST',
  headers: {
    'x-alipay-agent-token': 'alipay_agent_token_abc123...',
    'x-alipay-session-id': 'session_xyz789',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ market: 'consumer-electronics', region: 'asia-pacific' }),
})

// Developer side — zero config needed:
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'market-research',
  pricing: { defaultCostCents: 15 },
  // Alipay Agent Tokens are accepted automatically
  // alongside all other payment protocols
})`,
  },
  {
    slug: 'kyapay',
    name: 'KYAPay',
    fullName: 'KYAPay Intelligent Commerce',
    backer: 'Skyfire + Visa',
    status: 'Ready',
    overview:
      'KYAPay is Skyfire\'s protocol for verified agent identity and intelligent commerce, built in partnership with Visa. It uses JWT tokens that embed verified agent identity, payment credentials, and spending authorization into a single self-contained token. No external API calls are needed for verification — the JWT is cryptographically self-proving, making KYAPay the fastest payment protocol in the SettleGrid stack.',
    howItWorks:
      'KYAPay uses standard JWT (JSON Web Token) technology with custom claims for agent commerce. A principal (user or organization) registers with the Skyfire platform, which issues JWT tokens with embedded claims:\n\n- sub: the principal (agent owner) identifier\n- max_spend_cents: the maximum authorized spend per token\n- agent_id: the specific agent using the token\n- allowed_services: list of tool slugs the agent can access\n- payment_credential_ref: reference to the payment method on file\n\nThe JWT is signed with RS256 (RSA) or HS256 (HMAC) and includes standard exp/nbf/iat claims for time-based validity. Service providers verify the signature locally using the public key or shared secret — no API call to Skyfire is needed.\n\nThis makes KYAPay uniquely suited for latency-sensitive workloads: verification adds only microseconds of overhead since it is pure cryptographic computation with no network round-trips.',
    integration:
      'SettleGrid has full JWT validation for KYAPay tokens. When an agent presents a KYAPay token via x-kyapay-token header or Authorization: Bearer kyapay_*, SettleGrid decodes the JWT, verifies the signature (RS256 or HS256) using KYAPAY_VERIFICATION_KEY, checks expiry/nbf claims, validates the max_spend_cents against the tool cost, and optionally verifies the allowed_services list. No external API calls are made — verification is entirely local.',
    detectionHeader: 'x-kyapay-token / Authorization: Bearer kyapay_*',
    identityType: 'kyapay-jwt',
    paymentType: 'jwt-authorized',
    color: 'text-indigo-400',
    codeExample: `// Agent paying for a SettleGrid tool via KYAPay JWT

const response = await fetch('https://settlegrid.ai/api/proxy/sentiment-analysis', {
  method: 'POST',
  headers: {
    // KYAPay JWT with embedded spend authorization
    'x-kyapay-token': 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: 'Analyze this market report...' }),
})

// KYAPay JWT payload example:
// {
//   "sub": "org_acme_corp",
//   "agent_id": "agent_research_bot_42",
//   "max_spend_cents": 500,
//   "allowed_services": ["sentiment-analysis", "data-enrichment"],
//   "exp": 1711929600,
//   "iss": "skyfire.xyz"
// }`,
  },
  {
    slug: 'emvco',
    name: 'EMVCo',
    fullName: 'EMVCo Agent Payments',
    backer: 'EMVCo (Visa + Mastercard + Amex + Discover + JCB + UnionPay)',
    status: 'Pending',
    overview:
      'EMVCo Agent Payments is the forthcoming card-based agent payment standard from EMVCo — the consortium behind chip cards (EMV), contactless payments, and 3-D Secure. It brings the full weight of the global card network infrastructure (Visa, Mastercard, Amex, Discover, JCB, UnionPay) to AI agent commerce. When finalized, it will enable any AI agent to make card-based payments with 3-D Secure authentication and payment tokenisation.',
    howItWorks:
      'EMVCo Agent Payments extends the existing 3-D Secure (3DS) and Payment Tokenisation standards for agent-initiated transactions. The flow combines three EMVCo technologies:\n\n1. Payment Tokenisation: The agent\'s principal\'s card is tokenized into a DPAN (Device PAN) with a cryptogram, so the actual card number is never exposed to the agent or merchant.\n\n2. 3-D Secure: Agent-initiated transactions go through 3DS authentication via the Directory Server. The principal pre-authorizes agent transactions through their banking app, and the 3DS authentication result is embedded in the payment token.\n\n3. Agent Payment Token: A new token type that wraps the DPAN + cryptogram + 3DS result into a single credential the agent presents to merchants.\n\nThe specification is currently in working group stage. SettleGrid has implemented detection and 402 response generation so that early adopters can begin testing their agent payment flows.',
    integration:
      'SettleGrid supports EMVCo Agent Payments with full detection and 402 response generation. When the EMVCo specification is finalized, SettleGrid will add full payment processing via the card network acquirers. Currently, detection (x-emvco-agent-token header) and 402 responses (with supported networks, 3DS version, and tokenisation details) are fully functional. Validation is stub-marked pending the final specification.',
    detectionHeader: 'x-emvco-agent-token',
    identityType: 'emvco-payment-token',
    paymentType: 'card-network (Visa/MC/Amex/Discover/JCB/UnionPay)',
    color: 'text-emerald-400',
    codeExample: `// Agent paying for a SettleGrid tool via EMVCo Agent Payment
// (Once the EMVCo spec is finalized)

const response = await fetch('https://settlegrid.ai/api/proxy/risk-assessment', {
  method: 'POST',
  headers: {
    // EMVCo agent payment token (DPAN + cryptogram + 3DS)
    'x-emvco-agent-token': 'emvco_tok_dpan_abc123...',
    'x-emvco-network': 'visa',  // or mastercard, amex, etc.
    'x-emvco-3ds-ref': '3ds_auth_ref_xyz',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ entity: 'ACME Corp', type: 'comprehensive' }),
})

// Developer side — zero config needed:
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'risk-assessment',
  pricing: { defaultCostCents: 50 },
  // EMVCo tokens will be verified automatically
  // when the specification is finalized
})`,
  },
  {
    slug: 'drain',
    name: 'DRAIN',
    fullName: 'DRAIN Off-chain USDC Payments',
    backer: 'Bittensor / Handshake58',
    status: 'Testnet',
    overview:
      'DRAIN is a protocol for ultra-low-cost micropayments using off-chain payment channels with EIP-712 signed vouchers on Polygon. It enables payments as low as $0.0001 per request with only a one-time $0.02 channel opening cost. DRAIN is designed for high-frequency, low-value transactions — exactly the pattern AI agents use when calling tools thousands of times per task.',
    howItWorks:
      'DRAIN uses payment channels — a well-established pattern in crypto for reducing on-chain costs. The flow works as follows:\n\n1. Channel Opening: The payer opens a payment channel by depositing USDC into a smart contract on Polygon (one-time cost of ~$0.02). This creates a channel between the payer and the service provider.\n\n2. Off-chain Vouchers: For each payment, the payer signs an EIP-712 typed data voucher containing the cumulative amount, a monotonically increasing nonce, and an expiry timestamp. This voucher is sent in the x-drain-voucher header — no on-chain transaction needed.\n\n3. Service Delivery: The service provider verifies the EIP-712 signature, checks the amount and nonce, and serves the request. The provider accumulates vouchers.\n\n4. Channel Settlement: At any time, the provider can submit the latest voucher to the smart contract to claim the accumulated payments on-chain. Only one on-chain transaction is needed regardless of how many vouchers were exchanged.\n\nThis architecture amortizes gas costs across thousands of requests, making per-token or per-byte pricing economically viable.',
    integration:
      'SettleGrid supports DRAIN vouchers with full EIP-712 structural validation. When an agent presents a DRAIN voucher via the x-drain-voucher header, SettleGrid parses the voucher (JSON or base64-encoded), validates the EIP-712 signature format, checks the expiry and nonce, verifies the amount covers the tool cost, and optionally validates the channel address against DRAIN_CHANNEL_ADDRESS. Voucher signature recovery uses the EIP-712 typed data standard on Polygon (chain ID 137).',
    detectionHeader: 'x-drain-voucher',
    identityType: 'wallet-address (Polygon)',
    paymentType: 'off-chain USDC voucher',
    color: 'text-purple-400',
    codeExample: `// Agent paying for a SettleGrid tool via DRAIN off-chain voucher

const voucher = {
  channelAddress: '0x1234...payment-channel-contract',
  payer: '0xABCD...my-polygon-wallet',
  amount: '100000',  // 0.10 USDC (6 decimals)
  nonce: 42,
  expiry: Math.floor(Date.now() / 1000) + 3600,
  signature: '0x...',  // EIP-712 signed
}

const response = await fetch('https://settlegrid.ai/api/proxy/embedding-service', {
  method: 'POST',
  headers: {
    'x-drain-voucher': JSON.stringify(voucher),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text: 'Generate embedding for this text' }),
})

// Ultra-low cost: $0.001 per embedding call
// Only $0.02 to open the channel, then unlimited off-chain vouchers`,
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
    Production: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
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
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
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
            <Link href="/learn/protocols" className="text-sm text-gray-400 hover:text-amber-400 transition-colors">
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
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <p className="text-gray-300 leading-relaxed">{protocol.integration}</p>
            </div>
          </section>

          {/* Key specs table */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">Key Specs</h2>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl overflow-hidden">
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
                    <tr key={label} className={i % 2 === 0 ? 'bg-[#161822]' : 'bg-[#151823]'}>
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
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-100 mb-3">
                Start monetizing with SettleGrid
              </h3>
              <p className="text-gray-400 mb-6 max-w-lg mx-auto">
                Free forever — 50,000 ops/month, progressive take rate. Add billing to your {protocol.name} tool in under 5 minutes.
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
          <nav className="flex items-center justify-between border-t border-[#2A2D3E] pt-8">
            {prev ? (
              <Link href={`/learn/protocols/${prev.slug}`} className="group flex flex-col">
                <span className="text-xs text-gray-500 mb-1">&larr; Previous</span>
                <span className="text-sm font-medium text-gray-300 group-hover:text-amber-400 transition-colors">
                  {prev.name} — {prev.fullName}
                </span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link href={`/learn/protocols/${next.slug}`} className="group flex flex-col text-right">
                <span className="text-xs text-gray-500 mb-1">Next &rarr;</span>
                <span className="text-sm font-medium text-gray-300 group-hover:text-amber-400 transition-colors">
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
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
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
