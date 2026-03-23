import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, toolChangelogs } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { successResponse, errorResponse, internalErrorResponse, parseBody } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { writeAuditLog } from '@/lib/audit'

export const maxDuration = 30

const SEMVER_RE = /^\d+\.\d+\.\d+$/

const createChangelogSchema = z.object({
  version: z.string().min(1).max(20).regex(SEMVER_RE, 'Version must be in semver format (e.g. 1.2.0)'),
  changeType: z.enum(['feature', 'fix', 'breaking', 'deprecation'], {
    errorMap: () => ({ message: "changeType must be 'feature', 'fix', 'breaking', or 'deprecation'" }),
  }),
  summary: z.string().min(1).max(500),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** GET /api/tools/[id]/changelog — public changelog for a tool */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-changelog:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID.', 400, 'INVALID_ID')
    }

    const changelogs = await db
      .select({
        id: toolChangelogs.id,
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        details: toolChangelogs.details,
        createdAt: toolChangelogs.createdAt,
      })
      .from(toolChangelogs)
      .where(eq(toolChangelogs.toolId, id))
      .orderBy(desc(toolChangelogs.createdAt))
      .limit(50)

    return successResponse({ changelogs })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/**
 * Compare two semver strings. Returns true if `a` is newer than `b`.
 */
function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false
  }
  return false
}

/** POST /api/tools/[id]/changelog — developer: create a changelog entry */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-changelog:${ip}`)
    if (!rl.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_RE.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }

    const body = await parseBody(request, createChangelogSchema)

    // Verify the developer owns this tool
    const [tool] = await db
      .select({ id: tools.id, currentVersion: tools.currentVersion })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Insert changelog entry
    const [entry] = await db
      .insert(toolChangelogs)
      .values({
        toolId: id,
        version: body.version,
        changeType: body.changeType,
        summary: body.summary,
      })
      .returning({
        id: toolChangelogs.id,
        version: toolChangelogs.version,
        changeType: toolChangelogs.changeType,
        summary: toolChangelogs.summary,
        createdAt: toolChangelogs.createdAt,
      })

    // Optionally update the tool's currentVersion if the new version is newer
    if (isNewerVersion(body.version, tool.currentVersion)) {
      await db
        .update(tools)
        .set({ currentVersion: body.version, updatedAt: new Date() })
        .where(eq(tools.id, id))
    }

    writeAuditLog({
      developerId: auth.id,
      action: 'tool.changelog_created',
      resourceType: 'tool',
      resourceId: id,
      details: { version: body.version, changeType: body.changeType },
      ipAddress: ip,
    }).catch(() => {})

    return successResponse({ changelog: entry }, 201)
  } catch (error) {
    return internalErrorResponse(error)
  }
}
