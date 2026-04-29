/**
 * P2.RAIL1 — Rail registry.
 *
 * The registry is a typed map from RailId → RailAdapter instance.
 * Phase 2 ships with ONLY `stripe-connect` populated. Future-rail
 * slots are listed in the `RESERVED_RAIL_IDS` constant + commented
 * out in the registry constructor so adding a rail later is a
 * mechanical, localized change.
 *
 * Per multi-rail-architecture.md (Pattern A+): "the registry ships
 * with only `stripe-connect` populated; other slots are reserved for
 * future rails."
 */

import type { RailAdapter, RailId } from './types'
import {
  createStripeRailAdapter,
  type StripeRailAdapterOptions,
} from './stripe-connect'

/**
 * Rail IDs reserved for potential future rails. Each requires
 * AUP-compatible business-model verification + demand signal before
 * integration.
 *
 * Kept as a const array so a reader can see the full potential
 * rail universe at a glance — the current "only stripe-connect"
 * shipping decision is explicit, not implicit.
 */
export const RESERVED_RAIL_IDS = [
  'paddle',
  'lemon-squeezy',
  'wise-batch',
  'razorpay-route',
  'flutterwave',
] as const satisfies readonly RailId[]

/**
 * Build the rails registry. Callers pass per-rail config at
 * construction time; keeping the registry a FACTORY (rather than a
 * module-level singleton) lets consumers inject different Stripe
 * clients for test vs production and matches the factory style used
 * by the settlegrid.init() SDK surface.
 *
 * Phase 2 ships only `stripe-connect`. Future-rail slots are
 * commented out below so adding Paddle (for example) becomes a
 * 3-line change:
 *   1. Import `createPaddleRailAdapter` from './paddle'
 *   2. Uncomment the registry slot
 *   3. Add the `paddle` key to `BuildRegistryOptions`
 */
export interface BuildRegistryOptions {
  /** Required: Stripe Connect config. Stripe is the only rail today. */
  stripeConnect: StripeRailAdapterOptions
  // Future-rail config slots (reserved, not yet used):
  // paddle?: PaddleRailAdapterOptions
  // lemonSqueezy?: LemonSqueezyRailAdapterOptions
  // wiseBatch?: WiseRailAdapterOptions
}

/**
 * Registry type — `Partial` because rail additions are gated by
 * product-readiness. Consumers MUST null-check before use.
 */
export type RailRegistry = Partial<Record<RailId, RailAdapter>>

/**
 * Build a fresh rail registry for a given runtime (app-server,
 * background worker, etc.). Call ONCE per process lifetime.
 */
export function buildRailRegistry(
  opts: BuildRegistryOptions,
): RailRegistry {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError(
      'buildRailRegistry: `opts` is required and must be an object.',
    )
  }
  if (!opts.stripeConnect) {
    throw new TypeError(
      'buildRailRegistry: `opts.stripeConnect` is required (Phase 2 ships only Stripe Connect).',
    )
  }

  const registry: RailRegistry = {
    'stripe-connect': createStripeRailAdapter(opts.stripeConnect),
    // Future — require AUP-compatible business-model verification +
    // demand signal before integrating:
    // 'paddle': createPaddleRailAdapter(opts.paddle!),
    // 'lemon-squeezy': createLemonSqueezyRailAdapter(opts.lemonSqueezy!),
    // 'wise-batch': createWiseRailAdapter(opts.wiseBatch!),
  }

  return registry
}

/**
 * Look up a rail adapter by id with a friendly error on miss.
 *
 * Use this instead of `registry['stripe-connect']!` — the bang
 * operator erases a real possibility (rail not configured) and
 * produces a confusing undefined-method error at call time.
 */
export function requireRail(
  registry: RailRegistry,
  railId: RailId,
): RailAdapter {
  const adapter = registry[railId]
  if (!adapter) {
    throw new Error(
      `Rail adapter '${railId}' is not configured in this registry. ` +
        `Phase 2 ships only 'stripe-connect'; if you need '${railId}', ` +
        `add it to buildRailRegistry options first.`,
    )
  }
  return adapter
}

/**
 * List the rail IDs that are CURRENTLY populated in the registry.
 * Dashboards and admin UIs call this to render the set of
 * connectable rails without hardcoding the list.
 */
export function listRails(registry: RailRegistry): RailId[] {
  return Object.keys(registry).filter(
    (key): key is RailId => registry[key as RailId] !== undefined,
  )
}
