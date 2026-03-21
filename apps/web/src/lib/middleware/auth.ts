import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { developers, consumers, apiKeys } from '@/lib/db/schema'
import { headers, cookies } from 'next/headers'

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
 * Create a Supabase client that reads cookies from the current request.
 * This works reliably in both middleware-processed and direct Route Handler contexts.
 */
async function getSupabaseUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )
  return supabase.auth.getUser()
}

/**
 * Authenticates via Supabase session and confirms a developer record exists.
 */
export async function requireDeveloper(
  _request?: NextRequest
): Promise<AuthenticatedDeveloper> {
  const { data: { user }, error } = await getSupabaseUser()

  if (!user) {
    throw new Error('Authentication required. Please sign in.')
  }

  const [developer] = await db
    .select({ id: developers.id, email: developers.email })
    .from(developers)
    .where(eq(developers.supabaseUserId, user.id))
    .limit(1)

  if (!developer) {
    throw new Error('Developer account not found. Please complete registration.')
  }

  return { id: developer.id, email: developer.email }
}

/**
 * Authenticates via Supabase session and confirms a consumer record exists.
 */
export async function requireConsumer(
  _request?: NextRequest
): Promise<AuthenticatedConsumer> {
  const { data: { user }, error } = await getSupabaseUser()

  if (!user) {
    throw new Error('Authentication required. Please sign in.')
  }

  const [consumer] = await db
    .select({ id: consumers.id, email: consumers.email })
    .from(consumers)
    .where(eq(consumers.supabaseUserId, user.id))
    .limit(1)

  if (!consumer) {
    throw new Error('Consumer account not found. Please complete registration.')
  }

  return { id: consumer.id, email: consumer.email }
}

/**
 * Validates the x-api-key header against the apiKeys table.
 * The raw key is SHA-256 hashed and compared to stored keyHash values.
 * Only active keys are accepted. Updates lastUsedAt on successful auth.
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
