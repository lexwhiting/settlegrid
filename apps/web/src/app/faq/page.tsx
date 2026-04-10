import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { FaqAccordion } from '@/components/ui/faq-accordion'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'FAQ | SettleGrid — Frequently Asked Questions',
  description:
    'Answers to the most common questions about SettleGrid — pricing, protocols, billing, payouts, security, and SDK integration for AI tool monetization.',
  alternates: { canonical: 'https://settlegrid.ai/faq' },
  keywords: [
    'SettleGrid FAQ',
    'AI tool monetization FAQ',
    'MCP billing questions',
    'SettleGrid pricing',
    'AI agent payments FAQ',
    'per-call billing FAQ',
  ],
}

/* -------------------------------------------------------------------------- */
/*  FAQ Data — top 28 questions across core topics                             */
/* -------------------------------------------------------------------------- */

const faqCategories: Array<{ title: string; faqs: Array<{ q: string; a: string }> }> = [
  {
    title: 'Getting Started',
    faqs: [
      {
        q: 'What is SettleGrid?',
        a: 'SettleGrid is the settlement layer for the AI economy. It lets developers monetize any AI service — MCP tools, REST APIs, AI agents, model endpoints — with one SDK and one unified billing, metering, and payout system. Think of it as "Stripe for AI services" with real-time metering, multi-protocol support, and automatic revenue splits.',
      },
      {
        q: 'How do I get started as a developer?',
        a: 'Sign up for a free developer account, connect your Stripe account for payouts, create a tool with a unique slug and pricing configuration, then install the @settlegrid/mcp SDK and wrap your handler. You can be live in under 5 minutes.',
      },
      {
        q: 'Is there a free tier?',
        a: 'Yes. The Free plan is $0 forever with no catch — unlimited tools, 50,000 operations per month, per-call billing, a full dashboard, and a progressive take rate starting at 0% on your first $1K/mo of revenue. No credit card required. Most developers will never need to upgrade.',
      },
      {
        q: 'What protocols does SettleGrid support?',
        a: "SettleGrid is protocol-agnostic. It supports multiple agent payment protocols: MCP (Model Context Protocol), MPP (Merchant Payment Protocol — Stripe + Tempo), x402 (Coinbase), AP2 (Google Agent Payments), Visa TAP (Token Agent Payments), UCP (Universal Commerce Protocol — Google + Shopify), ACP (Agentic Commerce Protocol — OpenAI + Stripe), Mastercard Verifiable Intent, Circle Nanopayments (USDC), L402 (Bitcoin Lightning), Alipay Trust Protocol (Ant Group), and KYAPay (Skyfire + Visa). One SDK covers them all.",
      },
      {
        q: 'How do my tools appear in the Showcase?',
        a: "Any tool with 'active' status automatically appears in the Showcase. Set your tool to active from the Tools page in your dashboard.",
      },
      {
        q: "What's the fork-deploy-appear workflow?",
        a: 'Fork one of our 1,017 open-source templates, add your API key, deploy to Vercel or Railway. Your tool automatically appears in the Showcase and becomes discoverable via the Discovery API and MCP Discovery Server.',
      },
    ],
  },
  {
    title: 'CLI Tools',
    faqs: [
      {
        q: 'How do I scaffold a new SettleGrid tool?',
        a: 'Run npx create-settlegrid-tool in your terminal. It generates a complete MCP server project with SettleGrid billing, tests, Dockerfile, and README. Choose from 4 templates (blank, rest-api, openapi, mcp-server) and 3 deploy targets (Vercel, Docker, Railway). The generated project includes pricing configuration, error handling, and CI already wired in — you can be live in minutes.',
      },
      {
        q: 'How do AI agents discover my tools?',
        a: 'SettleGrid provides two discovery mechanisms. First, the MCP Discovery Server: run npx @settlegrid/discovery to start a local MCP server that any AI client (e.g., Claude Desktop) can connect to. It exposes search_tools, get_tool, list_categories, and get_developer tools so agents can find and evaluate SettleGrid-powered services at runtime. Second, the Discovery API: public REST endpoints at /api/v1/discover let any HTTP client search tools by keyword, category, or developer. Both require no authentication.',
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
        q: 'Can I set different prices for different methods?',
        a: "Yes. The pricing config supports per-method overrides. Set a defaultCostCents for all methods, then override specific ones in the methods map. For example, a simple lookup might cost 1 cent while a complex analysis costs 10 cents.",
      },
      {
        q: 'Does the SDK work with non-MCP services?',
        a: "Yes. While the package is called @settlegrid/mcp, it includes a settlegridMiddleware() function for REST APIs (Express, Fastify, etc.). The SDK's wrap() function works with any async handler regardless of protocol.",
      },
      {
        q: 'Does SettleGrid only work with MCP servers?',
        a: 'No. While MCP is our primary focus, the SettleGrid SDK wraps any function handler. It works with REST APIs, Express routes, Next.js API routes, serverless functions, and any callable endpoint. If your code accepts input and returns output, SettleGrid can meter and bill it.',
      },
    ],
  },
  {
    title: 'Pricing Your Tool',
    faqs: [
      {
        q: 'What pricing models does SettleGrid support?',
        a: 'Six models: per-invocation (fixed cost per call), per-token, per-byte, per-second, tiered (different prices per method), and outcome-based (charge only on success).',
      },
      {
        q: 'Are there overage charges on the Free tier?',
        a: 'Your tools keep working beyond 50,000 ops/month — we never cut off consumers. The progressive take rate applies to overage operations. Upgrade to Builder ($19/mo) or Scale ($79/mo) for higher limits.',
      },
      {
        q: 'How much should I charge per invocation?',
        a: "It depends on your tool's value and compute costs. Here are benchmarks by tool type:\n\n- Simple lookups/search: 1-5 cents per call\n- Data enrichment/APIs: 5-25 cents per call\n- AI-powered analysis: 10-50 cents per call\n- Complex multi-step workflows: 25 cents - $1+ per call\n\nStart on the lower end to attract early users, then adjust based on demand and feedback.",
      },
      {
        q: 'How do consumers pay for my tool?',
        a: "Consumers purchase credits via Stripe (credit card). They can enable auto-refill so their balance never runs out. When they call your tool, credits are deducted in real-time. You receive payouts via Stripe Connect on your chosen schedule (daily, weekly, or monthly).",
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
        q: 'What happens when my balance reaches zero?',
        a: 'If auto-refill is enabled, your balance is topped up automatically. If auto-refill is off, invocations return an InsufficientCreditsError (HTTP 402) with the required and available amounts. Your tool continues to work for other consumers who have credits.',
      },
    ],
  },
  {
    title: 'Payouts & Revenue',
    faqs: [
      {
        q: 'How do payouts work?',
        a: "Revenue from your tools accumulates in your SettleGrid developer balance. Payouts are disbursed via Stripe Connect Express to your linked bank account. You can choose weekly or monthly payout schedules, or trigger a manual payout from the dashboard at any time.",
      },
      {
        q: 'What is the revenue split?',
        a: 'All plans use a progressive take rate based on monthly tool revenue: 0% on the first $1,000/mo (you keep 100%), 2% on $1,001-$10,000, 2.5% on $10,001-$50,000, and 5% above $50,000. Most developers pay 0%. Need a custom arrangement? Email support@settlegrid.ai.',
      },
    ],
  },
  {
    title: 'Reviews',
    faqs: [
      {
        q: 'Can consumers leave reviews?',
        a: 'Yes. Consumers who have used a tool at least once can leave a 1-5 star rating with an optional written review (up to 1,000 characters). One review per consumer per tool.',
      },
      {
        q: 'Can developers respond to reviews?',
        a: "Yes. Developers can view and respond to all reviews from the Reviews tab in the dashboard. Responses appear publicly on the tool's storefront.",
      },
    ],
  },
  {
    title: 'Quality & Verification',
    faqs: [
      {
        q: 'What are quality gates?',
        a: 'Before a tool can be activated and appear in the Showcase, it must meet minimum quality requirements: description of at least 50 characters, pricing configured, category selected, and developer profile complete.',
      },
      {
        q: 'How do I earn the Verified badge?',
        a: 'Tools earn the Verified badge automatically after receiving their first real (non-test) invocation. It signals to consumers that the tool has been successfully called in production.',
      },
    ],
  },
  {
    title: 'Consumer',
    faqs: [
      {
        q: 'How do I create an API key?',
        a: "Go to the Consumer Dashboard, find the tool you purchased credits for, and click 'Generate API Key'. The full key is shown once — copy it immediately.",
      },
      {
        q: 'Can I set spending limits?',
        a: 'Yes. The Budget Controls section of the Consumer Dashboard lets you set daily, weekly, or monthly spending limits per tool with alert thresholds.',
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
        q: 'What fraud detection is in place?',
        a: 'SettleGrid runs a three-signal fraud detection system: (1) rate spike detection flags abnormal invocation bursts, (2) new-key velocity checks flag high-value usage from newly created keys, and (3) rapid duplicate deduplication catches repeated identical requests. Suspicious invocations are flagged and can trigger email alerts.',
      },
      {
        q: 'How do webhooks get verified?',
        a: 'Every webhook delivery is signed with HMAC-SHA256 using a per-endpoint secret. The signature is included in the X-SettleGrid-Signature header. Verify it by computing the HMAC of the raw request body using your secret and comparing it to the header value.',
      },
    ],
  },
  {
    title: 'Claim & Indexing',
    faqs: [
      {
        q: 'What if my tool is already indexed on SettleGrid?',
        a: "We automatically index tools from MCP registries, npm, Hugging Face, and Replicate. If your tool appears as 'unclaimed', you can claim it and set pricing in 2 minutes. Check your email for a claim link, or search for your tool on the Explore page at settlegrid.ai/explore.",
      },
      {
        q: 'How does the claim process work?',
        a: 'SettleGrid crawls MCP registries, npm, and other sources every 6 hours. When we find a tool that uses @settlegrid/mcp or matches an MCP server pattern, we create an unclaimed listing and email the developer (resolved from GitHub commits or npm profiles). Click the claim link in the email, verify ownership, and start earning.',
      },
    ],
  },
  {
    title: 'Universal AI Service Billing',
    faqs: [
      {
        q: 'What AI services can I monetize with SettleGrid?',
        a: 'SettleGrid is a universal billing layer for any AI service. Supported service types include: LLM inference proxies (OpenAI, Anthropic, Cohere, Mistral), browser automation tools (Playwright, Browserbase, Puppeteer), media generation services (DALL-E, Stable Diffusion, ElevenLabs), code execution sandboxes (E2B, Modal, Fly Machines), data enrichment APIs, MCP tools, agent-to-agent orchestration workflows, communication services (Twilio, Resend, SendGrid), search and retrieval (RAG pipelines, vector search), and compute infrastructure (GPU instances, model hosting). If your service accepts input and returns output, SettleGrid can meter and bill it.',
      },
      {
        q: 'Can I use SettleGrid as an agent budget controller?',
        a: 'Yes. SettleGrid provides comprehensive agent budget controls through three features: (1) Transaction Explorer gives full visibility into every AI service call with cost breakdowns, (2) Smart Proxy enforces budget limits in real-time and returns HTTP 402 when budgets are exceeded, and (3) progressive budgets let you set daily, weekly, or monthly spending limits per agent, per tool, or per workflow. Combined with Agent Identity (KYA) verification, you can delegate budgets to autonomous agents with full control and audit trails.',
      },
      {
        q: 'How is SettleGrid different from Stripe or Orb?',
        a: 'Stripe is a payment processor. Orb is a usage-based billing platform for SaaS. SettleGrid is an AI-native settlement layer purpose-built for the AI economy. Key differences: (1) Discovery — SettleGrid includes a built-in marketplace, Discovery API, and MCP Discovery Server so AI agents can find and pay for your services automatically. (2) Metering — sub-50ms real-time metering with atomic balance checks, not batch billing. (3) Multi-protocol — 15 payment protocols (MCP, MPP, x402, AP2, Visa TAP, L402, KYAPay, EMVCo, DRAIN, etc.) vs. Stripe/Orb\'s REST-only approach. (4) Progressive pricing — 0% take rate on your first $1K/mo. (5) Agent-native — budget delegation, KYA identity, multi-hop settlement for autonomous agent workflows.',
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  JSON-LD FAQPage schema (top 10 questions)                                  */
/* -------------------------------------------------------------------------- */

const top10Faqs = faqCategories.flatMap((c) => c.faqs).slice(0, 10)

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: top10Faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.a,
    },
  })),
}

/* -------------------------------------------------------------------------- */
/*  Page component                                                             */
/* -------------------------------------------------------------------------- */

export default function FaqPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <Navbar />

      {/* ---- Main content ---- */}
      <main className="flex-1 px-6 py-16 pt-14">
        <div className="max-w-3xl mx-auto">
          <nav className="mb-8 text-sm text-gray-400" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-amber-400 transition-colors">Home</Link>
            <span className="mx-2 text-gray-600">/</span>
            <span className="text-gray-300">FAQ</span>
          </nav>
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-100 mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Everything you need to know about SettleGrid — billing, protocols, payouts, and security.
              Can&apos;t find what you&apos;re looking for?{' '}
              <a href="mailto:support@settlegrid.ai" className="text-amber-400 hover:underline">
                Contact support
              </a>.
            </p>
          </div>

          {/* FAQ accordion */}
          <FaqAccordion categories={faqCategories} />

          {/* Bottom CTA */}
          <div className="mt-16 bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-xl p-8 text-center">
            <h2 className="text-xl font-bold text-gray-100 mb-3">Still have questions?</h2>
            <p className="text-gray-400 mb-6">
              Check the full documentation or reach out to our team.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 bg-[#161822] border border-[#2A2D3E] text-gray-300 px-5 py-2.5 rounded-lg font-medium hover:border-amber-500/40 transition-colors"
              >
                Read the Docs
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
