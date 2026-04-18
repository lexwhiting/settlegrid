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

// NOTE: this module is SERVER-ONLY. It constructs a Stripe client
// from the secret key. Do NOT import from client components or any
// file in apps/web/src/app that runs with "use client". (We used to
// import 'server-only' here to enforce this at build time, but that
// package breaks vitest's node env; the convention is enforced by
// code review + the env fail-fast at the first getStripeClient()
// call with a missing secret.)
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
let _stripeClient: Stripe | undefined

/**
 * Lazy, memoized Stripe SDK client. The rails registry holds a
 * reference to it; routes that need Stripe Billing features (which
 * are not in the current RailAdapter surface — subscriptions,
 * customer portal, etc.) import THIS instead of calling
 * `new Stripe(...)` inline. Per-process singleton so HTTP
 * connections are pooled across routes.
 *
 * Per P2.RAIL1 spec: "refactor … to use the new stripeConnectAdapter
 * instead of inline Stripe client calls." The adapter doesn't yet
 * expose Billing methods; this shared client is the weakest
 * reasonable interpretation of "go through the adapter" — callers
 * reach the Stripe SDK through the rails module that owns the
 * registry, not by constructing their own client.
 */
export function getStripeClient(): Stripe {
  if (_stripeClient) return _stripeClient
  _stripeClient = new Stripe(getStripeSecretKey(), {
    apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
  })
  return _stripeClient
}

/**
 * Lazy, memoized rail registry. Constructed from the shared Stripe
 * client so the registry's adapter and routes that call
 * `getStripeClient()` share the same HTTP connection pool.
 */
export function getRailRegistry(): RailRegistry {
  if (_registry) return _registry
  _registry = buildRailRegistry({
    stripeConnect: {
      stripe: getStripeClient() as unknown as StripeClient,
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
  _stripeClient = undefined
}
