/**
 * Solution definitions for AI service category landing pages.
 *
 * Each solution maps to an ai-service category in categories.ts
 * and powers the /solutions/[category] dynamic route.
 *
 * Used by:
 *   - /solutions            (hub page)
 *   - /solutions/[category] (solution landing pages)
 *   - sitemap.ts            (auto-generated sitemap entries)
 */

export interface SolutionProvider {
  name: string
  description: string
}

export interface SolutionFAQ {
  q: string
  a: string
}

export interface SolutionDefinition {
  slug: string
  headline: string
  subtext: string
  codeExample: string
  providers: SolutionProvider[]
  billingModel: string
  billingModelExplanation: string
  tam: string
  keywords: string[]
  faqEntries: SolutionFAQ[]
}

export const SOLUTIONS: SolutionDefinition[] = [
  // ── 1. LLM Inference ──────────────────────────────────────────────────────
  {
    slug: 'llm-inference',
    headline: 'Per-Token Billing for LLM Inference in 2 Lines of Code',
    subtext:
      'Meter every OpenAI, Anthropic, and Google API call. Set per-token budgets, track cross-provider costs, and bill your users automatically. Works with any LLM SDK.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'
import OpenAI from 'openai'

const sg = settlegrid.init({
  toolSlug: 'my-llm-proxy',
  pricing: { model: 'per-token', inputCostPer1k: 0.3, outputCostPer1k: 1.2 },
})

const openai = new OpenAI()

const billedCompletion = sg.wrap(async (args: { prompt: string }) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: args.prompt }],
  })
  return { content: [{ type: 'text', text: response.choices[0].message.content }] }
})`,
    providers: [
      { name: 'OpenAI', description: 'GPT-4o, GPT-4o-mini, o1, o3 -- $2-60/M tokens' },
      { name: 'Anthropic', description: 'Claude Opus, Sonnet, Haiku -- $0.25-75/M tokens' },
      { name: 'Google Gemini', description: 'Gemini 2.5 Pro, Flash -- $1.25-10/M tokens' },
      { name: 'DeepSeek', description: 'DeepSeek V3, R1 -- $0.14-2.19/M tokens' },
      { name: 'Groq', description: 'Llama, Mixtral on LPU -- $0.04-0.88/M tokens' },
      { name: 'Together AI', description: '100+ open models -- $0.10-18/M tokens' },
      { name: 'Fireworks AI', description: 'Optimized inference -- $0.10-3/M tokens' },
    ],
    billingModel: 'per-token',
    billingModelExplanation:
      'LLM inference costs scale with token usage. Per-token billing lets you pass through exact costs to end users, set per-user budget caps, and automatically track input vs output token spend across multiple providers. SettleGrid meters tokens from the response metadata and settles in real time, so you never eat costs from runaway prompts.',
    tam: '$106B inference market (2025)',
    keywords: [
      'LLM API billing', 'AI inference metering', 'OpenAI billing wrapper',
      'per-token billing', 'LLM cost management', 'AI agent budget controller',
      'cross-provider AI billing', 'Anthropic billing', 'Gemini billing',
    ],
    faqEntries: [
      {
        q: 'How does per-token billing work with SettleGrid?',
        a: 'SettleGrid reads the token counts from the LLM response (usage.prompt_tokens and usage.completion_tokens) and applies your configured input/output rates. Settlement happens atomically before the response is returned to the caller.',
      },
      {
        q: 'Can I set per-user budget caps?',
        a: 'Yes. SettleGrid supports per-caller budget limits at the tool level. When a user hits their cap, subsequent calls return a 402 Payment Required status instead of hitting your LLM provider.',
      },
      {
        q: 'Does this work with streaming responses?',
        a: 'Yes. For streaming completions, SettleGrid accumulates tokens across chunks and settles the full cost when the stream completes. If the stream is interrupted, you only pay for tokens actually generated.',
      },
      {
        q: 'Can I use different pricing for different models?',
        a: 'Absolutely. You can configure method-level pricing in SettleGrid, so gpt-4o calls use one rate while gpt-4o-mini calls use another. The pricing configuration supports arbitrary method names.',
      },
      {
        q: 'What if my LLM provider changes their pricing?',
        a: 'Update your SettleGrid pricing config via the dashboard or API. Changes take effect immediately for new calls. Historical settlements retain their original pricing.',
      },
    ],
  },

  // ── 2. Search & RAG ───────────────────────────────────────────────────────
  {
    slug: 'search-rag',
    headline: 'Per-Query Billing for Search and RAG Pipelines',
    subtext:
      'Bill every web search, vector retrieval, and document query your AI agents make. Per-query metering for Brave, Exa, Pinecone, Weaviate, and any search API.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-search-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      'web_search': { costCents: 2 },
      'vector_query': { costCents: 5 },
    },
  },
})

const billedSearch = sg.wrap(async (args: { query: string }) => {
  const results = await braveSearch(args.query)
  return { content: [{ type: 'text', text: JSON.stringify(results) }] }
})`,
    providers: [
      { name: 'Brave Search', description: 'Web search API -- $0.002/query' },
      { name: 'Exa', description: 'Neural search -- $0.001-0.004/query' },
      { name: 'Tavily', description: 'AI-optimized search -- $0.003/query' },
      { name: 'Pinecone', description: 'Vector database -- per-read pricing' },
      { name: 'Weaviate', description: 'Vector search -- per-query pricing' },
      { name: 'Qdrant', description: 'Open-source vector DB -- self-hosted or cloud' },
    ],
    billingModel: 'per-query',
    billingModelExplanation:
      'Search and RAG pipelines naturally bill per-query because each retrieval has a discrete cost. Whether your agent calls a web search API, runs a vector similarity query, or fetches documents from a knowledge base, SettleGrid meters each operation independently. You can set different rates for different retrieval methods.',
    tam: '$4.3B vector DB + web search',
    keywords: [
      'search API billing', 'RAG billing', 'vector database billing',
      'semantic search monetization', 'Brave search API billing',
      'Pinecone billing wrapper', 'retrieval augmented generation billing',
    ],
    faqEntries: [
      {
        q: 'Can I bill differently for web search vs vector queries?',
        a: 'Yes. SettleGrid supports method-level pricing, so you can charge 2 cents for a web search and 5 cents for a vector query. Just pass the method name when calling sg.wrap().',
      },
      {
        q: 'How does billing work for multi-step RAG pipelines?',
        a: 'Each step in your RAG pipeline (retrieval, re-ranking, generation) can be wrapped separately with its own pricing. Or wrap the entire pipeline as a single billable unit -- your choice.',
      },
      {
        q: 'What about hybrid search (keyword + vector)?',
        a: 'Wrap the hybrid search as a single operation with a combined price, or break it into separate billable calls. SettleGrid is flexible -- you define what constitutes a billable event.',
      },
      {
        q: 'Can I pass search costs through to my users?',
        a: 'Yes. Set your SettleGrid pricing to your upstream cost plus your margin. Your users see a clear per-query price, and you pocket the difference automatically.',
      },
    ],
  },

  // ── 3. Browser Automation ─────────────────────────────────────────────────
  {
    slug: 'browser-automation',
    headline: 'Per-Page Billing for Browser Automation and Web Scraping',
    subtext:
      'Monetize every page load, scrape, and browser session. Wrap Playwright, Browserbase, Firecrawl, or any headless browser with per-action billing.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'
import { chromium } from 'playwright'

const sg = settlegrid.init({
  toolSlug: 'my-scraper',
  pricing: { model: 'per-call', defaultCostCents: 10 },
})

const billedScrape = sg.wrap(async (args: { url: string }) => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(args.url)
  const content = await page.content()
  await browser.close()
  return { content: [{ type: 'text', text: content }] }
})`,
    providers: [
      { name: 'Browserbase', description: 'Managed browser sessions -- per-session pricing' },
      { name: 'Firecrawl', description: 'Web scraping API -- per-page pricing' },
      { name: 'Bright Data', description: 'Proxy + scraping -- per-request pricing' },
      { name: 'Apify', description: 'Web scraping platform -- per-compute-unit' },
      { name: 'Steel', description: 'Browser automation infra -- per-session pricing' },
    ],
    billingModel: 'per-page',
    billingModelExplanation:
      'Browser automation costs are driven by page loads, compute time, and proxy bandwidth. Per-page billing maps directly to the value delivered: each scraped page, each automated action, each browser session is a discrete billable event. SettleGrid meters these automatically so you can charge for what agents actually consume.',
    tam: '$12.34B web scraping software market',
    keywords: [
      'browser automation billing', 'web scraping billing', 'Playwright billing',
      'headless browser monetization', 'Firecrawl billing', 'Browserbase billing',
      'web scraping API pricing',
    ],
    faqEntries: [
      {
        q: 'Can I bill per-page-load instead of per-session?',
        a: 'Yes. SettleGrid lets you define your billing granularity. Wrap each page.goto() call individually for per-page billing, or wrap the entire session for per-session pricing.',
      },
      {
        q: 'How do I handle long-running browser sessions?',
        a: 'For long-running sessions, use per-second pricing mode. SettleGrid tracks the duration via the _meta.durationMs field in your response and bills accordingly.',
      },
      {
        q: 'What about proxy costs?',
        a: 'Include proxy costs in your per-page price as a bundled rate. Your users see one clean price per scrape, and you manage the proxy cost internally.',
      },
      {
        q: 'Can agents discover my scraping service automatically?',
        a: 'Yes. Registered tools appear in SettleGrid\'s discovery API. MCP-compatible agents can find and invoke your scraper with pricing visible upfront.',
      },
    ],
  },

  // ── 4. Code Execution ─────────────────────────────────────────────────────
  {
    slug: 'code-execution',
    headline: 'Per-Second Billing for Code Execution and Sandboxes',
    subtext:
      'Bill for compute time, not flat fees. Wrap E2B, Modal, AWS Lambda, or any sandbox with per-second metering and automatic budget enforcement.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-sandbox',
  pricing: { model: 'per-second', costPerSecondCents: 0.5 },
})

const billedExecution = sg.wrap(async (args: { code: string; language: string }) => {
  const startTime = Date.now()
  const result = await e2b.runCode(args.code, { language: args.language })
  const durationMs = Date.now() - startTime
  return {
    content: [{ type: 'text', text: result.output }],
    _meta: { durationMs },
  }
})`,
    providers: [
      { name: 'E2B', description: 'Firecracker sandboxes -- per-second compute' },
      { name: 'Modal', description: 'Serverless GPU/CPU -- per-second billing' },
      { name: 'Daytona', description: 'Dev environments -- per-minute billing' },
      { name: 'Vercel Sandbox', description: 'Edge compute -- per-invocation' },
      { name: 'AWS Lambda', description: 'Serverless functions -- per-ms billing' },
      { name: 'Blaxel', description: 'Managed sandboxes -- per-second compute' },
    ],
    billingModel: 'per-second',
    billingModelExplanation:
      'Code execution pricing should reflect actual compute consumed. Per-second billing is fairer than per-invocation because a 200ms script costs less than a 30-second data pipeline. SettleGrid reads the durationMs metadata from your response and bills accordingly, supporting both CPU and GPU rate cards.',
    tam: '$500M-1B sandbox market by 2028',
    keywords: [
      'code execution billing', 'sandbox billing', 'E2B billing wrapper',
      'compute metering', 'serverless billing', 'Modal billing',
      'AI sandbox pricing',
    ],
    faqEntries: [
      {
        q: 'How does per-second billing work with SettleGrid?',
        a: 'Return a _meta.durationMs field in your sg.wrap() response. SettleGrid multiplies the duration by your configured rate (e.g., 0.5 cents/second) to calculate the charge. Budget caps are enforced before execution starts.',
      },
      {
        q: 'Can I charge different rates for GPU vs CPU?',
        a: 'Yes. Use method-level pricing to define separate rates for gpu_execution and cpu_execution. SettleGrid bills at the rate matching the method name you pass.',
      },
      {
        q: 'What happens if code execution times out?',
        a: 'You control the timeout in your sandbox. If execution is killed, return the partial result with the actual duration. SettleGrid only bills for time consumed, not the full timeout window.',
      },
      {
        q: 'Is there a maximum execution time?',
        a: 'SettleGrid does not impose execution time limits -- that is up to your sandbox configuration. However, budget caps will prevent a user from running up an unlimited bill.',
      },
    ],
  },

  // ── 5. Media Generation ───────────────────────────────────────────────────
  {
    slug: 'media-generation',
    headline: 'Per-Generation Billing for Image, Video, and Audio APIs',
    subtext:
      'Monetize every image generated, every video rendered, and every voice clip synthesized. Wrap DALL-E, Stable Diffusion, Runway, ElevenLabs, or any media API.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'
import OpenAI from 'openai'

const sg = settlegrid.init({
  toolSlug: 'my-image-gen',
  pricing: { defaultCostCents: 25 },
})

const openai = new OpenAI()

const billedImageGen = sg.wrap(async (args: { prompt: string; size?: string }) => {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: args.prompt,
    size: (args.size as '1024x1024') || '1024x1024',
  })
  return { content: [{ type: 'text', text: response.data[0].url! }] }
})`,
    providers: [
      { name: 'OpenAI DALL-E', description: 'Image generation -- $0.04-0.12/image' },
      { name: 'Midjourney', description: 'Premium image gen -- subscription-based' },
      { name: 'Flux / Stable Diffusion', description: 'Open-source image gen -- per-image' },
      { name: 'Runway Gen-4', description: 'Video generation -- per-second pricing' },
      { name: 'ElevenLabs', description: 'Voice synthesis -- per-character pricing' },
      { name: 'Suno', description: 'Music generation -- per-song pricing' },
    ],
    billingModel: 'per-generation',
    billingModelExplanation:
      'Media generation has natural per-unit billing: per image, per video second, per audio character. Each generation has a clear cost tied to compute and model complexity. SettleGrid lets you set rates per generation type and pass through costs with your margin built in.',
    tam: '$3.16B image + $946M video generation',
    keywords: [
      'AI image generation billing', 'text-to-speech billing', 'media API monetization',
      'DALL-E billing wrapper', 'ElevenLabs billing', 'AI video billing',
      'Stable Diffusion billing', 'Runway billing',
    ],
    faqEntries: [
      {
        q: 'Can I charge different rates for different image sizes?',
        a: 'Yes. Use method-level pricing to set different rates for 256x256, 512x512, and 1024x1024 generations. The method name can encode the size, model, or quality level.',
      },
      {
        q: 'How do I handle video generation billing?',
        a: 'For video, use per-second pricing mode. Return the video duration in _meta.durationMs and SettleGrid calculates the charge based on your per-second rate.',
      },
      {
        q: 'What about voice synthesis (text-to-speech)?',
        a: 'Wrap your TTS API call with sg.wrap() and price per-call. For character-based pricing, calculate the character count in your wrapper and return it in _meta for transparent billing.',
      },
      {
        q: 'Can users see the price before generating?',
        a: 'Yes. SettleGrid exposes pricing in the tool discovery API, so agents and users know the cost before they invoke a generation. No surprise bills.',
      },
    ],
  },

  // ── 6. Communication APIs ─────────────────────────────────────────────────
  {
    slug: 'communication-apis',
    headline: 'Per-Message Billing for Email, SMS, and Voice APIs',
    subtext:
      'Bill for every email sent, every SMS delivered, and every voice call made. Wrap Twilio, Resend, SendGrid, or any communication API with per-message metering.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'
import { Resend } from 'resend'

const sg = settlegrid.init({
  toolSlug: 'my-email-service',
  pricing: {
    methods: {
      'send_email': { costCents: 1 },
      'send_sms': { costCents: 3 },
    },
  },
})

const resend = new Resend(process.env.RESEND_API_KEY)

const billedEmail = sg.wrap(async (args: { to: string; subject: string; body: string }) => {
  const result = await resend.emails.send({
    from: 'notifications@myapp.com',
    to: args.to,
    subject: args.subject,
    html: args.body,
  })
  return { content: [{ type: 'text', text: \`Email sent: \${result.id}\` }] }
}, { method: 'send_email' })`,
    providers: [
      { name: 'Twilio', description: 'SMS, voice, WhatsApp -- per-message pricing' },
      { name: 'SendGrid', description: 'Email delivery -- per-email pricing' },
      { name: 'Resend', description: 'Developer email API -- per-email pricing' },
      { name: 'AWS SES', description: 'Bulk email -- $0.10/1000 emails' },
      { name: 'MessageBird', description: 'Omnichannel messaging -- per-message pricing' },
    ],
    billingModel: 'per-message',
    billingModelExplanation:
      'Communication APIs have the cleanest billing model: per-message. Every email sent, every SMS delivered, every voice minute consumed maps to a single billable event. SettleGrid meters each message type at its configured rate and settles in real time. Method-level pricing lets you charge different rates for email, SMS, and voice.',
    tam: '$17.2B CPaaS market',
    keywords: [
      'email API billing', 'SMS billing', 'Twilio billing wrapper',
      'communication API monetization', 'Resend billing', 'voice API billing',
      'CPaaS billing',
    ],
    faqEntries: [
      {
        q: 'Can I charge differently for email vs SMS vs voice?',
        a: 'Yes. SettleGrid supports method-level pricing. Configure send_email at 1 cent, send_sms at 3 cents, and make_call at 10 cents -- each billed independently.',
      },
      {
        q: 'How do I handle voice call billing (per-minute)?',
        a: 'For voice calls, use per-second pricing and return the call duration in _meta.durationMs. SettleGrid calculates the charge based on actual call length.',
      },
      {
        q: 'What about bulk sending discounts?',
        a: 'You can implement tiered pricing by adjusting rates based on volume thresholds in your wrapper logic. SettleGrid bills at whatever rate you configure per-call.',
      },
      {
        q: 'Do agents need to authenticate to send messages?',
        a: 'Yes. SettleGrid requires caller authentication for all billed operations. This prevents unauthorized usage and ensures every message is tied to a paying user.',
      },
    ],
  },

  // ── 7. Agent-to-Agent ─────────────────────────────────────────────────────
  {
    slug: 'agent-to-agent',
    headline: 'Multi-Hop Settlement for Agent-to-Agent Workflows',
    subtext:
      'When Agent A calls Agent B calls Agent C, every hop needs billing. SettleGrid\'s atomic multi-hop settlement is the only system that handles the full chain.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'research-agent',
  pricing: { model: 'per-call', defaultCostCents: 50 },
})

// This agent delegates to sub-agents -- each hop is metered
const billedResearch = sg.wrap(async (args: { topic: string }) => {
  // Sub-agent 1: Search (billed separately via its own sg.wrap)
  const searchResults = await callAgent('search-agent', { query: args.topic })
  // Sub-agent 2: Summarize (billed separately)
  const summary = await callAgent('summarize-agent', { text: searchResults })
  // Multi-hop settlement: all 3 agents are paid atomically
  return { content: [{ type: 'text', text: summary }] }
})`,
    providers: [
      { name: 'CrewAI', description: 'Multi-agent orchestration framework' },
      { name: 'LangGraph', description: 'Stateful agent workflows by LangChain' },
      { name: 'AutoGen', description: 'Multi-agent conversations by Microsoft' },
      { name: 'Google A2A', description: 'Agent-to-Agent protocol by Google' },
      { name: 'Anthropic Tool Use', description: 'Sequential tool chains via Claude' },
    ],
    billingModel: 'per-delegation',
    billingModelExplanation:
      'Agent-to-agent workflows create billing chains: Agent A pays Agent B, who pays Agent C. Without atomic settlement, failed hops can leave money in limbo. SettleGrid settles the entire chain atomically -- if any hop fails, no money moves. Each agent sets its own price, and the total cost cascades up to the original caller.',
    tam: 'Emerging -- $1B+ by 2028',
    keywords: [
      'agent payments', 'multi-agent billing', 'A2A settlement',
      'agent-to-agent payments', 'multi-hop settlement',
      'AI agent delegation billing', 'agent orchestration billing',
    ],
    faqEntries: [
      {
        q: 'What is multi-hop settlement?',
        a: 'When Agent A calls Agent B, which calls Agent C, there are 3 hops in the billing chain. Multi-hop settlement means all 3 payments (A to B, B to C) are settled atomically -- either all succeed or none do.',
      },
      {
        q: 'What happens if a sub-agent fails mid-chain?',
        a: 'Atomic settlement means no partial charges. If Agent C fails, Agent B is not charged for Agent C\'s call, and Agent A is not charged for Agent B\'s call. The entire transaction rolls back.',
      },
      {
        q: 'How does pricing work across agent chains?',
        a: 'Each agent sets its own price independently. Agent C charges 5 cents, Agent B charges 20 cents (which includes paying Agent C), and Agent A sees the total cost of 20 cents from Agent B. Costs cascade up transparently.',
      },
      {
        q: 'Does this work with existing agent frameworks?',
        a: 'Yes. SettleGrid works at the transport layer. Any framework that makes HTTP or MCP calls to other agents can use sg.wrap() to add billing. No framework lock-in.',
      },
      {
        q: 'Can I see the full billing chain for a request?',
        a: 'Yes. The SettleGrid dashboard shows the complete settlement chain for every request, including each hop, its cost, and the agents involved.',
      },
    ],
  },

  // ── 8. Data APIs ──────────────────────────────────────────────────────────
  {
    slug: 'data-apis',
    headline: 'Per-Call Billing for Any Data API',
    subtext:
      'Weather, finance, geolocation, news -- if your API returns data, SettleGrid can meter and bill it. Per-query pricing with zero upfront cost.',
    codeExample: `import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: {
    methods: {
      'current': { costCents: 2 },
      'forecast': { costCents: 5 },
      'historical': { costCents: 10 },
    },
  },
})

const billedWeather = sg.wrap(async (args: { location: string; type: string }) => {
  const data = await fetchWeatherData(args.location, args.type)
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}, { method: args.type })`,
    providers: [
      { name: 'Google Maps', description: 'Geolocation, geocoding, places -- per-request' },
      { name: 'OpenWeatherMap', description: 'Weather data -- per-call pricing' },
      { name: 'Alpha Vantage', description: 'Financial data -- per-API-call' },
      { name: 'Polygon.io', description: 'Market data -- per-request pricing' },
      { name: 'NewsAPI', description: 'News aggregation -- per-request pricing' },
      { name: 'SerpAPI', description: 'Search engine results -- per-search pricing' },
    ],
    billingModel: 'per-call',
    billingModelExplanation:
      'Data APIs are the simplest services to meter: every call returns data, every call has a cost. Per-call billing scales linearly with usage and is easy for users to understand. SettleGrid lets you set different rates for different endpoints (current weather vs. historical data vs. forecasts) so pricing reflects the actual value delivered.',
    tam: '$34B geospatial + $5B financial data',
    keywords: [
      'API monetization', 'data API billing', 'weather API billing',
      'financial data billing', 'geolocation API billing', 'per-call API pricing',
      'data feed monetization',
    ],
    faqEntries: [
      {
        q: 'Can I charge different rates for different endpoints?',
        a: 'Yes. Use method-level pricing to charge 2 cents for current weather, 5 cents for forecasts, and 10 cents for historical data. Each endpoint maps to a method name in your SettleGrid config.',
      },
      {
        q: 'What if my upstream API charges per-call?',
        a: 'Set your SettleGrid pricing above your upstream cost. If your weather API charges $0.01/call, set your price at $0.02/call and keep the $0.01 margin. SettleGrid handles the user-facing billing.',
      },
      {
        q: 'Can I offer a free tier?',
        a: 'Yes. SettleGrid supports a free call quota per user. Set a daily or monthly free allowance, and only bill for calls beyond the quota.',
      },
      {
        q: 'How do I handle rate limiting?',
        a: 'Rate limiting is separate from billing. You can implement rate limits in your wrapper and SettleGrid will only bill for calls that actually execute. Rejected calls are not charged.',
      },
    ],
  },
]

export const SOLUTION_SLUGS = SOLUTIONS.map((s) => s.slug)

export function getSolutionBySlug(slug: string): SolutionDefinition | undefined {
  return SOLUTIONS.find((s) => s.slug === slug)
}
