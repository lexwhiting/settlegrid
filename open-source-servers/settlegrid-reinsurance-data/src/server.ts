/**
 * settlegrid-reinsurance-data — Reinsurance Market Data MCP Server
 *
 * Reinsurance Market Data tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const MARKETS: Record<string, { premium_billion_usd: number; combined_ratio: number; cat_losses_billion: number; roi_pct: number }> = {
  global: { premium_billion_usd: 370, combined_ratio: 95.2, cat_losses_billion: 100, roi_pct: 12.5 },
  property_cat: { premium_billion_usd: 45, combined_ratio: 88, cat_losses_billion: 65, roi_pct: 18.2 },
  casualty: { premium_billion_usd: 120, combined_ratio: 98.5, cat_losses_billion: 8, roi_pct: 9.8 },
  specialty: { premium_billion_usd: 85, combined_ratio: 92.1, cat_losses_billion: 12, roi_pct: 14.1 },
  life_health: { premium_billion_usd: 120, combined_ratio: 97.8, cat_losses_billion: 15, roi_pct: 8.5 },
}

const TOP_REINSURERS = [
  { name: 'Munich Re', country: 'Germany', premium_billion_usd: 45.2, rating: 'AA-' },
  { name: 'Swiss Re', country: 'Switzerland', premium_billion_usd: 36.8, rating: 'AA-' },
  { name: 'Hannover Re', country: 'Germany', premium_billion_usd: 28.5, rating: 'AA-' },
  { name: 'SCOR', country: 'France', premium_billion_usd: 19.2, rating: 'AA-' },
  { name: 'Berkshire Hathaway Re', country: 'US', premium_billion_usd: 18.5, rating: 'AA+' },
  { name: 'China Re', country: 'China', premium_billion_usd: 15.8, rating: 'A' },
]

const sg = settlegrid.init({ toolSlug: 'reinsurance-data', pricing: { defaultCostCents: 2, methods: {
  get_market: { costCents: 2, displayName: 'Get Market Data' },
  list_reinsurers: { costCents: 2, displayName: 'List Top Reinsurers' },
}}})

const getMarket = sg.wrap(async (args: { segment: string }) => {
  if (!args.segment) throw new Error('segment required')
  const m = MARKETS[args.segment.toLowerCase().replace(/ /g, '_')]
  if (!m) throw new Error(`Unknown segment. Available: ${Object.keys(MARKETS).join(', ')}`)
  return { segment: args.segment, ...m }
}, { method: 'get_market' })

const listReinsurers = sg.wrap(async (_a: Record<string, never>) => {
  return { reinsurers: TOP_REINSURERS, count: TOP_REINSURERS.length, total_premium: TOP_REINSURERS.reduce((s, r) => s + r.premium_billion_usd, 0) }
}, { method: 'list_reinsurers' })

export { getMarket, listReinsurers }
console.log('settlegrid-reinsurance-data MCP server ready | Powered by SettleGrid')
