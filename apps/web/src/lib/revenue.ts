// ─── Revenue Tier Helper ──────────────────────────────────────────────────────
// Anonymized revenue tiers for public display. Shows tier ranges rather than
// exact amounts to preserve developer privacy while providing social proof.

export interface RevenueTier {
  label: string
  color: string       // Tailwind text color
  bgColor: string     // rgba background
  borderColor: string // rgba border
}

/**
 * Map a revenue amount in cents to an anonymized display tier.
 *
 * Tiers:
 *   0            -> "New"      (gray)
 *   1-9999       -> "< $100"   (gray)
 *   10000-99999  -> "$100+"    (amber-gold)
 *   100000-999999 -> "$1K+"    (amber-gold bright)
 *   1000000-9999999 -> "$10K+" (amber)
 *   10000000+    -> "$100K+"   (amber bold)
 */
export function getRevenueTier(cents: number): RevenueTier {
  if (cents >= 10_000_000) {
    return {
      label: '$100K+',
      color: '#F59E0B',
      bgColor: 'rgba(245,158,11,0.15)',
      borderColor: 'rgba(245,158,11,0.4)',
    }
  }
  if (cents >= 1_000_000) {
    return {
      label: '$10K+',
      color: '#FBBF24',
      bgColor: 'rgba(251,191,36,0.12)',
      borderColor: 'rgba(251,191,36,0.35)',
    }
  }
  if (cents >= 100_000) {
    return {
      label: '$1K+',
      color: '#F5C963',
      bgColor: 'rgba(245,201,99,0.12)',
      borderColor: 'rgba(245,201,99,0.35)',
    }
  }
  if (cents >= 10_000) {
    return {
      label: '$100+',
      color: '#E5A336',
      bgColor: 'rgba(229,163,54,0.1)',
      borderColor: 'rgba(229,163,54,0.3)',
    }
  }
  if (cents >= 1) {
    return {
      label: '< $100',
      color: '#9CA3AF',
      bgColor: 'rgba(156,163,175,0.1)',
      borderColor: 'rgba(156,163,175,0.25)',
    }
  }
  return {
    label: 'New',
    color: '#6B7280',
    bgColor: 'rgba(107,114,128,0.1)',
    borderColor: 'rgba(107,114,128,0.25)',
  }
}

/**
 * Leaderboard-style tier for the directory page (coarser buckets).
 * Used to rank developers by revenue bracket.
 */
export function getLeaderboardTier(cents: number): string {
  if (cents >= 10_000_000) return '$100K+'
  if (cents >= 5_000_000) return '$50K+'
  if (cents >= 1_000_000) return '$10K+'
  if (cents >= 500_000) return '$5K+'
  if (cents >= 100_000) return '$1K+'
  return ''
}

/**
 * Format a cent amount to a compact display string (e.g., 1234500 -> "$12.3K").
 * Only used for aggregate stats (not individual developer amounts).
 */
export function formatCentsCompact(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`
  if (dollars >= 1) return `$${Math.floor(dollars).toLocaleString()}`
  return '$0'
}
