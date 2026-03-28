import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { ApiEndpointRow } from '@/components/ui/api-endpoint-row'
import { FaqAccordion } from '@/components/ui/faq-accordion'

export const metadata: Metadata = {
  title: 'Documentation | SettleGrid',
  description: 'Quick-start guide, SDK reference, and API documentation for SettleGrid. Bill any AI service — LLM inference, browser automation, media generation, code execution, data APIs, MCP tools, agent-to-agent workflows, and communication services — across 10 payment protocols.',
  alternates: { canonical: 'https://settlegrid.ai/docs' },
  keywords: [
    'SettleGrid documentation',
    'MCP SDK',
    'AI billing API',
    'per-call billing guide',
    'settlegrid tutorial',
    'AI agent billing docs',
  ],
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <h2 className="text-2xl font-bold text-indigo dark:text-gray-100 mb-4">{title}</h2>
      {children}
    </section>
  )
}

const faqCategories: Array<{ title: string; faqs: Array<{ q: string; a: string }> }> = [
{
  title: 'Getting Started',
  faqs: [
    {
      q: 'What is SettleGrid?',
      a: 'SettleGrid is the universal settlement layer for the AI economy. It lets developers monetize any AI service — LLM inference (OpenAI, Anthropic), browser automation (Playwright, Browserbase), media generation (DALL-E, Stable Diffusion), code execution (E2B, Modal), data APIs, MCP tools, agent-to-agent workflows, and communication services (Twilio, Resend) — with one SDK and one unified billing, metering, and payout system. Supports 6 pricing models (per-call, per-token, per-byte, per-second, tiered, outcome-based) across 10 payment protocols. Think of it as the universal billing infrastructure for AI services with real-time metering, multi-protocol support, and automatic revenue splits.',
    },
    {
      q: 'How do I get started as a developer?',
      a: 'Sign up for a free developer account, connect your Stripe account for payouts, create a tool with a unique slug and pricing configuration, then install the @settlegrid/mcp SDK and wrap your handler. You can be live in under 5 minutes.',
    },
    {
      q: 'How do I get started as a consumer?',
      a: 'Browse the SettleGrid Showcase to find tools you want to use. Purchase credits for a tool using a credit card (via Stripe), then generate an API key from your dashboard. Pass the key in the x-api-key header when calling the tool.',
    },
    {
      q: 'Is there a free tier?',
      a: 'Yes. The Free plan is $0 forever with no catch — unlimited tools, 50,000 operations per month, per-call billing, a full dashboard, and a progressive take rate starting at 0% on your first $1K/mo. No credit card required. Most developers will never need to upgrade. The free tier is generous enough to run real production tools, not just prototypes.',
    },
    {
      q: 'What protocols does SettleGrid support?',
      a: 'SettleGrid is protocol-agnostic. It natively supports 15 protocols: MCP (Model Context Protocol), MPP (Machine Payments Protocol — Stripe + Tempo), x402 (Coinbase), AP2 (Google Agent Payments), Visa TAP (Token Agent Payments), UCP (Universal Commerce Protocol — Google + Shopify), ACP (Agentic Commerce Protocol — OpenAI + Stripe), Mastercard Agent Pay (Verifiable Intent), Circle Nanopayments (USDC), and any standard REST API. One SDK covers every protocol.',
    },
  ],
},
{
  title: 'SDK & Integration',
  faqs: [
    {
      q: 'How fast is the billing middleware?',
      a: 'The SDK uses an in-memory LRU cache for key validation (5-minute TTL) and fires metering requests asynchronously via Redis DECRBY on the hot path. Typical overhead is under 10ms — well below the threshold users would notice.',
    },
    {
      q: 'What happens if the SettleGrid API is down?',
      a: 'The SDK caches key validations locally with a configurable TTL. If the metering API is unavailable, invocations are queued and retried automatically. Your tool continues to work uninterrupted.',
    },
    {
      q: 'Can I set different prices for different methods?',
      a: 'Yes. The pricing config supports per-method overrides. Set a defaultCostCents for all methods, then override specific ones in the methods map. For example, a simple lookup might cost 1 cent while a complex analysis costs 10 cents.',
    },
    {
      q: 'What pricing models are supported?',
      a: 'SettleGrid supports per-call billing (flat fee per invocation), per-method pricing (different cost per method), and outcome-based billing (charge only when AI delivers results, with success criteria verification and dispute handling). Multi-currency settlement is supported across USD, EUR, GBP, JPY, and crypto (USDC, USDT).',
    },
    {
      q: 'Does the SDK work with non-MCP services?',
      a: 'Yes. While the package is called @settlegrid/mcp, it is a universal billing SDK. It works with LLM inference proxies (OpenAI, Anthropic, Cohere), browser automation (Playwright, Browserbase), media generation (DALL-E, Stable Diffusion), code execution sandboxes (E2B, Modal), data APIs, communication services (Twilio, Resend), and any REST API (Express, Fastify, Next.js). The SDK\'s wrap() function works with any async handler regardless of protocol or service type. Use settlegridMiddleware() for HTTP endpoints or sg.wrap() for function-level billing.',
    },
    {
      q: 'How do I test my integration before going live?',
      a: 'SettleGrid supports sandbox mode. Create test API keys (prefixed sg_test_) that meter usage without real charges or balance deductions. All invocations made with test keys are flagged as test data in your analytics. Available on Builder tier and above.',
    },
    {
      q: 'Can I attach custom metadata to invocations?',
      a: 'Yes. Each invocation supports a developer-defined metadata field (up to 1KB of JSON). Use it to attach session IDs, user identifiers, referral codes, or any custom context you need for analytics.',
    },
    {
      q: 'Does the SDK support tool versioning?',
      a: 'Yes. Each tool tracks a currentVersion (semver) and supports a full changelog with major/minor/patch change types. Consumers can see version history and release notes on the tool storefront.',
    },
    {
      q: 'What is the wrap() function and how does it work?',
      a: 'sg.wrap() takes any async function and returns a new function with billing middleware. When called, it extracts the API key from context (headers or MCP metadata), validates credits, executes your handler, and meters the invocation — all automatically. You optionally pass a method name to apply per-method pricing.',
    },
    {
      q: 'How does the LRU cache work? Can I configure TTL?',
      a: 'The SDK maintains an in-memory LRU cache (default 1,000 entries, 5-minute TTL) for key validation results to avoid redundant API calls. You can configure the TTL via the cacheTtlMs option in settlegrid.init(). Call sg.clearCache() to manually invalidate all cached entries.',
    },
    {
      q: 'What errors can the SDK throw and how should I handle them?',
      a: 'The SDK exports typed error classes: InvalidKeyError (401), InsufficientCreditsError (402), ToolNotFoundError (404), ToolDisabledError (404), RateLimitedError (429), TimeoutError, NetworkError, and SettleGridUnavailableError (503). Each extends SettleGridError with a statusCode and toJSON() method for structured error handling.',
    },
    {
      q: 'Can I use the SDK with Python, Go, or other languages?',
      a: 'The @settlegrid/mcp SDK is TypeScript-only. For Python, Go, or other languages, use the settlegridMiddleware() REST approach or call the SettleGrid REST API directly (POST /api/sdk/validate-key and POST /api/sdk/meter). Any language that can make HTTP requests can integrate with SettleGrid.',
    },
    {
      q: 'What is the difference between @settlegrid/mcp and the REST middleware?',
      a: 'settlegrid.init() + sg.wrap() is designed for MCP tool servers and function-level wrapping. settlegridMiddleware() is designed for REST API routes (Next.js, Express, Hono) and wraps entire HTTP request handlers. Both use the same underlying billing pipeline; choose based on your framework.',
    },
    {
      q: 'What is the MCP Payment Capability?',
      a: 'createPaymentCapability() generates the experimental.payment capability object that MCP servers declare during initialization. It tells MCP clients that your server uses SettleGrid for billing, what the pricing is, and where consumers can purchase credits. Clients then send a settlegrid-api-key in _meta on each tool call.',
    },
    {
      q: 'What is an MCP Server Card?',
      a: 'generateServerCard() creates a .well-known/mcp-server JSON document that includes billing metadata. Registries and clients use this to discover your tool\'s pricing information, supported methods, and SettleGrid provider URL without making an API call.',
    },
    {
      q: 'How do I pass the API key to a wrapped function?',
      a: 'Pass a context object as the second argument: wrappedFn(args, { headers: { "x-api-key": "sg_live_..." } }). The SDK also supports Authorization: Bearer headers and settlegrid-api-key in MCP _meta. If no key is found, an InvalidKeyError is thrown.',
    },
    {
      q: 'Can I call validateKey() or meter() manually?',
      a: 'Yes. sg.validateKey(apiKey) returns { valid, consumerId, balanceCents } and sg.meter(apiKey, method) performs a full validate-check-deduct cycle. Use these for advanced scenarios where wrap() does not fit your architecture.',
    },
  ],
},
{
  title: 'Pricing Your Tool',
  faqs: [
    {
      q: 'How much should I charge per invocation?',
      a: 'It depends on your tool\'s value and compute costs. Here are benchmarks by tool type:\n\n- Simple lookups/search: 1-5 cents per call\n- Data enrichment/APIs: 5-25 cents per call\n- AI-powered analysis: 10-50 cents per call\n- Complex multi-step workflows: 25 cents - $1+ per call\n\nStart on the lower end to attract early users, then adjust based on demand and feedback.',
    },
    {
      q: 'Which pricing model should I use?',
      a: 'SettleGrid supports 6 models:\n\n- Per-invocation (most common): Fixed price per API call. Best for simple, predictable tools.\n- Per-token: Charge based on input/output size. Best for LLM wrappers and text processing.\n- Per-byte: Charge based on data volume. Best for file processing and data transfer.\n- Per-second: Charge based on processing time. Best for compute-intensive tasks.\n- Tiered: Different prices per method. Best for tools with multiple endpoints of varying complexity.\n- Outcome-based: Charge only when the tool delivers a successful result. Best for high-value, variable-success tasks.',
    },
    {
      q: 'How do consumers pay for my tool?',
      a: 'Consumers purchase credits via Stripe (credit card). They can enable auto-refill so their balance never runs out. When they call your tool, credits are deducted in real-time. You receive payouts via Stripe Connect on your chosen schedule (daily, weekly, or monthly).',
    },
    {
      q: 'Can I offer a free trial?',
      a: 'Yes. You can create promotional API keys with a pre-loaded credit balance, or set your initial price to $0 for the first N invocations using outcome-based billing with a free tier threshold. Many successful tools offer the first 50-100 calls free to let consumers evaluate quality.',
    },
    {
      q: 'What if I price too high or too low?',
      a: 'You can change your pricing at any time from the dashboard or by updating your SDK configuration. Price changes apply to future invocations only — existing consumer balances are not affected. We recommend starting lower and raising prices as you build a track record and reviews.',
    },
  ],
},
{
  title: 'Framework Integration',
  faqs: [
    {
      q: 'How do I use SettleGrid with a standard MCP server?',
      a: 'Use the @modelcontextprotocol/sdk with settlegrid.init() and sg.wrap(). Example:\n\nimport { Server } from \'@modelcontextprotocol/sdk/server/index.js\'\nimport { StdioServerTransport } from \'@modelcontextprotocol/sdk/server/stdio.js\'\nimport { settlegrid } from \'@settlegrid/mcp\'\n\nconst sg = settlegrid.init({\n  toolSlug: \'my-mcp-tool\',\n  pricing: { defaultCostCents: 5 },\n})\n\nconst server = new Server({ name: \'my-server\', version: \'1.0.0\' }, { capabilities: { tools: {} } })\n\nconst handler = sg.wrap(async (args: { query: string }) => {\n  return { content: [{ type: \'text\', text: \'Result for: \' + args.query }] }\n}, { method: \'search\' })\n\nserver.setRequestHandler(\'tools/call\', async (request) => {\n  const result = await handler(request.params.arguments, {\n    headers: request.params._meta ?? {},\n  })\n  return result\n})\n\nconst transport = new StdioServerTransport()\nawait server.connect(transport)',
    },
    {
      q: 'How do I use SettleGrid with Next.js App Router?',
      a: 'Use settlegridMiddleware() in a route.ts handler. Example:\n\nimport { NextRequest, NextResponse } from \'next/server\'\nimport { settlegridMiddleware } from \'@settlegrid/mcp/rest\'\n\nconst billing = settlegridMiddleware({\n  toolSlug: \'my-nextjs-tool\',\n  pricing: { defaultCostCents: 10 },\n})\n\nexport async function POST(request: NextRequest) {\n  // Run billing middleware — throws on invalid key or insufficient credits\n  const billingCtx = await billing(request)\n\n  const body = await request.json()\n  const result = await processRequest(body)\n\n  return NextResponse.json({ result, metered: true })\n}\n\nPlace this file at app/api/your-tool/route.ts and deploy. The middleware extracts the API key from the x-api-key header, validates credits, and meters the call automatically.',
    },
    {
      q: 'How do I use SettleGrid with Express.js?',
      a: 'Use settlegridMiddleware() as Express middleware. Example:\n\nimport express from \'express\'\nimport { settlegridMiddleware } from \'@settlegrid/mcp/rest\'\n\nconst app = express()\napp.use(express.json())\n\nconst billing = settlegridMiddleware({\n  toolSlug: \'my-express-tool\',\n  pricing: {\n    defaultCostCents: 5,\n    methods: {\n      \'search\': { costCents: 5 },\n      \'analyze\': { costCents: 25 },\n    },\n  },\n})\n\n// Apply billing to specific routes\napp.post(\'/api/search\', billing, (req, res) => {\n  const { query } = req.body\n  res.json({ results: [\'result 1\', \'result 2\'], query })\n})\n\napp.post(\'/api/analyze\', billing, (req, res) => {\n  const { data } = req.body\n  res.json({ analysis: \'Complete\', confidence: 0.95 })\n})\n\napp.listen(3000, () => console.log(\'Server running on :3000\'))',
    },
    {
      q: 'How do I verify webhook signatures?',
      a: 'Every SettleGrid webhook is signed with HMAC-SHA256. Verify using the X-SettleGrid-Signature header. Example:\n\nimport crypto from \'crypto\'\n\nfunction verifyWebhookSignature(\n  rawBody: string,\n  signature: string,\n  secret: string\n): boolean {\n  const expected = crypto\n    .createHmac(\'sha256\', secret)\n    .update(rawBody, \'utf8\')\n    .digest(\'hex\')\n  return crypto.timingSafeEqual(\n    Buffer.from(signature),\n    Buffer.from(expected)\n  )\n}\n\n// In your webhook handler:\napp.post(\'/webhooks/settlegrid\', express.raw({ type: \'application/json\' }), (req, res) => {\n  const signature = req.headers[\'x-settlegrid-signature\'] as string\n  const secret = process.env.SETTLEGRID_WEBHOOK_SECRET!\n\n  if (!verifyWebhookSignature(req.body.toString(), signature, secret)) {\n    return res.status(401).json({ error: \'Invalid signature\' })\n  }\n\n  const event = JSON.parse(req.body.toString())\n  // Process event.type: invocation.completed, payout.initiated, etc.\n  res.json({ received: true })\n})\n\nAlways use crypto.timingSafeEqual to prevent timing attacks. Store your webhook secret in an environment variable.',
    },
  ],
},
{
  title: 'AI Framework Integration',
  faqs: [
    {
      q: 'How do I use SettleGrid tools with LangChain?',
      a: 'Use the LangChain Tool base class to wrap any SettleGrid-powered endpoint. Example:\n\nimport { Tool } from \'@langchain/core/tools\'\n\nclass SettleGridTool extends Tool {\n  name = \'sanctions_screening\'\n  description = \'Screen entities against sanctions lists\'\n\n  constructor(private apiKey: string) {\n    super()\n  }\n\n  async _call(query: string): Promise<string> {\n    const response = await fetch(\'https://settlegrid.ai/api/tools/web-search-pro/invoke\', {\n      method: \'POST\',\n      headers: {\n        \'x-api-key\': this.apiKey, // Your SettleGrid consumer API key\n        \'Content-Type\': \'application/json\',\n      },\n      body: JSON.stringify({ query }),\n    })\n    const data = await response.json()\n    return JSON.stringify(data.results)\n  }\n}\n\n// Use in a LangChain agent\nconst tool = new SettleGridTool(\'sg_live_your_key_here\')\nconst agent = await initializeAgent([tool], model, { agentType: \'tool-calling\' })',
    },
    {
      q: 'How do I use SettleGrid tools with CrewAI?',
      a: 'Use the CrewAI BaseTool class to call SettleGrid-powered endpoints from your agents. Example:\n\nfrom crewai import Agent, Task, Crew\nfrom crewai_tools import BaseTool\nimport requests\n\nclass SettleGridTool(BaseTool):\n    name: str = \"Web Search\"\n    description: str = \"Search the web with AI-powered ranking\"\n\n    def _run(self, query: str) -> str:\n        response = requests.get(\n            f\"https://your-server.com/api/search?q={query}\",\n            headers={\"x-api-key\": \"sg_live_your_key_here\"}\n        )\n        return response.json()\n\nrisk_tool = SettleGridTool()\nanalyst = Agent(\n    role=\"Research Assistant\",\n    goal=\"Find and summarize relevant information from the web\",\n    tools=[risk_tool],\n)',
    },
    {
      q: 'How do I use SettleGrid tools with OpenAI function calling?',
      a: 'Define a function schema and handle tool calls by forwarding to the SettleGrid endpoint. Example:\n\nimport OpenAI from \'openai\'\n\nconst openai = new OpenAI()\n\nconst tools = [{\n  type: \'function\' as const,\n  function: {\n    name: \'web_search\',\n    description: \'Search the web and return summarized results\',\n    parameters: {\n      type: \'object\',\n      properties: {\n        query: { type: \'string\', description: \'Search query\' },\n      },\n      required: [\'query\'],\n    },\n  },\n}]\n\n// When the model calls the function:\nasync function handleToolCall(name: string, args: any) {\n  if (name === \'web_search\') {\n    const res = await fetch(\'https://your-server.com/api/search\', {\n      method: \'POST\',\n      headers: { \'x-api-key\': \'sg_live_your_key_here\', \'Content-Type\': \'application/json\' },\n      body: JSON.stringify(args),\n    })\n    return res.json()\n  }\n}',
    },
    {
      q: 'How do I use SettleGrid tools with Anthropic Claude tool use?',
      a: 'Define a tool schema with input_schema and handle tool_use blocks by calling the SettleGrid endpoint. Example:\n\nimport Anthropic from \'@anthropic-ai/sdk\'\n\nconst client = new Anthropic()\n\nconst tools = [{\n  name: \'classify_tariff\',\n  description: \'Classify a product into its HS tariff code\',\n  input_schema: {\n    type: \'object\' as const,\n    properties: {\n      product_description: { type: \'string\', description: \'Description of the product to classify\' },\n      country_of_origin: { type: \'string\', description: \'ISO country code\' },\n    },\n    required: [\'product_description\'],\n  },\n}]\n\n// When Claude uses the tool:\nasync function handleToolUse(name: string, input: any) {\n  if (name === \'classify_tariff\') {\n    const res = await fetch(\'https://your-server.com/api/classify\', {\n      method: \'POST\',\n      headers: { \'x-api-key\': \'sg_live_your_key_here\', \'Content-Type\': \'application/json\' },\n      body: JSON.stringify(input),\n    })\n    return res.json()\n  }\n}',
    },
  ],
},
{
  title: 'Billing & Credits',
  faqs: [
    {
      q: 'Do credits expire?',
      a: 'No. Credits purchased for a specific tool never expire and can be used at any time.',
    },
    {
      q: 'How does auto-refill work?',
      a: 'Consumers can enable auto-refill on a per-tool basis. When your balance drops below a configurable threshold (e.g., $5.00), SettleGrid automatically charges your saved payment method for a configurable refill amount (e.g., $20.00). You receive an email confirmation each time auto-refill triggers.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'Fiat payments are processed via Stripe, so all major credit and debit cards are accepted. Crypto payments are supported via the x402 protocol using USDC and USDT stablecoins.',
    },
    {
      q: 'Can I set spending limits?',
      a: 'Yes. Consumers can configure spending limits per tool on a daily, weekly, or monthly period. You can also set an alert threshold (e.g., notify me at 80% of my limit). When the limit is reached, further invocations are blocked until the period resets.',
    },
    {
      q: 'What happens when my balance reaches zero?',
      a: 'If auto-refill is enabled, your balance is topped up automatically. If auto-refill is off, invocations return an InsufficientCreditsError (HTTP 402) with the required and available amounts. Your tool continues to work for other consumers who have credits.',
    },
    {
      q: 'How do I get a receipt or invoice?',
      a: 'SettleGrid sends a credit purchase confirmation email for every purchase, and a detailed invoice receipt email with line items, subtotals, and platform fees. You can also export your full transaction history as CSV from the dashboard.',
    },
    {
      q: 'What happens if my payment fails?',
      a: 'You receive a payment failure email with details on why the charge was declined. For auto-refill, SettleGrid follows a dunning sequence: an initial failure notice, a second reminder, a third warning, and a final notice before your auto-refill is paused. You also receive advance notice if your card is approaching its expiration date.',
    },
    {
      q: 'What credit amounts can I purchase?',
      a: 'SettleGrid offers preset credit packages of $5, $20, and $50, as well as custom amounts. All purchases are processed via Stripe Checkout and credits are available in your balance immediately upon payment confirmation.',
    },
    {
      q: 'What happens if I abandon a checkout?',
      a: 'If you start a credit purchase but do not complete it, SettleGrid sends an abandoned checkout email with a link to resume your purchase. This helps ensure you do not lose access to tools you are using.',
    },
    {
      q: 'How does multi-currency billing work?',
      a: 'SettleGrid supports USD, EUR, GBP, JPY, and USDC. Exchange rates are fetched from Open Exchange Rates and cached in Redis for 1 hour. If the rate API is unavailable, hardcoded fallback rates are used. All amounts are stored in the smallest unit (cents, yen, micro-units).',
    },
  ],
},
{
  title: 'Payouts & Revenue',
  faqs: [
    {
      q: 'How do payouts work?',
      a: 'Revenue from your tools accumulates in your SettleGrid developer balance. Payouts are disbursed via Stripe Connect Express to your linked bank account. You can choose weekly or monthly payout schedules, or trigger a manual payout from the dashboard at any time.',
    },
    {
      q: 'What is the revenue split?',
      a: 'All plans use a progressive take rate based on monthly tool revenue: 0% on the first $1,000/mo (you keep 100%), 2% on $1,001-$10,000, 2.5% on $10,001-$50,000, and 5% above $50,000. Most developers pay 0%. Need a custom arrangement? Email support@settlegrid.ai.',
    },
    {
      q: 'What is the minimum payout?',
      a: 'The default minimum payout is just $1.00 — the lowest of any AI monetization platform. Get paid from your very first earnings. You can adjust this threshold up to $500 in Settings > Payouts.',
    },
    {
      q: 'How long do payouts take?',
      a: 'Once triggered, payouts are processed via Stripe Connect and typically arrive in your bank account within 2-7 business days depending on your country and bank. You receive email notifications when a payout is initiated and when it completes.',
    },
    {
      q: 'What if a payout fails?',
      a: 'If a Stripe transfer fails, you receive a payout failure email with the error details. The funds remain in your SettleGrid balance and can be retried. Common causes include disconnected Stripe accounts or bank account issues.',
    },
    {
      q: 'Can I earn from referrals?',
      a: 'Yes. SettleGrid has a referral system where you can generate referral codes for tools. When consumers purchase credits through your referral link, you earn a commission (default 10%) on their spending. Referral earnings are tracked and included in your payouts. Available on the Scale plan and above.',
    },
    {
      q: 'How do I connect Stripe?',
      a: 'Go to Dashboard > Settings and click "Connect Stripe." You will be redirected to Stripe\'s onboarding flow where you provide your bank details and identity verification. Once complete, your status changes to "Connected" and payouts are enabled automatically.',
    },
    {
      q: 'Do I receive a monthly earnings summary?',
      a: 'Yes. At the end of each month, developers receive a monthly earnings summary email with a per-tool revenue breakdown and total earnings. Consumers receive a monthly usage summary with spending and invocation counts.',
    },
    {
      q: 'Are there revenue milestone notifications?',
      a: 'Yes. When your tool reaches a revenue milestone, you receive a congratulatory email with the milestone amount. This helps you track growth and celebrate wins.',
    },
  ],
},
{
  title: 'Security',
  faqs: [
    {
      q: 'How are API keys stored?',
      a: 'API keys are SHA-256 hashed before storage — SettleGrid never stores plaintext keys. Only the first few characters (the key prefix) are stored in clear text so you can identify keys in the dashboard. The full key is shown only once at creation time.',
    },
    {
      q: 'What is IP allowlisting?',
      a: 'You can lock individual API keys to specific IP addresses or CIDR blocks. Any request from an IP not on the allowlist is rejected with a 403 response. This prevents stolen keys from being used outside your infrastructure. Available on the Scale plan and above.',
    },
    {
      q: 'How do webhooks get verified?',
      a: 'Every webhook delivery is signed with HMAC-SHA256 using a per-endpoint secret. The signature is included in the X-SettleGrid-Signature header. Verify it by computing the HMAC of the raw request body using your secret and comparing it to the header value.',
    },
    {
      q: 'What fraud detection is in place?',
      a: 'SettleGrid runs a three-signal fraud detection system: (1) rate spike detection flags abnormal invocation bursts, (2) new-key velocity checks flag high-value usage from newly created keys, and (3) rapid duplicate deduplication catches repeated identical requests. Suspicious invocations are flagged and can trigger email alerts. Available on the Platform plan.',
    },
    {
      q: 'Is there an audit trail?',
      a: 'Yes. Every significant action is recorded in the audit log — tool creation, key revocation, payout triggers, settings changes, webhook modifications, and more. Audit logs capture the action, resource type, resource ID, IP address, and user agent. Logs are exportable as CSV for SOC 2 evidence collection.',
    },
    {
      q: 'What happens if suspicious activity is detected on my account?',
      a: 'You receive an immediate email alert detailing the suspicious activity (e.g., login from a new location, unusual API key usage). You can review the audit log and revoke compromised keys from your dashboard.',
    },
    {
      q: 'How does rate limiting work?',
      a: 'SettleGrid enforces tiered sliding-window rate limits on all API routes based on your plan (Free through Scale). When limits are exceeded, requests receive a 429 response with a Retry-After header. Rate limits apply to both developer dashboard calls and consumer SDK calls.',
    },
    {
      q: 'Do I get notified when an API key is created or revoked?',
      a: 'Yes. You receive an email when a new API key is created (including the key prefix, IP address, and user agent) and when a key is revoked. If the IP allowlist is modified, you also receive a notification with the action and IP address.',
    },
  ],
},
{
  title: 'x402 & Crypto Settlement',
  faqs: [
    {
      q: 'What is x402?',
      a: 'x402 is Coinbase\'s open protocol for machine-to-machine payments using HTTP 402 status codes. When an AI agent hits a paid endpoint, it receives a 402 response with payment instructions. The agent pays with USDC on-chain, and the server verifies the payment before serving the response. SettleGrid is the first x402 facilitator that adds metering, budgets, and analytics on top.',
    },
    {
      q: 'What chains are supported?',
      a: 'SettleGrid supports USDC and USDT stablecoins for crypto settlement. On-chain settlement details are handled through the x402 protocol specification. The platform maintains a unified fiat + crypto ledger so all revenue — regardless of payment method — is reconciled in one place.',
    },
    {
      q: 'Do I need a crypto wallet to use SettleGrid?',
      a: 'No. Crypto payments via x402 are optional. You can use SettleGrid entirely with fiat payments (credit cards via Stripe). Crypto settlement is an additional capability for developers and consumers who want on-chain payment options.',
    },
    {
      q: 'How does on-chain settlement work?',
      a: 'For x402 payments, the consumer\'s agent sends a payment header with the request. SettleGrid verifies the on-chain payment, meters the operation, and credits the developer. The developer can receive payouts in fiat via Stripe Connect regardless of how the consumer paid.',
    },
    {
      q: 'What x402 API endpoints are available?',
      a: 'Three endpoints: POST /api/x402/verify validates an on-chain payment header, POST /api/x402/settle processes the settlement, and GET /api/x402/supported returns the list of supported stablecoins and chains. These are used internally by the SDK and can also be called directly.',
    },
  ],
},
{
  title: 'AP2 & Visa TAP',
  faqs: [
    {
      q: 'What is AP2 (Google Agent Payments)?',
      a: 'AP2 is Google\'s Agent Payments protocol that lets AI agents transact with service providers. SettleGrid acts as an AP2 credentials provider, issuing budget-capped credentials to agents within Google\'s 180+ partner ecosystem. This allows AP2-enabled agents to pay for your tools seamlessly.',
    },
    {
      q: 'What is Visa TAP (Token Agent Payments)?',
      a: 'Visa TAP is Visa\'s protocol for tokenized agent-to-agent payments. SettleGrid supports TAP tokens as an identity type in the KYA system, allowing Visa-credentialed agents to authenticate and pay for tool invocations.',
    },
    {
      q: 'Do I need separate integrations for each protocol?',
      a: 'No. SettleGrid\'s protocol adapter layer handles MCP, x402, AP2, Visa TAP, and REST transparently. You integrate once with the SDK and all supported protocols work automatically. The adapter layer normalizes authentication, metering, and settlement across every protocol.',
    },
  ],
},
{
  title: 'Organizations & Teams',
  faqs: [
    {
      q: 'Can I use SettleGrid with a team?',
      a: 'Yes. SettleGrid supports organizations with multiple members. Create an organization, invite team members by email, and manage shared tools, budgets, and billing under one account.',
    },
    {
      q: 'What roles are available?',
      a: 'Organizations support four roles: Owner (full control, billing, member management), Admin (manage tools, keys, and settings), Member (use tools, view analytics), and Viewer (read-only access to dashboards and reports).',
    },
    {
      q: 'How does budget allocation work?',
      a: 'Organizations can set a monthly budget cap with spending tracked automatically. Departments or teams can be tagged using cost allocation, allowing you to attribute spending to specific business units. Budget warning emails are sent when spend approaches the configured limit.',
    },
    {
      q: 'Can organization members be removed?',
      a: 'Yes. Owners and Admins can remove members at any time from the organization settings. Removed members receive an email notification and immediately lose access to the organization\'s tools and dashboards.',
    },
    {
      q: 'How does RBAC work?',
      a: 'SettleGrid uses a hierarchical role-based access control system with 7 permissions (org.manage, org.manage_members, org.manage_tools, org.manage_budgets, org.view_analytics, tools.create, tools.use). Each role inherits all permissions below it in the hierarchy: Owner > Admin > Member > Viewer.',
    },
    {
      q: 'What happens when a member\'s role changes?',
      a: 'Both the affected member and the organization admins receive an email notification showing the old and new role. The member\'s permissions update immediately to match the new role.',
    },
    {
      q: 'How does cost allocation work?',
      a: 'Organizations can track spending by department or team via cost allocations. Each allocation records the organization, period, and amount spent, allowing you to attribute AI service costs to specific business units for internal chargebacks or budgeting.',
    },
  ],
},
{
  title: 'Showcase & Discovery',
  faqs: [
    {
      q: 'What is the SettleGrid Showcase?',
      a: 'The Showcase is a public directory at settlegrid.ai/tools where consumers can discover, evaluate, and purchase credits for developer tools. Each tool has a storefront page with description, pricing, version history, reviews, and a one-click purchase flow.',
    },
    {
      q: 'Can consumers leave reviews?',
      a: 'Yes. Consumers can rate tools on a 1-5 scale and leave written comments (up to 1,000 characters). One review per consumer per tool. Reviews are displayed on the tool storefront and factor into the developer\'s reputation score.',
    },
    {
      q: 'What are developer profiles?',
      a: 'Developers can enable a public profile showing their bio, avatar, tool portfolio, reputation score, uptime percentage, average response time, and total consumers served. Profiles help build trust and drive discovery.',
    },
    {
      q: 'How are tools categorized?',
      a: 'Tools can be assigned a category (data, NLP, image, code, search, finance, etc.) and tagged with keywords. The Showcase supports filtering and browsing by category to help consumers find relevant tools.',
    },
    {
      q: 'What does the reputation score mean?',
      a: 'A developer\'s reputation score (visible on the /dashboard/reputation page and public profile) reflects tool uptime, consumer reviews, response time, and payout history. Higher scores increase visibility in the Showcase and build consumer trust.',
    },
    {
      q: 'Can I embed a pricing widget on my own site?',
      a: 'Yes. Each tool has a public pricing widget endpoint at /api/tools/by-slug/{slug}/pricing-widget that returns embeddable pricing data. You can also generate an integration snippet from /api/tools/by-slug/{slug}/integration to show SettleGrid-powered purchase flows on your own website.',
    },
    {
      q: 'Is there a pricing simulator?',
      a: 'Yes. The /api/tools/{id}/pricing-simulator endpoint lets you model different pricing configurations and see projected revenue based on hypothetical invocation volumes before committing to a price change.',
    },
  ],
},
{
  title: 'Monitoring & Webhooks',
  faqs: [
    {
      q: 'What webhook events are available?',
      a: 'SettleGrid supports webhook events for invocation.completed, payout.initiated, payout.completed, tool.status_changed, and more. Webhooks are delivered with HMAC-SHA256 signatures and include automatic retry with exponential backoff (up to 3 attempts).',
    },
    {
      q: 'How does health monitoring work?',
      a: 'Developers can configure a health check endpoint URL for each tool. SettleGrid periodically pings the endpoint and records the status (up, down, or degraded) along with response time. If a tool goes down, the developer receives an email alert; another email is sent when the tool recovers.',
    },
    {
      q: 'What analytics are available?',
      a: 'The dashboard provides real-time analytics on invocation volume, revenue, latency percentiles, consumer growth, conversion events, and tool health. Builder and Scale plans support CSV export of all analytics data.',
    },
    {
      q: 'What happens if webhook delivery fails?',
      a: 'Failed webhook deliveries are retried up to 3 times with exponential backoff. Each delivery records the HTTP status code and attempt count. You receive an email alert if a webhook endpoint is consistently failing, so you can investigate and fix the issue.',
    },
    {
      q: 'Can I test a webhook endpoint?',
      a: 'Yes. From the webhooks dashboard (/dashboard/webhooks), you can send a test delivery to any registered endpoint via POST /api/developer/webhooks/{id}/test. The test payload simulates a real webhook event so you can verify your endpoint is receiving and processing events correctly.',
    },
    {
      q: 'Can I view webhook delivery history?',
      a: 'Yes. GET /api/developer/webhooks/{id}/deliveries returns the full delivery log for a webhook endpoint, including HTTP status codes, attempt counts, and timestamps. This helps you debug failed deliveries and verify successful ones.',
    },
    {
      q: 'What analytics dashboards are available?',
      a: 'Developers have access to the main dashboard (overview stats), analytics (detailed invocation/revenue charts), attribution (where consumers come from), and funnel (conversion rates). Consumers have a usage analytics page showing per-tool spending and invocation history.',
    },
    {
      q: 'Can I export analytics data?',
      a: 'Yes. The /api/dashboard/developer/stats/export endpoint generates a CSV file with your complete analytics data (invocations, revenue, latency, consumer counts). CSV exports include proper escaping to prevent formula injection. Available on Scale plan and above.',
    },
    {
      q: 'Does SettleGrid support SSE streaming?',
      a: 'Yes. The /api/stream endpoint provides server-sent events (SSE) for real-time dashboard updates. Your dashboard receives live invocation events, balance changes, and alert notifications without polling.',
    },
  ],
},
{
  title: 'Settlement & Workflows',
  faqs: [
    {
      q: 'What is multi-hop settlement?',
      a: 'When Agent A calls Agent B which calls Agent C, SettleGrid tracks the entire chain as a workflow session with individual hops. Revenue is split across all participants atomically — everyone gets paid or no one does. This is critical for complex AI agent orchestration.',
    },
    {
      q: 'What settlement modes are available?',
      a: 'Three modes: Immediate (settle each hop instantly as it completes), Deferred (accumulate hops and settle at session end), and Atomic (all-or-nothing settlement via settlement batches — if any hop fails, the entire workflow is rolled back).',
    },
    {
      q: 'What is Agent Identity (KYA)?',
      a: 'Know Your Agent (KYA) is SettleGrid\'s agent identity verification system. It supports multiple identity types: API keys, DID:key, JWT, x509 certificates, and Visa TAP tokens. Agents are verified at basic, business, or individual levels and can have spending limits and capability restrictions.',
    },
    {
      q: 'What is outcome-based billing?',
      a: 'Instead of charging per call, you can define success criteria for each invocation. The consumer pays the full price only if the outcome passes verification, or a reduced failure price if it does not. Consumers can open disputes within 24 hours of verification, and disputes are tracked through an opened/under review/resolved lifecycle.',
    },
    {
      q: 'What are workflow sessions?',
      a: 'A workflow session is a budget-capped container for multi-hop agent workflows. You create a session with a budget in cents and an expiry time; each tool call within the session is recorded as a hop. The session tracks total spent vs. budget in Redis for sub-millisecond checks, with PostgreSQL as the durable store.',
    },
    {
      q: 'How does budget delegation work?',
      a: 'A parent session can delegate a portion of its budget to a child session by specifying a parentSessionId. The delegated amount is reserved on the parent. When the child completes, any unused budget is released back to the parent. Child sessions cannot expire after their parent.',
    },
    {
      q: 'How do disputes work?',
      a: 'After an outcome verification, consumers have a 24-hour window to open a dispute with a reason. Disputes go through an opened > under review > resolved lifecycle. Resolution can be in favor of the consumer (charge reduced to failure price) or provider (full price charged). Both parties receive email notifications.',
    },
    {
      q: 'What is an AgentFacts profile?',
      a: 'AgentFacts is a standardized agent profile format that SettleGrid generates for registered agents. It includes core identity, capabilities (tools, methods, pricing, protocols), auth permissions (rate limits, spending limits), and a verification trust score (0-100) based on account age, transaction history, and dispute record.',
    },
    {
      q: 'What happens when a workflow session expires?',
      a: 'A cron job runs periodically to detect sessions that have passed their expiresAt timestamp. Expired sessions are marked as "expired" and their Redis budget keys are cleaned up. Any in-progress hops after expiry are rejected. Unused delegated budget is not released until the session is explicitly completed or finalized.',
    },
    {
      q: 'How does atomic settlement work?',
      a: 'In atomic mode, when a session is finalized, SettleGrid creates a settlement batch containing disbursements for every developer whose tool was called. All developer balances are credited inside a single PostgreSQL transaction — if any credit fails, the entire batch rolls back and no developer receives partial payment.',
    },
  ],
},
{
  title: 'Consumer Dashboard',
  faqs: [
    {
      q: 'How do I create an API key?',
      a: 'Navigate to a tool\'s storefront page and click "Generate API Key." The full key (prefixed sg_live_ or sg_test_) is shown once at creation time — copy and store it securely. You can manage all your keys from the Consumer Dashboard.',
    },
    {
      q: 'How do I add IP restrictions to my API key?',
      a: 'In the Consumer Dashboard, expand the API key you want to restrict and click "+ Add IP." Enter an IP address or CIDR range (e.g., 192.168.1.0/24). Requests from non-allowlisted IPs are rejected with a 403 response. You receive an email notification when the allowlist is changed.',
    },
    {
      q: 'What happens if I exceed my budget limit?',
      a: 'When your spending reaches the configured limit for a tool, further invocations are blocked and return an error until the budget period (daily, weekly, or monthly) resets. You receive an alert email when spend approaches your configured threshold percentage.',
    },
    {
      q: 'How do I enable auto-refill?',
      a: 'Auto-refill is configured per tool from the Consumer Dashboard. Set a threshold balance (triggers refill) and a refill amount (how much to charge). When your balance drops below the threshold, your saved payment method is charged automatically and you receive a confirmation email.',
    },
    {
      q: 'Can I use multiple tools with one account?',
      a: 'Yes. A single consumer account can purchase credits for and hold API keys across multiple tools. Each tool has its own separate balance, budget limits, and API keys. The Consumer Dashboard shows all tool balances in one view.',
    },
    {
      q: 'How do I check my usage history?',
      a: 'The Consumer Dashboard shows per-tool balances, and the /api/consumer/usage endpoint returns detailed invocation history with timestamps, methods, and costs. The /api/consumer/usage/analytics endpoint provides aggregated usage statistics.',
    },
    {
      q: 'Can I set up consumer alerts?',
      a: 'Yes. The /api/consumer/alerts endpoint lets you create and manage alerts for events like low balance thresholds, budget limit warnings, or unusual usage patterns. Alerts trigger email notifications when conditions are met.',
    },
  ],
},
{
  title: 'Developer Dashboard',
  faqs: [
    {
      q: 'How do I read my analytics dashboard?',
      a: 'The developer dashboard at /dashboard shows total revenue, invocation count, active consumers, and tool health at a glance. The /dashboard/analytics page provides detailed time-series charts for invocations, revenue, and latency percentiles.',
    },
    {
      q: 'How do fraud risk scores work?',
      a: 'The /dashboard/fraud page shows flagged invocations from the three-signal detection system. Each flag includes the fraud signal type (rate spike, new-key velocity, or rapid duplicate), risk score, and recommended action. You can review and dismiss flags or revoke compromised keys.',
    },
    {
      q: 'Can I export my data as CSV?',
      a: 'Yes. Developers can export analytics data and audit logs as CSV from the dashboard. The audit log export endpoint (/api/audit-log/export) produces a CSV file with all logged actions, resource types, IPs, and timestamps. Available on Scale plan and above.',
    },
    {
      q: 'How do I activate or deactivate a tool?',
      a: 'From /dashboard/tools, toggle the tool status via the status switch. Deactivated tools stop accepting API calls and consumers receive errors. Both statuses trigger an email notification and a tool.status_changed webhook event.',
    },
    {
      q: 'What is the conversion funnel?',
      a: 'The /api/dashboard/developer/stats/funnel endpoint shows your conversion funnel: how many visitors view your storefront, how many create keys, how many make their first purchase, and how many become repeat users. Use this to optimize your tool\'s onboarding.',
    },
    {
      q: 'What is the attribution dashboard?',
      a: 'The /api/dashboard/developer/stats/attribution endpoint shows where your consumers come from — direct traffic, referral links, showcase browse, or API discovery. This helps you understand which acquisition channels are most effective.',
    },
  ],
},
{
  title: 'Plans & Pricing',
  faqs: [
    {
      q: 'What plans are available?',
      a: 'Three plans: Free ($0 forever, unlimited tools, 50K ops/month), Builder ($19/month, 200K ops/month, sandbox mode, IP allowlisting), and Scale ($79/month, 2M ops/month, fraud detection, priority support). All plans use progressive take rates: 0% on first $1K/mo, scaling to 5% at $50K+. Need higher limits? Email support@settlegrid.ai.',
    },
    {
      q: 'Are there overage charges?',
      a: 'Operations continue working beyond your plan limit — we never cut off your consumers. On the Free tier, the progressive take rate applies to operations above 50,000/month. On paid tiers, overage operations are rate-limited. Upgrade anytime to increase your limit.',
    },
    {
      q: 'Can I switch plans at any time?',
      a: 'Yes. You can upgrade or downgrade your plan at any time from your dashboard. Changes take effect at the start of your next billing cycle. Conversion events (upgrades, downgrades, churn) are tracked for your analytics.',
    },
    {
      q: 'Which features require a paid plan?',
      a: 'Sandbox mode, IP allowlisting, CSV export, and referral system require Builder ($19/mo) or above. Fraud detection, audit logging, and dedicated support require Scale ($79/mo). All other features including per-method pricing, webhooks, and the showcase are available on all plans.',
    },
  ],
},
{
  title: 'Compliance & Data',
  faqs: [
    {
      q: 'Is SettleGrid SOC 2 ready?',
      a: 'Yes. SettleGrid is built with SOC 2 readiness in mind. All API routes have rate limiting and Zod input validation, API keys are SHA-256 hashed at rest, webhooks are HMAC-signed, and a full audit log with CSV export provides the evidence trail auditors require.',
    },
    {
      q: 'How do I request a data export or deletion?',
      a: 'SettleGrid supports GDPR compliance exports. You can request a data export (all your data in a downloadable format) or a data deletion (removes your personal data) through the API. You receive an email when the export is ready for download.',
    },
    {
      q: 'What security headers does SettleGrid use?',
      a: 'SettleGrid enforces Content Security Policy (CSP), HSTS, X-Frame-Options, and CSRF protection headers. All API routes use Zod schema validation on inputs and tiered rate limiting based on your plan.',
    },
    {
      q: 'How does GDPR data deletion work?',
      a: 'Data deletion requests (GDPR Article 17, Right to Erasure) anonymize your PII across all tables — emails replaced with "deleted@anonymized," names with "[REDACTED]," IPs with "0.0.0.0." You receive an account deleted email confirming the deletion, with a 30-day data export download link if applicable.',
    },
    {
      q: 'Is there an OpenAPI specification?',
      a: 'Yes. The full SettleGrid API is documented in an OpenAPI 3.1 spec available at /api/openapi.json. This spec can be imported into Postman, Swagger UI, or any API client to explore and test all endpoints.',
    },
    {
      q: 'How is my data backed up?',
      a: 'SettleGrid\'s data is hosted on Supabase (PostgreSQL), which provides automated daily backups with point-in-time recovery (PITR) up to 7 days. Backups are encrypted at rest using AES-256. Database connections use TLS 1.2+ encryption in transit. All infrastructure runs on SOC 2 Type II certified providers.',
    },
    {
      q: 'What happens if there is a data loss event?',
      a: 'Supabase maintains automated backups that can restore data to any point within the last 7 days. Payment records are also independently stored by Stripe, providing an additional layer of redundancy for financial data. In a disaster scenario, SettleGrid can restore from Supabase backups + Stripe records.',
    },
    {
      q: 'How long are my payment records retained?',
      a: 'Payment records (payouts, purchases, settlement batches) are retained for 7 years per IRS record-keeping requirements and Stripe\'s terms of service. These records cannot be deleted even if you close your account, as they are required for tax compliance.',
    },
    {
      q: 'What data is retained after account deletion?',
      a: 'When you delete your account, all personally identifiable information (name, email, bio, avatar) is immediately anonymized. Your API keys, webhook endpoints, and Supabase auth records are deleted. However, financial records (payouts, purchases) are retained for 7 years with your developer ID anonymized. Audit logs are retained with IP addresses removed. This process completes within 90 days of your deletion request.',
    },
    {
      q: 'Can I request my data be removed from backups?',
      a: 'Supabase backups rotate automatically on a 7-day cycle. After account deletion + 7 days, your PII will no longer exist in any backup. Financial records in backups are retained per the 7-year requirement but are anonymized in the primary database.',
    },
  ],
},
{
  title: 'Account Management',
  faqs: [
    {
      q: 'How do I change my email address?',
      a: 'Update your email from the developer settings or by calling the profile API. Both your old and new email addresses receive a notification confirming the change. If you did not make the change, contact support immediately.',
    },
    {
      q: 'How do I delete my account?',
      a: 'Request account deletion through the API or by contacting support@settlegrid.ai. Your personal data is anonymized (GDPR Article 17), and you receive a confirmation email with an optional 30-day data export download link. Some data may be retained for legal compliance before permanent removal.',
    },
    {
      q: 'How do I invite team members?',
      a: 'From the organization settings, add members by email with a role (Owner, Admin, Member, or Viewer). The invitee receives an email notification with the organization name, their assigned role, and a link to the dashboard.',
    },
    {
      q: 'Can I manage email preferences?',
      a: 'Yes. Monthly summary emails and marketing notifications include an unsubscribe link. Transactional emails (security alerts, payment confirmations, payout notifications) cannot be disabled as they are essential for account security and financial records.',
    },
  ],
},
{
  title: 'Comparison & Positioning',
  faqs: [
    {
      q: 'How is SettleGrid different from Stripe Billing?',
      a: 'Stripe Billing handles subscriptions and batch invoicing for traditional SaaS. SettleGrid is purpose-built for AI services with real-time per-call metering (<50ms), multi-hop settlement for agent chains, budget enforcement, Agent Identity (KYA), and outcome-based billing — none of which Stripe supports natively.',
    },
    {
      q: 'How is SettleGrid different from Nevermined?',
      a: 'Nevermined focuses on DeFi/on-chain AI payments. SettleGrid supports both fiat (Stripe Connect) and crypto (x402) in one unified ledger, adds per-method pricing, IP allowlisting, fraud detection, sandbox mode, and Stripe Connect payouts — features Nevermined lacks.',
    },
    {
      q: 'Can I use SettleGrid with Stripe?',
      a: 'Yes. SettleGrid is built on top of Stripe. Consumer credit purchases are processed via Stripe Checkout, and developer payouts are disbursed via Stripe Connect Express. You connect your existing Stripe account — no migration required.',
    },
    {
      q: 'How is SettleGrid different from Paid.ai?',
      a: 'Paid.ai supports MCP per-call billing only. SettleGrid is the only protocol-agnostic settlement layer — supporting 15 protocols (MCP, MPP, x402, AP2, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, REST, L402 (Bitcoin Lightning), Alipay Trust, KYAPay, EMVCo, and DRAIN). Plus multi-hop settlement, agent identity, outcome-based billing, auto-refill credits, IP allowlisting, fraud detection, and progressive take rates (0% on first $1K/mo, up to 100% revenue share). One SDK. Zero vendor lock-in.',
    },
  ],
},
{
  title: 'Templates & Starters',
  faqs: [
    {
      q: 'Are there template MCP servers I can start from?',
      a: 'Yes. We publish 17 open-source template files you can fork and customize. Each is a complete, runnable TypeScript file with SettleGrid billing already wired in.\n\n**MCP Server Templates (sg.wrap()):**\n- Web Search Tool (3 cents/query) — wraps Brave Search with web and news methods.\n- Document Analyzer (4-10 cents/call) — Claude-powered full analysis, summaries, and field extraction.\n- Database Query Tool (5 cents/query) — natural language to SQL with Claude, with SQL injection protection.\n- Image Generator (8-15 cents/image) — DALL-E 3 wrapper with standard, HD, and variation methods.\n- Code Reviewer (8-15 cents/review) — Claude-powered code review, security analysis, and improvement suggestions for 16 languages.\n- Lead Enrichment (2-8 cents/call) — PeopleDataLabs company/contact enrichment and email verification.\n- Web Scraper (2-5 cents/call) — Firecrawl scraping, structured extraction, and batch scrape.\n- Speech Transcription (4-8 cents/min) — Whisper transcription with speaker detection and Claude summaries.\n- Email Outreach (1-3 cents/call) — Resend email sending, templates, and email validation.\n- Financial Data (2-5 cents/call) — Alpha Vantage quotes, historical prices, and financial statements.\n- Translation (1-3 cents/call) — DeepL translation, language detection, and batch translate.\n- Sentiment Analyzer (2-4 cents/call) — Claude sentiment scoring, batch analysis, and entity extraction.\n- PDF Processor (3-6 cents/call) — PDF text extraction, structured field parsing, and markdown conversion.\n\n**REST API Templates (settlegridMiddleware()):**\n- Next.js App Router (2-5 cents/call) — multi-method route with GET lookups and POST enrichment.\n- Express.js Middleware (3-10 cents/call) — per-route billing with search and AI analysis endpoints.\n- AI Proxy with Markup (1-8 cents/call) — resell OpenAI access with model-based pricing.\n- Dual Protocol (2-5 cents/call) — same tool exposed as both MCP handler and REST endpoint.\n\nBrowse all templates at settlegrid.ai/templates or download them directly from the /templates/ directory.',
    },
    {
      q: 'How do I use a template?',
      a: 'Download the .txt file, rename it to .ts, install the @settlegrid/mcp SDK (npm install @settlegrid/mcp), set your API keys as environment variables (e.g. SEARCH_API_KEY, ANTHROPIC_API_KEY), replace the toolSlug with your registered slug from settlegrid.ai/dashboard/tools, and run it with npx tsx server.ts. Each template includes setup instructions in the header comment.',
    },
    {
      q: 'Can I customize the pricing in a template?',
      a: 'Absolutely. Each template includes a pricing config with per-method costs. Change the defaultCostCents and individual method costs to match your margins. The templates include comments explaining the cost structure (API cost + your margin) so you can make informed pricing decisions.',
    },
    {
      q: 'Do templates show the REST middleware pattern too?',
      a: 'Yes. The 13 MCP templates use sg.wrap() and include a commented-out section showing the equivalent settlegridMiddleware() approach. Additionally, there are 4 dedicated REST API templates that use settlegridMiddleware() as the primary pattern: Next.js App Router, Express.js Middleware, AI Proxy with Markup, and Dual Protocol (MCP + REST). Choose based on whether you are building an MCP server or an HTTP API.',
    },
    {
      q: 'Do these templates work with all 15 protocols SettleGrid supports?',
      a: 'Yes. The sg.wrap() pattern used in every template automatically supports all 15 protocols: MCP, MPP (Stripe + Tempo), x402 (Coinbase), AP2 (Google), Visa TAP, UCP (Google + Shopify), ACP (OpenAI), Mastercard Agent Pay, Circle Nanopayments, and REST. You write zero protocol-specific code — SettleGrid detects the protocol from each incoming request and handles settlement automatically. One template, every protocol.',
    },
  ],
},
{
  title: 'Support',
  faqs: [
    {
      q: 'How do I get help?',
      a: 'Email support@settlegrid.ai for general questions. Platform plan customers receive dedicated priority support with a 99.9% SLA. Documentation, SDK reference, and API reference are available at settlegrid.ai/docs.',
    },
    {
      q: 'How do I handle refunds?',
      a: 'Contact support@settlegrid.ai to process refunds. Refunded credits are returned to the consumer\'s balance for the relevant tool. The corresponding revenue is deducted from the developer\'s pending balance.',
    },
    {
      q: 'How do I report a bug?',
      a: 'Report bugs via support@settlegrid.ai or open an issue on the @settlegrid/mcp GitHub repository for SDK-related issues. Include your tool slug, API key prefix (never the full key), timestamps, and any error messages.',
    },
    {
      q: 'Is the SDK open source?',
      a: 'Yes. The @settlegrid/mcp SDK is open source and available on GitHub and npm. You can inspect the source, contribute, and report issues. The SDK includes 168 tests covering key validation, metering, caching, error handling, and REST middleware.',
    },
    {
      q: 'Is there an in-app support form?',
      a: 'Yes. The /api/support endpoint accepts support requests with a subject, message, and optional category. This routes directly to the support team and creates a ticket for tracking.',
    },
    {
      q: 'Is there an AI assistant for documentation questions?',
      a: 'Yes. The /api/chat endpoint provides an AI-powered documentation assistant that can answer questions about SettleGrid features, SDK usage, and integration patterns in real time.',
    },
  ],
},
]


export default function DocsPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-gray-200 dark:border-[#2A2D3E] px-6 py-4 sticky top-0 bg-white dark:bg-[#161822] z-10">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/learn" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-56 border-r border-gray-200 dark:border-[#2A2D3E] p-6 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          <nav className="space-y-1 text-sm">
            {[
              { href: '#not-just-mcp', label: 'Not Just MCP' },
              { href: '#getting-started', label: 'Getting Started' },
              { href: '#cli-tools', label: 'CLI Tools' },
              { href: '#quick-start', label: 'Quick Start' },
              { href: '#sdk-reference', label: 'SDK Reference' },
              { href: '#api-reference', label: 'API Reference' },
              { href: '#pricing', label: 'Pricing Model' },
              { href: '#templates', label: 'Templates' },
              { href: '#discovery', label: 'Discovery' },
              { href: '#github-app', label: 'GitHub App' },
              { href: '#n8n-integration', label: 'n8n Integration' },
              { href: '#publish-action', label: 'CI/CD: Publish Action' },
              { href: '#cost-based-routing', label: 'Cost-Based Routing' },
              { href: '#mpp', label: 'MPP Payments' },
              { href: '#smart-proxy', label: 'Smart Proxy' },
              { href: '#service-templates', label: 'Service Templates' },
              { href: '#a2a-settlement', label: 'A2A Settlement' },
              { href: '#faq', label: 'FAQ' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block py-2 px-3 rounded-md text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#252836] transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 px-6 lg:px-12 py-10 max-w-3xl">
          <h1 className="text-4xl font-bold text-indigo dark:text-gray-100 mb-2">Documentation</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10">
            Everything you need to add per-call billing to your MCP tools, REST APIs, and serverless functions.
          </p>

          {/* ── Not Just MCP ─────────────────────────── */}
          <section id="not-just-mcp" className="mb-14 scroll-mt-24">
            <div className="rounded-xl border border-brand/30 bg-gradient-to-br from-brand/5 via-transparent to-transparent p-6">
              <h2 className="text-2xl font-bold text-gray-100 mb-3">Not Just MCP — SettleGrid Works with Any API</h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-4">
                While MCP is our primary focus, the SettleGrid SDK wraps <strong className="text-gray-300">any handler function</strong>. If you have a REST endpoint, an Express route, a Next.js API route, or a serverless function — SettleGrid can meter and bill it with the same two-line pattern.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">MCP servers</strong> — sg.wrap() around any tool handler</span>
                </div>
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">REST APIs</strong> — settlegridMiddleware() for Express, Fastify, Hono</span>
                </div>
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">Next.js API routes</strong> — middleware in route.ts handlers</span>
                </div>
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">Serverless functions</strong> — Vercel, AWS Lambda, Cloudflare Workers</span>
                </div>
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">AI agent endpoints</strong> — any callable function with input/output</span>
                </div>
                <div className="flex items-start gap-2 text-gray-400">
                  <span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span>
                  <span><strong className="text-gray-300">gRPC / WebSocket</strong> — wrap the handler, not the transport</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">
                The SDK&apos;s <code className="bg-[#252836] px-1.5 py-0.5 rounded">wrap()</code> function works with any async function. It extracts the API key, validates credits, runs your handler, and meters the call — regardless of protocol or framework.
              </p>
            </div>
          </section>

          {/* ── Getting Started: Zero to Revenue ─────────────────────────── */}
          <section id="getting-started" className="mb-14 scroll-mt-24">
            <div className="rounded-xl border-2 border-brand/30 bg-gradient-to-br from-[#E5A336]/5 via-transparent to-transparent p-8">
              <h2 className="text-3xl font-bold text-gray-100 mb-2">Getting Started: Zero to Revenue in 5 Minutes</h2>
              <p className="text-gray-400 mb-8">A step-by-step walkthrough from account creation to your first paid invocation.</p>

              {/* Step 1 */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex-shrink-0">1</span>
                  <h3 className="text-xl font-semibold text-gray-100">Create Your Account</h3>
                </div>
                <div className="ml-11 text-gray-400 space-y-2 text-sm leading-relaxed">
                  <p>
                    Sign up at{' '}
                    <Link href="/register" className="text-brand-text hover:text-brand-dark font-medium">settlegrid.ai/register</Link>{' '}
                    — free, no credit card required.
                  </p>
                  <p>
                    Connect your Stripe account for payouts under{' '}
                    <strong className="text-gray-300">Settings &gt; Payouts</strong>.
                    This enables automatic revenue disbursement to your bank account.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex-shrink-0">2</span>
                  <h3 className="text-xl font-semibold text-gray-100">Create Your First Tool</h3>
                </div>
                <div className="ml-11 text-gray-400 space-y-2 text-sm leading-relaxed">
                  <p>
                    Go to <strong className="text-gray-300">Dashboard &gt; Tools &gt; Create Tool</strong>.
                    Set a name, slug (URL-safe identifier), description, and price per call.
                  </p>
                  <p className="bg-[#161822] border border-[#2A2D3E] rounded-lg px-4 py-3 text-xs">
                    <strong className="text-brand-text">Pricing guidance:</strong> Most AI tools charge 1-25 cents per invocation.
                    Start low to attract early users, then adjust based on demand.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex-shrink-0">3</span>
                  <h3 className="text-xl font-semibold text-gray-100">Install the SDK</h3>
                </div>
                <div className="ml-11">
                  <CopyableCodeBlock title="Terminal" code={`npm install @settlegrid/mcp`} />
                </div>
              </div>

              {/* Step 4 */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex-shrink-0">4</span>
                  <h3 className="text-xl font-semibold text-gray-100">Wrap Your Handler</h3>
                </div>
                <div className="ml-11 text-gray-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    <strong className="text-gray-300">MCP / Function wrapper</strong> — wrap any async function with billing:
                  </p>
                  <CopyableCodeBlock title="server.ts" language="TypeScript" code={`import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-tool',
  pricing: { defaultCostCents: 5 },
})

// Your existing handler
async function myHandler(args: { query: string }) {
  const result = await doSomethingUseful(args.query)
  return result
}

// Wrap it — that's it!
export const billedHandler = sg.wrap(myHandler, { method: 'search' })`} />

                  <p className="mt-4">
                    <strong className="text-gray-300">REST / Express equivalent</strong> — use the middleware for HTTP routes:
                  </p>
                  <CopyableCodeBlock title="app.ts" language="TypeScript" code={`import { settlegridMiddleware } from '@settlegrid/mcp/rest'

app.post('/api/search', settlegridMiddleware({
  toolSlug: 'my-tool',
  pricing: { defaultCostCents: 5 },
}), (req, res) => {
  // Your handler runs after billing check
  res.json({ result: 'Hello from a monetized endpoint!' })
})`} />
                </div>
              </div>

              {/* Step 5 */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-sm font-bold flex-shrink-0">5</span>
                  <h3 className="text-xl font-semibold text-gray-100">Test &amp; Go Live</h3>
                </div>
                <div className="ml-11 text-gray-400 space-y-3 text-sm leading-relaxed">
                  <p>Create a test API key in your dashboard, then make a test invocation:</p>
                  <CopyableCodeBlock title="Terminal" code={`curl -X POST https://your-server.com/api/search \\
  -H "x-api-key: sg_test_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "test"}'`} />
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Check your dashboard — you should see the invocation appear in real time.</li>
                    <li>When ready, activate your tool and share it with consumers.</li>
                    <li>Your tool gets a public storefront at{' '}
                      <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">settlegrid.ai/tools/your-slug</code>.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 mb-8 rounded-xl overflow-hidden border border-[#2A2D3E] shadow-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Your tools appear in the Showcase after you deploy</p>
              <img
                src="/screenshots/Showcase.jpg"
                alt="SettleGrid Showcase page with published tools"
                className="w-full"
                loading="lazy"
              />
            </div>
          </section>

          {/* ── CLI Tools ─────────────────────────── */}
          <section id="cli-tools" className="mb-14 scroll-mt-24">
            <h2 className="text-2xl font-bold text-indigo dark:text-gray-100 mb-2">CLI Tools</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Three command-line tools to scaffold, discover, and integrate SettleGrid-powered services.
            </p>

            {/* Tool 1: create-settlegrid-tool */}
            <div className="mb-10">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-2">
                1. Scaffold a New Tool
              </h3>
              <CopyableCodeBlock title="Terminal" code="npx create-settlegrid-tool" />
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                Generates a complete MCP server project with SettleGrid billing, tests, Dockerfile, and README.
                Choose from <strong className="text-gray-300">4 templates</strong> (blank, rest-api, openapi, mcp-server)
                and <strong className="text-gray-300">3 deploy targets</strong> (Vercel, Docker, Railway).
                You get a production-ready project in seconds with pricing, error handling, and CI already wired in.
              </p>
            </div>

            {/* Tool 2: @settlegrid/discovery */}
            <div className="mb-10">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-2">
                2. MCP Discovery Server
              </h3>
              <CopyableCodeBlock title="Terminal" code="npx @settlegrid/discovery" />
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                Add to any MCP client so AI agents can discover SettleGrid-powered tools at runtime.
                Available tools: <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">search_tools</code>,{' '}
                <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">get_tool</code>,{' '}
                <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">list_categories</code>,{' '}
                <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">get_developer</code>.
              </p>
              <p className="text-sm text-gray-300 font-medium mt-4 mb-2">Claude Desktop configuration:</p>
              <CopyableCodeBlock title="claude_desktop_config.json" language="JSON" code={`{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"]
    }
  }
}`} />
            </div>

            {/* Tool 3: @settlegrid/mcp */}
            <div className="mb-2">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-2">
                3. Core SDK
              </h3>
              <CopyableCodeBlock title="Terminal" code="npm install @settlegrid/mcp" />
              <p className="text-sm text-gray-400 mt-3 leading-relaxed">
                The SDK. Call <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">settlegrid.init()</code> with
                your tool slug and pricing, then <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs">sg.wrap()</code> any
                async function to enable per-call billing. Works with MCP servers, REST APIs, and AI agents.
                See the{' '}
                <a href="#sdk-reference" className="text-brand-text hover:text-brand-dark font-medium">SDK Reference</a>{' '}
                for the full API.
              </p>
            </div>
          </section>

          <Section title="Quick Start" id="quick-start">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Get your first monetized tool running in under 5 minutes.</p>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">1. Install the SDK</h3>
            <CopyableCodeBlock title="Terminal" code={`npm install @settlegrid/mcp`} />

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">2. Register as a developer</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              <Link href="/register" className="text-brand-text hover:text-brand-dark">Create a developer account</Link>{' '}
              and connect your Stripe account to receive payouts.
            </p>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">3. Create a tool</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              In your dashboard, create a tool with a unique slug and pricing configuration.
            </p>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">4. Wrap your handler</h3>
            <CopyableCodeBlock title="server.ts" code={`import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      'get-forecast': { costCents: 2 },
      'get-historical': { costCents: 5 },
    },
  },
})

// Wrap any function — credits checked and deducted automatically
const getForecast = sg.wrap(
  async (args: { city: string }) => {
    const data = await fetchWeatherData(args.city)
    return { forecast: data }
  },
  { method: 'get-forecast' }
)

// Use in your MCP server
server.tool('get-forecast', getForecast)`} />

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">5. Share your tool</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Your tool gets a public storefront at{' '}
              <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">settlegrid.ai/tools/your-slug</code>.
              Consumers purchase credits and receive API keys to use your tool.
            </p>
          </Section>

          <Section title="SDK Reference" id="sdk-reference">
            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-2"><code>settlegrid.init(options)</code></h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Initialize the SDK for your tool.</p>
            <CopyableCodeBlock code={`interface InitOptions {
  toolSlug: string          // Your tool's unique slug
  apiUrl?: string           // API URL (default: https://settlegrid.ai)
  pricing: {
    defaultCostCents: number  // Default cost per call in cents
    methods?: Record<string, {
      costCents: number       // Method-specific cost
      displayName?: string    // Optional display name
    }>
  }
  debug?: boolean           // Enable debug logging
  cacheTtlMs?: number       // Key validation cache TTL (default: 5min)
  timeoutMs?: number        // API timeout (default: 5000ms)
}`} />

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2"><code>instance.wrap(handler, options?)</code></h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Wraps a function with billing middleware. The wrapped function extracts the API key,
              validates credits, executes your handler, and meters the usage.
            </p>
            <CopyableCodeBlock code={`const wrappedFn = sg.wrap(
  async (args: MyArgs) => { /* your logic */ },
  { method: 'my-method' }  // Optional: defaults to 'default'
)

// Call the wrapped function with context
const result = await wrappedFn(args, {
  headers: { 'x-api-key': 'sg_live_...' },
  // or metadata: { 'settlegrid-api-key': '...' }
})`} />

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">Error Handling</h3>
            <CopyableCodeBlock code={`import {
  InvalidKeyError,         // 401 - Invalid API key
  InsufficientCreditsError, // 402 - Not enough credits
  ToolNotFoundError,        // 404 - Tool not found
  RateLimitedError,         // 429 - Rate limited
} from '@settlegrid/mcp'

try {
  const result = await wrappedFn(args, ctx)
} catch (err) {
  if (err instanceof InsufficientCreditsError) {
    console.log(\`Need \${err.requiredCents}¢, have \${err.availableCents}¢\`)
  }
}`} />
          </Section>

          <Section title="API Reference" id="api-reference">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The SettleGrid REST API is available at{' '}
              <a href="https://settlegrid.ai/api" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-gray-100 dark:bg-[#252836] px-2 py-0.5 rounded text-xs font-mono text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand transition-colors">https://settlegrid.ai/api<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>.
            </p>
            <div className="space-y-4">
              {[
                { method: 'POST', path: '/api/auth/developer/register', desc: 'Register developer account' },
                { method: 'POST', path: '/api/auth/developer/login', desc: 'Developer login' },
                { method: 'GET', path: '/api/auth/developer/me', desc: 'Get developer profile' },
                { method: 'POST', path: '/api/tools', desc: 'Create tool' },
                { method: 'GET', path: '/api/tools', desc: 'List developer tools' },
                { method: 'PATCH', path: '/api/tools/:id', desc: 'Update tool' },
                { method: 'PATCH', path: '/api/tools/:id/status', desc: 'Toggle tool status' },
                { method: 'GET', path: '/api/tools/public/:slug', desc: 'Get tool storefront data' },
                { method: 'POST', path: '/api/sdk/validate-key', desc: 'Validate API key (SDK internal)' },
                { method: 'POST', path: '/api/sdk/meter', desc: 'Meter invocation (SDK internal)' },
                { method: 'POST', path: '/api/consumer/keys', desc: 'Create consumer API key' },
                { method: 'POST', path: '/api/billing/checkout', desc: 'Create checkout session' },
                { method: 'GET', path: '/api/payouts', desc: 'List payout history' },
                { method: 'POST', path: '/api/payouts/trigger', desc: 'Request manual payout' },
              ].map((route) => (
                <ApiEndpointRow key={route.path} method={route.method} path={route.path} desc={route.desc} />
              ))}
            </div>
          </Section>

          <Section title="Pricing Model" id="pricing">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              SettleGrid uses a simple, transparent pricing model:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-400 mb-6">
              <li><strong>Developers:</strong> Free to sign up. Set your own prices. Keep up to 100% of revenue.</li>
              <li><strong>Consumers:</strong> Prepaid credits. Purchase $5, $20, $50, or custom amounts.</li>
              <li><strong>Platform fee:</strong> Progressive take rate: 0% on first $1K/mo, 2% on $1K-$10K, 2.5% on $10K-$50K, 5% above $50K.</li>
              <li><strong>Payouts:</strong> Daily, weekly, or monthly via Stripe Connect. $1 minimum — the lowest in the industry.</li>
            </ul>
          </Section>

          <Section title="Templates" id="templates">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Open-source starter templates you can fork and customize. Each is a complete, runnable
              TypeScript file with SettleGrid billing already integrated.
            </p>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-200 mb-3">MCP Server Templates <span className="text-xs font-normal text-brand">sg.wrap()</span></h3>
            <div className="space-y-3 mb-6">
              {[
                { name: 'Web Search Tool', file: 'mcp-web-search.txt', price: '3\u00a2/query', desc: 'Brave Search API wrapper with web and news methods' },
                { name: 'Document Analyzer', file: 'mcp-document-analyzer.txt', price: '4-10\u00a2/call', desc: 'Claude-powered analysis, summaries, and field extraction' },
                { name: 'Database Query Tool', file: 'mcp-database-query.txt', price: '5\u00a2/query', desc: 'Natural language to SQL with safety validation' },
                { name: 'Image Generator', file: 'mcp-image-generator.txt', price: '8-15\u00a2/image', desc: 'DALL-E 3 wrapper with standard, HD, and variation modes' },
                { name: 'Code Reviewer', file: 'mcp-code-reviewer.txt', price: '8-15\u00a2/review', desc: 'AI code review, security scanning, and suggestions' },
                { name: 'Lead Enrichment', file: 'mcp-lead-enrichment.txt', price: '2-8\u00a2/call', desc: 'PeopleDataLabs company/contact enrichment and email verification' },
                { name: 'Web Scraper', file: 'mcp-web-scraper.txt', price: '2-5\u00a2/call', desc: 'Firecrawl-powered scraping, structured extraction, and batch scrape' },
                { name: 'Speech Transcription', file: 'mcp-speech-transcription.txt', price: '4-8\u00a2/min', desc: 'Whisper transcription with speaker detection and Claude summaries' },
                { name: 'Email Outreach', file: 'mcp-email-outreach.txt', price: '1-3\u00a2/call', desc: 'Resend email sending, templates, and MX-based validation' },
                { name: 'Financial Data', file: 'mcp-financial-data.txt', price: '2-5\u00a2/call', desc: 'Alpha Vantage quotes, historical prices, and financial statements' },
                { name: 'Translation', file: 'mcp-translation.txt', price: '1-3\u00a2/call', desc: 'DeepL translation, language detection, and batch translate (29 languages)' },
                { name: 'Sentiment Analyzer', file: 'mcp-sentiment-analyzer.txt', price: '2-4\u00a2/call', desc: 'Claude-powered sentiment scoring, batch analysis, and entity extraction' },
                { name: 'PDF Processor', file: 'mcp-pdf-processor.txt', price: '3-6\u00a2/call', desc: 'PDF text extraction, structured field parsing, and markdown conversion' },
              ].map((t) => (
                <a
                  key={t.file}
                  href={`/templates/${t.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-[#2A2D3E] hover:border-brand/40 transition-colors group"
                >
                  <div>
                    <span className="font-medium text-indigo dark:text-gray-100 group-hover:text-brand transition-colors">{t.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                  <span className="text-xs font-semibold bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5 flex-shrink-0 ml-3">{t.price}</span>
                </a>
              ))}
            </div>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-200 mb-3">REST API Templates <span className="text-xs font-normal text-brand">settlegridMiddleware()</span></h3>
            <div className="space-y-3 mb-6">
              {[
                { name: 'Next.js App Router', file: 'rest-nextjs-api.txt', price: '2-5\u00a2/call', desc: 'Multi-method route with GET lookups and POST enrichment' },
                { name: 'Express.js Middleware', file: 'rest-express-api.txt', price: '3-10\u00a2/call', desc: 'Per-route billing middleware with search and AI analysis endpoints' },
                { name: 'AI Proxy with Markup', file: 'rest-ai-proxy.txt', price: '1-8\u00a2/call', desc: 'Resell OpenAI access with model-based pricing and automatic margin' },
                { name: 'Dual Protocol (MCP + REST)', file: 'rest-dual-protocol.txt', price: '2-5\u00a2/call', desc: 'Same tool exposed as both MCP handler and REST endpoint' },
              ].map((t) => (
                <a
                  key={t.file}
                  href={`/templates/${t.file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-[#2A2D3E] hover:border-brand/40 transition-colors group"
                >
                  <div>
                    <span className="font-medium text-indigo dark:text-gray-100 group-hover:text-brand transition-colors">{t.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                  <span className="text-xs font-semibold bg-brand/10 text-brand border border-brand/20 rounded-full px-2 py-0.5 flex-shrink-0 ml-3">{t.price}</span>
                </a>
              ))}
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse all 17 templates at{' '}
              <Link href="/servers" className="text-brand-text hover:text-brand-dark font-medium">settlegrid.ai/servers</Link>.
            </p>
          </Section>

          {/* ── Discovery & Distribution ─────────────────────────── */}
          <section id="discovery" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-indigo dark:text-gray-100 mb-2">Discovery &amp; Distribution</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              SettleGrid tools are automatically discoverable across 8+ registries including the Official MCP Registry, Smithery, Glama, and Cursor Directory.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Public APIs for discovering tools, an MCP Discovery Server for AI clients, badge endpoints for README embeds, and developer profiles.
            </p>

            {/* ── Discovery API ─────────────────────────── */}
            <div className="mb-10">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-1">Discovery API</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Public endpoints — no authentication required. Base URL:{' '}
                <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs font-mono">https://settlegrid.ai</code>
              </p>

              {/* GET /api/v1/discover */}
              <div className="mb-8">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/v1/discover" desc="Search & browse tools" />
                </div>
                <div className="ml-0 text-sm text-gray-400 space-y-2">
                  <p className="text-gray-300 font-medium">Query parameters</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs" aria-label="Discovery API query parameters">
                      <thead>
                        <tr className="border-b border-[#2A2D3E]">
                          <th className="text-left py-2 pr-4 text-gray-400 font-medium">Param</th>
                          <th className="text-left py-2 pr-4 text-gray-400 font-medium">Type</th>
                          <th className="text-left py-2 text-gray-400 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-400">
                        <tr className="border-b border-[#252836]">
                          <td className="py-2 pr-4"><code className="text-brand-text">q</code></td>
                          <td className="py-2 pr-4">string</td>
                          <td className="py-2">Free-text search (name, description, tags)</td>
                        </tr>
                        <tr className="border-b border-[#252836]">
                          <td className="py-2 pr-4"><code className="text-brand-text">category</code></td>
                          <td className="py-2 pr-4">string</td>
                          <td className="py-2">Filter by category slug (e.g. <code className="bg-[#252836] px-1 rounded">data</code>, <code className="bg-[#252836] px-1 rounded">nlp</code>, <code className="bg-[#252836] px-1 rounded">finance</code>)</td>
                        </tr>
                        <tr className="border-b border-[#252836]">
                          <td className="py-2 pr-4"><code className="text-brand-text">limit</code></td>
                          <td className="py-2 pr-4">number</td>
                          <td className="py-2">Results per page, 1-100 (default: 20)</td>
                        </tr>
                        <tr className="border-b border-[#252836]">
                          <td className="py-2 pr-4"><code className="text-brand-text">offset</code></td>
                          <td className="py-2 pr-4">number</td>
                          <td className="py-2">Pagination offset (default: 0)</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4"><code className="text-brand-text">sort</code></td>
                          <td className="py-2 pr-4">string</td>
                          <td className="py-2"><code className="bg-[#252836] px-1 rounded">popular</code> | <code className="bg-[#252836] px-1 rounded">newest</code> | <code className="bg-[#252836] px-1 rounded">name</code> (default: popular)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-gray-300 font-medium mt-4">Response shape</p>
                  <CopyableCodeBlock code={`{
  "tools": [
    {
      "slug": "web-search-pro",
      "name": "Web Search Pro",
      "description": "Search the web with AI-powered relevance ranking and summarization",
      "category": "finance",
      "priceCents": 5,
      "developer": { "slug": "fieldbrief", "name": "Fieldbrief" },
      "rating": 4.8,
      "reviewCount": 42,
      "totalInvocations": 128500,
      "status": "active"
    }
  ],
  "total": 156,
  "limit": 20,
  "offset": 0,
  "hasMore": true
}`} />

                  <p className="text-gray-300 font-medium mt-4">Examples</p>
                  <CopyableCodeBlock title="cURL" code={`# Search for "weather" tools, sorted by popularity
curl "https://settlegrid.ai/api/v1/discover?q=weather&sort=popular&limit=10"

# Browse all finance tools
curl "https://settlegrid.ai/api/v1/discover?category=finance&limit=50"`} />

                  <CopyableCodeBlock title="JavaScript" language="TypeScript" code={`const res = await fetch(
  'https://settlegrid.ai/api/v1/discover?q=weather&sort=popular&limit=10'
)
const { tools, total, hasMore } = await res.json()
console.log(\`Found \${total} tools, showing \${tools.length}\`)`} />
                </div>
              </div>

              {/* GET /api/v1/discover/{slug} */}
              <div className="mb-8">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/v1/discover/{slug}" desc="Get full tool details" />
                </div>
                <div className="ml-0 text-sm text-gray-400 space-y-2">
                  <p>Returns tool info, reviews, changelog, and a ready-to-use quickStart code snippet.</p>
                  <CopyableCodeBlock code={`{
  "tool": {
    "slug": "web-search-pro",
    "name": "Web Search Pro",
    "description": "...",
    "category": "finance",
    "priceCents": 5,
    "methods": {
      "screen": { "costCents": 5 },
      "batch-screen": { "costCents": 25 }
    },
    "developer": { "slug": "fieldbrief", "name": "Fieldbrief", "reputation": 92 },
    "rating": 4.8,
    "reviewCount": 42,
    "currentVersion": "2.1.0",
    "status": "active",
    "createdAt": "2026-01-15T00:00:00Z"
  },
  "reviews": [
    { "rating": 5, "comment": "Fast and accurate", "createdAt": "2026-03-10T00:00:00Z" }
  ],
  "changelog": [
    { "version": "2.1.0", "type": "minor", "notes": "Added image search support", "date": "2026-03-01" }
  ],
  "quickStart": "import { settlegrid } from '@settlegrid/mcp'\\n\\nconst sg = settlegrid.init({\\n  toolSlug: 'web-search-pro',\\n  pricing: { defaultCostCents: 5 },\\n})\\n\\nconst screen = sg.wrap(async (args) => {\\n  // Your search logic\\n})"
}`} />

                  <CopyableCodeBlock title="cURL" code={`curl "https://settlegrid.ai/api/v1/discover/web-search-pro"`} />

                  <CopyableCodeBlock title="JavaScript" language="TypeScript" code={`const res = await fetch('https://settlegrid.ai/api/v1/discover/web-search-pro')
const { tool, reviews, changelog, quickStart } = await res.json()
console.log(tool.name, '—', tool.rating, 'stars')`} />
                </div>
              </div>

              {/* GET /api/v1/discover/categories */}
              <div className="mb-8">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/v1/discover/categories" desc="List categories with tool counts" />
                </div>
                <div className="ml-0 text-sm text-gray-400 space-y-2">
                  <CopyableCodeBlock code={`{
  "categories": [
    { "slug": "finance", "name": "Finance & Compliance", "count": 34 },
    { "slug": "data", "name": "Data & Enrichment", "count": 28 },
    { "slug": "nlp", "name": "NLP & Text", "count": 22 },
    { "slug": "code", "name": "Code & Dev Tools", "count": 19 },
    { "slug": "search", "name": "Search & Discovery", "count": 15 },
    { "slug": "image", "name": "Image & Vision", "count": 12 }
  ]
}`} />

                  <CopyableCodeBlock title="cURL" code={`curl "https://settlegrid.ai/api/v1/discover/categories"`} />

                  <CopyableCodeBlock title="JavaScript" language="TypeScript" code={`const res = await fetch('https://settlegrid.ai/api/v1/discover/categories')
const { categories } = await res.json()
categories.forEach(c => console.log(\`\${c.name}: \${c.count} tools\`))`} />
                </div>
              </div>

              {/* GET /api/v1/discover/developers/{slug} */}
              <div className="mb-8">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/v1/discover/developers/{slug}" desc="Developer profile & tools" />
                </div>
                <div className="ml-0 text-sm text-gray-400 space-y-2">
                  <CopyableCodeBlock code={`{
  "developer": {
    "slug": "fieldbrief",
    "name": "Fieldbrief",
    "bio": "Building AI infrastructure for regulated industries",
    "avatarUrl": "https://settlegrid.ai/avatars/fieldbrief.png",
    "reputation": 92,
    "tier": "Platinum",
    "totalTools": 6,
    "totalConsumers": 1840,
    "joinedAt": "2026-01-10T00:00:00Z"
  },
  "tools": [
    { "slug": "web-search-pro", "name": "Web Search Pro", "rating": 4.8, "priceCents": 5 },
    { "slug": "data-enrichment", "name": "Data Enrichment API", "rating": 4.7, "priceCents": 10 }
  ]
}`} />

                  <CopyableCodeBlock title="cURL" code={`curl "https://settlegrid.ai/api/v1/discover/developers/fieldbrief"`} />

                  <CopyableCodeBlock title="JavaScript" language="TypeScript" code={`const res = await fetch('https://settlegrid.ai/api/v1/discover/developers/fieldbrief')
const { developer, tools } = await res.json()
console.log(\`\${developer.name} (\${developer.tier}) — \${tools.length} tools\`)`} />
                </div>
              </div>
            </div>

            {/* ── MCP Discovery Server ─────────────────────────── */}
            <div className="mb-10">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-1">MCP Discovery Server</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Let AI clients discover and evaluate SettleGrid tools via the Model Context Protocol.
                Package: <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs font-mono">@settlegrid/discovery</code>
              </p>

              <p className="text-gray-300 text-sm font-medium mb-2">Install</p>
              <CopyableCodeBlock title="Terminal" code={`# Run directly (no install)
npx @settlegrid/discovery

# Or install globally
npm install -g @settlegrid/discovery`} />

              <p className="text-gray-300 text-sm font-medium mt-6 mb-2">Claude Desktop configuration</p>
              <p className="text-sm text-gray-400 mb-2">
                Add to <code className="bg-[#252836] px-1.5 py-0.5 rounded text-xs font-mono">~/Library/Application Support/Claude/claude_desktop_config.json</code>:
              </p>
              <CopyableCodeBlock title="claude_desktop_config.json" code={`{
  "mcpServers": {
    "settlegrid-discovery": {
      "command": "npx",
      "args": ["-y", "@settlegrid/discovery"],
      "env": {
        "SETTLEGRID_API_URL": "https://settlegrid.ai"
      }
    }
  }
}`} />

              <p className="text-gray-300 text-sm font-medium mt-6 mb-2">Available MCP tools</p>
              <div className="space-y-3 mb-4">
                {[
                  {
                    name: 'search_tools',
                    desc: 'Search the SettleGrid marketplace by keyword, category, or sort order. Returns tool names, slugs, ratings, and pricing.',
                    params: 'q, category, limit, offset, sort',
                  },
                  {
                    name: 'get_tool',
                    desc: 'Get full details for a tool by slug, including reviews, changelog, and a quickStart code snippet ready to copy into a project.',
                    params: 'slug',
                  },
                  {
                    name: 'list_categories',
                    desc: 'List all tool categories with the number of active tools in each. Useful for browsing the marketplace.',
                    params: '(none)',
                  },
                  {
                    name: 'get_developer',
                    desc: 'Get a developer profile including reputation tier, bio, and published tools.',
                    params: 'slug',
                  },
                ].map((tool) => (
                  <div key={tool.name} className="p-3 rounded-lg border border-[#2A2D3E] bg-[#161822]">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono text-brand-text">{tool.name}</code>
                      <span className="text-xs text-gray-500">params: {tool.params}</span>
                    </div>
                    <p className="text-xs text-gray-400">{tool.desc}</p>
                  </div>
                ))}
              </div>

              <p className="text-gray-300 text-sm font-medium mt-6 mb-2">Environment variables</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs mb-2" aria-label="MCP Discovery Server environment variables">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Variable</th>
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Default</th>
                      <th className="text-left py-2 text-gray-400 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    <tr>
                      <td className="py-2 pr-4"><code className="text-brand-text">SETTLEGRID_API_URL</code></td>
                      <td className="py-2 pr-4"><code className="bg-[#252836] px-1 rounded">https://settlegrid.ai</code></td>
                      <td className="py-2">Base URL for the Discovery API. Override for self-hosted or staging.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Badge API ─────────────────────────── */}
            <div className="mb-10">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-1">Badge API</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                SVG badges for READMEs, docs, and marketing pages. All endpoints return <code className="bg-[#252836] px-1 py-0.5 rounded text-xs font-mono">image/svg+xml</code> and are CDN-cacheable.
              </p>

              {/* README Badges — quick-copy section */}
              <div className="mb-8 rounded-lg border border-brand/20 bg-brand/5 p-5">
                <h4 className="text-base font-semibold text-gray-100 mb-1">README Badges</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Copy these Markdown snippets into your GitHub README, docs, or website. Each badge is a clickable link
                  that directs visitors to your tool or profile on SettleGrid.
                </p>

                <div className="space-y-4">
                  {/* 1. Tool status badge */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1.5">Tool status badge</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Shows your tool name and live status. Green when active, gray when draft.
                      Replace <code className="bg-[#252836] px-1 py-0.5 rounded text-xs font-mono">your-tool-slug</code> with your actual slug.
                    </p>
                    <CopyableCodeBlock title="Markdown" code={`[![SettleGrid](https://settlegrid.ai/api/badge/tool/your-tool-slug)](https://settlegrid.ai/tools/your-tool-slug)`} />
                  </div>

                  {/* 2. Developer reputation badge */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1.5">Developer reputation badge</p>
                    <p className="text-xs text-gray-500 mb-2">
                      Shows your name and reputation tier (Bronze, Silver, Gold, or Platinum).
                      Replace <code className="bg-[#252836] px-1 py-0.5 rounded text-xs font-mono">your-dev-slug</code> with your developer slug.
                    </p>
                    <CopyableCodeBlock title="Markdown" code={`[![SettleGrid Developer](https://settlegrid.ai/api/badge/dev/your-dev-slug)](https://settlegrid.ai/dev/your-dev-slug)`} />
                  </div>

                  {/* 3. Powered by badge */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-1.5">Powered by SettleGrid</p>
                    <p className="text-xs text-gray-500 mb-2">
                      A generic badge that works in any project. Links back to SettleGrid.
                    </p>
                    <CopyableCodeBlock title="Markdown" code={`[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)`} />
                  </div>
                </div>
              </div>

              {/* Powered by badge — endpoint details */}
              <div className="mb-6">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/badge/powered-by" desc="Generic 'Powered by SettleGrid' badge" />
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>Embed in any Markdown file:</p>
                  <CopyableCodeBlock title="Markdown" code={`[![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)](https://settlegrid.ai)`} />
                  <CopyableCodeBlock title="HTML" code={`<a href="https://settlegrid.ai">
  <img src="https://settlegrid.ai/api/badge/powered-by" alt="Powered by SettleGrid" />
</a>`} />
                </div>
              </div>

              {/* Tool badge */}
              <div className="mb-6">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/badge/tool/{slug}" desc="Tool-specific status badge" />
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>
                    Shows tool name and status. Color reflects status:{' '}
                    <span className="text-amber-400">green</span> for active,{' '}
                    <span className="text-gray-500">gray</span> for draft.
                    Wrapping in a link makes the badge clickable:
                  </p>
                  <CopyableCodeBlock title="Markdown" code={`[![Web Search Pro](https://settlegrid.ai/api/badge/tool/web-search-pro)](https://settlegrid.ai/tools/web-search-pro)`} />
                </div>
              </div>

              {/* Developer badge */}
              <div className="mb-6">
                <div className="space-y-1 mb-3">
                  <ApiEndpointRow method="GET" path="/api/badge/dev/{slug}" desc="Developer reputation badge" />
                </div>
                <div className="text-sm text-gray-400 space-y-2">
                  <p>
                    Shows developer name and reputation tier. Tier colors:{' '}
                    <span className="text-amber-700">Bronze</span>,{' '}
                    <span className="text-gray-300">Silver</span>,{' '}
                    <span className="text-yellow-400">Gold</span>,{' '}
                    <span className="text-purple-300">Platinum</span>.
                  </p>
                  <CopyableCodeBlock title="Markdown" code={`[![Fieldbrief on SettleGrid](https://settlegrid.ai/api/badge/dev/fieldbrief)](https://settlegrid.ai/dev/fieldbrief)`} />
                </div>
              </div>
            </div>

            {/* ── Developer Profiles ─────────────────────────── */}
            <div className="mb-2">
              <h3 className="text-xl font-semibold text-indigo dark:text-gray-100 mb-1">Developer Profiles</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Public profiles at{' '}
                <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs font-mono">settlegrid.ai/dev/{'{'}<span className="text-brand-text">slug</span>{'}'}</code>{' '}
                showcase your tools, reputation, and track record.
              </p>

              <p className="text-gray-300 text-sm font-medium mb-2">How to enable</p>
              <ol className="list-decimal list-inside text-sm text-gray-400 space-y-1 mb-6">
                <li>Go to <strong className="text-gray-300">Dashboard &gt; Settings &gt; Profile</strong></li>
                <li>Toggle <strong className="text-gray-300">Public Profile</strong> on</li>
                <li>Set a unique <strong className="text-gray-300">slug</strong> (lowercase, hyphens allowed)</li>
                <li>Your profile is live at <code className="bg-[#252836] px-1 py-0.5 rounded text-xs font-mono">settlegrid.ai/dev/your-slug</code></li>
              </ol>

              <p className="text-gray-300 text-sm font-medium mb-2">Reputation tiers</p>
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-xs" aria-label="Developer reputation tiers">
                  <thead>
                    <tr className="border-b border-[#2A2D3E]">
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Tier</th>
                      <th className="text-left py-2 pr-4 text-gray-400 font-medium">Score range</th>
                      <th className="text-left py-2 text-gray-400 font-medium">Badge color</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-400">
                    <tr className="border-b border-[#252836]">
                      <td className="py-2 pr-4 font-medium text-amber-700">Bronze</td>
                      <td className="py-2 pr-4">0 &ndash; 39</td>
                      <td className="py-2"><span className="inline-block w-3 h-3 rounded-full bg-amber-700 mr-1 align-middle" /> Amber</td>
                    </tr>
                    <tr className="border-b border-[#252836]">
                      <td className="py-2 pr-4 font-medium text-gray-300">Silver</td>
                      <td className="py-2 pr-4">40 &ndash; 59</td>
                      <td className="py-2"><span className="inline-block w-3 h-3 rounded-full bg-gray-400 mr-1 align-middle" /> Gray</td>
                    </tr>
                    <tr className="border-b border-[#252836]">
                      <td className="py-2 pr-4 font-medium text-yellow-400">Gold</td>
                      <td className="py-2 pr-4">60 &ndash; 79</td>
                      <td className="py-2"><span className="inline-block w-3 h-3 rounded-full bg-yellow-400 mr-1 align-middle" /> Yellow</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 font-medium text-purple-300">Platinum</td>
                      <td className="py-2 pr-4">80 &ndash; 100</td>
                      <td className="py-2"><span className="inline-block w-3 h-3 rounded-full bg-purple-400 mr-1 align-middle" /> Purple</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-gray-300 text-sm font-medium mb-2">How reputation affects discovery</p>
              <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                <li>Tools from higher-reputation developers rank higher in search results when sorted by <code className="bg-[#252836] px-1 py-0.5 rounded text-xs font-mono">popular</code></li>
                <li>Platinum and Gold developers receive a verified badge on their tool storefronts</li>
                <li>Reputation is calculated from tool uptime, average review rating, response time, and payout consistency</li>
                <li>New developers start at 0 and earn points organically — reputation cannot be purchased</li>
              </ul>
            </div>

            {/* ── Discovery guide cross-link ─────────────────────────── */}
            <div className="mt-8 rounded-lg border border-amber-500/20 bg-amber-500/5 px-5 py-4 text-sm text-gray-400">
              For a step-by-step guide to maximizing your tool&apos;s visibility, see{' '}
              <Link
                href="/learn/discovery"
                className="text-amber-400 hover:underline font-medium"
              >
                How to Get Discovered
              </Link>
              .
            </div>
          </section>

          {/* ── GitHub App Integration ─────────────────────────── */}
          <Section title="GitHub App Integration" id="github-app">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Install the SettleGrid GitHub App to automatically discover and list MCP servers from your repositories. Push code, get listed.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                <li>Install the app at{' '}
                  <a href="https://github.com/apps/settlegrid" target="_blank" rel="noopener noreferrer" className="text-brand-text hover:text-brand-dark font-medium">github.com/apps/settlegrid</a>
                </li>
                <li>Grant access to your repositories (all or selected)</li>
                <li>SettleGrid scans for <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">@settlegrid/mcp</code> usage</li>
                <li>Tools are auto-created as draft listings on your dashboard</li>
                <li>Every push to main triggers a re-scan and metadata sync</li>
              </ol>
            </div>
            <p className="text-sm text-gray-400">
              No code changes, no configuration files, no webhooks to set up. Read the{' '}
              <Link href="/learn/github-app" className="text-brand-text hover:text-brand-dark font-medium">full GitHub App guide</Link>.
            </p>
          </Section>

          {/* ── n8n Integration ─────────────────────────── */}
          <Section title="n8n Integration" id="n8n-integration">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Use SettleGrid tools in n8n workflows with the official community node. Discover, invoke, and manage billing for any SettleGrid tool directly from your n8n automations.
            </p>
            <CopyableCodeBlock title="Terminal" code="npm install n8n-nodes-settlegrid" />
            <div className="mt-6 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">Available Operations</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-start gap-2"><span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span><span><strong className="text-gray-300">List Tools</strong> — Browse all available SettleGrid tools with filtering</span></div>
                <div className="flex items-start gap-2"><span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span><span><strong className="text-gray-300">Get Tool</strong> — Retrieve full details for a specific tool by slug</span></div>
                <div className="flex items-start gap-2"><span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span><span><strong className="text-gray-300">List Categories</strong> — Get all tool categories with counts</span></div>
                <div className="flex items-start gap-2"><span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span><span><strong className="text-gray-300">List Servers</strong> — Browse MCP server listings</span></div>
                <div className="flex items-start gap-2"><span className="text-brand-text mt-0.5 shrink-0 font-bold">&#10003;</span><span><strong className="text-gray-300">Get Server</strong> — Get MCP server details and pricing extensions</span></div>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              View the package on{' '}
              <a href="https://www.npmjs.com/package/n8n-nodes-settlegrid" target="_blank" rel="noopener noreferrer" className="text-brand-text hover:text-brand-dark font-medium">npm</a>.
              n8n has 400K+ users building AI automations — your tools are instantly available to all of them.
            </p>
          </Section>

          {/* ── CI/CD: Publish Action ─────────────────────────── */}
          <Section title="CI/CD: Publish Action" id="publish-action">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Automate tool publishing with the SettleGrid GitHub Action. Add it to your CI/CD pipeline to publish or update tools on every push to main.
            </p>
            <CopyableCodeBlock title=".github/workflows/publish.yml" language="YAML" code={`name: Publish to SettleGrid
on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: settlegrid/publish-action@v1
        with:
          api-key: \${{ secrets.SETTLEGRID_API_KEY }}`} />
            <div className="mt-6 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">What It Does</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-gray-400">
                <li>Reads your tool configuration from <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">settlegrid.json</code> or package.json</li>
                <li>Creates or updates your tool listing on the SettleGrid registry</li>
                <li>Syncs metadata (name, description, version, pricing) automatically</li>
                <li>Reports publish status back to the GitHub Actions workflow</li>
              </ul>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              View the action on{' '}
              <a href="https://github.com/marketplace/actions/settlegrid-publish" target="_blank" rel="noopener noreferrer" className="text-brand-text hover:text-brand-dark font-medium">GitHub Marketplace</a>.
            </p>
          </Section>

          {/* ── Cost-Based Routing ─────────────────────────── */}
          <Section title="Cost-Based Routing" id="cost-based-routing">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Agents automatically find the cheapest tool meeting their quality thresholds. SettleGrid&apos;s routing engine compares price, latency, and reliability across all providers and routes to the optimal endpoint — with automatic fallback chains.
            </p>
            <CopyableCodeBlock title="cURL" code={`# Find the cheapest weather tool with at least 3-star rating
curl "https://settlegrid.ai/api/v1/discover/route?q=weather&max_cost=10&min_rating=3"

# Response includes a ranked list of alternatives
{
  "primary": { "slug": "weather-basic", "costCents": 2, "rating": 4.2 },
  "fallbacks": [
    { "slug": "weather-pro", "costCents": 5, "rating": 4.8 },
    { "slug": "weather-enterprise", "costCents": 10, "rating": 4.9 }
  ]
}`} />
            <div className="mt-6 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">Why This Is Unique</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Cost-based routing requires a complete catalog of tools <em>and</em> their real-time pricing data. SettleGrid is the only platform that combines a tool registry, pricing metadata, and quality scores in a single queryable API — making intelligent routing possible for the first time.
              </p>
            </div>
            <CopyableCodeBlock title="TypeScript" language="TypeScript" code={`// Agent uses cost-based routing to find the cheapest tool
const route = await fetch(
  'https://settlegrid.ai/api/v1/discover/route?q=search&max_cost=5&min_rating=3'
).then(r => r.json())

// Call the primary tool, fall back if it fails
try {
  const result = await callTool(route.primary.slug, args)
} catch {
  for (const fallback of route.fallbacks) {
    try {
      const result = await callTool(fallback.slug, args)
      break
    } catch { continue }
  }
}`} />
          </Section>

          {/* ── Accepting MPP Payments ─────────────────────────── */}
          <Section title="Accepting MPP Payments" id="mpp">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              SettleGrid natively accepts Stripe MPP (Machine Payments Protocol) Shared Payment Tokens alongside traditional API keys. Any agent using Stripe MPP can pay for your SettleGrid tools seamlessly — zero configuration required.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">How MPP Works with SettleGrid</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                <li>An MPP agent calls your tool&apos;s proxy URL without payment</li>
                <li>SettleGrid returns HTTP 402 with MPP headers: <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">X-Payment-Protocol: MPP/1.0</code>, <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">X-Payment-Amount: 500</code></li>
                <li>The agent obtains a Stripe Shared Payment Token (SPT) and re-sends the request with <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">X-Payment-Token: spt_...</code></li>
                <li>SettleGrid validates the SPT with Stripe, captures the payment, and forwards the request to your tool</li>
                <li>Your tool processes the request normally — the response is streamed back to the agent</li>
              </ol>
            </div>
            <CopyableCodeBlock title="MPP Agent (cURL)" code={`# Step 1: Call without payment — get 402 with pricing
curl -X POST https://settlegrid.ai/api/proxy/your-tool \\
  -H "X-Payment-Protocol: MPP/1.0" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "example"}'

# Response: 402 Payment Required
# X-Payment-Protocol: MPP/1.0
# X-Payment-Amount: 500
# X-Payment-Currency: USD

# Step 2: Re-send with valid Stripe SPT
curl -X POST https://settlegrid.ai/api/proxy/your-tool \\
  -H "X-Payment-Protocol: MPP/1.0" \\
  -H "X-Payment-Token: spt_live_abc123..." \\
  -H "X-Payment-Amount: 500" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "example"}'

# Response: 200 OK (tool result)
# X-SettleGrid-Payment-Method: mpp
# X-SettleGrid-MPP-Payment-Id: pi_xxx
# X-SettleGrid-Cost-Cents: 500`} />
            <div className="mt-6 bg-[#161822] border border-[#2A2D3E] rounded-xl p-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">Key Details</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <p><strong className="text-gray-300">Dual payment</strong> — Tools accept both MPP (SPT) and traditional API key payments. No code changes needed on the developer side.</p>
                <p><strong className="text-gray-300">Standard 402 flow</strong> — When payment is missing, SettleGrid returns a proper MPP 402 response with pricing headers so agents can negotiate.</p>
                <p><strong className="text-gray-300">Stripe settlement</strong> — MPP payments settle through Stripe. Developers receive payouts via Stripe Connect alongside API key revenue.</p>
                <p><strong className="text-gray-300">MPP directory</strong> — SettleGrid publishes a <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">/.well-known/mpp.json</code> manifest for automatic service discovery.</p>
                <p><strong className="text-gray-300">Environment variable</strong> — Set <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">STRIPE_MPP_SECRET</code> to enable MPP payments. Optional — SettleGrid works without it.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              Learn more on the{' '}
              <Link href="/learn/protocols/mpp" className="text-brand-text hover:text-brand-dark font-medium">MPP protocol page</Link>.
            </p>
          </Section>

          {/* ── Smart Proxy ─────────────────────────── */}
          <Section title="Smart Proxy" id="smart-proxy">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Zero-code billing. Point any API at the SettleGrid Smart Proxy — authentication, balance checks, and metering happen transparently. No SDK, no code changes.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">How It Works</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
                <li>Register your API endpoint URL on SettleGrid</li>
                <li>Get a proxied URL: <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">settlegrid.ai/api/proxy/your-tool</code></li>
                <li>Consumers call the proxy URL with their SettleGrid API key</li>
                <li>Smart Proxy validates the key, checks balance, forwards to your server, meters the call</li>
                <li>Your server receives the request normally — no SDK needed</li>
              </ol>
            </div>
            <CopyableCodeBlock title="cURL" code={`# Consumer calls your tool through the Smart Proxy
curl -X POST https://settlegrid.ai/api/proxy/your-tool \\
  -H "x-api-key: sg_live_consumer_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "example"}'

# Your server receives the request with billing handled automatically`} />
            <p className="text-sm text-gray-400 mt-4">
              Smart Proxy supports streaming (SSE), handles authentication, enforces budget limits, and works with any HTTP API. Available on the Scale plan.
            </p>
          </Section>

          {/* ── Service Templates ─────────────────────────── */}
          <Section title="Service Templates" id="service-templates">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Six ready-to-deploy non-MCP service templates for common AI service patterns. Each template is a complete project you can fork and customize.
            </p>
            <div className="space-y-3">
              {[
                { name: 'LLM Proxy', desc: 'Resell OpenAI/Anthropic access with automatic markup pricing and model selection' },
                { name: 'Browser Scraper', desc: 'Headless browser automation for web scraping and data extraction' },
                { name: 'Image Generator', desc: 'Wrap image generation APIs (DALL-E, Stable Diffusion) with per-image billing' },
                { name: 'Email Sender', desc: 'Transactional email service with template management and per-send billing' },
                { name: 'Code Sandbox', desc: 'Secure code execution environment with per-run billing and resource limits' },
                { name: 'Search API', desc: 'Full-text search service with indexing and per-query billing' },
              ].map((t) => (
                <div key={t.name} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-[#2A2D3E]">
                  <div>
                    <span className="font-medium text-indigo dark:text-gray-100">{t.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-400 mt-4">
              View source code on{' '}
              <a href="https://github.com/lexwhiting/settlegrid/tree/staging/nuclear-expansion/scripts/service-templates" target="_blank" rel="noopener noreferrer" className="text-brand-text hover:text-brand-dark font-medium">GitHub</a>.
            </p>
          </Section>

          {/* ── Agent-to-Agent Settlement ─────────────────────────── */}
          <Section title="Agent-to-Agent Settlement" id="a2a-settlement">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Native support for Google&apos;s Agent-to-Agent (A2A) protocol and multi-hop settlement. When Agent A calls Agent B which calls Agent C, SettleGrid tracks the entire chain and settles all hops atomically.
            </p>
            <div className="bg-[#161822] border border-[#2A2D3E] rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-3">Multi-Hop Settlement</h3>
              <div className="space-y-3 text-sm text-gray-400">
                <p><strong className="text-gray-300">Workflow sessions</strong> — Budget-capped containers for multi-agent workflows. Create a session, delegate budgets to sub-agents, track every hop.</p>
                <p><strong className="text-gray-300">Atomic settlement</strong> — All hops settle together or none do. If any hop fails, the entire workflow rolls back. No partial payments.</p>
                <p><strong className="text-gray-300">Budget delegation</strong> — Parent agents delegate budgets to child agents. Unused budget returns to the parent automatically.</p>
                <p><strong className="text-gray-300">A2A skills discovery</strong> — Your tools are automatically discoverable by A2A-compatible agents via the <code className="bg-[#252836] px-1 py-0.5 rounded text-xs">/api/a2a/skills</code> endpoint.</p>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Learn more in the{' '}
              <Link href="/solutions/agent-to-agent" className="text-brand-text hover:text-brand-dark font-medium">Agent-to-Agent solutions page</Link>.
            </p>
          </Section>

          <Section title="FAQ" id="faq">
            <FaqAccordion categories={faqCategories} />
          </Section>
        </main>
      </div>

      <footer className="border-t border-gray-200 dark:border-[#2A2D3E] px-6 py-6">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
