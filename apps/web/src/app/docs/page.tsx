import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { ApiEndpointRow } from '@/components/ui/api-endpoint-row'

export const metadata: Metadata = {
  title: 'Documentation | SettleGrid',
  description: 'Quick-start guide, SDK reference, and API documentation for SettleGrid.',
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-2xl font-bold text-indigo dark:text-gray-100 mb-4">{title}</h2>
      {children}
    </section>
  )
}


export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#0F1117]">
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4 sticky top-0 bg-white dark:bg-[#1A1D2E] z-10">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar nav */}
        <aside className="hidden lg:block w-56 border-r border-gray-200 dark:border-[#2E3148] p-6 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          <nav className="space-y-1 text-sm">
            {[
              { href: '#quick-start', label: 'Quick Start' },
              { href: '#sdk-reference', label: 'SDK Reference' },
              { href: '#api-reference', label: 'API Reference' },
              { href: '#pricing', label: 'Pricing Model' },
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
            Everything you need to monetize your MCP tools with SettleGrid.
          </p>

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
              <a href="https://settlegrid.ai/api" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 bg-gray-100 dark:bg-[#252836] px-2 py-0.5 rounded text-xs font-mono text-brand hover:text-brand-dark dark:text-brand-light dark:hover:text-brand transition-colors">https://settlegrid.ai/api<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg></a>.
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
              <li><strong>Developers:</strong> Free to sign up. Set your own prices. Keep 80% of revenue.</li>
              <li><strong>Consumers:</strong> Prepaid credits. Purchase $5, $20, $50, or custom amounts.</li>
              <li><strong>Platform fee:</strong> 20% of each transaction. No monthly fees, no minimums.</li>
              <li><strong>Payouts:</strong> Weekly or monthly via Stripe Connect. $25 minimum.</li>
            </ul>
          </Section>

          <Section title="FAQ" id="faq">
            {(() => {
              const categories: Array<{
                title: string
                faqs: Array<{ q: string; a: string }>
              }> = [
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
                      q: 'How do I get started as a consumer?',
                      a: 'Browse the SettleGrid Marketplace to find tools you want to use. Purchase credits for a tool using a credit card (via Stripe), then generate an API key from your dashboard. Pass the key in the x-api-key header when calling the tool.',
                    },
                    {
                      q: 'Is there a free tier?',
                      a: 'Yes. The Free plan is $0 forever and includes 1 service, 1,000 operations per month, per-call billing, a basic dashboard, and an 85% revenue share. No credit card is required to start.',
                    },
                    {
                      q: 'What protocols does SettleGrid support?',
                      a: 'SettleGrid is protocol-agnostic. It natively supports MCP (Model Context Protocol), x402 (Coinbase), AP2 (Google Agent Payments), Visa TAP (Token Agent Payments), Stripe Connect, and any standard REST API. One SDK covers every protocol.',
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
                      a: 'Yes. While the package is called @settlegrid/mcp, it includes a settlegridMiddleware() function for REST APIs (Express, Fastify, etc.). The SDK\'s wrap() function works with any async handler regardless of protocol.',
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
                      a: 'Developers keep at least 85% of every transaction on the Free and Builder plans. The Scale plan increases your share to 87%, and the Platform plan gives you 90%. The remaining percentage is the SettleGrid platform fee.',
                    },
                    {
                      q: 'What is the minimum payout?',
                      a: 'The default minimum payout is $25.00. You can configure this threshold in your developer settings. Payouts below the minimum are rolled over to the next payout period.',
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
                  ],
                },
                {
                  title: 'Marketplace & Discovery',
                  faqs: [
                    {
                      q: 'What is the SettleGrid Marketplace?',
                      a: 'The Marketplace is a public directory at settlegrid.ai/tools where consumers can discover, evaluate, and purchase credits for developer tools. Each tool has a storefront page with description, pricing, version history, reviews, and a one-click purchase flow.',
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
                      a: 'Tools can be assigned a category (data, NLP, image, code, search, finance, etc.) and tagged with keywords. The Marketplace supports filtering and browsing by category to help consumers find relevant tools.',
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
                      a: 'The dashboard provides real-time analytics on invocation volume, revenue, latency percentiles, consumer growth, conversion events, and tool health. The Scale plan and above support CSV export of all analytics data.',
                    },
                    {
                      q: 'What happens if webhook delivery fails?',
                      a: 'Failed webhook deliveries are retried up to 3 times with exponential backoff. Each delivery records the HTTP status code and attempt count. You receive an email alert if a webhook endpoint is consistently failing, so you can investigate and fix the issue.',
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
                  ],
                },
                {
                  title: 'Plans & Pricing',
                  faqs: [
                    {
                      q: 'What plans are available?',
                      a: 'Four plans: Free ($0 forever, 1 service, 1K ops/month, 85% revenue share), Builder ($29/month, 5 services, 50K ops/month, sandbox mode), Scale ($99/month, unlimited services, 500K ops/month, IP allowlisting, 87% share), and Platform ($299/month, unlimited everything, fraud detection, audit logging, 90% share, 99.9% SLA).',
                    },
                    {
                      q: 'Are there overage charges?',
                      a: 'Operations beyond your plan limit are not charged extra — they are simply rate-limited. Upgrade to a higher plan to increase your monthly operation allowance.',
                    },
                    {
                      q: 'Can I switch plans at any time?',
                      a: 'Yes. You can upgrade or downgrade your plan at any time from your dashboard. Changes take effect at the start of your next billing cycle. Conversion events (upgrades, downgrades, churn) are tracked for your analytics.',
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
                  ],
                },
              ]

              return (
                <div className="space-y-10">
                  {categories.map((cat) => (
                    <div key={cat.title}>
                      <h3 className="text-lg font-bold text-brand-text dark:text-brand-light mb-4 uppercase tracking-wide text-sm">
                        {cat.title}
                      </h3>
                      <div className="space-y-6">
                        {cat.faqs.map((faq) => (
                          <div key={faq.q}>
                            <h4 className="font-semibold text-indigo dark:text-gray-100 mb-1">{faq.q}</h4>
                            <p className="text-gray-600 dark:text-gray-400">{faq.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </Section>
        </main>
      </div>

      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-6">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
