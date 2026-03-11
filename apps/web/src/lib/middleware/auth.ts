import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { verifyToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { developers, consumers, apiKeys } from '@/lib/db/schema'

export interface AuthenticatedDeveloper {
  id: string
  email: string
}

export interface AuthenticatedConsumer {
  id: string
  email: string
}

export interface AuthenticatedApiKey {
  consumerId: string
  toolId: string
  keyId: string
}

/**
 * Extracts and verifies the JWT from the sg-token cookie.
 * Confirms the developer record exists in the database.
 * Throws an Error with a descriptive message on failure.
 */
export async function requireDeveloper(
  request: NextRequest
): Promise<AuthenticatedDeveloper> {
  const token = request.cookies.get('sg-token')?.value

  if (!token) {
    throw new Error('Authentication required. No session token found.')
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>

  try {
    payload = await verifyToken(token)
  } catch {
    throw new Error('Invalid or expired session token.')
  }

  if (payload.role !== 'developer') {
    throw new Error('Access denied. Developer account required.')
  }

  const [developer] = await db
    .select({ id: developers.id, email: developers.email })
    .from(developers)
    .where(eq(developers.id, payload.id))
    .limit(1)

  if (!developer) {
    throw new Error('Developer account not found.')
  }

  return { id: developer.id, email: developer.email }
}

/**
 * Extracts and verifies the JWT from the sg-token cookie.
 * Confirms the consumer record exists in the database.
 * Throws an Error with a descriptive message on failure.
 */
export async function requireConsumer(
  request: NextRequest
): Promise<AuthenticatedConsumer> {
  const token = request.cookies.get('sg-token')?.value

  if (!token) {
    throw new Error('Authentication required. No session token found.')
  }

  let payload: Awaited<ReturnType<typeof verifyToken>>

  try {
    payload = await verifyToken(token)
  } catch {
    throw new Error('Invalid or expired session token.')
  }

  if (payload.role !== 'consumer') {
    throw new Error('Access denied. Consumer account required.')
  }

  const [consumer] = await db
    .select({ id: consumers.id, email: consumers.email })
    .from(consumers)
    .where(eq(consumers.id, payload.id))
    .limit(1)

  if (!consumer) {
    throw new Error('Consumer account not found.')
  }

  return { id: consumer.id, email: consumer.email }
}

/**
 * Validates the x-api-key header against the apiKeys table.
 * The raw key is SHA-256 hashed and compared to stored keyHash values.
 * Only active keys are accepted. Updates lastUsedAt on successful auth.
 * Throws an Error with a descriptive message on failure.
 */
export async function requireApiKey(
  request: NextRequest
): Promise<AuthenticatedApiKey> {
  const rawKey = request.headers.get('x-api-key')

  if (!rawKey) {
    throw new Error('API key required. Provide x-api-key header.')
  }

  if (rawKey.length < 16) {
    throw new Error('Invalid API key format.')
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const [key] = await db
    .select({
      id: apiKeys.id,
      consumerId: apiKeys.consumerId,
      toolId: apiKeys.toolId,
      status: apiKeys.status,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)

  if (!key) {
    throw new Error('Invalid API key.')
  }

  if (key.status !== 'active') {
    throw new Error('API key has been revoked.')
  }

  // Update lastUsedAt in the background (non-blocking)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .then(() => {})
    .catch(() => {})

  return {
    consumerId: key.consumerId,
    toolId: key.toolId,
    keyId: key.id,
  }
}
