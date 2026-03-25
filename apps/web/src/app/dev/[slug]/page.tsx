import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'
import { db } from '@/lib/db'
import { developers, tools, developerReputation } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DevTool {
  name: string
  slug: string
  description: string | null
  category: string | null
  currentVersion: string
}

type ReputationTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

function getReputationTier(score: number): { tier: ReputationTier; color: string } {
  if (score >= 80) return { tier: 'Platinum', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' }
  if (score >= 60) return { tier: 'Gold', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' }
  if (score >= 40) return { tier: 'Silver', color: 'text-gray-300 bg-gray-400/10 border-gray-400/30' }
  return { tier: 'Bronze', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' }
}

// ─── Data fetching ──────────────────────────────────────────────────────────

async function getDevProfile(slug: string) {
  try {
    const [dev] = await db
      .select()
      .from(developers)
      .where(eq(developers.slug, slug))
      .limit(1)

    if (!dev) return null
    if (!dev.publicProfile) return { developer: dev, isPrivate: true as const }

    const devTools = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        description: tools.description,
        category: tools.category,
        currentVersion: tools.currentVersion,
      })
      .from(tools)
      .where(and(eq(tools.developerId, dev.id), eq(tools.status, 'active')))
      .limit(50)

    const [reputation] = await db
      .select()
      .from(developerReputation)
      .where(eq(developerReputation.developerId, dev.id))
      .limit(1)

    return {
      developer: dev,
      isPrivate: false as const,
      tools: devTools as DevTool[],
      reputation: reputation ?? null,
    }
  } catch {
    return null
  }
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getDevProfile(slug)

  if (!data || data.isPrivate) {
    return { title: 'Developer Profile | SettleGrid' }
  }

  const name = data.developer.name ?? slug
  const description = data.developer.publicBio
    ? `${data.developer.publicBio.slice(0, 150)} — ${data.tools.length} tools on SettleGrid.`
    : `${name} has ${data.tools.length} tools on SettleGrid.`

  return {
    title: `${name} | SettleGrid Developer`,
    description,
    alternates: { canonical: `https://settlegrid.ai/dev/${slug}` },
    openGraph: {
      title: `${name} | SettleGrid Developer`,
      description,
      type: 'profile',
    },
  }
}

export async function generateStaticParams() {
  try {
    const publicDevs = await db
      .select({ slug: developers.slug })
      .from(developers)
      .where(eq(developers.publicProfile, true))
      .limit(100)

    return publicDevs
      .filter((d): d is { slug: string } => d.slug != null)
      .map((d) => ({ slug: d.slug }))
  } catch {
    return []
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function DevProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getDevProfile(slug)

  // Not found
  if (!data) {
    return (
      <Shell>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D2E] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Developer not found</h1>
            <p className="text-gray-400 text-sm mb-6 max-w-md">
              No developer profile exists at this URL.
            </p>
            <Link href="/tools" className="text-sm font-medium bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-colors">
              Browse Showcase
            </Link>
          </div>
        </main>
      </Shell>
    )
  }

  // Private profile
  if (data.isPrivate) {
    return (
      <Shell>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#1A1D2E] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">Profile not public</h1>
            <p className="text-gray-400 text-sm mb-6 max-w-md">
              This developer has not made their profile public yet.
            </p>
            <Link href="/tools" className="text-sm font-medium bg-brand text-white px-5 py-2.5 rounded-lg hover:bg-brand-dark transition-colors">
              Browse Showcase
            </Link>
          </div>
        </main>
      </Shell>
    )
  }

  // Public profile
  const { developer, tools: devTools, reputation } = data
  const name = developer.name ?? slug
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const joinDate = new Date(developer.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const repTier = reputation ? getReputationTier(reputation.score) : null
  const badgeSnippet = `![SettleGrid](https://settlegrid.ai/api/badge/dev/${slug})`

  return (
    <Shell>
      <main className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Developer Info */}
          <div className="flex items-start gap-6 mb-10">
            {developer.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={developer.avatarUrl}
                alt={name}
                className="w-20 h-20 rounded-full object-cover border-2 border-[#2E3148] shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center border-2 border-[#2E3148] shrink-0">
                <span className="text-2xl font-bold text-emerald-400">{initials}</span>
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-gray-100">{name}</h1>
                {repTier && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${repTier.color}`}>
                    <TierIcon tier={repTier.tier} />
                    {repTier.tier}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3">Member since {joinDate}</p>
              {developer.publicBio && (
                <p className="text-gray-300 leading-relaxed">{developer.publicBio}</p>
              )}
            </div>
          </div>

          {/* Stats */}
          {reputation && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
              <StatCard label="Tools" value={String(reputation.totalTools)} />
              <StatCard label="Consumers" value={String(reputation.totalConsumers)} />
              <StatCard label="Uptime" value={`${reputation.uptimePct}%`} />
              <StatCard
                label="Avg Rating"
                value={reputation.reviewAvg > 0 ? (reputation.reviewAvg / 100).toFixed(1) : '--'}
              />
            </div>
          )}

          {/* Tools Section */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Tools</h2>
            {devTools.length === 0 ? (
              <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-8 text-center">
                <p className="text-gray-400 text-sm">No published tools yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {devTools.map((tool) => (
                  <Link
                    key={tool.slug}
                    href={`/tools/${tool.slug}`}
                    className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 hover:border-emerald-500/40 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">
                        {tool.name}
                      </h3>
                      {tool.category && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-xs font-semibold shrink-0 ml-2">
                          {tool.category}
                        </span>
                      )}
                    </div>
                    {tool.description && (
                      <p className="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-2">
                        {tool.description.length > 120
                          ? `${tool.description.slice(0, 120)}...`
                          : tool.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-[#252836]">
                      <span className="inline-flex items-center rounded-full border border-[#2E3148] text-gray-400 px-2 py-0.5 text-xs font-mono">
                        v{tool.currentVersion}
                      </span>
                      <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View storefront &rarr;
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Embeddable Badge */}
          <section>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">README Badge</h2>
            <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5">
              <p className="text-sm text-gray-400 mb-3">
                Add this badge to your GitHub README to showcase your SettleGrid profile:
              </p>
              <CopyableCodeBlock code={badgeSnippet} title="Markdown" className="!my-0" />
            </div>
          </section>
        </div>
      </main>
    </Shell>
  )
}

// ─── Shared layout shell ────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">
              Log in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">
              Sign up
            </Link>
          </div>
        </nav>
      </header>
      {children}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">Showcase</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Documentation</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1A1D2E] rounded-xl border border-[#2E3148] p-5 text-center">
      <p className="text-2xl font-bold text-emerald-400">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  )
}

// ─── Tier icon ──────────────────────────────────────────────────────────────

function TierIcon({ tier }: { tier: ReputationTier }) {
  // Shield icon for all tiers
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      {tier === 'Platinum' ? (
        <path d="M12 1l3.09 6.26L22 8.27l-5 4.87 1.18 6.88L12 16.77l-6.18 3.25L7 13.14 2 8.27l6.91-1.01L12 1z" />
      ) : (
        <path fillRule="evenodd" d="M11.484 2.17a.75.75 0 0 1 1.032 0 11.209 11.209 0 0 0 7.877 3.08.75.75 0 0 1 .722.515 12.74 12.74 0 0 1 .635 3.985c0 5.942-4.064 10.933-9.563 12.348a.749.749 0 0 1-.374 0C6.314 20.683 2.25 15.692 2.25 9.75c0-1.39.223-2.73.635-3.985a.75.75 0 0 1 .722-.516 11.209 11.209 0 0 0 7.877-3.08Z" clipRule="evenodd" />
      )}
    </svg>
  )
}

