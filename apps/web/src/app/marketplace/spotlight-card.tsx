import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { getRedis } from '@/lib/redis'
import { getCategoryBySlug } from '@/lib/categories'

interface SpotlightTool {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  toolType: string
  totalInvocations: number
}

/**
 * Server component: Tool of the Week spotlight card.
 *
 * Reads from Redis (set by weekly-report cron) or falls back to DB.
 * Returns null if no tool is available (graceful degradation).
 */
export async function SpotlightCard() {
  let spotlight: SpotlightTool | null = null

  try {
    // Try Redis cache first
    const redis = getRedis()
    const cached = await redis.get<string>('spotlight:current')
    if (cached) {
      spotlight = typeof cached === 'string' ? JSON.parse(cached) : cached
    }
  } catch {
    // Redis unavailable, fall through
  }

  // Fallback to DB
  if (!spotlight) {
    try {
      const [topTool] = await db
        .select({
          id: tools.id,
          name: tools.name,
          slug: tools.slug,
          description: tools.description,
          category: tools.category,
          toolType: tools.toolType,
          totalInvocations: tools.totalInvocations,
        })
        .from(tools)
        .where(inArray(tools.status, ['active']))
        .orderBy(desc(tools.totalInvocations))
        .limit(1)

      if (topTool) {
        spotlight = topTool
      }
    } catch {
      // DB query failed, return nothing
    }
  }

  if (!spotlight) return null

  const categoryDef = spotlight.category ? getCategoryBySlug(spotlight.category) : null
  const categoryLabel = categoryDef?.name ?? spotlight.category ?? 'Tool'

  return (
    <div className="mb-10">
      <Link
        href={`/tools/${spotlight.slug}`}
        className="block rounded-xl border border-amber-500/30 bg-gradient-to-r from-[#161822] to-[#1A1F2E] p-6 hover:border-amber-500/50 transition-colors group"
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
            Tool of the Week
          </span>
          <span className="text-xs text-gray-500">{categoryLabel}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-100 group-hover:text-amber-400 transition-colors mb-1">
          {spotlight.name}
        </h3>
        {spotlight.description && (
          <p className="text-sm text-gray-400 line-clamp-2">
            {spotlight.description.length > 200
              ? `${spotlight.description.slice(0, 200)}...`
              : spotlight.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>
            {spotlight.totalInvocations > 0
              ? `${spotlight.totalInvocations.toLocaleString()} invocations`
              : 'New this week'}
          </span>
          <span className="text-amber-500 font-medium group-hover:underline">
            View tool &rarr;
          </span>
        </div>
      </Link>
    </div>
  )
}
