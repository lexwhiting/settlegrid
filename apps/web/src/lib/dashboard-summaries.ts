/**
 * Map dashboard API responses onto the figures the dashboard home cards show.
 */

/** Card figures derived from GET /api/dashboard/developer/consumers/insights */
export interface ConsumerInsightsData {
  activeConsumers: number
  /** The API returns at most this many consumers per list */
  activeCapped: boolean
  newConsumers: number
  avgLifetimeValueCents: number
  atRiskConsumers: number
}

/** Card figures from GET /api/dashboard/developer/fraud/signals (data.summary) */
export interface FraudSignalsData {
  totalSignals: number
  activeSignals: number
  scannedToday: number
  flaggedThisWeek: number
}

// Per-list cap in the consumer insights API (TOP_CONSUMERS_LIMIT)
const INSIGHTS_LIST_LIMIT = 20

export function toConsumerInsights(data: Record<string, unknown>): ConsumerInsightsData {
  const list = (key: string) => (Array.isArray(data[key]) ? (data[key] as unknown[]) : [])
  const ltv = list('consumerLtv') as Array<{ estimatedLtvCents?: number }>
  const ltvTotal = ltv.reduce((sum, c) => sum + (Number(c.estimatedLtvCents) || 0), 0)
  const active = list('topConsumers').length
  return {
    activeConsumers: active,
    activeCapped: active >= INSIGHTS_LIST_LIMIT,
    newConsumers: list('newConsumers').length,
    avgLifetimeValueCents: ltv.length > 0 ? Math.round(ltvTotal / ltv.length) : 0,
    atRiskConsumers: list('atRiskConsumers').length,
  }
}

export function toFraudSignals(data: Record<string, unknown>): FraudSignalsData {
  const summary = (data.summary ?? {}) as Record<string, unknown>
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  return {
    totalSignals: num(summary.totalSignals),
    activeSignals: num(summary.activeSignals),
    scannedToday: num(summary.scannedToday),
    flaggedThisWeek: num(summary.flaggedThisWeek),
  }
}
