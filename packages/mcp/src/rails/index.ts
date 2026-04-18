/**
 * P2.RAIL1 — @settlegrid/mcp/rails barrel.
 *
 * Re-exports the RailAdapter interface, the Stripe Connect
 * implementation, and the registry factory so consumers can
 * import from a single entry:
 *
 *   import {
 *     createStripeRailAdapter,
 *     StripeRailAdapter,
 *     buildRailRegistry,
 *     type RailAdapter,
 *   } from '@settlegrid/mcp'
 */

export type {
  RailId,
  RailAdapter,
  RailCapabilities,
  LegalStructure,
  ComplianceResponsibility,
  DeveloperProfile,
  OnboardingStatus,
  OnboardingStatusCode,
  TopupParams,
  SettleGridInternalEvent,
  SettleGridInternalEventKind,
} from './types'

export {
  createStripeRailAdapter,
  STRIPE_CONNECT_CAPABILITIES,
  STRIPE_CONNECT_COMPLIANCE,
  STRIPE_CONNECT_PRICING,
  STRIPE_CONNECT_DISPLAY_NAME,
  type StripeRailAdapterOptions,
  type StripeClient,
  type StripeRailAdapter,
} from './stripe-connect'

export {
  buildRailRegistry,
  requireRail,
  listRails,
  RESERVED_RAIL_IDS,
  type BuildRegistryOptions,
  type RailRegistry,
} from './registry'
