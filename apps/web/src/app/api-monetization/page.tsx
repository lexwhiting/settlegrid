import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'Monetize Any API with Per-Call Billing | SettleGrid',
  description:
    'Not just MCP. SettleGrid works with REST APIs, Express routes, serverless functions, and any callable endpoint. Add per-call billing in 5 minutes, not 4 weeks.',
  alternates: { canonical: 'https://settlegrid.ai/api-monetization' },
  keywords: [
    'monetize API',
    'API billing platform',
    'per-call API pricing',
    'REST API monetization',
    'API metering',
    'API payment gateway',
    'serverless billing',
    'Express API billing',
  ],
  openGraph: {
    title: 'Monetize Any API with Per-Call Billing | SettleGrid',
    description:
      'Add per-call billing to any API in 5 minutes. REST, Express, serverless, MCP — one SDK covers everything.',
    type: 'website',
    url: 'https://settlegrid.ai/api-monetization',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monetize Any API with Per-Call Billing',
    description:
      'Add per-call billing to any API in 5 minutes. REST, Express, serverless, MCP — one SDK covers everything.',
  },
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ApiMonetizationPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SettleGrid',
    description:
      'Per-call billing platform for REST APIs, MCP tools, serverless functions, and any callable endpoint.',
    url: 'https://settlegrid.ai/api-monetization',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier with 50,000 operations/month',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Start building</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Hero */}
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-amber-400 mb-3 tracking-wide uppercase">
              Not just MCP
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Monetize any API with per-call billing
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              SettleGrid works with LLM inference proxies, browser automation tools, media generation services, code execution sandboxes, data APIs, MCP tools, agent-to-agent workflows, communication services, REST APIs, Express routes, serverless functions, and any callable endpoint.
              Add metering, billing, and payouts in 5 minutes — not 3-4 weeks.
            </p>
          </div>

          {/* Three-step flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <span className="text-lg font-bold text-amber-400">1</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Install the SDK</h2>
              <p className="text-sm text-gray-400 mb-4">One npm package. Works with any JavaScript/TypeScript backend.</p>
              <code className="text-sm bg-[#0C0E14] border border-[#2A2D3E] px-3 py-2 rounded-lg block font-mono text-gray-300">
                npm install @settlegrid/mcp
              </code>
            </div>
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <span className="text-lg font-bold text-amber-400">2</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Set your pricing</h2>
              <p className="text-sm text-gray-400 mb-4">
                Choose per-invocation, per-token, per-byte, per-second, tiered, or outcome-based pricing. You set the price.
              </p>
              <div className="text-sm bg-[#0C0E14] border border-[#2A2D3E] px-3 py-2 rounded-lg font-mono text-gray-300">
                <span className="text-gray-500">// settlegrid.config.json</span><br />
                {`{ "pricing": { "model": "per-invocation", "defaultCostCents": 5 } }`}
              </div>
            </div>
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-4">
                <span className="text-lg font-bold text-amber-400">3</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-100 mb-2">Deploy</h2>
              <p className="text-sm text-gray-400 mb-4">
                Push to production. SettleGrid handles authentication, metering, billing, fraud protection, and payouts.
              </p>
              <code className="text-sm bg-[#0C0E14] border border-[#2A2D3E] px-3 py-2 rounded-lg block font-mono text-gray-300">
                git push origin main
              </code>
            </div>
          </div>

          {/* Code Example */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
              Works with any handler
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Express example */}
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Express / REST API</h3>
                <pre className="text-sm font-mono text-gray-300 leading-relaxed overflow-x-auto">
{`import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid({
  apiKey: process.env.SG_KEY,
  toolSlug: 'my-translation-api',
})

app.post('/translate', sg.meter(), (req, res) => {
  const result = translate(req.body.text)
  res.json({ translation: result })
})`}
                </pre>
              </div>
              {/* Serverless example */}
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6">
                <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Serverless / Next.js API Route</h3>
                <pre className="text-sm font-mono text-gray-300 leading-relaxed overflow-x-auto">
{`import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid({
  apiKey: process.env.SG_KEY,
  toolSlug: 'my-analysis-api',
})

export async function POST(req: Request) {
  const { consumerId } = await sg.verify(req)
  const data = await req.json()
  const result = analyze(data)
  await sg.record(consumerId, 5) // 5 cents
  return Response.json(result)
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Comparison */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
              vs. building billing yourself
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="bg-[#161822] rounded-xl border border-red-500/30 p-6">
                <h3 className="text-lg font-semibold text-red-400 mb-4">DIY Billing Stack</h3>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    3-4 weeks to build authentication, metering, billing, and payout systems
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    Integrate Stripe Connect, build usage tracking, handle disputes
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    Ongoing maintenance: fraud detection, compliance, tax reporting
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                    No marketplace discovery or cross-selling
                  </li>
                </ul>
              </div>
              <div className="bg-[#161822] rounded-xl border border-green-500/30 p-6">
                <h3 className="text-lg font-semibold text-green-400 mb-4">SettleGrid</h3>
                <ul className="space-y-3 text-sm text-gray-400">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    5 minutes to go live with full billing and metering
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Authentication, metering, billing, fraud, and payouts included
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Zero maintenance — SettleGrid handles compliance and updates
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-green-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Automatic marketplace listing and AI agent discovery
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Progressive Pricing */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6 text-center">
              Progressive take rates — keep more as you grow
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { range: '$0 - $1K/mo', rate: '0%', note: 'Keep 100%' },
                { range: '$1K - $10K', rate: '2%', note: 'Keep 98%' },
                { range: '$10K - $50K', rate: '3%', note: 'Keep 97%' },
                { range: '$50K+', rate: '5%', note: 'Keep 95%' },
              ].map((tier) => (
                <div key={tier.range} className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-4 text-center">
                  <p className="text-2xl font-bold text-amber-400">{tier.rate}</p>
                  <p className="text-sm text-gray-400 mt-1">{tier.range}</p>
                  <p className="text-xs text-gray-500 mt-1">{tier.note}</p>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-gray-500 mt-4">
              Free tier: 50,000 ops/month. Builder tier at $19/month for 500,000 ops.
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Start monetizing in 5 minutes
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Whether you have a REST API, Express app, or serverless function — SettleGrid turns it into a revenue stream.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building — Free
              </Link>
              <Link
                href="/docs"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
