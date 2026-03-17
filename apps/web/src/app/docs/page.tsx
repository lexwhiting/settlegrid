import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

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

function highlightCode(code: string): React.ReactNode[] {
  // Tokenize with regex — order matters: comments first, then strings, then keywords
  const tokenPattern = /\/\/[^\n]*|'[^']*'|"[^"]*"|`[^`]*`|\b(import|from|export|const|let|var|function|async|await|return|if|else|try|catch|throw|new|interface|type|extends|class|default|number|string|boolean|void|true|false|null|undefined)\b/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(code)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(code.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('//')) {
      parts.push(<span key={match.index} className="text-gray-500 italic">{token}</span>)
    } else if (token.startsWith("'") || token.startsWith('"') || token.startsWith('`')) {
      parts.push(<span key={match.index} className="text-amber-300">{token}</span>)
    } else {
      parts.push(<span key={match.index} className="text-emerald-400">{token}</span>)
    }
    lastIndex = match.index + token.length
  }
  // Push remaining text
  if (lastIndex < code.length) {
    parts.push(code.slice(lastIndex))
  }
  return parts
}

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="my-4">
      {title && <div className="bg-gray-700 text-gray-300 text-xs px-4 py-2 rounded-t-lg font-mono">{title}</div>}
      <div className={`bg-indigo text-gray-300 text-sm font-mono p-4 overflow-x-auto ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <pre><code>{highlightCode(children)}</code></pre>
      </div>
    </div>
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
            <CodeBlock title="Terminal">{`npm install @settlegrid/mcp`}</CodeBlock>

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
            <CodeBlock title="server.ts">{`import { settlegrid } from '@settlegrid/mcp'

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
server.tool('get-forecast', getForecast)`}</CodeBlock>

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
            <CodeBlock>{`interface InitOptions {
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
}`}</CodeBlock>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2"><code>instance.wrap(handler, options?)</code></h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Wraps a function with billing middleware. The wrapped function extracts the API key,
              validates credits, executes your handler, and meters the usage.
            </p>
            <CodeBlock>{`const wrappedFn = sg.wrap(
  async (args: MyArgs) => { /* your logic */ },
  { method: 'my-method' }  // Optional: defaults to 'default'
)

// Call the wrapped function with context
const result = await wrappedFn(args, {
  headers: { 'x-api-key': 'sg_live_...' },
  // or metadata: { 'settlegrid-api-key': '...' }
})`}</CodeBlock>

            <h3 className="text-lg font-semibold text-indigo dark:text-gray-100 mt-6 mb-2">Error Handling</h3>
            <CodeBlock>{`import {
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
}`}</CodeBlock>
          </Section>

          <Section title="API Reference" id="api-reference">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The SettleGrid REST API is available at{' '}
              <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">https://settlegrid.ai/api</code>.
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
                <div key={route.path} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-[#252836]">
                  <span className={`text-xs font-mono px-2 py-1 rounded ${
                    route.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : route.method === 'POST' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {route.method}
                  </span>
                  <code className="text-sm text-indigo dark:text-gray-100">{route.path}</code>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-auto">{route.desc}</span>
                </div>
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
            <div className="space-y-6">
              {[
                {
                  q: 'How fast is the billing middleware?',
                  a: 'The SDK uses an in-memory LRU cache for key validation (5-minute TTL) and fires metering requests asynchronously. Typical overhead is under 10ms.',
                },
                {
                  q: 'What happens if the SettleGrid API is down?',
                  a: 'The SDK caches key validations locally. If the metering API is unavailable, invocations are queued and retried. Your tool continues to work.',
                },
                {
                  q: 'Do credits expire?',
                  a: 'No. Credits purchased for a specific tool never expire and can be used at any time.',
                },
                {
                  q: 'Can I set different prices for different methods?',
                  a: 'Yes. The pricing config supports per-method pricing overrides. You can set a default cost and then override specific methods.',
                },
                {
                  q: 'How do I handle refunds?',
                  a: 'Contact support to process refunds. Refunded credits are returned to the consumer\'s balance.',
                },
              ].map((faq) => (
                <div key={faq.q}>
                  <h3 className="font-semibold text-indigo dark:text-gray-100 mb-1">{faq.q}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
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
