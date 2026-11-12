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

/** Per-tool usage from GET /api/consumer/usage (data.summary) */
export interface ToolUsageSummary {
  toolId: string
  toolName: string
  toolSlug: string
  totalInvocations: number
  totalCostCents: number
}

/**
 * Tools the consumer used that have no per-tool balance row (GET
 * /api/consumer/budget). Their calls were paid from global credit, so they
 * have spend but no per-tool budget. Highest spend first.
 */
export function toolsWithoutBudgetRow(
  budgets: Array<{ toolId: string }>,
  summary: ToolUsageSummary[],
): ToolUsageSummary[] {
  const budgeted = new Set(budgets.map((b) => b.toolId))
  return summary
    .filter((s) => !budgeted.has(s.toolId))
    .sort((a, b) => b.totalCostCents - a.totalCostCents)
}

/**
 * Format an error rate the dashboard APIs return as a PERCENTAGE (0–100, e.g. 50 for
 * one failed call in two). Never multiply by 100 again before calling this.
 */
export function formatErrorRatePct(pct: unknown): string {
  const n = Number(pct)
  if (!Number.isFinite(n) || n <= 0) return '0.00%'
  return `${Math.min(n, 100).toFixed(2)}%`
}

/** The Settings plan card's fee figures, derived from the monthly take-rate brackets (lib/pricing.ts). */
export function takeRateSummary(brackets: readonly { upTo: number; rate: number }[]) {
  const pct = brackets.map((b) => Math.round(b.rate * 10_000) / 100)
  const [low, high] = [Math.min(...pct), Math.max(...pct)]
  const free = brackets.find((b) => b.rate === 0)
  const range = (a: number, b: number) => (a === b ? `${a}%` : `${a}–${b}%`)
  return {
    takeRate: range(low, high),
    revenueShare: range(100 - high, 100 - low),
    freeUpTo: free ? `$${(free.upTo / 100).toLocaleString('en-US')}` : null,
  }
}
