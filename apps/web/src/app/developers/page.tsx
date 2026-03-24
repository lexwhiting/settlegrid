import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { db } from '@/lib/db'
import { developers, tools, developerReputation } from '@/lib/db/schema'
import { eq, desc, sql, and } from 'drizzle-orm'

// ─── SEO Metadata ──────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Developer Directory | SettleGrid',
  description:
    'Discover developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation score.',
  alternates: { canonical: 'https://settlegrid.ai/developers' },
  keywords: [
    'AI developers',
    'MCP tool builders',
    'SettleGrid developers',
    'AI agent developers',
    'developer directory',
  ],
  openGraph: {
    title: 'Developer Directory | SettleGrid',
    description:
      'Discover developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation score.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Developer Directory | SettleGrid',
    description:
      'Discover developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation score.',
  },
}

// ─── Types ─────────────────────────────────────────────────────────────────

type ReputationTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

interface TierInfo {
  tier: ReputationTier
  color: string
  bgColor: string
  borderColor: string
}

function getReputationTier(score: number): TierInfo {
  if (score >= 80)
    return { tier: 'Platinum', color: '#A78BFA', bgColor: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.3)' }
  if (score >= 60)
    return { tier: 'Gold', color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }
  if (score >= 40)
    return { tier: 'Silver', color: '#9CA3AF', bgColor: 'rgba(156,163,175,0.1)', borderColor: 'rgba(156,163,175,0.3)' }
  return { tier: 'Bronze', color: '#CD7F32', bgColor: 'rgba(205,127,50,0.1)', borderColor: 'rgba(205,127,50,0.3)' }
}

interface DeveloperCard {
  name: string | null
  slug: string | null
  bio: string | null
  avatarUrl: string | null
  reputationScore: number | null
  activeToolCount: number
}

// ─── Data fetching ─────────────────────────────────────────────────────────

async function getPublicDevelopers(): Promise<DeveloperCard[]> {
  const rows = await db
    .select({
      name: developers.name,
      slug: developers.slug,
      bio: developers.publicBio,
      avatarUrl: developers.avatarUrl,
      reputationScore: developerReputation.score,
      activeToolCount: sql<number>`count(case when ${tools.status} = 'active' then 1 end)`.as('active_tool_count'),
    })
    .from(developers)
    .leftJoin(developerReputation, eq(developerReputation.developerId, developers.id))
    .leftJoin(tools, eq(tools.developerId, developers.id))
    .where(eq(developers.publicProfile, true))
    .groupBy(
      developers.id,
      developers.name,
      developers.slug,
      developers.publicBio,
      developers.avatarUrl,
      developerReputation.score,
    )
    .orderBy(desc(developerReputation.score))

  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    bio: r.bio,
    avatarUrl: r.avatarUrl,
    reputationScore: r.reputationScore,
    activeToolCount: Number(r.activeToolCount) || 0,
  }))
}

// ─── Helper: initials from name ────────────────────────────────────────────

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name[0].toUpperCase()
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function DeveloperDirectoryPage() {
  let devs: DeveloperCard[] = []

  try {
    devs = await getPublicDevelopers()
  } catch {
    // DB unavailable — show empty state gracefully
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#1A1D2E] sticky top-0 z-50 backdrop-blur-lg">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/tools"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Showcase
            </Link>
            <Link
              href="/servers"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Templates
            </Link>
            <Link
              href="/developers"
              className="hidden sm:inline text-sm font-medium text-emerald-400 transition-colors"
              aria-current="page"
            >
              Developers
            </Link>
            <Link
              href="/docs"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/learn"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
            >
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-16">
        <div className="max-w-6xl mx-auto">
          {/* ── Hero ───────────────────────────────────────────────── */}
          <div className="text-center mb-14">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Developer Directory
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Find builders on Settle<span className="text-emerald-400">Grid</span>
            </p>
          </div>

          {/* ── Developer Grid ─────────────────────────────────────── */}
          {devs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
              {devs.map((dev) => {
                const score = dev.reputationScore ?? 0
                const tierInfo = getReputationTier(score)
                const initials = getInitials(dev.name)
                const bio = dev.bio
                  ? dev.bio.length > 120
                    ? dev.bio.slice(0, 120) + '...'
                    : dev.bio
                  : null
                const href = dev.slug ? `/dev/${dev.slug}` : '#'

                return (
                  <Link
                    key={dev.slug ?? dev.name}
                    href={href}
                    className="group rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-6 hover:border-emerald-500/40 transition-colors"
                  >
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4 mb-4">
                      {dev.avatarUrl ? (
                        <img
                          src={dev.avatarUrl}
                          alt={dev.name ?? 'Developer'}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2E3148] group-hover:ring-emerald-500/40 transition-colors"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 ring-2 ring-[#2E3148] group-hover:ring-emerald-500/40 transition-colors flex items-center justify-center text-emerald-400 font-semibold text-sm">
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-gray-100 truncate group-hover:text-emerald-400 transition-colors">
                          {dev.name ?? 'Anonymous'}
                        </h2>
                        {dev.slug && (
                          <p className="text-xs text-gray-500 truncate">@{dev.slug}</p>
                        )}
                      </div>
                    </div>

                    {/* Bio */}
                    {bio && (
                      <p className="text-sm text-gray-400 mb-4 line-clamp-3">
                        {bio}
                      </p>
                    )}

                    {/* Tier Badge + Tool Count */}
                    <div className="flex items-center justify-between">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                        style={{
                          color: tierInfo.color,
                          backgroundColor: tierInfo.bgColor,
                          borderColor: tierInfo.borderColor,
                        }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {tierInfo.tier}
                      </span>
                      <span className="text-xs text-gray-500">
                        {dev.activeToolCount} {dev.activeToolCount === 1 ? 'tool' : 'tools'}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            /* ── Empty state ─────────────────────────────────────── */
            <div className="rounded-xl border border-[#2E3148] bg-[#1A1D2E] p-12 text-center mb-20">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-100 mb-2">No public profiles yet</h2>
              <p className="text-sm text-gray-400 mb-6 max-w-md mx-auto">
                Be the first to make your profile public and appear in the directory.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
              >
                Create Your Profile
              </Link>
            </div>
          )}

          {/* ── Bottom CTA ─────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#2E3148] bg-gradient-to-br from-[#1A1D2E] to-[#0F1117] p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
              Want to be listed?
            </h2>
            <p className="text-gray-400 mb-8 max-w-lg mx-auto">
              Enable your public profile in Settings and appear in the Developer Directory.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building -- Free
              </Link>
              <Link
                href="/dashboard/settings"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2E3148] hover:border-gray-500 transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#2E3148] px-6 py-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={24} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/tools" className="hover:text-gray-100 transition-colors">
              Showcase
            </Link>
            <Link href="/servers" className="hover:text-gray-100 transition-colors">
              Templates
            </Link>
            <Link href="/developers" className="hover:text-gray-100 transition-colors">
              Developers
            </Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/faq" className="hover:text-gray-100 transition-colors">
              FAQ
            </Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">
              Terms
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SettleGrid. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
