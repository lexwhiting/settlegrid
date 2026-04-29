import { NextResponse } from 'next/server'
import { successResponse, internalErrorResponse } from '@/lib/api'
import { getRailDisplayMetadata } from '@/lib/rails'

/**
 * P2.RAIL1 — GET /api/rails
 *
 * Returns display metadata for every rail currently populated in the
 * server-side rail registry. The dashboard settings page uses this
 * endpoint to render connection-status UI WITHOUT hardcoding
 * "Stripe" — iterating the registry means adding a future rail
 * (Paddle, Lemon Squeezy, etc.) automatically surfaces on the
 * settings page without a client-side code change.
 *
 * Phase 2 returns a single-entry array (stripe-connect only). The
 * shape is stable so the client can iterate without feature-flagging.
 */
export const maxDuration = 10

export async function GET(): Promise<NextResponse> {
  try {
    const rails = getRailDisplayMetadata()
    return successResponse({ rails })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
