import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
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
/*  FAQ Data — top 18 questions across core topics                             */
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
        a: 'Yes. The Free plan is $0 forever with no catch — unlimited tools, 25,000 operations per month, per-call billing, a full dashboard, and a 0% take rate. You keep 100% of revenue. No credit card required. Most developers will never need to upgrade.',
      },
      {
        q: 'What protocols does SettleGrid support?',
        a: "SettleGrid is protocol-agnostic. It natively supports 10 protocols: MCP (Model Context Protocol), MPP (Machine Payments Protocol — Stripe + Tempo), x402 (Coinbase), AP2 (Google Agent Payments), Visa TAP (Token Agent Payments), UCP (Universal Commerce Protocol — Google + Shopify), ACP (Agentic Commerce Protocol — OpenAI + Stripe), Mastercard Agent Pay (Verifiable Intent), Circle Nanopayments (USDC), and any standard REST API. One SDK covers every protocol.",
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
    ],
  },
  {
    title: 'Pricing Your Tool',
    faqs: [
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
        a: 'The Free plan has a 0% take rate — developers keep 100% of revenue. On Starter, Growth, and Scale plans, the take rate is 5% — developers keep 95%. Need higher limits or a custom arrangement? Email support@settlegrid.ai.',
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
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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
      <main className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-100 mb-4">
              Frequently Asked Questions
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto">
              Everything you need to know about SettleGrid — billing, protocols, payouts, and security.
              Can&apos;t find what you&apos;re looking for?{' '}
              <a href="mailto:support@settlegrid.ai" className="text-emerald-400 hover:underline">
                Contact support
              </a>.
            </p>
          </div>

          {/* FAQ accordion */}
          <FaqAccordion categories={faqCategories} />

          {/* Bottom CTA */}
          <div className="mt-16 bg-gradient-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-xl p-8 text-center">
            <h2 className="text-xl font-bold text-gray-100 mb-3">Still have questions?</h2>
            <p className="text-gray-400 mb-6">
              Check the full documentation or reach out to our team.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 bg-[#1A1D2E] border border-[#2E3148] text-gray-300 px-5 py-2.5 rounded-lg font-medium hover:border-emerald-500/40 transition-colors"
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

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            <SettleGridLogo variant="compact" size={20} />
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
