/**
 * Batch Finance — 30 Finance-category MCP servers
 */

import { gen } from './gen/core.mjs'

console.log('Batch Finance: 30 Finance MCP servers\n')

// ─────────────────────────────────────────────────────────────────────────────
// 1. settlegrid-alpha-vantage
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'alpha-vantage',
  title: 'Alpha Vantage',
  desc: 'Stock quotes, time series, and fundamentals via the Alpha Vantage API.',
  api: { base: 'https://www.alphavantage.co/query', name: 'Alpha Vantage', docs: 'https://www.alphavantage.co/documentation/' },
  key: { env: 'ALPHA_VANTAGE_API_KEY', url: 'https://www.alphavantage.co/support/#api-key', required: true },
  keywords: ['finance', 'stocks', 'alpha-vantage', 'time-series'],
  methods: [
    { name: 'get_quote', display: 'Real-time stock quote', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker (e.g. AAPL)' }] },
    { name: 'get_daily', display: 'Daily time series prices', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
    { name: 'search_symbol', display: 'Search ticker symbols by keyword', cost: 2, params: 'keywords', inputs: [{ name: 'keywords', type: 'string', required: true, desc: 'Search keywords (e.g. apple)' }] },
  ],
  serverTs: `/**
 * settlegrid-alpha-vantage — Alpha Vantage Stock Data MCP Server
 *
 * Wraps the Alpha Vantage API with SettleGrid billing.
 * Requires ALPHA_VANTAGE_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)           — Real-time stock quote    (2¢)
 *   get_daily(symbol)           — Daily time series        (2¢)
 *   search_symbol(keywords)     — Search ticker symbols    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuoteInput { symbol: string }
interface DailyInput { symbol: string }
interface SearchInput { keywords: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.alphavantage.co/query'

function getKey(): string {
  const k = process.env.ALPHA_VANTAGE_API_KEY
  if (!k) throw new Error('ALPHA_VANTAGE_API_KEY environment variable is required')
  return k
}

async function avFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-alpha-vantage/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Alpha Vantage API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'alpha-vantage',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Real-time Quote' },
      get_daily: { costCents: 2, displayName: 'Daily Time Series' },
      search_symbol: { costCents: 2, displayName: 'Symbol Search' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: QuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'GLOBAL_QUOTE',
    symbol: args.symbol.toUpperCase().trim(),
  })
  const q = (data['Global Quote'] ?? data) as Record<string, string>
  return {
    symbol: q['01. symbol'] ?? args.symbol,
    price: q['05. price'],
    change: q['09. change'],
    changePercent: q['10. change percent'],
    volume: q['06. volume'],
    latestDay: q['07. latest trading day'],
  }
}, { method: 'get_quote' })

const getDaily = sg.wrap(async (args: DailyInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "MSFT")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'TIME_SERIES_DAILY',
    symbol: args.symbol.toUpperCase().trim(),
    outputsize: 'compact',
  })
  const ts = (data['Time Series (Daily)'] ?? {}) as Record<string, Record<string, string>>
  const days = Object.entries(ts).slice(0, 30).map(([date, v]) => ({
    date,
    open: v['1. open'],
    high: v['2. high'],
    low: v['3. low'],
    close: v['4. close'],
    volume: v['5. volume'],
  }))
  return { symbol: args.symbol.toUpperCase(), count: days.length, timeSeries: days }
}, { method: 'get_daily' })

const searchSymbol = sg.wrap(async (args: SearchInput) => {
  if (!args.keywords || typeof args.keywords !== 'string') {
    throw new Error('keywords is required (e.g. "apple")')
  }
  const data = await avFetch<Record<string, unknown>>({
    function: 'SYMBOL_SEARCH',
    keywords: args.keywords.trim(),
  })
  const matches = (data['bestMatches'] ?? []) as Array<Record<string, string>>
  return {
    query: args.keywords,
    count: matches.length,
    results: matches.map((m) => ({
      symbol: m['1. symbol'],
      name: m['2. name'],
      type: m['3. type'],
      region: m['4. region'],
      currency: m['8. currency'],
    })),
  }
}, { method: 'search_symbol' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getDaily, searchSymbol }

console.log('settlegrid-alpha-vantage MCP server ready')
console.log('Methods: get_quote, get_daily, search_symbol')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. settlegrid-finnhub
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'finnhub',
  title: 'Finnhub',
  desc: 'Real-time stock prices, company profiles, and news via Finnhub.',
  api: { base: 'https://finnhub.io/api/v1', name: 'Finnhub', docs: 'https://finnhub.io/docs/api' },
  key: { env: 'FINNHUB_API_KEY', url: 'https://finnhub.io/register', required: true },
  keywords: ['finance', 'stocks', 'finnhub', 'market-data'],
  methods: [
    { name: 'get_quote', display: 'Real-time stock quote', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker (e.g. AAPL)' }] },
    { name: 'get_company_profile', display: 'Company profile and fundamentals', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
    { name: 'get_company_news', display: 'Latest company news articles', cost: 2, params: 'symbol, from, to', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }, { name: 'from', type: 'string', required: true, desc: 'Start date (YYYY-MM-DD)' }, { name: 'to', type: 'string', required: true, desc: 'End date (YYYY-MM-DD)' }] },
  ],
  serverTs: `/**
 * settlegrid-finnhub — Finnhub Stock Data MCP Server
 *
 * Wraps the Finnhub API with SettleGrid billing.
 * Requires FINNHUB_API_KEY environment variable.
 *
 * Methods:
 *   get_quote(symbol)                 — Real-time quote         (2¢)
 *   get_company_profile(symbol)       — Company profile         (2¢)
 *   get_company_news(symbol,from,to)  — Company news            (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuoteInput { symbol: string }
interface ProfileInput { symbol: string }
interface NewsInput { symbol: string; from: string; to: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://finnhub.io/api/v1'

function getKey(): string {
  const k = process.env.FINNHUB_API_KEY
  if (!k) throw new Error('FINNHUB_API_KEY environment variable is required')
  return k
}

async function fhFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('token', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-finnhub/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Finnhub API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'finnhub',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Stock Quote' },
      get_company_profile: { costCents: 2, displayName: 'Company Profile' },
      get_company_news: { costCents: 2, displayName: 'Company News' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: QuoteInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fhFetch<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>('/quote', { symbol: args.symbol.toUpperCase().trim() })
  return {
    symbol: args.symbol.toUpperCase(),
    current: data.c,
    change: data.d,
    changePercent: data.dp,
    high: data.h,
    low: data.l,
    open: data.o,
    previousClose: data.pc,
    timestamp: data.t,
  }
}, { method: 'get_quote' })

const getCompanyProfile = sg.wrap(async (args: ProfileInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fhFetch<Record<string, unknown>>('/stock/profile2', { symbol: args.symbol.toUpperCase().trim() })
  return data
}, { method: 'get_company_profile' })

const getCompanyNews = sg.wrap(async (args: NewsInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required')
  }
  if (!args.from || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.from)) {
    throw new Error('from is required (YYYY-MM-DD)')
  }
  if (!args.to || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.to)) {
    throw new Error('to is required (YYYY-MM-DD)')
  }
  const data = await fhFetch<Array<Record<string, unknown>>>('/company-news', {
    symbol: args.symbol.toUpperCase().trim(),
    from: args.from,
    to: args.to,
  })
  const items = Array.isArray(data) ? data.slice(0, 20) : []
  return { symbol: args.symbol.toUpperCase(), from: args.from, to: args.to, count: items.length, articles: items }
}, { method: 'get_company_news' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getCompanyProfile, getCompanyNews }

console.log('settlegrid-finnhub MCP server ready')
console.log('Methods: get_quote, get_company_profile, get_company_news')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. settlegrid-coingecko
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'coingecko',
  title: 'CoinGecko',
  desc: 'Cryptocurrency prices, market data, and exchange info via the free CoinGecko API.',
  api: { base: 'https://api.coingecko.com/api/v3', name: 'CoinGecko', docs: 'https://www.coingecko.com/en/api/documentation' },
  key: null,
  keywords: ['finance', 'crypto', 'coingecko', 'bitcoin', 'ethereum'],
  methods: [
    { name: 'get_price', display: 'Current price for coins', cost: 1, params: 'ids, currency', inputs: [{ name: 'ids', type: 'string', required: true, desc: 'Comma-separated coin IDs (e.g. bitcoin,ethereum)' }, { name: 'currency', type: 'string', required: true, desc: 'Target currency (e.g. usd)' }] },
    { name: 'get_coin', display: 'Detailed coin data', cost: 1, params: 'id', inputs: [{ name: 'id', type: 'string', required: true, desc: 'Coin ID (e.g. bitcoin)' }] },
    { name: 'get_trending', display: 'Trending coins', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-coingecko — CoinGecko Crypto MCP Server
 *
 * Wraps the free CoinGecko API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_price(ids, currency)   — Current prices          (1¢)
 *   get_coin(id)               — Detailed coin data      (1¢)
 *   get_trending()             — Trending coins           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PriceInput { ids: string; currency: string }
interface CoinInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.coingecko.com/api/v3'

async function cgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-coingecko/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`CoinGecko API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coingecko',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_price: { costCents: 1, displayName: 'Coin Prices' },
      get_coin: { costCents: 1, displayName: 'Coin Details' },
      get_trending: { costCents: 1, displayName: 'Trending Coins' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPrice = sg.wrap(async (args: PriceInput) => {
  if (!args.ids || typeof args.ids !== 'string') {
    throw new Error('ids is required (comma-separated coin IDs, e.g. "bitcoin,ethereum")')
  }
  if (!args.currency || typeof args.currency !== 'string') {
    throw new Error('currency is required (e.g. "usd")')
  }
  const data = await cgFetch<Record<string, Record<string, number>>>('/simple/price', {
    ids: args.ids.toLowerCase().trim(),
    vs_currencies: args.currency.toLowerCase().trim(),
    include_24hr_change: 'true',
    include_market_cap: 'true',
  })
  return { currency: args.currency.toLowerCase(), prices: data }
}, { method: 'get_price' })

const getCoin = sg.wrap(async (args: CoinInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "bitcoin")')
  }
  const data = await cgFetch<Record<string, unknown>>(\`/coins/\${encodeURIComponent(args.id.toLowerCase().trim())}\`, {
    localization: 'false',
    tickers: 'false',
    community_data: 'false',
    developer_data: 'false',
  })
  return data
}, { method: 'get_coin' })

const getTrending = sg.wrap(async () => {
  const data = await cgFetch<{ coins: Array<{ item: Record<string, unknown> }> }>('/search/trending')
  return {
    coins: (data.coins ?? []).map((c) => c.item),
  }
}, { method: 'get_trending' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPrice, getCoin, getTrending }

console.log('settlegrid-coingecko MCP server ready')
console.log('Methods: get_price, get_coin, get_trending')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. settlegrid-coinmarketcap
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'coinmarketcap',
  title: 'CoinMarketCap',
  desc: 'Cryptocurrency rankings, market cap, and metadata via CoinMarketCap.',
  api: { base: 'https://pro-api.coinmarketcap.com/v1', name: 'CoinMarketCap', docs: 'https://coinmarketcap.com/api/documentation/v1/' },
  key: { env: 'CMC_API_KEY', url: 'https://coinmarketcap.com/api/', required: true },
  keywords: ['finance', 'crypto', 'coinmarketcap', 'market-cap'],
  methods: [
    { name: 'get_listings', display: 'Top cryptocurrencies by market cap', cost: 2, params: 'limit', inputs: [{ name: 'limit', type: 'number', required: false, desc: 'Number of results (default 20, max 100)' }] },
    { name: 'get_quotes', display: 'Quote for specific coin(s)', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Comma-separated symbols (e.g. BTC,ETH)' }] },
    { name: 'get_metadata', display: 'Coin metadata and description', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Coin symbol (e.g. BTC)' }] },
  ],
  serverTs: `/**
 * settlegrid-coinmarketcap — CoinMarketCap MCP Server
 *
 * Wraps the CoinMarketCap API with SettleGrid billing.
 * Requires CMC_API_KEY (header: X-CMC_PRO_API_KEY).
 *
 * Methods:
 *   get_listings(limit?)       — Top cryptos by market cap  (2¢)
 *   get_quotes(symbol)         — Quote for specific coins   (2¢)
 *   get_metadata(symbol)       — Coin metadata              (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListingsInput { limit?: number }
interface QuotesInput { symbol: string }
interface MetadataInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://pro-api.coinmarketcap.com/v1'

function getKey(): string {
  const k = process.env.CMC_API_KEY
  if (!k) throw new Error('CMC_API_KEY environment variable is required')
  return k
}

async function cmcFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: {
      'X-CMC_PRO_API_KEY': getKey(),
      Accept: 'application/json',
      'User-Agent': 'settlegrid-coinmarketcap/1.0 (contact@settlegrid.ai)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`CoinMarketCap API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinmarketcap',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_listings: { costCents: 2, displayName: 'Crypto Listings' },
      get_quotes: { costCents: 2, displayName: 'Crypto Quotes' },
      get_metadata: { costCents: 2, displayName: 'Coin Metadata' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getListings = sg.wrap(async (args: ListingsInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await cmcFetch<{ data: Array<Record<string, unknown>> }>('/cryptocurrency/listings/latest', {
    limit: String(limit),
    convert: 'USD',
  })
  return { count: data.data.length, listings: data.data }
}, { method: 'get_listings' })

const getQuotes = sg.wrap(async (args: QuotesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTC" or "BTC,ETH")')
  }
  const data = await cmcFetch<{ data: Record<string, unknown> }>('/cryptocurrency/quotes/latest', {
    symbol: args.symbol.toUpperCase().trim(),
    convert: 'USD',
  })
  return data.data
}, { method: 'get_quotes' })

const getMetadata = sg.wrap(async (args: MetadataInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTC")')
  }
  const data = await cmcFetch<{ data: Record<string, unknown> }>('/cryptocurrency/info', {
    symbol: args.symbol.toUpperCase().trim(),
  })
  return data.data
}, { method: 'get_metadata' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getListings, getQuotes, getMetadata }

console.log('settlegrid-coinmarketcap MCP server ready')
console.log('Methods: get_listings, get_quotes, get_metadata')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. settlegrid-binance
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'binance',
  title: 'Binance',
  desc: 'Crypto trading data, order books, and ticker prices via the public Binance API.',
  api: { base: 'https://api.binance.com/api/v3', name: 'Binance', docs: 'https://binance-docs.github.io/apidocs/spot/en/' },
  key: null,
  keywords: ['finance', 'crypto', 'binance', 'trading', 'orderbook'],
  methods: [
    { name: 'get_ticker', display: '24hr ticker price change', cost: 1, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Trading pair (e.g. BTCUSDT)' }] },
    { name: 'get_depth', display: 'Order book depth', cost: 1, params: 'symbol, limit', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Trading pair (e.g. ETHUSDT)' }, { name: 'limit', type: 'number', required: false, desc: 'Depth limit (5, 10, 20, 50, default 20)' }] },
    { name: 'get_klines', display: 'Candlestick/kline data', cost: 1, params: 'symbol, interval', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Trading pair' }, { name: 'interval', type: 'string', required: true, desc: 'Interval (1m, 5m, 1h, 1d, etc.)' }] },
  ],
  serverTs: `/**
 * settlegrid-binance — Binance Public Market Data MCP Server
 *
 * Wraps the public Binance API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_ticker(symbol)              — 24hr ticker         (1¢)
 *   get_depth(symbol, limit?)       — Order book depth    (1¢)
 *   get_klines(symbol, interval)    — Candlestick data    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TickerInput { symbol: string }
interface DepthInput { symbol: string; limit?: number }
interface KlinesInput { symbol: string; interval: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.binance.com/api/v3'

async function bnFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-binance/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Binance API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'binance',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker: { costCents: 1, displayName: '24hr Ticker' },
      get_depth: { costCents: 1, displayName: 'Order Book' },
      get_klines: { costCents: 1, displayName: 'Candlestick Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: TickerInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const data = await bnFetch<Record<string, string>>('/ticker/24hr', { symbol: args.symbol.toUpperCase().trim() })
  return {
    symbol: data.symbol,
    priceChange: data.priceChange,
    priceChangePercent: data.priceChangePercent,
    lastPrice: data.lastPrice,
    highPrice: data.highPrice,
    lowPrice: data.lowPrice,
    volume: data.volume,
    quoteVolume: data.quoteVolume,
  }
}, { method: 'get_ticker' })

const getDepth = sg.wrap(async (args: DepthInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 5), 50)
  const data = await bnFetch<{ bids: string[][]; asks: string[][] }>('/depth', {
    symbol: args.symbol.toUpperCase().trim(),
    limit: String(limit),
  })
  return {
    symbol: args.symbol.toUpperCase(),
    bids: data.bids.map(([price, qty]) => ({ price, quantity: qty })),
    asks: data.asks.map(([price, qty]) => ({ price, quantity: qty })),
  }
}, { method: 'get_depth' })

const getKlines = sg.wrap(async (args: KlinesInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "BTCUSDT")')
  }
  const validIntervals = new Set(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M'])
  if (!args.interval || !validIntervals.has(args.interval)) {
    throw new Error('interval is required (1m, 5m, 15m, 1h, 4h, 1d, 1w, etc.)')
  }
  const data = await bnFetch<Array<Array<string | number>>>('/klines', {
    symbol: args.symbol.toUpperCase().trim(),
    interval: args.interval,
    limit: '50',
  })
  return {
    symbol: args.symbol.toUpperCase(),
    interval: args.interval,
    candles: data.map((k) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
    })),
  }
}, { method: 'get_klines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getDepth, getKlines }

console.log('settlegrid-binance MCP server ready')
console.log('Methods: get_ticker, get_depth, get_klines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. settlegrid-kraken
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'kraken',
  title: 'Kraken',
  desc: 'Crypto market data, OHLC, and ticker info via the public Kraken API.',
  api: { base: 'https://api.kraken.com/0/public', name: 'Kraken', docs: 'https://docs.kraken.com/rest/' },
  key: null,
  keywords: ['finance', 'crypto', 'kraken', 'trading', 'ohlc'],
  methods: [
    { name: 'get_ticker', display: 'Ticker info for trading pair', cost: 1, params: 'pair', inputs: [{ name: 'pair', type: 'string', required: true, desc: 'Trading pair (e.g. XBTUSD)' }] },
    { name: 'get_ohlc', display: 'OHLC candlestick data', cost: 1, params: 'pair, interval', inputs: [{ name: 'pair', type: 'string', required: true, desc: 'Trading pair (e.g. XBTUSD)' }, { name: 'interval', type: 'number', required: false, desc: 'Interval in minutes (1, 5, 15, 30, 60, 240, 1440, default 60)' }] },
    { name: 'get_assets', display: 'List available assets', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-kraken — Kraken Public Market Data MCP Server
 *
 * Wraps the public Kraken API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_ticker(pair)              — Ticker info          (1¢)
 *   get_ohlc(pair, interval?)     — OHLC candles         (1¢)
 *   get_assets()                  — List assets          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TickerInput { pair: string }
interface OhlcInput { pair: string; interval?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.kraken.com/0/public'

async function krFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-kraken/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Kraken API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as { error: string[]; result: T }
  if (json.error && json.error.length > 0) {
    throw new Error(\`Kraken API error: \${json.error.join(', ')}\`)
  }
  return json.result
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'kraken',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ticker: { costCents: 1, displayName: 'Ticker Info' },
      get_ohlc: { costCents: 1, displayName: 'OHLC Data' },
      get_assets: { costCents: 1, displayName: 'List Assets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTicker = sg.wrap(async (args: TickerInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (e.g. "XBTUSD")')
  }
  const data = await krFetch<Record<string, Record<string, unknown>>>('/Ticker', { pair: args.pair.toUpperCase().trim() })
  return { pair: args.pair.toUpperCase(), ticker: data }
}, { method: 'get_ticker' })

const getOhlc = sg.wrap(async (args: OhlcInput) => {
  if (!args.pair || typeof args.pair !== 'string') {
    throw new Error('pair is required (e.g. "XBTUSD")')
  }
  const validIntervals = new Set([1, 5, 15, 30, 60, 240, 1440, 10080, 21600])
  const interval = args.interval ?? 60
  if (!validIntervals.has(interval)) {
    throw new Error('interval must be one of: 1, 5, 15, 30, 60, 240, 1440, 10080, 21600')
  }
  const data = await krFetch<Record<string, unknown>>('/OHLC', {
    pair: args.pair.toUpperCase().trim(),
    interval: String(interval),
  })
  return { pair: args.pair.toUpperCase(), interval, data }
}, { method: 'get_ohlc' })

const getAssets = sg.wrap(async () => {
  const data = await krFetch<Record<string, Record<string, unknown>>>('/Assets')
  return { count: Object.keys(data).length, assets: data }
}, { method: 'get_assets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTicker, getOhlc, getAssets }

console.log('settlegrid-kraken MCP server ready')
console.log('Methods: get_ticker, get_ohlc, get_assets')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. settlegrid-etherscan
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'etherscan',
  title: 'Etherscan',
  desc: 'Ethereum blockchain data, balances, and transactions via Etherscan.',
  api: { base: 'https://api.etherscan.io/api', name: 'Etherscan', docs: 'https://docs.etherscan.io/' },
  key: { env: 'ETHERSCAN_API_KEY', url: 'https://etherscan.io/apis', required: true },
  keywords: ['finance', 'crypto', 'ethereum', 'blockchain', 'etherscan'],
  methods: [
    { name: 'get_balance', display: 'ETH balance for address', cost: 2, params: 'address', inputs: [{ name: 'address', type: 'string', required: true, desc: 'Ethereum address (0x...)' }] },
    { name: 'get_transactions', display: 'Transaction list for address', cost: 2, params: 'address', inputs: [{ name: 'address', type: 'string', required: true, desc: 'Ethereum address' }] },
    { name: 'get_gas_price', display: 'Current gas price oracle', cost: 2, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-etherscan — Etherscan Blockchain Data MCP Server
 *
 * Wraps the Etherscan API with SettleGrid billing.
 * Requires ETHERSCAN_API_KEY environment variable.
 *
 * Methods:
 *   get_balance(address)          — ETH balance           (2¢)
 *   get_transactions(address)     — Transaction list      (2¢)
 *   get_gas_price()               — Gas price oracle      (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BalanceInput { address: string }
interface TxInput { address: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.etherscan.io/api'

function getKey(): string {
  const k = process.env.ETHERSCAN_API_KEY
  if (!k) throw new Error('ETHERSCAN_API_KEY environment variable is required')
  return k
}

async function esFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-etherscan/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Etherscan API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as { status: string; message: string; result: T }
  if (json.status === '0' && json.message === 'NOTOK') {
    throw new Error(\`Etherscan error: \${String(json.result).slice(0, 200)}\`)
  }
  return json.result
}

function validateAddress(addr: string): string {
  const trimmed = addr.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error('Invalid Ethereum address. Must be 0x followed by 40 hex characters.')
  }
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'etherscan',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_balance: { costCents: 2, displayName: 'ETH Balance' },
      get_transactions: { costCents: 2, displayName: 'Transactions' },
      get_gas_price: { costCents: 2, displayName: 'Gas Price' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBalance = sg.wrap(async (args: BalanceInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required (Ethereum address starting with 0x)')
  }
  const address = validateAddress(args.address)
  const weiBalance = await esFetch<string>({ module: 'account', action: 'balance', address, tag: 'latest' })
  const ethBalance = Number(weiBalance) / 1e18
  return { address, balanceWei: weiBalance, balanceEth: ethBalance }
}, { method: 'get_balance' })

const getTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address || typeof args.address !== 'string') {
    throw new Error('address is required')
  }
  const address = validateAddress(args.address)
  const txs = await esFetch<Array<Record<string, string>>>({
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '20',
    sort: 'desc',
  })
  return {
    address,
    count: Array.isArray(txs) ? txs.length : 0,
    transactions: Array.isArray(txs) ? txs : [],
  }
}, { method: 'get_transactions' })

const getGasPrice = sg.wrap(async () => {
  const data = await esFetch<Record<string, string>>({ module: 'gastracker', action: 'gasoracle' })
  return {
    safeGasPrice: data.SafeGasPrice,
    proposeGasPrice: data.ProposeGasPrice,
    fastGasPrice: data.FastGasPrice,
    suggestBaseFee: data.suggestBaseFee,
  }
}, { method: 'get_gas_price' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBalance, getTransactions, getGasPrice }

console.log('settlegrid-etherscan MCP server ready')
console.log('Methods: get_balance, get_transactions, get_gas_price')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. settlegrid-polygon-io
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'polygon-io',
  title: 'Polygon.io',
  desc: 'Stock, options, and forex market data via the Polygon.io API.',
  api: { base: 'https://api.polygon.io', name: 'Polygon.io', docs: 'https://polygon.io/docs' },
  key: { env: 'POLYGON_API_KEY', url: 'https://polygon.io/dashboard/signup', required: true },
  keywords: ['finance', 'stocks', 'polygon', 'forex', 'options'],
  methods: [
    { name: 'get_ticker_details', display: 'Ticker details and company info', cost: 2, params: 'ticker', inputs: [{ name: 'ticker', type: 'string', required: true, desc: 'Stock ticker (e.g. AAPL)' }] },
    { name: 'get_daily_bars', display: 'Daily OHLCV bars', cost: 2, params: 'ticker, from, to', inputs: [{ name: 'ticker', type: 'string', required: true, desc: 'Stock ticker' }, { name: 'from', type: 'string', required: true, desc: 'Start date (YYYY-MM-DD)' }, { name: 'to', type: 'string', required: true, desc: 'End date (YYYY-MM-DD)' }] },
    { name: 'get_previous_close', display: 'Previous day close price', cost: 2, params: 'ticker', inputs: [{ name: 'ticker', type: 'string', required: true, desc: 'Stock ticker' }] },
  ],
  serverTs: `/**
 * settlegrid-polygon-io — Polygon.io Market Data MCP Server
 *
 * Wraps the Polygon.io API with SettleGrid billing.
 * Requires POLYGON_API_KEY environment variable.
 *
 * Methods:
 *   get_ticker_details(ticker)        — Ticker details     (2¢)
 *   get_daily_bars(ticker, from, to)  — Daily OHLCV bars   (2¢)
 *   get_previous_close(ticker)        — Previous close     (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DetailsInput { ticker: string }
interface BarsInput { ticker: string; from: string; to: string }
interface PrevCloseInput { ticker: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.polygon.io'

function getKey(): string {
  const k = process.env.POLYGON_API_KEY
  if (!k) throw new Error('POLYGON_API_KEY environment variable is required')
  return k
}

async function pgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('apiKey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-polygon-io/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Polygon.io API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'polygon-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_ticker_details: { costCents: 2, displayName: 'Ticker Details' },
      get_daily_bars: { costCents: 2, displayName: 'Daily Bars' },
      get_previous_close: { costCents: 2, displayName: 'Previous Close' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTickerDetails = sg.wrap(async (args: DetailsInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (e.g. "AAPL")')
  }
  const data = await pgFetch<{ results: Record<string, unknown> }>(\`/v3/reference/tickers/\${encodeURIComponent(args.ticker.toUpperCase().trim())}\`)
  return data.results
}, { method: 'get_ticker_details' })

const getDailyBars = sg.wrap(async (args: BarsInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required')
  }
  if (!args.from || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.from)) {
    throw new Error('from is required (YYYY-MM-DD)')
  }
  if (!args.to || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.to)) {
    throw new Error('to is required (YYYY-MM-DD)')
  }
  const ticker = args.ticker.toUpperCase().trim()
  const data = await pgFetch<{ results: Array<Record<string, unknown>>; resultsCount: number }>(
    \`/v2/aggs/ticker/\${encodeURIComponent(ticker)}/range/1/day/\${args.from}/\${args.to}\`
  )
  return { ticker, from: args.from, to: args.to, count: data.resultsCount, bars: data.results ?? [] }
}, { method: 'get_daily_bars' })

const getPreviousClose = sg.wrap(async (args: PrevCloseInput) => {
  if (!args.ticker || typeof args.ticker !== 'string') {
    throw new Error('ticker is required (e.g. "AAPL")')
  }
  const ticker = args.ticker.toUpperCase().trim()
  const data = await pgFetch<{ results: Array<Record<string, unknown>> }>(
    \`/v2/aggs/ticker/\${encodeURIComponent(ticker)}/prev\`
  )
  return { ticker, previousClose: data.results?.[0] ?? null }
}, { method: 'get_previous_close' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTickerDetails, getDailyBars, getPreviousClose }

console.log('settlegrid-polygon-io MCP server ready')
console.log('Methods: get_ticker_details, get_daily_bars, get_previous_close')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. settlegrid-open-exchange-rates
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'open-exchange-rates',
  title: 'Open Exchange Rates',
  desc: 'Currency exchange rates and historical data via Open Exchange Rates.',
  api: { base: 'https://openexchangerates.org/api', name: 'Open Exchange Rates', docs: 'https://docs.openexchangerates.org/' },
  key: { env: 'OXR_APP_ID', url: 'https://openexchangerates.org/signup', required: true },
  keywords: ['finance', 'forex', 'currency', 'exchange-rates'],
  methods: [
    { name: 'get_latest', display: 'Latest exchange rates', cost: 2, params: 'base', inputs: [{ name: 'base', type: 'string', required: false, desc: 'Base currency (default USD)' }] },
    { name: 'get_historical', display: 'Historical rates for a date', cost: 2, params: 'date, base', inputs: [{ name: 'date', type: 'string', required: true, desc: 'Date (YYYY-MM-DD)' }, { name: 'base', type: 'string', required: false, desc: 'Base currency (default USD)' }] },
    { name: 'get_currencies', display: 'List all supported currencies', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-open-exchange-rates — Open Exchange Rates MCP Server
 *
 * Wraps the Open Exchange Rates API with SettleGrid billing.
 * Requires OXR_APP_ID environment variable.
 *
 * Methods:
 *   get_latest(base?)              — Latest rates         (2¢)
 *   get_historical(date, base?)    — Historical rates     (2¢)
 *   get_currencies()               — List currencies      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string }
interface HistoricalInput { date: string; base?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://openexchangerates.org/api'

function getKey(): string {
  const k = process.env.OXR_APP_ID
  if (!k) throw new Error('OXR_APP_ID environment variable is required')
  return k
}

async function oxrFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('app_id', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-open-exchange-rates/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Open Exchange Rates API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-exchange-rates',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_currencies: { costCents: 1, displayName: 'List Currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await oxrFetch<{ base: string; timestamp: number; rates: Record<string, number> }>('/latest.json', params)
  return { base: data.base, timestamp: data.timestamp, rates: data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD format)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await oxrFetch<{ base: string; timestamp: number; rates: Record<string, number> }>(\`/historical/\${args.date}.json\`, params)
  return { date: args.date, base: data.base, timestamp: data.timestamp, rates: data.rates }
}, { method: 'get_historical' })

const getCurrencies = sg.wrap(async () => {
  const data = await oxrFetch<Record<string, string>>('/currencies.json')
  return { count: Object.keys(data).length, currencies: data }
}, { method: 'get_currencies' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getCurrencies }

console.log('settlegrid-open-exchange-rates MCP server ready')
console.log('Methods: get_latest, get_historical, get_currencies')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. settlegrid-financial-modeling
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'financial-modeling',
  title: 'Financial Modeling Prep',
  desc: 'Company financials, DCF valuations, and stock data via Financial Modeling Prep.',
  api: { base: 'https://financialmodelingprep.com/api/v3', name: 'Financial Modeling Prep', docs: 'https://site.financialmodelingprep.com/developer/docs' },
  key: { env: 'FMP_API_KEY', url: 'https://site.financialmodelingprep.com/developer/docs', required: true },
  keywords: ['finance', 'stocks', 'financials', 'dcf', 'fundamentals'],
  methods: [
    { name: 'get_profile', display: 'Company profile', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker (e.g. AAPL)' }] },
    { name: 'get_income_statement', display: 'Income statement', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
    { name: 'get_dcf', display: 'Discounted cash flow valuation', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
  ],
  serverTs: `/**
 * settlegrid-financial-modeling — Financial Modeling Prep MCP Server
 *
 * Wraps the Financial Modeling Prep API with SettleGrid billing.
 * Requires FMP_API_KEY environment variable.
 *
 * Methods:
 *   get_profile(symbol)            — Company profile       (2¢)
 *   get_income_statement(symbol)   — Income statement      (2¢)
 *   get_dcf(symbol)                — DCF valuation         (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://financialmodelingprep.com/api/v3'

function getKey(): string {
  const k = process.env.FMP_API_KEY
  if (!k) throw new Error('FMP_API_KEY environment variable is required')
  return k
}

async function fmpFetch<T>(path: string): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('apikey', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-financial-modeling/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FMP API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'financial-modeling',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_profile: { costCents: 2, displayName: 'Company Profile' },
      get_income_statement: { costCents: 2, displayName: 'Income Statement' },
      get_dcf: { costCents: 2, displayName: 'DCF Valuation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getProfile = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(\`/profile/\${encodeURIComponent(args.symbol.toUpperCase().trim())}\`)
  return data[0] ?? null
}, { method: 'get_profile' })

const getIncomeStatement = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(\`/income-statement/\${encodeURIComponent(args.symbol.toUpperCase().trim())}?limit=5\`)
  return { symbol: args.symbol.toUpperCase(), count: data.length, statements: data }
}, { method: 'get_income_statement' })

const getDcf = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const data = await fmpFetch<Array<Record<string, unknown>>>(\`/discounted-cash-flow/\${encodeURIComponent(args.symbol.toUpperCase().trim())}\`)
  return data[0] ?? null
}, { method: 'get_dcf' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getProfile, getIncomeStatement, getDcf }

console.log('settlegrid-financial-modeling MCP server ready')
console.log('Methods: get_profile, get_income_statement, get_dcf')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. settlegrid-iex-cloud
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'iex-cloud',
  title: 'IEX Cloud',
  desc: 'Stock data, company info, and market statistics via IEX Cloud.',
  api: { base: 'https://cloud.iexapis.com/stable', name: 'IEX Cloud', docs: 'https://iexcloud.io/docs/api/' },
  key: { env: 'IEX_TOKEN', url: 'https://iexcloud.io/cloud-login#/register', required: true },
  keywords: ['finance', 'stocks', 'iex', 'market-data'],
  methods: [
    { name: 'get_quote', display: 'Real-time stock quote', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker (e.g. AAPL)' }] },
    { name: 'get_company', display: 'Company information', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
    { name: 'get_stats', display: 'Key financial statistics', cost: 2, params: 'symbol', inputs: [{ name: 'symbol', type: 'string', required: true, desc: 'Stock ticker' }] },
  ],
  serverTs: `/**
 * settlegrid-iex-cloud — IEX Cloud Stock Data MCP Server
 *
 * Wraps the IEX Cloud API with SettleGrid billing.
 * Requires IEX_TOKEN environment variable.
 *
 * Methods:
 *   get_quote(symbol)      — Real-time quote     (2¢)
 *   get_company(symbol)    — Company info         (2¢)
 *   get_stats(symbol)      — Key statistics       (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SymbolInput { symbol: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://cloud.iexapis.com/stable'

function getKey(): string {
  const k = process.env.IEX_TOKEN
  if (!k) throw new Error('IEX_TOKEN environment variable is required')
  return k
}

async function iexFetch<T>(path: string): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('token', getKey())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-iex-cloud/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IEX Cloud API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'iex-cloud',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_quote: { costCents: 2, displayName: 'Stock Quote' },
      get_company: { costCents: 2, displayName: 'Company Info' },
      get_stats: { costCents: 2, displayName: 'Key Stats' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getQuote = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(\`/stock/\${sym}/quote\`)
  return data
}, { method: 'get_quote' })

const getCompany = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(\`/stock/\${sym}/company\`)
  return data
}, { method: 'get_company' })

const getStats = sg.wrap(async (args: SymbolInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. "AAPL")')
  }
  const sym = encodeURIComponent(args.symbol.toUpperCase().trim())
  const data = await iexFetch<Record<string, unknown>>(\`/stock/\${sym}/stats\`)
  return data
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getQuote, getCompany, getStats }

console.log('settlegrid-iex-cloud MCP server ready')
console.log('Methods: get_quote, get_company, get_stats')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. settlegrid-sec-edgar
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'sec-edgar',
  title: 'SEC EDGAR',
  desc: 'SEC filings, company submissions, and full-text search via EDGAR.',
  api: { base: 'https://efts.sec.gov/LATEST', name: 'SEC EDGAR', docs: 'https://efts.sec.gov/LATEST/search-index?q=%22API%22' },
  key: null,
  keywords: ['finance', 'sec', 'edgar', 'filings', 'regulatory'],
  methods: [
    { name: 'search_filings', display: 'Full-text search of SEC filings', cost: 1, params: 'query, dateRange', inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search query' }, { name: 'dateRange', type: 'string', required: false, desc: 'Date range (e.g. "2024-01-01,2024-12-31")' }] },
    { name: 'get_submissions', display: 'Company filing submissions by CIK', cost: 1, params: 'cik', inputs: [{ name: 'cik', type: 'string', required: true, desc: 'SEC CIK number (e.g. "0000320193" for Apple)' }] },
    { name: 'get_company_facts', display: 'XBRL facts for a company', cost: 1, params: 'cik', inputs: [{ name: 'cik', type: 'string', required: true, desc: 'SEC CIK number' }] },
  ],
  serverTs: `/**
 * settlegrid-sec-edgar — SEC EDGAR Filing Search MCP Server
 *
 * Wraps the SEC EDGAR full-text search and submissions APIs.
 * No API key needed. User-Agent header required by SEC.
 *
 * Methods:
 *   search_filings(query, dateRange?)   — Full-text search   (1¢)
 *   get_submissions(cik)                — Company filings    (1¢)
 *   get_company_facts(cik)              — XBRL facts         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; dateRange?: string }
interface CikInput { cik: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const EFTS_BASE = 'https://efts.sec.gov/LATEST'
const DATA_BASE = 'https://data.sec.gov'
const UA = 'settlegrid-sec-edgar/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SEC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  const digits = cik.replace(/\\D/g, '')
  return digits.padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-edgar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_filings: { costCents: 1, displayName: 'Search Filings' },
      get_submissions: { costCents: 1, displayName: 'Company Submissions' },
      get_company_facts: { costCents: 1, displayName: 'Company XBRL Facts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFilings = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const url = new URL(\`\${EFTS_BASE}/search-index\`)
  url.searchParams.set('q', args.query.trim())
  if (args.dateRange) url.searchParams.set('dateRange', args.dateRange)
  url.searchParams.set('from', '0')
  url.searchParams.set('size', '20')
  const data = await secFetch<Record<string, unknown>>(url.toString())
  return data
}, { method: 'search_filings' })

const getSubmissions = sg.wrap(async (args: CikInput) => {
  if (!args.cik || typeof args.cik !== 'string') {
    throw new Error('cik is required (e.g. "0000320193")')
  }
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(\`\${DATA_BASE}/submissions/CIK\${cik}.json\`)
  return data
}, { method: 'get_submissions' })

const getCompanyFacts = sg.wrap(async (args: CikInput) => {
  if (!args.cik || typeof args.cik !== 'string') {
    throw new Error('cik is required (e.g. "0000320193")')
  }
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(\`\${DATA_BASE}/api/xbrl/companyfacts/CIK\${cik}.json\`)
  return data
}, { method: 'get_company_facts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFilings, getSubmissions, getCompanyFacts }

console.log('settlegrid-sec-edgar MCP server ready')
console.log('Methods: search_filings, get_submissions, get_company_facts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 13. settlegrid-sec-xbrl
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'sec-xbrl',
  title: 'SEC XBRL',
  desc: 'XBRL financial data, company concepts, and reporting frames from SEC.',
  api: { base: 'https://data.sec.gov', name: 'SEC XBRL', docs: 'https://www.sec.gov/edgar/sec-api-documentation' },
  key: null,
  keywords: ['finance', 'sec', 'xbrl', 'financial-data', 'accounting'],
  methods: [
    { name: 'get_company_concept', display: 'Single XBRL concept for a company', cost: 1, params: 'cik, taxonomy, tag', inputs: [{ name: 'cik', type: 'string', required: true, desc: 'SEC CIK number' }, { name: 'taxonomy', type: 'string', required: true, desc: 'Taxonomy (e.g. us-gaap)' }, { name: 'tag', type: 'string', required: true, desc: 'XBRL tag (e.g. Revenue)' }] },
    { name: 'get_frames', display: 'Cross-company data for one concept/period', cost: 1, params: 'taxonomy, tag, unit, period', inputs: [{ name: 'taxonomy', type: 'string', required: true, desc: 'Taxonomy (e.g. us-gaap)' }, { name: 'tag', type: 'string', required: true, desc: 'XBRL tag' }, { name: 'unit', type: 'string', required: true, desc: 'Unit (e.g. USD)' }, { name: 'period', type: 'string', required: true, desc: 'Period (e.g. CY2023Q1I)' }] },
    { name: 'get_company_facts', display: 'All XBRL facts for a company', cost: 1, params: 'cik', inputs: [{ name: 'cik', type: 'string', required: true, desc: 'SEC CIK number' }] },
  ],
  serverTs: `/**
 * settlegrid-sec-xbrl — SEC XBRL Financial Data MCP Server
 *
 * Wraps the SEC XBRL API for structured financial data.
 * No API key needed. User-Agent required.
 *
 * Methods:
 *   get_company_concept(cik, taxonomy, tag)       — Single concept   (1¢)
 *   get_frames(taxonomy, tag, unit, period)       — Cross-company    (1¢)
 *   get_company_facts(cik)                        — All facts        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConceptInput { cik: string; taxonomy: string; tag: string }
interface FramesInput { taxonomy: string; tag: string; unit: string; period: string }
interface FactsInput { cik: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.sec.gov'
const UA = 'settlegrid-sec-xbrl/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SEC XBRL API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/\\D/g, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-xbrl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_company_concept: { costCents: 1, displayName: 'Company Concept' },
      get_frames: { costCents: 1, displayName: 'XBRL Frames' },
      get_company_facts: { costCents: 1, displayName: 'Company Facts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCompanyConcept = sg.wrap(async (args: ConceptInput) => {
  if (!args.cik) throw new Error('cik is required')
  if (!args.taxonomy) throw new Error('taxonomy is required (e.g. "us-gaap")')
  if (!args.tag) throw new Error('tag is required (e.g. "Revenue")')
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(
    \`/api/xbrl/companyconcept/CIK\${cik}/\${encodeURIComponent(args.taxonomy)}/\${encodeURIComponent(args.tag)}.json\`
  )
  return data
}, { method: 'get_company_concept' })

const getFrames = sg.wrap(async (args: FramesInput) => {
  if (!args.taxonomy) throw new Error('taxonomy is required (e.g. "us-gaap")')
  if (!args.tag) throw new Error('tag is required (e.g. "Revenue")')
  if (!args.unit) throw new Error('unit is required (e.g. "USD")')
  if (!args.period) throw new Error('period is required (e.g. "CY2023Q1I")')
  const data = await secFetch<Record<string, unknown>>(
    \`/api/xbrl/frames/\${encodeURIComponent(args.taxonomy)}/\${encodeURIComponent(args.tag)}/\${encodeURIComponent(args.unit)}/\${encodeURIComponent(args.period)}.json\`
  )
  return data
}, { method: 'get_frames' })

const getCompanyFacts = sg.wrap(async (args: FactsInput) => {
  if (!args.cik) throw new Error('cik is required')
  const cik = padCik(args.cik)
  const data = await secFetch<Record<string, unknown>>(\`/api/xbrl/companyfacts/CIK\${cik}.json\`)
  return data
}, { method: 'get_company_facts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCompanyConcept, getFrames, getCompanyFacts }

console.log('settlegrid-sec-xbrl MCP server ready')
console.log('Methods: get_company_concept, get_frames, get_company_facts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 14. settlegrid-treasury-rates
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'treasury-rates',
  title: 'US Treasury Rates',
  desc: 'US Treasury yields and interest rate data from the Fiscal Data API.',
  api: { base: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service', name: 'US Treasury Fiscal Data', docs: 'https://fiscaldata.treasury.gov/api-documentation/' },
  key: null,
  keywords: ['finance', 'treasury', 'yields', 'interest-rates', 'bonds'],
  methods: [
    { name: 'get_treasury_rates', display: 'Current treasury yield rates', cost: 1, params: '', inputs: [] },
    { name: 'get_debt_to_penny', display: 'National debt total', cost: 1, params: '', inputs: [] },
    { name: 'get_avg_interest_rates', display: 'Average interest rates on debt', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
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
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Treasury API \${res.status}: \${body.slice(0, 200)}\`)
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
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 15. settlegrid-bea-data
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'bea-data',
  title: 'Bureau of Economic Analysis',
  desc: 'GDP, personal income, and economic indicators from the BEA API.',
  api: { base: 'https://apps.bea.gov/api/data', name: 'BEA', docs: 'https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf' },
  key: { env: 'BEA_API_KEY', url: 'https://apps.bea.gov/api/signup/', required: true },
  keywords: ['finance', 'economics', 'gdp', 'bea', 'government'],
  methods: [
    { name: 'get_gdp', display: 'GDP data (NIPA)', cost: 2, params: 'year', inputs: [{ name: 'year', type: 'string', required: true, desc: 'Year (e.g. "2023")' }] },
    { name: 'get_datasets', display: 'List available BEA datasets', cost: 1, params: '', inputs: [] },
    { name: 'get_regional_income', display: 'Regional personal income', cost: 2, params: 'year, state', inputs: [{ name: 'year', type: 'string', required: true, desc: 'Year' }, { name: 'state', type: 'string', required: false, desc: 'State FIPS code' }] },
  ],
  serverTs: `/**
 * settlegrid-bea-data — Bureau of Economic Analysis MCP Server
 *
 * Wraps the BEA API with SettleGrid billing.
 * Requires BEA_API_KEY environment variable.
 *
 * Methods:
 *   get_gdp(year)                       — GDP data           (2¢)
 *   get_datasets()                      — List datasets      (1¢)
 *   get_regional_income(year, state?)   — Regional income    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GdpInput { year: string }
interface RegionalInput { year: string; state?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://apps.bea.gov/api/data'

function getKey(): string {
  const k = process.env.BEA_API_KEY
  if (!k) throw new Error('BEA_API_KEY environment variable is required')
  return k
}

async function beaFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(BASE)
  url.searchParams.set('UserID', getKey())
  url.searchParams.set('ResultFormat', 'JSON')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-bea-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`BEA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bea-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_gdp: { costCents: 2, displayName: 'GDP Data' },
      get_datasets: { costCents: 1, displayName: 'List Datasets' },
      get_regional_income: { costCents: 2, displayName: 'Regional Income' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getGdp = sg.wrap(async (args: GdpInput) => {
  if (!args.year || !/^\\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2023")')
  }
  const data = await beaFetch<Record<string, unknown>>({
    method: 'GetData',
    DatasetName: 'NIPA',
    TableName: 'T10101',
    Frequency: 'A',
    Year: args.year,
  })
  return data
}, { method: 'get_gdp' })

const getDatasets = sg.wrap(async () => {
  const data = await beaFetch<Record<string, unknown>>({ method: 'GETDATASETLIST' })
  return data
}, { method: 'get_datasets' })

const getRegionalIncome = sg.wrap(async (args: RegionalInput) => {
  if (!args.year || !/^\\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2023")')
  }
  const params: Record<string, string> = {
    method: 'GetData',
    DatasetName: 'Regional',
    TableName: 'CAINC1',
    LineCode: '1',
    Year: args.year,
    GeoFips: args.state ?? 'STATE',
  }
  const data = await beaFetch<Record<string, unknown>>(params)
  return data
}, { method: 'get_regional_income' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getGdp, getDatasets, getRegionalIncome }

console.log('settlegrid-bea-data MCP server ready')
console.log('Methods: get_gdp, get_datasets, get_regional_income')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 16. settlegrid-fdic-banks
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'fdic-banks',
  title: 'FDIC Bank Data',
  desc: 'FDIC-insured bank information, financials, and failure data.',
  api: { base: 'https://banks.data.fdic.gov/api', name: 'FDIC BankFind', docs: 'https://banks.data.fdic.gov/docs/' },
  key: null,
  keywords: ['finance', 'banking', 'fdic', 'government', 'banks'],
  methods: [
    { name: 'search_institutions', display: 'Search FDIC-insured banks', cost: 1, params: 'search, limit', inputs: [{ name: 'search', type: 'string', required: true, desc: 'Bank name to search' }, { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' }] },
    { name: 'get_financials', display: 'Bank financial reports', cost: 1, params: 'certNumber', inputs: [{ name: 'certNumber', type: 'string', required: true, desc: 'FDIC certificate number' }] },
    { name: 'get_failures', display: 'Recent bank failures', cost: 1, params: 'limit', inputs: [{ name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' }] },
  ],
  serverTs: `/**
 * settlegrid-fdic-banks — FDIC Bank Data MCP Server
 *
 * Wraps the FDIC BankFind API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_institutions(search, limit?)  — Search banks     (1¢)
 *   get_financials(certNumber)           — Bank financials  (1¢)
 *   get_failures(limit?)                 — Bank failures    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { search: string; limit?: number }
interface FinancialsInput { certNumber: string }
interface FailuresInput { limit?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://banks.data.fdic.gov/api'
const UA = 'settlegrid-fdic-banks/1.0 (contact@settlegrid.ai)'

async function fdicFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FDIC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fdic-banks',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_institutions: { costCents: 1, displayName: 'Search Banks' },
      get_financials: { costCents: 1, displayName: 'Bank Financials' },
      get_failures: { costCents: 1, displayName: 'Bank Failures' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchInstitutions = sg.wrap(async (args: SearchInput) => {
  if (!args.search || typeof args.search !== 'string') {
    throw new Error('search is required (bank name)')
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await fdicFetch<{ data: Array<Record<string, unknown>>; totals: Record<string, number> }>(
    '/financials',
    { search: args.search.trim(), limit: String(limit), sort_by: 'REPDTE', sort_order: 'DESC' }
  )
  return { query: args.search, count: data.data?.length ?? 0, institutions: data.data ?? [] }
}, { method: 'search_institutions' })

const getFinancials = sg.wrap(async (args: FinancialsInput) => {
  if (!args.certNumber || typeof args.certNumber !== 'string') {
    throw new Error('certNumber is required (FDIC certificate number)')
  }
  const data = await fdicFetch<{ data: Array<Record<string, unknown>> }>(
    '/financials',
    { filters: \`CERT:\${args.certNumber.trim()}\`, limit: '10', sort_by: 'REPDTE', sort_order: 'DESC' }
  )
  return { certNumber: args.certNumber, count: data.data?.length ?? 0, reports: data.data ?? [] }
}, { method: 'get_financials' })

const getFailures = sg.wrap(async (args: FailuresInput) => {
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 100)
  const data = await fdicFetch<{ data: Array<Record<string, unknown>> }>(
    '/failures',
    { limit: String(limit), sort_by: 'FAILDATE', sort_order: 'DESC' }
  )
  return { count: data.data?.length ?? 0, failures: data.data ?? [] }
}, { method: 'get_failures' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchInstitutions, getFinancials, getFailures }

console.log('settlegrid-fdic-banks MCP server ready')
console.log('Methods: search_institutions, get_financials, get_failures')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 17. settlegrid-imf-data
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'imf-data',
  title: 'IMF Data',
  desc: 'IMF economic indicators, country data, and World Economic Outlook.',
  api: { base: 'https://www.imf.org/external/datamapper/api/v1', name: 'IMF DataMapper', docs: 'https://www.imf.org/external/datamapper/api/v1' },
  key: null,
  keywords: ['finance', 'economics', 'imf', 'global', 'indicators'],
  methods: [
    { name: 'get_indicators', display: 'List available IMF indicators', cost: 1, params: '', inputs: [] },
    { name: 'get_indicator_data', display: 'Data for a specific indicator', cost: 1, params: 'indicator, country', inputs: [{ name: 'indicator', type: 'string', required: true, desc: 'Indicator code (e.g. NGDP_RPCH for real GDP growth)' }, { name: 'country', type: 'string', required: false, desc: 'ISO country code (e.g. USA)' }] },
    { name: 'get_countries', display: 'List countries with codes', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-imf-data — IMF Economic Data MCP Server
 *
 * Wraps the IMF DataMapper API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_indicators()                       — List indicators   (1¢)
 *   get_indicator_data(indicator, country?) — Indicator data    (1¢)
 *   get_countries()                        — List countries    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndicatorInput { indicator: string; country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.imf.org/external/datamapper/api/v1'
const UA = 'settlegrid-imf-data/1.0 (contact@settlegrid.ai)'

async function imfFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IMF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imf-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'List Indicators' },
      get_indicator_data: { costCents: 1, displayName: 'Indicator Data' },
      get_countries: { costCents: 1, displayName: 'List Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async () => {
  const data = await imfFetch<Record<string, unknown>>('/indicators')
  return data
}, { method: 'get_indicators' })

const getIndicatorData = sg.wrap(async (args: IndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. "NGDP_RPCH")')
  }
  const path = args.country
    ? \`/\${encodeURIComponent(args.indicator)}/\${encodeURIComponent(args.country.toUpperCase().trim())}\`
    : \`/\${encodeURIComponent(args.indicator)}\`
  const data = await imfFetch<Record<string, unknown>>(path)
  return data
}, { method: 'get_indicator_data' })

const getCountries = sg.wrap(async () => {
  const data = await imfFetch<Record<string, unknown>>('/countries')
  return data
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, getIndicatorData, getCountries }

console.log('settlegrid-imf-data MCP server ready')
console.log('Methods: get_indicators, get_indicator_data, get_countries')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 18. settlegrid-oecd-data
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'oecd-data',
  title: 'OECD Statistics',
  desc: 'OECD economic statistics, GDP, unemployment, and trade data via SDMX.',
  api: { base: 'https://sdmx.oecd.org/public/rest', name: 'OECD SDMX', docs: 'https://data.oecd.org/api/' },
  key: null,
  keywords: ['finance', 'economics', 'oecd', 'statistics', 'international'],
  methods: [
    { name: 'get_dataset', display: 'Fetch OECD dataset', cost: 1, params: 'dataflow, filter', inputs: [{ name: 'dataflow', type: 'string', required: true, desc: 'Dataflow ID (e.g. QNA for quarterly national accounts)' }, { name: 'filter', type: 'string', required: false, desc: 'SDMX key filter (e.g. USA.B1_GE.VOBARSA.Q)' }] },
    { name: 'get_dataflows', display: 'List available dataflows', cost: 1, params: '', inputs: [] },
    { name: 'get_gdp', display: 'GDP data for a country', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: true, desc: 'ISO 3-letter country code (e.g. USA)' }] },
  ],
  serverTs: `/**
 * settlegrid-oecd-data — OECD Statistics MCP Server
 *
 * Wraps the OECD SDMX REST API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_dataset(dataflow, filter?)   — Fetch dataset      (1¢)
 *   get_dataflows()                  — List dataflows     (1¢)
 *   get_gdp(country)                — GDP data            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DatasetInput { dataflow: string; filter?: string }
interface GdpInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://sdmx.oecd.org/public/rest'
const UA = 'settlegrid-oecd-data/1.0 (contact@settlegrid.ai)'

async function oecdFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OECD API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dataset: { costCents: 1, displayName: 'Fetch Dataset' },
      get_dataflows: { costCents: 1, displayName: 'List Dataflows' },
      get_gdp: { costCents: 1, displayName: 'GDP Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.dataflow || typeof args.dataflow !== 'string') {
    throw new Error('dataflow is required (e.g. "QNA")')
  }
  const filter = args.filter ? \`/\${args.filter}\` : '/all'
  const data = await oecdFetch<Record<string, unknown>>(
    \`/data/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_CAPITA\${filter}?startPeriod=2020&dimensionAtObservation=AllDimensions\`
  )
  return data
}, { method: 'get_dataset' })

const getDataflows = sg.wrap(async () => {
  const res = await fetch(\`\${BASE}/dataflow/OECD\`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.sdmx.structure+json;version=1.0.0-wd' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OECD API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as Record<string, unknown>
  return data
}, { method: 'get_dataflows' })

const getGdp = sg.wrap(async (args: GdpInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (3-letter ISO code, e.g. "USA")')
  }
  const country = args.country.toUpperCase().trim()
  const data = await oecdFetch<Record<string, unknown>>(
    \`/data/OECD.SDD.NAD,DSD_NAMAIN1@DF_QNA_EXPENDITURE_CAPITA/\${country}.B1_GE.VOBARSA.Q?startPeriod=2020&dimensionAtObservation=AllDimensions\`
  )
  return { country, data }
}, { method: 'get_gdp' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDataset, getDataflows, getGdp }

console.log('settlegrid-oecd-data MCP server ready')
console.log('Methods: get_dataset, get_dataflows, get_gdp')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 19. settlegrid-ecb-rates
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'ecb-rates',
  title: 'European Central Bank Rates',
  desc: 'ECB exchange rates, interest rates, and monetary policy data.',
  api: { base: 'https://data-api.ecb.europa.eu/service/data', name: 'ECB Data Portal', docs: 'https://data.ecb.europa.eu/help/api/overview' },
  key: null,
  keywords: ['finance', 'forex', 'ecb', 'euro', 'interest-rates'],
  methods: [
    { name: 'get_exchange_rates', display: 'ECB reference exchange rates', cost: 1, params: 'currency', inputs: [{ name: 'currency', type: 'string', required: true, desc: 'Currency code (e.g. USD, GBP)' }] },
    { name: 'get_key_rates', display: 'ECB key interest rates', cost: 1, params: '', inputs: [] },
    { name: 'get_hicp', display: 'Harmonised Index of Consumer Prices', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: false, desc: 'Country code (e.g. DE, FR), default all euro area' }] },
  ],
  serverTs: `/**
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
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ECB API \${res.status}: \${body.slice(0, 200)}\`)
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
    \`/EXR/D.\${cur}.EUR.SP00.A?lastNObservations=30\`
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
    \`/ICP/M.\${country}.N.000000.4.ANR?lastNObservations=12\`
  )
  return { country, data }
}, { method: 'get_hicp' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getExchangeRates, getKeyRates, getHicp }

console.log('settlegrid-ecb-rates MCP server ready')
console.log('Methods: get_exchange_rates, get_key_rates, get_hicp')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 20. settlegrid-bank-of-england
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'bank-of-england',
  title: 'Bank of England',
  desc: 'BoE statistics, interest rates, and economic data.',
  api: { base: 'https://www.bankofengland.co.uk/boeapps/database', name: 'Bank of England', docs: 'https://www.bankofengland.co.uk/statistics' },
  key: null,
  keywords: ['finance', 'banking', 'boe', 'uk', 'interest-rates'],
  methods: [
    { name: 'get_series', display: 'Get time series data by code', cost: 1, params: 'seriesCode, fromDate', inputs: [{ name: 'seriesCode', type: 'string', required: true, desc: 'Series code (e.g. IUDBEDR for bank rate)' }, { name: 'fromDate', type: 'string', required: false, desc: 'Start date (DD/MMM/YYYY)' }] },
    { name: 'get_bank_rate', display: 'Current BoE bank rate history', cost: 1, params: '', inputs: [] },
    { name: 'get_inflation', display: 'UK CPI inflation data', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-bank-of-england — Bank of England Statistics MCP Server
 *
 * Wraps the BoE Statistical Interactive Database with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_series(seriesCode, fromDate?)  — Time series data   (1¢)
 *   get_bank_rate()                    — Bank rate history  (1¢)
 *   get_inflation()                    — CPI inflation      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeriesInput { seriesCode: string; fromDate?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.bankofengland.co.uk/boeapps/database'
const UA = 'settlegrid-bank-of-england/1.0 (contact@settlegrid.ai)'

async function boeFetch(seriesCodes: string, fromDate?: string): Promise<string> {
  const url = new URL(\`\${BASE}/fromshowcolumns.asp\`)
  url.searchParams.set('SeriesCodes', seriesCodes)
  url.searchParams.set('CSVF', 'TN')
  url.searchParams.set('UsingCodes', 'Y')
  url.searchParams.set('VPD', 'Y')
  if (fromDate) url.searchParams.set('FromDate', fromDate)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`BoE API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function parseCsv(csv: string): Array<Record<string, string>> {
  const lines = csv.trim().split('\\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bank-of-england',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_series: { costCents: 1, displayName: 'Time Series' },
      get_bank_rate: { costCents: 1, displayName: 'Bank Rate' },
      get_inflation: { costCents: 1, displayName: 'CPI Inflation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: SeriesInput) => {
  if (!args.seriesCode || typeof args.seriesCode !== 'string') {
    throw new Error('seriesCode is required (e.g. "IUDBEDR")')
  }
  const csv = await boeFetch(args.seriesCode.trim(), args.fromDate)
  const rows = parseCsv(csv)
  return { seriesCode: args.seriesCode, count: rows.length, data: rows.slice(0, 50) }
}, { method: 'get_series' })

const getBankRate = sg.wrap(async () => {
  const csv = await boeFetch('IUDBEDR', '01/Jan/2020')
  const rows = parseCsv(csv)
  return { series: 'IUDBEDR', description: 'Official Bank Rate', count: rows.length, data: rows }
}, { method: 'get_bank_rate' })

const getInflation = sg.wrap(async () => {
  const csv = await boeFetch('D7BT', '01/Jan/2020')
  const rows = parseCsv(csv)
  return { series: 'D7BT', description: 'CPI Annual Rate', count: rows.length, data: rows }
}, { method: 'get_inflation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries, getBankRate, getInflation }

console.log('settlegrid-bank-of-england MCP server ready')
console.log('Methods: get_series, get_bank_rate, get_inflation')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 21. settlegrid-coinlayer
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'coinlayer',
  title: 'Coinlayer',
  desc: 'Cryptocurrency exchange rates and historical data via Coinlayer.',
  api: { base: 'https://api.coinlayer.com', name: 'Coinlayer', docs: 'https://coinlayer.com/documentation' },
  key: { env: 'COINLAYER_API_KEY', url: 'https://coinlayer.com/product', required: true },
  keywords: ['finance', 'crypto', 'coinlayer', 'exchange-rates'],
  methods: [
    { name: 'get_live', display: 'Live crypto exchange rates', cost: 2, params: 'target, symbols', inputs: [{ name: 'target', type: 'string', required: false, desc: 'Target fiat currency (default USD)' }, { name: 'symbols', type: 'string', required: false, desc: 'Comma-separated crypto symbols (e.g. BTC,ETH)' }] },
    { name: 'get_historical', display: 'Historical rates for a date', cost: 2, params: 'date, target', inputs: [{ name: 'date', type: 'string', required: true, desc: 'Date (YYYY-MM-DD)' }, { name: 'target', type: 'string', required: false, desc: 'Target fiat currency (default USD)' }] },
    { name: 'get_list', display: 'List supported cryptocurrencies', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-coinlayer — Coinlayer Crypto Rates MCP Server
 *
 * Wraps the Coinlayer API with SettleGrid billing.
 * Requires COINLAYER_API_KEY environment variable.
 *
 * Methods:
 *   get_live(target?, symbols?)       — Live rates         (2¢)
 *   get_historical(date, target?)     — Historical rates   (2¢)
 *   get_list()                        — Supported cryptos  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LiveInput { target?: string; symbols?: string }
interface HistoricalInput { date: string; target?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.coinlayer.com'

function getKey(): string {
  const k = process.env.COINLAYER_API_KEY
  if (!k) throw new Error('COINLAYER_API_KEY environment variable is required')
  return k
}

async function clFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-coinlayer/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Coinlayer API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(\`Coinlayer error: \${json.error?.info ?? 'Unknown error'}\`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'coinlayer',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_live: { costCents: 2, displayName: 'Live Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_list: { costCents: 1, displayName: 'List Cryptos' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLive = sg.wrap(async (args: LiveInput) => {
  const params: Record<string, string> = {}
  if (args.target) params.target = args.target.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await clFetch<{ target: string; rates: Record<string, number> }>('/live', params)
  return { target: data.target, rates: data.rates }
}, { method: 'get_live' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.target) params.target = args.target.toUpperCase().trim()
  const data = await clFetch<{ target: string; historical: boolean; date: string; rates: Record<string, number> }>(\`/\${args.date}\`, params)
  return { date: data.date, target: data.target, rates: data.rates }
}, { method: 'get_historical' })

const getList = sg.wrap(async () => {
  const data = await clFetch<{ crypto: Record<string, Record<string, unknown>> }>('/list')
  return { count: Object.keys(data.crypto ?? {}).length, cryptocurrencies: data.crypto }
}, { method: 'get_list' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLive, getHistorical, getList }

console.log('settlegrid-coinlayer MCP server ready')
console.log('Methods: get_live, get_historical, get_list')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 22. settlegrid-metals-api
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'metals-api',
  title: 'Metals API',
  desc: 'Precious metal and commodity prices with real-time and historical rates.',
  api: { base: 'https://metals-api.com/api', name: 'Metals API', docs: 'https://metals-api.com/documentation' },
  key: { env: 'METALS_API_KEY', url: 'https://metals-api.com/pricing', required: true },
  keywords: ['finance', 'commodities', 'metals', 'gold', 'silver'],
  methods: [
    { name: 'get_latest', display: 'Latest metal prices', cost: 2, params: 'base, symbols', inputs: [{ name: 'base', type: 'string', required: false, desc: 'Base currency (default USD)' }, { name: 'symbols', type: 'string', required: false, desc: 'Metal symbols (e.g. XAU,XAG)' }] },
    { name: 'get_historical', display: 'Historical metal prices', cost: 2, params: 'date, base, symbols', inputs: [{ name: 'date', type: 'string', required: true, desc: 'Date (YYYY-MM-DD)' }, { name: 'base', type: 'string', required: false, desc: 'Base currency' }, { name: 'symbols', type: 'string', required: false, desc: 'Metal symbols' }] },
    { name: 'get_symbols', display: 'List available metal symbols', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-metals-api — Precious Metals Prices MCP Server
 *
 * Wraps the Metals API with SettleGrid billing.
 * Requires METALS_API_KEY environment variable.
 *
 * Methods:
 *   get_latest(base?, symbols?)              — Latest prices     (2¢)
 *   get_historical(date, base?, symbols?)    — Historical prices (2¢)
 *   get_symbols()                            — List symbols      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string; symbols?: string }
interface HistoricalInput { date: string; base?: string; symbols?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://metals-api.com/api'

function getKey(): string {
  const k = process.env.METALS_API_KEY
  if (!k) throw new Error('METALS_API_KEY environment variable is required')
  return k
}

async function metalsFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-metals-api/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Metals API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(\`Metals API error: \${json.error?.info ?? 'Unknown error'}\`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'metals-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Prices' },
      get_historical: { costCents: 2, displayName: 'Historical Prices' },
      get_symbols: { costCents: 1, displayName: 'List Symbols' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await metalsFetch<{ base: string; rates: Record<string, number>; timestamp: number }>('/latest', params)
  return { base: data.base, timestamp: data.timestamp, rates: data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await metalsFetch<{ base: string; rates: Record<string, number>; date: string }>(\`/\${args.date}\`, params)
  return { date: data.date, base: data.base, rates: data.rates }
}, { method: 'get_historical' })

const getSymbols = sg.wrap(async () => {
  const data = await metalsFetch<{ symbols: Record<string, string> }>('/symbols')
  return { count: Object.keys(data.symbols ?? {}).length, symbols: data.symbols }
}, { method: 'get_symbols' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getSymbols }

console.log('settlegrid-metals-api MCP server ready')
console.log('Methods: get_latest, get_historical, get_symbols')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 23. settlegrid-fixer-io
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'fixer-io',
  title: 'Fixer.io',
  desc: 'Foreign exchange rates, conversion, and time series via Fixer.io.',
  api: { base: 'https://data.fixer.io/api', name: 'Fixer.io', docs: 'https://fixer.io/documentation' },
  key: { env: 'FIXER_API_KEY', url: 'https://fixer.io/signup', required: true },
  keywords: ['finance', 'forex', 'fixer', 'exchange-rates', 'currency'],
  methods: [
    { name: 'get_latest', display: 'Latest exchange rates', cost: 2, params: 'base, symbols', inputs: [{ name: 'base', type: 'string', required: false, desc: 'Base currency (default EUR)' }, { name: 'symbols', type: 'string', required: false, desc: 'Comma-separated target currencies' }] },
    { name: 'get_historical', display: 'Historical rates for a date', cost: 2, params: 'date, base', inputs: [{ name: 'date', type: 'string', required: true, desc: 'Date (YYYY-MM-DD)' }, { name: 'base', type: 'string', required: false, desc: 'Base currency' }] },
    { name: 'get_symbols', display: 'List supported currency symbols', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-fixer-io — Fixer.io Exchange Rates MCP Server
 *
 * Wraps the Fixer.io API with SettleGrid billing.
 * Requires FIXER_API_KEY environment variable.
 *
 * Methods:
 *   get_latest(base?, symbols?)     — Latest rates        (2¢)
 *   get_historical(date, base?)     — Historical rates    (2¢)
 *   get_symbols()                   — List currencies     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string; symbols?: string }
interface HistoricalInput { date: string; base?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://data.fixer.io/api'

function getKey(): string {
  const k = process.env.FIXER_API_KEY
  if (!k) throw new Error('FIXER_API_KEY environment variable is required')
  return k
}

async function fixerFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-fixer-io/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Fixer.io API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(\`Fixer.io error: \${json.error?.info ?? 'Unknown error'}\`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fixer-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Rates' },
      get_historical: { costCents: 2, displayName: 'Historical Rates' },
      get_symbols: { costCents: 1, displayName: 'List Currencies' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await fixerFetch<{ base: string; date: string; rates: Record<string, number> }>('/latest', params)
  return { base: data.base, date: data.date, rates: data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  const data = await fixerFetch<{ base: string; date: string; rates: Record<string, number> }>(\`/\${args.date}\`, params)
  return { date: data.date, base: data.base, rates: data.rates }
}, { method: 'get_historical' })

const getSymbols = sg.wrap(async () => {
  const data = await fixerFetch<{ symbols: Record<string, string> }>('/symbols')
  return { count: Object.keys(data.symbols ?? {}).length, symbols: data.symbols }
}, { method: 'get_symbols' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getSymbols }

console.log('settlegrid-fixer-io MCP server ready')
console.log('Methods: get_latest, get_historical, get_symbols')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 24. settlegrid-commodities-api
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'commodities-api',
  title: 'Commodities API',
  desc: 'Commodity prices for oil, gas, grains, and more.',
  api: { base: 'https://commodities-api.com/api', name: 'Commodities API', docs: 'https://commodities-api.com/documentation' },
  key: { env: 'COMMODITIES_API_KEY', url: 'https://commodities-api.com/pricing', required: true },
  keywords: ['finance', 'commodities', 'oil', 'gas', 'agriculture'],
  methods: [
    { name: 'get_latest', display: 'Latest commodity prices', cost: 2, params: 'base, symbols', inputs: [{ name: 'base', type: 'string', required: false, desc: 'Base currency (default USD)' }, { name: 'symbols', type: 'string', required: false, desc: 'Commodity symbols (e.g. BRENTOIL,WHEAT)' }] },
    { name: 'get_historical', display: 'Historical commodity prices', cost: 2, params: 'date, base, symbols', inputs: [{ name: 'date', type: 'string', required: true, desc: 'Date (YYYY-MM-DD)' }, { name: 'base', type: 'string', required: false, desc: 'Base currency' }, { name: 'symbols', type: 'string', required: false, desc: 'Commodity symbols' }] },
    { name: 'get_symbols', display: 'List available commodity symbols', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-commodities-api — Commodity Prices MCP Server
 *
 * Wraps the Commodities API with SettleGrid billing.
 * Requires COMMODITIES_API_KEY environment variable.
 *
 * Methods:
 *   get_latest(base?, symbols?)              — Latest prices     (2¢)
 *   get_historical(date, base?, symbols?)    — Historical prices (2¢)
 *   get_symbols()                            — List symbols      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LatestInput { base?: string; symbols?: string }
interface HistoricalInput { date: string; base?: string; symbols?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://commodities-api.com/api'

function getKey(): string {
  const k = process.env.COMMODITIES_API_KEY
  if (!k) throw new Error('COMMODITIES_API_KEY environment variable is required')
  return k
}

async function cmdFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('access_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-commodities-api/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Commodities API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as T & { success?: boolean; error?: { info?: string } }
  if (json.success === false) {
    throw new Error(\`Commodities API error: \${json.error?.info ?? 'Unknown error'}\`)
  }
  return json
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'commodities-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_latest: { costCents: 2, displayName: 'Latest Prices' },
      get_historical: { costCents: 2, displayName: 'Historical Prices' },
      get_symbols: { costCents: 1, displayName: 'List Symbols' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLatest = sg.wrap(async (args: LatestInput) => {
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await cmdFetch<{ data: { base: string; rates: Record<string, number>; timestamp: number } }>('/latest', params)
  return { base: data.data.base, timestamp: data.data.timestamp, rates: data.data.rates }
}, { method: 'get_latest' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.date || !/^\\d{4}-\\d{2}-\\d{2}$/.test(args.date)) {
    throw new Error('date is required (YYYY-MM-DD)')
  }
  const params: Record<string, string> = {}
  if (args.base) params.base = args.base.toUpperCase().trim()
  if (args.symbols) params.symbols = args.symbols.toUpperCase().trim()
  const data = await cmdFetch<{ data: { base: string; rates: Record<string, number>; date: string } }>(\`/\${args.date}\`, params)
  return { date: data.data.date, base: data.data.base, rates: data.data.rates }
}, { method: 'get_historical' })

const getSymbols = sg.wrap(async () => {
  const data = await cmdFetch<{ data: Record<string, string> }>('/symbols')
  return { count: Object.keys(data.data ?? {}).length, symbols: data.data }
}, { method: 'get_symbols' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLatest, getHistorical, getSymbols }

console.log('settlegrid-commodities-api MCP server ready')
console.log('Methods: get_latest, get_historical, get_symbols')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 25. settlegrid-bls-statistics
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'bls-statistics',
  title: 'Bureau of Labor Statistics',
  desc: 'Employment, CPI, PPI, and labor market data from the BLS API.',
  api: { base: 'https://api.bls.gov/publicAPI/v2', name: 'BLS', docs: 'https://www.bls.gov/developers/' },
  key: { env: 'BLS_API_KEY', url: 'https://data.bls.gov/registrationEngine/', required: true },
  keywords: ['finance', 'economics', 'labor', 'employment', 'cpi'],
  methods: [
    { name: 'get_series', display: 'Get time series data', cost: 2, params: 'seriesId, startYear, endYear', inputs: [{ name: 'seriesId', type: 'string', required: true, desc: 'BLS series ID (e.g. CUUR0000SA0 for CPI-U)' }, { name: 'startYear', type: 'string', required: true, desc: 'Start year' }, { name: 'endYear', type: 'string', required: true, desc: 'End year' }] },
    { name: 'get_cpi', display: 'Consumer Price Index (CPI-U)', cost: 2, params: 'startYear, endYear', inputs: [{ name: 'startYear', type: 'string', required: true, desc: 'Start year' }, { name: 'endYear', type: 'string', required: true, desc: 'End year' }] },
    { name: 'get_unemployment', display: 'National unemployment rate', cost: 2, params: 'startYear, endYear', inputs: [{ name: 'startYear', type: 'string', required: true, desc: 'Start year' }, { name: 'endYear', type: 'string', required: true, desc: 'End year' }] },
  ],
  serverTs: `/**
 * settlegrid-bls-statistics — Bureau of Labor Statistics MCP Server
 *
 * Wraps the BLS API v2 with SettleGrid billing.
 * Requires BLS_API_KEY (registration key in POST body).
 *
 * Methods:
 *   get_series(seriesId, startYear, endYear)  — Time series   (2¢)
 *   get_cpi(startYear, endYear)               — CPI-U data   (2¢)
 *   get_unemployment(startYear, endYear)      — Unemployment  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SeriesInput { seriesId: string; startYear: string; endYear: string }
interface YearRangeInput { startYear: string; endYear: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.bls.gov/publicAPI/v2'

function getKey(): string {
  const k = process.env.BLS_API_KEY
  if (!k) throw new Error('BLS_API_KEY environment variable is required')
  return k
}

async function blsFetch(seriesIds: string[], startYear: string, endYear: string): Promise<Record<string, unknown>> {
  const res = await fetch(\`\${BASE}/timeseries/data/\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'settlegrid-bls-statistics/1.0 (contact@settlegrid.ai)',
    },
    body: JSON.stringify({
      seriesid: seriesIds,
      startyear: startYear,
      endyear: endYear,
      registrationkey: getKey(),
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`BLS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const json = await res.json() as { status: string; Results: { series: Array<Record<string, unknown>> } }
  if (json.status !== 'REQUEST_SUCCEEDED') {
    throw new Error(\`BLS API error: \${json.status}\`)
  }
  return json as Record<string, unknown>
}

function validateYear(year: string, name: string): string {
  if (!/^\\d{4}$/.test(year)) throw new Error(\`\${name} must be a 4-digit year\`)
  return year
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bls-statistics',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_series: { costCents: 2, displayName: 'Time Series' },
      get_cpi: { costCents: 2, displayName: 'CPI-U Data' },
      get_unemployment: { costCents: 2, displayName: 'Unemployment Rate' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSeries = sg.wrap(async (args: SeriesInput) => {
  if (!args.seriesId) throw new Error('seriesId is required (e.g. "CUUR0000SA0")')
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch([args.seriesId.trim()], start, end)
  return data
}, { method: 'get_series' })

const getCpi = sg.wrap(async (args: YearRangeInput) => {
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch(['CUUR0000SA0'], start, end)
  return data
}, { method: 'get_cpi' })

const getUnemployment = sg.wrap(async (args: YearRangeInput) => {
  const start = validateYear(args.startYear, 'startYear')
  const end = validateYear(args.endYear, 'endYear')
  const data = await blsFetch(['LNS14000000'], start, end)
  return data
}, { method: 'get_unemployment' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSeries, getCpi, getUnemployment }

console.log('settlegrid-bls-statistics MCP server ready')
console.log('Methods: get_series, get_cpi, get_unemployment')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 26. settlegrid-census-data
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'census-data',
  title: 'US Census Bureau',
  desc: 'US Census Bureau population, economic, and demographic data.',
  api: { base: 'https://api.census.gov/data', name: 'US Census Bureau', docs: 'https://www.census.gov/data/developers.html' },
  key: { env: 'CENSUS_API_KEY', url: 'https://api.census.gov/data/key_signup.html', required: true },
  keywords: ['finance', 'demographics', 'census', 'population', 'government'],
  methods: [
    { name: 'get_acs_data', display: 'American Community Survey data', cost: 2, params: 'year, variables, state', inputs: [{ name: 'year', type: 'string', required: true, desc: 'Survey year (e.g. "2022")' }, { name: 'variables', type: 'string', required: true, desc: 'Comma-separated variable names (e.g. "B01001_001E" for population)' }, { name: 'state', type: 'string', required: false, desc: 'State FIPS code (e.g. "06" for California)' }] },
    { name: 'get_population', display: 'State population estimates', cost: 2, params: 'year', inputs: [{ name: 'year', type: 'string', required: true, desc: 'Year (e.g. "2022")' }] },
    { name: 'get_datasets', display: 'List available Census datasets', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-census-data — US Census Bureau MCP Server
 *
 * Wraps the US Census Bureau API with SettleGrid billing.
 * Requires CENSUS_API_KEY environment variable.
 *
 * Methods:
 *   get_acs_data(year, variables, state?)  — ACS data        (2¢)
 *   get_population(year)                   — Population est.  (2¢)
 *   get_datasets()                         — List datasets    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface AcsInput { year: string; variables: string; state?: string }
interface PopulationInput { year: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.census.gov/data'

function getKey(): string {
  const k = process.env.CENSUS_API_KEY
  if (!k) throw new Error('CENSUS_API_KEY environment variable is required')
  return k
}

async function censusFetch<T>(url: string): Promise<T> {
  const u = new URL(url)
  u.searchParams.set('key', getKey())
  const res = await fetch(u.toString(), {
    headers: { 'User-Agent': 'settlegrid-census-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Census API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'census-data',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_acs_data: { costCents: 2, displayName: 'ACS Data' },
      get_population: { costCents: 2, displayName: 'Population Estimates' },
      get_datasets: { costCents: 1, displayName: 'List Datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAcsData = sg.wrap(async (args: AcsInput) => {
  if (!args.year || !/^\\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2022")')
  }
  if (!args.variables || typeof args.variables !== 'string') {
    throw new Error('variables is required (e.g. "B01001_001E")')
  }
  let url = \`\${BASE}/\${args.year}/acs/acs1?get=NAME,\${args.variables.trim()}\`
  if (args.state) {
    url += \`&for=county:*&in=state:\${args.state.trim()}\`
  } else {
    url += '&for=state:*'
  }
  const data = await censusFetch<string[][]>(url)
  const headers = data[0]
  const rows = data.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { year: args.year, count: rows.length, data: rows }
}, { method: 'get_acs_data' })

const getPopulation = sg.wrap(async (args: PopulationInput) => {
  if (!args.year || !/^\\d{4}$/.test(args.year)) {
    throw new Error('year is required (e.g. "2022")')
  }
  const url = \`\${BASE}/\${args.year}/pep/population?get=NAME,POP_2022&for=state:*\`
  const data = await censusFetch<string[][]>(url)
  const headers = data[0]
  const rows = data.slice(1).map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = row[i] })
    return obj
  })
  return { year: args.year, count: rows.length, states: rows }
}, { method: 'get_population' })

const getDatasets = sg.wrap(async () => {
  const res = await fetch(\`\${BASE}.json\`, {
    headers: { 'User-Agent': 'settlegrid-census-data/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) throw new Error(\`Census API \${res.status}\`)
  const data = await res.json() as { dataset: Array<Record<string, unknown>> }
  const datasets = (data.dataset ?? []).slice(0, 50)
  return { count: datasets.length, datasets }
}, { method: 'get_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAcsData, getPopulation, getDatasets }

console.log('settlegrid-census-data MCP server ready')
console.log('Methods: get_acs_data, get_population, get_datasets')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 27. settlegrid-eurostat
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'eurostat',
  title: 'Eurostat',
  desc: 'EU statistical data on GDP, population, trade, and more from Eurostat.',
  api: { base: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0', name: 'Eurostat', docs: 'https://wikis.ec.europa.eu/display/EUROSTATHELP/API+Statistics+-+data+query' },
  key: null,
  keywords: ['finance', 'economics', 'eurostat', 'eu', 'statistics'],
  methods: [
    { name: 'get_dataset', display: 'Fetch Eurostat dataset', cost: 1, params: 'datasetCode, filters', inputs: [{ name: 'datasetCode', type: 'string', required: true, desc: 'Dataset code (e.g. nama_10_gdp)' }, { name: 'filters', type: 'string', required: false, desc: 'Filter params (e.g. "geo=DE&time=2023")' }] },
    { name: 'get_gdp', display: 'GDP data for EU countries', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: false, desc: 'Country code (e.g. DE, FR)' }] },
    { name: 'get_population', display: 'Population data', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: false, desc: 'Country code' }] },
  ],
  serverTs: `/**
 * settlegrid-eurostat — Eurostat EU Statistics MCP Server
 *
 * Wraps the Eurostat API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_dataset(datasetCode, filters?)  — Fetch dataset    (1¢)
 *   get_gdp(country?)                   — GDP data         (1¢)
 *   get_population(country?)            — Population data  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DatasetInput { datasetCode: string; filters?: string }
interface CountryInput { country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0'
const UA = 'settlegrid-eurostat/1.0 (contact@settlegrid.ai)'

async function esFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Eurostat API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'eurostat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_dataset: { costCents: 1, displayName: 'Fetch Dataset' },
      get_gdp: { costCents: 1, displayName: 'GDP Data' },
      get_population: { costCents: 1, displayName: 'Population Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.datasetCode || typeof args.datasetCode !== 'string') {
    throw new Error('datasetCode is required (e.g. "nama_10_gdp")')
  }
  const filters = args.filters ? \`?\${args.filters}\` : ''
  const data = await esFetch<Record<string, unknown>>(\`/data/\${encodeURIComponent(args.datasetCode)}\${filters}\`)
  return data
}, { method: 'get_dataset' })

const getGdp = sg.wrap(async (args: CountryInput) => {
  const geo = args.country ? \`&geo=\${args.country.toUpperCase().trim()}\` : ''
  const data = await esFetch<Record<string, unknown>>(\`/data/nama_10_gdp?na_item=B1GQ&unit=CP_MEUR\${geo}&lastTimePeriod=5\`)
  return data
}, { method: 'get_gdp' })

const getPopulation = sg.wrap(async (args: CountryInput) => {
  const geo = args.country ? \`&geo=\${args.country.toUpperCase().trim()}\` : ''
  const data = await esFetch<Record<string, unknown>>(\`/data/demo_pjan?sex=T&age=TOTAL\${geo}&lastTimePeriod=5\`)
  return data
}, { method: 'get_population' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDataset, getGdp, getPopulation }

console.log('settlegrid-eurostat MCP server ready')
console.log('Methods: get_dataset, get_gdp, get_population')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 28. settlegrid-statsbureau
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'statsbureau',
  title: 'StatBureau',
  desc: 'Global inflation, CPI, and consumer price statistics.',
  api: { base: 'https://www.statbureau.org/api/v1', name: 'StatBureau', docs: 'https://www.statbureau.org/en/api' },
  key: { env: 'STATBUREAU_API_KEY', url: 'https://www.statbureau.org/en/api', required: true },
  keywords: ['finance', 'economics', 'inflation', 'cpi', 'statistics'],
  methods: [
    { name: 'get_inflation', display: 'Inflation data by country', cost: 2, params: 'country', inputs: [{ name: 'country', type: 'string', required: true, desc: 'Country name (e.g. "united-states")' }] },
    { name: 'get_cpi', display: 'Consumer Price Index data', cost: 2, params: 'country', inputs: [{ name: 'country', type: 'string', required: true, desc: 'Country name' }] },
    { name: 'get_countries', display: 'List supported countries', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-statsbureau — StatBureau Global Statistics MCP Server
 *
 * Wraps the StatBureau API with SettleGrid billing.
 * Requires STATBUREAU_API_KEY environment variable.
 *
 * Methods:
 *   get_inflation(country)   — Inflation data      (2¢)
 *   get_cpi(country)         — CPI data            (2¢)
 *   get_countries()          — List countries       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountryInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.statbureau.org/api/v1'

function getKey(): string {
  const k = process.env.STATBUREAU_API_KEY
  if (!k) throw new Error('STATBUREAU_API_KEY environment variable is required')
  return k
}

async function sbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('api_key', getKey())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-statsbureau/1.0 (contact@settlegrid.ai)', Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`StatBureau API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'statsbureau',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_inflation: { costCents: 2, displayName: 'Inflation Data' },
      get_cpi: { costCents: 2, displayName: 'CPI Data' },
      get_countries: { costCents: 1, displayName: 'List Countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getInflation = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united-states")')
  }
  const data = await sbFetch<Array<Record<string, unknown>>>('/inflation', {
    country: args.country.toLowerCase().trim(),
  })
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, data: Array.isArray(data) ? data : [data] }
}, { method: 'get_inflation' })

const getCpi = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united-states")')
  }
  const data = await sbFetch<Array<Record<string, unknown>>>('/cpi', {
    country: args.country.toLowerCase().trim(),
  })
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, data: Array.isArray(data) ? data : [data] }
}, { method: 'get_cpi' })

const getCountries = sg.wrap(async () => {
  const data = await sbFetch<Array<Record<string, unknown>>>('/countries')
  return { count: Array.isArray(data) ? data.length : 0, countries: data }
}, { method: 'get_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getInflation, getCpi, getCountries }

console.log('settlegrid-statsbureau MCP server ready')
console.log('Methods: get_inflation, get_cpi, get_countries')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 29. settlegrid-numbeo
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'numbeo',
  title: 'Numbeo',
  desc: 'Cost of living, property prices, and quality of life indices worldwide.',
  api: { base: 'https://www.numbeo.com/api', name: 'Numbeo', docs: 'https://www.numbeo.com/common/api.jsp' },
  key: null,
  keywords: ['finance', 'cost-of-living', 'numbeo', 'property', 'quality-of-life'],
  methods: [
    { name: 'get_cost_of_living', display: 'Cost of living index by city', cost: 1, params: 'city', inputs: [{ name: 'city', type: 'string', required: true, desc: 'City name (e.g. "New York")' }] },
    { name: 'get_indices', display: 'Quality of life indices by country', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: true, desc: 'Country name (e.g. "United States")' }] },
    { name: 'get_city_prices', display: 'Item prices in a city', cost: 1, params: 'city', inputs: [{ name: 'city', type: 'string', required: true, desc: 'City name' }] },
  ],
  serverTs: `/**
 * settlegrid-numbeo — Numbeo Cost of Living MCP Server
 *
 * Wraps the Numbeo API with SettleGrid billing.
 * No API key needed for basic endpoints.
 *
 * Methods:
 *   get_cost_of_living(city)   — Cost of living index  (1¢)
 *   get_indices(country)       — Quality of life       (1¢)
 *   get_city_prices(city)      — Item prices           (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CityInput { city: string }
interface CountryInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://www.numbeo.com/api'
const UA = 'settlegrid-numbeo/1.0 (contact@settlegrid.ai)'

async function numbeoFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Numbeo API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'numbeo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cost_of_living: { costCents: 1, displayName: 'Cost of Living' },
      get_indices: { costCents: 1, displayName: 'Quality of Life' },
      get_city_prices: { costCents: 1, displayName: 'City Prices' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCostOfLiving = sg.wrap(async (args: CityInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (e.g. "New York")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/indices', {
    query: args.city.trim(),
  })
  return { city: args.city, data }
}, { method: 'get_cost_of_living' })

const getIndices = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "United States")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/country_indices', {
    query: args.country.trim(),
  })
  return { country: args.country, data }
}, { method: 'get_indices' })

const getCityPrices = sg.wrap(async (args: CityInput) => {
  if (!args.city || typeof args.city !== 'string') {
    throw new Error('city is required (e.g. "London")')
  }
  const data = await numbeoFetch<Record<string, unknown>>('/city_prices', {
    query: args.city.trim(),
  })
  return { city: args.city, data }
}, { method: 'get_city_prices' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCostOfLiving, getIndices, getCityPrices }

console.log('settlegrid-numbeo MCP server ready')
console.log('Methods: get_cost_of_living, get_indices, get_city_prices')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─────────────────────────────────────────────────────────────────────────────
// 30. settlegrid-trading-economics
// ─────────────────────────────────────────────────────────────────────────────

gen({
  slug: 'trading-economics',
  title: 'Trading Economics',
  desc: 'Economic indicators, forecasts, and market data from Trading Economics.',
  api: { base: 'https://api.tradingeconomics.com', name: 'Trading Economics', docs: 'https://docs.tradingeconomics.com/' },
  key: null,
  keywords: ['finance', 'economics', 'indicators', 'forecasts', 'markets'],
  methods: [
    { name: 'get_indicators', display: 'Economic indicators by country', cost: 1, params: 'country', inputs: [{ name: 'country', type: 'string', required: true, desc: 'Country name (e.g. "united states")' }] },
    { name: 'get_markets', display: 'Market data (stocks, bonds, commodities)', cost: 1, params: 'category', inputs: [{ name: 'category', type: 'string', required: true, desc: 'Market category (index, commodity, currency, bond)' }] },
    { name: 'get_forecasts', display: 'Economic forecasts by indicator', cost: 1, params: 'indicator', inputs: [{ name: 'indicator', type: 'string', required: true, desc: 'Indicator name (e.g. "gdp", "inflation rate")' }] },
  ],
  serverTs: `/**
 * settlegrid-trading-economics — Trading Economics MCP Server
 *
 * Wraps the Trading Economics API with SettleGrid billing.
 * Free tier available (guest access).
 *
 * Methods:
 *   get_indicators(country)      — Economic indicators    (1¢)
 *   get_markets(category)        — Market data            (1¢)
 *   get_forecasts(indicator)     — Economic forecasts     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndicatorsInput { country: string }
interface MarketsInput { category: string }
interface ForecastsInput { indicator: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.tradingeconomics.com'
const UA = 'settlegrid-trading-economics/1.0 (contact@settlegrid.ai)'

async function teFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(\`\${BASE}\${path}\`)
  url.searchParams.set('f', 'json')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const key = process.env.TE_API_KEY
  if (key) url.searchParams.set('c', key)
  else url.searchParams.set('c', 'guest:guest')
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Trading Economics API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'trading-economics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'Economic Indicators' },
      get_markets: { costCents: 1, displayName: 'Market Data' },
      get_forecasts: { costCents: 1, displayName: 'Forecasts' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async (args: IndicatorsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (e.g. "united states")')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(\`/country/\${encodeURIComponent(args.country.trim())}\`)
  return { country: args.country, count: Array.isArray(data) ? data.length : 0, indicators: data }
}, { method: 'get_indicators' })

const getMarkets = sg.wrap(async (args: MarketsInput) => {
  if (!args.category || typeof args.category !== 'string') {
    throw new Error('category is required (index, commodity, currency, bond)')
  }
  const validCategories = new Set(['index', 'commodity', 'currency', 'bond'])
  const cat = args.category.toLowerCase().trim()
  if (!validCategories.has(cat)) {
    throw new Error('category must be one of: index, commodity, currency, bond')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(\`/markets/\${cat}\`)
  return { category: cat, count: Array.isArray(data) ? data.length : 0, markets: data }
}, { method: 'get_markets' })

const getForecasts = sg.wrap(async (args: ForecastsInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. "gdp")')
  }
  const data = await teFetch<Array<Record<string, unknown>>>(\`/forecast/indicator/\${encodeURIComponent(args.indicator.trim())}\`)
  return { indicator: args.indicator, count: Array.isArray(data) ? data.length : 0, forecasts: data }
}, { method: 'get_forecasts' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, getMarkets, getForecasts }

console.log('settlegrid-trading-economics MCP server ready')
console.log('Methods: get_indicators, get_markets, get_forecasts')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

console.log('\nDone! 30 Finance MCP servers generated.')
