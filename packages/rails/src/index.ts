/**
 * `@settlegrid/rails` barrel.
 *
 * Single entry point for both card families:
 *   - **P3.RAIL1** — account-type router + eligibility pre-check
 *     (`./router`)
 *   - **P3.RAIL2** — Stripe reconciliation pure helpers
 *     (`./stripe-reconcile`)
 *
 * Consumers can:
 *
 *   import {
 *     routeDeveloper,
 *     reconcileLeg,
 *     fetchBalanceTransactionsForUtcDay,
 *     type DriftReport,
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

export {
  // Functions
  utcDayBounds,
  fetchBalanceTransactionsForUtcDay,
  fetchTransfersForUtcDay,
  groupTransfersByDestinationAccount,
  reconcileLeg,
  computeDriftBps,
  shouldOpenIssue,
  formatReconcileSummary,
  resolveTransfersLedgerDestination,
  // Constants
  DEFAULT_DRIFT_THRESHOLD_BPS,
  DEFAULT_ISSUE_RATE_LIMIT_HOURS,
  // Types
  type StripeBalanceTransaction,
  type StripeTransfer,
  type StripeReconcileClient,
  type LedgerEntryForReconcile,
  type ReconcileLeg,
  type DriftReport,
  type ShouldOpenIssueOptions,
  type ShouldOpenIssueResult,
} from './stripe-reconcile'

export {
  // Payout-schedule
  updatePayoutSchedule,
  normalizePayoutSchedule,
  payoutSchedulesEqual,
  InvalidPayoutScheduleError,
  // Velocity classification
  classifyChargebackVelocity,
  shouldSendChargebackAlert,
  // Constants
  CHARGEBACK_GREEN_RATE,
  CHARGEBACK_YELLOW_RATE,
  CHARGEBACK_STRIPE_INTERVENTION_RATE,
  MIN_CHARGES_FOR_VELOCITY_ALERT,
  ALERT_WINDOW_HOURS_YELLOW,
  ALERT_WINDOW_HOURS_RED,
  // Types
  type StripePayoutSchedule,
  type StripePayoutClient,
  type DesiredPayoutSchedule,
  type UpdatePayoutScheduleResult,
  type ChargebackTier,
  type VelocityInputs,
  type VelocityClassification,
  type ClassifyOptions,
  type ChargebackAlertHistoryRow,
  type AlertRateLimitDecision,
} from './stripe'
