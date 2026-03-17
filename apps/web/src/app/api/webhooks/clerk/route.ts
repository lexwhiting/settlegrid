import { NextRequest } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { developers, consumers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getClerkWebhookSecret } from '@/lib/env'
import { logger } from '@/lib/logger'

export const maxDuration = 60


interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name?: string
    last_name?: string
    unsafe_metadata?: Record<string, unknown>
    public_metadata?: Record<string, unknown>
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const svixId = request.headers.get('svix-id') ?? ''
    const svixTimestamp = request.headers.get('svix-timestamp') ?? ''
    const svixSignature = request.headers.get('svix-signature') ?? ''

    const wh = new Webhook(getClerkWebhookSecret())
    const event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent

    const primaryEmail = event.data.email_addresses?.[0]?.email_address
    if (!primaryEmail) {
      return new Response('No email address', { status: 200 })
    }

    switch (event.type) {
      case 'user.created': {
        const userType = (event.data.unsafe_metadata?.userType as string) ?? 'developer'
        const name = [event.data.first_name, event.data.last_name]
          .filter(Boolean)
          .join(' ') || null

        if (userType === 'consumer') {
          // Check if consumer already exists
          const existing = await db
            .select({ id: consumers.id })
            .from(consumers)
            .where(eq(consumers.email, primaryEmail))
            .limit(1)

          if (existing.length === 0) {
            await db.insert(consumers).values({
              email: primaryEmail,
              clerkUserId: event.data.id,
            })
          } else {
            // Link existing consumer to Clerk
            await db
              .update(consumers)
              .set({ clerkUserId: event.data.id })
              .where(eq(consumers.email, primaryEmail))
          }
        } else {
          // Default: developer
          const existing = await db
            .select({ id: developers.id })
            .from(developers)
            .where(eq(developers.email, primaryEmail))
            .limit(1)

          if (existing.length === 0) {
            await db.insert(developers).values({
              email: primaryEmail,
              name,
              clerkUserId: event.data.id,
            })
          } else {
            // Link existing developer to Clerk
            await db
              .update(developers)
              .set({ clerkUserId: event.data.id })
              .where(eq(developers.email, primaryEmail))
          }
        }
        break
      }

      case 'user.updated': {
        // Update email in both tables (whichever has the clerkUserId)
        await db
          .update(developers)
          .set({ email: primaryEmail })
          .where(eq(developers.clerkUserId, event.data.id))

        await db
          .update(consumers)
          .set({ email: primaryEmail })
          .where(eq(consumers.clerkUserId, event.data.id))
        break
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    logger.error('clerk.webhook_failed', {}, error)
    return new Response('Webhook verification failed', { status: 400 })
  }
}
