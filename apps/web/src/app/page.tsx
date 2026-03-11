import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Reusable blocks                                                           */
/* -------------------------------------------------------------------------- */

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group p-6 rounded-xl border border-gray-200 hover:border-brand/40 hover:shadow-md transition-all duration-200">
      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4 group-hover:bg-brand/20 transition-colors">
        {icon}
      </div>
      <h3 className="font-semibold text-indigo mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-brand text-white font-bold text-lg flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-indigo text-lg mb-2">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
    </div>
  )
}

function ComparisonTable() {
  const features = [
    { name: 'Per-call billing', settlegrid: true, mcpize: false, apify: true, moesif: true },
    { name: 'MCP-native SDK', settlegrid: true, mcpize: true, apify: false, moesif: false },
    { name: 'Stripe Connect payouts', settlegrid: true, mcpize: false, apify: false, moesif: false },
    { name: 'Tool storefronts', settlegrid: true, mcpize: false, apify: true, moesif: false },
    { name: 'Per-method pricing', settlegrid: true, mcpize: false, apify: false, moesif: true },
    { name: 'Consumer API keys', settlegrid: true, mcpize: false, apify: true, moesif: true },
    { name: 'Auto-refill credits', settlegrid: true, mcpize: false, apify: false, moesif: false },
    { name: '85/15 revenue split', settlegrid: true, mcpize: false, apify: false, moesif: false },
    { name: '<50ms overhead', settlegrid: true, mcpize: false, apify: false, moesif: true },
    { name: 'Open-source SDK', settlegrid: true, mcpize: true, apify: false, moesif: false },
    { name: 'Sandbox / test mode', settlegrid: true, mcpize: false, apify: true, moesif: false },
    { name: 'HMAC-signed webhooks', settlegrid: true, mcpize: false, apify: false, moesif: true },
    { name: 'Audit logging + CSV export', settlegrid: true, mcpize: false, apify: false, moesif: true },
    { name: 'IP allowlisting', settlegrid: true, mcpize: false, apify: false, moesif: false },
    { name: 'Tool versioning', settlegrid: true, mcpize: false, apify: true, moesif: false },
    { name: 'Reviews & ratings', settlegrid: true, mcpize: false, apify: true, moesif: false },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left py-3 px-4 font-medium text-gray-500">Feature</th>
            <th scope="col" className="text-center py-3 px-4 font-semibold text-brand-text">SettleGrid</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500">MCPize</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500">Apify</th>
            <th scope="col" className="text-center py-3 px-4 font-medium text-gray-500">Moesif</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.name} className="border-b border-gray-100">
              <td className="py-3 px-4 text-gray-700">{f.name}</td>
              <td className="text-center py-3 px-4">{f.settlegrid ? <span className="text-brand-text font-bold" aria-label="Yes">&#10003;</span> : <span className="text-gray-300" aria-label="No">&#8212;</span>}</td>
              <td className="text-center py-3 px-4">{f.mcpize ? <span className="text-green-500" aria-label="Yes">&#10003;</span> : <span className="text-gray-300" aria-label="No">&#8212;</span>}</td>
              <td className="text-center py-3 px-4">{f.apify ? <span className="text-green-500" aria-label="Yes">&#10003;</span> : <span className="text-gray-300" aria-label="No">&#8212;</span>}</td>
              <td className="text-center py-3 px-4">{f.moesif ? <span className="text-green-500" aria-label="Yes">&#10003;</span> : <span className="text-gray-300" aria-label="No">&#8212;</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeSnippet() {
  return (
    <div className="bg-indigo rounded-lg p-6 text-sm font-mono text-left overflow-x-auto shadow-2xl">
      <div className="flex items-center gap-1.5 mb-4">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="text-xs text-gray-500 ml-2">index.ts</span>
      </div>
      <pre className="text-gray-300">
        <code>{`import { settlegrid } from '@settlegrid/mcp'

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

// Wrap any function as a monetized tool
const getForecast = sg.wrap(
  async (args: { city: string }) => {
    const data = await fetchWeather(args.city)
    return { forecast: data }
  },
  { method: 'get-forecast' }
)`}</code>
      </pre>
    </div>
  )
}

function PricingSection() {
  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold text-indigo mb-4">Simple, Fair Pricing</h2>
      <p className="text-gray-600 mb-10 max-w-xl mx-auto">
        No monthly fees. No setup costs. We take 15% of each transaction — you keep 85%.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        <div className="p-8 rounded-xl border-2 border-gray-200 text-center">
          <h3 className="font-semibold text-lg text-indigo mb-2">Developers</h3>
          <div className="text-4xl font-bold text-brand-text mb-2">$0</div>
          <p className="text-sm text-gray-500 mb-6">to get started</p>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>&#10003; Unlimited tools</li>
            <li>&#10003; Per-call billing</li>
            <li>&#10003; Stripe Connect payouts</li>
            <li>&#10003; Dashboard analytics</li>
            <li>&#10003; 85% revenue share</li>
          </ul>
        </div>
        <div className="p-8 rounded-xl border-2 border-brand text-center relative">
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </div>
          <h3 className="font-semibold text-lg text-indigo mb-2">Consumers</h3>
          <div className="text-4xl font-bold text-brand-text mb-2">Pay-as-you-go</div>
          <p className="text-sm text-gray-500 mb-6">prepaid credits</p>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>&#10003; $5 / $20 / $50 credit packs</li>
            <li>&#10003; Custom amounts</li>
            <li>&#10003; Auto-refill option</li>
            <li>&#10003; Per-tool API keys</li>
            <li>&#10003; Usage dashboard</li>
          </ul>
        </div>
        <div className="p-8 rounded-xl border-2 border-gray-200 text-center">
          <h3 className="font-semibold text-lg text-indigo mb-2">Enterprise</h3>
          <div className="text-4xl font-bold text-brand-text mb-2">90/10</div>
          <p className="text-sm text-gray-500 mb-6">revenue split</p>
          <ul className="text-sm text-gray-600 space-y-2 text-left">
            <li>&#10003; 90% revenue share</li>
            <li>&#10003; Priority webhook delivery</li>
            <li>&#10003; Advanced analytics &amp; exports</li>
            <li>&#10003; 99.9% uptime SLA</li>
            <li>&#10003; Dedicated Slack support</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">$199/mo per tool, self-serve</p>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  SVG icon helpers (Heroicons-style, 24x24 viewBox)                         */
/* -------------------------------------------------------------------------- */

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

// Per-call billing (dollar)
const iconBilling = "M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
// Payouts (banknote)
const iconPayouts = "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"
// SDK (code)
const iconSdk = "M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
// Storefronts (storefront)
const iconStorefront = "M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
// Analytics (chart)
const iconAnalytics = "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
// Security (shield)
const iconSecurity = "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
// Sandbox (beaker)
const iconSandbox = "M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
// Webhooks (bell-alert)
const iconWebhooks = "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
// Audit (clipboard-document-list)
const iconAudit = "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
// Budget (wallet)
const iconBudget = "M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
// Metadata (tag)
const iconMetadata = "M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z M6 6h.008v.008H6V6Z"
// IP allowlist (globe-lock)
const iconIpAllowlist = "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
// Directory (squares-2x2)
const iconDirectory = "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z"
// Reviews (star)
const iconReviews = "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
// Profiles (user-circle)
const iconProfiles = "M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
// Versioning (arrows-up-down)
const iconVersioning = "M3 7.5 7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5"
// Rate limiting (funnel)
const iconRateLimiting = "M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Header ---- */}
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <SettleGridLogo variant="horizontal" size={32} />
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors">
              Marketplace
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-indigo transition-colors">
              Docs
            </Link>
            <Link href="/login" className="text-sm font-medium text-indigo hover:text-brand-dark transition-colors">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ================================================================ */}
        {/*  1. Hero                                                         */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-emerald-light text-brand-text text-xs font-semibold px-3 py-1 rounded-full mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand" />
                </span>
                Now in Public Beta
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-indigo mb-6 leading-[1.1]">
                The Settlement Layer for the{' '}
                <span className="text-brand-text">AI Tool Economy</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Monetize your MCP tools with per-call billing. One SDK wrapper,
                automated Stripe payouts, consumer storefronts, and a public marketplace
                with reviews and ratings.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
                  Start Building
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center border-2 border-indigo text-indigo font-semibold px-8 py-3 rounded-lg text-lg hover:bg-indigo hover:text-white transition-colors">
                  Read Docs
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-8 text-sm text-gray-500">
                <span>&#10003; Free to start</span>
                <span>&#10003; No monthly fees</span>
                <span>&#10003; &lt;50ms overhead</span>
              </div>
            </div>
            <div>
              <CodeSnippet />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  2. Features grid — 16 cards across 5 logical groups              */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-cloud">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-indigo text-center mb-4">
              Everything you need to monetize AI tools
            </h2>
            <p className="text-gray-600 text-center mb-16 max-w-2xl mx-auto">
              From one-line SDK integration to a full marketplace with analytics, security, and
              consumer-facing features — SettleGrid handles the entire commerce layer.
            </p>

            {/* -- Core Platform -- */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Core Platform</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <FeatureCard
                icon={<Icon d={iconBilling} />}
                title="Per-Call Billing"
                description="Charge consumers per API call with configurable per-method pricing. Prepaid credit balances with optional auto-refill."
              />
              <FeatureCard
                icon={<Icon d={iconPayouts} />}
                title="Automated Payouts"
                description="Stripe Connect Express handles KYC, tax forms, and fraud. Weekly or monthly payouts with configurable minimums."
              />
              <FeatureCard
                icon={<Icon d={iconSdk} />}
                title="MCP-Native SDK"
                description="Wrap any function as a monetized MCP tool. TypeScript SDK with ESM/CJS support. Under 50KB, zero config."
              />
              <FeatureCard
                icon={<Icon d={iconStorefront} />}
                title="Tool Storefronts"
                description="Auto-generated public pages for every tool. SEO-optimized with pricing, docs, and one-click credit purchase."
              />
            </div>

            {/* -- Developer Tools -- */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Developer Tools</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <FeatureCard
                icon={<Icon d={iconAnalytics} />}
                title="Advanced Analytics"
                description="Method breakdown, hourly usage patterns, latency percentiles (p50/p95/p99), error rates, and revenue projections."
              />
              <FeatureCard
                icon={<Icon d={iconVersioning} />}
                title="Tool Versioning"
                description="Semver management with public changelogs. Consumers pin versions; deprecation notices with migration windows."
              />
              <FeatureCard
                icon={<Icon d={iconWebhooks} />}
                title="Webhooks"
                description="Real-time event notifications signed with HMAC-SHA256. Delivery tracking, retry logic, and configurable event filters."
              />
              <FeatureCard
                icon={<Icon d={iconProfiles} />}
                title="Developer Profiles"
                description="Public profiles with bios, avatars, and tool portfolios. Build reputation and trust with verified developer badges."
              />
            </div>

            {/* -- Consumer Features -- */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Consumer Features</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <FeatureCard
                icon={<Icon d={iconBudget} />}
                title="Budget Controls"
                description="Per-tool spending limits and low-balance alerts. Consumers stay in control of their credit spend at all times."
              />
              <FeatureCard
                icon={<Icon d={iconMetadata} />}
                title="Custom Metadata"
                description="Attach structured JSON metadata to every invocation. Tag calls by project, environment, or user for fine-grained tracking."
              />
              <FeatureCard
                icon={<Icon d={iconReviews} />}
                title="Reviews & Ratings"
                description="Consumer reviews drive trust and discovery. Star ratings, written feedback, and developer response threads."
              />
              <FeatureCard
                icon={<Icon d={iconIpAllowlist} />}
                title="IP Allowlisting"
                description="Restrict API keys to specific IPs or CIDR ranges. Enterprise-grade access control for high-security environments."
              />
            </div>

            {/* -- Security & Compliance -- */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Security & Compliance</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <FeatureCard
                icon={<Icon d={iconSandbox} />}
                title="Sandbox Mode"
                description="Test your entire integration risk-free with test API keys. Simulated billing, webhooks, and analytics — zero real charges."
              />
              <FeatureCard
                icon={<Icon d={iconAudit} />}
                title="Audit Logging"
                description="Complete audit trail for every action. Filterable by date, actor, and resource type. One-click CSV export for compliance."
              />
              <FeatureCard
                icon={<Icon d={iconSecurity} />}
                title="Enterprise Security"
                description="API key hashing (SHA-256), Stripe webhook signature verification, CSRF protection, and role-based access controls."
              />
              <FeatureCard
                icon={<Icon d={iconRateLimiting} />}
                title="Rate Limiting"
                description="Configurable per-key rate limits with sliding-window enforcement. Automatic 429 responses with Retry-After headers."
              />
            </div>

            {/* -- Marketplace -- */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Marketplace</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon={<Icon d={iconDirectory} />}
                title="Tool Directory"
                description="Public searchable marketplace of all published tools. Category browsing, search filters, and curated collections."
              />
              <FeatureCard
                icon={<Icon d={iconReviews} />}
                title="Ratings & Discovery"
                description="Algorithmic ranking by usage, rating, and recency. Featured tools, trending lists, and category leaderboards."
              />
              <FeatureCard
                icon={<Icon d={iconStorefront} />}
                title="One-Click Purchase"
                description="Consumers buy credits and start calling tools in seconds. Stripe Checkout, Apple Pay, and Google Pay supported."
              />
              <FeatureCard
                icon={<Icon d={iconProfiles} />}
                title="Developer Ecosystem"
                description="Follow developers, get notified of new tools and updates. Community-driven discovery through social proof."
              />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  3. How it works — 3-step developer flow                         */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-indigo text-center mb-4">
              Ship a monetized tool in 5 minutes
            </h2>
            <p className="text-gray-600 text-center mb-16 max-w-xl mx-auto">
              Three steps to go from open-source function to paid API product.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <StepCard
                step="1"
                title="Wrap your function"
                description="Install @settlegrid/mcp, configure pricing per method, and wrap your handler. One import, five lines of code."
              />
              <StepCard
                step="2"
                title="Connect Stripe"
                description="One-click Stripe Connect onboarding. We handle KYC, tax forms, and payouts. You get an 85% revenue share."
              />
              <StepCard
                step="3"
                title="Publish & earn"
                description="Your tool appears in the marketplace with a storefront, analytics dashboard, and consumer API key management."
              />
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  4. Enterprise section                                           */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-indigo text-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Built for Enterprise</h2>
                <p className="text-gray-300 text-lg mb-8 leading-relaxed">
                  SettleGrid meets the security and compliance requirements of the most
                  demanding organizations. Every feature is designed with zero-trust
                  principles from day one.
                </p>
                <ul className="space-y-4">
                  {[
                    { label: 'Sandbox mode', desc: 'Test integrations without real charges or side effects' },
                    { label: 'IP allowlisting', desc: 'Lock API keys to specific IP ranges and CIDR blocks' },
                    { label: 'HMAC-SHA256 webhooks', desc: 'Cryptographically signed event payloads you can verify' },
                    { label: 'Audit logging', desc: 'Full audit trail with CSV export for SOC 2 evidence collection' },
                    { label: 'SHA-256 key hashing', desc: 'API keys are hashed at rest — we never store plaintext' },
                    { label: 'Rate limiting', desc: 'Sliding-window enforcement protects against abuse and DDoS' },
                  ].map((item) => (
                    <li key={item.label} className="flex items-start gap-3">
                      <span className="text-brand-light mt-1 font-bold" aria-hidden="true">&#10003;</span>
                      <div>
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-gray-400"> — {item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-indigo-light rounded-xl p-8 border border-white/10">
                <div className="text-sm font-mono text-gray-300 space-y-3">
                  <p className="text-gray-500"># Verify webhook signature</p>
                  <p>
                    <span className="text-brand-light">import</span> hmac, hashlib
                  </p>
                  <p className="mt-2">signature = hmac.new(</p>
                  <p className="pl-4">webhook_secret.encode(),</p>
                  <p className="pl-4">request.body,</p>
                  <p className="pl-4">hashlib.sha256</p>
                  <p>).hexdigest()</p>
                  <p className="mt-2">
                    <span className="text-brand-light">assert</span> signature == request.headers[
                  </p>
                  <p className="pl-4">&apos;X-SettleGrid-Signature&apos;</p>
                  <p>]</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/*  5. Comparison table                                             */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-indigo text-center mb-4">
              How SettleGrid Compares
            </h2>
            <p className="text-gray-600 text-center mb-10 max-w-xl mx-auto">
              Purpose-built for MCP tool monetization. No compromises.
            </p>
            <ComparisonTable />
          </div>
        </section>

        {/* ================================================================ */}
        {/*  6. Pricing                                                      */}
        {/* ================================================================ */}
        <section className="px-6 py-24 bg-cloud">
          <div className="max-w-6xl mx-auto">
            <PricingSection />
          </div>
        </section>

        {/* ================================================================ */}
        {/*  7. CTA                                                          */}
        {/* ================================================================ */}
        <section className="px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-indigo mb-4">
              Ready to monetize your AI tools?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join developers earning revenue from every tool call. Free to start,
              pay only when you earn.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
                Get Started Free
              </Link>
              <Link href="/tools" className="inline-flex items-center justify-center border-2 border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-lg text-lg hover:border-indigo hover:text-indigo transition-colors">
                Browse Marketplace
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/tools" className="hover:text-indigo transition-colors">Marketplace</Link>
            <Link href="/docs" className="hover:text-indigo transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-indigo transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
