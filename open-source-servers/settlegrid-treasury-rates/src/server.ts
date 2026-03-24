/**
 * settlegrid-treasury-rates — US Treasury Rates MCP Server
 *
 * Wraps the US Treasury Fiscal Data API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_treasury_rates()        — Treasury yield rates      (1¢)
 *   get_debt_to_penny()         — National debt total       (1¢)
 *   get_avg_interest_rates()    — Avg interest on debt      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

// (no input types — all are parameterless or simple)

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'
const UA = 'settlegrid-treasury-rates/1.0 (contact@settlegrid.ai)'

async function trFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Treasury API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'treasury-rates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_treasury_rates: { costCents: 1, displayName: 'Treasury Yields' },
      get_debt_to_penny: { costCents: 1, displayName: 'National Debt' },
      get_avg_interest_rates: { costCents: 1, displayName: 'Avg Interest Rates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTreasuryRates = sg.wrap(async () => {
  const data = await trFetch<{ data: Array<Record<string, string>> }>(
    '/v2/accounting/od/avg_interest_rates',
    { sort: '-record_date', 'page[size]': '20' }
  )
  return { count: data.data.length, rates: data.data }
}, { method: 'get_treasury_rates' })

const getDebtToPenny = sg.wrap(async () => {
  const data = await trFetch<{ data: Array<Record<string, string>> }>(
    '/v2/accounting/od/debt_to_penny',
    { sort: '-record_date', 'page[size]': '5' }
  )
  return { count: data.data.length, records: data.data }
}, { method: 'get_debt_to_penny' })

const getAvgInterestRates = sg.wrap(async () => {
  const data = await trFetch<{ data: Array<Record<string, string>> }>(
    '/v2/accounting/od/avg_interest_rates',
    { sort: '-record_date', 'page[size]': '20', 'filter': 'security_type_desc:eq:Treasury Bills' }
  )
  return { count: data.data.length, rates: data.data }
}, { method: 'get_avg_interest_rates' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTreasuryRates, getDebtToPenny, getAvgInterestRates }

console.log('settlegrid-treasury-rates MCP server ready')
console.log('Methods: get_treasury_rates, get_debt_to_penny, get_avg_interest_rates')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
