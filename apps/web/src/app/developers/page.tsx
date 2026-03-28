import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { db } from '@/lib/db'
import { developers, tools, developerReputation } from '@/lib/db/schema'
import { eq, desc, sql, gt, and } from 'drizzle-orm'
import { getRevenueTier, getLeaderboardTier, formatCentsCompact } from '@/lib/revenue'

// ─── SEO Metadata ──────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Developer Directory | SettleGrid',
  description:
    'Discover top-earning developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation and revenue.',
  alternates: { canonical: 'https://settlegrid.ai/developers' },
  keywords: [
    'AI developers',
    'MCP tool builders',
    'SettleGrid developers',
    'AI agent developers',
    'developer directory',
    'top earning developers',
  ],
  openGraph: {
    title: 'Developer Directory | SettleGrid',
    description:
      'Discover top-earning developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation and revenue.',
    type: 'website',
    siteName: 'SettleGrid',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Developer Directory | SettleGrid',
    description:
      'Discover top-earning developers building monetized AI tools on SettleGrid. Browse public profiles sorted by reputation and revenue.',
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
  totalRevenueCents: number
}

interface LeaderboardEntry {
  name: string | null
  slug: string | null
  avatarUrl: string | null
  reputationScore: number | null
  activeToolCount: number
  totalRevenueCents: number
}

interface DirectoryStats {
  developerCount: number
  toolCount: number
  totalRevenueCents: number
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
      totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)`.as('total_revenue_cents'),
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
    totalRevenueCents: Number(r.totalRevenueCents) || 0,
  }))
}

async function getTopDevelopers(): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      name: developers.name,
      slug: developers.slug,
      avatarUrl: developers.avatarUrl,
      reputationScore: developerReputation.score,
      activeToolCount: sql<number>`count(case when ${tools.status} = 'active' then 1 end)`.as('active_tool_count'),
      totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)`.as('total_revenue_cents'),
    })
    .from(developers)
    .leftJoin(developerReputation, eq(developerReputation.developerId, developers.id))
    .innerJoin(tools, eq(tools.developerId, developers.id))
    .where(and(
      eq(developers.publicProfile, true),
    ))
    .groupBy(
      developers.id,
      developers.name,
      developers.slug,
      developers.avatarUrl,
      developerReputation.score,
    )
    .having(gt(sql`coalesce(sum(${tools.totalRevenueCents}), 0)`, 0))
    .orderBy(desc(sql`coalesce(sum(${tools.totalRevenueCents}), 0)`))
    .limit(10)

  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    avatarUrl: r.avatarUrl,
    reputationScore: r.reputationScore,
    activeToolCount: Number(r.activeToolCount) || 0,
    totalRevenueCents: Number(r.totalRevenueCents) || 0,
  }))
}

async function getDirectoryStats(): Promise<DirectoryStats> {
  const [result] = await db
    .select({
      developerCount: sql<number>`count(distinct ${developers.id})`.as('developer_count'),
      toolCount: sql<number>`count(distinct case when ${tools.status} = 'active' then ${tools.id} end)`.as('tool_count'),
      totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)`.as('total_revenue_cents'),
    })
    .from(developers)
    .leftJoin(tools, eq(tools.developerId, developers.id))
    .where(eq(developers.publicProfile, true))

  return {
    developerCount: Number(result?.developerCount) || 0,
    toolCount: Number(result?.toolCount) || 0,
    totalRevenueCents: Number(result?.totalRevenueCents) || 0,
  }
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
  let topDevs: LeaderboardEntry[] = []
  let stats: DirectoryStats = { developerCount: 0, toolCount: 0, totalRevenueCents: 0 }

  try {
    ;[devs, topDevs, stats] = await Promise.all([
      getPublicDevelopers(),
      getTopDevelopers(),
      getDirectoryStats(),
    ])
  } catch {
    // DB unavailable — show empty state gracefully
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822] sticky top-0 z-50 backdrop-blur-lg">
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
              className="hidden sm:inline text-sm font-medium text-amber-400 transition-colors"
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
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4">
              Developer Directory
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Find builders on Settle<span className="text-amber-400">Grid</span>
            </p>
          </div>

          {/* ── Stats Bar ──────────────────────────────────────────── */}
          {(stats.developerCount > 0 || stats.toolCount > 0) && (
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 mb-12">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                <span className="text-sm font-medium text-gray-300">
                  <span className="text-amber-400 font-bold">{stats.developerCount}</span> {stats.developerCount === 1 ? 'developer' : 'developers'}
                </span>
              </div>
              <div className="w-px h-4 bg-[#2A2D3E] hidden sm:block" />
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
                <span className="text-sm font-medium text-gray-300">
                  <span className="text-amber-400 font-bold">{stats.toolCount}</span> {stats.toolCount === 1 ? 'tool' : 'tools'} published
                </span>
              </div>
              {stats.totalRevenueCents > 0 && (
                <>
                  <div className="w-px h-4 bg-[#2A2D3E] hidden sm:block" />
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">
                      <span className="text-amber-400 font-bold">{formatCentsCompact(stats.totalRevenueCents)}</span> total earned
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Top Developers Leaderboard ─────────────────────────── */}
          {topDevs.length > 0 && (
            <section className="mb-14">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10">
                  <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-100">Top Developers</h2>
                <span className="text-xs text-gray-500 font-medium ml-1">by revenue</span>
              </div>
              <div className="rounded-xl border border-[#2A2D3E] bg-[#161822] overflow-hidden">
                <div className="divide-y divide-[#252836]">
                  {topDevs.map((dev, i) => {
                    const score = dev.reputationScore ?? 0
                    const tierInfo = getReputationTier(score)
                    const revTier = getRevenueTier(dev.totalRevenueCents)
                    const lbTier = getLeaderboardTier(dev.totalRevenueCents)
                    const initials = getInitials(dev.name)
                    const href = dev.slug ? `/dev/${dev.slug}` : '#'
                    const rank = i + 1

                    return (
                      <Link
                        key={dev.slug ?? dev.name ?? i}
                        href={href}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-[#252836] transition-colors group"
                      >
                        {/* Rank */}
                        <span className={`text-sm font-bold w-6 text-center shrink-0 ${rank <= 3 ? 'text-amber-400' : 'text-gray-500'}`}>
                          {rank}
                        </span>

                        {/* Avatar */}
                        {dev.avatarUrl ? (
                          <Image
                            src={dev.avatarUrl}
                            alt={dev.name ?? 'Developer'}
                            width={36}
                            height={36}
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-[#2A2D3E] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-amber-500/10 ring-1 ring-[#2A2D3E] flex items-center justify-center text-amber-400 font-semibold text-xs shrink-0">
                            {initials}
                          </div>
                        )}

                        {/* Name + tier */}
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold text-gray-100 group-hover:text-amber-400 transition-colors truncate block">
                            {dev.name ?? 'Anonymous'}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border"
                              style={{
                                color: tierInfo.color,
                                backgroundColor: tierInfo.bgColor,
                                borderColor: tierInfo.borderColor,
                              }}
                            >
                              {tierInfo.tier}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {dev.activeToolCount} {dev.activeToolCount === 1 ? 'tool' : 'tools'}
                            </span>
                          </div>
                        </div>

                        {/* Revenue tier badge */}
                        {lbTier && (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0"
                            style={{
                              color: revTier.color,
                              backgroundColor: revTier.bgColor,
                              borderColor: revTier.borderColor,
                            }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            {lbTier}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── Developer Grid ─────────────────────────────────────── */}
          {devs.length > 0 ? (
            <>
              {topDevs.length > 0 && (
                <h2 className="text-xl font-bold text-gray-100 mb-6">All Developers</h2>
              )}
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
                  const revTier = dev.totalRevenueCents > 0 ? getRevenueTier(dev.totalRevenueCents) : null

                  return (
                    <Link
                      key={dev.slug ?? dev.name}
                      href={href}
                      className="group rounded-xl border border-[#2A2D3E] bg-[#161822] p-6 hover:border-amber-500/40 transition-colors"
                    >
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-4 mb-4">
                        {dev.avatarUrl ? (
                          <Image
                            src={dev.avatarUrl}
                            alt={dev.name ?? 'Developer'}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-[#2A2D3E] group-hover:ring-amber-500/40 transition-colors"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-amber-500/10 ring-2 ring-[#2A2D3E] group-hover:ring-amber-500/40 transition-colors flex items-center justify-center text-amber-400 font-semibold text-sm">
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="text-base font-semibold text-gray-100 truncate group-hover:text-amber-400 transition-colors">
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

                      {/* Tier Badge + Revenue Badge + Tool Count */}
                      <div className="flex items-center gap-2 flex-wrap">
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
                        {revTier && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border"
                            style={{
                              color: revTier.color,
                              backgroundColor: revTier.bgColor,
                              borderColor: revTier.borderColor,
                            }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            {revTier.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 ml-auto">
                          {dev.activeToolCount} {dev.activeToolCount === 1 ? 'tool' : 'tools'}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </>
          ) : (
            /* ── Empty state ─────────────────────────────────────── */
            <div className="rounded-xl border border-[#2A2D3E] bg-[#161822] p-12 text-center mb-20">
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
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
          <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
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
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Go to Settings
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6 mt-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
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
