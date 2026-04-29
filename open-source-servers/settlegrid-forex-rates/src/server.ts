/**
 * settlegrid-forex-rates — Forex Exchange Rates MCP Server
 * Wraps the Frankfurter API with SettleGrid billing.
 *
 * Frankfurter is a free, open-source API for current and historical
 * foreign exchange rates published by the European Central Bank.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface RatesResponse {
  base: string
  date: string
  rates: Record<string, number>
}

interface ConvertResult {
  from: string
  to: string
  amount: number
  result: number
  rate: number
  date: string
}

interface CurrencyInfo {
  code: string
  name: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.frankfurter.app'

const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar' }, { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' }, { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' }, { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' }, { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'SEK', name: 'Swedish Krona' }, { code: 'NZD', name: 'New Zealand Dollar' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateCurrencyCode(code: string): string {
  const upper = code.trim().toUpperCase()
  if (upper.length !== 3) throw new Error(`Invalid currency code: ${code}. Must be 3 letters.`)
  return upper
}

function validateDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD.`)
  }
  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) throw new Error(`Invalid date: ${date}`)
  return date
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Frankfurter API error: ${res.status} ${res.statusText} ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({
  toolSlug: 'forex-rates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_rates: { costCents: 1, displayName: 'Get Rates' },
      convert: { costCents: 1, displayName: 'Convert Currency' },
      get_historical: { costCents: 1, displayName: 'Historical Rates' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

interface GetRatesInput { base?: string; symbols?: string }
interface ConvertInput { from: string; to: string; amount: number }
interface GetHistoricalInput { date: string; base?: string }

const getRates = sg.wrap(async (args: GetRatesInput) => {
  const params = new URLSearchParams()
  if (args.base) params.set('from', validateCurrencyCode(args.base))
  if (args.symbols) {
    const validated = args.symbols.split(',').map(s => validateCurrencyCode(s)).join(',')
    params.set('to', validated)
  }
  const qs = params.toString()
  return fetchJSON<RatesResponse>(`${API}/latest${qs ? '?' + qs : ''}`)
}, { method: 'get_rates' })

const convert = sg.wrap(async (args: ConvertInput) => {
  const fromCode = validateCurrencyCode(args.from)
  const toCode = validateCurrencyCode(args.to)
  if (typeof args.amount !== 'number' || args.amount <= 0) throw new Error('Amount must be a positive number')
  if (fromCode === toCode) throw new Error('Source and target currencies must be different')
  const data = await fetchJSON<RatesResponse>(
    `${API}/latest?from=${fromCode}&to=${toCode}`
  )
  const rate = data.rates[toCode]
  if (!rate) throw new Error(`No rate found for ${toCode}`)
  return { from: fromCode, to: toCode, amount: args.amount, result: Math.round(args.amount * rate * 100) / 100, rate, date: data.date }
}, { method: 'convert' })

const getHistorical = sg.wrap(async (args: GetHistoricalInput) => {
  const validDate = validateDate(args.date)
  const params = args.base ? `?from=${validateCurrencyCode(args.base)}` : ''
  return fetchJSON<RatesResponse>(`${API}/${validDate}${params}`)
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRates, convert, getHistorical, SUPPORTED_CURRENCIES }
export type { RatesResponse, ConvertResult, CurrencyInfo }
console.log('settlegrid-forex-rates server started')
