/**
 * P2.RAIL1 — Server-only rail-registry accessor.
 *
 * `buildRailRegistry()` from @settlegrid/mcp expects a live Stripe
 * client. This module constructs the Stripe client from env once
 * per process and exposes a memoized registry to server components,
 * route handlers, and the dashboard's status-label source.
 *
 * Browser code MUST NOT import this module — the Stripe SDK needs
 * the secret key. The dashboard imports the pure metadata slice
 * (`getRailDisplayMetadata`) which is safe for server components
 * that pass the result into client components as plain JSON.
 */

import 'server-only'
import Stripe from 'stripe'
import {
  buildRailRegistry,
  type RailRegistry,
  type RailId,
  type RailAdapter,
  type StripeClient,
} from '@settlegrid/mcp'
import { getStripeSecretKey, getAppUrl } from '@/lib/env'

let _registry: RailRegistry | undefined

/**
 * Lazy, memoized rail registry. First access constructs the Stripe
 * client + adapter; subsequent calls return the same instance.
 */
export function getRailRegistry(): RailRegistry {
  if (_registry) return _registry
  const stripe = new Stripe(getStripeSecretKey(), {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
  _registry = buildRailRegistry({
    stripeConnect: {
      stripe: stripe as unknown as StripeClient,
      appUrl: getAppUrl(),
    },
  })
  return _registry
}

/**
 * Serializable rail metadata the dashboard uses to render
 * connection-status labels WITHOUT needing a Stripe client. Pulls
 * from the registry so adding a future rail (Paddle, etc.)
 * automatically surfaces on the settings page.
 */
export interface RailDisplayMetadata {
  id: RailId
  displayName: string
  legalStructure: string
  percentBps: number
  flatCents: number
}

/**
 * Produce a plain-JSON display metadata array for every rail in the
 * registry. Safe to pass into client components — contains no
 * function references, no Stripe client, no secrets.
 */
export function getRailDisplayMetadata(): RailDisplayMetadata[] {
  const registry = getRailRegistry()
  const entries: RailDisplayMetadata[] = []
  for (const [id, adapter] of Object.entries(registry) as Array<
    [RailId, RailAdapter | undefined]
  >) {
    if (!adapter) continue
    entries.push({
      id,
      displayName: adapter.displayName,
      legalStructure: adapter.legalStructure,
      percentBps: adapter.pricing.percentBps,
      flatCents: adapter.pricing.flatCents,
    })
  }
  return entries
}

/**
 * Resolve the display name for the Stripe Connect rail. Used by the
 * dashboard settings page so the label reads from the registry
 * instead of a hardcoded "Stripe" string — if the registry ever
 * renames the rail, the UI updates automatically.
 */
export function getStripeConnectDisplayName(): string {
  const registry = getRailRegistry()
  return registry['stripe-connect']?.displayName ?? 'Stripe Connect'
}

/**
 * TEST ONLY — reset the memoized registry. Not exported from any
 * public entry; call-sites that need this import from the file
 * directly in test setup.
 */
export function __resetRailRegistry(): void {
  _registry = undefined
}
