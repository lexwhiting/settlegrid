import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { SettleGridLogo } from '@/components/ui/logo'
import { ClaimButton } from './claim-button'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Validate that a sourceRepoUrl is safe to render as an <a> link */
function isSafeRepoUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && /^(www\.)?github\.com$/i.test(parsed.hostname)
  } catch {
    return false
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClaimableToolData {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  sourceRepoUrl: string | null
  status: string
}

// ─── Data fetching ──────────────────────────────────────────────────────────

const CLAIM_TOKEN_RE = /^[a-f0-9]{48}$/

async function getClaimableTool(token: string): Promise<ClaimableToolData | null> {
  // Validate token format before querying
  if (!token || !CLAIM_TOKEN_RE.test(token)) return null

  try {
    const [tool] = await db
      .select({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        sourceRepoUrl: tools.sourceRepoUrl,
        status: tools.status,
      })
      .from(tools)
      .where(eq(tools.claimToken, token))
      .limit(1)

    return tool ?? null
  } catch {
    return null
  }
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const tool = await getClaimableTool(token)

  if (!tool || tool.status !== 'unclaimed') {
    return {
      title: 'Claim Tool | SettleGrid',
      description: 'Claim your MCP server on SettleGrid and start earning revenue.',
    }
  }

  const description = tool.description
    ? `Claim "${tool.name}" on SettleGrid. ${tool.description.slice(0, 120)}`
    : `Claim "${tool.name}" on SettleGrid and start earning per-call revenue.`

  return {
    title: `Claim ${tool.name} | SettleGrid`,
    description,
    openGraph: {
      title: `Claim ${tool.name} on SettleGrid`,
      description,
      type: 'website',
      url: `https://settlegrid.ai/claim/${token}`,
    },
    twitter: {
      card: 'summary',
      title: `Claim ${tool.name} | SettleGrid`,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const tool = await getClaimableTool(token)

  // Invalid or missing token
  if (!tool) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <SettleGridLogo />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 shadow-sm">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Invalid Claim Link
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              This claim link is invalid or has expired. If you received this link via email, it may have already been used.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              Go to SettleGrid
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Tool already claimed
  if (tool.status !== 'unclaimed') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <SettleGridLogo />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 shadow-sm">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Already Claimed
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              <strong className="text-gray-700 dark:text-gray-300">{tool.name}</strong> has already been claimed by its developer.
            </p>
            <Link
              href={`/tools/${tool.slug}`}
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
            >
              View Tool Page
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── JSON-LD structured data ────────────────────────────────────────────

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.name,
    description: tool.description ?? `${tool.name} MCP server on SettleGrid`,
    applicationCategory: tool.category ?? 'DeveloperApplication',
    url: `https://settlegrid.ai/claim/${token}`,
    provider: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Per-call pricing set by the tool developer',
    },
  }

  // ─── Valid unclaimed tool ───────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <SettleGridLogo />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Claim Your Tool
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Take ownership and start earning revenue
          </p>
        </div>

        {/* Tool card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
          {/* Tool details */}
          <div className="p-6 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.049.58.025 1.192-.14 1.743" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {tool.name}
                </h2>
                {tool.category && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                    {tool.category}
                  </span>
                )}
              </div>
            </div>

            {tool.description && (
              <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                {tool.description.length > 300
                  ? `${tool.description.slice(0, 300)}...`
                  : tool.description}
              </p>
            )}

            {tool.sourceRepoUrl && isSafeRepoUrl(tool.sourceRepoUrl) && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" clipRule="evenodd" />
                </svg>
                <a
                  href={tool.sourceRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 dark:text-amber-400 hover:underline truncate"
                >
                  {tool.sourceRepoUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}
                </a>
              </div>
            )}
          </div>

          {/* Benefits */}
          <div className="p-6 bg-gray-50 dark:bg-gray-950/50 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-200 mb-3">
              What you get by claiming
            </h3>
            <ul className="space-y-2">
              {[
                { icon: 'dollar', text: 'Set per-call pricing (1\u00A2 to $10)' },
                { icon: 'stripe', text: 'Connect Stripe for payouts (95-100% rev share)' },
                { icon: 'chart', text: 'Analytics, reviews, and storefront page' },
                { icon: 'api', text: 'Listed in the discovery API for AI agents' },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Claim action */}
          <div className="p-6">
            <ClaimButton token={token} toolName={tool.name} />
            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-3">
              Takes about 2 minutes. You will set pricing after claiming.
            </p>
          </div>
        </div>

        {/* Footer link */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          Not your tool?{' '}
          <Link href="/" className="text-amber-600 dark:text-amber-400 hover:underline">
            Learn about SettleGrid
          </Link>
        </p>
      </div>
    </div>
  )
}
