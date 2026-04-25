/**
 * P3.RAIL1 — `@settlegrid/rails` barrel.
 *
 * The package's single entry point. Re-exports the routing functions,
 * the matrix loader, and the typed errors so consumers can:
 *
 *   import {
 *     routeDeveloper,
 *     selectStripeAccountType,
 *     UnsupportedCountryError,
 *     loadCountryMatrix,
 *     type RoutingDecision,
 *   } from '@settlegrid/rails'
 */

export {
  // Functions
  routeDeveloper,
  selectStripeAccountType,
  loadCountryMatrix,
  __resetMatrixCacheForTests,
  __parseMatrixForTests,
  // Errors
  UnsupportedCountryError,
  ConfigurationError,
  InvalidInputError,
  // Types
  type EntityType,
  type StripeAccountType,
  type DeveloperTier,
  type WaitlistReason,
  type CountryMatrix,
  type SelectAccountTypeInput,
  type RouteDeveloperInput,
  type RoutingDecision,
} from './router'
