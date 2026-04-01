/**
 * settlegrid-market-sentinel — Market Data MCP Server
 *
 * Real-time market data monitoring via free APIs.
 * Uses Frankfurter (forex) and Coinpaprika (crypto) — no API key needed.
 *
 * Methods:
 *   get_market_summary()        — Major forex rates + top crypto      (3¢)
 *   get_forex(base, target)     — Currency pair exchange rate         (1¢)
 *   get_crypto_top(limit)       — Top cryptocurrencies by market cap  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetMarketSummaryInput {
  baseCurrency?: string
}

interface GetForexInput {
  base: string
  target: string
  amount?: number
}

interface GetCryptoTopInput {
  limit?: number
}

interface FrankfurterResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

interface CoinpaprikaTicker {
  id: string
  name: string
  symbol: string
  rank: number
  total_supply: number
  max_supply: number
  beta_value: number
  first_data_at: string
  last_updated: string
  quotes: {
    USD: {
      price: number
      volume_24h: number
      volume_24h_change_24h: number
      market_cap: number
      market_cap_change_24h: number
      percent_change_15m: number
      percent_change_30m: number
      percent_change_1h: number
      percent_change_6h: number
      percent_change_12h: number
      percent_change_24h: number
      percent_change_7d: number
      percent_change_30d: number
      ath_price: number
      ath_date: string
      percent_from_price_ath: number
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const USER_AGENT = 'settlegrid-market-sentinel/1.0 (contact@settlegrid.ai)'

const SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BGN', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP',
  'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR',
  'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD',
  'ZAR',
])

async function fetchWithTimeout<T>(url: string, timeoutMs: number = 10_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API error ${res.status}: ${body.slice(0, 200)}`)
    }
    return res.json() as Promise<T>
  } finally {
    clearTimeout(timer)
  }
}

function formatPrice(price: number): string {
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (price >= 0.01) return price.toFixed(4)
  return price.toFixed(8)
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`
  return `$${cap.toLocaleString()}`
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`
  return `$${vol.toLocaleString()}`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'market-sentinel',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_market_summary: { costCents: 3, displayName: 'Market Summary' },
      get_forex: { costCents: 1, displayName: 'Forex Rate' },
      get_crypto_top: { costCents: 2, displayName: 'Top Crypto' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMarketSummary = sg.wrap(async (args: GetMarketSummaryInput) => {
  const base = (args.baseCurrency ?? 'USD').toUpperCase().trim()
  if (!SUPPORTED_CURRENCIES.has(base)) {
    throw new Error(`Unsupported base currency "${args.baseCurrency}". Supported: ${[...SUPPORTED_CURRENCIES].join(', ')}`)
  }

  // Fetch forex and crypto in parallel
  const [forexResult, cryptoResult] = await Promise.allSettled([
    fetchWithTimeout<FrankfurterResponse>(`https://api.frankfurter.app/latest?from=${base}`),
    fetchWithTimeout<CoinpaprikaTicker[]>('https://api.coinpaprika.com/v1/tickers?limit=5'),
  ])

  const forex = forexResult.status === 'fulfilled' ? forexResult.value : null
  const crypto = cryptoResult.status === 'fulfilled' ? cryptoResult.value : null

  if (!forex && !crypto) {
    throw new Error('Unable to fetch market data — both forex and crypto APIs are unreachable')
  }

  // Select major currency pairs
  const majorPairs = ['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY'].filter(c => c !== base)
  const forexRates = forex
    ? majorPairs.map(target => ({
        pair: `${base}/${target}`,
        rate: forex.rates[target] ?? null,
      })).filter(r => r.rate !== null)
    : []

  const cryptoData = crypto
    ? crypto.map(coin => ({
        name: coin.name,
        symbol: coin.symbol,
        rank: coin.rank,
        price: formatPrice(coin.quotes.USD.price),
        priceRaw: coin.quotes.USD.price,
        change24h: `${coin.quotes.USD.percent_change_24h >= 0 ? '+' : ''}${coin.quotes.USD.percent_change_24h.toFixed(2)}%`,
        change7d: `${coin.quotes.USD.percent_change_7d >= 0 ? '+' : ''}${coin.quotes.USD.percent_change_7d.toFixed(2)}%`,
        marketCap: formatMarketCap(coin.quotes.USD.market_cap),
        volume24h: formatVolume(coin.quotes.USD.volume_24h),
      }))
    : []

  return {
    timestamp: new Date().toISOString(),
    baseCurrency: base,
    forexDate: forex?.date ?? null,
    forex: forexRates,
    crypto: cryptoData,
    sources: {
      forex: 'Frankfurter (European Central Bank)',
      crypto: 'Coinpaprika',
    },
  }
}, { method: 'get_market_summary' })

const getForex = sg.wrap(async (args: GetForexInput) => {
  if (!args.base || typeof args.base !== 'string') {
    throw new Error('base currency is required (e.g. "USD", "EUR")')
  }
  if (!args.target || typeof args.target !== 'string') {
    throw new Error('target currency is required (e.g. "EUR", "JPY")')
  }

  const base = args.base.toUpperCase().trim()
  const target = args.target.toUpperCase().trim()
  const amount = Math.max(args.amount ?? 1, 0.01)

  if (!SUPPORTED_CURRENCIES.has(base)) {
    throw new Error(`Unsupported base currency "${args.base}". Supported: ${[...SUPPORTED_CURRENCIES].join(', ')}`)
  }
  if (!SUPPORTED_CURRENCIES.has(target)) {
    throw new Error(`Unsupported target currency "${args.target}". Supported: ${[...SUPPORTED_CURRENCIES].join(', ')}`)
  }
  if (base === target) {
    return {
      pair: `${base}/${target}`,
      rate: 1,
      amount,
      converted: amount,
      date: new Date().toISOString().split('T')[0],
      source: 'Frankfurter (European Central Bank)',
    }
  }

  const data = await fetchWithTimeout<FrankfurterResponse>(
    `https://api.frankfurter.app/latest?from=${base}&to=${target}&amount=${amount}`
  )

  const rate = data.rates[target]
  if (rate === undefined) {
    throw new Error(`Unable to get exchange rate for ${base}/${target}`)
  }

  return {
    pair: `${base}/${target}`,
    rate: data.amount === 1 ? rate : rate / data.amount,
    amount: data.amount,
    converted: rate,
    date: data.date,
    source: 'Frankfurter (European Central Bank)',
  }
}, { method: 'get_forex' })

const getCryptoTop = sg.wrap(async (args: GetCryptoTopInput) => {
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 50)

  const data = await fetchWithTimeout<CoinpaprikaTicker[]>(
    `https://api.coinpaprika.com/v1/tickers?limit=${limit}`
  )

  const totalMarketCap = data.reduce((sum, coin) => sum + (coin.quotes.USD.market_cap ?? 0), 0)

  return {
    timestamp: new Date().toISOString(),
    count: data.length,
    totalMarketCap: formatMarketCap(totalMarketCap),
    coins: data.map(coin => {
      const usd = coin.quotes.USD
      return {
        rank: coin.rank,
        name: coin.name,
        symbol: coin.symbol,
        price: formatPrice(usd.price),
        priceRaw: usd.price,
        marketCap: formatMarketCap(usd.market_cap),
        marketCapRaw: usd.market_cap,
        volume24h: formatVolume(usd.volume_24h),
        change: {
          '1h': `${usd.percent_change_1h >= 0 ? '+' : ''}${usd.percent_change_1h.toFixed(2)}%`,
          '24h': `${usd.percent_change_24h >= 0 ? '+' : ''}${usd.percent_change_24h.toFixed(2)}%`,
          '7d': `${usd.percent_change_7d >= 0 ? '+' : ''}${usd.percent_change_7d.toFixed(2)}%`,
          '30d': `${usd.percent_change_30d >= 0 ? '+' : ''}${usd.percent_change_30d.toFixed(2)}%`,
        },
        allTimeHigh: {
          price: formatPrice(usd.ath_price),
          date: usd.ath_date,
          percentFromATH: `${usd.percent_from_price_ath.toFixed(2)}%`,
        },
        maxSupply: coin.max_supply,
        lastUpdated: coin.last_updated,
      }
    }),
    source: 'Coinpaprika',
  }
}, { method: 'get_crypto_top' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMarketSummary, getForex, getCryptoTop }

console.log('settlegrid-market-sentinel MCP server ready')
console.log('Methods: get_market_summary, get_forex, get_crypto_top')
console.log('Pricing: 1-3¢ per call | Powered by SettleGrid')
