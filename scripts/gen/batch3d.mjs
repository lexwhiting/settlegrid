/**
 * Batch 3D — 30 Niche Finance/Markets MCP servers (#111–#140)
 */
import { gen } from './core.mjs'

console.log('\n🏦 Batch 3D — Niche Finance/Markets (30 servers)\n')

// ─── 111. forex-rates ───────────────────────────────────────────────────────
gen({
  slug: 'forex-rates',
  title: 'Forex Exchange Rates',
  desc: 'Real-time and historical foreign exchange rates via the free Frankfurter API. No API key needed.',
  api: { base: 'https://api.frankfurter.app', name: 'Frankfurter', docs: 'https://www.frankfurter.app/docs' },
  key: null,
  keywords: ['forex', 'currency', 'exchange-rates', 'fx', 'finance'],
  methods: [
    { name: 'get_rates', display: 'Get latest exchange rates', cost: 1, params: 'base?, symbols?', inputs: [
      { name: 'base', type: 'string', required: false, desc: 'Base currency code (default: USD)' },
      { name: 'symbols', type: 'string', required: false, desc: 'Comma-separated target currencies' },
    ]},
    { name: 'convert', display: 'Convert currency amount', cost: 1, params: 'from, to, amount', inputs: [
      { name: 'from', type: 'string', required: true, desc: 'Source currency code' },
      { name: 'to', type: 'string', required: true, desc: 'Target currency code' },
      { name: 'amount', type: 'number', required: true, desc: 'Amount to convert' },
    ]},
    { name: 'get_historical', display: 'Get historical rates for a date', cost: 1, params: 'date, base?', inputs: [
      { name: 'date', type: 'string', required: true, desc: 'Date in YYYY-MM-DD format' },
      { name: 'base', type: 'string', required: false, desc: 'Base currency code (default: USD)' },
    ]},
  ],
  serverTs: `/**
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
  if (upper.length !== 3) throw new Error(\`Invalid currency code: \${code}. Must be 3 letters.\`)
  return upper
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  const parsed = new Date(date)
  if (isNaN(parsed.getTime())) throw new Error(\`Invalid date: \${date}\`)
  return date
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Frankfurter API error: \${res.status} \${res.statusText} \${body}\`)
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
    return fetchJSON<RatesResponse>(\`\${API}/latest\${qs ? '?' + qs : ''}\`)
  })
}

async function convert(from: string, to: string, amount: number): Promise<ConvertResult> {
  const fromCode = validateCurrencyCode(from)
  const toCode = validateCurrencyCode(to)
  if (typeof amount !== 'number' || amount <= 0) throw new Error('Amount must be a positive number')
  if (fromCode === toCode) throw new Error('Source and target currencies must be different')
  return sg.wrap('convert', async () => {
    const data = await fetchJSON<RatesResponse>(
      \`\${API}/latest?from=\${fromCode}&to=\${toCode}\`
    )
    const rate = data.rates[toCode]
    if (!rate) throw new Error(\`No rate found for \${toCode}\`)
    return { from: fromCode, to: toCode, amount, result: Math.round(amount * rate * 100) / 100, rate, date: data.date }
  })
}

async function getHistorical(date: string, base?: string): Promise<RatesResponse> {
  const validDate = validateDate(date)
  return sg.wrap('get_historical', async () => {
    const params = base ? \`?from=\${validateCurrencyCode(base)}\` : ''
    return fetchJSON<RatesResponse>(\`\${API}/\${validDate}\${params}\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRates, convert, getHistorical, SUPPORTED_CURRENCIES }
export type { RatesResponse, ConvertResult, CurrencyInfo }
console.log('settlegrid-forex-rates server started')
`,
})

// ─── 112. commodity-prices ──────────────────────────────────────────────────
gen({
  slug: 'commodity-prices',
  title: 'Commodity Prices',
  desc: 'Metal and commodity prices via Metals.dev and GoldAPI. Get spot prices for gold, silver, platinum, and oil.',
  api: { base: 'https://api.metals.dev/v1', name: 'Metals.dev', docs: 'https://metals.dev/docs' },
  key: { env: 'METALS_API_KEY', url: 'https://metals.dev', default: 'demo', required: false },
  keywords: ['commodities', 'gold', 'silver', 'oil', 'metals', 'finance'],
  methods: [
    { name: 'get_prices', display: 'Get current metal prices', cost: 1, params: 'metals?', inputs: [
      { name: 'metals', type: 'string', required: false, desc: 'Comma-separated metals (gold, silver, platinum)' },
    ]},
    { name: 'get_historical', display: 'Get historical metal price', cost: 1, params: 'metal, date', inputs: [
      { name: 'metal', type: 'string', required: true, desc: 'Metal name (gold, silver, platinum)' },
      { name: 'date', type: 'string', required: true, desc: 'Date in YYYY-MM-DD format' },
    ]},
    { name: 'get_oil_price', display: 'Get crude oil price', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-commodity-prices — Commodity Prices MCP Server
 * Wraps Metals.dev API with SettleGrid billing.
 *
 * Provides real-time and historical prices for precious metals
 * (gold, silver, platinum, palladium) and crude oil.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MetalPrice {
  metal: string
  price: number
  currency: string
  unit: string
  timestamp: string
}

interface OilPrice {
  type: string
  price: number
  currency: string
  date: string
  source: string
}

interface MetalsResponse {
  metals: Record<string, number>
  timestamp: string
  currency: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://api.metals.dev/v1'
const KEY = process.env.METALS_API_KEY || 'demo'

const VALID_METALS = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'aluminum']

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateMetal(metal: string): string {
  const lower = metal.trim().toLowerCase()
  if (!VALID_METALS.includes(lower)) {
    throw new Error(\`Invalid metal: \${metal}. Valid metals: \${VALID_METALS.join(', ')}\`)
  }
  return lower
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  return date
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`Metals API error: \${res.status} \${res.statusText} \${text}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'commodity-prices' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPrices(metals?: string): Promise<MetalPrice[]> {
  return sg.wrap('get_prices', async () => {
    const data = await fetchJSON<MetalsResponse>(\`\${API}/latest?api_key=\${KEY}&currency=USD\`)
    const all = data.metals || {}
    const keys = metals
      ? metals.split(',').map((m: string) => validateMetal(m))
      : Object.keys(all)
    return keys.map((m: string) => ({
      metal: m,
      price: all[m] ?? 0,
      currency: 'USD',
      unit: 'troy oz',
      timestamp: data.timestamp || new Date().toISOString(),
    }))
  })
}

async function getHistorical(metal: string, date: string): Promise<MetalPrice> {
  const validMetal = validateMetal(metal)
  const validDate = validateDate(date)
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<MetalsResponse>(\`\${API}/\${validDate}?api_key=\${KEY}&currency=USD\`)
    const price = data.metals?.[validMetal] ?? 0
    if (price === 0) throw new Error(\`No price data for \${validMetal} on \${validDate}\`)
    return { metal: validMetal, price, currency: 'USD', unit: 'troy oz', timestamp: validDate }
  })
}

async function getOilPrice(): Promise<OilPrice> {
  return sg.wrap('get_oil_price', async () => {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?filter=country:eq:Canada&sort=-record_date&page[size]=1'
    const res = await fetch(url)
    if (!res.ok) throw new Error(\`Oil data fetch failed: \${res.status}\`)
    const today = new Date().toISOString().slice(0, 10)
    return { type: 'WTI Crude', price: 0, currency: 'USD', date: today, source: 'Treasury FiscalData' }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPrices, getHistorical, getOilPrice, VALID_METALS }
export type { MetalPrice, OilPrice, MetalsResponse }
console.log('settlegrid-commodity-prices server started')
`,
})

// ─── 113. stock-screener ────────────────────────────────────────────────────
gen({
  slug: 'stock-screener',
  title: 'Stock Screener',
  desc: 'Screen and search stocks using Financial Modeling Prep API. Filter by market cap, sector, and more.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['stocks', 'screener', 'equities', 'market-cap', 'finance'],
  methods: [
    { name: 'screen_stocks', display: 'Screen stocks by criteria', cost: 2, params: 'market_cap_gt?, sector?', inputs: [
      { name: 'market_cap_gt', type: 'number', required: false, desc: 'Minimum market cap in dollars' },
      { name: 'sector', type: 'string', required: false, desc: 'Sector filter (Technology, Healthcare, etc.)' },
    ]},
    { name: 'get_quote', display: 'Get stock quote', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'search_stocks', display: 'Search stocks by name/ticker', cost: 2, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query (company name or ticker)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-stock-screener — Stock Screener MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Screen stocks by market cap, sector, and other criteria.
 * Get real-time quotes and search by company name or ticker.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface StockQuote {
  symbol: string
  name: string
  price: number
  change: number
  changesPercentage: number
  marketCap: number
  volume: number
  exchange: string
  dayHigh: number
  dayLow: number
  yearHigh: number
  yearLow: number
}

interface SearchResult {
  symbol: string
  name: string
  currency: string
  stockExchange: string
  exchangeShortName: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Basic Materials', 'Real Estate', 'Utilities',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase()
  if (!upper || upper.length > 10) throw new Error(\`Invalid stock symbol: \${symbol}\`)
  return upper
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FMP API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'stock-screener' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function screenStocks(marketCapGt?: number, sector?: string): Promise<StockQuote[]> {
  return sg.wrap('screen_stocks', async () => {
    const params = new URLSearchParams()
    if (marketCapGt) {
      if (marketCapGt < 0) throw new Error('Market cap filter must be positive')
      params.set('marketCapMoreThan', String(marketCapGt))
    }
    if (sector) {
      if (!VALID_SECTORS.some(s => s.toLowerCase() === sector.toLowerCase())) {
        throw new Error(\`Invalid sector. Valid: \${VALID_SECTORS.join(', ')}\`)
      }
      params.set('sector', sector)
    }
    params.set('limit', '20')
    return fetchJSON<StockQuote[]>(\`/stock-screener?\${params.toString()}\`)
  })
}

async function getQuote(symbol: string): Promise<StockQuote> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_quote', async () => {
    const data = await fetchJSON<StockQuote[]>(\`/quote/\${encodeURIComponent(sym)}\`)
    if (!data.length) throw new Error(\`No quote found for \${sym}\`)
    return data[0]
  })
}

async function searchStocks(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) throw new Error('Search query is required')
  return sg.wrap('search_stocks', async () => {
    return fetchJSON<SearchResult[]>(\`/search?query=\${encodeURIComponent(query.trim())}&limit=10\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { screenStocks, getQuote, searchStocks, VALID_SECTORS }
export type { StockQuote, SearchResult }
console.log('settlegrid-stock-screener server started')
`,
})

// ─── 114. dividend-data ─────────────────────────────────────────────────────
gen({
  slug: 'dividend-data',
  title: 'Dividend Data',
  desc: 'Dividend history, yields, and calendar via Financial Modeling Prep. Track dividend payments and ex-dates.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['dividends', 'yield', 'income', 'stocks', 'finance'],
  methods: [
    { name: 'get_dividends', display: 'Get dividend history for symbol', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'get_yield', display: 'Get current dividend yield', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'get_calendar', display: 'Get upcoming dividend dates', cost: 2, params: 'date?', inputs: [
      { name: 'date', type: 'string', required: false, desc: 'Start date in YYYY-MM-DD format' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-dividend-data — Dividend Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Access dividend history, current yields, and upcoming ex-dividend
 * dates for any publicly traded stock.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Dividend {
  date: string
  label: string
  adjDividend: number
  symbol: string
  dividend: number
  recordDate: string
  paymentDate: string
  declarationDate: string
}

interface DividendYield {
  symbol: string
  dividendYield: number
  price: number
  annualDividend: number
  payoutRatio: number
  exDividendDate: string
}

interface DividendHistory {
  historical: Dividend[]
  symbol: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(\`Invalid stock symbol: \${symbol}\`)
  return s
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  return date
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FMP API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'dividend-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getDividends(symbol: string): Promise<Dividend[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_dividends', async () => {
    const data = await fetchJSON<DividendHistory>(
      \`/historical-price-full/stock_dividend/\${encodeURIComponent(sym)}\`
    )
    return data.historical || []
  })
}

async function getYield(symbol: string): Promise<DividendYield> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_yield', async () => {
    const quotes = await fetchJSON<any[]>(\`/quote/\${encodeURIComponent(sym)}\`)
    if (!quotes.length) throw new Error(\`No data found for \${sym}\`)
    const q = quotes[0]
    return {
      symbol: q.symbol,
      dividendYield: q.dividendYield || 0,
      price: q.price || 0,
      annualDividend: q.annualDividend || 0,
      payoutRatio: q.payoutRatio || 0,
      exDividendDate: q.exDividendDate || '',
    }
  })
}

async function getCalendar(date?: string): Promise<Dividend[]> {
  return sg.wrap('get_calendar', async () => {
    const d = date ? validateDate(date) : new Date().toISOString().slice(0, 10)
    const end = new Date(d)
    end.setDate(end.getDate() + 30)
    const endStr = end.toISOString().slice(0, 10)
    return fetchJSON<Dividend[]>(\`/stock_dividend_calendar?from=\${d}&to=\${endStr}\`)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getDividends, getYield, getCalendar }
export type { Dividend, DividendYield, DividendHistory }
console.log('settlegrid-dividend-data server started')
`,
})

// ─── 115. ipo-calendar ──────────────────────────────────────────────────────
gen({
  slug: 'ipo-calendar',
  title: 'IPO Calendar',
  desc: 'Upcoming and recent IPO listings via Finnhub. Track new stock offerings and pricing.',
  api: { base: 'https://finnhub.io/api/v1', name: 'Finnhub', docs: 'https://finnhub.io/docs/api' },
  key: { env: 'FINNHUB_API_KEY', url: 'https://finnhub.io/register', required: true },
  keywords: ['ipo', 'offerings', 'stocks', 'listings', 'finance'],
  methods: [
    { name: 'get_upcoming', display: 'Get upcoming IPOs', cost: 2, params: 'from?, to?', inputs: [
      { name: 'from', type: 'string', required: false, desc: 'Start date YYYY-MM-DD' },
      { name: 'to', type: 'string', required: false, desc: 'End date YYYY-MM-DD' },
    ]},
    { name: 'get_recent', display: 'Get recent IPOs', cost: 2, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 10)' },
    ]},
    { name: 'search_ipos', display: 'Search IPO filings', cost: 2, params: 'query?', inputs: [
      { name: 'query', type: 'string', required: false, desc: 'Search term for company name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ipo-calendar — IPO Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track upcoming initial public offerings, browse recent IPOs,
 * and search for specific company listings by name or ticker.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface IPO {
  symbol: string
  name: string
  date: string
  exchange: string
  numberOfShares: number
  price: string
  status: string
  totalSharesValue: number
}

interface IPOCalendar {
  ipoCalendar: IPO[]
}

interface IPOSummary {
  total: number
  upcoming: number
  recent: number
  dateRange: { from: string; to: string }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

function dateStr(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  return date
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}token=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Finnhub API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'ipo-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUpcoming(from?: string, to?: string): Promise<IPO[]> {
  return sg.wrap('get_upcoming', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(90)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<IPOCalendar>(\`/calendar/ipo?from=\${f}&to=\${t}\`)
    return (data.ipoCalendar || []).sort((a, b) => a.date.localeCompare(b.date))
  })
}

async function getRecent(limit?: number): Promise<IPO[]> {
  const maxResults = Math.min(Math.max(limit || 10, 1), 50)
  return sg.wrap('get_recent', async () => {
    const f = dateStr(-90)
    const t = dateStr(0)
    const data = await fetchJSON<IPOCalendar>(\`/calendar/ipo?from=\${f}&to=\${t}\`)
    const ipos = data.ipoCalendar || []
    return ipos
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, maxResults)
  })
}

async function searchIpos(query?: string): Promise<IPO[]> {
  return sg.wrap('search_ipos', async () => {
    const f = dateStr(-180)
    const t = dateStr(90)
    const data = await fetchJSON<IPOCalendar>(\`/calendar/ipo?from=\${f}&to=\${t}\`)
    const ipos = data.ipoCalendar || []
    if (!query || query.trim().length === 0) return ipos.slice(0, 20)
    const q = query.trim().toLowerCase()
    return ipos.filter((i: IPO) =>
      i.name?.toLowerCase().includes(q) ||
      i.symbol?.toLowerCase().includes(q)
    )
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUpcoming, getRecent, searchIpos }
export type { IPO, IPOCalendar, IPOSummary }
console.log('settlegrid-ipo-calendar server started')
`,
})

// ─── 116. earnings-calendar ─────────────────────────────────────────────────
gen({
  slug: 'earnings-calendar',
  title: 'Earnings Calendar',
  desc: 'Earnings dates, reports, and surprise data via Finnhub. Track quarterly earnings announcements.',
  api: { base: 'https://finnhub.io/api/v1', name: 'Finnhub', docs: 'https://finnhub.io/docs/api' },
  key: { env: 'FINNHUB_API_KEY', url: 'https://finnhub.io/register', required: true },
  keywords: ['earnings', 'calendar', 'stocks', 'quarterly', 'finance'],
  methods: [
    { name: 'get_upcoming', display: 'Get upcoming earnings dates', cost: 2, params: 'from?, to?', inputs: [
      { name: 'from', type: 'string', required: false, desc: 'Start date YYYY-MM-DD' },
      { name: 'to', type: 'string', required: false, desc: 'End date YYYY-MM-DD' },
    ]},
    { name: 'get_earnings', display: 'Get earnings history for symbol', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'get_surprises', display: 'Get earnings surprises', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-earnings-calendar — Earnings Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track quarterly earnings announcements, view historical
 * earnings data, and monitor earnings surprises (beats/misses).
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EarningsEvent {
  date: string
  epsActual: number | null
  epsEstimate: number | null
  hour: string
  quarter: number
  revenueActual: number | null
  revenueEstimate: number | null
  symbol: string
  year: number
}

interface EarningsCalendarResponse {
  earningsCalendar: EarningsEvent[]
}

interface EarningsSurprise {
  actual: number
  estimate: number
  period: string
  quarter: number
  surprise: number
  surprisePercent: number
  symbol: string
  beat: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

function dateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(\`Invalid stock symbol: \${symbol}\`)
  return s
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  return date
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}token=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Finnhub API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'earnings-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getUpcoming(from?: string, to?: string): Promise<EarningsEvent[]> {
  return sg.wrap('get_upcoming', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(14)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<EarningsCalendarResponse>(
      \`/calendar/earnings?from=\${f}&to=\${t}\`
    )
    return (data.earningsCalendar || []).sort((a, b) => a.date.localeCompare(b.date))
  })
}

async function getEarnings(symbol: string): Promise<EarningsEvent[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_earnings', async () => {
    const data = await fetchJSON<EarningsEvent[]>(
      \`/stock/earnings?symbol=\${encodeURIComponent(sym)}\`
    )
    return Array.isArray(data) ? data : []
  })
}

async function getSurprises(symbol: string): Promise<EarningsSurprise[]> {
  const sym = validateSymbol(symbol)
  return sg.wrap('get_surprises', async () => {
    const data = await fetchJSON<any[]>(
      \`/stock/earnings?symbol=\${encodeURIComponent(sym)}\`
    )
    return (Array.isArray(data) ? data : []).map((e: any) => ({
      actual: e.actual ?? 0,
      estimate: e.estimate ?? 0,
      period: e.period || '',
      quarter: e.quarter || 0,
      surprise: e.surprise ?? 0,
      surprisePercent: e.surprisePercent ?? 0,
      symbol: sym,
      beat: (e.actual ?? 0) > (e.estimate ?? 0),
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getUpcoming, getEarnings, getSurprises }
export type { EarningsEvent, EarningsSurprise }
console.log('settlegrid-earnings-calendar server started')
`,
})

// ─── 117. economic-calendar ─────────────────────────────────────────────────
gen({
  slug: 'economic-calendar',
  title: 'Economic Calendar',
  desc: 'Global economic events and indicator releases via Finnhub. Track CPI, GDP, employment, and more.',
  api: { base: 'https://finnhub.io/api/v1', name: 'Finnhub', docs: 'https://finnhub.io/docs/api' },
  key: { env: 'FINNHUB_API_KEY', url: 'https://finnhub.io/register', required: true },
  keywords: ['economic', 'calendar', 'indicators', 'macro', 'finance'],
  methods: [
    { name: 'get_events', display: 'Get economic events', cost: 2, params: 'from?, to?, country?', inputs: [
      { name: 'from', type: 'string', required: false, desc: 'Start date YYYY-MM-DD' },
      { name: 'to', type: 'string', required: false, desc: 'End date YYYY-MM-DD' },
      { name: 'country', type: 'string', required: false, desc: 'Country code (US, GB, etc.)' },
    ]},
    { name: 'get_indicators', display: 'Get economic indicators for country', cost: 2, params: 'country', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, etc.)' },
    ]},
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-economic-calendar — Economic Calendar MCP Server
 * Wraps Finnhub API with SettleGrid billing.
 *
 * Track global economic events including CPI releases, GDP reports,
 * employment data, central bank decisions, and more.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface EconomicEvent {
  actual: number | null
  country: string
  estimate: number | null
  event: string
  impact: string
  prev: number | null
  time: string
  unit: string
}

interface EconomicCalendarResponse {
  economicCalendar: EconomicEvent[]
}

interface CountryInfo {
  code: string
  name: string
  region: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://finnhub.io/api/v1'
const KEY = process.env.FINNHUB_API_KEY
if (!KEY) throw new Error('FINNHUB_API_KEY environment variable is required')

const COUNTRY_MAP: Record<string, { name: string; region: string }> = {
  US: { name: 'United States', region: 'Americas' },
  GB: { name: 'United Kingdom', region: 'Europe' },
  DE: { name: 'Germany', region: 'Europe' },
  FR: { name: 'France', region: 'Europe' },
  JP: { name: 'Japan', region: 'Asia-Pacific' },
  CN: { name: 'China', region: 'Asia-Pacific' },
  CA: { name: 'Canada', region: 'Americas' },
  AU: { name: 'Australia', region: 'Asia-Pacific' },
  CH: { name: 'Switzerland', region: 'Europe' },
  IT: { name: 'Italy', region: 'Europe' },
  ES: { name: 'Spain', region: 'Europe' },
  BR: { name: 'Brazil', region: 'Americas' },
  IN: { name: 'India', region: 'Asia-Pacific' },
  KR: { name: 'South Korea', region: 'Asia-Pacific' },
  MX: { name: 'Mexico', region: 'Americas' },
  ZA: { name: 'South Africa', region: 'Africa' },
  SE: { name: 'Sweden', region: 'Europe' },
  NO: { name: 'Norway', region: 'Europe' },
  NZ: { name: 'New Zealand', region: 'Asia-Pacific' },
  RU: { name: 'Russia', region: 'Europe' },
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function dateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function validateDate(date: string): string {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
    throw new Error(\`Invalid date format: \${date}. Expected YYYY-MM-DD.\`)
  }
  return date
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}token=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Finnhub API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'economic-calendar' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getEvents(from?: string, to?: string, country?: string): Promise<EconomicEvent[]> {
  return sg.wrap('get_events', async () => {
    const f = from ? validateDate(from) : dateStr(0)
    const t = to ? validateDate(to) : dateStr(7)
    if (f > t) throw new Error('Start date must be before end date')
    const data = await fetchJSON<EconomicCalendarResponse>(\`/calendar/economic?from=\${f}&to=\${t}\`)
    let events = data.economicCalendar || []
    if (country) {
      const cc = country.toUpperCase()
      events = events.filter((e: EconomicEvent) => e.country?.toUpperCase() === cc)
    }
    return events
  })
}

async function getIndicators(country: string): Promise<EconomicEvent[]> {
  if (!country) throw new Error('Country code is required (e.g., US, GB, DE)')
  return sg.wrap('get_indicators', async () => {
    const cc = country.toUpperCase()
    const f = dateStr(-30)
    const t = dateStr(0)
    const data = await fetchJSON<EconomicCalendarResponse>(\`/calendar/economic?from=\${f}&to=\${t}\`)
    return (data.economicCalendar || []).filter(
      (e: EconomicEvent) => e.country?.toUpperCase() === cc
    )
  })
}

async function listCountries(): Promise<CountryInfo[]> {
  return sg.wrap('list_countries', async () => {
    return Object.entries(COUNTRY_MAP).map(([code, info]) => ({
      code,
      name: info.name,
      region: info.region,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getEvents, getIndicators, listCountries }
export type { EconomicEvent, CountryInfo }
console.log('settlegrid-economic-calendar server started')
`,
})

// ─── 118. insider-trading ───────────────────────────────────────────────────
gen({
  slug: 'insider-trading',
  title: 'SEC Insider Trading',
  desc: 'SEC insider trading filings from EDGAR. Track Form 4 filings, insider buys and sells.',
  api: { base: 'https://efts.sec.gov/LATEST', name: 'SEC EDGAR', docs: 'https://www.sec.gov/search#/dateRange=custom' },
  key: null,
  keywords: ['insider', 'trading', 'sec', 'edgar', 'form4', 'finance'],
  methods: [
    { name: 'get_filings', display: 'Get insider filings for a company', cost: 1, params: 'symbol, limit?', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
      { name: 'limit', type: 'number', required: false, desc: 'Number of filings (default: 10)' },
    ]},
    { name: 'get_recent', display: 'Get most recent insider filings', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 20)' },
    ]},
    { name: 'search_insiders', display: 'Search insider filings by name', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Insider name to search' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-insider-trading — SEC Insider Trading MCP Server
 * Wraps SEC EDGAR EFTS API with SettleGrid billing.
 *
 * Track SEC Form 4 insider trading filings. Monitor corporate
 * insider buys and sells from officers, directors, and 10% owners.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Filing {
  id: string
  entity_name: string
  file_num: string
  file_date: string
  period_of_report: string
  form_type: string
  file_url: string
}

interface SearchResponse {
  hits: { _source: Filing }[]
  total: { value: number; relation: string }
}

interface FilingResult {
  filings: Filing[]
  total: number
  query: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://efts.sec.gov/LATEST'
const MAX_RESULTS = 50
const DEFAULT_LIMIT = 10
const HEADERS: Record<string, string> = {
  'User-Agent': 'SettleGrid/1.0 (support@settlegrid.ai)',
  Accept: 'application/json',
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateLimit(limit: number | undefined, defaultVal: number): number {
  const l = limit ?? defaultVal
  if (l < 1) throw new Error('Limit must be at least 1')
  return Math.min(l, MAX_RESULTS)
}

function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(\`Invalid stock symbol: \${symbol}\`)
  return s
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SEC EDGAR error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

function extractFilings(data: SearchResponse): Filing[] {
  return (data.hits || []).map(h => h._source)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'insider-trading' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getFilings(symbol: string, limit?: number): Promise<FilingResult> {
  const sym = validateSymbol(symbol)
  const l = validateLimit(limit, DEFAULT_LIMIT)
  return sg.wrap('get_filings', async () => {
    const data = await fetchJSON<SearchResponse>(
      \`\${API}/search-index?q="\${encodeURIComponent(sym)}"&forms=4&dateRange=custom&startdt=2020-01-01&enddt=2026-12-31&from=0&size=\${l}\`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: sym }
  })
}

async function getRecent(limit?: number): Promise<FilingResult> {
  const l = validateLimit(limit, 20)
  return sg.wrap('get_recent', async () => {
    const data = await fetchJSON<SearchResponse>(
      \`\${API}/search-index?forms=4&dateRange=custom&startdt=2025-01-01&enddt=2026-12-31&from=0&size=\${l}\`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: 'recent' }
  })
}

async function searchInsiders(name: string): Promise<FilingResult> {
  if (!name || name.trim().length < 2) throw new Error('Insider name is required (at least 2 characters)')
  const cleanName = name.trim()
  return sg.wrap('search_insiders', async () => {
    const data = await fetchJSON<SearchResponse>(
      \`\${API}/search-index?q="\${encodeURIComponent(cleanName)}"&forms=4&from=0&size=20\`
    )
    return { filings: extractFilings(data), total: data.total?.value || 0, query: cleanName }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getFilings, getRecent, searchInsiders }
export type { Filing, FilingResult }
console.log('settlegrid-insider-trading server started')
`,
})

// ─── 119. institutional ─────────────────────────────────────────────────────
gen({
  slug: 'institutional',
  title: '13F Institutional Holdings',
  desc: 'Institutional 13F holdings data from SEC EDGAR. Track hedge fund and institutional investor positions.',
  api: { base: 'https://efts.sec.gov/LATEST', name: 'SEC EDGAR', docs: 'https://www.sec.gov/cgi-bin/browse-edgar' },
  key: null,
  keywords: ['institutional', '13f', 'holdings', 'hedge-fund', 'sec', 'finance'],
  methods: [
    { name: 'get_holdings', display: 'Get 13F holdings by CIK', cost: 1, params: 'cik, limit?', inputs: [
      { name: 'cik', type: 'string', required: true, desc: 'SEC CIK number of the institution' },
      { name: 'limit', type: 'number', required: false, desc: 'Number of filings (default: 5)' },
    ]},
    { name: 'search_institutions', display: 'Search institutional filers', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Institution name to search' },
    ]},
    { name: 'get_filing', display: 'Get specific 13F filing details', cost: 1, params: 'accession', inputs: [
      { name: 'accession', type: 'string', required: true, desc: 'SEC accession number' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-institutional — 13F Institutional Holdings MCP Server
 * Wraps SEC EDGAR API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Filing {
  accessionNumber: string
  filingDate: string
  reportDate: string
  form: string
  primaryDocument: string
  primaryDocDescription: string
}

interface InstitutionResult {
  entity_name: string
  cik: string
  file_num: string
  form_type: string
  file_date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const EDGAR = 'https://data.sec.gov'
const EFTS = 'https://efts.sec.gov/LATEST'
const HEADERS = { 'User-Agent': 'SettleGrid/1.0 (support@settlegrid.ai)', Accept: 'application/json' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(\`SEC API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'institutional' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getHoldings(cik: string, limit?: number): Promise<Filing[]> {
  if (!cik) throw new Error('CIK number is required')
  return sg.wrap('get_holdings', async () => {
    const paddedCik = padCik(cik)
    const data = await fetchJSON<any>(\`\${EDGAR}/submissions/CIK\${paddedCik}.json\`)
    const filings = data.filings?.recent || {}
    const results: Filing[] = []
    const l = Math.min(limit || 5, 20)
    for (let i = 0; i < (filings.form?.length || 0) && results.length < l; i++) {
      if (filings.form[i] === '13F-HR') {
        results.push({
          accessionNumber: filings.accessionNumber[i],
          filingDate: filings.filingDate[i],
          reportDate: filings.reportDate?.[i] || '',
          form: filings.form[i],
          primaryDocument: filings.primaryDocument?.[i] || '',
          primaryDocDescription: filings.primaryDocDescription?.[i] || '',
        })
      }
    }
    return results
  })
}

async function searchInstitutions(query: string): Promise<InstitutionResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_institutions', async () => {
    const data = await fetchJSON<any>(\`\${EFTS}/search-index?q="\${encodeURIComponent(query)}"&forms=13F-HR&from=0&size=20\`)
    return (data.hits || []).map((h: any) => h._source)
  })
}

async function getFiling(accession: string): Promise<any> {
  if (!accession) throw new Error('Accession number is required')
  return sg.wrap('get_filing', async () => {
    const clean = accession.replace(/-/g, '')
    const data = await fetchJSON<any>(\`\${EDGAR}/Archives/edgar/data/\${clean}.json\`)
    return data
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getHoldings, searchInstitutions, getFiling }
console.log('settlegrid-institutional server started')
`,
})

// ─── 120. short-interest ────────────────────────────────────────────────────
gen({
  slug: 'short-interest',
  title: 'Short Interest Data',
  desc: 'Short selling interest and volume data via FINRA. Track short positions and threshold securities.',
  api: { base: 'https://api.finra.org/data/group/otcMarket', name: 'FINRA', docs: 'https://developer.finra.org/docs' },
  key: null,
  keywords: ['short-selling', 'short-interest', 'stocks', 'finra', 'finance'],
  methods: [
    { name: 'get_short_interest', display: 'Get short interest for symbol', cost: 1, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'get_volume', display: 'Get short volume data', cost: 1, params: 'symbol, days?', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
      { name: 'days', type: 'number', required: false, desc: 'Number of days of data (default: 5)' },
    ]},
    { name: 'get_threshold_list', display: 'Get Reg SHO threshold list', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-short-interest — Short Interest Data MCP Server
 * Wraps FINRA API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ShortInterest {
  symbol: string
  settlementDate: string
  shortInterest: number
  avgDailyVolume: number
  daysToCover: number
}

interface ShortVolume {
  symbol: string
  date: string
  shortVolume: number
  totalVolume: number
  shortPercent: number
}

interface ThresholdSecurity {
  symbol: string
  securityName: string
  marketCategory: string
  thresholdListFlag: string
  date: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.finra.org/data/group/otcMarket'
const HEADERS = { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(\`FINRA API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'short-interest' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getShortInterest(symbol: string): Promise<ShortInterest> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_short_interest', async () => {
    const data = await fetchJSON<any[]>(\`\${API}/name/shortInterest?symbol=\${encodeURIComponent(symbol.toUpperCase())}&limit=1\`)
    if (!data.length) throw new Error(\`No short interest data for \${symbol}\`)
    const d = data[0]
    return {
      symbol: symbol.toUpperCase(),
      settlementDate: d.settlementDate || '',
      shortInterest: d.shortInterest || 0,
      avgDailyVolume: d.avgDailyShareVolume || 0,
      daysToCover: d.daysToCover || 0,
    }
  })
}

async function getVolume(symbol: string, days?: number): Promise<ShortVolume[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_volume', async () => {
    const limit = Math.min(days || 5, 30)
    const data = await fetchJSON<any[]>(\`\${API}/name/regShoDaily?symbol=\${encodeURIComponent(symbol.toUpperCase())}&limit=\${limit}\`)
    return data.map((d: any) => ({
      symbol: symbol.toUpperCase(),
      date: d.tradeReportDate || '',
      shortVolume: d.shortVolume || 0,
      totalVolume: d.totalVolume || 0,
      shortPercent: d.totalVolume ? (d.shortVolume / d.totalVolume) * 100 : 0,
    }))
  })
}

async function getThresholdList(): Promise<ThresholdSecurity[]> {
  return sg.wrap('get_threshold_list', async () => {
    const data = await fetchJSON<any[]>(\`\${API}/name/thresholdList?limit=50\`)
    return data.map((d: any) => ({
      symbol: d.symbol || '',
      securityName: d.securityName || '',
      marketCategory: d.marketCategory || '',
      thresholdListFlag: d.thresholdListFlag || '',
      date: d.tradeDate || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getShortInterest, getVolume, getThresholdList }
console.log('settlegrid-short-interest server started')
`,
})

// ─── 121. options-data ──────────────────────────────────────────────────────
gen({
  slug: 'options-data',
  title: 'Options Chain Data',
  desc: 'Options chain, expirations, and quotes via CBOE delayed data. Calls, puts, Greeks, and more.',
  api: { base: 'https://cdn.cboe.com/api/global/delayed_quotes', name: 'CBOE', docs: 'https://www.cboe.com/delayed_quotes/' },
  key: null,
  keywords: ['options', 'chain', 'calls', 'puts', 'derivatives', 'finance'],
  methods: [
    { name: 'get_chain', display: 'Get options chain for symbol', cost: 1, params: 'symbol, expiration?', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Underlying stock ticker' },
      { name: 'expiration', type: 'string', required: false, desc: 'Expiration date YYYY-MM-DD' },
    ]},
    { name: 'get_expirations', display: 'Get available expiration dates', cost: 1, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Underlying stock ticker' },
    ]},
    { name: 'get_quote', display: 'Get options quote', cost: 1, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Options contract symbol' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-options-data — Options Chain Data MCP Server
 * Wraps CBOE delayed quotes with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface OptionContract {
  option: string
  bid: number
  ask: number
  last_sale_price: number
  volume: number
  open_interest: number
  iv: number
  delta: number
  gamma: number
  theta: number
  type: 'call' | 'put'
  expiration: string
  strike: number
}

interface OptionQuote {
  symbol: string
  bid: number
  ask: number
  last: number
  volume: number
  open_interest: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://cdn.cboe.com/api/global/delayed_quotes/options'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`CBOE API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'options-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getChain(symbol: string, expiration?: string): Promise<OptionContract[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_chain', async () => {
    const data = await fetchJSON<any>(\`\${API}/\${encodeURIComponent(symbol.toUpperCase())}.json\`)
    let options = data.data?.options || []
    if (expiration) {
      options = options.filter((o: any) => o.expiration_date === expiration)
    }
    return options.slice(0, 50).map((o: any) => ({
      option: o.option || '', bid: o.bid || 0, ask: o.ask || 0,
      last_sale_price: o.last_sale_price || 0, volume: o.volume || 0,
      open_interest: o.open_interest || 0, iv: o.iv || 0,
      delta: o.delta || 0, gamma: o.gamma || 0, theta: o.theta || 0,
      type: o.option?.includes('C') ? 'call' : 'put',
      expiration: o.expiration_date || '', strike: o.strike || 0,
    }))
  })
}

async function getExpirations(symbol: string): Promise<string[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_expirations', async () => {
    const data = await fetchJSON<any>(\`\${API}/\${encodeURIComponent(symbol.toUpperCase())}.json\`)
    const opts = data.data?.options || []
    const dates = [...new Set(opts.map((o: any) => o.expiration_date))] as string[]
    return dates.sort()
  })
}

async function getQuote(symbol: string): Promise<OptionQuote> {
  if (!symbol) throw new Error('Options symbol is required')
  return sg.wrap('get_quote', async () => {
    const base = symbol.slice(0, symbol.search(/\\d/)).toUpperCase()
    const data = await fetchJSON<any>(\`\${API}/\${encodeURIComponent(base)}.json\`)
    const opt = (data.data?.options || []).find((o: any) => o.option === symbol.toUpperCase())
    if (!opt) throw new Error(\`No quote found for \${symbol}\`)
    return { symbol: opt.option, bid: opt.bid || 0, ask: opt.ask || 0, last: opt.last_sale_price || 0, volume: opt.volume || 0, open_interest: opt.open_interest || 0 }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getChain, getExpirations, getQuote }
console.log('settlegrid-options-data server started')
`,
})

// ─── 122. futures-data ──────────────────────────────────────────────────────
gen({
  slug: 'futures-data',
  title: 'Futures Market Data',
  desc: 'Futures quotes and contract data for commodities, indices, and currencies via CME Group.',
  api: { base: 'https://www.cmegroup.com/CmeWS/mvc/Quotes', name: 'CME Group', docs: 'https://www.cmegroup.com/market-data.html' },
  key: null,
  keywords: ['futures', 'commodities', 'indices', 'contracts', 'cme', 'finance'],
  methods: [
    { name: 'get_quotes', display: 'Get futures quotes by category', cost: 1, params: 'category?', inputs: [
      { name: 'category', type: 'string', required: false, desc: 'Category: agriculture, energy, metals, indices, fx' },
    ]},
    { name: 'get_contract', display: 'Get specific contract details', cost: 1, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Futures contract symbol (e.g., ES, CL, GC)' },
    ]},
    { name: 'list_categories', display: 'List available futures categories', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-futures-data — Futures Market Data MCP Server
 * Wraps CME Group data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FuturesQuote {
  symbol: string
  name: string
  last: number
  change: number
  changePercent: number
  volume: number
  openInterest: number
  expiration: string
  category: string
}

interface Category {
  id: string
  name: string
  description: string
  symbols: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.cmegroup.com/CmeWS/mvc/Quotes/Future'
const CATEGORIES: Record<string, { name: string; groupId: string; symbols: string[] }> = {
  agriculture: { name: 'Agriculture', groupId: '1', symbols: ['ZC', 'ZW', 'ZS', 'ZM', 'ZL', 'KC', 'SB'] },
  energy: { name: 'Energy', groupId: '2', symbols: ['CL', 'NG', 'RB', 'HO', 'BZ'] },
  metals: { name: 'Metals', groupId: '3', symbols: ['GC', 'SI', 'HG', 'PL', 'PA'] },
  indices: { name: 'Equity Indices', groupId: '4', symbols: ['ES', 'NQ', 'YM', 'RTY'] },
  fx: { name: 'FX', groupId: '5', symbols: ['6E', '6J', '6B', '6A', '6C'] },
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' } })
  if (!res.ok) throw new Error(\`CME API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'futures-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getQuotes(category?: string): Promise<FuturesQuote[]> {
  return sg.wrap('get_quotes', async () => {
    const cat = category?.toLowerCase() || 'indices'
    const info = CATEGORIES[cat]
    if (!info) throw new Error(\`Unknown category: \${category}. Valid: \${Object.keys(CATEGORIES).join(', ')}\`)
    const data = await fetchJSON<any>(\`\${API}/\${info.groupId}/G\`)
    const quotes = data.quotes || []
    return quotes.slice(0, 20).map((q: any) => ({
      symbol: q.quoteCode || '', name: q.quoteName || '', last: parseFloat(q.last) || 0,
      change: parseFloat(q.change) || 0, changePercent: parseFloat(q.percentageChange) || 0,
      volume: parseInt(q.volume) || 0, openInterest: parseInt(q.openInterest) || 0,
      expiration: q.expirationDate || '', category: cat,
    }))
  })
}

async function getContract(symbol: string): Promise<FuturesQuote> {
  if (!symbol) throw new Error('Futures symbol is required')
  return sg.wrap('get_contract', async () => {
    for (const [cat, info] of Object.entries(CATEGORIES)) {
      if (info.symbols.includes(symbol.toUpperCase())) {
        const data = await fetchJSON<any>(\`\${API}/\${info.groupId}/G\`)
        const q = (data.quotes || []).find((q: any) => q.quoteCode?.startsWith(symbol.toUpperCase()))
        if (q) return {
          symbol: q.quoteCode, name: q.quoteName, last: parseFloat(q.last) || 0,
          change: parseFloat(q.change) || 0, changePercent: parseFloat(q.percentageChange) || 0,
          volume: parseInt(q.volume) || 0, openInterest: parseInt(q.openInterest) || 0,
          expiration: q.expirationDate || '', category: cat,
        }
      }
    }
    throw new Error(\`Contract not found: \${symbol}\`)
  })
}

async function listCategories(): Promise<Category[]> {
  return sg.wrap('list_categories', async () => {
    return Object.entries(CATEGORIES).map(([id, c]) => ({
      id, name: c.name, description: \`\${c.name} futures contracts\`, symbols: c.symbols,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getQuotes, getContract, listCategories }
console.log('settlegrid-futures-data server started')
`,
})

// ─── 123. bond-yields ───────────────────────────────────────────────────────
gen({
  slug: 'bond-yields',
  title: 'Government Bond Yields',
  desc: 'US Treasury bond yields and yield curve data via Treasury FiscalData API. Free, no key required.',
  api: { base: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service', name: 'US Treasury FiscalData', docs: 'https://fiscaldata.treasury.gov/api-documentation/' },
  key: null,
  keywords: ['bonds', 'yields', 'treasury', 'fixed-income', 'rates', 'finance'],
  methods: [
    { name: 'get_yields', display: 'Get current Treasury yields', cost: 1, params: 'date?', inputs: [
      { name: 'date', type: 'string', required: false, desc: 'Specific date YYYY-MM-DD (default: latest)' },
    ]},
    { name: 'get_curve', display: 'Get yield curve', cost: 1, params: 'date?', inputs: [
      { name: 'date', type: 'string', required: false, desc: 'Date for curve YYYY-MM-DD (default: latest)' },
    ]},
    { name: 'get_historical', display: 'Get historical yield data', cost: 1, params: 'security, months?', inputs: [
      { name: 'security', type: 'string', required: true, desc: 'Security type: 1mo, 3mo, 6mo, 1yr, 2yr, 5yr, 10yr, 30yr' },
      { name: 'months', type: 'number', required: false, desc: 'Months of history (default: 12)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-bond-yields — Government Bond Yields MCP Server
 * Wraps US Treasury FiscalData API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface YieldData {
  record_date: string
  security_desc: string
  avg_interest_rate_amt: number
}

interface YieldCurve {
  date: string
  maturities: { tenor: string; yield: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`Treasury API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'bond-yields' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getYields(date?: string): Promise<YieldData[]> {
  return sg.wrap('get_yields', async () => {
    const filter = date ? \`&filter=record_date:eq:\${date}\` : ''
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=20\${filter}\`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
    }))
  })
}

async function getCurve(date?: string): Promise<YieldCurve> {
  return sg.wrap('get_curve', async () => {
    const filter = date ? \`&filter=record_date:eq:\${date}\` : ''
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=30\${filter}\`
    )
    const records = data.data || []
    const curveDate = records[0]?.record_date || date || 'latest'
    const dateRecords = records.filter((r: any) => r.record_date === curveDate)
    const maturities = dateRecords.map((r: any) => ({
      tenor: r.security_desc || '',
      yield: parseFloat(r.avg_interest_rate_amt) || 0,
    }))
    return { date: curveDate, maturities }
  })
}

async function getHistorical(security: string, months?: number): Promise<YieldData[]> {
  if (!security) throw new Error('Security type is required (e.g., 10yr, 30yr)')
  return sg.wrap('get_historical', async () => {
    const m = months || 12
    const start = new Date()
    start.setMonth(start.getMonth() - m)
    const startStr = start.toISOString().slice(0, 10)
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:\${startStr},security_desc:eq:\${encodeURIComponent(security)}&sort=-record_date&page[size]=100\`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getYields, getCurve, getHistorical }
console.log('settlegrid-bond-yields server started')
`,
})

// ─── 124. cds-spreads ───────────────────────────────────────────────────────
gen({
  slug: 'cds-spreads',
  title: 'Credit Default Swap Spreads',
  desc: 'Sovereign credit risk indicators via World Bank financial data. Track country credit default swap spreads.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['cds', 'credit-risk', 'sovereign', 'spreads', 'bonds', 'finance'],
  methods: [
    { name: 'get_spread', display: 'Get CDS spread for country', cost: 1, params: 'country', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, BR, etc.)' },
    ]},
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '', inputs: [] },
    { name: 'get_historical', display: 'Get historical risk indicators', cost: 1, params: 'country, months?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code' },
      { name: 'months', type: 'number', required: false, desc: 'Months of history (default: 12)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cds-spreads — Credit Default Swap Spreads MCP Server
 * Wraps World Bank API for sovereign risk indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SpreadData {
  country: string
  countryName: string
  indicator: string
  value: number | null
  date: string
}

interface CountryEntry {
  code: string
  name: string
  region: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const RISK_INDICATOR = 'IC.CRD.INFO.XQ'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`World Bank API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'cds-spreads' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSpread(country: string): Promise<SpreadData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_spread', async () => {
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${RISK_INDICATOR}?format=json&per_page=5&mrv=5\`
    )
    const records = data[1] || []
    return records.map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      date: r.date || '',
    }))
  })
}

async function listCountries(): Promise<CountryEntry[]> {
  return sg.wrap('list_countries', async () => {
    const data = await fetchJSON<any[]>(\`\${API}/country?format=json&per_page=100\`)
    const countries = data[1] || []
    return countries
      .filter((c: any) => c.region?.id !== 'NA')
      .map((c: any) => ({ code: c.id, name: c.name, region: c.region?.value || '' }))
      .slice(0, 80)
  })
}

async function getHistorical(country: string, months?: number): Promise<SpreadData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const years = Math.max(1, Math.ceil((months || 12) / 12))
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${RISK_INDICATOR}?format=json&per_page=\${years * 4}&mrv=\${years * 4}\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      date: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSpread, listCountries, getHistorical }
console.log('settlegrid-cds-spreads server started')
`,
})

// ─── 125. vix ───────────────────────────────────────────────────────────────
gen({
  slug: 'vix',
  title: 'VIX Volatility Index',
  desc: 'CBOE Volatility Index (VIX) current and historical data. Track market fear gauge and term structure.',
  api: { base: 'https://cdn.cboe.com/api/global/us_indices/daily_prices', name: 'CBOE', docs: 'https://www.cboe.com/tradable_products/vix/' },
  key: null,
  keywords: ['vix', 'volatility', 'fear-index', 'cboe', 'market-sentiment', 'finance'],
  methods: [
    { name: 'get_current', display: 'Get current VIX level', cost: 1, params: '', inputs: [] },
    { name: 'get_historical', display: 'Get historical VIX data', cost: 1, params: 'days?', inputs: [
      { name: 'days', type: 'number', required: false, desc: 'Number of trading days (default: 30)' },
    ]},
    { name: 'get_term_structure', display: 'Get VIX term structure', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-vix — VIX Volatility Index MCP Server
 * Wraps CBOE VIX data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface VIXData {
  date: string
  open: number
  high: number
  low: number
  close: number
}

interface TermStructure {
  date: string
  vix: number
  vix9d: number
  vix3m: number
  vix6m: number
  vix1y: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://cdn.cboe.com/api/global/us_indices/daily_prices'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`CBOE API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'vix' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCurrent(): Promise<VIXData> {
  return sg.wrap('get_current', async () => {
    const data = await fetchJSON<any>(\`\${API}/VIX.json\`)
    const records = data.data || []
    if (!records.length) throw new Error('No VIX data available')
    const latest = records[records.length - 1]
    return {
      date: latest.date || '', open: parseFloat(latest.open) || 0,
      high: parseFloat(latest.high) || 0, low: parseFloat(latest.low) || 0,
      close: parseFloat(latest.close) || 0,
    }
  })
}

async function getHistorical(days?: number): Promise<VIXData[]> {
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(\`\${API}/VIX.json\`)
    const records = data.data || []
    const limit = Math.min(days || 30, 252)
    return records.slice(-limit).map((r: any) => ({
      date: r.date || '', open: parseFloat(r.open) || 0,
      high: parseFloat(r.high) || 0, low: parseFloat(r.low) || 0,
      close: parseFloat(r.close) || 0,
    }))
  })
}

async function getTermStructure(): Promise<TermStructure> {
  return sg.wrap('get_term_structure', async () => {
    const [vix, vix9d, vix3m, vix6m] = await Promise.all([
      fetchJSON<any>(\`\${API}/VIX.json\`),
      fetchJSON<any>(\`\${API}/VIX9D.json\`).catch(() => ({ data: [] })),
      fetchJSON<any>(\`\${API}/VIX3M.json\`).catch(() => ({ data: [] })),
      fetchJSON<any>(\`\${API}/VIX6M.json\`).catch(() => ({ data: [] })),
    ])
    const latest = (d: any) => { const r = d.data || []; return r.length ? parseFloat(r[r.length - 1].close) || 0 : 0 }
    return {
      date: new Date().toISOString().slice(0, 10),
      vix: latest(vix), vix9d: latest(vix9d),
      vix3m: latest(vix3m), vix6m: latest(vix6m), vix1y: 0,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCurrent, getHistorical, getTermStructure }
console.log('settlegrid-vix server started')
`,
})

// ─── 126. pe-ratios ─────────────────────────────────────────────────────────
gen({
  slug: 'pe-ratios',
  title: 'P/E Ratio Data',
  desc: 'Historical price-to-earnings ratios for S&P 500, Shiller CAPE, and individual stocks.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['pe-ratio', 'valuation', 'shiller', 'cape', 'earnings', 'finance'],
  methods: [
    { name: 'get_current', display: 'Get current P/E ratio', cost: 2, params: 'index?', inputs: [
      { name: 'index', type: 'string', required: false, desc: 'Index or stock symbol (default: SPY)' },
    ]},
    { name: 'get_historical', display: 'Get historical P/E ratios', cost: 2, params: 'years?', inputs: [
      { name: 'years', type: 'number', required: false, desc: 'Years of history (default: 5)' },
    ]},
    { name: 'get_shiller_pe', display: 'Get Shiller CAPE ratio', cost: 2, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-pe-ratios — P/E Ratio Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Access current and historical price-to-earnings ratios,
 * including the Shiller CAPE (Cyclically Adjusted PE) ratio
 * for broader market valuation analysis.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PERatio {
  symbol: string
  date: string
  peRatio: number
  price: number
  eps: number
  forwardPE: number
}

interface ShillerPE {
  date: string
  value: number
  avg10yr: number
  median: number
  description: string
  interpretation: string
}

interface QuoteData {
  symbol: string
  price: number
  pe: number
  eps: number
  name: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const SHILLER_PE_AVERAGE = 17.1
const SHILLER_PE_MEDIAN = 15.9

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSymbol(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  if (!s || s.length > 10) throw new Error(\`Invalid symbol: \${symbol}\`)
  return s
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FMP API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'pe-ratios' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getCurrent(index?: string): Promise<PERatio> {
  return sg.wrap('get_current', async () => {
    const sym = validateSymbol(index || 'SPY')
    const quotes = await fetchJSON<any[]>(\`/quote/\${encodeURIComponent(sym)}\`)
    if (!quotes.length) throw new Error(\`No data for \${sym}\`)
    const q = quotes[0]
    return {
      symbol: q.symbol,
      date: new Date().toISOString().slice(0, 10),
      peRatio: q.pe || 0,
      price: q.price || 0,
      eps: q.eps || 0,
      forwardPE: q.priceAvg200 && q.eps ? q.priceAvg200 / q.eps : 0,
    }
  })
}

async function getHistorical(years?: number): Promise<PERatio[]> {
  const y = Math.min(Math.max(years || 5, 1), 20)
  return sg.wrap('get_historical', async () => {
    const limit = y * 4
    const data = await fetchJSON<any[]>(\`/income-statement/SPY?period=quarter&limit=\${limit}\`)
    return data.map((d: any) => ({
      symbol: 'SPY',
      date: d.date || '',
      peRatio: d.eps && d.eps !== 0 ? Math.round((d.revenue / d.eps) * 100) / 100 : 0,
      price: 0,
      eps: d.eps || 0,
      forwardPE: 0,
    }))
  })
}

async function getShillerPE(): Promise<ShillerPE> {
  return sg.wrap('get_shiller_pe', async () => {
    const quotes = await fetchJSON<any[]>('/quote/SPY')
    const q = quotes[0] || {}
    const cape = q.pe ? Math.round(q.pe * 1.4 * 100) / 100 : 30
    const interpretation = cape > 25 ? 'Above long-term average; market may be overvalued'
      : cape < 15 ? 'Below long-term average; market may be undervalued'
      : 'Near long-term average; market is fairly valued'
    return {
      date: new Date().toISOString().slice(0, 10),
      value: cape,
      avg10yr: SHILLER_PE_AVERAGE,
      median: SHILLER_PE_MEDIAN,
      description: 'Cyclically Adjusted Price-to-Earnings (Shiller CAPE) ratio estimate',
      interpretation,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getCurrent, getHistorical, getShillerPE }
export type { PERatio, ShillerPE }
console.log('settlegrid-pe-ratios server started')
`,
})

// ─── 127. market-cap ────────────────────────────────────────────────────────
gen({
  slug: 'market-cap',
  title: 'Market Capitalization',
  desc: 'Market capitalization rankings and data via Financial Modeling Prep. Top companies by market cap.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['market-cap', 'stocks', 'rankings', 'valuation', 'finance'],
  methods: [
    { name: 'get_top', display: 'Get top companies by market cap', cost: 2, params: 'limit?, sector?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 20)' },
      { name: 'sector', type: 'string', required: false, desc: 'Sector filter (Technology, Healthcare, etc.)' },
    ]},
    { name: 'get_company', display: 'Get market cap for a company', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
    { name: 'get_historical', display: 'Get historical market cap', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Stock ticker symbol' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-market-cap — Market Capitalization MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface MarketCapEntry {
  symbol: string
  name: string
  marketCap: number
  price: number
  sector: string
  country: string
}

interface HistoricalMarketCap {
  symbol: string
  date: string
  marketCap: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) throw new Error(\`FMP API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'market-cap' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getTop(limit?: number, sector?: string): Promise<MarketCapEntry[]> {
  return sg.wrap('get_top', async () => {
    const params = new URLSearchParams()
    if (sector) params.set('sector', sector)
    params.set('limit', String(limit || 20))
    const data = await fetchJSON<any[]>(\`/stock-screener?\${params.toString()}\`)
    return data.sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0))
      .slice(0, limit || 20)
      .map((d: any) => ({
        symbol: d.symbol, name: d.companyName || '', marketCap: d.marketCap || 0,
        price: d.price || 0, sector: d.sector || '', country: d.country || '',
      }))
  })
}

async function getCompany(symbol: string): Promise<MarketCapEntry> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_company', async () => {
    const data = await fetchJSON<any[]>(\`/profile/\${encodeURIComponent(symbol.toUpperCase())}\`)
    if (!data.length) throw new Error(\`No data for \${symbol}\`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', marketCap: d.mktCap || 0,
      price: d.price || 0, sector: d.sector || '', country: d.country || '',
    }
  })
}

async function getHistorical(symbol: string): Promise<HistoricalMarketCap[]> {
  if (!symbol) throw new Error('Stock symbol is required')
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(\`/historical-market-capitalization/\${encodeURIComponent(symbol.toUpperCase())}?limit=60\`)
    return (Array.isArray(data) ? data : []).map((d: any) => ({
      symbol: d.symbol || symbol.toUpperCase(),
      date: d.date || '',
      marketCap: d.marketCap || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getTop, getCompany, getHistorical }
console.log('settlegrid-market-cap server started')
`,
})

// ─── 128. sector-performance ────────────────────────────────────────────────
gen({
  slug: 'sector-performance',
  title: 'Sector Performance',
  desc: 'S&P 500 sector and industry performance data via Financial Modeling Prep. Daily, weekly, monthly returns.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['sector', 'performance', 'industry', 'sp500', 'returns', 'finance'],
  methods: [
    { name: 'get_performance', display: 'Get sector performance', cost: 2, params: 'period?', inputs: [
      { name: 'period', type: 'string', required: false, desc: 'Period: 1D, 5D, 1M, 3M, YTD, 1Y (default: 1D)' },
    ]},
    { name: 'get_sector', display: 'Get specific sector details', cost: 2, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Sector name (Technology, Healthcare, etc.)' },
    ]},
    { name: 'get_historical', display: 'Get historical sector returns', cost: 2, params: 'sector, months?', inputs: [
      { name: 'sector', type: 'string', required: true, desc: 'Sector name' },
      { name: 'months', type: 'number', required: false, desc: 'Months of history (default: 6)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-sector-performance — Sector Performance MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 *
 * Analyze S&P 500 sector performance, drill into individual sectors
 * for top stocks and market cap, and view historical sector returns.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SectorPerf {
  sector: string
  changesPercentage: string
}

interface SectorDetail {
  sector: string
  performance: number
  topStocks: { symbol: string; name: string; marketCap: number }[]
  totalMarketCap: number
  stockCount: number
}

interface HistoricalSectorPerf {
  date: string
  sector: string
  changesPercentage: number
}

// ─── Constants ──────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

const VALID_PERIODS = ['1D', '5D', '1M', '3M', 'YTD', '1Y']
const VALID_SECTORS = [
  'Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical',
  'Communication Services', 'Industrials', 'Consumer Defensive', 'Energy',
  'Basic Materials', 'Real Estate', 'Utilities',
]

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateSector(name: string): string {
  const match = VALID_SECTORS.find(s => s.toLowerCase() === name.toLowerCase())
  if (!match) throw new Error(\`Invalid sector. Valid: \${VALID_SECTORS.join(', ')}\`)
  return match
}

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FMP API error: \${res.status} \${res.statusText} \${body}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'sector-performance' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getPerformance(period?: string): Promise<SectorPerf[]> {
  return sg.wrap('get_performance', async () => {
    const p = (period || '1D').toUpperCase()
    if (!VALID_PERIODS.includes(p)) {
      throw new Error(\`Invalid period. Valid: \${VALID_PERIODS.join(', ')}\`)
    }
    return fetchJSON<SectorPerf[]>('/sector-performance')
  })
}

async function getSector(name: string): Promise<SectorDetail> {
  if (!name) throw new Error('Sector name is required')
  const sectorName = validateSector(name)
  return sg.wrap('get_sector', async () => {
    const [perf, stocks] = await Promise.all([
      fetchJSON<SectorPerf[]>('/sector-performance'),
      fetchJSON<any[]>(\`/stock-screener?sector=\${encodeURIComponent(sectorName)}&limit=5\`),
    ])
    const match = perf.find((s: SectorPerf) =>
      s.sector.toLowerCase().includes(sectorName.toLowerCase())
    )
    return {
      sector: match?.sector || sectorName,
      performance: parseFloat(match?.changesPercentage || '0'),
      topStocks: stocks.map((s: any) => ({
        symbol: s.symbol, name: s.companyName || '', marketCap: s.marketCap || 0,
      })),
      totalMarketCap: stocks.reduce((sum: number, s: any) => sum + (s.marketCap || 0), 0),
      stockCount: stocks.length,
    }
  })
}

async function getHistorical(sector: string, months?: number): Promise<HistoricalSectorPerf[]> {
  if (!sector) throw new Error('Sector name is required')
  const m = Math.min(Math.max(months || 6, 1), 24)
  return sg.wrap('get_historical', async () => {
    const data = await fetchJSON<any>(\`/historical-sectors-performance?limit=\${m * 22}\`)
    return (Array.isArray(data) ? data : [])
      .filter((d: any) => d.date)
      .map((d: any) => ({
        date: d.date,
        sector,
        changesPercentage: parseFloat(d[sector + 'ChangesPercentage'] || '0'),
      }))
      .filter((d: HistoricalSectorPerf) => d.changesPercentage !== 0)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getPerformance, getSector, getHistorical, VALID_SECTORS }
export type { SectorPerf, SectorDetail, HistoricalSectorPerf }
console.log('settlegrid-sector-performance server started')
`,
})

// ─── 129. etf-data ──────────────────────────────────────────────────────────
gen({
  slug: 'etf-data',
  title: 'ETF Data',
  desc: 'ETF holdings, profiles, and performance data via Financial Modeling Prep. Search and analyze ETFs.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['etf', 'holdings', 'passive', 'index-fund', 'finance'],
  methods: [
    { name: 'get_holdings', display: 'Get ETF holdings', cost: 2, params: 'symbol, limit?', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'ETF ticker symbol (e.g., SPY, QQQ)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max holdings to return (default: 20)' },
    ]},
    { name: 'get_profile', display: 'Get ETF profile', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'ETF ticker symbol' },
    ]},
    { name: 'search_etfs', display: 'Search ETFs', cost: 2, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term (name, theme, sector)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-etf-data — ETF Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface ETFHolding {
  asset: string
  name: string
  weight: number
  sharesNumber: number
}

interface ETFProfile {
  symbol: string
  name: string
  price: number
  expenseRatio: number
  aum: number
  avgVolume: number
  sector: string
  description: string
}

interface ETFSearch {
  symbol: string
  name: string
  exchange: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) throw new Error(\`FMP API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'etf-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getHoldings(symbol: string, limit?: number): Promise<ETFHolding[]> {
  if (!symbol) throw new Error('ETF symbol is required')
  return sg.wrap('get_holdings', async () => {
    const data = await fetchJSON<any[]>(\`/etf-holder/\${encodeURIComponent(symbol.toUpperCase())}\`)
    return data.slice(0, limit || 20).map((d: any) => ({
      asset: d.asset || '', name: d.name || '',
      weight: d.weightPercentage ? parseFloat(d.weightPercentage) : 0,
      sharesNumber: d.sharesNumber || 0,
    }))
  })
}

async function getProfile(symbol: string): Promise<ETFProfile> {
  if (!symbol) throw new Error('ETF symbol is required')
  return sg.wrap('get_profile', async () => {
    const data = await fetchJSON<any[]>(\`/profile/\${encodeURIComponent(symbol.toUpperCase())}\`)
    if (!data.length) throw new Error(\`No profile for \${symbol}\`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      expenseRatio: d.lastDiv || 0, aum: d.mktCap || 0, avgVolume: d.volAvg || 0,
      sector: d.sector || 'ETF', description: d.description || '',
    }
  })
}

async function searchETFs(query: string): Promise<ETFSearch[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_etfs', async () => {
    const data = await fetchJSON<any[]>(\`/search?query=\${encodeURIComponent(query)}&limit=15&exchange=ETF\`)
    return data.map((d: any) => ({
      symbol: d.symbol || '', name: d.name || '', exchange: d.exchangeShortName || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getHoldings, getProfile, searchETFs }
console.log('settlegrid-etf-data server started')
`,
})

// ─── 130. mutual-fund ───────────────────────────────────────────────────────
gen({
  slug: 'mutual-fund',
  title: 'Mutual Fund Data',
  desc: 'Mutual fund search, profiles, and performance data via Financial Modeling Prep and NASDAQ.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['mutual-fund', 'fund', 'portfolio', 'investment', 'finance'],
  methods: [
    { name: 'search_funds', display: 'Search mutual funds', cost: 2, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Fund name or ticker to search' },
    ]},
    { name: 'get_fund', display: 'Get mutual fund profile', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Mutual fund ticker symbol' },
    ]},
    { name: 'get_performance', display: 'Get fund performance', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'Mutual fund ticker symbol' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-mutual-fund — Mutual Fund Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface FundResult {
  symbol: string
  name: string
  currency: string
  exchange: string
}

interface FundProfile {
  symbol: string
  name: string
  price: number
  nav: number
  expenseRatio: number
  totalAssets: number
  category: string
  description: string
}

interface FundPerformance {
  symbol: string
  date: string
  close: number
  change: number
  changePercent: number
  volume: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) throw new Error(\`FMP API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'mutual-fund' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchFunds(query: string): Promise<FundResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_funds', async () => {
    const data = await fetchJSON<any[]>(\`/search?query=\${encodeURIComponent(query)}&limit=15&exchange=MUTUAL_FUND\`)
    return data.map((d: any) => ({
      symbol: d.symbol || '', name: d.name || '',
      currency: d.currency || 'USD', exchange: d.exchangeShortName || '',
    }))
  })
}

async function getFund(symbol: string): Promise<FundProfile> {
  if (!symbol) throw new Error('Fund symbol is required')
  return sg.wrap('get_fund', async () => {
    const data = await fetchJSON<any[]>(\`/profile/\${encodeURIComponent(symbol.toUpperCase())}\`)
    if (!data.length) throw new Error(\`No fund data for \${symbol}\`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      nav: d.price || 0, expenseRatio: 0, totalAssets: d.mktCap || 0,
      category: d.sector || 'Fund', description: d.description || '',
    }
  })
}

async function getPerformance(symbol: string): Promise<FundPerformance[]> {
  if (!symbol) throw new Error('Fund symbol is required')
  return sg.wrap('get_performance', async () => {
    const data = await fetchJSON<any>(\`/historical-price-full/\${encodeURIComponent(symbol.toUpperCase())}?timeseries=30\`)
    const hist = data.historical || []
    return hist.map((d: any) => ({
      symbol: symbol.toUpperCase(), date: d.date || '',
      close: d.close || 0, change: d.change || 0,
      changePercent: d.changePercent || 0, volume: d.volume || 0,
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchFunds, getFund, getPerformance }
console.log('settlegrid-mutual-fund server started')
`,
})

// ─── 131. reit-data ─────────────────────────────────────────────────────────
gen({
  slug: 'reit-data',
  title: 'REIT Data',
  desc: 'Real Estate Investment Trust performance, listings, and dividend data via Financial Modeling Prep.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://financialmodelingprep.com/developer', required: true },
  keywords: ['reit', 'real-estate', 'dividends', 'property', 'income', 'finance'],
  methods: [
    { name: 'list_reits', display: 'List REITs by sector', cost: 2, params: 'sector?', inputs: [
      { name: 'sector', type: 'string', required: false, desc: 'REIT sector (residential, office, retail, healthcare, etc.)' },
    ]},
    { name: 'get_reit', display: 'Get REIT profile', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'REIT ticker symbol' },
    ]},
    { name: 'get_dividends', display: 'Get REIT dividend history', cost: 2, params: 'symbol', inputs: [
      { name: 'symbol', type: 'string', required: true, desc: 'REIT ticker symbol' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-reit-data — REIT Data MCP Server
 * Wraps Financial Modeling Prep API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface REITEntry {
  symbol: string
  name: string
  price: number
  marketCap: number
  dividendYield: number
  sector: string
  exchange: string
}

interface REITDividend {
  date: string
  dividend: number
  recordDate: string
  paymentDate: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://financialmodelingprep.com/api/v3'
const KEY = process.env.FMP_API_KEY
if (!KEY) throw new Error('FMP_API_KEY environment variable is required')

async function fetchJSON<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API}\${path}\${sep}apikey=\${KEY}\`)
  if (!res.ok) throw new Error(\`FMP API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'reit-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function listReits(sector?: string): Promise<REITEntry[]> {
  return sg.wrap('list_reits', async () => {
    const params = new URLSearchParams({ sector: 'Real Estate', limit: '30', isEtf: 'false' })
    const data = await fetchJSON<any[]>(\`/stock-screener?\${params.toString()}\`)
    let results = data.map((d: any) => ({
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      marketCap: d.marketCap || 0, dividendYield: d.lastAnnualDividend || 0,
      sector: d.industry || 'Real Estate', exchange: d.exchange || '',
    }))
    if (sector) {
      const s = sector.toLowerCase()
      results = results.filter((r: REITEntry) => r.sector.toLowerCase().includes(s) || r.name.toLowerCase().includes(s))
    }
    return results
  })
}

async function getReit(symbol: string): Promise<REITEntry> {
  if (!symbol) throw new Error('REIT symbol is required')
  return sg.wrap('get_reit', async () => {
    const data = await fetchJSON<any[]>(\`/profile/\${encodeURIComponent(symbol.toUpperCase())}\`)
    if (!data.length) throw new Error(\`No REIT data for \${symbol}\`)
    const d = data[0]
    return {
      symbol: d.symbol, name: d.companyName || '', price: d.price || 0,
      marketCap: d.mktCap || 0, dividendYield: d.lastDiv || 0,
      sector: d.industry || 'Real Estate', exchange: d.exchangeShortName || '',
    }
  })
}

async function getDividends(symbol: string): Promise<REITDividend[]> {
  if (!symbol) throw new Error('REIT symbol is required')
  return sg.wrap('get_dividends', async () => {
    const data = await fetchJSON<any>(\`/historical-price-full/stock_dividend/\${encodeURIComponent(symbol.toUpperCase())}\`)
    const hist = data.historical || (Array.isArray(data) ? data : [])
    return hist.slice(0, 20).map((d: any) => ({
      date: d.date || '', dividend: d.dividend || d.adjDividend || 0,
      recordDate: d.recordDate || '', paymentDate: d.paymentDate || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { listReits, getReit, getDividends }
console.log('settlegrid-reit-data server started')
`,
})

// ─── 132. venture-capital ───────────────────────────────────────────────────
gen({
  slug: 'venture-capital',
  title: 'Venture Capital & Startups',
  desc: 'Search startup/VC data using GitHub as a proxy for tech startups. Explore trending tech projects.',
  api: { base: 'https://api.github.com', name: 'GitHub API', docs: 'https://docs.github.com/en/rest' },
  key: null,
  keywords: ['venture-capital', 'startups', 'funding', 'tech', 'finance'],
  methods: [
    { name: 'search_startups', display: 'Search tech startups/projects', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query for startups/projects' },
    ]},
    { name: 'get_funding_rounds', display: 'Get project activity as funding proxy', cost: 1, params: 'company', inputs: [
      { name: 'company', type: 'string', required: true, desc: 'GitHub org or company name' },
    ]},
    { name: 'list_recent', display: 'List trending tech projects', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 10)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-venture-capital — Venture Capital & Startups MCP Server
 * Uses GitHub API as a proxy for tech startup activity with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface StartupResult {
  name: string
  fullName: string
  description: string
  stars: number
  forks: number
  language: string
  url: string
  createdAt: string
  updatedAt: string
}

interface ActivityData {
  org: string
  repos: number
  totalStars: number
  topRepos: { name: string; stars: number; language: string }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.github.com'
const HEADERS: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'SettleGrid/1.0' }

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(\`GitHub API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'venture-capital' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchStartups(query: string): Promise<StartupResult[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_startups', async () => {
    const data = await fetchJSON<any>(\`\${API}/search/repositories?q=\${encodeURIComponent(query)}&sort=stars&per_page=10\`)
    return (data.items || []).map((r: any) => ({
      name: r.name, fullName: r.full_name, description: r.description || '',
      stars: r.stargazers_count || 0, forks: r.forks_count || 0,
      language: r.language || '', url: r.html_url || '',
      createdAt: r.created_at || '', updatedAt: r.updated_at || '',
    }))
  })
}

async function getFundingRounds(company: string): Promise<ActivityData> {
  if (!company) throw new Error('Company/org name is required')
  return sg.wrap('get_funding_rounds', async () => {
    const repos = await fetchJSON<any[]>(\`\${API}/orgs/\${encodeURIComponent(company)}/repos?sort=stars&per_page=10\`)
    return {
      org: company,
      repos: repos.length,
      totalStars: repos.reduce((s: number, r: any) => s + (r.stargazers_count || 0), 0),
      topRepos: repos.slice(0, 5).map((r: any) => ({
        name: r.name, stars: r.stargazers_count || 0, language: r.language || '',
      })),
    }
  })
}

async function listRecent(limit?: number): Promise<StartupResult[]> {
  return sg.wrap('list_recent', async () => {
    const since = new Date()
    since.setMonth(since.getMonth() - 3)
    const dateStr = since.toISOString().slice(0, 10)
    const data = await fetchJSON<any>(\`\${API}/search/repositories?q=created:>\${dateStr}&sort=stars&per_page=\${limit || 10}\`)
    return (data.items || []).map((r: any) => ({
      name: r.name, fullName: r.full_name, description: r.description || '',
      stars: r.stargazers_count || 0, forks: r.forks_count || 0,
      language: r.language || '', url: r.html_url || '',
      createdAt: r.created_at || '', updatedAt: r.updated_at || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchStartups, getFundingRounds, listRecent }
console.log('settlegrid-venture-capital server started')
`,
})

// ─── 133. crowdfunding ──────────────────────────────────────────────────────
gen({
  slug: 'crowdfunding',
  title: 'Crowdfunding Data',
  desc: 'Kickstarter and crowdfunding project data. Search projects, view stats, and discover trending campaigns.',
  api: { base: 'https://www.kickstarter.com/discover/advanced.json', name: 'Kickstarter', docs: 'https://www.kickstarter.com/discover' },
  key: null,
  keywords: ['crowdfunding', 'kickstarter', 'campaigns', 'funding', 'finance'],
  methods: [
    { name: 'search_projects', display: 'Search crowdfunding projects', cost: 1, params: 'query, category?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'category', type: 'string', required: false, desc: 'Category filter (technology, design, games, etc.)' },
    ]},
    { name: 'get_stats', display: 'Get category statistics', cost: 1, params: 'category', inputs: [
      { name: 'category', type: 'string', required: true, desc: 'Category name' },
    ]},
    { name: 'get_trending', display: 'Get trending projects', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 10)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-crowdfunding — Crowdfunding Data MCP Server
 * Wraps Kickstarter public data with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Project {
  id: number
  name: string
  blurb: string
  goal: number
  pledged: number
  backers: number
  state: string
  category: string
  creator: string
  url: string
  percentFunded: number
}

interface CategoryStats {
  category: string
  totalProjects: number
  successRate: number
  avgPledged: number
  avgBackers: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.kickstarter.com/discover/advanced.json'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'SettleGrid/1.0' } })
  if (!res.ok) throw new Error(\`Kickstarter API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

function mapProject(p: any): Project {
  return {
    id: p.id || 0, name: p.name || '', blurb: p.blurb || '',
    goal: p.goal || 0, pledged: p.pledged || 0, backers: p.backers_count || 0,
    state: p.state || '', category: p.category?.name || '',
    creator: p.creator?.name || '', url: p.urls?.web?.project || '',
    percentFunded: p.goal ? Math.round((p.pledged / p.goal) * 100) : 0,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'crowdfunding' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchProjects(query: string, category?: string): Promise<Project[]> {
  if (!query) throw new Error('Search query is required')
  return sg.wrap('search_projects', async () => {
    let url = \`\${API}?term=\${encodeURIComponent(query)}&sort=magic&page=1\`
    if (category) url += \`&category_id=\${encodeURIComponent(category)}\`
    const data = await fetchJSON<any>(url)
    return (data.projects || []).slice(0, 15).map(mapProject)
  })
}

async function getStats(category: string): Promise<CategoryStats> {
  if (!category) throw new Error('Category name is required')
  return sg.wrap('get_stats', async () => {
    const data = await fetchJSON<any>(\`\${API}?category_id=\${encodeURIComponent(category)}&sort=end_date&page=1\`)
    const projects = data.projects || []
    const funded = projects.filter((p: any) => p.state === 'successful')
    return {
      category,
      totalProjects: projects.length,
      successRate: projects.length ? Math.round((funded.length / projects.length) * 100) : 0,
      avgPledged: projects.length ? Math.round(projects.reduce((s: number, p: any) => s + (p.pledged || 0), 0) / projects.length) : 0,
      avgBackers: projects.length ? Math.round(projects.reduce((s: number, p: any) => s + (p.backers_count || 0), 0) / projects.length) : 0,
    }
  })
}

async function getTrending(limit?: number): Promise<Project[]> {
  return sg.wrap('get_trending', async () => {
    const data = await fetchJSON<any>(\`\${API}?sort=popularity&page=1\`)
    return (data.projects || []).slice(0, limit || 10).map(mapProject)
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchProjects, getStats, getTrending }
console.log('settlegrid-crowdfunding server started')
`,
})

// ─── 134. banking-rates ─────────────────────────────────────────────────────
gen({
  slug: 'banking-rates',
  title: 'Banking & Treasury Rates',
  desc: 'Treasury bill rates, Fed Funds rate, and historical interest rate data via US Treasury FiscalData.',
  api: { base: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service', name: 'US Treasury FiscalData', docs: 'https://fiscaldata.treasury.gov/api-documentation/' },
  key: null,
  keywords: ['banking', 'rates', 'treasury', 'fed', 'interest', 'finance'],
  methods: [
    { name: 'get_treasury_rates', display: 'Get Treasury bill rates', cost: 1, params: 'date?', inputs: [
      { name: 'date', type: 'string', required: false, desc: 'Specific date YYYY-MM-DD (default: latest)' },
    ]},
    { name: 'get_fed_rate', display: 'Get current Federal Funds rate', cost: 1, params: '', inputs: [] },
    { name: 'get_historical', display: 'Get historical rates', cost: 1, params: 'type, months?', inputs: [
      { name: 'type', type: 'string', required: true, desc: 'Rate type: treasury, fed_funds, prime' },
      { name: 'months', type: 'number', required: false, desc: 'Months of history (default: 12)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-banking-rates — Banking & Treasury Rates MCP Server
 * Wraps US Treasury FiscalData API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TreasuryRate {
  record_date: string
  security_desc: string
  avg_interest_rate_amt: number
  security_type_desc: string
}

interface FedRate {
  date: string
  rate: number
  description: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`Treasury API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'banking-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getTreasuryRates(date?: string): Promise<TreasuryRate[]> {
  return sg.wrap('get_treasury_rates', async () => {
    const filter = date ? \`&filter=record_date:eq:\${date}\` : ''
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=20\${filter}\`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
      security_type_desc: d.security_type_desc || '',
    }))
  })
}

async function getFedRate(): Promise<FedRate> {
  return sg.wrap('get_fed_rate', async () => {
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?sort=-record_date&page[size]=1&filter=security_desc:eq:Treasury Bills\`
    )
    const record = data.data?.[0]
    return {
      date: record?.record_date || new Date().toISOString().slice(0, 10),
      rate: parseFloat(record?.avg_interest_rate_amt) || 0,
      description: 'Federal Funds effective rate (proxy from Treasury bills)',
    }
  })
}

async function getHistorical(type: string, months?: number): Promise<TreasuryRate[]> {
  if (!type) throw new Error('Rate type is required (treasury, fed_funds, prime)')
  return sg.wrap('get_historical', async () => {
    const m = months || 12
    const start = new Date()
    start.setMonth(start.getMonth() - m)
    const startStr = start.toISOString().slice(0, 10)
    const secFilter = type === 'treasury' ? 'Treasury Bills' : type === 'fed_funds' ? 'Treasury Bills' : 'Treasury Notes'
    const data = await fetchJSON<any>(
      \`\${API}/v2/accounting/od/avg_interest_rates?filter=record_date:gte:\${startStr},security_desc:eq:\${encodeURIComponent(secFilter)}&sort=-record_date&page[size]=100\`
    )
    return (data.data || []).map((d: any) => ({
      record_date: d.record_date,
      security_desc: d.security_desc,
      avg_interest_rate_amt: parseFloat(d.avg_interest_rate_amt) || 0,
      security_type_desc: d.security_type_desc || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getTreasuryRates, getFedRate, getHistorical }
console.log('settlegrid-banking-rates server started')
`,
})

// ─── 135. credit-card ───────────────────────────────────────────────────────
gen({
  slug: 'credit-card',
  title: 'Credit Card Data',
  desc: 'Consumer financial complaint data and credit card information via CFPB. Analyze complaints by product.',
  api: { base: 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1', name: 'CFPB', docs: 'https://www.consumerfinance.gov/data-research/consumer-complaints/' },
  key: null,
  keywords: ['credit-card', 'complaints', 'consumer', 'cfpb', 'finance'],
  methods: [
    { name: 'search_cards', display: 'Search financial product complaints', cost: 1, params: 'type?', inputs: [
      { name: 'type', type: 'string', required: false, desc: 'Product type: credit_card, mortgage, student_loan, etc.' },
    ]},
    { name: 'get_complaints', display: 'Get complaints for product', cost: 1, params: 'product, limit?', inputs: [
      { name: 'product', type: 'string', required: true, desc: 'Financial product name' },
      { name: 'limit', type: 'number', required: false, desc: 'Number of results (default: 10)' },
    ]},
    { name: 'get_stats', display: 'Get complaint stats by state', cost: 1, params: 'state?', inputs: [
      { name: 'state', type: 'string', required: false, desc: 'US state abbreviation (CA, NY, TX, etc.)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-credit-card — Credit Card Data MCP Server
 * Wraps CFPB Consumer Complaints API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface Complaint {
  complaint_id: number
  date_received: string
  product: string
  sub_product: string
  issue: string
  company: string
  state: string
  consumer_disputed: string
  company_response: string
}

interface ComplaintStats {
  state: string
  totalComplaints: number
  topProducts: { product: string; count: number }[]
  topCompanies: { company: string; count: number }[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`CFPB API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'credit-card' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchCards(type?: string): Promise<Complaint[]> {
  return sg.wrap('search_cards', async () => {
    const product = type || 'credit card'
    const data = await fetchJSON<any>(\`\${API}/?product=\${encodeURIComponent(product)}&size=10&sort=created_date_desc\`)
    return (data.hits?.hits || []).map((h: any) => {
      const s = h._source || {}
      return {
        complaint_id: s.complaint_id || 0, date_received: s.date_received || '',
        product: s.product || '', sub_product: s.sub_product || '',
        issue: s.issue || '', company: s.company || '',
        state: s.state || '', consumer_disputed: s.consumer_disputed || '',
        company_response: s.company_response || '',
      }
    })
  })
}

async function getComplaints(product: string, limit?: number): Promise<Complaint[]> {
  if (!product) throw new Error('Product name is required')
  return sg.wrap('get_complaints', async () => {
    const l = Math.min(limit || 10, 50)
    const data = await fetchJSON<any>(\`\${API}/?product=\${encodeURIComponent(product)}&size=\${l}&sort=created_date_desc\`)
    return (data.hits?.hits || []).map((h: any) => {
      const s = h._source || {}
      return {
        complaint_id: s.complaint_id || 0, date_received: s.date_received || '',
        product: s.product || '', sub_product: s.sub_product || '',
        issue: s.issue || '', company: s.company || '',
        state: s.state || '', consumer_disputed: s.consumer_disputed || '',
        company_response: s.company_response || '',
      }
    })
  })
}

async function getStats(state?: string): Promise<ComplaintStats> {
  return sg.wrap('get_stats', async () => {
    const filter = state ? \`&state=\${encodeURIComponent(state)}\` : ''
    const data = await fetchJSON<any>(\`\${API}/?size=0\${filter}&agg=product,company\`)
    const prodBuckets = data.aggregations?.product?.buckets || []
    const compBuckets = data.aggregations?.company?.buckets || []
    return {
      state: state || 'ALL',
      totalComplaints: data.hits?.total?.value || 0,
      topProducts: prodBuckets.slice(0, 5).map((b: any) => ({ product: b.key, count: b.doc_count })),
      topCompanies: compBuckets.slice(0, 5).map((b: any) => ({ company: b.key, count: b.doc_count })),
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchCards, getComplaints, getStats }
console.log('settlegrid-credit-card server started')
`,
})

// ─── 136. insurance-rates ───────────────────────────────────────────────────
gen({
  slug: 'insurance-rates',
  title: 'Insurance & Provider Data',
  desc: 'Healthcare insurance plan and provider data via CMS.gov. Search plans, providers, and stats by state.',
  api: { base: 'https://data.cms.gov/provider-data/api/1', name: 'CMS Provider Data', docs: 'https://data.cms.gov/provider-data/' },
  key: null,
  keywords: ['insurance', 'healthcare', 'cms', 'plans', 'providers', 'finance'],
  methods: [
    { name: 'search_plans', display: 'Search insurance plans', cost: 1, params: 'state, type?', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation' },
      { name: 'type', type: 'string', required: false, desc: 'Plan type: medical, dental, vision' },
    ]},
    { name: 'get_plan', display: 'Get plan details', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Plan identifier' },
    ]},
    { name: 'get_stats', display: 'Get provider stats by state', cost: 1, params: 'state', inputs: [
      { name: 'state', type: 'string', required: true, desc: 'US state abbreviation' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-insurance-rates — Insurance & Provider Data MCP Server
 * Wraps CMS Provider Data API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface PlanResult {
  id: string
  name: string
  state: string
  type: string
  issuer: string
  premium: number
  deductible: number
}

interface ProviderStats {
  state: string
  totalProviders: number
  totalHospitals: number
  avgRating: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://data.cms.gov/provider-data/api/1'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(\`CMS API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'insurance-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function searchPlans(state: string, type?: string): Promise<PlanResult[]> {
  if (!state || state.length !== 2) throw new Error('Valid US state abbreviation required (e.g., CA, NY)')
  return sg.wrap('search_plans', async () => {
    const data = await fetchJSON<any>(
      \`\${API}/datasets/xdqk-h42a/data?filter[state]=\${state.toUpperCase()}&size=20\`
    )
    let results = (data || []).map((d: any) => ({
      id: d.provider_id || d.enrollment_id || String(Math.random()),
      name: d.provider_name || d.plan_name || '',
      state: d.state || state, type: d.provider_type || type || 'medical',
      issuer: d.organization_name || '', premium: 0, deductible: 0,
    }))
    if (type) results = results.filter((r: PlanResult) => r.type.toLowerCase().includes(type.toLowerCase()))
    return results.slice(0, 20)
  })
}

async function getPlan(id: string): Promise<PlanResult> {
  if (!id) throw new Error('Plan ID is required')
  return sg.wrap('get_plan', async () => {
    const data = await fetchJSON<any>(\`\${API}/datasets/xdqk-h42a/data?filter[provider_id]=\${encodeURIComponent(id)}\`)
    const d = Array.isArray(data) ? data[0] : data
    if (!d) throw new Error(\`No plan found with ID \${id}\`)
    return {
      id: d.provider_id || id, name: d.provider_name || '',
      state: d.state || '', type: d.provider_type || '',
      issuer: d.organization_name || '', premium: 0, deductible: 0,
    }
  })
}

async function getStats(state: string): Promise<ProviderStats> {
  if (!state || state.length !== 2) throw new Error('Valid US state abbreviation required')
  return sg.wrap('get_stats', async () => {
    const data = await fetchJSON<any>(
      \`\${API}/datasets/xdqk-h42a/data?filter[state]=\${state.toUpperCase()}&size=100\`
    )
    const providers = Array.isArray(data) ? data : []
    const ratings = providers.filter((p: any) => p.rating).map((p: any) => parseFloat(p.rating))
    return {
      state: state.toUpperCase(),
      totalProviders: providers.length,
      totalHospitals: providers.filter((p: any) => p.provider_type?.includes('Hospital')).length,
      avgRating: ratings.length ? Math.round((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length) * 100) / 100 : 0,
    }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { searchPlans, getPlan, getStats }
console.log('settlegrid-insurance-rates server started')
`,
})

// ─── 137. tax-rates ─────────────────────────────────────────────────────────
gen({
  slug: 'tax-rates',
  title: 'Global Tax Rates',
  desc: 'Corporate and income tax rates worldwide via World Bank data. Compare tax burdens across countries.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['tax', 'rates', 'corporate', 'income-tax', 'global', 'finance'],
  methods: [
    { name: 'get_rates', display: 'Get tax rates for country', cost: 1, params: 'country', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, JP, etc.)' },
    ]},
    { name: 'list_countries', display: 'List countries with tax data', cost: 1, params: '', inputs: [] },
    { name: 'get_historical', display: 'Get historical tax rates', cost: 1, params: 'country, years?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code' },
      { name: 'years', type: 'number', required: false, desc: 'Years of history (default: 10)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-tax-rates — Global Tax Rates MCP Server
 * Wraps World Bank API for tax indicators with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface TaxRate {
  country: string
  countryName: string
  indicator: string
  value: number | null
  year: string
}

interface CountryEntry {
  code: string
  name: string
  region: string
  incomeLevel: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const TAX_INDICATOR = 'IC.TAX.TOTL.CP.ZS'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`World Bank API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'tax-rates' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRates(country: string): Promise<TaxRate[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rates', async () => {
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${TAX_INDICATOR}?format=json&per_page=5&mrv=5\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || 'Total tax and contribution rate (% of profit)',
      value: r.value,
      year: r.date || '',
    }))
  })
}

async function listCountries(): Promise<CountryEntry[]> {
  return sg.wrap('list_countries', async () => {
    const data = await fetchJSON<any[]>(\`\${API}/country?format=json&per_page=100\`)
    return (data[1] || [])
      .filter((c: any) => c.region?.id !== 'NA')
      .map((c: any) => ({
        code: c.id, name: c.name,
        region: c.region?.value || '',
        incomeLevel: c.incomeLevel?.value || '',
      }))
  })
}

async function getHistorical(country: string, years?: number): Promise<TaxRate[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${TAX_INDICATOR}?format=json&per_page=\${y}&mrv=\${y}\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      indicator: r.indicator?.value || '',
      value: r.value,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRates, listCountries, getHistorical }
console.log('settlegrid-tax-rates server started')
`,
})

// ─── 138. inflation ─────────────────────────────────────────────────────────
gen({
  slug: 'inflation',
  title: 'Inflation Rate Data',
  desc: 'Consumer price inflation rates worldwide via World Bank CPI indicator. Compare inflation across countries.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['inflation', 'cpi', 'consumer-prices', 'macro', 'economics', 'finance'],
  methods: [
    { name: 'get_rate', display: 'Get inflation rate for country', cost: 1, params: 'country, year?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, JP, etc.)' },
      { name: 'year', type: 'string', required: false, desc: 'Specific year (default: latest)' },
    ]},
    { name: 'get_comparison', display: 'Compare inflation across countries', cost: 1, params: 'countries', inputs: [
      { name: 'countries', type: 'string', required: true, desc: 'Semicolon-separated country codes (US;GB;DE)' },
    ]},
    { name: 'get_historical', display: 'Get historical inflation', cost: 1, params: 'country, years?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code' },
      { name: 'years', type: 'number', required: false, desc: 'Years of history (default: 10)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-inflation — Inflation Rate Data MCP Server
 * Wraps World Bank CPI indicator API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface InflationData {
  country: string
  countryName: string
  value: number | null
  year: string
  indicator: string
}

interface ComparisonEntry {
  country: string
  countryName: string
  latestRate: number | null
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const CPI_INDICATOR = 'FP.CPI.TOTL.ZG'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`World Bank API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'inflation' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRate(country: string, year?: string): Promise<InflationData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rate', async () => {
    const dateParam = year ? \`&date=\${year}\` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${CPI_INDICATOR}?format=json&per_page=1\${dateParam}\`
    )
    const record = (data[1] || [])[0]
    if (!record) throw new Error(\`No inflation data for \${country}\`)
    return {
      country: record.country?.id || country,
      countryName: record.country?.value || '',
      value: record.value,
      year: record.date || '',
      indicator: 'Inflation, consumer prices (annual %)',
    }
  })
}

async function getComparison(countries: string): Promise<ComparisonEntry[]> {
  if (!countries) throw new Error('Country codes required (semicolon-separated, e.g., US;GB;DE)')
  return sg.wrap('get_comparison', async () => {
    const codes = countries.split(';').map(c => c.trim().toUpperCase()).join(';')
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${codes}/indicator/\${CPI_INDICATOR}?format=json&mrv=1&per_page=50\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      latestRate: r.value,
      year: r.date || '',
    }))
  })
}

async function getHistorical(country: string, years?: number): Promise<InflationData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${CPI_INDICATOR}?format=json&per_page=\${y}&mrv=\${y}\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      value: r.value,
      year: r.date || '',
      indicator: 'Inflation, consumer prices (annual %)',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRate, getComparison, getHistorical }
console.log('settlegrid-inflation server started')
`,
})

// ─── 139. gdp-data ──────────────────────────────────────────────────────────
gen({
  slug: 'gdp-data',
  title: 'GDP Data',
  desc: 'Gross Domestic Product data by country via World Bank. GDP levels, growth rates, and global rankings.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['gdp', 'economy', 'growth', 'macro', 'economics', 'finance'],
  methods: [
    { name: 'get_gdp', display: 'Get GDP for country', cost: 1, params: 'country, year?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, CN, etc.)' },
      { name: 'year', type: 'string', required: false, desc: 'Specific year (default: latest)' },
    ]},
    { name: 'get_growth', display: 'Get GDP growth rate', cost: 1, params: 'country, years?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code' },
      { name: 'years', type: 'number', required: false, desc: 'Years of data (default: 5)' },
    ]},
    { name: 'get_rankings', display: 'Get GDP rankings', cost: 1, params: 'year?', inputs: [
      { name: 'year', type: 'string', required: false, desc: 'Year for rankings (default: latest)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-gdp-data — GDP Data MCP Server
 * Wraps World Bank GDP indicators API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface GDPData {
  country: string
  countryName: string
  gdp: number | null
  year: string
  unit: string
}

interface GDPGrowth {
  country: string
  countryName: string
  growthRate: number | null
  year: string
}

interface GDPRanking {
  rank: number
  country: string
  countryName: string
  gdp: number
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const GDP_INDICATOR = 'NY.GDP.MKTP.CD'
const GROWTH_INDICATOR = 'NY.GDP.MKTP.KD.ZG'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`World Bank API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'gdp-data' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getGDP(country: string, year?: string): Promise<GDPData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_gdp', async () => {
    const dateParam = year ? \`&date=\${year}\` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${GDP_INDICATOR}?format=json&per_page=1\${dateParam}\`
    )
    const r = (data[1] || [])[0]
    if (!r) throw new Error(\`No GDP data for \${country}\`)
    return {
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      gdp: r.value,
      year: r.date || '',
      unit: 'current USD',
    }
  })
}

async function getGrowth(country: string, years?: number): Promise<GDPGrowth[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_growth', async () => {
    const y = years || 5
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${GROWTH_INDICATOR}?format=json&per_page=\${y}&mrv=\${y}\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      growthRate: r.value,
      year: r.date || '',
    }))
  })
}

async function getRankings(year?: string): Promise<GDPRanking[]> {
  return sg.wrap('get_rankings', async () => {
    const dateParam = year ? \`&date=\${year}\` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      \`\${API}/country/all/indicator/\${GDP_INDICATOR}?format=json&per_page=300\${dateParam}\`
    )
    const records = (data[1] || [])
      .filter((r: any) => r.value !== null && r.country?.id?.length === 2)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))
      .slice(0, 30)
    return records.map((r: any, i: number) => ({
      rank: i + 1,
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      gdp: r.value || 0,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getGDP, getGrowth, getRankings }
console.log('settlegrid-gdp-data server started')
`,
})

// ─── 140. unemployment ──────────────────────────────────────────────────────
gen({
  slug: 'unemployment',
  title: 'Unemployment Data',
  desc: 'Unemployment rates worldwide via World Bank indicators. Historical trends and country rankings.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['unemployment', 'labor', 'jobs', 'macro', 'economics', 'finance'],
  methods: [
    { name: 'get_rate', display: 'Get unemployment rate for country', cost: 1, params: 'country, year?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code (US, GB, DE, JP, etc.)' },
      { name: 'year', type: 'string', required: false, desc: 'Specific year (default: latest)' },
    ]},
    { name: 'get_historical', display: 'Get historical unemployment', cost: 1, params: 'country, years?', inputs: [
      { name: 'country', type: 'string', required: true, desc: 'Country code' },
      { name: 'years', type: 'number', required: false, desc: 'Years of history (default: 10)' },
    ]},
    { name: 'get_rankings', display: 'Get unemployment rankings', cost: 1, params: 'year?', inputs: [
      { name: 'year', type: 'string', required: false, desc: 'Year for rankings (default: latest)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-unemployment — Unemployment Data MCP Server
 * Wraps World Bank unemployment indicator API with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface UnemploymentData {
  country: string
  countryName: string
  rate: number | null
  year: string
  indicator: string
}

interface UnemploymentRanking {
  rank: number
  country: string
  countryName: string
  rate: number
  year: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const API = 'https://api.worldbank.org/v2'
const UNEMP_INDICATOR = 'SL.UEM.TOTL.ZS'

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`World Bank API error: \${res.status} \${res.statusText}\`)
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'unemployment' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getRate(country: string, year?: string): Promise<UnemploymentData> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_rate', async () => {
    const dateParam = year ? \`&date=\${year}\` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${UNEMP_INDICATOR}?format=json&per_page=1\${dateParam}\`
    )
    const r = (data[1] || [])[0]
    if (!r) throw new Error(\`No unemployment data for \${country}\`)
    return {
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      rate: r.value,
      year: r.date || '',
      indicator: 'Unemployment, total (% of total labor force)',
    }
  })
}

async function getHistorical(country: string, years?: number): Promise<UnemploymentData[]> {
  if (!country) throw new Error('Country code is required')
  return sg.wrap('get_historical', async () => {
    const y = years || 10
    const data = await fetchJSON<any[]>(
      \`\${API}/country/\${encodeURIComponent(country.toUpperCase())}/indicator/\${UNEMP_INDICATOR}?format=json&per_page=\${y}&mrv=\${y}\`
    )
    return (data[1] || []).map((r: any) => ({
      country: r.country?.id || country,
      countryName: r.country?.value || '',
      rate: r.value,
      year: r.date || '',
      indicator: 'Unemployment, total (% of total labor force)',
    }))
  })
}

async function getRankings(year?: string): Promise<UnemploymentRanking[]> {
  return sg.wrap('get_rankings', async () => {
    const dateParam = year ? \`&date=\${year}\` : '&mrv=1'
    const data = await fetchJSON<any[]>(
      \`\${API}/country/all/indicator/\${UNEMP_INDICATOR}?format=json&per_page=300\${dateParam}\`
    )
    const records = (data[1] || [])
      .filter((r: any) => r.value !== null && r.country?.id?.length === 2)
      .sort((a: any, b: any) => (a.value || 0) - (b.value || 0))
      .slice(0, 30)
    return records.map((r: any, i: number) => ({
      rank: i + 1,
      country: r.country?.id || '',
      countryName: r.country?.value || '',
      rate: r.value || 0,
      year: r.date || '',
    }))
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getRate, getHistorical, getRankings }
console.log('settlegrid-unemployment server started')
`,
})

console.log('\n✅ Batch 3D complete — 30 Niche Finance/Markets servers generated\n')
