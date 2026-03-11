import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'

interface ToolData {
  id: string
  name: string
  slug: string
  description: string
  developerName: string
  pricingConfig: {
    defaultCostCents: number
    methods?: Record<string, { costCents: number; displayName?: string }>
  }
}

function formatCents(cents: number): string {
  return cents < 100
    ? `${cents}¢`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

async function getToolData(slug: string): Promise<ToolData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'
    const res = await fetch(`${baseUrl}/api/tools/public/${slug}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tool = await getToolData(slug)
  if (!tool) return { title: 'Tool Not Found | SettleGrid' }
  return {
    title: `${tool.name} | SettleGrid`,
    description: tool.description,
    openGraph: {
      title: `${tool.name} — SettleGrid Tool`,
      description: tool.description,
      type: 'website',
    },
  }
}

export default async function ToolStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tool = await getToolData(slug)
  if (!tool) notFound()

  const methods = tool.pricingConfig.methods ?? {}
  const methodEntries = Object.entries(methods)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-indigo">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-indigo mb-3">{tool.name}</h1>
            <p className="text-lg text-gray-600 mb-4">{tool.description}</p>
            <p className="text-sm text-gray-400">
              by <span className="text-gray-600">{tool.developerName}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pricing */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-indigo mb-4">Pricing</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Default (per call)</span>
                    <span className="font-semibold text-brand">{formatCents(tool.pricingConfig.defaultCostCents)}</span>
                  </div>
                  {methodEntries.map(([method, config]) => (
                    <div key={method} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{method}</code>
                        {config.displayName && <span className="ml-2 text-gray-400">{config.displayName}</span>}
                      </span>
                      <span className="font-semibold text-brand">{formatCents(config.costCents)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Start */}
              <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-indigo mb-4">Quick Start</h2>
                <div className="bg-indigo rounded-lg p-4 text-sm font-mono overflow-x-auto">
                  <pre className="text-gray-300">
                    <code>{`# 1. Purchase credits and get an API key
# Visit this page while logged in as a consumer

# 2. Use your API key with the tool
curl -X POST https://settlegrid.ai/api/sdk/meter \\
  -H "x-api-key: sg_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"method": "default"}'`}</code>
                  </pre>
                </div>
              </div>
            </div>

            {/* Purchase sidebar */}
            <div>
              <div className="bg-white rounded-xl border-2 border-brand p-6 sticky top-8">
                <h3 className="font-semibold text-indigo mb-4">Buy Credits</h3>
                <div className="space-y-2 mb-6">
                  {[
                    { amount: 500, label: '$5.00' },
                    { amount: 2000, label: '$20.00' },
                    { amount: 5000, label: '$50.00' },
                  ].map((tier) => (
                    <a
                      key={tier.amount}
                      href={`/api/billing/checkout?toolId=${tool.id}&amountCents=${tier.amount}`}
                      className="block w-full py-3 px-4 text-center bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors"
                    >
                      {tier.label}
                    </a>
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Credits never expire. You can purchase more at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-6 py-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500">
          Powered by <Link href="/" className="text-brand hover:text-brand-dark">SettleGrid</Link>
        </div>
      </footer>
    </div>
  )
}
