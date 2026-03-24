/**
 * settlegrid-mortgage-rates — Mortgage Rates MCP Server
 *
 * US Treasury rates and fiscal data for mortgage rate tracking.
 *
 * Methods:
 *   get_treasury_rates()          — Get recent Treasury yield curve rates  (1¢)
 *   get_debt_data()               — Get public debt outstanding data  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetTreasuryRatesInput {

}

interface GetDebtDataInput {

}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-mortgage-rates/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Mortgage Rates API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mortgage-rates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_treasury_rates: { costCents: 1, displayName: 'Treasury Rates' },
      get_debt_data: { costCents: 1, displayName: 'Get Debt Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTreasuryRates = sg.wrap(async (args: GetTreasuryRatesInput) => {

  const data = await apiFetch<any>(`/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        record_date: item.record_date,
        security_desc: item.security_desc,
        avg_interest_rate_amt: item.avg_interest_rate_amt,
    })),
  }
}, { method: 'get_treasury_rates' })

const getDebtData = sg.wrap(async (args: GetDebtDataInput) => {

  const data = await apiFetch<any>(`/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=10`)
  const items = (data.data ?? []).slice(0, 10)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        record_date: item.record_date,
        tot_pub_debt_out_amt: item.tot_pub_debt_out_amt,
        intragov_hold_amt: item.intragov_hold_amt,
    })),
  }
}, { method: 'get_debt_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTreasuryRates, getDebtData }

console.log('settlegrid-mortgage-rates MCP server ready')
console.log('Methods: get_treasury_rates, get_debt_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
