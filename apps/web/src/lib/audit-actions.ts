/**
 * Every audit log action and resource type written via writeAuditLog
 * (lib/audit.ts). Kept free of server imports so the dashboard audit log
 * filters can use the same list.
 */

/** Actions recorded against the signed-in developer. */
export const DEVELOPER_AUDIT_ACTIONS = [
  'auth.login',
  'tool.created',
  'tool.updated',
  'tool.deleted',
  'tool.status_changed',
  'tool.quick_published',
  'tool.published.create',
  'tool.published.update',
  'tool.claimed',
  'tool.changelog_created',
  'tool.listed_in_marketplace_changed',
  'tool.proxy_endpoint_updated',
  'tool.proxy_endpoint_removed',
  'webhook.created',
  'webhook.deleted',
  'webhook.custom_headers_updated',
  'publisher_api_key.created',
  'publisher_api_key.revoked',
  'payout.triggered',
  'payout.indeterminate_unmarked',
  'payout.auto_recovered_to_completed',
  'payout_schedule.update',
  'security.mfa_enabled',
  'security.mfa_disabled',
  'settings.profile_updated',
  'settings.payout_updated',
  'settings.notifications_updated',
  'billing.plan_changed',
  'billing.stripe_connect_started',
  'privacy.data_export_requested',
  'privacy.account_deletion_completed',
] as const

/** Actions recorded against a consumer. */
export const CONSUMER_AUDIT_ACTIONS = [
  'api_key.created',
  'api_key.revoked',
  'budget.updated',
] as const

/** Admin actions. */
export const ADMIN_AUDIT_ACTIONS = [
  'chargeback.unpause',
  'signup_followup.update',
  'review.hide',
  'review.restore',
  'review.remove',
] as const

export const AUDIT_ACTIONS = [
  ...DEVELOPER_AUDIT_ACTIONS,
  ...CONSUMER_AUDIT_ACTIONS,
  ...ADMIN_AUDIT_ACTIONS,
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** Resource types on developer-side entries. */
export const DEVELOPER_AUDIT_RESOURCE_TYPES = [
  'tool',
  'webhook',
  'publisher_api_key',
  'payout',
  'developer',
  'session',
  'mfa_factor',
  'subscription',
  'stripe_account',
  'compliance_export',
] as const

export const AUDIT_RESOURCE_TYPES = [
  ...DEVELOPER_AUDIT_RESOURCE_TYPES,
  'apiKey',
  'budget',
  'review',
  'developer_signup',
] as const

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number]
