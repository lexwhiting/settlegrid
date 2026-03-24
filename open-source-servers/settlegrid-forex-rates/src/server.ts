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
const sg = settlegrid.init({ toolSlug: 'forex-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRates(base?: string, symbols?: string): Promise<RatesResponse> {
  return sg.wrap('get_rates', async () => {
    const params = new URLSearchParams()
    if (base) params.set('from', validateCurrencyCode(base))
    if (symbols) {
      const validated = symbols.split(',').map(s => validateCurrencyCode(s)).join(',')
      params.set('to', validated)
    }
    const qs = params.toString()
    return fetchJSON<RatesResponse>(`${API}/latest${qs ? '?' + qs : ''}`)
  })
}

async function convert(from: string, to: string, amount: number): Promise<ConvertResult> {
  const fromCode = validateCurrencyCode(from)
  const toCode = validateCurrencyCode(to)
  if (typeof amount !== 'number' || amount <= 0) throw new Error('Amount must be a positive number')
  if (fromCode === toCode) throw new Error('Source and target currencies must be different')
  return sg.wrap('convert', async () => {
    const data = await fetchJSON<RatesResponse>(
      `${API}/latest?from=${fromCode}&to=${toCode}`
    )
    const rate = data.rates[toCode]
    if (!rate) throw new Error(`No rate found for ${toCode}`)
    return { from: fromCode, to: toCode, amount, result: Math.round(amount * rate * 100) / 100, rate, date: data.date }
  })
}

async function getHistorical(date: string, base?: string): Promise<RatesResponse> {
  const validDate = validateDate(date)
  return sg.wrap('get_historical', async () => {
    const params = base ? `?from=${validateCurrencyCode(base)}` : ''
    return fetchJSON<RatesResponse>(`${API}/${validDate}${params}`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRates, convert, getHistorical, SUPPORTED_CURRENCIES }
export type { RatesResponse, ConvertResult, CurrencyInfo }
console.log('settlegrid-forex-rates server started')
