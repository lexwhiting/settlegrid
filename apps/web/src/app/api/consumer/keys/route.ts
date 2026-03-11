import { NextRequest } from 'next/server'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { apiKeys, tools } from '@/lib/db/schema'
import { requireConsumer } from '@/lib/middleware/auth'
import { parseBody, successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { generateApiKey } from '@/lib/crypto'

const createKeySchema = z.object({
  toolId: z.string().uuid('Invalid tool ID'),
})

export async function GET(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        toolId: apiKeys.toolId,
        status: apiKeys.status,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.consumerId, auth.id))
      .limit(500)

    return successResponse({ keys })
  } catch (error) {
    return internalErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    let auth
    try {
      auth = await requireConsumer(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication required'
      return errorResponse(message, 401, 'UNAUTHORIZED')
    }

    const body = await parseBody(request, createKeySchema)

    // Verify tool exists and is active
    const [tool] = await db
      .select({ id: tools.id, status: tools.status })
      .from(tools)
      .where(eq(tools.id, body.toolId))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    if (tool.status !== 'active') {
      return errorResponse('Tool is not active.', 400, 'TOOL_NOT_ACTIVE')
    }

    // Check if consumer already has an active key for this tool
    const [existingKey] = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.consumerId, auth.id),
          eq(apiKeys.toolId, body.toolId),
          eq(apiKeys.status, 'active')
        )
      )
      .limit(1)

    if (existingKey) {
      return errorResponse(
        'You already have an active API key for this tool. Revoke it first to create a new one.',
        409,
        'KEY_EXISTS'
      )
    }

    const { key, hash, prefix } = generateApiKey()

    const [created] = await db
      .insert(apiKeys)
      .values({
        consumerId: auth.id,
        toolId: body.toolId,
        keyHash: hash,
        keyPrefix: prefix,
      })
      .returning({
        id: apiKeys.id,
        keyPrefix: apiKeys.keyPrefix,
        toolId: apiKeys.toolId,
        status: apiKeys.status,
        createdAt: apiKeys.createdAt,
      })

    return successResponse(
      {
        key, // Full key returned ONCE — never stored in plaintext
        apiKey: {
          id: created.id,
          keyPrefix: created.keyPrefix,
          toolId: created.toolId,
          status: created.status,
          createdAt: created.createdAt,
        },
      },
      201
    )
  } catch (error) {
    return internalErrorResponse(error)
  }
}
