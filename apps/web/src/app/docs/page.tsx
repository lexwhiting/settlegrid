import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { ApiEndpointRow } from '@/components/ui/api-endpoint-row'
import { FaqAccordion } from '@/components/ui/faq-accordion'

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
      q: 'How do I get started as a consumer?',
      a: 'Browse the SettleGrid Marketplace to find tools you want to use. Purchase credits for a tool using a credit card (via Stripe), then generate an API key from your dashboard. Pass the key in the x-api-key header when calling the tool.',
    },
    {
      q: 'Is there a free tier?',
      a: 'Yes. The Free plan is $0 forever and includes unlimited tools, 25,000 operations per month, per-call billing, a basic dashboard, and a 0% take rate — you keep 100% of revenue. No credit card is required to start.',
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
      a: 'SettleGrid supports sandbox mode. Create test API keys (prefixed sg_test_) that meter usage without real charges or balance deductions. All invocations made with test keys are flagged as test data in your analytics. Available on Starter tier and above.',
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
      a: 'The Free plan has a 0% take rate — developers keep 100% of revenue. On Starter, Growth, and Scale plans, the take rate is 5% — developers keep 95%. Enterprise plans offer a negotiable 3-5% take rate.',
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
      a: 'SettleGrid enforces tiered sliding-window rate limits on all API routes based on your plan (Free through Platform). When limits are exceeded, requests receive a 429 response with a Retry-After header. Rate limits apply to both developer dashboard calls and consumer SDK calls.',
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
    {
      q: 'What does the reputation score mean?',
      a: 'A developer\'s reputation score (visible on the /dashboard/reputation page and public profile) reflects tool uptime, consumer reviews, response time, and payout history. Higher scores increase visibility in the Marketplace and build consumer trust.',
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
      a: 'The dashboard provides real-time analytics on invocation volume, revenue, latency percentiles, consumer growth, conversion events, and tool health. The Scale plan and above support CSV export of all analytics data.',
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
      a: 'The /api/dashboard/developer/stats/attribution endpoint shows where your consumers come from — direct traffic, referral links, marketplace browse, or API discovery. This helps you understand which acquisition channels are most effective.',
    },
  ],
},
{
  title: 'Plans & Pricing',
  faqs: [
    {
      q: 'What plans are available?',
      a: 'Five plans: Free ($0 forever, unlimited tools, 25K ops/month, 0% take rate), Starter ($9/month, 100K ops/month, 5% take rate, sandbox mode), Growth ($29/month, 500K ops/month, 5% take rate, IP allowlisting), Scale ($79/month, 2M ops/month, 5% negotiable, fraud detection, dedicated support), and Enterprise (custom pricing, unlimited everything, 3-5% negotiable take rate).',
    },
    {
      q: 'Are there overage charges?',
      a: 'Operations beyond your plan limit are not charged extra — they are simply rate-limited. Upgrade to a higher plan to increase your monthly operation allowance.',
    },
    {
      q: 'Can I switch plans at any time?',
      a: 'Yes. You can upgrade or downgrade your plan at any time from your dashboard. Changes take effect at the start of your next billing cycle. Conversion events (upgrades, downgrades, churn) are tracked for your analytics.',
    },
    {
      q: 'Which features require a paid plan?',
      a: 'Sandbox mode requires Starter ($9/mo) or above. IP allowlisting, CSV export, and referral system require Growth ($29/mo). Fraud detection, audit logging, and dedicated support require Scale ($79/mo). All other features including per-method pricing, webhooks, and the marketplace are available on all plans.',
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
      a: 'Paid.ai supports MCP per-call billing only. SettleGrid adds multi-protocol support (MCP, x402, AP2, Visa TAP, REST), multi-hop settlement, agent identity, outcome-based billing, auto-refill credits, IP allowlisting, fraud detection, and a 95%+ revenue share (100% on Free tier).',
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
            <FaqAccordion categories={faqCategories} />
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
