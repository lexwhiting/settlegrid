import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_EVENTS,
  NOTIFICATION_PREFERENCE_KEYS,
  SETTINGS_NOTIFICATION_EVENTS,
  LEGACY_NOTIFICATION_KEYS,
  isNotificationOptedOut,
} from '../notification-events'

describe('notification events', () => {
  it('has unique keys', () => {
    const keys = NOTIFICATION_EVENTS.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('accepts every Settings key plus marketing_updates', () => {
    for (const e of SETTINGS_NOTIFICATION_EVENTS) {
      expect(NOTIFICATION_PREFERENCE_KEYS).toContain(e.key)
    }
    expect(NOTIFICATION_PREFERENCE_KEYS).toContain('marketing_updates')
  })

  it('includes the keys senders use', () => {
    for (const key of [
      'tool_published', 'tool_status_changed', 'monthly_summary', 'quality_alert',
      'plan_changed', 'api_key_created', 'api_key_revoked', 'suspicious_activity',
      'usage_alert', 'usage_spike', 'onboarding_tips', 'tool_health_down', 'webhook_delivery_failed',
    ]) {
      expect(NOTIFICATION_PREFERENCE_KEYS).toContain(key)
    }
  })

  it('maps legacy keys onto current keys', () => {
    for (const current of Object.values(LEGACY_NOTIFICATION_KEYS)) {
      expect(NOTIFICATION_PREFERENCE_KEYS).toContain(current)
    }
  })
})

describe('isNotificationOptedOut', () => {
  it('is false for missing prefs or missing keys (opt-out model)', () => {
    expect(isNotificationOptedOut(null, 'monthly_summary')).toBe(false)
    expect(isNotificationOptedOut({}, 'monthly_summary')).toBe(false)
    expect(isNotificationOptedOut({ monthly_summary: true }, 'monthly_summary')).toBe(false)
  })

  it('is true when the key is false', () => {
    expect(isNotificationOptedOut({ monthly_summary: false }, 'monthly_summary')).toBe(true)
  })

  it('treats a legacy key set to false as an opt-out', () => {
    expect(isNotificationOptedOut({ onboarding_drip: false }, 'onboarding_tips')).toBe(true)
    expect(isNotificationOptedOut({ 'tool.anomaly_detected': false }, 'usage_spike')).toBe(true)
  })

  it('lets the current key override a legacy key', () => {
    expect(isNotificationOptedOut({ onboarding_drip: false, onboarding_tips: true }, 'onboarding_tips')).toBe(false)
  })
})
