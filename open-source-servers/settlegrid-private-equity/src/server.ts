/**
 * settlegrid-private-equity — Private Equity Data MCP Server
 *
 * Private Equity Data tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const METRICS: Record<string, { description: string; formula: string; benchmark: string }> = {
  irr: { description: 'Internal Rate of Return — annualized return rate', formula: 'NPV = 0 = Sum(CFt / (1+IRR)^t)', benchmark: '15-25% for top quartile' },
  tvpi: { description: 'Total Value to Paid-In — total return multiple', formula: 'TVPI = (DPI + RVPI)', benchmark: '1.5-2.5x for top quartile' },
  dpi: { description: 'Distributions to Paid-In — realized return', formula: 'DPI = Cumulative Distributions / Paid-In Capital', benchmark: '1.0x+ indicates return of capital' },
  moic: { description: 'Multiple on Invested Capital', formula: 'MOIC = Total Value / Total Invested', benchmark: '2-3x for top quartile' },
  j_curve: { description: 'J-Curve effect — initial negative returns before gains', formula: 'NAV pattern over fund life', benchmark: 'Typically 3-5 year trough' },
}

const FUND_SIZES: Record<string, { avg_fund_million: number; count: number; median_irr: number }> = {
  mega: { avg_fund_million: 5000, count: 120, median_irr: 14.2 },
  large: { avg_fund_million: 1500, count: 350, median_irr: 15.8 },
  mid: { avg_fund_million: 500, count: 800, median_irr: 17.5 },
  small: { avg_fund_million: 150, count: 1200, median_irr: 16.1 },
  micro: { avg_fund_million: 50, count: 2000, median_irr: 14.8 },
}

const sg = settlegrid.init({ toolSlug: 'private-equity', pricing: { defaultCostCents: 2, methods: {
  get_metric: { costCents: 2, displayName: 'Get PE Metric' },
  get_market_overview: { costCents: 2, displayName: 'Get Market Overview' },
  calculate_moic: { costCents: 1, displayName: 'Calculate MOIC' },
}}})

const getMetric = sg.wrap(async (args: { metric: string }) => {
  if (!args.metric) throw new Error('metric required')
  const m = METRICS[args.metric.toLowerCase()]
  if (!m) throw new Error(`Unknown. Available: ${Object.keys(METRICS).join(', ')}`)
  return { metric: args.metric, ...m }
}, { method: 'get_metric' })

const getMarketOverview = sg.wrap(async (_a: Record<string, never>) => {
  return { total_aum_trillion_usd: 8.2, dry_powder_trillion_usd: 2.6, fund_segments: Object.entries(FUND_SIZES).map(([k, v]) => ({ segment: k, ...v })), global_deal_count_2023: 35000 }
}, { method: 'get_market_overview' })

const calculateMoic = sg.wrap(async (args: { invested: number; returned: number; unrealized?: number }) => {
  if (!Number.isFinite(args.invested) || args.invested <= 0) throw new Error('invested (positive number) required')
  const total = (args.returned ?? 0) + (args.unrealized ?? 0)
  const moic = total / args.invested
  return { invested: args.invested, returned: args.returned ?? 0, unrealized: args.unrealized ?? 0, total_value: total, moic: Math.round(moic * 100) / 100, dpi: Math.round((args.returned ?? 0) / args.invested * 100) / 100 }
}, { method: 'calculate_moic' })

export { getMetric, getMarketOverview, calculateMoic }
console.log('settlegrid-private-equity MCP server ready | Powered by SettleGrid')
