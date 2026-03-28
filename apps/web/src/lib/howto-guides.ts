/* -------------------------------------------------------------------------- */
/*  How-To Guide Data                                                          */
/*  Static content for the /learn/how-to guide series.                         */
/* -------------------------------------------------------------------------- */

export interface HowToGuide {
  slug: string
  title: string
  description: string
  steps: { heading: string; content: string }[]
  keywords: string[]
  icon: string // SVG path (stroke, 24x24 viewBox)
}

export const HOWTO_GUIDES: HowToGuide[] = [
  /* ── 1. Create Your First MCP Tool ─────────────────────────────────────── */
  {
    slug: 'how-to-create-mcp-tool',
    title: 'How to Create Your First MCP Tool on SettleGrid',
    description:
      'A step-by-step guide to building, testing, and publishing your first monetized MCP tool. Covers SDK installation, handler creation, pricing configuration, local testing, and deployment.',
    icon: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.194-.14 1.743',
    keywords: [
      'create MCP tool',
      'build MCP server',
      'MCP SDK tutorial',
      'first MCP tool',
      'SettleGrid quickstart',
      'MCP tool development',
      'AI tool creation',
    ],
    steps: [
      {
        heading: 'Install the SettleGrid SDK',
        content: `The fastest way to get started is with the SettleGrid scaffolding CLI. Run \`npx create-settlegrid-tool\` in your terminal and follow the interactive prompts. The CLI creates a complete project with TypeScript, billing hooks, and test harnesses already wired in. You can also pass flags like \`--category data\` or \`--pricing per-call\` to skip the prompts.

If you prefer to add SettleGrid to an existing MCP server, install the SDK directly with \`npm install @settlegrid/mcp\`. The SDK exports a \`withBilling\` wrapper that intercepts tool calls, meters usage, and settles payments automatically. It works with any MCP server implementation that follows the Model Context Protocol specification.

After installation, verify your setup by running \`npx settlegrid doctor\`. This command checks your Node.js version (18+), validates your \`tsconfig.json\` settings, and confirms the SDK can reach the SettleGrid API. Fix any warnings before proceeding — they will save you debugging time later.`,
      },
      {
        heading: 'Create Your Tool Handler',
        content: `An MCP tool handler is a function that receives structured input from an AI agent and returns structured output. The SettleGrid SDK wraps this handler with billing logic, but the handler itself is just a regular async function. Start by defining your tool's input schema using Zod (included as a dependency) and writing the handler logic.

For example, a simple data enrichment tool might accept a company domain and return firmographic data. Define the input as \`z.object({ domain: z.string().url() })\` and the handler as an async function that calls your data source and returns the result. The SDK handles serialization, error formatting, and retry logic automatically.

Keep your handler focused on a single capability. MCP tools work best when they do one thing well rather than bundling multiple operations. If you have related capabilities (e.g., lookup and enrich), create separate tool handlers for each. This makes pricing clearer, testing simpler, and lets agents call only what they need.`,
      },
      {
        heading: 'Configure Pricing',
        content: `Pricing is defined in your \`settlegrid.config.ts\` file at the project root. The simplest model is per-invocation: set a price in cents and every successful tool call charges that amount. For example, \`pricing: { model: 'per-call', amount: 5 }\` charges 5 cents per call. The SDK supports six pricing models: per-call, per-token, per-byte, per-second, tiered (different prices per method), and outcome-based (charge only on success).

For your first tool, start with per-call pricing. It is the easiest to reason about, the simplest to communicate to consumers, and works well for tools with consistent compute costs. You can always switch to a more sophisticated model later — SettleGrid handles the migration transparently and notifies existing consumers of the change.

Set your price based on the value your tool delivers, not just your compute cost. A data enrichment tool that saves an agent 30 seconds of research is worth more than the 0.2 cents of API calls it takes to run. Research comparable tools on the SettleGrid marketplace (\`/explore\`) to benchmark your pricing against competitors. Most first-time tool builders underprice by 3-5x.`,
      },
      {
        heading: 'Test Locally with the Sandbox',
        content: `Before deploying, test your tool end-to-end using the SettleGrid sandbox. Run \`npx settlegrid sandbox\` to start a local instance that simulates the full billing pipeline — metering, settlement, webhook delivery — without processing real payments. The sandbox logs every event to your terminal so you can verify each step.

Write integration tests that call your tool through the sandbox and assert on both the response and the billing events. The SDK includes test utilities: \`createTestClient()\` creates a pre-authenticated client, and \`expectBillingEvent()\` asserts that a specific metering event was recorded. Run your tests with \`npm test\` — the scaffolded project includes a Jest configuration that automatically starts and stops the sandbox.

Test edge cases: what happens when your tool receives invalid input, when your upstream API is down, or when the agent sends a request that exceeds your rate limits? The SDK returns structured errors for all of these cases, but verify that your handler doesn't swallow errors or return partial results that could confuse agents. A well-tested tool earns consumer trust and reduces support burden.`,
      },
      {
        heading: 'Deploy and Publish',
        content: `Deploy your MCP server to any hosting provider — Vercel, Railway, Fly.io, AWS Lambda, or your own infrastructure. The SettleGrid SDK is runtime-agnostic: it works in Node.js, Deno, and Bun. For serverless deployments, the SDK batches metering events and flushes them asynchronously to avoid adding latency to your responses.

Once deployed, publish your tool to the SettleGrid marketplace by running \`npx settlegrid publish\`. This command validates your configuration, creates your tool listing, and submits it for review. Listings go live within minutes and appear in the explore page, category pages, and the Discovery API that AI agents use to find tools.

After publishing, add the SettleGrid badge to your project's README with \`npx settlegrid badge\`. The badge shows your tool's pricing, category, and reputation score, and links directly to your marketplace listing. Tools with README badges see 3x more discovery traffic because they are visible to developers browsing GitHub and npm.`,
      },
      {
        heading: 'Monitor and Iterate',
        content: `Once your tool is live, use the SettleGrid dashboard to monitor usage, revenue, and consumer behavior. The dashboard shows real-time metrics: calls per minute, p50/p95 latency, error rate, revenue by day, and top consumers. Set up alerts for anomalies — a sudden spike in errors or a drop in call volume usually indicates a problem with your upstream dependencies.

Review your pricing after the first week. If your tool has a high adoption rate but low revenue, your price is too low. If adoption is slow despite strong discovery metrics (impressions and clicks), your price may be too high or your tool description needs improvement. The marketplace works best when tools are priced at the sweet spot where agents get clear value and you earn sustainable revenue.

Iterate on your tool based on real usage patterns. The dashboard shows which input parameters agents use most, which errors they encounter, and which methods they call most frequently. Use this data to improve your handler, add new capabilities, and refine your pricing. The best tools on SettleGrid ship updates weekly.`,
      },
    ],
  },

  /* ── 2. Deploy an MCP Server with Billing ──────────────────────────────── */
  {
    slug: 'how-to-deploy-mcp-server',
    title: 'How to Deploy an MCP Server with Billing',
    description:
      'Complete walkthrough of deploying a production MCP server with integrated billing. Covers template selection, environment configuration, deployment to Vercel/Railway/Fly, Stripe connection, and going live.',
    icon: 'M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3m3 3a3 3 0 1 0 0 6h13.5a3 3 0 1 0 0-6m-16.5-3a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3m-19.5 0a4.5 4.5 0 0 1 .9-2.7L5.737 5.1a3.375 3.375 0 0 1 2.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 0 1 .9 2.7m0 0a3 3 0 0 1-3 3m0 3h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Zm-3 6h.008v.008h-.008v-.008Zm0-6h.008v.008h-.008v-.008Z',
    keywords: [
      'deploy MCP server',
      'MCP server hosting',
      'MCP billing setup',
      'Stripe MCP integration',
      'MCP server Vercel',
      'MCP server Railway',
      'production MCP deployment',
    ],
    steps: [
      {
        heading: 'Choose a Template',
        content: `SettleGrid provides 13 MCP server templates and 4 REST API templates, each with billing pre-wired. Browse them at \`/templates\` or run \`npx create-settlegrid-tool --list\` to see all options in your terminal. Templates range from simple (a single-tool server that wraps an external API) to complex (multi-tool servers with database connections, caching, and rate limiting).

For your first deployment, choose a template that closely matches your use case. The "web-search" template is a good starting point if your tool calls external APIs. The "database-query" template works well for tools that read from a database. The "ai-proxy" template suits tools that call an LLM and add value on top (summarization, classification, extraction).

Each template includes a complete project structure: source code, tests, Dockerfile, deployment configs for three platforms (Vercel, Railway, Fly.io), environment variable documentation, and a CI/CD pipeline. Fork the template, customize the handler, and you are ready to deploy.`,
      },
      {
        heading: 'Configure Environment Variables',
        content: `Every SettleGrid deployment requires three environment variables: \`SETTLEGRID_API_KEY\` (your publisher API key), \`SETTLEGRID_TOOL_ID\` (your tool's unique identifier, assigned when you register), and \`STRIPE_CONNECT_ACCOUNT_ID\` (your Stripe Connected Account ID for payouts). All three are available in the SettleGrid dashboard under Settings > API Keys.

If your tool calls external APIs, add those credentials as environment variables too. Never hardcode secrets in your source code — the templates use \`process.env\` for all configuration and include a \`.env.example\` file documenting every required variable. For local development, copy \`.env.example\` to \`.env.local\` and fill in your values.

For production deployments, configure secrets through your hosting provider's dashboard or CLI. On Vercel, use \`vercel env add\`. On Railway, use the Variables tab. On Fly.io, use \`fly secrets set\`. All three platforms encrypt secrets at rest and inject them as environment variables at runtime. Double-check that your \`SETTLEGRID_API_KEY\` is the production key, not the sandbox key — they are different.`,
      },
      {
        heading: 'Deploy to Your Platform',
        content: `The deployment process varies by platform, but SettleGrid templates include configuration files for all three major options. For Vercel, push to GitHub and import the repository — the \`vercel.json\` in the template handles the build configuration. For Railway, click "Deploy from GitHub" and select your repo — the \`railway.toml\` defines the service. For Fly.io, run \`fly launch\` followed by \`fly deploy\` — the \`fly.toml\` and \`Dockerfile\` are ready to go.

Regardless of platform, verify that your deployment can reach the SettleGrid API by checking the health endpoint. The templates expose a \`/health\` route that reports SDK version, API connectivity, and billing pipeline status. Hit this endpoint after deployment and confirm all checks pass before proceeding.

For production workloads, configure auto-scaling. The SettleGrid SDK is stateless — it sends metering events asynchronously and does not require sticky sessions — so horizontal scaling works out of the box. Set minimum instances to 1 (to avoid cold starts), maximum to whatever your budget allows, and let the platform scale based on CPU or request count.`,
      },
      {
        heading: 'Connect Stripe for Payouts',
        content: `SettleGrid uses Stripe Connect to pay tool publishers. If you do not already have a Stripe account, create one at stripe.com and complete identity verification. Then, in the SettleGrid dashboard, go to Settings > Payouts and click "Connect Stripe." This initiates the Stripe Connect onboarding flow, which takes about 5 minutes and requires your bank account details.

Once connected, SettleGrid automatically transfers your earnings to your Stripe balance on a rolling 7-day schedule. You can view pending payouts, completed transfers, and revenue breakdowns in both the SettleGrid dashboard and the Stripe dashboard. SettleGrid uses a progressive take rate: 0% on your first $1K/mo of revenue, 2% on $1K-$10K, 3% on $10K-$50K, and 5% above $50K. Most developers pay 0%.

Test the payment flow end-to-end before going live. Use the SettleGrid sandbox with Stripe test mode to simulate tool calls, verify that metering events are recorded, and confirm that settlement amounts are correct. The sandbox produces test webhook events that you can inspect in the Stripe dashboard under Developers > Webhooks. Verify that the amounts, descriptions, and metadata match your expectations.`,
      },
      {
        heading: 'Go Live and Verify',
        content: `When you are ready to accept real payments, switch from sandbox mode to production mode in your \`settlegrid.config.ts\` by setting \`mode: 'live'\` (or by removing the \`mode\` field, since \`live\` is the default). Redeploy your server with the production \`SETTLEGRID_API_KEY\`. The SDK will now meter real usage and settle real payments.

Verify the production deployment by making a few test calls from the SettleGrid dashboard's built-in tool tester. Check that calls succeed, latency is acceptable (<500ms p95 for most tools), and billing events appear in the Metering tab. Make one call with intentionally invalid input to verify that your error handling works and that failed calls are not billed.

Publish your tool to the marketplace by running \`npx settlegrid publish --live\`. Your listing will appear in the explore page, category pages, search results, and the Discovery API within minutes. Monitor the dashboard closely for the first 24 hours — watch for error rate spikes, latency regressions, or unexpected billing patterns. Set up PagerDuty or Slack alerts for critical metrics so you can respond quickly to production issues.`,
      },
      {
        heading: 'Set Up Monitoring and Alerts',
        content: `Production MCP servers need observability. The SettleGrid SDK exports OpenTelemetry spans for every tool call, so you can send traces to your preferred observability platform (Datadog, Grafana, Honeycomb, or any OTLP-compatible backend). The templates include a \`tracing.ts\` file that configures the OTLP exporter — just set the \`OTEL_EXPORTER_OTLP_ENDPOINT\` environment variable.

Configure alerts for three critical metrics: error rate (alert if >5% of calls fail), latency (alert if p95 exceeds 2 seconds), and revenue (alert if daily revenue drops more than 50% from the 7-day average). The SettleGrid dashboard supports webhook notifications that you can route to Slack, PagerDuty, or email.

Review your server logs weekly. Look for patterns: are certain input formats causing errors? Are specific AI agents making an unusually high number of calls? Is your upstream API returning rate limit errors during peak hours? Use these insights to improve your handler, adjust rate limits, and optimize your infrastructure for the actual usage patterns you observe.`,
      },
    ],
  },

  /* ── 3. Set the Right Price ────────────────────────────────────────────── */
  {
    slug: 'how-to-set-pricing',
    title: 'How to Set the Right Price for Your AI Tool',
    description:
      'A practical guide to pricing your MCP tool for maximum revenue. Covers pricing model selection, competitor benchmarking, base price setting, tier design, sandbox testing, and ongoing optimization.',
    icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    keywords: [
      'MCP tool pricing',
      'AI tool pricing strategy',
      'per-call billing',
      'per-token pricing',
      'AI tool revenue optimization',
      'MCP pricing models',
      'tool monetization pricing',
    ],
    steps: [
      {
        heading: 'Choose Your Pricing Model',
        content: `SettleGrid supports six pricing models, and choosing the right one is the most impactful decision you will make. Per-call pricing charges a fixed amount per tool invocation — it is simple, predictable, and works well for tools with consistent compute costs. Per-token pricing charges based on input/output size — ideal for NLP tools where processing cost scales with text length.

Per-byte pricing charges based on data volume — best for media processing, file conversion, and data transfer tools. Per-second pricing charges based on execution time — suited for compute-intensive tools like simulations, video rendering, or complex analysis. Tiered pricing assigns different prices to different methods within the same server — perfect when your tool has both simple and complex operations.

Outcome-based pricing charges only when the tool produces a successful result — useful for tools where failure is common (search, fraud detection, code fixing). This model aligns incentives perfectly: agents only pay when they get value, and your revenue scales with your tool's effectiveness. Start with per-call if you are unsure — it is the easiest to implement and the easiest for consumers to understand.`,
      },
      {
        heading: 'Benchmark Competitors',
        content: `Before setting a price, research what comparable tools charge. Browse the SettleGrid marketplace (\`/explore\`) and filter by your category to see competitor pricing. Note the range: the cheapest tool sets the floor, the most expensive sets the ceiling, and the median tells you what consumers expect to pay.

Look beyond SettleGrid too. Check Rapid API, AWS Marketplace, and similar platforms for tools in your category. Compare not just price but also what each tool includes: response quality, latency, uptime guarantees, and additional features. A tool that returns enriched data in 200ms is worth more than one that returns basic data in 2 seconds, even if the raw capability is similar.

Document your findings in a simple spreadsheet: tool name, pricing model, price per call, average latency, and feature set. This competitive analysis will inform not just your initial price but also your positioning — you will use it to explain on your listing page why your tool is worth what you charge. Tools that articulate their value proposition clearly convert browsers to paying consumers at 2-3x the rate of tools with generic descriptions.`,
      },
      {
        heading: 'Set Your Base Price',
        content: `Your base price should reflect three factors: your cost to serve (compute, API calls, infrastructure), the value your tool delivers (time saved, accuracy, convenience), and the competitive landscape (what alternatives cost). Start by calculating your cost per call including all upstream API fees, compute costs, and a margin for infrastructure overhead. Then multiply by 3-5x to establish a profitable base price.

For most tools, the value-based approach yields a higher and more defensible price than cost-plus. Ask: what would it cost an agent (or the human behind it) to get this result without my tool? If your tool saves 30 seconds of research, that is worth 10-25 cents, regardless of whether your compute cost is 0.1 cents. Price for the value you deliver, not the cost you incur.

Set your initial price slightly below where you think optimal is. It is psychologically easier to raise prices on a tool with strong reviews and high usage than to lower prices on a tool that launched too high. SettleGrid lets you change pricing at any time, and the platform notifies existing consumers of changes with a 7-day grace period. Most successful tools adjust their price 2-3 times in the first month.`,
      },
      {
        heading: 'Design Pricing Tiers',
        content: `If your tool offers multiple methods or quality levels, tiered pricing captures more value than a single flat rate. Create 2-3 tiers that correspond to different levels of service. For example: a "basic" tier (simple lookup, 2 cents), a "standard" tier (enriched response, 10 cents), and a "premium" tier (full analysis with recommendations, 50 cents).

Each tier should deliver clearly differentiated value. Agents choose tiers based on their needs, and well-designed tiers increase average revenue per consumer by 40-60% compared to flat pricing. The key is ensuring the premium tier feels like a genuine upgrade, not just "the same thing with a higher price tag."

Configure tiers in your \`settlegrid.config.ts\` using the tiered pricing model. Map each tier to specific tool methods: basic methods in the low tier, advanced methods in the high tier. The SDK handles routing, metering, and billing automatically — agents see the tier and price before each call and can choose which tier to invoke based on their budget and needs.`,
      },
      {
        heading: 'Test with the Sandbox',
        content: `Before going live with real pricing, validate your entire billing flow in the SettleGrid sandbox. Run \`npx settlegrid sandbox\` and make representative calls at each pricing tier. Verify that the metered amounts match your configuration, that failed calls are not charged, and that the consumer-facing price display is accurate.

Simulate high-volume scenarios to ensure your pricing scales correctly. The sandbox supports burst testing: send 1,000 calls in rapid succession and verify that every call is metered individually, no events are dropped, and the total billing matches your expected revenue. This is especially important for per-token and per-byte models where the metered amount varies per call.

Run an A/B test before launch if possible. SettleGrid supports price experiments: set two prices for the same tool and the platform randomly assigns consumers to each group. After 48 hours, compare conversion rates and revenue per consumer. This data-driven approach removes guesswork and lets you launch with confidence that your price is in the right range.`,
      },
      {
        heading: 'Monitor and Optimize',
        content: `After launch, monitor three pricing metrics daily: conversion rate (what percentage of agents who discover your tool make a paid call), usage frequency (how many calls per consumer per day), and revenue per consumer (how much each active consumer spends). The SettleGrid dashboard shows all three on the Analytics tab.

If conversion is high (>15%) but usage is low, your price may be slightly too high for repeated use — consider adding a volume discount or a lower-priced basic tier. If conversion is low (<5%) but usage among paying consumers is high, your value proposition is strong but your listing or price presentation needs work. If both are low, revisit your competitive analysis and consider repositioning.

Re-evaluate pricing quarterly. As your tool gains reputation, earns reviews, and accumulates usage history, you earn the right to charge more. Tools with 100+ reviews and 99.9% uptime can typically charge 50-100% more than identical tools without track records. Gradually raise your price and monitor the impact on conversion and revenue — the goal is to find the price that maximizes total revenue, not just call volume.`,
      },
    ],
  },

  /* ── 4. Maximize Discovery ─────────────────────────────────────────────── */
  {
    slug: 'how-to-maximize-discovery',
    title: 'How to Maximize Your Tool\'s Discovery',
    description:
      'Learn how to make your AI tool visible to agents and developers. Covers listing optimization, badges, directory registration, registry submission, and content marketing for MCP tools.',
    icon: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
    keywords: [
      'MCP tool discovery',
      'AI tool visibility',
      'MCP marketplace listing',
      'tool discoverability',
      'MCP directory registration',
      'AI tool SEO',
      'MCP tool marketing',
    ],
    steps: [
      {
        heading: 'Optimize Your Listing',
        content: `Your SettleGrid listing is the first thing agents and developers see. Write a clear, specific title that includes what your tool does and what category it serves — "Real-Time Weather API for AI Agents" converts better than "Weather Tool." The description should lead with the primary value proposition, include concrete use cases, and specify what input/output formats your tool supports.

Add a detailed \`README.md\` to your project repository and link it from your listing. The README should include a quick-start code example, input/output schema documentation, pricing explanation, and performance benchmarks. Agents use README content to decide whether to integrate your tool, and developers use it to evaluate alternatives. A comprehensive README is the highest-ROI investment you can make in discovery.

Tag your listing with accurate categories and keywords. SettleGrid uses these for search ranking and category page placement. Use specific keywords ("geolocation enrichment") rather than generic ones ("data tool"). Include the programming languages your tool works best with, the industries it serves, and the specific problems it solves. The more precise your tags, the more qualified your discovery traffic will be.`,
      },
      {
        heading: 'Add Badges and Social Proof',
        content: `SettleGrid generates embeddable badges for your tool that display pricing, category, and reputation score. Run \`npx settlegrid badge\` to generate badge markdown for your README, website, and social profiles. Tools with badges in their GitHub README see 3x more click-through to their SettleGrid listing.

Encourage consumers to leave reviews after using your tool. Reviews are the strongest signal for marketplace ranking — tools with 10+ positive reviews rank 2-4 positions higher in search results and category pages. You can prompt for reviews by including a review link in your tool's response metadata (the SDK supports a \`reviewUrl\` field in the response envelope).

Build social proof beyond the marketplace. Share usage milestones on Twitter/X, LinkedIn, and Hacker News: "My MCP weather tool just processed its 100,000th call." Post your revenue numbers (if comfortable) — the MCP developer community is small and supportive, and transparent builders attract more attention and trust than anonymous listings.`,
      },
      {
        heading: 'Register in Directories',
        content: `Beyond the SettleGrid marketplace, register your tool in every relevant directory. The MCP ecosystem is still young, so directories have low competition and high visibility. Start with the official MCP server registry, Awesome MCP lists on GitHub, and developer tool aggregators like Product Hunt and DevHunt.

Create a \`.well-known/mcp/server-card.json\` file in your deployment (the SettleGrid templates include one). This file follows the MCP Discovery specification and allows AI agents to discover your tool by probing your server's well-known URL. Any agent that supports MCP Discovery will find your tool automatically if it knows your server's base URL.

Register with the SettleGrid Discovery API by publishing your tool (this happens automatically when you run \`npx settlegrid publish\`). The Discovery API is a public, unauthenticated endpoint that AI agents query to find tools by category, capability, and pricing. It is the primary discovery channel for agent-to-agent workflows and accounts for the majority of new consumer acquisition on the platform.`,
      },
      {
        heading: 'Submit to MCP Registries',
        content: `MCP registries are centralized directories that AI agents query to find tools. Submit your tool to every registry you can find. The SettleGrid Discovery Server (\`npx @settlegrid/discovery\`) is one such registry, but others exist: the MCP Registry (mcp-registry.org), the Anthropic MCP Hub, and community-maintained registries on GitHub.

When submitting, ensure your tool's metadata is complete and accurate. Registries rank tools by metadata quality, and incomplete submissions get buried. Include a comprehensive description, accurate capability tags, pricing information, latency benchmarks, and a link to your documentation. Some registries support "verified" badges for tools that pass automated testing — apply for verification wherever available.

Keep your registry listings up to date. When you add new methods, change pricing, or improve performance, update your registry entries. Stale listings with outdated pricing or missing capabilities lose ranking over time. Set a monthly reminder to audit all your directory and registry listings and ensure they reflect your tool's current state.`,
      },
      {
        heading: 'Write Content About Your Tool',
        content: `Content marketing works for MCP tools just as it does for SaaS products. Write a blog post explaining the problem your tool solves, the approach you took, and the results it delivers. Publish on your own blog, dev.to, Hashnode, or Medium. Include code examples showing how to integrate your tool in common workflows.

Create tutorial content that shows your tool in action. A video walkthrough, a step-by-step blog post, or a Jupyter notebook that demonstrates your tool's capabilities can drive discovery from search engines and social media. Developers searching for "how to add weather data to my AI agent" should find your tutorial — and by extension, your tool.

Contribute to the MCP community. Answer questions on Stack Overflow, participate in MCP Discord channels, and comment on relevant GitHub issues. When someone asks "is there an MCP tool for X?" and your tool does X, a helpful answer with a link to your listing is the most effective marketing you can do. Community goodwill translates directly into discovery and adoption.`,
      },
      {
        heading: 'Leverage Cross-Promotion',
        content: `Partner with complementary tool builders. If you built a geocoding tool, reach out to the weather tool builder and propose cross-promotion: each of you mentions the other in your listing and README. Agents that use geocoding often need weather data (and vice versa), so cross-promotion targets exactly the right audience.

Create tool bundles or workflow templates that combine multiple tools. A "complete data enrichment workflow" that chains your tool with 2-3 others demonstrates value and introduces each tool to the other tools' consumers. The SettleGrid marketplace supports workflow templates that link to all participating tools.

Track which channels drive the most discovery traffic. The SettleGrid dashboard shows referral sources for your listing: direct, marketplace search, category page, Discovery API, external link, and badge click. Double down on channels that work and sunset efforts that do not. Most tools find that 80% of their discovery comes from 2-3 channels — optimize those and ignore the rest.`,
      },
    ],
  },

  /* ── 5. Scale Revenue ──────────────────────────────────────────────────── */
  {
    slug: 'how-to-scale-revenue',
    title: 'How to Scale Your AI Tool Revenue',
    description:
      'Strategies for growing your MCP tool from first revenue to sustainable income. Covers metric analysis, pricing optimization, additional monetization methods, referral programs, and CI/CD automation.',
    icon: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
    keywords: [
      'scale AI tool revenue',
      'MCP tool growth',
      'AI tool business scaling',
      'tool revenue optimization',
      'MCP monetization scaling',
      'AI tool referral program',
      'tool automation CI/CD',
    ],
    steps: [
      {
        heading: 'Analyze Your Metrics',
        content: `Scaling starts with understanding your current performance. Open the SettleGrid dashboard and review your key metrics: daily active consumers (DAC), calls per consumer per day, revenue per call, error rate, and p95 latency. These five numbers tell you everything about your tool's health and growth potential.

Calculate your unit economics. Revenue per call minus cost per call (compute, API fees, infrastructure) equals your margin per call. Multiply by daily call volume to get your daily profit. If your margin is thin (below 50%), focus on reducing costs before scaling — scaling a low-margin tool just scales your costs. If your margin is healthy (above 70%), focus on increasing call volume.

Segment your consumers. Not all agents are equal: some make 10 calls per day, others make 10,000. Identify your top 10% of consumers by volume and understand what they are using your tool for. Their use cases are your tool's strongest value proposition, and more consumers like them are your fastest path to revenue growth. Build features and pricing tiers that serve these power users.`,
      },
      {
        heading: 'Optimize Pricing for Growth',
        content: `Once you have baseline metrics, run pricing experiments. The SettleGrid platform supports A/B testing: set two prices and measure conversion and revenue for each group over 48-72 hours. The goal is to find the price that maximizes total revenue (price times volume), not the price that maximizes either metric alone.

Consider introducing volume discounts. A graduated pricing model (first 1,000 calls at full price, next 10,000 at 20% off, 100,000+ at 40% off) encourages consumers to consolidate their usage on your tool rather than spreading it across competitors. The lower per-call revenue at high volumes is more than offset by increased volume and consumer lock-in.

Add a premium tier if you do not already have one. Premium tiers serve two purposes: they capture more value from consumers who need advanced features, and they make your standard tier look like a better deal by comparison (anchoring effect). Price the premium tier at 3-5x your standard price and include genuinely differentiated capabilities — richer data, faster response, higher rate limits, or additional methods.`,
      },
      {
        heading: 'Add Revenue Streams',
        content: `Diversify beyond per-call revenue. Consider offering a monthly subscription that gives consumers unlimited calls (or a high cap) for a fixed fee. Subscriptions provide predictable revenue, reduce consumer price anxiety, and increase retention — subscribers churn at roughly half the rate of pay-per-call consumers.

Build complementary tools. If your core tool is a geocoding API, build a reverse geocoding tool, a batch geocoding tool, and a geofencing tool. Cross-sell them to existing consumers and price the bundle at a discount to buying individually. A portfolio of 3-5 related tools generates 3-5x the revenue of a single tool because consumers who trust your quality will try your other offerings.

Explore enterprise pricing. If your tool serves business-critical workflows, some organizations will pay for dedicated capacity, SLA guarantees, and priority support. Offer an enterprise tier with a monthly minimum commitment, guaranteed uptime, and a dedicated Slack channel. Enterprise contracts typically generate 10-50x the revenue of self-serve consumers and are far more stable.`,
      },
      {
        heading: 'Build a Referral Program',
        content: `Word-of-mouth is the most effective growth channel for MCP tools. Formalize it with a referral program: give existing consumers a referral code that gives new consumers a discount on their first 100 calls, and give the referrer a revenue bonus when the referred consumer becomes a paying user. SettleGrid's API supports tracking referral codes and attributing conversions.

Create incentives that compound. Instead of a one-time bonus, offer ongoing revenue sharing: the referrer earns 5% of the referred consumer's spend for 12 months. This motivates referrers to actively promote your tool and help referred consumers succeed, because their earnings depend on the referred consumer's continued usage.

Publish your referral program prominently. Add it to your tool's listing description, README, and documentation. Share referral links in your blog posts and social media. Announce the program in MCP community channels. The best referral programs grow organically once a critical mass of referrers are motivated to share — your job is to make sharing as easy and rewarding as possible.`,
      },
      {
        heading: 'Automate with CI/CD',
        content: `Manual deployments do not scale. Set up a CI/CD pipeline that automatically tests, builds, and deploys your tool on every push to main. The SettleGrid templates include GitHub Actions workflows that run your test suite, check for TypeScript errors, validate your \`settlegrid.config.ts\`, and deploy to your hosting platform — all in under 3 minutes.

Add automated quality gates. Configure your pipeline to block deployment if test coverage drops below 80%, if any test fails, or if p95 latency in staging exceeds 500ms. These gates prevent regressions that erode consumer trust and reduce revenue. A single deployment that breaks your tool can cost days of lost revenue and months of lost reputation.

Automate monitoring and alerting. Use Infrastructure as Code (Terraform, Pulumi, or CDK) to define your alerts, dashboards, and scaling rules. When you deploy a new version, your monitoring should automatically adjust: new endpoints get latency alerts, new pricing tiers get revenue tracking, and new error codes get categorized in your log aggregator. The goal is zero manual steps between "merge to main" and "running in production with full observability."`,
      },
      {
        heading: 'Plan for Long-Term Growth',
        content: `Sustainable revenue requires a long-term perspective. Invest in reliability above all else — a tool with 99.99% uptime earns the right to charge premium prices and attracts enterprise customers who would never risk their workflows on a less reliable alternative. Measure and publish your uptime, and treat any downtime as a high-priority incident.

Build a moat around your tool. The strongest moats in the MCP ecosystem are proprietary data (data that cannot be obtained elsewhere), domain expertise (specialized models or algorithms), and network effects (tools that get better as more agents use them). Identify which moat applies to your tool and invest in deepening it.

Stay close to the MCP protocol evolution. The Model Context Protocol is actively developing, and each version introduces new capabilities (streaming, multi-hop settlement, agent-to-agent delegation). Early adopters of new protocol features get disproportionate discovery traffic because they are the only tools that support cutting-edge agent workflows. Follow the MCP specification repository, attend community calls, and ship support for new features within days of their release.`,
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const HOWTO_SLUGS = HOWTO_GUIDES.map((g) => g.slug)

export function getHowToGuideBySlug(slug: string): HowToGuide | undefined {
  return HOWTO_GUIDES.find((g) => g.slug === slug)
}
