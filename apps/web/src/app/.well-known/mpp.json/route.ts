/**
 * /.well-known/mpp.json — MPP Directory Registration
 *
 * Advertises SettleGrid's MPP capabilities to the Stripe MPP Directory
 * and other MPP-compatible service discovery mechanisms.
 *
 * Any MPP agent can fetch this endpoint to learn that SettleGrid
 * accepts Shared Payment Tokens for tool invocations.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { isMppEnabled } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // Cache for 5 minutes

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'

  // Count active tools
  let toolsCount = 0
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tools)
      .where(eq(tools.status, 'active'))
    toolsCount = result?.count ?? 0
  } catch {
    // DB unavailable — return 0
  }

  const mppManifest = {
    // MPP Directory fields
    name: 'SettleGrid',
    description: 'Settlement infrastructure for AI tools. Per-call billing, usage metering, and automated payouts across multiple agent payment protocols.',
    mpp_version: '1.0',
    mpp_enabled: isMppEnabled(),

    // Endpoints
    payment_endpoint: `${appUrl}/api/proxy/{tool_slug}`,
    directory_url: `${appUrl}/api/v1/discover`,
    well_known_url: `${appUrl}/.well-known/mpp.json`,

    // Payment capabilities
    supported_currencies: ['usd'],
    accepted_tokens: ['spt'],
    pricing_models: ['per-call', 'per-token', 'per-byte', 'per-second', 'tiered', 'outcome'],

    // Platform info
    tools_count: toolsCount,
    platform: {
      name: 'SettleGrid',
      url: appUrl,
      documentation: `${appUrl}/docs`,
      protocols_supported: ['mcp', 'mpp', 'x402', 'ap2', 'visa-tap', 'ucp', 'acp', 'mastercard-vi', 'circle-nano', 'rest'],
    },

    // MPP integration details
    integration: {
      type: 'service-provider',
      authentication: 'spt',
      settlement: 'stripe-connect',
      response_format: 'json',
      error_format: 'mpp-402',
    },

    // Contact
    contact: {
      support: 'support@settlegrid.ai',
      documentation: `${appUrl}/docs#mpp`,
    },
  }

  return NextResponse.json(mppManifest, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  })
}
