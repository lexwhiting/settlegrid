import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireDeveloper } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'

const statusSchema = z.object({
  status: z.enum(['active', 'draft'], {
    errorMap: () => ({ message: "Status must be 'active' or 'draft'" }),
  }),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let auth
    try {
      auth = await requireDeveloper(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    const body = await parseBody(request, statusSchema)

    // Verify tool belongs to developer and is not deleted
    const [existing] = await db
      .select({ id: tools.id, status: tools.status })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.developerId, auth.id)))
      .limit(1)

    if (!existing) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (existing.status === 'deleted') {
      return errorResponse('Cannot change status of a deleted tool.', 400, 'TOOL_DELETED')
    }

    const [tool] = await db
      .update(tools)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning({
        id: tools.id,
        name: tools.name,
        slug: tools.slug,
        status: tools.status,
        updatedAt: tools.updatedAt,
      })

    return successResponse({ tool })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
