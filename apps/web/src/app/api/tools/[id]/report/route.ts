import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

export const maxDuration = 60

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ADMIN_EMAILS = ['lexwhiting365@gmail.com']

const reportSchema = z.object({
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must be at most 500 characters'),
})

/** POST /api/tools/[id]/report — consumer reports a tool for review */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(apiLimiter, `tool-report:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED')
    }

    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return errorResponse('Invalid tool ID format.', 400, 'INVALID_ID')
    }

    const body = await parseBody(request, reportSchema)

    // Verify tool exists and is active
    const [tool] = await db
      .select({ id: tools.id, name: tools.name, slug: tools.slug })
      .from(tools)
      .where(and(eq(tools.id, id), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    // Update the tool with a report timestamp
    await db
      .update(tools)
      .set({ reportedAt: new Date(), updatedAt: new Date() })
      .where(eq(tools.id, id))

    // Fire-and-forget: send admin notification email
    const escapedReason = escapeHtml(body.reason)
    const escapedToolName = escapeHtml(tool.name)
    const escapedEmail = escapeHtml(auth.email)

    for (const adminEmail of ADMIN_EMAILS) {
      sendEmail({
        to: adminEmail,
        subject: `[SettleGrid] Tool Reported: ${tool.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1A1F3A;">Tool Report</h2>
            <p><strong>Tool:</strong> ${escapedToolName} (<code>${tool.slug}</code>)</p>
            <p><strong>Tool ID:</strong> <code>${tool.id}</code></p>
            <p><strong>Reported by:</strong> ${escapedEmail}</p>
            <p><strong>Reason:</strong></p>
            <blockquote style="border-left: 3px solid #e5e7eb; padding-left: 12px; color: #4b5563;">
              ${escapedReason}
            </blockquote>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
              Review this tool in the admin dashboard.
            </p>
          </div>
        `,
      }).catch((err) => {
        logger.error('tool.report_email_failed', { toolId: id, adminEmail }, err)
      })
    }

    logger.info('tool.reported', {
      toolId: id,
      toolName: tool.name,
      reporterEmail: auth.email,
      ip,
    })

    return successResponse({ message: 'Report submitted. Our team will review this tool.' })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

/** Escapes HTML entities to prevent XSS in emails. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
