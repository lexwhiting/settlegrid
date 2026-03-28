import { NextRequest } from 'next/server'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import {
  getDeveloperAchievements,
  checkAndUnlockAchievements,
  BADGES,
} from '@/lib/achievements'

export const maxDuration = 60

/**
 * GET /api/developer/achievements
 *
 * Returns the developer's achievement badges with progress info.
 * Also triggers a non-blocking check for any newly qualified achievements.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `dev-achievements:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : 'Authentication required',
        401,
        'UNAUTHORIZED'
      )
    }

    // Check for newly qualified achievements (non-blocking side effect)
    const newlyUnlocked = await checkAndUnlockAchievements(auth.id)

    // Fetch full achievement state with progress
    const achievementList = await getDeveloperAchievements(auth.id)

    // Build response with newly unlocked badges highlighted
    const newBadges = newlyUnlocked
      .filter((key) => key in BADGES)
      .map((key) => BADGES[key])

    return successResponse({
      achievements: achievementList,
      newlyUnlocked: newBadges,
      totalEarned: achievementList.filter((a) => a.unlocked).length,
      totalBadges: achievementList.length,
    })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
