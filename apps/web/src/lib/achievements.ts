import { eq, sql, and, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  achievements,
  developers,
  tools,
  signupInvites,
  toolReviews,
} from '@/lib/db/schema'

// ─── Badge Definitions ─────────────────────────────────────────────────────────

export interface BadgeDefinition {
  key: string
  name: string
  icon: string
  description: string
  /** Optional: a threshold for progress display (e.g. 10 for 'ten_tools') */
  threshold?: number
  /** Optional: a function label for progress tracking (e.g. 'tools published') */
  progressLabel?: string
}

export const BADGES: Record<string, BadgeDefinition> = {
  first_tool: {
    key: 'first_tool',
    name: 'First Tool Published',
    icon: '\uD83C\uDFAF',
    description: 'Published your first tool on SettleGrid',
  },
  first_invocation: {
    key: 'first_invocation',
    name: 'First Call',
    icon: '\uD83D\uDCDE',
    description: 'Your tool received its first invocation',
  },
  first_dollar: {
    key: 'first_dollar',
    name: 'First Dollar',
    icon: '\uD83D\uDCB0',
    description: 'Earned your first dollar from tool revenue',
  },
  ten_tools: {
    key: 'ten_tools',
    name: 'Tool Master',
    icon: '\uD83C\uDFD7\uFE0F',
    description: 'Published 10 tools on SettleGrid',
    threshold: 10,
    progressLabel: 'tools published',
  },
  hundred_invocations: {
    key: 'hundred_invocations',
    name: 'Getting Traction',
    icon: '\uD83D\uDCC8',
    description: 'Your tools received 100+ invocations',
    threshold: 100,
    progressLabel: 'invocations',
  },
  thousand_invocations: {
    key: 'thousand_invocations',
    name: 'Going Viral',
    icon: '\uD83D\uDE80',
    description: 'Your tools received 1,000+ invocations',
    threshold: 1000,
    progressLabel: 'invocations',
  },
  hundred_dollars: {
    key: 'hundred_dollars',
    name: '$100 Club',
    icon: '\uD83D\uDC8E',
    description: 'Earned $100+ from your tools',
    threshold: 10000,
    progressLabel: 'cents earned',
  },
  thousand_dollars: {
    key: 'thousand_dollars',
    name: '$1K Milestone',
    icon: '\uD83C\uDFC6',
    description: 'Earned $1,000+ from your tools',
    threshold: 100000,
    progressLabel: 'cents earned',
  },
  referral_first: {
    key: 'referral_first',
    name: 'Community Builder',
    icon: '\uD83E\uDD1D',
    description: 'Invited your first developer',
  },
  five_star_review: {
    key: 'five_star_review',
    name: 'Five Stars',
    icon: '\u2B50',
    description: 'Received a 5-star review',
  },
  stripe_connected: {
    key: 'stripe_connected',
    name: 'Money Ready',
    icon: '\uD83C\uDFE6',
    description: 'Connected Stripe for payouts',
  },
  badge_added: {
    key: 'badge_added',
    name: 'Badge Bearer',
    icon: '\uD83D\uDEE1\uFE0F',
    description: 'Added a SettleGrid badge to your README',
  },
}

export const BADGE_KEYS = Object.keys(BADGES) as (keyof typeof BADGES)[]

// ─── Achievement Types ──────────────────────────────────────────────────────────

export interface Achievement {
  id: string
  badgeKey: string
  badge: BadgeDefinition
  unlockedAt: Date
}

export interface AchievementWithProgress {
  badgeKey: string
  badge: BadgeDefinition
  unlocked: boolean
  unlockedAt: Date | null
  /** Current progress value (e.g., 3 tools out of 10) */
  progress?: number
  /** Target value for completion (e.g., 10 for ten_tools) */
  target?: number
}

// ─── Developer Stats (for achievement checks) ──────────────────────────────────

interface DeveloperAchievementStats {
  toolCount: number
  totalInvocations: number
  totalRevenueCents: number
  referralCount: number
  hasFiveStarReview: boolean
  stripeConnected: boolean
}

async function getDeveloperStats(developerId: string): Promise<DeveloperAchievementStats> {
  // Query tool count and aggregate stats
  const toolStats = await db
    .select({
      toolCount: sql<number>`count(*)::int`,
      totalInvocations: sql<number>`coalesce(sum(${tools.totalInvocations}), 0)::int`,
      totalRevenueCents: sql<number>`coalesce(sum(${tools.totalRevenueCents}), 0)::int`,
    })
    .from(tools)
    .where(eq(tools.developerId, developerId))

  // Query referral count
  const referralStats = await db
    .select({ referralCount: count() })
    .from(signupInvites)
    .where(eq(signupInvites.inviterId, developerId))

  // Query five-star reviews on any tool owned by this developer
  const fiveStarStats = await db
    .select({ reviewCount: count() })
    .from(toolReviews)
    .innerJoin(tools, eq(toolReviews.toolId, tools.id))
    .where(and(eq(tools.developerId, developerId), eq(toolReviews.rating, 5)))

  // Query Stripe connect status
  const [dev] = await db
    .select({ stripeConnectStatus: developers.stripeConnectStatus })
    .from(developers)
    .where(eq(developers.id, developerId))
    .limit(1)

  return {
    toolCount: toolStats[0]?.toolCount ?? 0,
    totalInvocations: toolStats[0]?.totalInvocations ?? 0,
    totalRevenueCents: toolStats[0]?.totalRevenueCents ?? 0,
    referralCount: referralStats[0]?.referralCount ?? 0,
    hasFiveStarReview: (fiveStarStats[0]?.reviewCount ?? 0) > 0,
    stripeConnected: dev?.stripeConnectStatus === 'active',
  }
}

// ─── Check & Unlock Achievements ────────────────────────────────────────────────

/**
 * Checks which achievements the developer qualifies for and unlocks any new ones.
 * Returns the list of newly unlocked badge keys.
 *
 * This function is designed to be called non-blocking (fire-and-forget)
 * after relevant events (tool publish, invocation, payout, etc.).
 */
export async function checkAndUnlockAchievements(developerId: string): Promise<string[]> {
  // Fetch current achievements in parallel with stats
  const [existingAchievements, stats] = await Promise.all([
    db
      .select({ badgeKey: achievements.badgeKey })
      .from(achievements)
      .where(eq(achievements.developerId, developerId)),
    getDeveloperStats(developerId),
  ])

  const alreadyUnlocked = new Set(existingAchievements.map((a) => a.badgeKey))

  // Determine which badges should be unlocked based on current stats
  const qualifiedBadges: string[] = []

  if (stats.toolCount >= 1 && !alreadyUnlocked.has('first_tool')) {
    qualifiedBadges.push('first_tool')
  }
  if (stats.totalInvocations >= 1 && !alreadyUnlocked.has('first_invocation')) {
    qualifiedBadges.push('first_invocation')
  }
  if (stats.totalRevenueCents >= 100 && !alreadyUnlocked.has('first_dollar')) {
    qualifiedBadges.push('first_dollar')
  }
  if (stats.toolCount >= 10 && !alreadyUnlocked.has('ten_tools')) {
    qualifiedBadges.push('ten_tools')
  }
  if (stats.totalInvocations >= 100 && !alreadyUnlocked.has('hundred_invocations')) {
    qualifiedBadges.push('hundred_invocations')
  }
  if (stats.totalInvocations >= 1000 && !alreadyUnlocked.has('thousand_invocations')) {
    qualifiedBadges.push('thousand_invocations')
  }
  if (stats.totalRevenueCents >= 10000 && !alreadyUnlocked.has('hundred_dollars')) {
    qualifiedBadges.push('hundred_dollars')
  }
  if (stats.totalRevenueCents >= 100000 && !alreadyUnlocked.has('thousand_dollars')) {
    qualifiedBadges.push('thousand_dollars')
  }
  if (stats.referralCount >= 1 && !alreadyUnlocked.has('referral_first')) {
    qualifiedBadges.push('referral_first')
  }
  if (stats.hasFiveStarReview && !alreadyUnlocked.has('five_star_review')) {
    qualifiedBadges.push('five_star_review')
  }
  if (stats.stripeConnected && !alreadyUnlocked.has('stripe_connected')) {
    qualifiedBadges.push('stripe_connected')
  }
  // 'badge_added' is triggered externally via the API (not auto-detected from stats)

  if (qualifiedBadges.length === 0) {
    return []
  }

  // Insert all newly qualified badges (ignore conflicts for idempotency)
  const now = new Date()
  await db
    .insert(achievements)
    .values(
      qualifiedBadges.map((badgeKey) => ({
        developerId,
        badgeKey,
        unlockedAt: now,
      }))
    )
    .onConflictDoNothing({ target: [achievements.developerId, achievements.badgeKey] })

  return qualifiedBadges
}

// ─── Get Developer Achievements ─────────────────────────────────────────────────

/**
 * Returns all achievements for a developer, including both earned and locked badges
 * with progress information.
 */
export async function getDeveloperAchievements(
  developerId: string
): Promise<AchievementWithProgress[]> {
  const [earned, stats] = await Promise.all([
    db
      .select({
        id: achievements.id,
        badgeKey: achievements.badgeKey,
        unlockedAt: achievements.unlockedAt,
      })
      .from(achievements)
      .where(eq(achievements.developerId, developerId)),
    getDeveloperStats(developerId),
  ])

  const earnedMap = new Map(earned.map((a) => [a.badgeKey, a]))

  return BADGE_KEYS.map((key) => {
    const badge = BADGES[key]
    const earnedRecord = earnedMap.get(key)
    const unlocked = !!earnedRecord

    // Calculate progress for badges with thresholds
    let progress: number | undefined
    let target: number | undefined

    switch (key) {
      case 'first_tool':
        progress = Math.min(stats.toolCount, 1)
        target = 1
        break
      case 'first_invocation':
        progress = Math.min(stats.totalInvocations, 1)
        target = 1
        break
      case 'first_dollar':
        progress = Math.min(stats.totalRevenueCents, 100)
        target = 100
        break
      case 'ten_tools':
        progress = Math.min(stats.toolCount, 10)
        target = 10
        break
      case 'hundred_invocations':
        progress = Math.min(stats.totalInvocations, 100)
        target = 100
        break
      case 'thousand_invocations':
        progress = Math.min(stats.totalInvocations, 1000)
        target = 1000
        break
      case 'hundred_dollars':
        progress = Math.min(stats.totalRevenueCents, 10000)
        target = 10000
        break
      case 'thousand_dollars':
        progress = Math.min(stats.totalRevenueCents, 100000)
        target = 100000
        break
      case 'referral_first':
        progress = Math.min(stats.referralCount, 1)
        target = 1
        break
      case 'five_star_review':
        progress = stats.hasFiveStarReview ? 1 : 0
        target = 1
        break
      case 'stripe_connected':
        progress = stats.stripeConnected ? 1 : 0
        target = 1
        break
      case 'badge_added':
        progress = unlocked ? 1 : 0
        target = 1
        break
    }

    return {
      badgeKey: key,
      badge,
      unlocked,
      unlockedAt: earnedRecord?.unlockedAt ?? null,
      progress,
      target,
    }
  })
}

/**
 * Manually unlock a specific achievement for a developer.
 * Used for achievements that cannot be auto-detected (e.g. badge_added).
 * Returns true if the badge was newly unlocked, false if already earned.
 */
export async function unlockAchievement(
  developerId: string,
  badgeKey: string
): Promise<boolean> {
  if (!(badgeKey in BADGES)) {
    return false
  }

  const result = await db
    .insert(achievements)
    .values({
      developerId,
      badgeKey,
      unlockedAt: new Date(),
    })
    .onConflictDoNothing({ target: [achievements.developerId, achievements.badgeKey] })

  // If rowCount is available and > 0, it was newly inserted
  return (result as unknown as { rowCount?: number }).rowCount !== 0
}
