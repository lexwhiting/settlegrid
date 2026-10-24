import { describe, it, expect } from 'vitest'
import { toConsumerInsights, toFraudSignals, toolsWithoutBudgetRow } from '../dashboard-summaries'

describe('toConsumerInsights', () => {
  it('counts the API lists and averages estimated LTV', () => {
    expect(toConsumerInsights({
      topConsumers: [{}, {}, {}],
      churningConsumers: [{}],
      atRiskConsumers: [{}, {}],
      newConsumers: [{}],
      consumerLtv: [{ estimatedLtvCents: 1000 }, { estimatedLtvCents: 3000 }],
      periodDays: 30,
    })).toEqual({
      activeConsumers: 3,
      activeCapped: false,
      newConsumers: 1,
      avgLifetimeValueCents: 2000,
      atRiskConsumers: 2,
    })
  })

  it('returns zeros for the empty response (no tools)', () => {
    expect(toConsumerInsights({
      topConsumers: [], churningConsumers: [], atRiskConsumers: [], newConsumers: [], consumerLtv: [],
    })).toEqual({
      activeConsumers: 0,
      activeCapped: false,
      newConsumers: 0,
      avgLifetimeValueCents: 0,
      atRiskConsumers: 0,
    })
  })

  it('marks the active count as capped at the API list limit', () => {
    expect(toConsumerInsights({ topConsumers: Array.from({ length: 20 }, () => ({})) }).activeCapped).toBe(true)
  })
})

describe('toFraudSignals', () => {
  it('reads data.summary', () => {
    expect(toFraudSignals({
      signals: [],
      summary: { totalSignals: 12, activeSignals: 10, degradedSignals: 2, scannedToday: 340, flaggedThisWeek: 3 },
    })).toEqual({ totalSignals: 12, activeSignals: 10, scannedToday: 340, flaggedThisWeek: 3 })
  })

  it('returns zeros when the summary is missing', () => {
    expect(toFraudSignals({})).toEqual({ totalSignals: 0, activeSignals: 0, scannedToday: 0, flaggedThisWeek: 0 })
  })
})

describe('toolsWithoutBudgetRow', () => {
  const usage = (toolId: string, totalCostCents: number) => ({
    toolId,
    toolName: toolId,
    toolSlug: toolId,
    totalInvocations: 1,
    totalCostCents,
  })

  it('returns used tools that have no per-tool balance row', () => {
    expect(toolsWithoutBudgetRow([{ toolId: 't1' }], [usage('t1', 5), usage('t2', 1)]))
      .toEqual([usage('t2', 1)])
  })

  it('returns every used tool when there are no balance rows', () => {
    expect(toolsWithoutBudgetRow([], [usage('t1', 1), usage('t2', 9)]).map((t) => t.toolId))
      .toEqual(['t2', 't1'])
  })

  it('returns nothing without usage', () => {
    expect(toolsWithoutBudgetRow([{ toolId: 't1' }], [])).toEqual([])
  })
})
