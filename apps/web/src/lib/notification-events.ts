/**
 * Developer notification event keys — the single list shared by the Settings
 * page, the notification-preferences API and every sender
 * (sendNotificationEmail / notifyDeveloper).
 *
 * Preferences are stored as a flat `Record<string, boolean>` on
 * `developers.notificationPreferences` (opt-out model: only `false` suppresses).
 */

export type NotificationCategory = 'billing' | 'tools' | 'security' | 'webhooks'

export interface NotificationEventDef {
  key: string
  label: string
  category: NotificationCategory
  /** Critical emails are always sent and cannot be turned off. */
  critical: boolean
  /**
   * Shown as a toggle in Settings. False for keys that are accepted by the
   * API but have no preference-aware sender yet.
   */
  inSettings: boolean
}

export const NOTIFICATION_EVENTS = [
  { key: 'plan_changed', label: 'Plan changed', category: 'billing', critical: false, inSettings: true },
  { key: 'monthly_summary', label: 'Monthly earnings summary', category: 'billing', critical: false, inSettings: true },
  { key: 'usage_alert', label: 'Plan usage warnings (80%, 90%, 100% of monthly ops)', category: 'billing', critical: false, inSettings: true },
  { key: 'tool_published', label: 'Tool published', category: 'tools', critical: false, inSettings: true },
  { key: 'tool_health_down', label: 'Tool health check failed', category: 'tools', critical: true, inSettings: true },
  { key: 'usage_spike', label: 'Unusual traffic detected (spike or drop)', category: 'tools', critical: false, inSettings: true },
  { key: 'quality_alert', label: 'Tool quality alerts (slow response, errors)', category: 'tools', critical: false, inSettings: true },
  { key: 'onboarding_tips', label: 'Onboarding tips & best practices', category: 'tools', critical: false, inSettings: true },
  { key: 'api_key_created', label: 'API key created', category: 'security', critical: false, inSettings: true },
  { key: 'api_key_revoked', label: 'API key revoked', category: 'security', critical: true, inSettings: true },
  { key: 'suspicious_activity', label: 'Suspicious activity detected', category: 'security', critical: true, inSettings: true },
  { key: 'webhook_delivery_failed', label: 'Webhook delivery failed', category: 'webhooks', critical: false, inSettings: true },
  // Accepted keys without a preference-aware sender yet (hidden in Settings).
  { key: 'tool_status_changed', label: 'Tool status changed', category: 'tools', critical: false, inSettings: false },
  { key: 'payout_completed', label: 'Payout completed', category: 'billing', critical: false, inSettings: false },
  { key: 'new_review', label: 'New review received', category: 'tools', critical: false, inSettings: false },
] as const satisfies readonly NotificationEventDef[]

export type NotificationEventKey = (typeof NOTIFICATION_EVENTS)[number]['key']

/** Marketing emails use the same preference store, with their own toggle. */
export const MARKETING_PREFERENCE_KEY = 'marketing_updates'

/** Every key the notification-preferences API accepts. */
export const NOTIFICATION_PREFERENCE_KEYS: [typeof MARKETING_PREFERENCE_KEY, ...NotificationEventKey[]] = [
  MARKETING_PREFERENCE_KEY,
  ...NOTIFICATION_EVENTS.map((e) => e.key),
]

/** The events shown as toggles on the Settings page. */
export const SETTINGS_NOTIFICATION_EVENTS: readonly NotificationEventDef[] =
  NOTIFICATION_EVENTS.filter((e) => e.inSettings)

/**
 * Earlier key names, mapped to the current key. A stored `false` under an
 * earlier name still counts as an opt-out for the current key.
 */
export const LEGACY_NOTIFICATION_KEYS: Readonly<Record<string, NotificationEventKey>> = {
  onboarding_drip: 'onboarding_tips',
  'tool.health_alert': 'tool_health_down',
  'tool.anomaly_detected': 'usage_spike',
}

/**
 * True when the developer has turned this event off. A value stored under the
 * current key wins; otherwise a `false` under an earlier key name counts.
 */
export function isNotificationOptedOut(
  prefs: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  if (!prefs) return false
  if (typeof prefs[key] === 'boolean') return prefs[key] === false
  for (const [legacyKey, currentKey] of Object.entries(LEGACY_NOTIFICATION_KEYS)) {
    if (currentKey === key && prefs[legacyKey] === false) return true
  }
  return false
}
