import Link from 'next/link'
import { SettleGridLogo } from '@/components/ui/logo'

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
    <div className="p-6 rounded-xl border border-gray-200 hover:border-brand/40 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-indigo mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
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
    <div className="bg-indigo rounded-lg p-6 text-sm font-mono text-left overflow-x-auto">
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

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <SettleGridLogo variant="horizontal" size={32} />
          <div className="flex items-center gap-4">
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
        {/* Hero */}
        <section className="px-6 py-20">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold tracking-tight text-indigo mb-6">
                The Settlement Layer for the{' '}
                <span className="text-brand-text">AI Economy</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Monetize your MCP tools with per-call billing. One SDK wrapper,
                automated Stripe payouts, and consumer-ready storefronts.
              </p>
              <div className="flex items-center gap-4">
                <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
                  Start Building
                </Link>
                <Link href="/docs" className="inline-flex items-center justify-center border-2 border-indigo text-indigo font-semibold px-8 py-3 rounded-lg text-lg hover:bg-indigo hover:text-white transition-colors">
                  Read Docs
                </Link>
              </div>
            </div>
            <div>
              <CodeSnippet />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="px-6 py-20 bg-cloud">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-indigo text-center mb-12">
              Everything you need to monetize AI tools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                title="Per-Call Billing"
                description="Charge consumers per API call with configurable per-method pricing. Prepaid credit balances with optional auto-refill."
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5" /></svg>}
                title="Automated Payouts"
                description="Stripe Connect Express handles KYC, tax forms, and fraud. Weekly or monthly payouts with configurable minimums."
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>}
                title="MCP-Native SDK"
                description="Wrap any function as a monetized MCP tool. TypeScript SDK with ESM/CJS support. Under 50KB, zero config."
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" /></svg>}
                title="Tool Storefronts"
                description="Auto-generated public pages for every tool. SEO-optimized with pricing, docs, and one-click credit purchase."
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>}
                title="Real-Time Analytics"
                description="Dashboard with revenue charts, invocation counts by method, top consumers, and payout history."
              />
              <FeatureCard
                icon={<svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>}
                title="Enterprise Security"
                description="API key hashing (SHA-256), rate limiting, Stripe webhook signature verification, and CSRF protection."
              />
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="px-6 py-20">
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

        {/* Pricing */}
        <section className="px-6 py-20 bg-cloud">
          <div className="max-w-6xl mx-auto">
            <PricingSection />
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-indigo mb-4">
              Ready to monetize your AI tools?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Join developers earning revenue from every tool call. Free to start,
              pay only when you earn.
            </p>
            <Link href="/register" className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3 rounded-lg text-lg hover:bg-brand-dark transition-colors">
              Get Started Free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-500">
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
