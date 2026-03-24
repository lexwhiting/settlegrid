import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { BuyCreditsButton } from '@/components/storefront/buy-credits-button'
import { ReviewForm } from '@/components/storefront/review-form'

interface ToolData {
  id: string
  name: string
  slug: string
  description: string
  developerName: string
  category: string
  currentVersion: string
  pricingConfig: {
    model?: string
    defaultCostCents?: number
    perCallCents?: number
    costPerToken?: number
    costPerMB?: number
    costPerSecond?: number
    methods?: Record<string, { costCents: number; displayName?: string; unitType?: string }>
    tiers?: { upTo: number; costCents: number }[]
    outcomeConfig?: { successCostCents: number; failureCostCents?: number; successCondition?: string }
  }
  reviews: {
    id: string
    consumerName: string
    rating: number
    comment: string
    createdAt: string
  }[]
  changelog: {
    version: string
    changeType: string
    summary: string
    releasedAt: string
  }[]
  averageRating: number
  reviewCount: number
}

function formatCents(cents: number): string {
  return cents < 100
    ? `${cents}\u00A2`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function pricingModelLabel(model?: string): string {
  switch (model) {
    case 'per-invocation': return 'Per Invocation'
    case 'per-token': return 'Per Token'
    case 'per-byte': return 'Per Byte'
    case 'per-second': return 'Per Second'
    case 'tiered': return 'Tiered (Per Method)'
    case 'outcome': return 'Outcome-Based'
    default: return 'Per Call'
  }
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconSize = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${iconSize} ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200 dark:text-gray-600'}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
        </svg>
      ))}
    </div>
  )
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

  if (!tool) {
    return (
      <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
        <header className="border-b border-[#2E3148] px-6 py-4">
          <nav className="max-w-4xl mx-auto flex items-center justify-between">
            <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
            <div className="flex items-center gap-4">
              <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Showcase</Link>
              <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="w-14 h-14 rounded-full bg-[#1A1D2E] border border-[#2E3148] flex items-center justify-center mx-auto mb-6">
              <svg className="w-7 h-7 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-3">Tool Not Available</h1>
            <p className="text-gray-400 mb-6">
              This tool hasn&apos;t been published yet, or the URL may be incorrect. Published tools appear in our showcase.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/tools" className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors">
                Browse Showcase
              </Link>
              <Link href="/docs" className="text-gray-400 hover:text-gray-200 font-medium transition-colors">
                Read Docs
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const pricingModel = tool.pricingConfig.model ?? 'per-invocation'
  const methods = tool.pricingConfig.methods ?? {}
  const methodEntries = Object.entries(methods)
  const reviews = tool.reviews ?? []
  const changelog = tool.changelog ?? []

  const changeTypeBadge = (type: string) => {
    switch (type) {
      case 'feature': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case 'fix': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      case 'breaking': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      case 'deprecation': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      default: return 'bg-gray-100 dark:bg-[#252836] text-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      <header className="border-b border-gray-200 dark:border-[#2E3148] px-6 py-4">
        <nav className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:text-gray-100">
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
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-4xl font-bold text-indigo dark:text-gray-100">{tool.name}</h1>
              {tool.category && (
                <span className="inline-flex items-center rounded-full border border-transparent bg-brand/10 text-brand-text px-2.5 py-0.5 text-xs font-semibold">
                  {tool.category}
                </span>
              )}
              {tool.currentVersion && (
                <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-[#2E3148] text-gray-600 dark:text-gray-400 px-2.5 py-0.5 text-xs font-medium">
                  v{tool.currentVersion}
                </span>
              )}
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{tool.description}</p>
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                by <span className="text-gray-600 dark:text-gray-400">{tool.developerName}</span>
              </p>
              {tool.reviewCount > 0 && (
                <div className="flex items-center gap-2">
                  <StarRating rating={tool.averageRating ?? 0} />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({tool.reviewCount} review{tool.reviewCount !== 1 ? 's' : ''})
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pricing */}
            <div className="md:col-span-2">
              <div className="bg-white dark:bg-[#1A1D2E] rounded-xl border border-gray-200 dark:border-[#2E3148] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-indigo dark:text-gray-100">Pricing</h2>
                  <span className="inline-flex items-center rounded-full bg-brand/10 text-brand-text px-2.5 py-0.5 text-xs font-medium">
                    {pricingModelLabel(pricingModel)}
                  </span>
                </div>
                <div className="space-y-3">
                  {/* per-invocation */}
                  {pricingModel === 'per-invocation' && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                      <span className="text-gray-600 dark:text-gray-400">Per call</span>
                      <span className="font-semibold text-brand-text">{formatCents(tool.pricingConfig.defaultCostCents ?? 0)}</span>
                    </div>
                  )}

                  {/* per-token */}
                  {pricingModel === 'per-token' && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                      <span className="text-gray-600 dark:text-gray-400">Per 1K tokens</span>
                      <span className="font-semibold text-brand-text">${((tool.pricingConfig.costPerToken ?? 0) * 1000).toFixed(3)}</span>
                    </div>
                  )}

                  {/* per-byte */}
                  {pricingModel === 'per-byte' && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                      <span className="text-gray-600 dark:text-gray-400">Per MB transferred</span>
                      <span className="font-semibold text-brand-text">{formatCents(tool.pricingConfig.costPerMB ?? 0)}</span>
                    </div>
                  )}

                  {/* per-second */}
                  {pricingModel === 'per-second' && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                      <span className="text-gray-600 dark:text-gray-400">Per second of compute</span>
                      <span className="font-semibold text-brand-text">{formatCents(tool.pricingConfig.costPerSecond ?? 0)}</span>
                    </div>
                  )}

                  {/* tiered — show all methods */}
                  {pricingModel === 'tiered' && methodEntries.length > 0 && (
                    <>
                      {methodEntries.map(([method, config]) => (
                        <div key={method} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                          <span className="text-gray-600 dark:text-gray-400">
                            <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{method}</code>
                            {config.displayName && <span className="ml-2 text-gray-500 dark:text-gray-400">{config.displayName}</span>}
                          </span>
                          <span className="font-semibold text-brand-text">{formatCents(config.costCents)}</span>
                        </div>
                      ))}
                    </>
                  )}

                  {/* outcome — show success/failure */}
                  {pricingModel === 'outcome' && tool.pricingConfig.outcomeConfig && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                        <span className="text-gray-600 dark:text-gray-400">On success</span>
                        <span className="font-semibold text-brand-text">{formatCents(tool.pricingConfig.outcomeConfig.successCostCents)}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                        <span className="text-gray-600 dark:text-gray-400">On failure</span>
                        <span className="font-semibold text-gray-500 dark:text-gray-400">{formatCents(tool.pricingConfig.outcomeConfig.failureCostCents ?? 0)}</span>
                      </div>
                    </>
                  )}

                  {/* Fallback: show methods for any model that has them (non-tiered) */}
                  {pricingModel !== 'tiered' && methodEntries.length > 0 && (
                    <>
                      <div className="pt-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium uppercase tracking-wider">Method overrides</p>
                      </div>
                      {methodEntries.map(([method, config]) => (
                        <div key={method} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-[#252836]">
                          <span className="text-gray-600 dark:text-gray-400">
                            <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">{method}</code>
                            {config.displayName && <span className="ml-2 text-gray-500 dark:text-gray-400">{config.displayName}</span>}
                          </span>
                          <span className="font-semibold text-brand-text">{formatCents(config.costCents)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>

              {/* Quick Start */}
              <div className="mt-8 bg-white dark:bg-[#1A1D2E] rounded-xl border border-gray-200 dark:border-[#2E3148] p-6">
                <h2 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-4">Quick Start</h2>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong className="text-gray-900 dark:text-gray-200">1. Buy credits</strong> — Use the panel on the right to purchase credits for this tool via Stripe.</p>
                  <p><strong className="text-gray-900 dark:text-gray-200">2. Get your API key</strong> — After purchasing, go to your <a href="/consumer" className="text-brand hover:underline">Consumer Dashboard</a> to generate an API key.</p>
                  <p><strong className="text-gray-900 dark:text-gray-200">3. Call the tool</strong> — The developer hosts this tool on their own server. Use your API key in the <code className="bg-gray-100 dark:bg-[#252836] px-1.5 py-0.5 rounded text-xs">x-api-key</code> header when calling their endpoint. SettleGrid handles metering and billing automatically.</p>
                </div>
                <CopyableCodeBlock
                  className="!my-0 mt-4"
                  title="Example"
                  code={`# Replace with the developer's actual tool endpoint
curl -X POST https://developer-tool-server.com/api/${tool.slug} \\
  -H "x-api-key: sg_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "your input here"}'`}
                />
              </div>
            </div>

            {/* Purchase sidebar */}
            <div>
              <div className="bg-white dark:bg-[#1A1D2E] rounded-xl border-2 border-brand p-6 sticky top-8">
                <h3 className="font-semibold text-indigo dark:text-gray-100 mb-4">Buy Credits</h3>
                <div className="space-y-2 mb-6">
                  {[
                    { amount: 500, label: '$5.00' },
                    { amount: 2000, label: '$20.00' },
                    { amount: 5000, label: '$50.00' },
                  ].map((tier) => (
                    <BuyCreditsButton
                      key={tier.amount}
                      toolId={tool.id}
                      amountCents={tier.amount}
                      label={tier.label}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Credits never expire. You can purchase more at any time.
                </p>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="mt-12">
            <div className="bg-white dark:bg-[#1A1D2E] rounded-xl border border-gray-200 dark:border-[#2E3148] p-6">
              <h2 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-6">Reviews</h2>
              {reviews.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No reviews yet. Be the first to review this tool after using it.</p>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 dark:border-[#252836] pb-5 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-indigo dark:text-gray-100">
                              {review.consumerName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{review.consumerName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed ml-11">{review.comment}</p>
                    </div>
                  ))}
                </div>
              )}
              <ReviewForm toolSlug={slug} />
            </div>
          </div>

          {/* Changelog Section */}
          <div className="mt-8">
            <div className="bg-white dark:bg-[#1A1D2E] rounded-xl border border-gray-200 dark:border-[#2E3148] p-6">
              <h2 className="text-lg font-semibold text-indigo dark:text-gray-100 mb-6">Changelog</h2>
              {changelog.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No changelog entries yet.</p>
              ) : (
                <div className="space-y-4">
                  {changelog.map((entry, i) => (
                    <div key={i} className="flex items-start gap-4 border-b border-gray-100 dark:border-[#252836] pb-4 last:border-0 last:pb-0">
                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full border border-gray-300 dark:border-[#2E3148] text-gray-700 dark:text-gray-300 px-2.5 py-0.5 text-xs font-mono font-medium">
                          v{entry.version}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${changeTypeBadge(entry.changeType)}`}>
                            {entry.changeType}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(entry.releasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{entry.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-[#2E3148] px-6 py-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          Powered by <Link href="/" className="text-brand-text hover:text-brand-dark">SettleGrid</Link>
        </div>
      </footer>
    </div>
  )
}
