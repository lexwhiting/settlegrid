/**
 * settlegrid-ecb-rates — ECB Exchange & Interest Rates MCP Server
 *
 * Wraps the ECB Data Portal API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_exchange_rates(currency)   — Reference rates     (1¢)
 *   get_key_rates()                — Key interest rates  (1¢)
 *   get_hicp(country?)             — Consumer prices     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExRateInput { currency: string }
interface HicpInput { country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data-api.ecb.europa.eu/service/data'
const UA = 'settlegrid-ecb-rates/1.0 (contact@settlegrid.ai)'

async function ecbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ECB API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ecb-rates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_exchange_rates: { costCents: 1, displayName: 'Exchange Rates' },
      get_key_rates: { costCents: 1, displayName: 'Key Interest Rates' },
      get_hicp: { costCents: 1, displayName: 'Consumer Prices' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getExchangeRates = sg.wrap(async (args: ExRateInput) => {
  if (!args.currency || typeof args.currency !== 'string') {
    throw new Error('currency is required (e.g. "USD")')
  }
  const cur = args.currency.toUpperCase().trim()
  const data = await ecbFetch<Record<string, unknown>>(
    `/EXR/D.${cur}.EUR.SP00.A?lastNObservations=30`
  )
  return { currency: cur, baseCurrency: 'EUR', data }
}, { method: 'get_exchange_rates' })

const getKeyRates = sg.wrap(async () => {
  const data = await ecbFetch<Record<string, unknown>>(
    '/FM/B.U2.EUR.4F.KR.MRR_FR.LEV?lastNObservations=10'
  )
  return data
}, { method: 'get_key_rates' })

const getHicp = sg.wrap(async (args: HicpInput) => {
  const country = args.country ? args.country.toUpperCase().trim() : 'U2'
  const data = await ecbFetch<Record<string, unknown>>(
    `/ICP/M.${country}.N.000000.4.ANR?lastNObservations=12`
  )
  return { country, data }
}, { method: 'get_hicp' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getExchangeRates, getKeyRates, getHicp }

console.log('settlegrid-ecb-rates MCP server ready')
console.log('Methods: get_exchange_rates, get_key_rates, get_hicp')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
