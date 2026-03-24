/**
 * settlegrid-currency-convert — Currency Converter MCP Server
 *
 * Wraps ExchangeRate-API with SettleGrid billing.
 * No API key needed for free tier.
 *
 * Methods:
 *   convert_currency(from, to, amount) — convert (1¢)
 *   list_exchange_rates(base) — all rates (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ConvertInput { from: string; to: string; amount: number }
interface RatesInput { base: string }

const API_BASE = 'https://open.er-api.com/v6'

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'currency-convert',
  pricing: { defaultCostCents: 1, methods: { convert_currency: { costCents: 1, displayName: 'Convert Currency' }, list_exchange_rates: { costCents: 1, displayName: 'Exchange Rates' } } },
})

const convertCurrency = sg.wrap(async (args: ConvertInput) => {
  if (!args.from || !args.to || typeof args.amount !== 'number') throw new Error('from, to, and amount are required')
  const data = await apiFetch<any>(`/latest/${args.from.toUpperCase()}`)
  if (data.result !== 'success') throw new Error('Failed to fetch rates')
  const rate = data.rates?.[args.to.toUpperCase()]
  if (!rate) throw new Error(`Currency ${args.to} not found`)
  return {
    from: args.from.toUpperCase(), to: args.to.toUpperCase(),
    amount: args.amount, rate, converted: Math.round(args.amount * rate * 100) / 100,
    last_updated: data.time_last_update_utc,
  }
}, { method: 'convert_currency' })

const listExchangeRates = sg.wrap(async (args: RatesInput) => {
  if (!args.base) throw new Error('base currency is required')
  const data = await apiFetch<any>(`/latest/${args.base.toUpperCase()}`)
  if (data.result !== 'success') throw new Error('Failed to fetch rates')
  return { base: args.base.toUpperCase(), last_updated: data.time_last_update_utc, rates: data.rates }
}, { method: 'list_exchange_rates' })

export { convertCurrency, listExchangeRates }

console.log('settlegrid-currency-convert MCP server ready')
console.log('Methods: convert_currency, list_exchange_rates')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
