export const TIER_LIMITS = {
  free: {
    opsPerMonth: 50_000,
    logRetentionDays: 7,
    maxWebhookEndpoints: 1,
    maxTeamMembers: 1,
    features: ['basic_dashboard', 'progressive_take_rate'] as const,
  },
  builder: {
    opsPerMonth: 200_000,
    logRetentionDays: 30,
    maxWebhookEndpoints: 3,
    maxTeamMembers: 1,
    features: ['basic_dashboard', 'progressive_take_rate', 'sandbox_mode', 'slack_notifications', 'health_alerts', 'category_benchmarking', 'revenue_forecasting', 'priority_listing', 'whitelabel_widget'] as const,
  },
  scale: {
    opsPerMonth: 2_000_000,
    logRetentionDays: 90,
    maxWebhookEndpoints: 10,
    maxTeamMembers: 5,
    features: ['basic_dashboard', 'progressive_take_rate', 'sandbox_mode', 'slack_notifications', 'health_alerts', 'category_benchmarking', 'revenue_forecasting', 'priority_listing', 'whitelabel_widget', 'advanced_analytics', 'consumer_insights', 'anomaly_detection', 'fraud_detection', 'data_export', 'audit_logs', 'ip_allowlisting', 'weekly_report', 'custom_webhook_headers', 'team_access'] as const,
  },
  enterprise: {
    opsPerMonth: Infinity,
    logRetentionDays: 365,
    maxWebhookEndpoints: 50,
    maxTeamMembers: Infinity,
    features: ['basic_dashboard', 'progressive_take_rate', 'sandbox_mode', 'slack_notifications', 'health_alerts', 'category_benchmarking', 'revenue_forecasting', 'priority_listing', 'whitelabel_widget', 'advanced_analytics', 'consumer_insights', 'anomaly_detection', 'fraud_detection', 'data_export', 'audit_logs', 'ip_allowlisting', 'weekly_report', 'custom_webhook_headers', 'team_access'] as const,
  },
  academic: {
    opsPerMonth: 500_000,
    logRetentionDays: 90,
    maxWebhookEndpoints: 10,
    maxTeamMembers: 5,
    features: ['basic_dashboard', 'progressive_take_rate', 'sandbox_mode', 'slack_notifications', 'health_alerts', 'category_benchmarking', 'revenue_forecasting', 'priority_listing', 'whitelabel_widget', 'advanced_analytics', 'consumer_insights', 'anomaly_detection', 'fraud_detection', 'data_export', 'audit_logs', 'ip_allowlisting', 'weekly_report', 'custom_webhook_headers', 'team_access'] as const,
  },
} as const

export type PlanTier = keyof typeof TIER_LIMITS
export type Feature = (typeof TIER_LIMITS)[PlanTier]['features'][number]

export function getTierConfig(tier: string) {
  const normalized = tier.toLowerCase()
  // Handle legacy tier names
  if (normalized === 'starter' || normalized === 'growth') return TIER_LIMITS.builder
  if (normalized === 'standard') return TIER_LIMITS.free
  if (normalized === 'academic') return TIER_LIMITS.academic
  return TIER_LIMITS[normalized as PlanTier] ?? TIER_LIMITS.free
}

export function hasFeature(tier: string, feature: Feature, isFoundingMember?: boolean): boolean {
  if (isFoundingMember) return true // Founding members get Scale features
  const config = getTierConfig(tier)
  return (config.features as readonly string[]).includes(feature)
}
