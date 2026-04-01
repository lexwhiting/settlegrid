/**
 * settlegrid-postal-rates — Postal Rate Calculator MCP Server
 *
 * Postal Rate Calculator tools with SettleGrid billing.
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface CalcInput { weight_kg: number; from_country?: string; to_country?: string; service?: string }

const RATES: Record<string, { base_usd: number; per_kg_usd: number; max_days: number }> = {
  standard_domestic: { base_usd: 0.63, per_kg_usd: 1.20, max_days: 7 },
  priority_domestic: { base_usd: 3.50, per_kg_usd: 2.50, max_days: 3 },
  express_domestic: { base_usd: 8.00, per_kg_usd: 4.00, max_days: 1 },
  standard_international: { base_usd: 5.00, per_kg_usd: 8.50, max_days: 21 },
  priority_international: { base_usd: 15.00, per_kg_usd: 12.00, max_days: 10 },
  express_international: { base_usd: 30.00, per_kg_usd: 18.00, max_days: 5 },
}

const sg = settlegrid.init({ toolSlug: 'postal-rates', pricing: { defaultCostCents: 1, methods: {
  calculate_rate: { costCents: 1, displayName: 'Calculate Rate' },
  list_services: { costCents: 1, displayName: 'List Services' },
}}})

const calculateRate = sg.wrap(async (args: CalcInput) => {
  if (!Number.isFinite(args.weight_kg) || args.weight_kg <= 0) throw new Error('weight_kg required (positive number)')
  if (args.weight_kg > 30) throw new Error('Maximum weight is 30 kg')
  const isInternational = args.to_country && args.from_country && args.to_country.toLowerCase() !== args.from_country.toLowerCase()
  const suffix = isInternational ? '_international' : '_domestic'
  const service = (args.service ?? 'standard').toLowerCase() + suffix
  const rate = RATES[service]
  if (!rate) throw new Error(`Unknown service. Available: standard, priority, express`)
  const cost = rate.base_usd + rate.per_kg_usd * args.weight_kg
  return { weight_kg: args.weight_kg, service: args.service ?? 'standard', type: isInternational ? 'international' : 'domestic', estimated_cost_usd: Math.round(cost * 100) / 100, estimated_days: rate.max_days, from: args.from_country ?? 'US', to: args.to_country ?? args.from_country ?? 'US' }
}, { method: 'calculate_rate' })

const listServices = sg.wrap(async (_a: Record<string, never>) => {
  return { services: Object.entries(RATES).map(([key, r]) => ({ service: key, ...r })), count: Object.keys(RATES).length }
}, { method: 'list_services' })

export { calculateRate, listServices }
console.log('settlegrid-postal-rates MCP server ready | Powered by SettleGrid')
