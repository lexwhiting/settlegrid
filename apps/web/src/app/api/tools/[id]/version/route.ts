import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolChangelogs } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const createVersionSchema = z.object({
  changeType: z.enum(['major', 'minor', 'patch']),
  summary: z.string().min(1).max(500),
  details: z.record(z.unknown()).optional(),
})

/**
 * Parses a semver string and increments the appropriate segment.
 * Returns the new version string.
 */
function bumpVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
  const parts = currentVersion.split('.').map(Number)
  const major = parts[0] ?? 1
  const minor = parts[1] ?? 0
  const patch = parts[2] ?? 0

  switch (changeType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
  }
}

/** POST /api/tools/[id]/version — bump tool version and create changelog entry */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-version:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID')
    }

    let auth
    try { auth = await requireDeveloper() } catch (err) {
      return errorResponse(err instanceof Error ? err.message : 'Authentication required', 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, createVersionSchema)

    // Verify tool belongs to the authenticated developer
    const [tool] = await db
      .select({ id: tools.id, currentVersion: tools.currentVersion })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    const newVersion = bumpVersion(tool.currentVersion, body.changeType)

    // Insert changelog entry
    const [changelog] = await db
      .insert(toolChangelogs)
      .values({
        toolId: tool.id,
        version: newVersion,
        changeType: body.changeType,
        summary: body.summary,
        details: body.details ?? null,
      })
      .returning({
        id: toolChangelogs.id,
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        details: toolChangelogs.details,
        createdAt: toolChangelogs.createdAt,
      })

    // Update tool's current version
    await db
      .update(tools)
      .set({ currentVersion: newVersion, updatedAt: new Date() })
      .where(eq(tools.id, tool.id))

    return successResponse({ version: newVersion, changelog }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
