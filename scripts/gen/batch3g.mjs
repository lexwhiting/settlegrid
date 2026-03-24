/**
 * Batch 3G — Servers 236-330 (95 servers)
 * Long-tail MCP servers across underserved categories.
 */
import { gen } from './core.mjs'

console.log('\\n=== Batch 3G: Servers 236-330 (95 servers) ===\\n')

// ─── 236: JMA Japan Weather ─────────────────────────────────────────────────
gen({
  slug: 'jma-weather',
  title: 'JMA Japan Weather',
  desc: 'Japan Meteorological Agency weather forecasts and warnings via Open-Meteo JMA model.',
  api: { base: 'https://api.open-meteo.com/v1/jma', name: 'Open-Meteo JMA', docs: 'https://open-meteo.com/en/docs/jma-api' },
  key: null,
  keywords: ['weather', 'japan', 'jma', 'forecast'],
  methods: [
    { name: 'get_jma_forecast', display: 'Get JMA weather forecast for Japan location', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-16)' },
    ]},
    { name: 'get_jma_hourly', display: 'Get JMA hourly weather data', cost: 1, params: 'lat, lon', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-jma-weather — JMA Japan Weather MCP Server
 *
 * Wraps Open-Meteo JMA model with SettleGrid billing.
 * No API key needed — Open-Meteo is free and open.
 *
 * Methods:
 *   get_jma_forecast(lat, lon, days?) — JMA forecast (1¢)
 *   get_jma_hourly(lat, lon) — JMA hourly data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ForecastInput { lat: number; lon: number; days?: number }
interface HourlyInput { lat: number; lon: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open-meteo.com/v1/jma'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'jma-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_jma_forecast: { costCents: 1, displayName: 'JMA Forecast' },
      get_jma_hourly: { costCents: 1, displayName: 'JMA Hourly' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getJmaForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon are required numbers')
  const days = args.days ?? 7
  if (days < 1 || days > 16) throw new Error('days must be 1-16')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=\${days}&timezone=Asia/Tokyo\`)
  return {
    location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
    daily: data.daily,
    units: data.daily_units,
  }
}, { method: 'get_jma_forecast' })

const getJmaHourly = sg.wrap(async (args: HourlyInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon are required numbers')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&hourly=temperature_2m,relative_humidity_2m,precipitation,weathercode,windspeed_10m&forecast_days=2&timezone=Asia/Tokyo\`)
  return {
    location: { lat: data.latitude, lon: data.longitude },
    hourly: data.hourly,
    units: data.hourly_units,
  }
}, { method: 'get_jma_hourly' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getJmaForecast, getJmaHourly }

console.log('settlegrid-jma-weather MCP server ready')
console.log('Methods: get_jma_forecast, get_jma_hourly')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 237: Australia BOM Weather ──────────────────────────────────────────────
gen({
  slug: 'bom-weather',
  title: 'Australia BOM Weather',
  desc: 'Australian Bureau of Meteorology weather via Open-Meteo BOM model.',
  api: { base: 'https://api.open-meteo.com/v1/bom', name: 'Open-Meteo BOM', docs: 'https://open-meteo.com/en/docs/bom-api' },
  key: null,
  keywords: ['weather', 'australia', 'bom', 'forecast'],
  methods: [
    { name: 'get_bom_forecast', display: 'Get BOM weather forecast for Australia', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-10)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-bom-weather — Australia BOM Weather MCP Server
 *
 * Wraps Open-Meteo BOM model with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_bom_forecast(lat, lon, days?) — BOM forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ForecastInput { lat: number; lon: number; days?: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.open-meteo.com/v1/bom'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bom-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_bom_forecast: { costCents: 1, displayName: 'BOM Forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBomForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  if (days < 1 || days > 10) throw new Error('days must be 1-10')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=\${days}&timezone=Australia/Sydney\`)
  return {
    location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation },
    daily: data.daily,
    units: data.daily_units,
  }
}, { method: 'get_bom_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBomForecast }

console.log('settlegrid-bom-weather MCP server ready')
console.log('Methods: get_bom_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 238: Canada Weather ─────────────────────────────────────────────────────
gen({
  slug: 'canada-weather',
  title: 'Canada Weather',
  desc: 'Environment Canada weather forecasts via Open-Meteo Canadian GEM model.',
  api: { base: 'https://api.open-meteo.com/v1/gem', name: 'Open-Meteo GEM', docs: 'https://open-meteo.com/en/docs/gem-api' },
  key: null,
  keywords: ['weather', 'canada', 'gem', 'forecast'],
  methods: [
    { name: 'get_gem_forecast', display: 'Get GEM weather forecast for Canada', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-14)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-canada-weather — Canada Weather MCP Server
 *
 * Wraps Open-Meteo GEM model with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_gem_forecast(lat, lon, days?) — GEM forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ForecastInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/gem'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'canada-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_gem_forecast: { costCents: 1, displayName: 'GEM Forecast' },
    },
  },
})

const getGemForecast = sg.wrap(async (args: ForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  if (days < 1 || days > 14) throw new Error('days must be 1-14')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,windspeed_10m_max&forecast_days=\${days}&timezone=America/Toronto\`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, units: data.daily_units }
}, { method: 'get_gem_forecast' })

export { getGemForecast }

console.log('settlegrid-canada-weather MCP server ready')
console.log('Methods: get_gem_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 239: South Korea KMA Weather ───────────────────────────────────────────
gen({
  slug: 'kma-weather',
  title: 'South Korea KMA Weather',
  desc: 'Korea Meteorological Administration weather via Open-Meteo for Korean coordinates.',
  api: { base: 'https://api.open-meteo.com/v1/forecast', name: 'Open-Meteo', docs: 'https://open-meteo.com/en/docs' },
  key: null,
  keywords: ['weather', 'korea', 'kma', 'forecast'],
  methods: [
    { name: 'get_korea_weather', display: 'Get weather for South Korea location', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude (Korea: 33-43)' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude (Korea: 124-132)' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-16)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-kma-weather — South Korea KMA Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Korean forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_korea_weather(lat, lon, days?) — Korea weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'kma-weather',
  pricing: { defaultCostCents: 1, methods: { get_korea_weather: { costCents: 1, displayName: 'Korea Weather' } } },
})

const getKoreaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&hourly=temperature_2m,precipitation&forecast_days=\${days}&timezone=Asia/Seoul\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_korea_weather' })

export { getKoreaWeather }

console.log('settlegrid-kma-weather MCP server ready')
console.log('Methods: get_korea_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 240: India Weather ──────────────────────────────────────────────────────
gen({
  slug: 'india-weather',
  title: 'India IMD Weather',
  desc: 'India Meteorological Department weather via Open-Meteo for Indian coordinates.',
  api: { base: 'https://api.open-meteo.com/v1/forecast', name: 'Open-Meteo', docs: 'https://open-meteo.com/en/docs' },
  key: null,
  keywords: ['weather', 'india', 'imd', 'forecast'],
  methods: [
    { name: 'get_india_weather', display: 'Get weather for India location', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude (India: 6-36)' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude (India: 68-98)' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-16)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-india-weather — India IMD Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Indian forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_india_weather(lat, lon, days?) — India weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'india-weather',
  pricing: { defaultCostCents: 1, methods: { get_india_weather: { costCents: 1, displayName: 'India Weather' } } },
})

const getIndiaWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&hourly=temperature_2m,relative_humidity_2m&forecast_days=\${days}&timezone=Asia/Kolkata\`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, hourly: data.hourly }
}, { method: 'get_india_weather' })

export { getIndiaWeather }

console.log('settlegrid-india-weather MCP server ready')
console.log('Methods: get_india_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 241: Brazil Weather ─────────────────────────────────────────────────────
gen({
  slug: 'brazil-weather',
  title: 'Brazil INMET Weather',
  desc: 'Brazil weather forecasts via Open-Meteo for Brazilian coordinates.',
  api: { base: 'https://api.open-meteo.com/v1/forecast', name: 'Open-Meteo', docs: 'https://open-meteo.com/en/docs' },
  key: null,
  keywords: ['weather', 'brazil', 'inmet', 'forecast'],
  methods: [
    { name: 'get_brazil_weather', display: 'Get weather for Brazil location', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-16)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-brazil-weather — Brazil INMET Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Brazilian forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_brazil_weather(lat, lon, days?) — Brazil weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'brazil-weather',
  pricing: { defaultCostCents: 1, methods: { get_brazil_weather: { costCents: 1, displayName: 'Brazil Weather' } } },
})

const getBrazilWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=\${days}&timezone=America/Sao_Paulo\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_brazil_weather' })

export { getBrazilWeather }

console.log('settlegrid-brazil-weather MCP server ready')
console.log('Methods: get_brazil_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 242: Tron Explorer ─────────────────────────────────────────────────────
gen({
  slug: 'tron-explorer',
  title: 'Tron Blockchain Explorer',
  desc: 'Query Tron blockchain data — accounts, transactions, tokens via TronGrid API.',
  api: { base: 'https://api.trongrid.io', name: 'TronGrid', docs: 'https://developers.tron.network/reference' },
  key: null,
  keywords: ['blockchain', 'tron', 'crypto', 'trx'],
  methods: [
    { name: 'get_tron_account', display: 'Get Tron account info', cost: 1, params: 'address', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Tron address (T...)' },
    ]},
    { name: 'get_tron_transactions', display: 'Get Tron account transactions', cost: 1, params: 'address, limit?', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Tron address' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-tron-explorer — Tron Blockchain Explorer MCP Server
 *
 * Wraps TronGrid API with SettleGrid billing.
 * No API key needed for basic queries.
 *
 * Methods:
 *   get_tron_account(address) — account info (1¢)
 *   get_tron_transactions(address, limit?) — transactions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AccountInput { address: string }
interface TxInput { address: string; limit?: number }

const API_BASE = 'https://api.trongrid.io'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'tron-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_tron_account: { costCents: 1, displayName: 'Tron Account' },
      get_tron_transactions: { costCents: 1, displayName: 'Tron Transactions' },
    },
  },
})

const getTronAccount = sg.wrap(async (args: AccountInput) => {
  if (!args.address || !args.address.startsWith('T')) throw new Error('Valid Tron address required (starts with T)')
  const data = await apiFetch<any>(\`/v1/accounts/\${args.address}\`)
  const acct = data.data?.[0] || {}
  return {
    address: acct.address,
    balance_trx: (acct.balance || 0) / 1e6,
    bandwidth: acct.free_net_usage || 0,
    energy: acct.account_resource?.energy_usage || 0,
    created: acct.create_time,
  }
}, { method: 'get_tron_account' })

const getTronTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address) throw new Error('address is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`/v1/accounts/\${args.address}/transactions?limit=\${limit}\`)
  return {
    total: data.meta?.total || 0,
    transactions: (data.data || []).map((tx: any) => ({
      txID: tx.txID,
      block: tx.blockNumber,
      timestamp: tx.block_timestamp,
      type: tx.raw_data?.contract?.[0]?.type,
    })),
  }
}, { method: 'get_tron_transactions' })

export { getTronAccount, getTronTransactions }

console.log('settlegrid-tron-explorer MCP server ready')
console.log('Methods: get_tron_account, get_tron_transactions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 243: Fantom Explorer ────────────────────────────────────────────────────
gen({
  slug: 'fantom-explorer',
  title: 'Fantom Blockchain Explorer',
  desc: 'Query Fantom blockchain data via FTMScan API.',
  api: { base: 'https://api.ftmscan.com/api', name: 'FTMScan', docs: 'https://docs.ftmscan.com/' },
  key: { env: 'FTMSCAN_API_KEY', url: 'https://ftmscan.com/apis', default: '', required: false },
  keywords: ['blockchain', 'fantom', 'crypto', 'ftm', 'defi'],
  methods: [
    { name: 'get_ftm_balance', display: 'Get FTM balance for address', cost: 1, params: 'address', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Fantom address (0x...)' },
    ]},
    { name: 'get_ftm_transactions', display: 'Get Fantom transactions', cost: 1, params: 'address, limit?', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Fantom address' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-fantom-explorer — Fantom Blockchain Explorer MCP Server
 *
 * Wraps FTMScan API with SettleGrid billing.
 * Free key from https://ftmscan.com/apis.
 *
 * Methods:
 *   get_ftm_balance(address) — FTM balance (1¢)
 *   get_ftm_transactions(address, limit?) — transactions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BalanceInput { address: string }
interface TxInput { address: string; limit?: number }

const API_BASE = 'https://api.ftmscan.com/api'
const API_KEY = process.env.FTMSCAN_API_KEY || ''

async function apiFetch<T>(params: string): Promise<T> {
  const sep = API_KEY ? \`&apikey=\${API_KEY}\` : ''
  const res = await fetch(\`\${API_BASE}?\${params}\${sep}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fantom-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_ftm_balance: { costCents: 1, displayName: 'FTM Balance' },
      get_ftm_transactions: { costCents: 1, displayName: 'FTM Transactions' },
    },
  },
})

const getFtmBalance = sg.wrap(async (args: BalanceInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(\`module=account&action=balance&address=\${args.address}&tag=latest\`)
  return { address: args.address, balance_ftm: parseFloat(data.result) / 1e18, raw_wei: data.result }
}, { method: 'get_ftm_balance' })

const getFtmTransactions = sg.wrap(async (args: TxInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`module=account&action=txlist&address=\${args.address}&startblock=0&endblock=99999999&page=1&offset=\${limit}&sort=desc\`)
  return {
    transactions: (data.result || []).map((tx: any) => ({
      hash: tx.hash, block: tx.blockNumber, from: tx.from, to: tx.to,
      value_ftm: parseFloat(tx.value) / 1e18, timestamp: parseInt(tx.timeStamp),
    })),
  }
}, { method: 'get_ftm_transactions' })

export { getFtmBalance, getFtmTransactions }

console.log('settlegrid-fantom-explorer MCP server ready')
console.log('Methods: get_ftm_balance, get_ftm_transactions')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 244: Gnosis Explorer ────────────────────────────────────────────────────
gen({
  slug: 'gnosis-explorer',
  title: 'Gnosis Chain Explorer',
  desc: 'Query Gnosis Chain (xDai) blockchain data via Blockscout API.',
  api: { base: 'https://gnosis.blockscout.com/api/v2', name: 'Gnosis Blockscout', docs: 'https://gnosis.blockscout.com/api-docs' },
  key: null,
  keywords: ['blockchain', 'gnosis', 'xdai', 'crypto'],
  methods: [
    { name: 'get_gnosis_address', display: 'Get Gnosis address info', cost: 1, params: 'address', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Gnosis address (0x...)' },
    ]},
    { name: 'get_gnosis_tx', display: 'Get Gnosis transaction details', cost: 1, params: 'hash', inputs: [
      { name: 'hash', type: 'string', required: true, desc: 'Transaction hash' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-gnosis-explorer — Gnosis Chain Explorer MCP Server
 *
 * Wraps Gnosis Blockscout API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_gnosis_address(address) — address info (1¢)
 *   get_gnosis_tx(hash) — transaction details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AddressInput { address: string }
interface TxInput { hash: string }

const API_BASE = 'https://gnosis.blockscout.com/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'gnosis-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_gnosis_address: { costCents: 1, displayName: 'Gnosis Address' },
      get_gnosis_tx: { costCents: 1, displayName: 'Gnosis Transaction' },
    },
  },
})

const getGnosisAddress = sg.wrap(async (args: AddressInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(\`/addresses/\${args.address}\`)
  return {
    address: data.hash, name: data.name || null,
    balance_xdai: data.coin_balance ? parseFloat(data.coin_balance) / 1e18 : 0,
    tx_count: data.transactions_count, token_transfers: data.token_transfers_count,
    is_contract: data.is_contract,
  }
}, { method: 'get_gnosis_address' })

const getGnosisTx = sg.wrap(async (args: TxInput) => {
  if (!args.hash?.startsWith('0x')) throw new Error('Valid transaction hash required')
  const data = await apiFetch<any>(\`/transactions/\${args.hash}\`)
  return {
    hash: data.hash, block: data.block, status: data.status,
    from: data.from?.hash, to: data.to?.hash,
    value: data.value, fee: data.fee?.value,
    timestamp: data.timestamp, method: data.method,
  }
}, { method: 'get_gnosis_tx' })

export { getGnosisAddress, getGnosisTx }

console.log('settlegrid-gnosis-explorer MCP server ready')
console.log('Methods: get_gnosis_address, get_gnosis_tx')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 245: Moonbeam Explorer ─────────────────────────────────────────────────
gen({
  slug: 'moonbeam-explorer',
  title: 'Moonbeam Blockchain Explorer',
  desc: 'Query Moonbeam blockchain data via Blockscout API.',
  api: { base: 'https://moonbeam.blockscout.com/api/v2', name: 'Moonbeam Blockscout', docs: 'https://moonbeam.blockscout.com/api-docs' },
  key: null,
  keywords: ['blockchain', 'moonbeam', 'polkadot', 'crypto'],
  methods: [
    { name: 'get_moonbeam_address', display: 'Get Moonbeam address info', cost: 1, params: 'address', inputs: [
      { name: 'address', type: 'string', required: true, desc: 'Moonbeam address (0x...)' },
    ]},
    { name: 'get_moonbeam_block', display: 'Get Moonbeam block info', cost: 1, params: 'number', inputs: [
      { name: 'number', type: 'number', required: true, desc: 'Block number' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-moonbeam-explorer — Moonbeam Blockchain Explorer MCP Server
 *
 * Wraps Moonbeam Blockscout API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_moonbeam_address(address) — address info (1¢)
 *   get_moonbeam_block(number) — block info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AddressInput { address: string }
interface BlockInput { number: number }

const API_BASE = 'https://moonbeam.blockscout.com/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'moonbeam-explorer',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_moonbeam_address: { costCents: 1, displayName: 'Moonbeam Address' },
      get_moonbeam_block: { costCents: 1, displayName: 'Moonbeam Block' },
    },
  },
})

const getMoonbeamAddress = sg.wrap(async (args: AddressInput) => {
  if (!args.address?.startsWith('0x')) throw new Error('Valid 0x address required')
  const data = await apiFetch<any>(\`/addresses/\${args.address}\`)
  return {
    address: data.hash, balance_glmr: data.coin_balance ? parseFloat(data.coin_balance) / 1e18 : 0,
    tx_count: data.transactions_count, is_contract: data.is_contract, name: data.name || null,
  }
}, { method: 'get_moonbeam_address' })

const getMoonbeamBlock = sg.wrap(async (args: BlockInput) => {
  if (typeof args.number !== 'number') throw new Error('block number required')
  const data = await apiFetch<any>(\`/blocks/\${args.number}\`)
  return {
    number: data.height, hash: data.hash, timestamp: data.timestamp,
    tx_count: data.tx_count, gas_used: data.gas_used, gas_limit: data.gas_limit,
    miner: data.miner?.hash, size: data.size,
  }
}, { method: 'get_moonbeam_block' })

export { getMoonbeamAddress, getMoonbeamBlock }

console.log('settlegrid-moonbeam-explorer MCP server ready')
console.log('Methods: get_moonbeam_address, get_moonbeam_block')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 246: DeFi Llama ─────────────────────────────────────────────────────────
gen({
  slug: 'defillama',
  title: 'DeFi Llama',
  desc: 'DeFi TVL data, protocol stats, and chain analytics from DefiLlama.',
  api: { base: 'https://api.llama.fi', name: 'DefiLlama', docs: 'https://defillama.com/docs/api' },
  key: null,
  keywords: ['defi', 'tvl', 'crypto', 'blockchain', 'analytics'],
  methods: [
    { name: 'get_protocol_tvl', display: 'Get protocol TVL data', cost: 1, params: 'protocol', inputs: [
      { name: 'protocol', type: 'string', required: true, desc: 'Protocol slug (e.g. aave, uniswap)' },
    ]},
    { name: 'get_chain_tvl', display: 'Get chain TVL data', cost: 1, params: 'chain', inputs: [
      { name: 'chain', type: 'string', required: true, desc: 'Chain name (e.g. Ethereum, BSC)' },
    ]},
    { name: 'list_protocols', display: 'List all DeFi protocols', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-defillama — DeFi Llama MCP Server
 *
 * Wraps DefiLlama API with SettleGrid billing.
 * No API key needed — DefiLlama is free and open.
 *
 * Methods:
 *   get_protocol_tvl(protocol) — protocol TVL (1¢)
 *   get_chain_tvl(chain) — chain TVL (1¢)
 *   list_protocols() — list all protocols (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ProtocolInput { protocol: string }
interface ChainInput { chain: string }

const API_BASE = 'https://api.llama.fi'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'defillama',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_protocol_tvl: { costCents: 1, displayName: 'Protocol TVL' },
      get_chain_tvl: { costCents: 1, displayName: 'Chain TVL' },
      list_protocols: { costCents: 1, displayName: 'List Protocols' },
    },
  },
})

const getProtocolTvl = sg.wrap(async (args: ProtocolInput) => {
  if (!args.protocol) throw new Error('protocol slug is required')
  const data = await apiFetch<any>(\`/protocol/\${args.protocol}\`)
  return {
    name: data.name, symbol: data.symbol, category: data.category,
    tvl: data.tvl, chains: data.chains, chainTvls: data.currentChainTvls,
    change_1d: data.change_1d, change_7d: data.change_7d,
    url: data.url, description: data.description,
  }
}, { method: 'get_protocol_tvl' })

const getChainTvl = sg.wrap(async (args: ChainInput) => {
  if (!args.chain) throw new Error('chain name is required')
  const data = await apiFetch<any>(\`/v2/historicalChainTvl/\${args.chain}\`)
  const recent = data.slice(-30)
  return { chain: args.chain, history: recent, latest_tvl: recent[recent.length - 1]?.tvl || 0 }
}, { method: 'get_chain_tvl' })

const listProtocols = sg.wrap(async () => {
  const data = await apiFetch<any[]>('/protocols')
  return {
    total: data.length,
    top_50: data.slice(0, 50).map((p: any) => ({
      name: p.name, slug: p.slug, tvl: p.tvl, category: p.category, chains: p.chains,
    })),
  }
}, { method: 'list_protocols' })

export { getProtocolTvl, getChainTvl, listProtocols }

console.log('settlegrid-defillama MCP server ready')
console.log('Methods: get_protocol_tvl, get_chain_tvl, list_protocols')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 247: CoinGecko Markets ─────────────────────────────────────────────────
gen({
  slug: 'coingecko-markets',
  title: 'CoinGecko Markets',
  desc: 'Crypto market data, trending coins, and exchange info from CoinGecko.',
  api: { base: 'https://api.coingecko.com/api/v3', name: 'CoinGecko', docs: 'https://docs.coingecko.com/reference/introduction' },
  key: null,
  keywords: ['crypto', 'market', 'coingecko', 'prices', 'trending'],
  methods: [
    { name: 'get_trending', display: 'Get trending cryptocurrencies', cost: 1, params: '', inputs: [] },
    { name: 'get_global_market', display: 'Get global crypto market data', cost: 1, params: '', inputs: [] },
    { name: 'get_exchanges', display: 'Get top exchanges by volume', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Number of exchanges (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-coingecko-markets — CoinGecko Markets MCP Server
 *
 * Wraps CoinGecko free API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   get_trending() — trending coins (1¢)
 *   get_global_market() — global market data (1¢)
 *   get_exchanges(limit?) — top exchanges (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ExchangeInput { limit?: number }

const API_BASE = 'https://api.coingecko.com/api/v3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'coingecko-markets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_trending: { costCents: 1, displayName: 'Trending Coins' },
      get_global_market: { costCents: 1, displayName: 'Global Market' },
      get_exchanges: { costCents: 1, displayName: 'Top Exchanges' },
    },
  },
})

const getTrending = sg.wrap(async () => {
  const data = await apiFetch<any>('/search/trending')
  return {
    coins: (data.coins || []).map((c: any) => ({
      name: c.item.name, symbol: c.item.symbol, rank: c.item.market_cap_rank,
      price_btc: c.item.price_btc, score: c.item.score,
    })),
  }
}, { method: 'get_trending' })

const getGlobalMarket = sg.wrap(async () => {
  const data = await apiFetch<any>('/global')
  const g = data.data
  return {
    active_coins: g.active_cryptocurrencies, markets: g.markets,
    total_market_cap_usd: g.total_market_cap?.usd,
    total_volume_usd: g.total_volume?.usd,
    btc_dominance: g.market_cap_percentage?.btc,
    eth_dominance: g.market_cap_percentage?.eth,
    change_24h: g.market_cap_change_percentage_24h_usd,
  }
}, { method: 'get_global_market' })

const getExchanges = sg.wrap(async (args: ExchangeInput) => {
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(\`/exchanges?per_page=\${limit}&page=1\`)
  return {
    exchanges: data.map((e: any) => ({
      id: e.id, name: e.name, country: e.country, trust_score: e.trust_score,
      volume_btc_24h: e.trade_volume_24h_btc, year: e.year_established,
    })),
  }
}, { method: 'get_exchanges' })

export { getTrending, getGlobalMarket, getExchanges }

console.log('settlegrid-coingecko-markets MCP server ready')
console.log('Methods: get_trending, get_global_market, get_exchanges')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 248: TheSportsDB ───────────────────────────────────────────────────────
gen({
  slug: 'sportsdb',
  title: 'TheSportsDB',
  desc: 'Free sports data — teams, players, events, leagues from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'teams', 'players', 'scores', 'leagues'],
  methods: [
    { name: 'search_team', display: 'Search for a sports team', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Team name' },
    ]},
    { name: 'get_league_events', display: 'Get league events/schedule', cost: 1, params: 'league_id', inputs: [
      { name: 'league_id', type: 'string', required: true, desc: 'League ID' },
    ]},
    { name: 'search_player', display: 'Search for a player', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Player name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-sportsdb — TheSportsDB MCP Server
 *
 * Wraps TheSportsDB free API with SettleGrid billing.
 * No API key needed — uses free tier.
 *
 * Methods:
 *   search_team(name) — search teams (1¢)
 *   get_league_events(league_id) — league events (1¢)
 *   search_player(name) — search players (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface LeagueInput { league_id: string }
interface PlayerInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'sportsdb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_team: { costCents: 1, displayName: 'Search Team' },
      get_league_events: { costCents: 1, displayName: 'League Events' },
      search_player: { costCents: 1, displayName: 'Search Player' },
    },
  },
})

const searchTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('team name required')
  const data = await apiFetch<any>(\`/searchteams.php?t=\${encodeURIComponent(args.name)}\`)
  return {
    teams: (data.teams || []).map((t: any) => ({
      id: t.idTeam, name: t.strTeam, league: t.strLeague, sport: t.strSport,
      country: t.strCountry, stadium: t.strStadium, description: t.strDescriptionEN?.slice(0, 300),
      badge: t.strBadge, year_formed: t.intFormedYear,
    })),
  }
}, { method: 'search_team' })

const getLeagueEvents = sg.wrap(async (args: LeagueInput) => {
  if (!args.league_id) throw new Error('league_id required')
  const data = await apiFetch<any>(\`/eventsnextleague.php?id=\${args.league_id}\`)
  return {
    events: (data.events || []).map((e: any) => ({
      id: e.idEvent, name: e.strEvent, date: e.dateEvent, time: e.strTime,
      home: e.strHomeTeam, away: e.strAwayTeam, venue: e.strVenue, league: e.strLeague,
    })),
  }
}, { method: 'get_league_events' })

const searchPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('player name required')
  const data = await apiFetch<any>(\`/searchplayers.php?p=\${encodeURIComponent(args.name)}\`)
  return {
    players: (data.player || []).map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, team: p.strTeam, sport: p.strSport,
      nationality: p.strNationality, position: p.strPosition, born: p.dateBorn,
      description: p.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_player' })

export { searchTeam, getLeagueEvents, searchPlayer }

console.log('settlegrid-sportsdb MCP server ready')
console.log('Methods: search_team, get_league_events, search_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 249: Cricket Data ──────────────────────────────────────────────────────
gen({
  slug: 'cricket-data',
  title: 'Cricket Data',
  desc: 'Cricket scores, matches, and player stats from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'cricket', 'scores', 'ipl', 'test-match'],
  methods: [
    { name: 'search_cricket_team', display: 'Search cricket teams', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Cricket team name' },
    ]},
    { name: 'get_cricket_events', display: 'Get upcoming cricket events', cost: 1, params: 'league_id', inputs: [
      { name: 'league_id', type: 'string', required: true, desc: 'Cricket league ID (e.g. 4720 for IPL)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cricket-data — Cricket Data MCP Server
 *
 * Wraps TheSportsDB cricket endpoints with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_cricket_team(name) — search cricket teams (1¢)
 *   get_cricket_events(league_id) — upcoming cricket events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface EventInput { league_id: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'cricket-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_cricket_team: { costCents: 1, displayName: 'Search Cricket Team' },
      get_cricket_events: { costCents: 1, displayName: 'Cricket Events' },
    },
  },
})

const searchCricketTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('team name required')
  const data = await apiFetch<any>(\`/searchteams.php?t=\${encodeURIComponent(args.name)}\`)
  const cricketTeams = (data.teams || []).filter((t: any) => t.strSport === 'Cricket')
  return {
    teams: cricketTeams.map((t: any) => ({
      id: t.idTeam, name: t.strTeam, country: t.strCountry,
      league: t.strLeague, stadium: t.strStadium, badge: t.strBadge,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_cricket_team' })

const getCricketEvents = sg.wrap(async (args: EventInput) => {
  if (!args.league_id) throw new Error('league_id required')
  const data = await apiFetch<any>(\`/eventsnextleague.php?id=\${args.league_id}\`)
  return {
    events: (data.events || []).map((e: any) => ({
      id: e.idEvent, name: e.strEvent, date: e.dateEvent, time: e.strTime,
      home: e.strHomeTeam, away: e.strAwayTeam, venue: e.strVenue,
      season: e.strSeason, round: e.intRound,
    })),
  }
}, { method: 'get_cricket_events' })

export { searchCricketTeam, getCricketEvents }

console.log('settlegrid-cricket-data MCP server ready')
console.log('Methods: search_cricket_team, get_cricket_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 250: Motorsport Data ──────────────────────────────────────────────────
gen({
  slug: 'motorsport-data',
  title: 'Motorsport Data',
  desc: 'Formula 1, MotoGP, and motorsport data from Ergast API.',
  api: { base: 'https://ergast.com/api/f1', name: 'Ergast F1', docs: 'https://ergast.com/mrd/' },
  key: null,
  keywords: ['sports', 'f1', 'formula1', 'motorsport', 'racing'],
  methods: [
    { name: 'get_f1_standings', display: 'Get current F1 driver standings', cost: 1, params: 'season?', inputs: [
      { name: 'season', type: 'string', required: false, desc: 'Season year (default: current)' },
    ]},
    { name: 'get_f1_schedule', display: 'Get F1 race schedule', cost: 1, params: 'season?', inputs: [
      { name: 'season', type: 'string', required: false, desc: 'Season year (default: current)' },
    ]},
    { name: 'get_f1_race_result', display: 'Get F1 race result', cost: 1, params: 'season, round', inputs: [
      { name: 'season', type: 'string', required: true, desc: 'Season year' },
      { name: 'round', type: 'string', required: true, desc: 'Round number' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-motorsport-data — Motorsport Data MCP Server
 *
 * Wraps Ergast F1 API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_f1_standings(season?) — F1 standings (1¢)
 *   get_f1_schedule(season?) — F1 schedule (1¢)
 *   get_f1_race_result(season, round) — race result (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface StandingsInput { season?: string }
interface ScheduleInput { season?: string }
interface RaceInput { season: string; round: string }

const API_BASE = 'https://ergast.com/api/f1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}.json\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'motorsport-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_f1_standings: { costCents: 1, displayName: 'F1 Standings' },
      get_f1_schedule: { costCents: 1, displayName: 'F1 Schedule' },
      get_f1_race_result: { costCents: 1, displayName: 'F1 Race Result' },
    },
  },
})

const getF1Standings = sg.wrap(async (args: StandingsInput) => {
  const season = args.season || 'current'
  const data = await apiFetch<any>(\`/\${season}/driverStandings\`)
  const standings = data.MRData?.StandingsTable?.StandingsLists?.[0]
  return {
    season: standings?.season,
    drivers: (standings?.DriverStandings || []).map((d: any) => ({
      position: d.position, points: d.points, wins: d.wins,
      driver: \`\${d.Driver.givenName} \${d.Driver.familyName}\`,
      nationality: d.Driver.nationality,
      constructor: d.Constructors?.[0]?.name,
    })),
  }
}, { method: 'get_f1_standings' })

const getF1Schedule = sg.wrap(async (args: ScheduleInput) => {
  const season = args.season || 'current'
  const data = await apiFetch<any>(\`/\${season}\`)
  const races = data.MRData?.RaceTable?.Races || []
  return {
    season: data.MRData?.RaceTable?.season,
    races: races.map((r: any) => ({
      round: r.round, name: r.raceName, circuit: r.Circuit.circuitName,
      country: r.Circuit.Location.country, date: r.date, time: r.time,
    })),
  }
}, { method: 'get_f1_schedule' })

const getF1RaceResult = sg.wrap(async (args: RaceInput) => {
  if (!args.season || !args.round) throw new Error('season and round required')
  const data = await apiFetch<any>(\`/\${args.season}/\${args.round}/results\`)
  const race = data.MRData?.RaceTable?.Races?.[0]
  return {
    race: race?.raceName, circuit: race?.Circuit?.circuitName, date: race?.date,
    results: (race?.Results || []).map((r: any) => ({
      position: r.position, driver: \`\${r.Driver.givenName} \${r.Driver.familyName}\`,
      constructor: r.Constructor.name, time: r.Time?.time, status: r.status,
      points: r.points, grid: r.grid, laps: r.laps,
    })),
  }
}, { method: 'get_f1_race_result' })

export { getF1Standings, getF1Schedule, getF1RaceResult }

console.log('settlegrid-motorsport-data MCP server ready')
console.log('Methods: get_f1_standings, get_f1_schedule, get_f1_race_result')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

console.log('\\n--- Part 1 (236-250) complete ---\\n')

// ─── 251: Open Food Facts ───────────────────────────────────────────────────
gen({
  slug: 'open-food-facts',
  title: 'Open Food Facts',
  desc: 'Free food product database — nutrition, ingredients, allergens from Open Food Facts.',
  api: { base: 'https://world.openfoodfacts.org/api/v2', name: 'Open Food Facts', docs: 'https://wiki.openfoodfacts.org/API' },
  key: null,
  keywords: ['food', 'nutrition', 'ingredients', 'barcode', 'allergens'],
  methods: [
    { name: 'get_product', display: 'Get food product by barcode', cost: 1, params: 'barcode', inputs: [
      { name: 'barcode', type: 'string', required: true, desc: 'Product barcode (EAN/UPC)' },
    ]},
    { name: 'search_products', display: 'Search food products', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-open-food-facts — Open Food Facts MCP Server
 *
 * Wraps Open Food Facts API with SettleGrid billing.
 * No API key needed — fully open data.
 *
 * Methods:
 *   get_product(barcode) — product by barcode (1¢)
 *   search_products(query, limit?) — search products (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ProductInput { barcode: string }
interface SearchInput { query: string; limit?: number }

const API_BASE = 'https://world.openfoodfacts.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'User-Agent': 'SettleGrid-MCP/1.0' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'open-food-facts',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_product: { costCents: 1, displayName: 'Get Product' },
      search_products: { costCents: 1, displayName: 'Search Products' },
    },
  },
})

const getProduct = sg.wrap(async (args: ProductInput) => {
  if (!args.barcode) throw new Error('barcode is required')
  const data = await apiFetch<any>(\`/api/v2/product/\${args.barcode}.json\`)
  if (data.status === 0) throw new Error('Product not found')
  const p = data.product
  return {
    name: p.product_name, brand: p.brands, barcode: p.code,
    categories: p.categories, ingredients: p.ingredients_text,
    nutriscore: p.nutriscore_grade, nova_group: p.nova_group,
    nutrition: p.nutriments ? {
      energy_kcal: p.nutriments['energy-kcal_100g'], fat: p.nutriments.fat_100g,
      carbs: p.nutriments.carbohydrates_100g, protein: p.nutriments.proteins_100g,
      sugar: p.nutriments.sugars_100g, salt: p.nutriments.salt_100g,
    } : null,
    allergens: p.allergens, image_url: p.image_url,
  }
}, { method: 'get_product' })

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`/cgi/search.pl?search_terms=\${encodeURIComponent(args.query)}&page_size=\${limit}&json=1\`)
  return {
    count: data.count,
    products: (data.products || []).map((p: any) => ({
      barcode: p.code, name: p.product_name, brand: p.brands,
      nutriscore: p.nutriscore_grade, categories: p.categories,
      image_url: p.image_small_url,
    })),
  }
}, { method: 'search_products' })

export { getProduct, searchProducts }

console.log('settlegrid-open-food-facts MCP server ready')
console.log('Methods: get_product, search_products')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 252: TheCocktailDB Extended ────────────────────────────────────────────
gen({
  slug: 'cocktail-recipes',
  title: 'Cocktail Recipes',
  desc: 'Cocktail recipes, ingredients, and drink lookup from TheCocktailDB.',
  api: { base: 'https://www.thecocktaildb.com/api/json/v1/1', name: 'TheCocktailDB', docs: 'https://www.thecocktaildb.com/api.php' },
  key: null,
  keywords: ['food', 'cocktails', 'drinks', 'recipes', 'bartending'],
  methods: [
    { name: 'search_cocktail', display: 'Search cocktails by name', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Cocktail name' },
    ]},
    { name: 'get_random_cocktail', display: 'Get a random cocktail recipe', cost: 1, params: '', inputs: [] },
    { name: 'list_by_ingredient', display: 'List cocktails by ingredient', cost: 1, params: 'ingredient', inputs: [
      { name: 'ingredient', type: 'string', required: true, desc: 'Ingredient name (e.g. Vodka)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cocktail-recipes — Cocktail Recipes MCP Server
 *
 * Wraps TheCocktailDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_cocktail(name) — search cocktails (1¢)
 *   get_random_cocktail() — random cocktail (1¢)
 *   list_by_ingredient(ingredient) — cocktails by ingredient (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }
interface IngredientInput { ingredient: string }

const API_BASE = 'https://www.thecocktaildb.com/api/json/v1/1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function parseDrink(d: any) {
  const ingredients: string[] = []
  for (let i = 1; i <= 15; i++) {
    const ing = d[\`strIngredient\${i}\`]
    const meas = d[\`strMeasure\${i}\`]
    if (ing) ingredients.push(\`\${meas ? meas.trim() + ' ' : ''}\${ing}\`)
  }
  return {
    id: d.idDrink, name: d.strDrink, category: d.strCategory,
    glass: d.strGlass, alcoholic: d.strAlcoholic,
    instructions: d.strInstructions, ingredients, image: d.strDrinkThumb,
  }
}

const sg = settlegrid.init({
  toolSlug: 'cocktail-recipes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_cocktail: { costCents: 1, displayName: 'Search Cocktail' },
      get_random_cocktail: { costCents: 1, displayName: 'Random Cocktail' },
      list_by_ingredient: { costCents: 1, displayName: 'By Ingredient' },
    },
  },
})

const searchCocktail = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/search.php?s=\${encodeURIComponent(args.name)}\`)
  return { drinks: (data.drinks || []).map(parseDrink) }
}, { method: 'search_cocktail' })

const getRandomCocktail = sg.wrap(async () => {
  const data = await apiFetch<any>('/random.php')
  return { drink: data.drinks?.[0] ? parseDrink(data.drinks[0]) : null }
}, { method: 'get_random_cocktail' })

const listByIngredient = sg.wrap(async (args: IngredientInput) => {
  if (!args.ingredient) throw new Error('ingredient is required')
  const data = await apiFetch<any>(\`/filter.php?i=\${encodeURIComponent(args.ingredient)}\`)
  return {
    ingredient: args.ingredient,
    drinks: (data.drinks || []).map((d: any) => ({ id: d.idDrink, name: d.strDrink, image: d.strDrinkThumb })),
  }
}, { method: 'list_by_ingredient' })

export { searchCocktail, getRandomCocktail, listByIngredient }

console.log('settlegrid-cocktail-recipes MCP server ready')
console.log('Methods: search_cocktail, get_random_cocktail, list_by_ingredient')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 253: Meal Recipes ──────────────────────────────────────────────────────
gen({
  slug: 'meal-recipes',
  title: 'Meal Recipes',
  desc: 'Meal recipes, categories, and cooking instructions from TheMealDB.',
  api: { base: 'https://www.themealdb.com/api/json/v1/1', name: 'TheMealDB', docs: 'https://www.themealdb.com/api.php' },
  key: null,
  keywords: ['food', 'recipes', 'meals', 'cooking', 'cuisine'],
  methods: [
    { name: 'search_meal', display: 'Search meals by name', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Meal name' },
    ]},
    { name: 'get_random_meal', display: 'Get a random meal recipe', cost: 1, params: '', inputs: [] },
    { name: 'filter_by_category', display: 'Filter meals by category', cost: 1, params: 'category', inputs: [
      { name: 'category', type: 'string', required: true, desc: 'Category (e.g. Seafood, Vegetarian)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-meal-recipes — Meal Recipes MCP Server
 *
 * Wraps TheMealDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_meal(name) — search meals (1¢)
 *   get_random_meal() — random meal (1¢)
 *   filter_by_category(category) — filter by category (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }
interface CategoryInput { category: string }

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function parseMeal(m: any) {
  const ingredients: string[] = []
  for (let i = 1; i <= 20; i++) {
    const ing = m[\`strIngredient\${i}\`]
    const meas = m[\`strMeasure\${i}\`]
    if (ing && ing.trim()) ingredients.push(\`\${meas ? meas.trim() + ' ' : ''}\${ing}\`)
  }
  return {
    id: m.idMeal, name: m.strMeal, category: m.strCategory, area: m.strArea,
    instructions: m.strInstructions, ingredients, image: m.strMealThumb,
    youtube: m.strYoutube, source: m.strSource, tags: m.strTags,
  }
}

const sg = settlegrid.init({
  toolSlug: 'meal-recipes',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_meal: { costCents: 1, displayName: 'Search Meal' },
      get_random_meal: { costCents: 1, displayName: 'Random Meal' },
      filter_by_category: { costCents: 1, displayName: 'Filter By Category' },
    },
  },
})

const searchMeal = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/search.php?s=\${encodeURIComponent(args.name)}\`)
  return { meals: (data.meals || []).map(parseMeal) }
}, { method: 'search_meal' })

const getRandomMeal = sg.wrap(async () => {
  const data = await apiFetch<any>('/random.php')
  return { meal: data.meals?.[0] ? parseMeal(data.meals[0]) : null }
}, { method: 'get_random_meal' })

const filterByCategory = sg.wrap(async (args: CategoryInput) => {
  if (!args.category) throw new Error('category is required')
  const data = await apiFetch<any>(\`/filter.php?c=\${encodeURIComponent(args.category)}\`)
  return {
    category: args.category,
    meals: (data.meals || []).map((m: any) => ({ id: m.idMeal, name: m.strMeal, image: m.strMealThumb })),
  }
}, { method: 'filter_by_category' })

export { searchMeal, getRandomMeal, filterByCategory }

console.log('settlegrid-meal-recipes MCP server ready')
console.log('Methods: search_meal, get_random_meal, filter_by_category')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 254: Beer Data ─────────────────────────────────────────────────────────
gen({
  slug: 'brewery-data',
  title: 'Brewery Data',
  desc: 'Brewery information and search from Open Brewery DB.',
  api: { base: 'https://api.openbrewerydb.org/v1', name: 'Open Brewery DB', docs: 'https://www.openbrewerydb.org/documentation' },
  key: null,
  keywords: ['food', 'beer', 'brewery', 'craft-beer'],
  methods: [
    { name: 'search_breweries', display: 'Search breweries by name', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_brewery', display: 'Get brewery by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Brewery ID' },
    ]},
    { name: 'breweries_by_city', display: 'List breweries in a city', cost: 1, params: 'city, limit?', inputs: [
      { name: 'city', type: 'string', required: true, desc: 'City name' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-brewery-data — Brewery Data MCP Server
 *
 * Wraps Open Brewery DB API with SettleGrid billing.
 * No API key needed — fully open.
 *
 * Methods:
 *   search_breweries(query, limit?) — search breweries (1¢)
 *   get_brewery(id) — get brewery by ID (1¢)
 *   breweries_by_city(city, limit?) — breweries in city (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface BreweryInput { id: string }
interface CityInput { city: string; limit?: number }

const API_BASE = 'https://api.openbrewerydb.org/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'brewery-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_breweries: { costCents: 1, displayName: 'Search Breweries' },
      get_brewery: { costCents: 1, displayName: 'Get Brewery' },
      breweries_by_city: { costCents: 1, displayName: 'Breweries By City' },
    },
  },
})

const searchBreweries = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(\`/breweries/search?query=\${encodeURIComponent(args.query)}&per_page=\${limit}\`)
  return {
    breweries: data.map((b: any) => ({
      id: b.id, name: b.name, type: b.brewery_type,
      city: b.city, state: b.state, country: b.country,
      phone: b.phone, website: b.website_url,
      lat: b.latitude, lon: b.longitude,
    })),
  }
}, { method: 'search_breweries' })

const getBrewery = sg.wrap(async (args: BreweryInput) => {
  if (!args.id) throw new Error('id is required')
  const b = await apiFetch<any>(\`/breweries/\${args.id}\`)
  return {
    id: b.id, name: b.name, type: b.brewery_type,
    address: \`\${b.address_1 || ''} \${b.address_2 || ''}\`.trim(),
    city: b.city, state: b.state, country: b.country, postal: b.postal_code,
    phone: b.phone, website: b.website_url, lat: b.latitude, lon: b.longitude,
  }
}, { method: 'get_brewery' })

const breweriesByCity = sg.wrap(async (args: CityInput) => {
  if (!args.city) throw new Error('city is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(\`/breweries?by_city=\${encodeURIComponent(args.city)}&per_page=\${limit}\`)
  return {
    city: args.city,
    breweries: data.map((b: any) => ({
      id: b.id, name: b.name, type: b.brewery_type, website: b.website_url,
    })),
  }
}, { method: 'breweries_by_city' })

export { searchBreweries, getBrewery, breweriesByCity }

console.log('settlegrid-brewery-data MCP server ready')
console.log('Methods: search_breweries, get_brewery, breweries_by_city')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 255: UUID Generator ────────────────────────────────────────────────────
gen({
  slug: 'uuid-generator',
  title: 'UUID Generator',
  desc: 'Generate UUIDs (v4, v7) and parse UUID metadata — no external API needed.',
  api: { base: 'https://httpbin.org', name: 'Local Generation', docs: 'https://datatracker.ietf.org/doc/html/rfc4122' },
  key: null,
  keywords: ['utility', 'uuid', 'generator', 'id'],
  methods: [
    { name: 'generate_uuid', display: 'Generate UUID v4', cost: 1, params: 'count?', inputs: [
      { name: 'count', type: 'number', required: false, desc: 'Number of UUIDs (1-100, default 1)' },
    ]},
    { name: 'parse_uuid', display: 'Parse UUID and extract metadata', cost: 1, params: 'uuid', inputs: [
      { name: 'uuid', type: 'string', required: true, desc: 'UUID to parse' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-uuid-generator — UUID Generator MCP Server
 *
 * Generates UUIDs locally with SettleGrid billing.
 * No API key needed — purely local generation.
 *
 * Methods:
 *   generate_uuid(count?) — generate UUIDs (1¢)
 *   parse_uuid(uuid) — parse UUID metadata (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomUUID } from 'node:crypto'

interface GenerateInput { count?: number }
interface ParseInput { uuid: string }

const sg = settlegrid.init({
  toolSlug: 'uuid-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_uuid: { costCents: 1, displayName: 'Generate UUID' },
      parse_uuid: { costCents: 1, displayName: 'Parse UUID' },
    },
  },
})

const generateUuid = sg.wrap(async (args: GenerateInput) => {
  const count = Math.min(Math.max(args.count ?? 1, 1), 100)
  const uuids: string[] = []
  for (let i = 0; i < count; i++) uuids.push(randomUUID())
  return { count, uuids }
}, { method: 'generate_uuid' })

const parseUuid = sg.wrap(async (args: ParseInput) => {
  if (!args.uuid) throw new Error('uuid is required')
  const cleaned = args.uuid.replace(/[^0-9a-fA-F]/g, '')
  if (cleaned.length !== 32) throw new Error('Invalid UUID format')
  const version = parseInt(cleaned[12], 16)
  const variantBits = parseInt(cleaned[16], 16)
  let variant = 'unknown'
  if ((variantBits & 0x8) === 0) variant = 'NCS'
  else if ((variantBits & 0xc) === 0x8) variant = 'RFC4122'
  else if ((variantBits & 0xe) === 0xc) variant = 'Microsoft'
  else variant = 'Future'
  return {
    uuid: args.uuid, version, variant,
    is_nil: cleaned === '0'.repeat(32),
    hex: cleaned, bytes: cleaned.length / 2,
    urn: \`urn:uuid:\${args.uuid}\`,
  }
}, { method: 'parse_uuid' })

export { generateUuid, parseUuid }

console.log('settlegrid-uuid-generator MCP server ready')
console.log('Methods: generate_uuid, parse_uuid')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 256: IP Info Extended ──────────────────────────────────────────────────
gen({
  slug: 'ip-lookup',
  title: 'IP Address Lookup',
  desc: 'IP geolocation, ASN, and network info from ip-api.com.',
  api: { base: 'http://ip-api.com/json', name: 'ip-api.com', docs: 'https://ip-api.com/docs' },
  key: null,
  keywords: ['utility', 'ip', 'geolocation', 'network', 'lookup'],
  methods: [
    { name: 'lookup_ip', display: 'Look up IP address geolocation', cost: 1, params: 'ip', inputs: [
      { name: 'ip', type: 'string', required: true, desc: 'IP address to look up' },
    ]},
    { name: 'batch_lookup', display: 'Batch IP lookup (up to 100)', cost: 2, params: 'ips', inputs: [
      { name: 'ips', type: 'string[]', required: true, desc: 'Array of IP addresses' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-ip-lookup — IP Address Lookup MCP Server
 *
 * Wraps ip-api.com with SettleGrid billing.
 * No API key needed — free for non-commercial use.
 *
 * Methods:
 *   lookup_ip(ip) — IP geolocation (1¢)
 *   batch_lookup(ips) — batch IP lookup (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface LookupInput { ip: string }
interface BatchInput { ips: string[] }

const API_BASE = 'http://ip-api.com'

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, opts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'ip-lookup',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_ip: { costCents: 1, displayName: 'Lookup IP' },
      batch_lookup: { costCents: 2, displayName: 'Batch Lookup' },
    },
  },
})

const lookupIp = sg.wrap(async (args: LookupInput) => {
  if (!args.ip) throw new Error('ip is required')
  const data = await apiFetch<any>(\`/json/\${args.ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query\`)
  if (data.status === 'fail') throw new Error(data.message || 'Lookup failed')
  return data
}, { method: 'lookup_ip' })

const batchLookup = sg.wrap(async (args: BatchInput) => {
  if (!args.ips?.length) throw new Error('ips array is required')
  if (args.ips.length > 100) throw new Error('Maximum 100 IPs per batch')
  const data = await apiFetch<any[]>('/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args.ips),
  })
  return { results: data }
}, { method: 'batch_lookup' })

export { lookupIp, batchLookup }

console.log('settlegrid-ip-lookup MCP server ready')
console.log('Methods: lookup_ip, batch_lookup')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 257: User Agent Parser ─────────────────────────────────────────────────
gen({
  slug: 'useragent-parser',
  title: 'User Agent Parser',
  desc: 'Parse user agent strings to extract browser, OS, and device info.',
  api: { base: 'https://api.useragentstring.com', name: 'UserAgentString', docs: 'http://useragentstring.com/' },
  key: null,
  keywords: ['utility', 'user-agent', 'browser', 'parser'],
  methods: [
    { name: 'parse_useragent', display: 'Parse a user agent string', cost: 1, params: 'ua', inputs: [
      { name: 'ua', type: 'string', required: true, desc: 'User agent string to parse' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-useragent-parser — User Agent Parser MCP Server
 *
 * Parses user agent strings locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_useragent(ua) — parse user agent (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ParseInput { ua: string }

const sg = settlegrid.init({
  toolSlug: 'useragent-parser',
  pricing: {
    defaultCostCents: 1,
    methods: {
      parse_useragent: { costCents: 1, displayName: 'Parse User Agent' },
    },
  },
})

function detectBrowser(ua: string) {
  if (ua.includes('Firefox/')) return { name: 'Firefox', version: ua.match(/Firefox\\/(\\S+)/)?.[1] || '' }
  if (ua.includes('Edg/')) return { name: 'Edge', version: ua.match(/Edg\\/(\\S+)/)?.[1] || '' }
  if (ua.includes('Chrome/')) return { name: 'Chrome', version: ua.match(/Chrome\\/(\\S+)/)?.[1] || '' }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return { name: 'Safari', version: ua.match(/Version\\/(\\S+)/)?.[1] || '' }
  if (ua.includes('MSIE') || ua.includes('Trident')) return { name: 'IE', version: ua.match(/(?:MSIE |rv:)(\\S+)/)?.[1] || '' }
  return { name: 'Unknown', version: '' }
}

function detectOS(ua: string) {
  if (ua.includes('Windows NT 10')) return { name: 'Windows', version: '10/11' }
  if (ua.includes('Windows NT')) return { name: 'Windows', version: ua.match(/Windows NT (\\S+)/)?.[1] || '' }
  if (ua.includes('Mac OS X')) return { name: 'macOS', version: ua.match(/Mac OS X ([\\d_]+)/)?.[1]?.replace(/_/g, '.') || '' }
  if (ua.includes('Android')) return { name: 'Android', version: ua.match(/Android ([\\d.]+)/)?.[1] || '' }
  if (ua.includes('iPhone') || ua.includes('iPad')) return { name: 'iOS', version: ua.match(/OS ([\\d_]+)/)?.[1]?.replace(/_/g, '.') || '' }
  if (ua.includes('Linux')) return { name: 'Linux', version: '' }
  return { name: 'Unknown', version: '' }
}

function detectDevice(ua: string) {
  if (ua.includes('Mobile') || ua.includes('Android') && !ua.includes('Tablet')) return 'mobile'
  if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet'
  if (ua.includes('Bot') || ua.includes('bot') || ua.includes('Crawler')) return 'bot'
  return 'desktop'
}

const parseUseragent = sg.wrap(async (args: ParseInput) => {
  if (!args.ua) throw new Error('ua is required')
  const browser = detectBrowser(args.ua)
  const os = detectOS(args.ua)
  const device = detectDevice(args.ua)
  return {
    raw: args.ua, browser, os, device,
    is_mobile: device === 'mobile',
    is_bot: device === 'bot',
    length: args.ua.length,
  }
}, { method: 'parse_useragent' })

export { parseUseragent }

console.log('settlegrid-useragent-parser MCP server ready')
console.log('Methods: parse_useragent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 258: Hash Generator ────────────────────────────────────────────────────
gen({
  slug: 'hash-generator',
  title: 'Hash Generator',
  desc: 'Generate cryptographic hashes (MD5, SHA-1, SHA-256, SHA-512) from text.',
  api: { base: 'https://local', name: 'Node.js Crypto', docs: 'https://nodejs.org/api/crypto.html' },
  key: null,
  keywords: ['utility', 'hash', 'crypto', 'checksum', 'security'],
  methods: [
    { name: 'generate_hash', display: 'Generate hash from text', cost: 1, params: 'text, algorithm?', inputs: [
      { name: 'text', type: 'string', required: true, desc: 'Text to hash' },
      { name: 'algorithm', type: 'string', required: false, desc: 'Algorithm: md5, sha1, sha256, sha512 (default sha256)' },
    ]},
    { name: 'compare_hash', display: 'Verify text against hash', cost: 1, params: 'text, hash, algorithm?', inputs: [
      { name: 'text', type: 'string', required: true, desc: 'Text to check' },
      { name: 'hash', type: 'string', required: true, desc: 'Expected hash' },
      { name: 'algorithm', type: 'string', required: false, desc: 'Algorithm used' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-hash-generator — Hash Generator MCP Server
 *
 * Generates cryptographic hashes locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_hash(text, algorithm?) — generate hash (1¢)
 *   compare_hash(text, hash, algorithm?) — verify hash (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { createHash } from 'node:crypto'

interface HashInput { text: string; algorithm?: string }
interface CompareInput { text: string; hash: string; algorithm?: string }

const VALID_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512']

const sg = settlegrid.init({
  toolSlug: 'hash-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      generate_hash: { costCents: 1, displayName: 'Generate Hash' },
      compare_hash: { costCents: 1, displayName: 'Compare Hash' },
    },
  },
})

const generateHash = sg.wrap(async (args: HashInput) => {
  if (!args.text) throw new Error('text is required')
  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo)) throw new Error(\`Invalid algorithm. Use: \${VALID_ALGORITHMS.join(', ')}\`)
  const hash = createHash(algo).update(args.text).digest('hex')
  return { algorithm: algo, hash, input_length: args.text.length, hash_length: hash.length }
}, { method: 'generate_hash' })

const compareHash = sg.wrap(async (args: CompareInput) => {
  if (!args.text || !args.hash) throw new Error('text and hash are required')
  const algo = (args.algorithm || 'sha256').toLowerCase()
  if (!VALID_ALGORITHMS.includes(algo)) throw new Error(\`Invalid algorithm. Use: \${VALID_ALGORITHMS.join(', ')}\`)
  const computed = createHash(algo).update(args.text).digest('hex')
  return { algorithm: algo, match: computed === args.hash.toLowerCase(), computed, expected: args.hash }
}, { method: 'compare_hash' })

export { generateHash, compareHash }

console.log('settlegrid-hash-generator MCP server ready')
console.log('Methods: generate_hash, compare_hash')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 259: Base64 Tools ──────────────────────────────────────────────────────
gen({
  slug: 'base64-tools',
  title: 'Base64 Tools',
  desc: 'Encode and decode Base64 strings — no external API needed.',
  api: { base: 'https://local', name: 'Node.js Buffer', docs: 'https://nodejs.org/api/buffer.html' },
  key: null,
  keywords: ['utility', 'base64', 'encode', 'decode'],
  methods: [
    { name: 'base64_encode', display: 'Encode text to Base64', cost: 1, params: 'text', inputs: [
      { name: 'text', type: 'string', required: true, desc: 'Text to encode' },
    ]},
    { name: 'base64_decode', display: 'Decode Base64 to text', cost: 1, params: 'encoded', inputs: [
      { name: 'encoded', type: 'string', required: true, desc: 'Base64 string to decode' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-base64-tools — Base64 Tools MCP Server
 *
 * Encode/decode Base64 locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   base64_encode(text) — encode to Base64 (1¢)
 *   base64_decode(encoded) — decode from Base64 (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface EncodeInput { text: string }
interface DecodeInput { encoded: string }

const sg = settlegrid.init({
  toolSlug: 'base64-tools',
  pricing: {
    defaultCostCents: 1,
    methods: {
      base64_encode: { costCents: 1, displayName: 'Base64 Encode' },
      base64_decode: { costCents: 1, displayName: 'Base64 Decode' },
    },
  },
})

const base64Encode = sg.wrap(async (args: EncodeInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  const encoded = Buffer.from(args.text, 'utf-8').toString('base64')
  return { original_length: args.text.length, encoded, encoded_length: encoded.length }
}, { method: 'base64_encode' })

const base64Decode = sg.wrap(async (args: DecodeInput) => {
  if (!args.encoded) throw new Error('encoded string is required')
  try {
    const decoded = Buffer.from(args.encoded, 'base64').toString('utf-8')
    return { encoded_length: args.encoded.length, decoded, decoded_length: decoded.length }
  } catch {
    throw new Error('Invalid Base64 input')
  }
}, { method: 'base64_decode' })

export { base64Encode, base64Decode }

console.log('settlegrid-base64-tools MCP server ready')
console.log('Methods: base64_encode, base64_decode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 260: MyMemory Translation ──────────────────────────────────────────────
gen({
  slug: 'mymemory-translate',
  title: 'MyMemory Translation',
  desc: 'Free text translation via MyMemory Translation API.',
  api: { base: 'https://api.mymemory.translated.net', name: 'MyMemory', docs: 'https://mymemory.translated.net/doc/spec.php' },
  key: null,
  keywords: ['language', 'translation', 'translate', 'multilingual'],
  methods: [
    { name: 'translate_text', display: 'Translate text between languages', cost: 1, params: 'text, from, to', inputs: [
      { name: 'text', type: 'string', required: true, desc: 'Text to translate' },
      { name: 'from', type: 'string', required: true, desc: 'Source language code (e.g. en)' },
      { name: 'to', type: 'string', required: true, desc: 'Target language code (e.g. es)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-mymemory-translate — MyMemory Translation MCP Server
 *
 * Wraps MyMemory Translation API with SettleGrid billing.
 * No API key needed — free tier (1000 words/day).
 *
 * Methods:
 *   translate_text(text, from, to) — translate text (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TranslateInput { text: string; from: string; to: string }

const API_BASE = 'https://api.mymemory.translated.net'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mymemory-translate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      translate_text: { costCents: 1, displayName: 'Translate Text' },
    },
  },
})

const translateText = sg.wrap(async (args: TranslateInput) => {
  if (!args.text) throw new Error('text is required')
  if (!args.from || !args.to) throw new Error('from and to language codes required')
  if (args.text.length > 5000) throw new Error('Text must be under 5000 characters')
  const langpair = \`\${args.from}|\${args.to}\`
  const data = await apiFetch<any>(\`/get?q=\${encodeURIComponent(args.text)}&langpair=\${encodeURIComponent(langpair)}\`)
  if (data.responseStatus !== 200) throw new Error(data.responseDetails || 'Translation failed')
  return {
    original: args.text,
    translated: data.responseData.translatedText,
    from: args.from, to: args.to,
    match: data.responseData.match,
    quota_used: data.quotaFinished ? 'quota exhausted' : 'ok',
  }
}, { method: 'translate_text' })

export { translateText }

console.log('settlegrid-mymemory-translate MCP server ready')
console.log('Methods: translate_text')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 261: Language Detection ────────────────────────────────────────────────
gen({
  slug: 'language-detect',
  title: 'Language Detection',
  desc: 'Detect the language of text using ws.detectlanguage.com free API.',
  api: { base: 'https://ws.detectlanguage.com/0.2', name: 'DetectLanguage', docs: 'https://detectlanguage.com/documentation' },
  key: { env: 'DETECTLANGUAGE_API_KEY', url: 'https://detectlanguage.com/', required: true },
  keywords: ['language', 'detection', 'nlp', 'text'],
  methods: [
    { name: 'detect_language', display: 'Detect language of text', cost: 2, params: 'text', inputs: [
      { name: 'text', type: 'string', required: true, desc: 'Text to analyze' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-language-detect — Language Detection MCP Server
 *
 * Wraps DetectLanguage API with SettleGrid billing.
 * Free key from https://detectlanguage.com/.
 *
 * Methods:
 *   detect_language(text) — detect language (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DetectInput { text: string }

const API_BASE = 'https://ws.detectlanguage.com/0.2'
const API_KEY = process.env.DETECTLANGUAGE_API_KEY || ''

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    ...opts,
    headers: { 'Authorization': \`Bearer \${API_KEY}\`, 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'language-detect',
  pricing: {
    defaultCostCents: 2,
    methods: {
      detect_language: { costCents: 2, displayName: 'Detect Language' },
    },
  },
})

const detectLanguage = sg.wrap(async (args: DetectInput) => {
  if (!args.text) throw new Error('text is required')
  if (!API_KEY) throw new Error('DETECTLANGUAGE_API_KEY not set')
  const data = await apiFetch<any>('/detect', {
    method: 'POST',
    body: JSON.stringify({ q: args.text }),
  })
  return {
    text_preview: args.text.slice(0, 100),
    detections: (data.data?.detections || []).map((d: any) => ({
      language: d.language, confidence: d.confidence, is_reliable: d.isReliable,
    })),
  }
}, { method: 'detect_language' })

export { detectLanguage }

console.log('settlegrid-language-detect MCP server ready')
console.log('Methods: detect_language')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 262: Free Dictionary ───────────────────────────────────────────────────
gen({
  slug: 'free-dictionary',
  title: 'Free Dictionary',
  desc: 'English dictionary definitions, phonetics, and examples from Free Dictionary API.',
  api: { base: 'https://api.dictionaryapi.dev/api/v2', name: 'Free Dictionary API', docs: 'https://dictionaryapi.dev/' },
  key: null,
  keywords: ['language', 'dictionary', 'definitions', 'english', 'words'],
  methods: [
    { name: 'define_word', display: 'Get word definition', cost: 1, params: 'word', inputs: [
      { name: 'word', type: 'string', required: true, desc: 'English word to define' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-free-dictionary — Free Dictionary MCP Server
 *
 * Wraps Free Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define_word(word) — get definition (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WordInput { word: string }

const API_BASE = 'https://api.dictionaryapi.dev/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Word not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'free-dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define_word: { costCents: 1, displayName: 'Define Word' },
    },
  },
})

const defineWord = sg.wrap(async (args: WordInput) => {
  if (!args.word) throw new Error('word is required')
  const data = await apiFetch<any[]>(\`/entries/en/\${encodeURIComponent(args.word)}\`)
  const entry = data[0]
  return {
    word: entry.word,
    phonetic: entry.phonetic,
    phonetics: (entry.phonetics || []).map((p: any) => ({ text: p.text, audio: p.audio })),
    meanings: (entry.meanings || []).map((m: any) => ({
      part_of_speech: m.partOfSpeech,
      definitions: (m.definitions || []).slice(0, 5).map((d: any) => ({
        definition: d.definition, example: d.example, synonyms: d.synonyms?.slice(0, 5),
      })),
      synonyms: m.synonyms?.slice(0, 10),
      antonyms: m.antonyms?.slice(0, 10),
    })),
    source_urls: entry.sourceUrls,
  }
}, { method: 'define_word' })

export { defineWord }

console.log('settlegrid-free-dictionary MCP server ready')
console.log('Methods: define_word')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 263: MusicBrainz ───────────────────────────────────────────────────────
gen({
  slug: 'musicbrainz',
  title: 'MusicBrainz',
  desc: 'Music metadata — artists, albums, recordings from MusicBrainz.',
  api: { base: 'https://musicbrainz.org/ws/2', name: 'MusicBrainz', docs: 'https://musicbrainz.org/doc/MusicBrainz_API' },
  key: null,
  keywords: ['music', 'metadata', 'artists', 'albums', 'recordings'],
  methods: [
    { name: 'search_artist', display: 'Search for music artists', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Artist name to search' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
    ]},
    { name: 'search_release', display: 'Search for album releases', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Album title to search' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
    { name: 'get_artist_releases', display: 'Get releases by artist ID', cost: 1, params: 'artist_id', inputs: [
      { name: 'artist_id', type: 'string', required: true, desc: 'MusicBrainz artist ID (UUID)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-musicbrainz — MusicBrainz MCP Server
 *
 * Wraps MusicBrainz API with SettleGrid billing.
 * No API key needed — rate limited to 1 req/sec.
 *
 * Methods:
 *   search_artist(query, limit?) — search artists (1¢)
 *   search_release(query, limit?) — search releases (1¢)
 *   get_artist_releases(artist_id) — artist releases (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface ArtistReleasesInput { artist_id: string }

const API_BASE = 'https://musicbrainz.org/ws/2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${url}\${sep}fmt=json\`, {
    headers: { 'User-Agent': 'SettleGrid-MCP/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'musicbrainz',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_artist: { costCents: 1, displayName: 'Search Artist' },
      search_release: { costCents: 1, displayName: 'Search Release' },
      get_artist_releases: { costCents: 1, displayName: 'Artist Releases' },
    },
  },
})

const searchArtist = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`/artist?query=\${encodeURIComponent(args.query)}&limit=\${limit}\`)
  return {
    count: data.count,
    artists: (data.artists || []).map((a: any) => ({
      id: a.id, name: a.name, sort_name: a['sort-name'],
      type: a.type, country: a.country, score: a.score,
      begin: a['life-span']?.begin, end: a['life-span']?.end,
      tags: a.tags?.slice(0, 5).map((t: any) => t.name),
    })),
  }
}, { method: 'search_artist' })

const searchRelease = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`/release?query=\${encodeURIComponent(args.query)}&limit=\${limit}\`)
  return {
    count: data.count,
    releases: (data.releases || []).map((r: any) => ({
      id: r.id, title: r.title, status: r.status, date: r.date,
      country: r.country, artist: r['artist-credit']?.[0]?.name, score: r.score,
      track_count: r['track-count'],
    })),
  }
}, { method: 'search_release' })

const getArtistReleases = sg.wrap(async (args: ArtistReleasesInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(\`/release?artist=\${args.artist_id}&limit=50\`)
  return {
    count: data['release-count'],
    releases: (data.releases || []).map((r: any) => ({
      id: r.id, title: r.title, date: r.date, status: r.status, country: r.country,
    })),
  }
}, { method: 'get_artist_releases' })

export { searchArtist, searchRelease, getArtistReleases }

console.log('settlegrid-musicbrainz MCP server ready')
console.log('Methods: search_artist, search_release, get_artist_releases')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 264: AudioDB ───────────────────────────────────────────────────────────
gen({
  slug: 'audiodb',
  title: 'AudioDB',
  desc: 'Music artist info, album art, and discographies from TheAudioDB.',
  api: { base: 'https://theaudiodb.com/api/v1/json/2', name: 'TheAudioDB', docs: 'https://www.theaudiodb.com/api_guide.php' },
  key: null,
  keywords: ['music', 'artists', 'albums', 'discography', 'artwork'],
  methods: [
    { name: 'search_audio_artist', display: 'Search for music artist', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Artist name' },
    ]},
    { name: 'get_artist_albums', display: 'Get albums by artist ID', cost: 1, params: 'artist_id', inputs: [
      { name: 'artist_id', type: 'string', required: true, desc: 'TheAudioDB artist ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-audiodb — AudioDB MCP Server
 *
 * Wraps TheAudioDB API with SettleGrid billing.
 * No API key needed — free tier.
 *
 * Methods:
 *   search_audio_artist(name) — search artist (1¢)
 *   get_artist_albums(artist_id) — artist albums (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ArtistInput { name: string }
interface AlbumInput { artist_id: string }

const API_BASE = 'https://theaudiodb.com/api/v1/json/2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'audiodb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_audio_artist: { costCents: 1, displayName: 'Search Artist' },
      get_artist_albums: { costCents: 1, displayName: 'Artist Albums' },
    },
  },
})

const searchAudioArtist = sg.wrap(async (args: ArtistInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/search.php?s=\${encodeURIComponent(args.name)}\`)
  return {
    artists: (data.artists || []).map((a: any) => ({
      id: a.idArtist, name: a.strArtist, genre: a.strGenre, style: a.strStyle,
      country: a.strCountry, formed_year: a.intFormedYear, mood: a.strMood,
      biography: a.strBiographyEN?.slice(0, 500),
      thumb: a.strArtistThumb, banner: a.strArtistBanner,
      website: a.strWebsite, facebook: a.strFacebook,
    })),
  }
}, { method: 'search_audio_artist' })

const getArtistAlbums = sg.wrap(async (args: AlbumInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(\`/album.php?i=\${args.artist_id}\`)
  return {
    albums: (data.album || []).map((a: any) => ({
      id: a.idAlbum, title: a.strAlbum, year: a.intYearReleased,
      genre: a.strGenre, style: a.strStyle, mood: a.strMood,
      label: a.strLabel, score: a.intScore, thumb: a.strAlbumThumb,
      description: a.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'get_artist_albums' })

export { searchAudioArtist, getArtistAlbums }

console.log('settlegrid-audiodb MCP server ready')
console.log('Methods: search_audio_artist, get_artist_albums')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 265: Deezer Music ──────────────────────────────────────────────────────
gen({
  slug: 'deezer-music',
  title: 'Deezer Music',
  desc: 'Music search, track info, and chart data from Deezer public API.',
  api: { base: 'https://api.deezer.com', name: 'Deezer', docs: 'https://developers.deezer.com/api' },
  key: null,
  keywords: ['music', 'streaming', 'tracks', 'charts', 'deezer'],
  methods: [
    { name: 'search_tracks', display: 'Search for music tracks', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search query' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_chart', display: 'Get current music charts', cost: 1, params: '', inputs: [] },
    { name: 'get_artist_info', display: 'Get artist info by ID', cost: 1, params: 'artist_id', inputs: [
      { name: 'artist_id', type: 'number', required: true, desc: 'Deezer artist ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-deezer-music — Deezer Music MCP Server
 *
 * Wraps Deezer public API with SettleGrid billing.
 * No API key needed for public endpoints.
 *
 * Methods:
 *   search_tracks(query, limit?) — search tracks (1¢)
 *   get_chart() — music charts (1¢)
 *   get_artist_info(artist_id) — artist info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface ArtistInput { artist_id: number }

const API_BASE = 'https://api.deezer.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'deezer-music',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tracks: { costCents: 1, displayName: 'Search Tracks' },
      get_chart: { costCents: 1, displayName: 'Music Charts' },
      get_artist_info: { costCents: 1, displayName: 'Artist Info' },
    },
  },
})

const searchTracks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`/search?q=\${encodeURIComponent(args.query)}&limit=\${limit}\`)
  return {
    total: data.total,
    tracks: (data.data || []).map((t: any) => ({
      id: t.id, title: t.title, duration_sec: t.duration,
      artist: t.artist?.name, album: t.album?.title,
      preview: t.preview, link: t.link, explicit: t.explicit_lyrics,
    })),
  }
}, { method: 'search_tracks' })

const getChart = sg.wrap(async () => {
  const data = await apiFetch<any>('/chart')
  return {
    tracks: (data.tracks?.data || []).slice(0, 20).map((t: any) => ({
      position: t.position, title: t.title, artist: t.artist?.name,
      duration_sec: t.duration, link: t.link,
    })),
    artists: (data.artists?.data || []).slice(0, 10).map((a: any) => ({
      name: a.name, id: a.id, link: a.link,
    })),
    albums: (data.albums?.data || []).slice(0, 10).map((a: any) => ({
      title: a.title, artist: a.artist?.name, id: a.id, link: a.link,
    })),
  }
}, { method: 'get_chart' })

const getArtistInfo = sg.wrap(async (args: ArtistInput) => {
  if (!args.artist_id) throw new Error('artist_id is required')
  const data = await apiFetch<any>(\`/artist/\${args.artist_id}\`)
  return {
    id: data.id, name: data.name, nb_album: data.nb_album,
    nb_fan: data.nb_fan, link: data.link, picture: data.picture_medium,
    tracklist: data.tracklist,
  }
}, { method: 'get_artist_info' })

export { searchTracks, getChart, getArtistInfo }

console.log('settlegrid-deezer-music MCP server ready')
console.log('Methods: search_tracks, get_chart, get_artist_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 266: Last.fm ───────────────────────────────────────────────────────────
gen({
  slug: 'lastfm',
  title: 'Last.fm Music',
  desc: 'Music scrobble data, artist info, and top charts from Last.fm.',
  api: { base: 'https://ws.audioscrobbler.com/2.0', name: 'Last.fm', docs: 'https://www.last.fm/api' },
  key: { env: 'LASTFM_API_KEY', url: 'https://www.last.fm/api/account/create', required: true },
  keywords: ['music', 'lastfm', 'scrobble', 'charts', 'artists'],
  methods: [
    { name: 'get_top_artists', display: 'Get top artists globally', cost: 2, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'get_artist_info_lastfm', display: 'Get detailed artist info', cost: 2, params: 'artist', inputs: [
      { name: 'artist', type: 'string', required: true, desc: 'Artist name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-lastfm — Last.fm Music MCP Server
 *
 * Wraps Last.fm API with SettleGrid billing.
 * Free key from https://www.last.fm/api/account/create.
 *
 * Methods:
 *   get_top_artists(limit?) — top artists (2¢)
 *   get_artist_info_lastfm(artist) — artist info (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TopInput { limit?: number }
interface ArtistInput { artist: string }

const API_BASE = 'https://ws.audioscrobbler.com/2.0'
const API_KEY = process.env.LASTFM_API_KEY || ''

async function apiFetch<T>(params: string): Promise<T> {
  const url = \`\${API_BASE}?\${params}&api_key=\${API_KEY}&format=json\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'lastfm',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_top_artists: { costCents: 2, displayName: 'Top Artists' },
      get_artist_info_lastfm: { costCents: 2, displayName: 'Artist Info' },
    },
  },
})

const getTopArtists = sg.wrap(async (args: TopInput) => {
  if (!API_KEY) throw new Error('LASTFM_API_KEY not set')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`method=chart.gettopartists&limit=\${limit}\`)
  return {
    artists: (data.artists?.artist || []).map((a: any) => ({
      name: a.name, playcount: a.playcount, listeners: a.listeners,
      url: a.url, mbid: a.mbid,
    })),
  }
}, { method: 'get_top_artists' })

const getArtistInfoLastfm = sg.wrap(async (args: ArtistInput) => {
  if (!API_KEY) throw new Error('LASTFM_API_KEY not set')
  if (!args.artist) throw new Error('artist name is required')
  const data = await apiFetch<any>(\`method=artist.getinfo&artist=\${encodeURIComponent(args.artist)}\`)
  const a = data.artist
  return {
    name: a?.name, url: a?.url, listeners: a?.stats?.listeners,
    playcount: a?.stats?.playcount,
    bio: a?.bio?.summary?.replace(/<[^>]*>/g, '').slice(0, 500),
    tags: a?.tags?.tag?.map((t: any) => t.name),
    similar: a?.similar?.artist?.map((s: any) => s.name),
  }
}, { method: 'get_artist_info_lastfm' })

export { getTopArtists, getArtistInfoLastfm }

console.log('settlegrid-lastfm MCP server ready')
console.log('Methods: get_top_artists, get_artist_info_lastfm')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 267: Lorem Picsum ──────────────────────────────────────────────────────
gen({
  slug: 'picsum-photos',
  title: 'Lorem Picsum Photos',
  desc: 'Random placeholder photos with configurable dimensions from Lorem Picsum.',
  api: { base: 'https://picsum.photos', name: 'Lorem Picsum', docs: 'https://picsum.photos/' },
  key: null,
  keywords: ['photography', 'images', 'placeholder', 'random'],
  methods: [
    { name: 'get_random_photo', display: 'Get random photo URL', cost: 1, params: 'width?, height?', inputs: [
      { name: 'width', type: 'number', required: false, desc: 'Image width (default 800)' },
      { name: 'height', type: 'number', required: false, desc: 'Image height (default 600)' },
    ]},
    { name: 'list_photos', display: 'List available photos', cost: 1, params: 'page?, limit?', inputs: [
      { name: 'page', type: 'number', required: false, desc: 'Page number (default 1)' },
      { name: 'limit', type: 'number', required: false, desc: 'Results per page (default 20)' },
    ]},
    { name: 'get_photo_info', display: 'Get photo details by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'string', required: true, desc: 'Photo ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-picsum-photos — Lorem Picsum Photos MCP Server
 *
 * Wraps Lorem Picsum API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_photo(width?, height?) — random photo (1¢)
 *   list_photos(page?, limit?) — list photos (1¢)
 *   get_photo_info(id) — photo details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PhotoInput { width?: number; height?: number }
interface ListInput { page?: number; limit?: number }
interface InfoInput { id: string }

const API_BASE = 'https://picsum.photos'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'picsum-photos',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_random_photo: { costCents: 1, displayName: 'Random Photo' },
      list_photos: { costCents: 1, displayName: 'List Photos' },
      get_photo_info: { costCents: 1, displayName: 'Photo Info' },
    },
  },
})

const getRandomPhoto = sg.wrap(async (args: PhotoInput) => {
  const w = args.width ?? 800
  const h = args.height ?? 600
  return {
    url: \`\${API_BASE}/\${w}/\${h}\`,
    grayscale_url: \`\${API_BASE}/\${w}/\${h}?grayscale\`,
    blur_url: \`\${API_BASE}/\${w}/\${h}?blur=5\`,
    width: w, height: h,
  }
}, { method: 'get_random_photo' })

const listPhotos = sg.wrap(async (args: ListInput) => {
  const page = args.page ?? 1
  const limit = args.limit ?? 20
  const data = await apiFetch<any[]>(\`/v2/list?page=\${page}&limit=\${limit}\`)
  return {
    photos: data.map((p: any) => ({
      id: p.id, author: p.author, width: p.width, height: p.height,
      url: p.url, download_url: p.download_url,
    })),
  }
}, { method: 'list_photos' })

const getPhotoInfo = sg.wrap(async (args: InfoInput) => {
  if (!args.id) throw new Error('id is required')
  const data = await apiFetch<any>(\`/id/\${args.id}/info\`)
  return {
    id: data.id, author: data.author, width: data.width, height: data.height,
    url: data.url, download_url: data.download_url,
  }
}, { method: 'get_photo_info' })

export { getRandomPhoto, listPhotos, getPhotoInfo }

console.log('settlegrid-picsum-photos MCP server ready')
console.log('Methods: get_random_photo, list_photos, get_photo_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 268: Pixabay Images ────────────────────────────────────────────────────
gen({
  slug: 'pixabay-images',
  title: 'Pixabay Images',
  desc: 'Free stock photos and videos search from Pixabay.',
  api: { base: 'https://pixabay.com/api', name: 'Pixabay', docs: 'https://pixabay.com/api/docs/' },
  key: { env: 'PIXABAY_API_KEY', url: 'https://pixabay.com/api/docs/', required: true },
  keywords: ['photography', 'images', 'stock-photos', 'free'],
  methods: [
    { name: 'search_images', display: 'Search Pixabay images', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
    { name: 'search_videos', display: 'Search Pixabay videos', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-pixabay-images — Pixabay Images MCP Server
 *
 * Wraps Pixabay API with SettleGrid billing.
 * Free key from https://pixabay.com/api/docs/.
 *
 * Methods:
 *   search_images(query, limit?) — search images (2¢)
 *   search_videos(query, limit?) — search videos (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }

const API_KEY = process.env.PIXABAY_API_KEY || ''

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pixabay-images',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_images: { costCents: 2, displayName: 'Search Images' },
      search_videos: { costCents: 2, displayName: 'Search Videos' },
    },
  },
})

const searchImages = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`https://pixabay.com/api/?key=\${API_KEY}&q=\${encodeURIComponent(args.query)}&per_page=\${limit}&image_type=photo\`)
  return {
    total: data.totalHits,
    images: (data.hits || []).map((h: any) => ({
      id: h.id, tags: h.tags, preview: h.previewURL, web: h.webformatURL,
      large: h.largeImageURL, views: h.views, downloads: h.downloads,
      likes: h.likes, user: h.user, width: h.imageWidth, height: h.imageHeight,
    })),
  }
}, { method: 'search_images' })

const searchVideos = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PIXABAY_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`https://pixabay.com/api/videos/?key=\${API_KEY}&q=\${encodeURIComponent(args.query)}&per_page=\${limit}\`)
  return {
    total: data.totalHits,
    videos: (data.hits || []).map((h: any) => ({
      id: h.id, tags: h.tags, duration: h.duration, views: h.views,
      downloads: h.downloads, likes: h.likes, user: h.user,
      videos: { small: h.videos?.small?.url, medium: h.videos?.medium?.url },
    })),
  }
}, { method: 'search_videos' })

export { searchImages, searchVideos }

console.log('settlegrid-pixabay-images MCP server ready')
console.log('Methods: search_images, search_videos')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 269: Elevation API ─────────────────────────────────────────────────────
gen({
  slug: 'elevation-api',
  title: 'Elevation Data',
  desc: 'Get elevation data for any coordinates via Open-Meteo Elevation API.',
  api: { base: 'https://api.open-meteo.com/v1/elevation', name: 'Open-Meteo Elevation', docs: 'https://open-meteo.com/en/docs/elevation-api' },
  key: null,
  keywords: ['travel', 'elevation', 'geography', 'altitude'],
  methods: [
    { name: 'get_elevation', display: 'Get elevation for coordinates', cost: 1, params: 'lat, lon', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
    ]},
    { name: 'get_elevation_batch', display: 'Get elevation for multiple points', cost: 2, params: 'points', inputs: [
      { name: 'points', type: 'array', required: true, desc: 'Array of {lat, lon} objects (max 100)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-elevation-api — Elevation Data MCP Server
 *
 * Wraps Open-Meteo Elevation API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_elevation(lat, lon) — elevation for point (1¢)
 *   get_elevation_batch(points) — batch elevation (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ElevInput { lat: number; lon: number }
interface BatchInput { points: Array<{ lat: number; lon: number }> }

const API_BASE = 'https://api.open-meteo.com/v1/elevation'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'elevation-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_elevation: { costCents: 1, displayName: 'Get Elevation' },
      get_elevation_batch: { costCents: 2, displayName: 'Batch Elevation' },
    },
  },
})

const getElevation = sg.wrap(async (args: ElevInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}\`)
  return { lat: args.lat, lon: args.lon, elevation_m: data.elevation?.[0], elevation_ft: data.elevation?.[0] ? Math.round(data.elevation[0] * 3.28084) : null }
}, { method: 'get_elevation' })

const getElevationBatch = sg.wrap(async (args: BatchInput) => {
  if (!args.points?.length) throw new Error('points array required')
  if (args.points.length > 100) throw new Error('Maximum 100 points')
  const lats = args.points.map(p => p.lat).join(',')
  const lons = args.points.map(p => p.lon).join(',')
  const data = await apiFetch<any>(\`?latitude=\${lats}&longitude=\${lons}\`)
  return {
    results: args.points.map((p, i) => ({
      lat: p.lat, lon: p.lon, elevation_m: data.elevation?.[i],
    })),
  }
}, { method: 'get_elevation_batch' })

export { getElevation, getElevationBatch }

console.log('settlegrid-elevation-api MCP server ready')
console.log('Methods: get_elevation, get_elevation_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`
})

// ─── 270: Airport Data ──────────────────────────────────────────────────────
gen({
  slug: 'airport-data',
  title: 'Airport Data',
  desc: 'Airport information, IATA/ICAO codes, and locations from AirportDB.',
  api: { base: 'https://airportdb.io/api/v1', name: 'AirportDB', docs: 'https://airportdb.io/' },
  key: null,
  keywords: ['travel', 'airports', 'aviation', 'flights'],
  methods: [
    { name: 'get_airport', display: 'Get airport by ICAO code', cost: 1, params: 'icao', inputs: [
      { name: 'icao', type: 'string', required: true, desc: 'ICAO airport code (e.g. KJFK)' },
    ]},
    { name: 'search_airports', display: 'Search airports by name or city', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Airport name, city, or code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-airport-data — Airport Data MCP Server
 *
 * Wraps AirportDB API with SettleGrid billing.
 * No API key needed for basic queries.
 *
 * Methods:
 *   get_airport(icao) — airport by ICAO (1¢)
 *   search_airports(query) — search airports (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface AirportInput { icao: string }
interface SearchInput { query: string }

const API_BASE = 'https://airportdb.io/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'airport-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_airport: { costCents: 1, displayName: 'Get Airport' },
      search_airports: { costCents: 1, displayName: 'Search Airports' },
    },
  },
})

const getAirport = sg.wrap(async (args: AirportInput) => {
  if (!args.icao) throw new Error('ICAO code required')
  const code = args.icao.toUpperCase()
  const data = await apiFetch<any>(\`/airports/\${code}\`)
  return {
    icao: data.icao_code, iata: data.iata_code, name: data.name,
    city: data.municipality, country: data.iso_country,
    latitude: data.latitude_deg, longitude: data.longitude_deg,
    elevation_ft: data.elevation_ft, type: data.type,
    continent: data.continent, region: data.iso_region,
    website: data.home_link, wikipedia: data.wikipedia_link,
  }
}, { method: 'get_airport' })

const searchAirports = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(\`/airports?search=\${encodeURIComponent(args.query)}&limit=20\`)
  const items = Array.isArray(data) ? data : data.items || []
  return {
    airports: items.map((a: any) => ({
      icao: a.icao_code, iata: a.iata_code, name: a.name,
      city: a.municipality, country: a.iso_country, type: a.type,
    })),
  }
}, { method: 'search_airports' })

export { getAirport, searchAirports }

console.log('settlegrid-airport-data MCP server ready')
console.log('Methods: get_airport, search_airports')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

console.log('\\n--- Part 2 (251-270) complete ---\\n')

// ─── 271: Carbon Intensity UK ───────────────────────────────────────────────
gen({
  slug: 'carbon-intensity',
  title: 'UK Carbon Intensity',
  desc: 'UK electricity grid carbon intensity data from National Grid ESO.',
  api: { base: 'https://api.carbonintensity.org.uk', name: 'Carbon Intensity UK', docs: 'https://carbon-intensity.github.io/api-definitions/' },
  key: null,
  keywords: ['sustainability', 'carbon', 'energy', 'uk', 'emissions'],
  methods: [
    { name: 'get_current_intensity', display: 'Get current UK carbon intensity', cost: 1, params: '', inputs: [] },
    { name: 'get_intensity_by_date', display: 'Get carbon intensity for date', cost: 1, params: 'date', inputs: [
      { name: 'date', type: 'string', required: true, desc: 'Date in YYYY-MM-DD format' },
    ]},
    { name: 'get_regional_intensity', display: 'Get regional carbon intensity', cost: 1, params: 'region_id?', inputs: [
      { name: 'region_id', type: 'number', required: false, desc: 'Region ID (1-17)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-carbon-intensity — UK Carbon Intensity MCP Server
 *
 * Wraps Carbon Intensity UK API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_current_intensity() — current intensity (1¢)
 *   get_intensity_by_date(date) — intensity by date (1¢)
 *   get_regional_intensity(region_id?) — regional data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DateInput { date: string }
interface RegionInput { region_id?: number }

const API_BASE = 'https://api.carbonintensity.org.uk'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'carbon-intensity',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current_intensity: { costCents: 1, displayName: 'Current Intensity' },
      get_intensity_by_date: { costCents: 1, displayName: 'Intensity By Date' },
      get_regional_intensity: { costCents: 1, displayName: 'Regional Intensity' },
    },
  },
})

const getCurrentIntensity = sg.wrap(async () => {
  const data = await apiFetch<any>('/intensity')
  const d = data.data?.[0]
  return {
    from: d?.from, to: d?.to,
    forecast: d?.intensity?.forecast,
    actual: d?.intensity?.actual,
    index: d?.intensity?.index,
  }
}, { method: 'get_current_intensity' })

const getIntensityByDate = sg.wrap(async (args: DateInput) => {
  if (!args.date) throw new Error('date is required (YYYY-MM-DD)')
  const data = await apiFetch<any>(\`/intensity/date/\${args.date}\`)
  return {
    date: args.date,
    periods: (data.data || []).map((d: any) => ({
      from: d.from, to: d.to,
      forecast: d.intensity?.forecast, actual: d.intensity?.actual, index: d.intensity?.index,
    })),
  }
}, { method: 'get_intensity_by_date' })

const getRegionalIntensity = sg.wrap(async (args: RegionInput) => {
  const path = args.region_id ? \`/regional/regionid/\${args.region_id}\` : '/regional'
  const data = await apiFetch<any>(path)
  const regions = data.data?.flatMap((d: any) => d.regions || [d]) || []
  return {
    regions: regions.slice(0, 20).map((r: any) => ({
      id: r.regionid, name: r.shortname || r.dnoregion,
      intensity: r.intensity, generation_mix: r.generationmix?.slice(0, 5),
    })),
  }
}, { method: 'get_regional_intensity' })

export { getCurrentIntensity, getIntensityByDate, getRegionalIntensity }

console.log('settlegrid-carbon-intensity MCP server ready')
console.log('Methods: get_current_intensity, get_intensity_by_date, get_regional_intensity')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 272: Electricity Maps ──────────────────────────────────────────────────
gen({
  slug: 'electricity-maps',
  title: 'Electricity Maps',
  desc: 'Global electricity grid CO2 emissions and renewable energy data.',
  api: { base: 'https://api.electricitymap.org/v3', name: 'Electricity Maps', docs: 'https://static.electricitymaps.com/api/docs/index.html' },
  key: { env: 'ELECTRICITYMAPS_API_KEY', url: 'https://api-portal.electricitymaps.com/', required: true },
  keywords: ['sustainability', 'electricity', 'co2', 'renewable', 'grid'],
  methods: [
    { name: 'get_zone_carbon', display: 'Get carbon intensity for zone', cost: 2, params: 'zone', inputs: [
      { name: 'zone', type: 'string', required: true, desc: 'Zone code (e.g. US-CAL-CISO, DE, FR)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-electricity-maps — Electricity Maps MCP Server
 *
 * Wraps Electricity Maps API with SettleGrid billing.
 * Free key from https://api-portal.electricitymaps.com/.
 *
 * Methods:
 *   get_zone_carbon(zone) — zone carbon intensity (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ZoneInput { zone: string }

const API_BASE = 'https://api.electricitymap.org/v3'
const API_KEY = process.env.ELECTRICITYMAPS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'auth-token': API_KEY } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'electricity-maps',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_zone_carbon: { costCents: 2, displayName: 'Zone Carbon' },
    },
  },
})

const getZoneCarbon = sg.wrap(async (args: ZoneInput) => {
  if (!args.zone) throw new Error('zone is required')
  if (!API_KEY) throw new Error('ELECTRICITYMAPS_API_KEY not set')
  const data = await apiFetch<any>(\`/carbon-intensity/latest?zone=\${args.zone}\`)
  return {
    zone: data.zone, carbon_intensity_gco2_kwh: data.carbonIntensity,
    fossil_fuel_percentage: data.fossilFuelPercentage,
    renewable_percentage: data.renewablePercentage,
    datetime: data.datetime, updated_at: data.updatedAt,
  }
}, { method: 'get_zone_carbon' })

export { getZoneCarbon }

console.log('settlegrid-electricity-maps MCP server ready')
console.log('Methods: get_zone_carbon')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 273: Renewable Energy Stats ────────────────────────────────────────────
gen({
  slug: 'renewable-energy',
  title: 'Renewable Energy Stats',
  desc: 'Renewable energy generation data via Open-Meteo historical weather for solar/wind potential.',
  api: { base: 'https://api.open-meteo.com/v1/forecast', name: 'Open-Meteo', docs: 'https://open-meteo.com/en/docs' },
  key: null,
  keywords: ['sustainability', 'renewable', 'solar', 'wind', 'energy'],
  methods: [
    { name: 'get_solar_potential', display: 'Get solar radiation data', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days (1-16)' },
    ]},
    { name: 'get_wind_potential', display: 'Get wind energy potential', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-renewable-energy — Renewable Energy Stats MCP Server
 *
 * Wraps Open-Meteo solar/wind data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_solar_potential(lat, lon, days?) — solar data (1¢)
 *   get_wind_potential(lat, lon, days?) — wind data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PotentialInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'renewable-energy',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_solar_potential: { costCents: 1, displayName: 'Solar Potential' },
      get_wind_potential: { costCents: 1, displayName: 'Wind Potential' },
    },
  },
})

const getSolarPotential = sg.wrap(async (args: PotentialInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=shortwave_radiation_sum,sunshine_duration&hourly=direct_radiation,diffuse_radiation,direct_normal_irradiance&forecast_days=\${days}&timezone=auto\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly_sample: { time: data.hourly?.time?.slice(0, 24), direct: data.hourly?.direct_radiation?.slice(0, 24) } }
}, { method: 'get_solar_potential' })

const getWindPotential = sg.wrap(async (args: PotentialInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant&hourly=windspeed_10m,windspeed_80m,windspeed_120m,winddirection_10m&forecast_days=\${days}&timezone=auto\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, hourly_sample: { time: data.hourly?.time?.slice(0, 24), speed_80m: data.hourly?.windspeed_80m?.slice(0, 24), speed_120m: data.hourly?.windspeed_120m?.slice(0, 24) } }
}, { method: 'get_wind_potential' })

export { getSolarPotential, getWindPotential }

console.log('settlegrid-renewable-energy MCP server ready')
console.log('Methods: get_solar_potential, get_wind_potential')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 274: NIST NVD CVE ──────────────────────────────────────────────────────
gen({
  slug: 'nvd-cve',
  title: 'NIST NVD CVE',
  desc: 'CVE vulnerability data from NIST National Vulnerability Database.',
  api: { base: 'https://services.nvd.nist.gov/rest/json/cves/2.0', name: 'NIST NVD', docs: 'https://nvd.nist.gov/developers/vulnerabilities' },
  key: null,
  keywords: ['cybersecurity', 'cve', 'vulnerability', 'nvd', 'nist'],
  methods: [
    { name: 'search_cve', display: 'Search CVEs by keyword', cost: 2, params: 'keyword, limit?', inputs: [
      { name: 'keyword', type: 'string', required: true, desc: 'Search keyword' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
    ]},
    { name: 'get_cve', display: 'Get CVE details by ID', cost: 2, params: 'cve_id', inputs: [
      { name: 'cve_id', type: 'string', required: true, desc: 'CVE ID (e.g. CVE-2024-1234)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-nvd-cve — NIST NVD CVE MCP Server
 *
 * Wraps NIST NVD API with SettleGrid billing.
 * No API key needed (rate limited without key).
 *
 * Methods:
 *   search_cve(keyword, limit?) — search CVEs (2¢)
 *   get_cve(cve_id) — CVE details (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { keyword: string; limit?: number }
interface CveInput { cve_id: string }

const API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'nvd-cve',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_cve: { costCents: 2, displayName: 'Search CVEs' },
      get_cve: { costCents: 2, displayName: 'Get CVE' },
    },
  },
})

const searchCve = sg.wrap(async (args: SearchInput) => {
  if (!args.keyword) throw new Error('keyword is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`?keywordSearch=\${encodeURIComponent(args.keyword)}&resultsPerPage=\${limit}\`)
  return {
    total: data.totalResults,
    cves: (data.vulnerabilities || []).map((v: any) => {
      const cve = v.cve
      return {
        id: cve.id, published: cve.published, modified: cve.lastModified,
        description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value?.slice(0, 300),
        severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || cve.metrics?.cvssMetricV2?.[0]?.baseSeverity,
        score: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore,
      }
    }),
  }
}, { method: 'search_cve' })

const getCve = sg.wrap(async (args: CveInput) => {
  if (!args.cve_id) throw new Error('cve_id is required')
  const data = await apiFetch<any>(\`?cveId=\${args.cve_id}\`)
  const cve = data.vulnerabilities?.[0]?.cve
  if (!cve) throw new Error('CVE not found')
  return {
    id: cve.id, published: cve.published, modified: cve.lastModified,
    description: cve.descriptions?.find((d: any) => d.lang === 'en')?.value,
    severity: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity,
    score: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
    vector: cve.metrics?.cvssMetricV31?.[0]?.cvssData?.vectorString,
    references: cve.references?.slice(0, 10).map((r: any) => ({ url: r.url, source: r.source })),
    weaknesses: cve.weaknesses?.map((w: any) => w.description?.[0]?.value),
  }
}, { method: 'get_cve' })

export { searchCve, getCve }

console.log('settlegrid-nvd-cve MCP server ready')
console.log('Methods: search_cve, get_cve')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 275: MITRE ATT&CK ─────────────────────────────────────────────────────
gen({
  slug: 'mitre-attack',
  title: 'MITRE ATT&CK',
  desc: 'MITRE ATT&CK framework tactics, techniques, and groups data.',
  api: { base: 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack', name: 'MITRE ATT&CK STIX', docs: 'https://attack.mitre.org/resources/working-with-attack/' },
  key: null,
  keywords: ['cybersecurity', 'mitre', 'attack', 'threat', 'tactics'],
  methods: [
    { name: 'search_techniques', display: 'Search ATT&CK techniques', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term for techniques' },
    ]},
    { name: 'get_technique', display: 'Get technique by ID', cost: 1, params: 'technique_id', inputs: [
      { name: 'technique_id', type: 'string', required: true, desc: 'Technique ID (e.g. T1566)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-mitre-attack — MITRE ATT&CK MCP Server
 *
 * Wraps MITRE ATT&CK STIX data with SettleGrid billing.
 * No API key needed — open data from GitHub.
 *
 * Methods:
 *   search_techniques(query) — search techniques (1¢)
 *   get_technique(technique_id) — technique details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }
interface TechInput { technique_id: string }

const API_BASE = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack'

let cachedData: any = null

async function loadData() {
  if (cachedData) return cachedData
  const res = await fetch(\`\${API_BASE}/enterprise-attack.json\`)
  if (!res.ok) throw new Error(\`Failed to load ATT&CK data: \${res.status}\`)
  cachedData = await res.json()
  return cachedData
}

const sg = settlegrid.init({
  toolSlug: 'mitre-attack',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_techniques: { costCents: 1, displayName: 'Search Techniques' },
      get_technique: { costCents: 1, displayName: 'Get Technique' },
    },
  },
})

const searchTechniques = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await loadData()
  const q = args.query.toLowerCase()
  const techniques = (data.objects || [])
    .filter((o: any) => o.type === 'attack-pattern' && !o.revoked)
    .filter((o: any) => o.name?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
    .slice(0, 20)
  return {
    results: techniques.map((t: any) => ({
      id: t.external_references?.find((r: any) => r.source_name === 'mitre-attack')?.external_id,
      name: t.name,
      description: t.description?.slice(0, 300),
      platforms: t.x_mitre_platforms,
      tactics: t.kill_chain_phases?.map((p: any) => p.phase_name),
    })),
  }
}, { method: 'search_techniques' })

const getTechnique = sg.wrap(async (args: TechInput) => {
  if (!args.technique_id) throw new Error('technique_id required')
  const data = await loadData()
  const tid = args.technique_id.toUpperCase()
  const tech = (data.objects || []).find((o: any) =>
    o.type === 'attack-pattern' &&
    o.external_references?.some((r: any) => r.external_id === tid)
  )
  if (!tech) throw new Error('Technique not found')
  return {
    id: tid, name: tech.name, description: tech.description?.slice(0, 1000),
    platforms: tech.x_mitre_platforms,
    tactics: tech.kill_chain_phases?.map((p: any) => p.phase_name),
    detection: tech.x_mitre_detection?.slice(0, 500),
    data_sources: tech.x_mitre_data_sources,
    url: \`https://attack.mitre.org/techniques/\${tid}/\`,
  }
}, { method: 'get_technique' })

export { searchTechniques, getTechnique }

console.log('settlegrid-mitre-attack MCP server ready')
console.log('Methods: search_techniques, get_technique')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 276: AbuseIPDB Extended ────────────────────────────────────────────────
gen({
  slug: 'abuseipdb-check',
  title: 'AbuseIPDB Check',
  desc: 'Check IP addresses against AbuseIPDB threat intelligence database.',
  api: { base: 'https://api.abuseipdb.com/api/v2', name: 'AbuseIPDB', docs: 'https://docs.abuseipdb.com/' },
  key: { env: 'ABUSEIPDB_API_KEY', url: 'https://www.abuseipdb.com/account/api', required: true },
  keywords: ['cybersecurity', 'ip', 'abuse', 'threat', 'blacklist'],
  methods: [
    { name: 'check_ip_abuse', display: 'Check IP for abuse reports', cost: 2, params: 'ip', inputs: [
      { name: 'ip', type: 'string', required: true, desc: 'IP address to check' },
    ]},
    { name: 'get_blacklist', display: 'Get AbuseIPDB blacklist', cost: 3, params: 'confidence_min?', inputs: [
      { name: 'confidence_min', type: 'number', required: false, desc: 'Min confidence score (default 90)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-abuseipdb-check — AbuseIPDB Check MCP Server
 *
 * Wraps AbuseIPDB API with SettleGrid billing.
 * Free key from https://www.abuseipdb.com/account/api.
 *
 * Methods:
 *   check_ip_abuse(ip) — check IP (2¢)
 *   get_blacklist(confidence_min?) — blacklist (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CheckInput { ip: string }
interface BlacklistInput { confidence_min?: number }

const API_BASE = 'https://api.abuseipdb.com/api/v2'
const API_KEY = process.env.ABUSEIPDB_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { 'Key': API_KEY, 'Accept': 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'abuseipdb-check',
  pricing: {
    defaultCostCents: 2,
    methods: {
      check_ip_abuse: { costCents: 2, displayName: 'Check IP' },
      get_blacklist: { costCents: 3, displayName: 'Blacklist' },
    },
  },
})

const checkIpAbuse = sg.wrap(async (args: CheckInput) => {
  if (!args.ip) throw new Error('ip is required')
  if (!API_KEY) throw new Error('ABUSEIPDB_API_KEY not set')
  const data = await apiFetch<any>(\`/check?ipAddress=\${args.ip}&maxAgeInDays=90&verbose\`)
  const d = data.data
  return {
    ip: d.ipAddress, is_public: d.isPublic, abuse_confidence: d.abuseConfidenceScore,
    country: d.countryCode, isp: d.isp, domain: d.domain, usage_type: d.usageType,
    total_reports: d.totalReports, distinct_users: d.numDistinctUsers,
    last_reported: d.lastReportedAt, is_whitelisted: d.isWhitelisted,
  }
}, { method: 'check_ip_abuse' })

const getBlacklist = sg.wrap(async (args: BlacklistInput) => {
  if (!API_KEY) throw new Error('ABUSEIPDB_API_KEY not set')
  const min = args.confidence_min ?? 90
  const data = await apiFetch<any>(\`/blacklist?confidenceMinimum=\${min}&limit=50\`)
  return {
    generated_at: data.meta?.generatedAt,
    entries: (data.data || []).map((d: any) => ({
      ip: d.ipAddress, abuse_confidence: d.abuseConfidenceScore,
      country: d.countryCode, last_reported: d.lastReportedAt,
    })),
  }
}, { method: 'get_blacklist' })

export { checkIpAbuse, getBlacklist }

console.log('settlegrid-abuseipdb-check MCP server ready')
console.log('Methods: check_ip_abuse, get_blacklist')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')
`
})

// ─── 277: MalwareBazaar Extended ────────────────────────────────────────────
gen({
  slug: 'malware-samples',
  title: 'MalwareBazaar Samples',
  desc: 'Malware sample lookup and threat intelligence from MalwareBazaar.',
  api: { base: 'https://mb-api.abuse.ch/api/v1', name: 'MalwareBazaar', docs: 'https://bazaar.abuse.ch/api/' },
  key: null,
  keywords: ['cybersecurity', 'malware', 'threat', 'ioc', 'samples'],
  methods: [
    { name: 'query_malware_hash', display: 'Query malware by SHA256 hash', cost: 2, params: 'hash', inputs: [
      { name: 'hash', type: 'string', required: true, desc: 'SHA256 hash of sample' },
    ]},
    { name: 'get_recent_malware', display: 'Get recent malware samples', cost: 2, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-malware-samples — MalwareBazaar Samples MCP Server
 *
 * Wraps MalwareBazaar API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   query_malware_hash(hash) — lookup by hash (2¢)
 *   get_recent_malware(limit?) — recent samples (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HashInput { hash: string }
interface RecentInput { limit?: number }

const API_BASE = 'https://mb-api.abuse.ch/api/v1/'

async function apiPost<T>(body: Record<string, string>): Promise<T> {
  const form = new URLSearchParams(body)
  const res = await fetch(API_BASE, {
    method: 'POST',
    body: form,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'malware-samples',
  pricing: {
    defaultCostCents: 2,
    methods: {
      query_malware_hash: { costCents: 2, displayName: 'Query Hash' },
      get_recent_malware: { costCents: 2, displayName: 'Recent Malware' },
    },
  },
})

const queryMalwareHash = sg.wrap(async (args: HashInput) => {
  if (!args.hash) throw new Error('hash is required')
  const data = await apiPost<any>({ query: 'get_info', hash: args.hash })
  if (data.query_status === 'hash_not_found') throw new Error('Hash not found in MalwareBazaar')
  const s = data.data?.[0]
  return {
    sha256: s?.sha256_hash, sha1: s?.sha1_hash, md5: s?.md5_hash,
    file_name: s?.file_name, file_size: s?.file_size, file_type: s?.file_type_mime,
    signature: s?.signature, tags: s?.tags, first_seen: s?.first_seen,
    reporter: s?.reporter, delivery_method: s?.delivery_method,
    intelligence: s?.intelligence,
  }
}, { method: 'query_malware_hash' })

const getRecentMalware = sg.wrap(async (args: RecentInput) => {
  const limit = args.limit ?? 20
  const data = await apiPost<any>({ query: 'get_recent', selector: String(limit) })
  return {
    samples: (data.data || []).slice(0, limit).map((s: any) => ({
      sha256: s.sha256_hash, file_name: s.file_name, file_type: s.file_type_mime,
      signature: s.signature, tags: s.tags, first_seen: s.first_seen,
    })),
  }
}, { method: 'get_recent_malware' })

export { queryMalwareHash, getRecentMalware }

console.log('settlegrid-malware-samples MCP server ready')
console.log('Methods: query_malware_hash, get_recent_malware')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 278: Shodan Host ───────────────────────────────────────────────────────
gen({
  slug: 'shodan-host',
  title: 'Shodan Host Lookup',
  desc: 'Internet-connected device search and host reconnaissance via Shodan.',
  api: { base: 'https://api.shodan.io', name: 'Shodan', docs: 'https://developer.shodan.io/api' },
  key: { env: 'SHODAN_API_KEY', url: 'https://account.shodan.io/', required: true },
  keywords: ['cybersecurity', 'shodan', 'reconnaissance', 'iot', 'scanning'],
  methods: [
    { name: 'lookup_host', display: 'Lookup host by IP', cost: 3, params: 'ip', inputs: [
      { name: 'ip', type: 'string', required: true, desc: 'IP address to lookup' },
    ]},
    { name: 'shodan_search', display: 'Search Shodan', cost: 3, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Shodan search query' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-shodan-host — Shodan Host Lookup MCP Server
 *
 * Wraps Shodan API with SettleGrid billing.
 * Free key from https://account.shodan.io/.
 *
 * Methods:
 *   lookup_host(ip) — host lookup (3¢)
 *   shodan_search(query) — search (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HostInput { ip: string }
interface SearchInput { query: string }

const API_BASE = 'https://api.shodan.io'
const API_KEY = process.env.SHODAN_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = \`\${API_BASE}\${path}\${sep}key=\${API_KEY}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'shodan-host',
  pricing: {
    defaultCostCents: 3,
    methods: {
      lookup_host: { costCents: 3, displayName: 'Lookup Host' },
      shodan_search: { costCents: 3, displayName: 'Shodan Search' },
    },
  },
})

const lookupHost = sg.wrap(async (args: HostInput) => {
  if (!args.ip) throw new Error('ip is required')
  if (!API_KEY) throw new Error('SHODAN_API_KEY not set')
  const data = await apiFetch<any>(\`/shodan/host/\${args.ip}\`)
  return {
    ip: data.ip_str, hostnames: data.hostnames, org: data.org,
    os: data.os, country: data.country_name, city: data.city,
    ports: data.ports, vulns: data.vulns,
    services: (data.data || []).slice(0, 10).map((s: any) => ({
      port: s.port, transport: s.transport, product: s.product,
      version: s.version, banner: s.data?.slice(0, 200),
    })),
  }
}, { method: 'lookup_host' })

const shodanSearch = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('SHODAN_API_KEY not set')
  const data = await apiFetch<any>(\`/shodan/host/search?query=\${encodeURIComponent(args.query)}\`)
  return {
    total: data.total,
    matches: (data.matches || []).slice(0, 20).map((m: any) => ({
      ip: m.ip_str, port: m.port, org: m.org, os: m.os,
      product: m.product, country: m.location?.country_name,
    })),
  }
}, { method: 'shodan_search' })

export { lookupHost, shodanSearch }

console.log('settlegrid-shodan-host MCP server ready')
console.log('Methods: lookup_host, shodan_search')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
`
})

// ─── 279: FDA Drug Data ─────────────────────────────────────────────────────
gen({
  slug: 'fda-drugs',
  title: 'FDA Drug Data',
  desc: 'FDA drug information, adverse events, and labeling from openFDA.',
  api: { base: 'https://api.fda.gov/drug', name: 'openFDA', docs: 'https://open.fda.gov/apis/drug/' },
  key: null,
  keywords: ['legal', 'fda', 'drugs', 'pharmaceutical', 'health'],
  methods: [
    { name: 'search_drugs', display: 'Search FDA drug labels', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Drug name or ingredient' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
    ]},
    { name: 'get_adverse_events', display: 'Get drug adverse events', cost: 1, params: 'drug_name, limit?', inputs: [
      { name: 'drug_name', type: 'string', required: true, desc: 'Drug name' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-fda-drugs — FDA Drug Data MCP Server
 *
 * Wraps openFDA Drug API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_drugs(query, limit?) — search drugs (1¢)
 *   get_adverse_events(drug_name, limit?) — adverse events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface EventInput { drug_name: string; limit?: number }

const API_BASE = 'https://api.fda.gov/drug'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fda-drugs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_drugs: { costCents: 1, displayName: 'Search Drugs' },
      get_adverse_events: { costCents: 1, displayName: 'Adverse Events' },
    },
  },
})

const searchDrugs = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`/label.json?search=openfda.brand_name:"\${encodeURIComponent(args.query)}"&limit=\${limit}\`)
  return {
    total: data.meta?.results?.total,
    drugs: (data.results || []).map((d: any) => ({
      brand_name: d.openfda?.brand_name?.[0], generic_name: d.openfda?.generic_name?.[0],
      manufacturer: d.openfda?.manufacturer_name?.[0], route: d.openfda?.route?.[0],
      substance: d.openfda?.substance_name?.[0],
      purpose: d.purpose?.[0]?.slice(0, 200),
      warnings: d.warnings?.[0]?.slice(0, 200),
    })),
  }
}, { method: 'search_drugs' })

const getAdverseEvents = sg.wrap(async (args: EventInput) => {
  if (!args.drug_name) throw new Error('drug_name is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`/event.json?search=patient.drug.openfda.brand_name:"\${encodeURIComponent(args.drug_name)}"&limit=\${limit}\`)
  return {
    total: data.meta?.results?.total,
    events: (data.results || []).map((e: any) => ({
      date: e.receivedate, serious: e.serious, country: e.occurcountry,
      reactions: e.patient?.reaction?.map((r: any) => r.reactionmeddrapt)?.slice(0, 5),
      outcome: e.patient?.reaction?.[0]?.reactionoutcome,
    })),
  }
}, { method: 'get_adverse_events' })

export { searchDrugs, getAdverseEvents }

console.log('settlegrid-fda-drugs MCP server ready')
console.log('Methods: search_drugs, get_adverse_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 280: FCC License Data ──────────────────────────────────────────────────
gen({
  slug: 'fcc-data',
  title: 'FCC License Data',
  desc: 'FCC license and spectrum data from the Universal Licensing System.',
  api: { base: 'https://data.fcc.gov/api/license-view', name: 'FCC ULS', docs: 'https://www.fcc.gov/developers/api' },
  key: null,
  keywords: ['legal', 'fcc', 'telecom', 'licenses', 'spectrum'],
  methods: [
    { name: 'search_fcc_licenses', display: 'Search FCC licenses', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Licensee name or call sign' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-fcc-data — FCC License Data MCP Server
 *
 * Wraps FCC ULS API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_fcc_licenses(query) — search licenses (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

const API_BASE = 'https://data.fcc.gov/api/license-view'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'fcc-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_fcc_licenses: { costCents: 1, displayName: 'Search Licenses' },
    },
  },
})

const searchFccLicenses = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(\`/basicSearch/getLicenses?searchValue=\${encodeURIComponent(args.query)}&format=json\`)
  const licenses = data.Licenses?.License || []
  const list = Array.isArray(licenses) ? licenses : [licenses]
  return {
    total: data.Licenses?.totalRows,
    licenses: list.slice(0, 20).map((l: any) => ({
      callSign: l.callSign, status: l.statusDesc, service: l.serviceDesc,
      licensee: l.licName, frn: l.frn, grant_date: l.grantDate,
      expiration_date: l.expiredDate, category: l.categoryDesc,
    })),
  }
}, { method: 'search_fcc_licenses' })

export { searchFccLicenses }

console.log('settlegrid-fcc-data MCP server ready')
console.log('Methods: search_fcc_licenses')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 281: JokeAPI ───────────────────────────────────────────────────────────
gen({
  slug: 'jokeapi',
  title: 'JokeAPI',
  desc: 'Random jokes by category from JokeAPI — programming, puns, dark, misc.',
  api: { base: 'https://v2.jokeapi.dev', name: 'JokeAPI', docs: 'https://jokeapi.dev/' },
  key: null,
  keywords: ['misc', 'jokes', 'humor', 'fun', 'random'],
  methods: [
    { name: 'get_joke', display: 'Get a random joke', cost: 1, params: 'category?, type?', inputs: [
      { name: 'category', type: 'string', required: false, desc: 'Category: Programming, Pun, Dark, Misc, Spooky, Christmas (default Any)' },
      { name: 'type', type: 'string', required: false, desc: 'Type: single, twopart (default any)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-jokeapi — JokeAPI MCP Server
 *
 * Wraps JokeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_joke(category?, type?) — random joke (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface JokeInput { category?: string; type?: string }

const API_BASE = 'https://v2.jokeapi.dev'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'jokeapi',
  pricing: { defaultCostCents: 1, methods: { get_joke: { costCents: 1, displayName: 'Get Joke' } } },
})

const getJoke = sg.wrap(async (args: JokeInput) => {
  const cat = args.category || 'Any'
  const params = args.type ? \`?type=\${args.type}\` : ''
  const data = await apiFetch<any>(\`/joke/\${cat}\${params}\`)
  if (data.error) throw new Error(data.message || 'Joke API error')
  if (data.type === 'single') {
    return { type: 'single', category: data.category, joke: data.joke, id: data.id, lang: data.lang }
  }
  return { type: 'twopart', category: data.category, setup: data.setup, delivery: data.delivery, id: data.id, lang: data.lang }
}, { method: 'get_joke' })

export { getJoke }

console.log('settlegrid-jokeapi MCP server ready')
console.log('Methods: get_joke')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 282: Random Quotes ─────────────────────────────────────────────────────
gen({
  slug: 'random-quotes',
  title: 'Random Quotes',
  desc: 'Random inspirational and famous quotes from Quotable API.',
  api: { base: 'https://api.quotable.io', name: 'Quotable', docs: 'https://docs.quotable.io/' },
  key: null,
  keywords: ['misc', 'quotes', 'inspiration', 'random'],
  methods: [
    { name: 'get_random_quote', display: 'Get a random quote', cost: 1, params: 'tag?', inputs: [
      { name: 'tag', type: 'string', required: false, desc: 'Tag filter (e.g. technology, wisdom)' },
    ]},
    { name: 'search_quotes', display: 'Search quotes by keyword', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search keyword' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-random-quotes — Random Quotes MCP Server
 *
 * Wraps Quotable API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_random_quote(tag?) — random quote (1¢)
 *   search_quotes(query) — search quotes (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface RandomInput { tag?: string }
interface SearchInput { query: string }

const API_BASE = 'https://api.quotable.io'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'random-quotes',
  pricing: { defaultCostCents: 1, methods: { get_random_quote: { costCents: 1, displayName: 'Random Quote' }, search_quotes: { costCents: 1, displayName: 'Search Quotes' } } },
})

const getRandomQuote = sg.wrap(async (args: RandomInput) => {
  const params = args.tag ? \`?tags=\${encodeURIComponent(args.tag)}\` : ''
  const data = await apiFetch<any>(\`/random\${params}\`)
  return { content: data.content, author: data.author, tags: data.tags, length: data.length, id: data._id }
}, { method: 'get_random_quote' })

const searchQuotes = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(\`/search/quotes?query=\${encodeURIComponent(args.query)}\`)
  return {
    total: data.totalCount,
    quotes: (data.results || []).slice(0, 20).map((q: any) => ({
      content: q.content, author: q.author, tags: q.tags,
    })),
  }
}, { method: 'search_quotes' })

export { getRandomQuote, searchQuotes }

console.log('settlegrid-random-quotes MCP server ready')
console.log('Methods: get_random_quote, search_quotes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 283: Trivia API ────────────────────────────────────────────────────────
gen({
  slug: 'trivia-api',
  title: 'Trivia Questions',
  desc: 'Random trivia questions from Open Trivia Database.',
  api: { base: 'https://opentdb.com/api.php', name: 'Open Trivia DB', docs: 'https://opentdb.com/api_config.php' },
  key: null,
  keywords: ['misc', 'trivia', 'quiz', 'questions', 'fun'],
  methods: [
    { name: 'get_trivia', display: 'Get trivia questions', cost: 1, params: 'amount?, category?, difficulty?', inputs: [
      { name: 'amount', type: 'number', required: false, desc: 'Number of questions (1-50, default 5)' },
      { name: 'category', type: 'number', required: false, desc: 'Category ID (9-32)' },
      { name: 'difficulty', type: 'string', required: false, desc: 'easy, medium, or hard' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-trivia-api — Trivia Questions MCP Server
 *
 * Wraps Open Trivia Database with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_trivia(amount?, category?, difficulty?) — trivia questions (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TriviaInput { amount?: number; category?: number; difficulty?: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'trivia-api',
  pricing: { defaultCostCents: 1, methods: { get_trivia: { costCents: 1, displayName: 'Get Trivia' } } },
})

const getTrivia = sg.wrap(async (args: TriviaInput) => {
  const amount = Math.min(Math.max(args.amount ?? 5, 1), 50)
  let url = \`https://opentdb.com/api.php?amount=\${amount}\`
  if (args.category) url += \`&category=\${args.category}\`
  if (args.difficulty) url += \`&difficulty=\${args.difficulty}\`
  const data = await apiFetch<any>(url)
  if (data.response_code !== 0) throw new Error('No results found for the given parameters')
  return {
    questions: (data.results || []).map((q: any) => ({
      category: q.category, type: q.type, difficulty: q.difficulty,
      question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
      correct_answer: q.correct_answer, incorrect_answers: q.incorrect_answers,
    })),
  }
}, { method: 'get_trivia' })

export { getTrivia }

console.log('settlegrid-trivia-api MCP server ready')
console.log('Methods: get_trivia')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 284: SWAPI Star Wars ──────────────────────────────────────────────────
gen({
  slug: 'swapi',
  title: 'SWAPI Star Wars',
  desc: 'Star Wars universe data — characters, planets, starships from SWAPI.',
  api: { base: 'https://swapi.dev/api', name: 'SWAPI', docs: 'https://swapi.dev/documentation' },
  key: null,
  keywords: ['misc', 'starwars', 'characters', 'movies', 'sci-fi'],
  methods: [
    { name: 'search_people', display: 'Search Star Wars characters', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Character name' },
    ]},
    { name: 'search_planets', display: 'Search Star Wars planets', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Planet name' },
    ]},
    { name: 'search_starships', display: 'Search Star Wars starships', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Starship name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-swapi — SWAPI Star Wars MCP Server
 *
 * Wraps SWAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_people(name) — Star Wars characters (1¢)
 *   search_planets(name) — Star Wars planets (1¢)
 *   search_starships(name) — Star Wars starships (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { name: string }

const API_BASE = 'https://swapi.dev/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'swapi',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_people: { costCents: 1, displayName: 'Search People' },
      search_planets: { costCents: 1, displayName: 'Search Planets' },
      search_starships: { costCents: 1, displayName: 'Search Starships' },
    },
  },
})

const searchPeople = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/people/?search=\${encodeURIComponent(args.name)}\`)
  return {
    count: data.count,
    results: (data.results || []).map((p: any) => ({
      name: p.name, height: p.height, mass: p.mass, hair_color: p.hair_color,
      eye_color: p.eye_color, birth_year: p.birth_year, gender: p.gender,
    })),
  }
}, { method: 'search_people' })

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/planets/?search=\${encodeURIComponent(args.name)}\`)
  return {
    count: data.count,
    results: (data.results || []).map((p: any) => ({
      name: p.name, climate: p.climate, terrain: p.terrain, population: p.population,
      diameter: p.diameter, gravity: p.gravity, orbital_period: p.orbital_period,
    })),
  }
}, { method: 'search_planets' })

const searchStarships = sg.wrap(async (args: SearchInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/starships/?search=\${encodeURIComponent(args.name)}\`)
  return {
    count: data.count,
    results: (data.results || []).map((s: any) => ({
      name: s.name, model: s.model, manufacturer: s.manufacturer,
      cost: s.cost_in_credits, length: s.length, crew: s.crew,
      passengers: s.passengers, hyperdrive_rating: s.hyperdrive_rating,
      starship_class: s.starship_class,
    })),
  }
}, { method: 'search_starships' })

export { searchPeople, searchPlanets, searchStarships }

console.log('settlegrid-swapi MCP server ready')
console.log('Methods: search_people, search_planets, search_starships')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 285: Pokemon Data ──────────────────────────────────────────────────────
gen({
  slug: 'pokemon-data',
  title: 'Pokemon Data',
  desc: 'Pokemon species, abilities, and type data from PokeAPI.',
  api: { base: 'https://pokeapi.co/api/v2', name: 'PokeAPI', docs: 'https://pokeapi.co/docs/v2' },
  key: null,
  keywords: ['misc', 'pokemon', 'games', 'characters'],
  methods: [
    { name: 'get_pokemon', display: 'Get Pokemon by name or ID', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Pokemon name or ID' },
    ]},
    { name: 'get_pokemon_species', display: 'Get Pokemon species info', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Pokemon name or ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-pokemon-data — Pokemon Data MCP Server
 *
 * Wraps PokeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_pokemon(name) — Pokemon info (1¢)
 *   get_pokemon_species(name) — species info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PokemonInput { name: string }

const API_BASE = 'https://pokeapi.co/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Pokemon not found')
    throw new Error(\`API \${res.status}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pokemon-data',
  pricing: { defaultCostCents: 1, methods: { get_pokemon: { costCents: 1, displayName: 'Get Pokemon' }, get_pokemon_species: { costCents: 1, displayName: 'Pokemon Species' } } },
})

const getPokemon = sg.wrap(async (args: PokemonInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/pokemon/\${args.name.toLowerCase()}\`)
  return {
    id: data.id, name: data.name, height: data.height, weight: data.weight,
    types: data.types?.map((t: any) => t.type.name),
    abilities: data.abilities?.map((a: any) => ({ name: a.ability.name, hidden: a.is_hidden })),
    stats: data.stats?.map((s: any) => ({ name: s.stat.name, value: s.base_stat })),
    sprite: data.sprites?.front_default,
  }
}, { method: 'get_pokemon' })

const getPokemonSpecies = sg.wrap(async (args: PokemonInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/pokemon-species/\${args.name.toLowerCase()}\`)
  return {
    id: data.id, name: data.name, color: data.color?.name,
    habitat: data.habitat?.name, shape: data.shape?.name,
    generation: data.generation?.name, is_legendary: data.is_legendary,
    is_mythical: data.is_mythical, capture_rate: data.capture_rate,
    base_happiness: data.base_happiness,
    flavor_text: data.flavor_text_entries?.find((f: any) => f.language.name === 'en')?.flavor_text?.replace(/\\n/g, ' '),
    genus: data.genera?.find((g: any) => g.language.name === 'en')?.genus,
  }
}, { method: 'get_pokemon_species' })

export { getPokemon, getPokemonSpecies }

console.log('settlegrid-pokemon-data MCP server ready')
console.log('Methods: get_pokemon, get_pokemon_species')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 286: Cat Facts ─────────────────────────────────────────────────────────
gen({
  slug: 'cat-facts',
  title: 'Cat Facts',
  desc: 'Random cat facts and cat breed data from CatFact API.',
  api: { base: 'https://catfact.ninja', name: 'CatFact.ninja', docs: 'https://catfact.ninja/' },
  key: null,
  keywords: ['misc', 'cats', 'animals', 'facts', 'fun'],
  methods: [
    { name: 'get_cat_fact', display: 'Get a random cat fact', cost: 1, params: '', inputs: [] },
    { name: 'list_cat_breeds', display: 'List cat breeds', cost: 1, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cat-facts — Cat Facts MCP Server
 *
 * Wraps CatFact.ninja API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_cat_fact() — random cat fact (1¢)
 *   list_cat_breeds(limit?) — cat breeds (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BreedInput { limit?: number }

const API_BASE = 'https://catfact.ninja'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'cat-facts',
  pricing: { defaultCostCents: 1, methods: { get_cat_fact: { costCents: 1, displayName: 'Cat Fact' }, list_cat_breeds: { costCents: 1, displayName: 'Cat Breeds' } } },
})

const getCatFact = sg.wrap(async () => {
  const data = await apiFetch<any>('/fact')
  return { fact: data.fact, length: data.length }
}, { method: 'get_cat_fact' })

const listCatBreeds = sg.wrap(async (args: BreedInput) => {
  const limit = args.limit ?? 20
  const data = await apiFetch<any>(\`/breeds?limit=\${limit}\`)
  return {
    total: data.total,
    breeds: (data.data || []).map((b: any) => ({
      breed: b.breed, country: b.country, origin: b.origin, coat: b.coat, pattern: b.pattern,
    })),
  }
}, { method: 'list_cat_breeds' })

export { getCatFact, listCatBreeds }

console.log('settlegrid-cat-facts MCP server ready')
console.log('Methods: get_cat_fact, list_cat_breeds')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 287: Dog Breeds ────────────────────────────────────────────────────────
gen({
  slug: 'dog-breeds',
  title: 'Dog Breeds',
  desc: 'Dog breed information and random images from Dog CEO API.',
  api: { base: 'https://dog.ceo/api', name: 'Dog CEO', docs: 'https://dog.ceo/dog-api/documentation/' },
  key: null,
  keywords: ['misc', 'dogs', 'animals', 'breeds', 'images'],
  methods: [
    { name: 'list_dog_breeds', display: 'List all dog breeds', cost: 1, params: '', inputs: [] },
    { name: 'get_breed_image', display: 'Get random image for breed', cost: 1, params: 'breed', inputs: [
      { name: 'breed', type: 'string', required: true, desc: 'Dog breed name (e.g. labrador, poodle)' },
    ]},
    { name: 'get_random_dog', display: 'Get a random dog image', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-dog-breeds — Dog Breeds MCP Server
 *
 * Wraps Dog CEO API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_dog_breeds() — all breeds (1¢)
 *   get_breed_image(breed) — breed image (1¢)
 *   get_random_dog() — random dog (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BreedInput { breed: string }

const API_BASE = 'https://dog.ceo/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'dog-breeds',
  pricing: { defaultCostCents: 1, methods: { list_dog_breeds: { costCents: 1, displayName: 'List Breeds' }, get_breed_image: { costCents: 1, displayName: 'Breed Image' }, get_random_dog: { costCents: 1, displayName: 'Random Dog' } } },
})

const listDogBreeds = sg.wrap(async () => {
  const data = await apiFetch<any>('/breeds/list/all')
  const breeds = Object.entries(data.message || {}).map(([breed, subs]: [string, any]) => ({
    breed, sub_breeds: subs,
  }))
  return { total: breeds.length, breeds }
}, { method: 'list_dog_breeds' })

const getBreedImage = sg.wrap(async (args: BreedInput) => {
  if (!args.breed) throw new Error('breed is required')
  const data = await apiFetch<any>(\`/breed/\${args.breed.toLowerCase()}/images/random\`)
  if (data.status !== 'success') throw new Error('Breed not found')
  return { breed: args.breed, image_url: data.message }
}, { method: 'get_breed_image' })

const getRandomDog = sg.wrap(async () => {
  const data = await apiFetch<any>('/breeds/image/random')
  return { image_url: data.message }
}, { method: 'get_random_dog' })

export { listDogBreeds, getBreedImage, getRandomDog }

console.log('settlegrid-dog-breeds MCP server ready')
console.log('Methods: list_dog_breeds, get_breed_image, get_random_dog')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 288: Gutenberg Books ──────────────────────────────────────────────────
gen({
  slug: 'gutenberg-books',
  title: 'Gutenberg Books',
  desc: 'Search and access free public domain books from Project Gutenberg.',
  api: { base: 'https://gutendex.com', name: 'Gutendex', docs: 'https://gutendex.com/' },
  key: null,
  keywords: ['misc', 'books', 'literature', 'free', 'public-domain'],
  methods: [
    { name: 'search_gutenberg', display: 'Search Gutenberg books', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
    { name: 'get_book', display: 'Get book by ID', cost: 1, params: 'id', inputs: [
      { name: 'id', type: 'number', required: true, desc: 'Gutenberg book ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-gutenberg-books — Gutenberg Books MCP Server
 *
 * Wraps Gutendex API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_gutenberg(query, limit?) — search books (1¢)
 *   get_book(id) — book details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface BookInput { id: number }

const API_BASE = 'https://gutendex.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'gutenberg-books',
  pricing: { defaultCostCents: 1, methods: { search_gutenberg: { costCents: 1, displayName: 'Search Books' }, get_book: { costCents: 1, displayName: 'Get Book' } } },
})

const searchGutenberg = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await apiFetch<any>(\`/books?search=\${encodeURIComponent(args.query)}\`)
  return {
    count: data.count,
    books: (data.results || []).slice(0, args.limit ?? 20).map((b: any) => ({
      id: b.id, title: b.title, authors: b.authors?.map((a: any) => a.name),
      languages: b.languages, download_count: b.download_count,
      subjects: b.subjects?.slice(0, 5),
    })),
  }
}, { method: 'search_gutenberg' })

const getBook = sg.wrap(async (args: BookInput) => {
  if (!args.id) throw new Error('id is required')
  const data = await apiFetch<any>(\`/books/\${args.id}\`)
  return {
    id: data.id, title: data.title,
    authors: data.authors?.map((a: any) => ({ name: a.name, birth: a.birth_year, death: a.death_year })),
    languages: data.languages, subjects: data.subjects, bookshelves: data.bookshelves,
    download_count: data.download_count,
    formats: data.formats,
  }
}, { method: 'get_book' })

export { searchGutenberg, getBook }

console.log('settlegrid-gutenberg-books MCP server ready')
console.log('Methods: search_gutenberg, get_book')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 289: Open Library Books ────────────────────────────────────────────────
gen({
  slug: 'openlibrary-books',
  title: 'Open Library Books',
  desc: 'Book search and ISBN lookup from Open Library / Internet Archive.',
  api: { base: 'https://openlibrary.org', name: 'Open Library', docs: 'https://openlibrary.org/dev/docs/api/books' },
  key: null,
  keywords: ['misc', 'books', 'isbn', 'library', 'reading'],
  methods: [
    { name: 'search_books', display: 'Search books', cost: 1, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Book title or author' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
    ]},
    { name: 'get_book_by_isbn', display: 'Get book by ISBN', cost: 1, params: 'isbn', inputs: [
      { name: 'isbn', type: 'string', required: true, desc: 'ISBN-10 or ISBN-13' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-openlibrary-books — Open Library Books MCP Server
 *
 * Wraps Open Library API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_books(query, limit?) — search books (1¢)
 *   get_book_by_isbn(isbn) — book by ISBN (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface IsbnInput { isbn: string }

const API_BASE = 'https://openlibrary.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'openlibrary-books',
  pricing: { defaultCostCents: 1, methods: { search_books: { costCents: 1, displayName: 'Search Books' }, get_book_by_isbn: { costCents: 1, displayName: 'Book By ISBN' } } },
})

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  const data = await apiFetch<any>(\`/search.json?q=\${encodeURIComponent(args.query)}&limit=\${limit}\`)
  return {
    total: data.numFound,
    books: (data.docs || []).map((b: any) => ({
      key: b.key, title: b.title, author: b.author_name?.[0],
      first_publish_year: b.first_publish_year, isbn: b.isbn?.[0],
      subject: b.subject?.slice(0, 5), language: b.language?.slice(0, 3),
      edition_count: b.edition_count, cover_id: b.cover_i,
    })),
  }
}, { method: 'search_books' })

const getBookByIsbn = sg.wrap(async (args: IsbnInput) => {
  if (!args.isbn) throw new Error('isbn is required')
  const data = await apiFetch<any>(\`/api/books?bibkeys=ISBN:\${args.isbn}&format=json&jscmd=data\`)
  const key = \`ISBN:\${args.isbn}\`
  const book = data[key]
  if (!book) throw new Error('Book not found for this ISBN')
  return {
    title: book.title, authors: book.authors?.map((a: any) => a.name),
    publishers: book.publishers?.map((p: any) => p.name),
    publish_date: book.publish_date, pages: book.number_of_pages,
    subjects: book.subjects?.slice(0, 5).map((s: any) => s.name),
    cover: book.cover, url: book.url,
  }
}, { method: 'get_book_by_isbn' })

export { searchBooks, getBookByIsbn }

console.log('settlegrid-openlibrary-books MCP server ready')
console.log('Methods: search_books, get_book_by_isbn')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 290: TimeZone Data ─────────────────────────────────────────────────────
gen({
  slug: 'timezone-data',
  title: 'TimeZone Data',
  desc: 'World timezone information and time conversion via WorldTimeAPI.',
  api: { base: 'https://worldtimeapi.org/api', name: 'WorldTimeAPI', docs: 'http://worldtimeapi.org/' },
  key: null,
  keywords: ['travel', 'timezone', 'time', 'world-clock'],
  methods: [
    { name: 'get_timezone', display: 'Get current time in timezone', cost: 1, params: 'timezone', inputs: [
      { name: 'timezone', type: 'string', required: true, desc: 'Timezone (e.g. America/New_York, Europe/London)' },
    ]},
    { name: 'list_timezones', display: 'List all available timezones', cost: 1, params: '', inputs: [] },
    { name: 'get_time_by_ip', display: 'Get timezone by IP address', cost: 1, params: 'ip', inputs: [
      { name: 'ip', type: 'string', required: true, desc: 'IP address' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-timezone-data — TimeZone Data MCP Server
 *
 * Wraps WorldTimeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_timezone(timezone) — current time (1¢)
 *   list_timezones() — all timezones (1¢)
 *   get_time_by_ip(ip) — timezone by IP (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TzInput { timezone: string }
interface IpInput { ip: string }

const API_BASE = 'https://worldtimeapi.org/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'timezone-data',
  pricing: { defaultCostCents: 1, methods: { get_timezone: { costCents: 1, displayName: 'Get Timezone' }, list_timezones: { costCents: 1, displayName: 'List Timezones' }, get_time_by_ip: { costCents: 1, displayName: 'Time By IP' } } },
})

const getTimezone = sg.wrap(async (args: TzInput) => {
  if (!args.timezone) throw new Error('timezone is required')
  const data = await apiFetch<any>(\`/timezone/\${args.timezone}\`)
  return {
    timezone: data.timezone, datetime: data.datetime, utc_offset: data.utc_offset,
    abbreviation: data.abbreviation, day_of_week: data.day_of_week,
    day_of_year: data.day_of_year, week_number: data.week_number, dst: data.dst,
  }
}, { method: 'get_timezone' })

const listTimezones = sg.wrap(async () => {
  const data = await apiFetch<string[]>('/timezone')
  return { count: data.length, timezones: data }
}, { method: 'list_timezones' })

const getTimeByIp = sg.wrap(async (args: IpInput) => {
  if (!args.ip) throw new Error('ip is required')
  const data = await apiFetch<any>(\`/ip/\${args.ip}\`)
  return {
    ip: args.ip, timezone: data.timezone, datetime: data.datetime,
    utc_offset: data.utc_offset, abbreviation: data.abbreviation,
  }
}, { method: 'get_time_by_ip' })

export { getTimezone, listTimezones, getTimeByIp }

console.log('settlegrid-timezone-data MCP server ready')
console.log('Methods: get_timezone, list_timezones, get_time_by_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 291: Visa Requirements ─────────────────────────────────────────────────
gen({
  slug: 'visa-requirements',
  title: 'Visa Requirements',
  desc: 'Passport and visa requirement data via Passport Index API.',
  api: { base: 'https://rough-sun-2523.fly.dev', name: 'Passport Index API', docs: 'https://github.com/ilyankou/passport-index-dataset' },
  key: null,
  keywords: ['travel', 'visa', 'passport', 'immigration'],
  methods: [
    { name: 'check_visa', display: 'Check visa requirement between countries', cost: 1, params: 'from, to', inputs: [
      { name: 'from', type: 'string', required: true, desc: 'Passport country code (ISO 3166-1 alpha-2)' },
      { name: 'to', type: 'string', required: true, desc: 'Destination country code' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-visa-requirements — Visa Requirements MCP Server
 *
 * Provides visa requirement data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   check_visa(from, to) — visa requirement (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface VisaInput { from: string; to: string }

const API_BASE = 'https://rough-sun-2523.fly.dev'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'visa-requirements',
  pricing: { defaultCostCents: 1, methods: { check_visa: { costCents: 1, displayName: 'Check Visa' } } },
})

const checkVisa = sg.wrap(async (args: VisaInput) => {
  if (!args.from || !args.to) throw new Error('from and to country codes are required')
  const from = args.from.toUpperCase()
  const to = args.to.toUpperCase()
  try {
    const data = await apiFetch<any>(\`/api/\${from}/\${to}\`)
    return { from, to, requirement: data.requirement || data.status || 'unknown', details: data }
  } catch {
    return {
      from, to,
      requirement: 'Unable to determine — check official embassy sources',
      note: 'Visa requirements change frequently. Always verify with official sources.',
    }
  }
}, { method: 'check_visa' })

export { checkVisa }

console.log('settlegrid-visa-requirements MCP server ready')
console.log('Methods: check_visa')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 292: Distance Calculator ───────────────────────────────────────────────
gen({
  slug: 'distance-calc',
  title: 'Distance Calculator',
  desc: 'Calculate distances between coordinates using the Haversine formula.',
  api: { base: 'https://local', name: 'Local Calculation', docs: 'https://en.wikipedia.org/wiki/Haversine_formula' },
  key: null,
  keywords: ['travel', 'distance', 'coordinates', 'geography'],
  methods: [
    { name: 'calc_distance', display: 'Calculate distance between two points', cost: 1, params: 'lat1, lon1, lat2, lon2', inputs: [
      { name: 'lat1', type: 'number', required: true, desc: 'Origin latitude' },
      { name: 'lon1', type: 'number', required: true, desc: 'Origin longitude' },
      { name: 'lat2', type: 'number', required: true, desc: 'Destination latitude' },
      { name: 'lon2', type: 'number', required: true, desc: 'Destination longitude' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-distance-calc — Distance Calculator MCP Server
 *
 * Calculates distances locally using Haversine formula.
 * No API key needed.
 *
 * Methods:
 *   calc_distance(lat1, lon1, lat2, lon2) — distance calculation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DistInput { lat1: number; lon1: number; lat2: number; lon2: number }

const sg = settlegrid.init({
  toolSlug: 'distance-calc',
  pricing: { defaultCostCents: 1, methods: { calc_distance: { costCents: 1, displayName: 'Calculate Distance' } } },
})

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

const calcDistance = sg.wrap(async (args: DistInput) => {
  if ([args.lat1, args.lon1, args.lat2, args.lon2].some(v => typeof v !== 'number')) {
    throw new Error('All coordinates (lat1, lon1, lat2, lon2) are required numbers')
  }
  const km = haversine(args.lat1, args.lon1, args.lat2, args.lon2)
  const deg = bearing(args.lat1, args.lon1, args.lat2, args.lon2)
  return {
    from: { lat: args.lat1, lon: args.lon1 },
    to: { lat: args.lat2, lon: args.lon2 },
    distance_km: Math.round(km * 100) / 100,
    distance_miles: Math.round(km * 0.621371 * 100) / 100,
    distance_nm: Math.round(km * 0.539957 * 100) / 100,
    bearing_degrees: Math.round(deg * 100) / 100,
  }
}, { method: 'calc_distance' })

export { calcDistance }

console.log('settlegrid-distance-calc MCP server ready')
console.log('Methods: calc_distance')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 293: Mexico Weather ────────────────────────────────────────────────────
gen({
  slug: 'mexico-weather',
  title: 'Mexico SMN Weather',
  desc: 'Mexico weather forecasts via Open-Meteo for Mexican coordinates.',
  api: { base: 'https://api.open-meteo.com/v1/forecast', name: 'Open-Meteo', docs: 'https://open-meteo.com/en/docs' },
  key: null,
  keywords: ['weather', 'mexico', 'smn', 'forecast'],
  methods: [
    { name: 'get_mexico_weather', display: 'Get weather for Mexico location', cost: 1, params: 'lat, lon, days?', inputs: [
      { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
      { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      { name: 'days', type: 'number', required: false, desc: 'Forecast days' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-mexico-weather — Mexico SMN Weather MCP Server
 *
 * Wraps Open-Meteo with SettleGrid billing for Mexican forecasts.
 * No API key needed.
 *
 * Methods:
 *   get_mexico_weather(lat, lon, days?) — Mexico weather (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WeatherInput { lat: number; lon: number; days?: number }

const API_BASE = 'https://api.open-meteo.com/v1/forecast'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mexico-weather',
  pricing: { defaultCostCents: 1, methods: { get_mexico_weather: { costCents: 1, displayName: 'Mexico Weather' } } },
})

const getMexicoWeather = sg.wrap(async (args: WeatherInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const days = args.days ?? 7
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,uv_index_max&forecast_days=\${days}&timezone=America/Mexico_City\`)
  return { location: { lat: data.latitude, lon: data.longitude, elevation: data.elevation }, daily: data.daily, units: data.daily_units }
}, { method: 'get_mexico_weather' })

export { getMexicoWeather }

console.log('settlegrid-mexico-weather MCP server ready')
console.log('Methods: get_mexico_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 294: Tennis Data ───────────────────────────────────────────────────────
gen({
  slug: 'tennis-data',
  title: 'Tennis Data',
  desc: 'Tennis player and tournament data from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'tennis', 'players', 'tournaments'],
  methods: [
    { name: 'search_tennis_player', display: 'Search tennis players', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Player name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-tennis-data — Tennis Data MCP Server
 *
 * Wraps TheSportsDB tennis data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tennis_player(name) — search tennis players (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'tennis-data',
  pricing: { defaultCostCents: 1, methods: { search_tennis_player: { costCents: 1, displayName: 'Search Tennis Player' } } },
})

const searchTennisPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/searchplayers.php?p=\${encodeURIComponent(args.name)}\`)
  const tennis = (data.player || []).filter((p: any) => p.strSport === 'Tennis')
  return {
    players: tennis.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      team: p.strTeam, position: p.strPosition, born: p.dateBorn,
      height: p.strHeight, weight: p.strWeight,
      description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_tennis_player' })

export { searchTennisPlayer }

console.log('settlegrid-tennis-data MCP server ready')
console.log('Methods: search_tennis_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 295: Golf Data ─────────────────────────────────────────────────────────
gen({
  slug: 'golf-data',
  title: 'Golf Data',
  desc: 'Golf tournament and player data from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'golf', 'pga', 'tournaments'],
  methods: [
    { name: 'search_golf_player', display: 'Search golf players', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Player name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-golf-data — Golf Data MCP Server
 *
 * Wraps TheSportsDB golf data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_golf_player(name) — search golf players (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlayerInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'golf-data',
  pricing: { defaultCostCents: 1, methods: { search_golf_player: { costCents: 1, displayName: 'Search Golf Player' } } },
})

const searchGolfPlayer = sg.wrap(async (args: PlayerInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/searchplayers.php?p=\${encodeURIComponent(args.name)}\`)
  const golf = (data.player || []).filter((p: any) => p.strSport === 'Golf')
  return {
    players: golf.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      born: p.dateBorn, height: p.strHeight, weight: p.strWeight,
      description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_golf_player' })

export { searchGolfPlayer }

console.log('settlegrid-golf-data MCP server ready')
console.log('Methods: search_golf_player')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

console.log('\\n--- Part 3 (271-295) complete ---\\n')

// ─── 296: Cycling Data ──────────────────────────────────────────────────────
gen({
  slug: 'cycling-data',
  title: 'Cycling Data',
  desc: 'Cycling race and team data from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'cycling', 'tour-de-france', 'racing'],
  methods: [
    { name: 'search_cycling_team', display: 'Search cycling teams', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Team name' },
    ]},
    { name: 'get_cycling_events', display: 'Get upcoming cycling events', cost: 1, params: 'league_id', inputs: [
      { name: 'league_id', type: 'string', required: true, desc: 'Cycling league ID' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-cycling-data — Cycling Data MCP Server
 *
 * Wraps TheSportsDB cycling data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_cycling_team(name) — search teams (1¢)
 *   get_cycling_events(league_id) — cycling events (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }
interface EventInput { league_id: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'cycling-data',
  pricing: { defaultCostCents: 1, methods: { search_cycling_team: { costCents: 1, displayName: 'Search Cycling Team' }, get_cycling_events: { costCents: 1, displayName: 'Cycling Events' } } },
})

const searchCyclingTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/searchteams.php?t=\${encodeURIComponent(args.name)}\`)
  const cycling = (data.teams || []).filter((t: any) => t.strSport === 'Cycling')
  return { teams: cycling.map((t: any) => ({ id: t.idTeam, name: t.strTeam, country: t.strCountry, badge: t.strBadge, description: t.strDescriptionEN?.slice(0, 300) })) }
}, { method: 'search_cycling_team' })

const getCyclingEvents = sg.wrap(async (args: EventInput) => {
  if (!args.league_id) throw new Error('league_id is required')
  const data = await apiFetch<any>(\`/eventsnextleague.php?id=\${args.league_id}\`)
  return { events: (data.events || []).map((e: any) => ({ id: e.idEvent, name: e.strEvent, date: e.dateEvent, venue: e.strVenue, season: e.strSeason })) }
}, { method: 'get_cycling_events' })

export { searchCyclingTeam, getCyclingEvents }

console.log('settlegrid-cycling-data MCP server ready')
console.log('Methods: search_cycling_team, get_cycling_events')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 297: MMA Data ──────────────────────────────────────────────────────────
gen({
  slug: 'mma-data',
  title: 'MMA Fighter Data',
  desc: 'MMA fighter and event data from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'mma', 'ufc', 'fighting'],
  methods: [
    { name: 'search_mma_fighter', display: 'Search MMA fighters', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Fighter name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-mma-data — MMA Fighter Data MCP Server
 *
 * Wraps TheSportsDB MMA data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_mma_fighter(name) — search MMA fighters (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FighterInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'mma-data',
  pricing: { defaultCostCents: 1, methods: { search_mma_fighter: { costCents: 1, displayName: 'Search MMA Fighter' } } },
})

const searchMmaFighter = sg.wrap(async (args: FighterInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/searchplayers.php?p=\${encodeURIComponent(args.name)}\`)
  const mma = (data.player || []).filter((p: any) => p.strSport === 'Fighting' || p.strSport === 'MMA')
  return {
    fighters: mma.map((p: any) => ({
      id: p.idPlayer, name: p.strPlayer, nationality: p.strNationality,
      team: p.strTeam, born: p.dateBorn, height: p.strHeight,
      weight: p.strWeight, description: p.strDescriptionEN?.slice(0, 300),
      thumb: p.strThumb,
    })),
  }
}, { method: 'search_mma_fighter' })

export { searchMmaFighter }

console.log('settlegrid-mma-data MCP server ready')
console.log('Methods: search_mma_fighter')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 298: Rugby Data ────────────────────────────────────────────────────────
gen({
  slug: 'rugby-data',
  title: 'Rugby Data',
  desc: 'Rugby team and match data from TheSportsDB.',
  api: { base: 'https://www.thesportsdb.com/api/v1/json/3', name: 'TheSportsDB', docs: 'https://www.thesportsdb.com/api.php' },
  key: null,
  keywords: ['sports', 'rugby', 'six-nations', 'world-cup'],
  methods: [
    { name: 'search_rugby_team', display: 'Search rugby teams', cost: 1, params: 'name', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Team name' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-rugby-data — Rugby Data MCP Server
 *
 * Wraps TheSportsDB rugby data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_rugby_team(name) — search rugby teams (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TeamInput { name: string }

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'rugby-data',
  pricing: { defaultCostCents: 1, methods: { search_rugby_team: { costCents: 1, displayName: 'Search Rugby Team' } } },
})

const searchRugbyTeam = sg.wrap(async (args: TeamInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any>(\`/searchteams.php?t=\${encodeURIComponent(args.name)}\`)
  const rugby = (data.teams || []).filter((t: any) => t.strSport?.toLowerCase().includes('rugby'))
  return {
    teams: rugby.map((t: any) => ({
      id: t.idTeam, name: t.strTeam, country: t.strCountry,
      league: t.strLeague, stadium: t.strStadium, badge: t.strBadge,
      description: t.strDescriptionEN?.slice(0, 300),
    })),
  }
}, { method: 'search_rugby_team' })

export { searchRugbyTeam }

console.log('settlegrid-rugby-data MCP server ready')
console.log('Methods: search_rugby_team')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 299: Spoonacular Nutrition ─────────────────────────────────────────────
gen({
  slug: 'spoonacular-nutrition',
  title: 'Spoonacular Nutrition',
  desc: 'Recipe search and nutrition analysis from Spoonacular API.',
  api: { base: 'https://api.spoonacular.com', name: 'Spoonacular', docs: 'https://spoonacular.com/food-api/docs' },
  key: { env: 'SPOONACULAR_API_KEY', url: 'https://spoonacular.com/food-api/console#Dashboard', required: true },
  keywords: ['food', 'nutrition', 'recipes', 'diet', 'cooking'],
  methods: [
    { name: 'search_recipes_spoon', display: 'Search recipes', cost: 2, params: 'query, diet?, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Recipe search term' },
      { name: 'diet', type: 'string', required: false, desc: 'Diet filter (vegan, vegetarian, keto, etc.)' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
    { name: 'get_nutrition_info', display: 'Get nutrition for ingredient', cost: 2, params: 'ingredient', inputs: [
      { name: 'ingredient', type: 'string', required: true, desc: 'Ingredient name and amount (e.g. "100g chicken breast")' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-spoonacular-nutrition — Spoonacular Nutrition MCP Server
 *
 * Wraps Spoonacular API with SettleGrid billing.
 * Free key from https://spoonacular.com/food-api/console.
 *
 * Methods:
 *   search_recipes_spoon(query, diet?, limit?) — search recipes (2¢)
 *   get_nutrition_info(ingredient) — nutrition info (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface RecipeInput { query: string; diet?: string; limit?: number }
interface NutritionInput { ingredient: string }

const API_BASE = 'https://api.spoonacular.com'
const API_KEY = process.env.SPOONACULAR_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?'
  const url = \`\${API_BASE}\${path}\${sep}apiKey=\${API_KEY}\`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'spoonacular-nutrition',
  pricing: { defaultCostCents: 2, methods: { search_recipes_spoon: { costCents: 2, displayName: 'Search Recipes' }, get_nutrition_info: { costCents: 2, displayName: 'Nutrition Info' } } },
})

const searchRecipesSpoon = sg.wrap(async (args: RecipeInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('SPOONACULAR_API_KEY not set')
  const limit = args.limit ?? 10
  let path = \`/recipes/complexSearch?query=\${encodeURIComponent(args.query)}&number=\${limit}&addRecipeNutrition=true\`
  if (args.diet) path += \`&diet=\${args.diet}\`
  const data = await apiFetch<any>(path)
  return {
    total: data.totalResults,
    recipes: (data.results || []).map((r: any) => ({
      id: r.id, title: r.title, image: r.image,
      ready_minutes: r.readyInMinutes, servings: r.servings,
      calories: r.nutrition?.nutrients?.find((n: any) => n.name === 'Calories')?.amount,
      protein: r.nutrition?.nutrients?.find((n: any) => n.name === 'Protein')?.amount,
    })),
  }
}, { method: 'search_recipes_spoon' })

const getNutritionInfo = sg.wrap(async (args: NutritionInput) => {
  if (!args.ingredient) throw new Error('ingredient is required')
  if (!API_KEY) throw new Error('SPOONACULAR_API_KEY not set')
  const data = await apiFetch<any>(\`/recipes/parseIngredients?ingredientList=\${encodeURIComponent(args.ingredient)}&servings=1\`)
  const item = Array.isArray(data) ? data[0] : data
  return {
    name: item?.name, amount: item?.amount, unit: item?.unit,
    nutrients: item?.nutrition?.nutrients?.slice(0, 15).map((n: any) => ({
      name: n.name, amount: n.amount, unit: n.unit, daily_pct: n.percentOfDailyNeeds,
    })),
  }
}, { method: 'get_nutrition_info' })

export { searchRecipesSpoon, getNutritionInfo }

console.log('settlegrid-spoonacular-nutrition MCP server ready')
console.log('Methods: search_recipes_spoon, get_nutrition_info')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 300: Crypto Gas Prices ─────────────────────────────────────────────────
gen({
  slug: 'crypto-gas',
  title: 'Crypto Gas Prices',
  desc: 'Ethereum and L2 gas price data from Blocknative and public RPCs.',
  api: { base: 'https://api.blocknative.com/gasprices/blockprices', name: 'Blocknative', docs: 'https://docs.blocknative.com/gas-platform' },
  key: null,
  keywords: ['crypto', 'gas', 'ethereum', 'fees', 'blockchain'],
  methods: [
    { name: 'get_eth_gas', display: 'Get current Ethereum gas prices', cost: 1, params: '', inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-crypto-gas — Crypto Gas Prices MCP Server
 *
 * Fetches Ethereum gas prices with SettleGrid billing.
 * No API key needed for basic endpoint.
 *
 * Methods:
 *   get_eth_gas() — Ethereum gas prices (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

const API_BASE = 'https://api.blocknative.com/gasprices/blockprices'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'crypto-gas',
  pricing: { defaultCostCents: 1, methods: { get_eth_gas: { costCents: 1, displayName: 'ETH Gas Prices' } } },
})

const getEthGas = sg.wrap(async () => {
  const data = await apiFetch<any>(API_BASE)
  const block = data.blockPrices?.[0]
  return {
    block_number: block?.blockNumber,
    base_fee_gwei: block?.baseFeePerGas,
    estimated_prices: block?.estimatedPrices?.map((p: any) => ({
      confidence: p.confidence,
      price_gwei: p.price,
      max_priority_fee: p.maxPriorityFeePerGas,
      max_fee: p.maxFeePerGas,
    })),
    system: data.system,
    unit: data.unit,
  }
}, { method: 'get_eth_gas' })

export { getEthGas }

console.log('settlegrid-crypto-gas MCP server ready')
console.log('Methods: get_eth_gas')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 301: SEC Company Filings ───────────────────────────────────────────────
gen({
  slug: 'sec-filings',
  title: 'SEC Company Filings',
  desc: 'SEC EDGAR company filings and financial disclosures.',
  api: { base: 'https://efts.sec.gov/LATEST/search-index?q=', name: 'SEC EDGAR', docs: 'https://efts.sec.gov/LATEST/search-index?q=&dateRange=custom' },
  key: null,
  keywords: ['legal', 'sec', 'filings', 'financial', '10-K', '10-Q'],
  methods: [
    { name: 'search_sec_filings', display: 'Search SEC filings', cost: 1, params: 'query, form_type?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Company name or ticker' },
      { name: 'form_type', type: 'string', required: false, desc: 'Form type (10-K, 10-Q, 8-K, etc.)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-sec-filings — SEC Company Filings MCP Server
 *
 * Wraps SEC EDGAR full-text search with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_sec_filings(query, form_type?) — search filings (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FilingInput { query: string; form_type?: string }

const API_BASE = 'https://efts.sec.gov/LATEST/search-index'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'User-Agent': 'SettleGrid-MCP/1.0 contact@settlegrid.ai', 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'sec-filings',
  pricing: { defaultCostCents: 1, methods: { search_sec_filings: { costCents: 1, displayName: 'Search Filings' } } },
})

const searchSecFilings = sg.wrap(async (args: FilingInput) => {
  if (!args.query) throw new Error('query is required')
  let url = \`https://efts.sec.gov/LATEST/search-index?q=\${encodeURIComponent(args.query)}&dateRange=custom&startdt=2020-01-01\`
  if (args.form_type) url += \`&forms=\${args.form_type}\`
  const data = await apiFetch<any>(url)
  return {
    total: data.hits?.total?.value || 0,
    filings: (data.hits?.hits || []).slice(0, 20).map((h: any) => ({
      entity_name: h._source?.entity_name,
      file_date: h._source?.file_date,
      form_type: h._source?.form_type,
      file_num: h._source?.file_num,
      period: h._source?.period_of_report,
    })),
  }
}, { method: 'search_sec_filings' })

export { searchSecFilings }

console.log('settlegrid-sec-filings MCP server ready')
console.log('Methods: search_sec_filings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 302: Trademark Search ──────────────────────────────────────────────────
gen({
  slug: 'trademark-data',
  title: 'Trademark Data',
  desc: 'USPTO trademark search and registration data.',
  api: { base: 'https://tsdr.uspto.gov/documentxml', name: 'USPTO TSDR', docs: 'https://developer.uspto.gov/' },
  key: null,
  keywords: ['legal', 'trademark', 'ip', 'brand'],
  methods: [
    { name: 'search_trademarks', display: 'Search USPTO trademarks', cost: 1, params: 'query', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Trademark term or serial number' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-trademark-data — Trademark Data MCP Server
 *
 * Wraps USPTO trademark endpoints with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_trademarks(query) — search trademarks (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'trademark-data',
  pricing: { defaultCostCents: 1, methods: { search_trademarks: { costCents: 1, displayName: 'Search Trademarks' } } },
})

const searchTrademarks = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const url = \`https://tsdr.uspto.gov/documentxml?searchTerm=\${encodeURIComponent(args.query)}\`
  try {
    const data = await apiFetch<any>(url)
    return { query: args.query, results: data }
  } catch {
    return {
      query: args.query,
      note: 'USPTO TSDR may require specific serial number format. Try with a serial number like 97123456.',
      search_url: \`https://tmsearch.uspto.gov/bin/gate.exe?f=login&p_lang=english&p_d=trmk\`,
    }
  }
}, { method: 'search_trademarks' })

export { searchTrademarks }

console.log('settlegrid-trademark-data MCP server ready')
console.log('Methods: search_trademarks')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 303: OSHA Data ─────────────────────────────────────────────────────────
gen({
  slug: 'osha-data',
  title: 'OSHA Inspection Data',
  desc: 'OSHA workplace safety inspection data from the DOL API.',
  api: { base: 'https://data.dol.gov/get/inspection', name: 'DOL OSHA', docs: 'https://developer.dol.gov/' },
  key: null,
  keywords: ['legal', 'osha', 'safety', 'workplace', 'inspections'],
  methods: [
    { name: 'search_osha_inspections', display: 'Search OSHA inspections', cost: 1, params: 'establishment?, state?', inputs: [
      { name: 'establishment', type: 'string', required: false, desc: 'Establishment name' },
      { name: 'state', type: 'string', required: false, desc: 'State code (e.g. CA, TX)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-osha-data — OSHA Inspection Data MCP Server
 *
 * Wraps DOL OSHA API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_osha_inspections(establishment?, state?) — search inspections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface InspInput { establishment?: string; state?: string }

const API_BASE = 'https://data.dol.gov/get'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'osha-data',
  pricing: { defaultCostCents: 1, methods: { search_osha_inspections: { costCents: 1, displayName: 'Search Inspections' } } },
})

const searchOshaInspections = sg.wrap(async (args: InspInput) => {
  let filters: string[] = []
  if (args.establishment) filters.push(\`estab_name=\${encodeURIComponent(args.establishment)}\`)
  if (args.state) filters.push(\`site_state=\${args.state.toUpperCase()}\`)
  const query = filters.length ? \`?\${filters.join('&')}&limit=20\` : '?limit=20'
  const data = await apiFetch<any>(\`/inspection\${query}\`)
  const results = Array.isArray(data) ? data : data.results || []
  return {
    inspections: results.slice(0, 20).map((r: any) => ({
      activity_nr: r.activity_nr, estab_name: r.estab_name,
      site_city: r.site_city, site_state: r.site_state,
      open_date: r.open_date, close_case_date: r.close_case_date,
      sic_code: r.sic_code, insp_type: r.insp_type,
    })),
  }
}, { method: 'search_osha_inspections' })

export { searchOshaInspections }

console.log('settlegrid-osha-data MCP server ready')
console.log('Methods: search_osha_inspections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 304: Geocoding ─────────────────────────────────────────────────────────
gen({
  slug: 'geocoding-api',
  title: 'Geocoding API',
  desc: 'Forward and reverse geocoding via Open-Meteo Geocoding API.',
  api: { base: 'https://geocoding-api.open-meteo.com/v1', name: 'Open-Meteo Geocoding', docs: 'https://open-meteo.com/en/docs/geocoding-api' },
  key: null,
  keywords: ['misc', 'geocoding', 'coordinates', 'address', 'location'],
  methods: [
    { name: 'geocode_location', display: 'Geocode a place name to coordinates', cost: 1, params: 'name, limit?', inputs: [
      { name: 'name', type: 'string', required: true, desc: 'Place name or city' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 5)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-geocoding-api — Geocoding API MCP Server
 *
 * Wraps Open-Meteo Geocoding API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   geocode_location(name, limit?) — geocode place (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GeoInput { name: string; limit?: number }

const API_BASE = 'https://geocoding-api.open-meteo.com/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'geocoding-api',
  pricing: { defaultCostCents: 1, methods: { geocode_location: { costCents: 1, displayName: 'Geocode Location' } } },
})

const geocodeLocation = sg.wrap(async (args: GeoInput) => {
  if (!args.name) throw new Error('name is required')
  const limit = args.limit ?? 5
  const data = await apiFetch<any>(\`/search?name=\${encodeURIComponent(args.name)}&count=\${limit}&language=en\`)
  return {
    results: (data.results || []).map((r: any) => ({
      name: r.name, latitude: r.latitude, longitude: r.longitude,
      country: r.country, country_code: r.country_code,
      admin1: r.admin1, admin2: r.admin2,
      elevation: r.elevation, timezone: r.timezone,
      population: r.population,
    })),
  }
}, { method: 'geocode_location' })

export { geocodeLocation }

console.log('settlegrid-geocoding-api MCP server ready')
console.log('Methods: geocode_location')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 305: Color Palette ─────────────────────────────────────────────────────
gen({
  slug: 'color-palette',
  title: 'Color Palette',
  desc: 'Color conversion, palette generation, and color info from TheColorAPI.',
  api: { base: 'https://www.thecolorapi.com', name: 'TheColorAPI', docs: 'https://www.thecolorapi.com/docs' },
  key: null,
  keywords: ['misc', 'colors', 'design', 'palette', 'hex'],
  methods: [
    { name: 'get_color_info', display: 'Get info for a color', cost: 1, params: 'hex', inputs: [
      { name: 'hex', type: 'string', required: true, desc: 'Hex color code (e.g. FF5733)' },
    ]},
    { name: 'get_color_scheme', display: 'Generate a color scheme', cost: 1, params: 'hex, mode?, count?', inputs: [
      { name: 'hex', type: 'string', required: true, desc: 'Base hex color' },
      { name: 'mode', type: 'string', required: false, desc: 'Mode: analogic, complement, triad, quad (default complement)' },
      { name: 'count', type: 'number', required: false, desc: 'Number of colors (default 5)' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-color-palette — Color Palette MCP Server
 *
 * Wraps TheColorAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_color_info(hex) — color info (1¢)
 *   get_color_scheme(hex, mode?, count?) — color scheme (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ColorInput { hex: string }
interface SchemeInput { hex: string; mode?: string; count?: number }

const API_BASE = 'https://www.thecolorapi.com'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'color-palette',
  pricing: { defaultCostCents: 1, methods: { get_color_info: { costCents: 1, displayName: 'Color Info' }, get_color_scheme: { costCents: 1, displayName: 'Color Scheme' } } },
})

const getColorInfo = sg.wrap(async (args: ColorInput) => {
  if (!args.hex) throw new Error('hex is required')
  const hex = args.hex.replace('#', '')
  const data = await apiFetch<any>(\`/id?hex=\${hex}\`)
  return {
    hex: data.hex?.value, rgb: data.rgb?.value, hsl: data.hsl?.value,
    name: data.name?.value, exact_match: data.name?.exact_match_named_color,
    closest_named: data.name?.closest_named_hex,
    cmyk: data.cmyk?.value, hsv: data.hsv?.value,
  }
}, { method: 'get_color_info' })

const getColorScheme = sg.wrap(async (args: SchemeInput) => {
  if (!args.hex) throw new Error('hex is required')
  const hex = args.hex.replace('#', '')
  const mode = args.mode || 'complement'
  const count = args.count ?? 5
  const data = await apiFetch<any>(\`/scheme?hex=\${hex}&mode=\${mode}&count=\${count}\`)
  return {
    mode, seed: data.seed?.hex?.value,
    colors: (data.colors || []).map((c: any) => ({
      hex: c.hex?.value, rgb: c.rgb?.value, name: c.name?.value,
    })),
  }
}, { method: 'get_color_scheme' })

export { getColorInfo, getColorScheme }

console.log('settlegrid-color-palette MCP server ready')
console.log('Methods: get_color_info, get_color_scheme')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 306: Bored API ─────────────────────────────────────────────────────────
gen({
  slug: 'bored-api',
  title: 'Bored Activity',
  desc: 'Random activity suggestions when bored from Bored API.',
  api: { base: 'https://bored-api.appbrewery.com/api', name: 'Bored API', docs: 'https://bored-api.appbrewery.com/' },
  key: null,
  keywords: ['misc', 'activities', 'boredom', 'suggestions', 'fun'],
  methods: [
    { name: 'get_activity', display: 'Get a random activity suggestion', cost: 1, params: 'type?, participants?', inputs: [
      { name: 'type', type: 'string', required: false, desc: 'Type: education, recreational, social, diy, charity, cooking, relaxation, music, busywork' },
      { name: 'participants', type: 'number', required: false, desc: 'Number of participants' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-bored-api — Bored Activity MCP Server
 *
 * Wraps Bored API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_activity(type?, participants?) — random activity (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ActivityInput { type?: string; participants?: number }

const API_BASE = 'https://bored-api.appbrewery.com/api'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'bored-api',
  pricing: { defaultCostCents: 1, methods: { get_activity: { costCents: 1, displayName: 'Get Activity' } } },
})

const getActivity = sg.wrap(async (args: ActivityInput) => {
  let params: string[] = []
  if (args.type) params.push(\`type=\${args.type}\`)
  if (args.participants) params.push(\`participants=\${args.participants}\`)
  const query = params.length ? \`?\${params.join('&')}\` : ''
  const data = await apiFetch<any>(\`/activity\${query}\`)
  return {
    activity: data.activity, type: data.type, participants: data.participants,
    price: data.price, accessibility: data.accessibility, key: data.key,
  }
}, { method: 'get_activity' })

export { getActivity }

console.log('settlegrid-bored-api MCP server ready')
console.log('Methods: get_activity')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 307: Exchange Rate Conversion ──────────────────────────────────────────
gen({
  slug: 'currency-convert',
  title: 'Currency Converter',
  desc: 'Currency conversion with live exchange rates from ExchangeRate-API.',
  api: { base: 'https://open.er-api.com/v6', name: 'ExchangeRate-API', docs: 'https://www.exchangerate-api.com/docs/free' },
  key: null,
  keywords: ['misc', 'currency', 'exchange-rate', 'conversion', 'forex'],
  methods: [
    { name: 'convert_currency', display: 'Convert between currencies', cost: 1, params: 'from, to, amount', inputs: [
      { name: 'from', type: 'string', required: true, desc: 'Source currency (e.g. USD)' },
      { name: 'to', type: 'string', required: true, desc: 'Target currency (e.g. EUR)' },
      { name: 'amount', type: 'number', required: true, desc: 'Amount to convert' },
    ]},
    { name: 'list_exchange_rates', display: 'List all rates for a currency', cost: 1, params: 'base', inputs: [
      { name: 'base', type: 'string', required: true, desc: 'Base currency code' },
    ]},
  ],
  serverTs: `/**
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
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'currency-convert',
  pricing: { defaultCostCents: 1, methods: { convert_currency: { costCents: 1, displayName: 'Convert Currency' }, list_exchange_rates: { costCents: 1, displayName: 'Exchange Rates' } } },
})

const convertCurrency = sg.wrap(async (args: ConvertInput) => {
  if (!args.from || !args.to || typeof args.amount !== 'number') throw new Error('from, to, and amount are required')
  const data = await apiFetch<any>(\`/latest/\${args.from.toUpperCase()}\`)
  if (data.result !== 'success') throw new Error('Failed to fetch rates')
  const rate = data.rates?.[args.to.toUpperCase()]
  if (!rate) throw new Error(\`Currency \${args.to} not found\`)
  return {
    from: args.from.toUpperCase(), to: args.to.toUpperCase(),
    amount: args.amount, rate, converted: Math.round(args.amount * rate * 100) / 100,
    last_updated: data.time_last_update_utc,
  }
}, { method: 'convert_currency' })

const listExchangeRates = sg.wrap(async (args: RatesInput) => {
  if (!args.base) throw new Error('base currency is required')
  const data = await apiFetch<any>(\`/latest/\${args.base.toUpperCase()}\`)
  if (data.result !== 'success') throw new Error('Failed to fetch rates')
  return { base: args.base.toUpperCase(), last_updated: data.time_last_update_utc, rates: data.rates }
}, { method: 'list_exchange_rates' })

export { convertCurrency, listExchangeRates }

console.log('settlegrid-currency-convert MCP server ready')
console.log('Methods: convert_currency, list_exchange_rates')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 308: Markdown Converter ────────────────────────────────────────────────
gen({
  slug: 'markdown-tools',
  title: 'Markdown Tools',
  desc: 'Convert markdown to HTML and extract headings/links — local processing.',
  api: { base: 'https://local', name: 'Local Processing', docs: 'https://daringfireball.net/projects/markdown/' },
  key: null,
  keywords: ['utility', 'markdown', 'html', 'converter', 'parser'],
  methods: [
    { name: 'md_to_html', display: 'Convert markdown to HTML', cost: 1, params: 'markdown', inputs: [
      { name: 'markdown', type: 'string', required: true, desc: 'Markdown text' },
    ]},
    { name: 'extract_md_links', display: 'Extract links from markdown', cost: 1, params: 'markdown', inputs: [
      { name: 'markdown', type: 'string', required: true, desc: 'Markdown text' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-markdown-tools — Markdown Tools MCP Server
 *
 * Converts markdown locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   md_to_html(markdown) — convert to HTML (1¢)
 *   extract_md_links(markdown) — extract links (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface MdInput { markdown: string }

const sg = settlegrid.init({
  toolSlug: 'markdown-tools',
  pricing: { defaultCostCents: 1, methods: { md_to_html: { costCents: 1, displayName: 'MD to HTML' }, extract_md_links: { costCents: 1, displayName: 'Extract Links' } } },
})

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code>$1</code>')
    .replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[hla]|<li)(.+)$/gm, '<p>$1</p>')
    .replace(/\\n\\n/g, '\\n')
}

const mdToHtml = sg.wrap(async (args: MdInput) => {
  if (!args.markdown) throw new Error('markdown is required')
  const html = simpleMarkdownToHtml(args.markdown)
  return { html, input_length: args.markdown.length, output_length: html.length }
}, { method: 'md_to_html' })

const extractMdLinks = sg.wrap(async (args: MdInput) => {
  if (!args.markdown) throw new Error('markdown is required')
  const linkRegex = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g
  const links: Array<{ text: string; url: string }> = []
  let match
  while ((match = linkRegex.exec(args.markdown)) !== null) {
    links.push({ text: match[1], url: match[2] })
  }
  const headingRegex = /^(#{1,6})\\s+(.+)$/gm
  const headings: Array<{ level: number; text: string }> = []
  while ((match = headingRegex.exec(args.markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2] })
  }
  return { links, headings, link_count: links.length, heading_count: headings.length }
}, { method: 'extract_md_links' })

export { mdToHtml, extractMdLinks }

console.log('settlegrid-markdown-tools MCP server ready')
console.log('Methods: md_to_html, extract_md_links')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 309: JSON Validator ────────────────────────────────────────────────────
gen({
  slug: 'json-validator',
  title: 'JSON Validator',
  desc: 'Validate, format, and minify JSON — local processing.',
  api: { base: 'https://local', name: 'Local Processing', docs: 'https://json.org/' },
  key: null,
  keywords: ['utility', 'json', 'validator', 'formatter', 'minify'],
  methods: [
    { name: 'validate_json', display: 'Validate and format JSON', cost: 1, params: 'json', inputs: [
      { name: 'json', type: 'string', required: true, desc: 'JSON string to validate' },
    ]},
    { name: 'minify_json', display: 'Minify JSON', cost: 1, params: 'json', inputs: [
      { name: 'json', type: 'string', required: true, desc: 'JSON string to minify' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-json-validator — JSON Validator MCP Server
 *
 * Validates and formats JSON locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   validate_json(json) — validate and format (1¢)
 *   minify_json(json) — minify JSON (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface JsonInput { json: string }

const sg = settlegrid.init({
  toolSlug: 'json-validator',
  pricing: { defaultCostCents: 1, methods: { validate_json: { costCents: 1, displayName: 'Validate JSON' }, minify_json: { costCents: 1, displayName: 'Minify JSON' } } },
})

const validateJson = sg.wrap(async (args: JsonInput) => {
  if (!args.json) throw new Error('json is required')
  try {
    const parsed = JSON.parse(args.json)
    const formatted = JSON.stringify(parsed, null, 2)
    const type = Array.isArray(parsed) ? 'array' : typeof parsed
    const keys = type === 'object' ? Object.keys(parsed) : undefined
    return { valid: true, type, key_count: keys?.length, formatted, original_length: args.json.length, formatted_length: formatted.length }
  } catch (e: any) {
    return { valid: false, error: e.message, position: e.message.match(/position (\\d+)/)?.[1] }
  }
}, { method: 'validate_json' })

const minifyJson = sg.wrap(async (args: JsonInput) => {
  if (!args.json) throw new Error('json is required')
  try {
    const parsed = JSON.parse(args.json)
    const minified = JSON.stringify(parsed)
    return { valid: true, minified, original_length: args.json.length, minified_length: minified.length, savings_pct: Math.round((1 - minified.length / args.json.length) * 100) }
  } catch (e: any) {
    throw new Error(\`Invalid JSON: \${e.message}\`)
  }
}, { method: 'minify_json' })

export { validateJson, minifyJson }

console.log('settlegrid-json-validator MCP server ready')
console.log('Methods: validate_json, minify_json')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
})

// ─── 310: Pexels Photos ─────────────────────────────────────────────────────
gen({
  slug: 'pexels-photos',
  title: 'Pexels Photos',
  desc: 'Free stock photos search from Pexels API.',
  api: { base: 'https://api.pexels.com/v1', name: 'Pexels', docs: 'https://www.pexels.com/api/documentation/' },
  key: { env: 'PEXELS_API_KEY', url: 'https://www.pexels.com/api/', required: true },
  keywords: ['photography', 'images', 'stock-photos', 'pexels'],
  methods: [
    { name: 'search_pexels', display: 'Search Pexels photos', cost: 2, params: 'query, limit?', inputs: [
      { name: 'query', type: 'string', required: true, desc: 'Search term' },
      { name: 'limit', type: 'number', required: false, desc: 'Max results (default 15)' },
    ]},
    { name: 'get_curated', display: 'Get curated photos', cost: 2, params: 'limit?', inputs: [
      { name: 'limit', type: 'number', required: false, desc: 'Max results' },
    ]},
  ],
  serverTs: `/**
 * settlegrid-pexels-photos — Pexels Photos MCP Server
 *
 * Wraps Pexels API with SettleGrid billing.
 * Free key from https://www.pexels.com/api/.
 *
 * Methods:
 *   search_pexels(query, limit?) — search photos (2¢)
 *   get_curated(limit?) — curated photos (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; limit?: number }
interface CuratedInput { limit?: number }

const API_BASE = 'https://api.pexels.com/v1'
const API_KEY = process.env.PEXELS_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, { headers: { 'Authorization': API_KEY } })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'pexels-photos',
  pricing: { defaultCostCents: 2, methods: { search_pexels: { costCents: 2, displayName: 'Search Photos' }, get_curated: { costCents: 2, displayName: 'Curated Photos' } } },
})

const searchPexels = sg.wrap(async (args: SearchInput) => {
  if (!API_KEY) throw new Error('PEXELS_API_KEY not set')
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 15
  const data = await apiFetch<any>(\`/search?query=\${encodeURIComponent(args.query)}&per_page=\${limit}\`)
  return {
    total: data.total_results,
    photos: (data.photos || []).map((p: any) => ({
      id: p.id, photographer: p.photographer, alt: p.alt,
      width: p.width, height: p.height,
      src: { original: p.src?.original, medium: p.src?.medium, small: p.src?.small },
      url: p.url,
    })),
  }
}, { method: 'search_pexels' })

const getCurated = sg.wrap(async (args: CuratedInput) => {
  if (!API_KEY) throw new Error('PEXELS_API_KEY not set')
  const limit = args.limit ?? 15
  const data = await apiFetch<any>(\`/curated?per_page=\${limit}\`)
  return {
    photos: (data.photos || []).map((p: any) => ({
      id: p.id, photographer: p.photographer, alt: p.alt,
      src: { medium: p.src?.medium, small: p.src?.small },
    })),
  }
}, { method: 'get_curated' })

export { searchPexels, getCurated }

console.log('settlegrid-pexels-photos MCP server ready')
console.log('Methods: search_pexels, get_curated')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`
})

// ─── 311-315: More compact servers ──────────────────────────────────────────

// 311: Historical Weather
gen({ slug: 'historical-weather', title: 'Historical Weather', desc: 'Historical weather data via Open-Meteo Archive API.', api: { base: 'https://archive-api.open-meteo.com/v1/archive', name: 'Open-Meteo Archive', docs: 'https://open-meteo.com/en/docs/historical-weather-api' }, key: null, keywords: ['weather', 'historical', 'archive', 'climate'], methods: [{ name: 'get_historical_weather', display: 'Get historical weather data', cost: 1, params: 'lat, lon, start_date, end_date', inputs: [{ name: 'lat', type: 'number', required: true, desc: 'Latitude' }, { name: 'lon', type: 'number', required: true, desc: 'Longitude' }, { name: 'start_date', type: 'string', required: true, desc: 'Start date (YYYY-MM-DD)' }, { name: 'end_date', type: 'string', required: true, desc: 'End date (YYYY-MM-DD)' }] }],
  serverTs: `/**
 * settlegrid-historical-weather — Historical Weather MCP Server
 *
 * Wraps Open-Meteo Archive API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_historical_weather(lat, lon, start_date, end_date) — historical data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HistInput { lat: number; lon: number; start_date: string; end_date: string }

const API_BASE = 'https://archive-api.open-meteo.com/v1/archive'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'historical-weather',
  pricing: { defaultCostCents: 1, methods: { get_historical_weather: { costCents: 1, displayName: 'Historical Weather' } } },
})

const getHistoricalWeather = sg.wrap(async (args: HistInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  if (!args.start_date || !args.end_date) throw new Error('start_date and end_date required')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&start_date=\${args.start_date}&end_date=\${args.end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_historical_weather' })

export { getHistoricalWeather }

console.log('settlegrid-historical-weather MCP server ready')
console.log('Methods: get_historical_weather')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 312: Flood Data
gen({ slug: 'flood-data', title: 'Flood Monitoring', desc: 'Global flood monitoring data via Open-Meteo Flood API.', api: { base: 'https://flood-api.open-meteo.com/v1/flood', name: 'Open-Meteo Flood', docs: 'https://open-meteo.com/en/docs/flood-api' }, key: null, keywords: ['weather', 'flood', 'disaster', 'rivers'], methods: [{ name: 'get_flood_forecast', display: 'Get river flood forecast', cost: 1, params: 'lat, lon', inputs: [{ name: 'lat', type: 'number', required: true, desc: 'Latitude' }, { name: 'lon', type: 'number', required: true, desc: 'Longitude' }] }],
  serverTs: `/**
 * settlegrid-flood-data — Flood Monitoring MCP Server
 *
 * Wraps Open-Meteo Flood API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flood_forecast(lat, lon) — flood forecast (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FloodInput { lat: number; lon: number }

const API_BASE = 'https://flood-api.open-meteo.com/v1/flood'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'flood-data',
  pricing: { defaultCostCents: 1, methods: { get_flood_forecast: { costCents: 1, displayName: 'Flood Forecast' } } },
})

const getFloodForecast = sg.wrap(async (args: FloodInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&daily=river_discharge,river_discharge_mean,river_discharge_max\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, units: data.daily_units }
}, { method: 'get_flood_forecast' })

export { getFloodForecast }

console.log('settlegrid-flood-data MCP server ready')
console.log('Methods: get_flood_forecast')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 313: Open Meteo Climate
gen({ slug: 'climate-projection', title: 'Climate Projections', desc: 'Climate change projections from CMIP6 via Open-Meteo.', api: { base: 'https://climate-api.open-meteo.com/v1/climate', name: 'Open-Meteo Climate', docs: 'https://open-meteo.com/en/docs/climate-api' }, key: null, keywords: ['sustainability', 'climate', 'projections', 'cmip6'], methods: [{ name: 'get_climate_projection', display: 'Get climate projections', cost: 1, params: 'lat, lon, start_date, end_date', inputs: [{ name: 'lat', type: 'number', required: true, desc: 'Latitude' }, { name: 'lon', type: 'number', required: true, desc: 'Longitude' }, { name: 'start_date', type: 'string', required: true, desc: 'Start date (YYYY-MM-DD)' }, { name: 'end_date', type: 'string', required: true, desc: 'End date (YYYY-MM-DD)' }] }],
  serverTs: `/**
 * settlegrid-climate-projection — Climate Projections MCP Server
 *
 * Wraps Open-Meteo Climate API (CMIP6) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_climate_projection(lat, lon, start_date, end_date) — projections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ClimInput { lat: number; lon: number; start_date: string; end_date: string }

const API_BASE = 'https://climate-api.open-meteo.com/v1/climate'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'climate-projection',
  pricing: { defaultCostCents: 1, methods: { get_climate_projection: { costCents: 1, displayName: 'Climate Projection' } } },
})

const getClimateProjection = sg.wrap(async (args: ClimInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') throw new Error('lat and lon required')
  if (!args.start_date || !args.end_date) throw new Error('start_date and end_date required')
  const data = await apiFetch<any>(\`?latitude=\${args.lat}&longitude=\${args.lon}&start_date=\${args.start_date}&end_date=\${args.end_date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&models=EC_Earth3P_HR\`)
  return { location: { lat: data.latitude, lon: data.longitude }, daily: data.daily, model: 'EC_Earth3P_HR' }
}, { method: 'get_climate_projection' })

export { getClimateProjection }

console.log('settlegrid-climate-projection MCP server ready')
console.log('Methods: get_climate_projection')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 314: Country Flags
gen({ slug: 'country-flag-api', title: 'Country Flags API', desc: 'Country flag images and emoji flags from Flagcdn.', api: { base: 'https://flagcdn.com', name: 'Flagcdn', docs: 'https://flagcdn.com/' }, key: null, keywords: ['travel', 'flags', 'countries', 'images'], methods: [{ name: 'get_flag_url', display: 'Get country flag URL', cost: 1, params: 'country_code, size?', inputs: [{ name: 'country_code', type: 'string', required: true, desc: 'ISO 3166-1 alpha-2 code (e.g. US, GB, JP)' }, { name: 'size', type: 'number', required: false, desc: 'Width in pixels (default 256)' }] }],
  serverTs: `/**
 * settlegrid-country-flag-api — Country Flags API MCP Server
 *
 * Provides country flag URLs with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flag_url(country_code, size?) — flag URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface FlagInput { country_code: string; size?: number }

const sg = settlegrid.init({
  toolSlug: 'country-flag-api',
  pricing: { defaultCostCents: 1, methods: { get_flag_url: { costCents: 1, displayName: 'Get Flag URL' } } },
})

const getFlagUrl = sg.wrap(async (args: FlagInput) => {
  if (!args.country_code) throw new Error('country_code is required')
  const code = args.country_code.toLowerCase()
  const size = args.size ?? 256
  const codePoints = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  const emoji = String.fromCodePoint(...codePoints)
  return {
    country_code: code.toUpperCase(),
    flag_png: \`https://flagcdn.com/w\${size}/\${code}.png\`,
    flag_svg: \`https://flagcdn.com/\${code}.svg\`,
    flag_emoji: emoji,
    sizes_available: [20, 40, 80, 160, 256, 320, 640, 1280, 2560],
  }
}, { method: 'get_flag_url' })

export { getFlagUrl }

console.log('settlegrid-country-flag-api MCP server ready')
console.log('Methods: get_flag_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 315: ISBN Lookup
gen({ slug: 'isbn-lookup', title: 'ISBN Lookup', desc: 'Book lookup by ISBN from Open Library.', api: { base: 'https://openlibrary.org/isbn', name: 'Open Library', docs: 'https://openlibrary.org/dev/docs/api/books' }, key: null, keywords: ['misc', 'isbn', 'books', 'lookup'], methods: [{ name: 'lookup_isbn', display: 'Look up book by ISBN', cost: 1, params: 'isbn', inputs: [{ name: 'isbn', type: 'string', required: true, desc: 'ISBN-10 or ISBN-13' }] }],
  serverTs: `/**
 * settlegrid-isbn-lookup — ISBN Lookup MCP Server
 *
 * Wraps Open Library ISBN endpoint with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   lookup_isbn(isbn) — book by ISBN (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface IsbnInput { isbn: string }

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'isbn-lookup',
  pricing: { defaultCostCents: 1, methods: { lookup_isbn: { costCents: 1, displayName: 'Lookup ISBN' } } },
})

const lookupIsbn = sg.wrap(async (args: IsbnInput) => {
  if (!args.isbn) throw new Error('isbn is required')
  const data = await apiFetch<any>(\`https://openlibrary.org/isbn/\${args.isbn}.json\`)
  return {
    title: data.title, publishers: data.publishers, publish_date: data.publish_date,
    pages: data.number_of_pages, isbn_10: data.isbn_10, isbn_13: data.isbn_13,
    subjects: data.subjects?.slice(0, 10), key: data.key,
    covers: data.covers?.map((id: number) => \`https://covers.openlibrary.org/b/id/\${id}-M.jpg\`),
  }
}, { method: 'lookup_isbn' })

export { lookupIsbn }

console.log('settlegrid-isbn-lookup MCP server ready')
console.log('Methods: lookup_isbn')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// ─── 316-330: Final 15 compact servers ──────────────────────────────────────

// 316: LanguageTool Grammar
gen({ slug: 'grammar-check', title: 'Grammar Check', desc: 'Grammar and spell checking via LanguageTool API.', api: { base: 'https://api.languagetool.org/v2', name: 'LanguageTool', docs: 'https://languagetool.org/http-api/' }, key: null, keywords: ['language', 'grammar', 'spell-check', 'writing'], methods: [{ name: 'check_grammar', display: 'Check text for grammar errors', cost: 1, params: 'text, language?', inputs: [{ name: 'text', type: 'string', required: true, desc: 'Text to check' }, { name: 'language', type: 'string', required: false, desc: 'Language code (default en-US)' }] }],
  serverTs: `/**
 * settlegrid-grammar-check — Grammar Check MCP Server
 *
 * Wraps LanguageTool API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   check_grammar(text, language?) — grammar check (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GrammarInput { text: string; language?: string }

const API_BASE = 'https://api.languagetool.org/v2'

const sg = settlegrid.init({
  toolSlug: 'grammar-check',
  pricing: { defaultCostCents: 1, methods: { check_grammar: { costCents: 1, displayName: 'Check Grammar' } } },
})

const checkGrammar = sg.wrap(async (args: GrammarInput) => {
  if (!args.text) throw new Error('text is required')
  const lang = args.language || 'en-US'
  const res = await fetch(\`\${API_BASE}/check\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: \`text=\${encodeURIComponent(args.text)}&language=\${lang}\`,
  })
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  const data = await res.json() as any
  return {
    language: data.language?.name,
    issues: (data.matches || []).map((m: any) => ({
      message: m.message, offset: m.offset, length: m.length,
      rule: m.rule?.id, category: m.rule?.category?.name,
      replacements: m.replacements?.slice(0, 3).map((r: any) => r.value),
      context: m.context?.text,
    })),
    issue_count: data.matches?.length || 0,
  }
}, { method: 'check_grammar' })

export { checkGrammar }

console.log('settlegrid-grammar-check MCP server ready')
console.log('Methods: check_grammar')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 317: IP Whois
gen({ slug: 'ip-whois', title: 'IP Whois Lookup', desc: 'IP address WHOIS data from ipwhois.io.', api: { base: 'https://ipwhois.app/json', name: 'ipwhois.app', docs: 'https://ipwhois.io/documentation' }, key: null, keywords: ['utility', 'ip', 'whois', 'network'], methods: [{ name: 'whois_ip', display: 'Get IP WHOIS info', cost: 1, params: 'ip', inputs: [{ name: 'ip', type: 'string', required: true, desc: 'IP address' }] }],
  serverTs: `/**
 * settlegrid-ip-whois — IP Whois Lookup MCP Server
 *
 * Wraps ipwhois.app API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   whois_ip(ip) — IP WHOIS info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface WhoisInput { ip: string }

const sg = settlegrid.init({
  toolSlug: 'ip-whois',
  pricing: { defaultCostCents: 1, methods: { whois_ip: { costCents: 1, displayName: 'WHOIS IP' } } },
})

const whoisIp = sg.wrap(async (args: WhoisInput) => {
  if (!args.ip) throw new Error('ip is required')
  const res = await fetch(\`https://ipwhois.app/json/\${args.ip}\`)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  const data = await res.json() as any
  return {
    ip: data.ip, type: data.type, country: data.country, country_code: data.country_code,
    region: data.region, city: data.city, latitude: data.latitude, longitude: data.longitude,
    isp: data.isp, org: data.org, asn: data.asn, timezone: data.timezone,
    currency: data.currency, currency_code: data.currency_code,
  }
}, { method: 'whois_ip' })

export { whoisIp }

console.log('settlegrid-ip-whois MCP server ready')
console.log('Methods: whois_ip')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 318: Random User Generator
gen({ slug: 'random-user-gen', title: 'Random User Generator', desc: 'Generate random user profiles for testing from RandomUser.me.', api: { base: 'https://randomuser.me/api', name: 'RandomUser.me', docs: 'https://randomuser.me/documentation' }, key: null, keywords: ['utility', 'fake-data', 'testing', 'mock'], methods: [{ name: 'generate_users', display: 'Generate random user profiles', cost: 1, params: 'count?, nationality?', inputs: [{ name: 'count', type: 'number', required: false, desc: 'Number of users (1-100)' }, { name: 'nationality', type: 'string', required: false, desc: 'Nationality code (e.g. US, GB, FR)' }] }],
  serverTs: `/**
 * settlegrid-random-user-gen — Random User Generator MCP Server
 *
 * Wraps RandomUser.me API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_users(count?, nationality?) — random users (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface UserInput { count?: number; nationality?: string }

const sg = settlegrid.init({
  toolSlug: 'random-user-gen',
  pricing: { defaultCostCents: 1, methods: { generate_users: { costCents: 1, displayName: 'Generate Users' } } },
})

const generateUsers = sg.wrap(async (args: UserInput) => {
  const count = Math.min(Math.max(args.count ?? 5, 1), 100)
  let url = \`https://randomuser.me/api/?results=\${count}\`
  if (args.nationality) url += \`&nat=\${args.nationality}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  const data = await res.json() as any
  return {
    users: (data.results || []).map((u: any) => ({
      name: \`\${u.name.first} \${u.name.last}\`, email: u.email,
      gender: u.gender, phone: u.phone, cell: u.cell,
      city: u.location.city, state: u.location.state, country: u.location.country,
      postcode: u.location.postcode, age: u.dob.age,
      picture: u.picture.medium, username: u.login.username,
      nat: u.nat, uuid: u.login.uuid,
    })),
  }
}, { method: 'generate_users' })

export { generateUsers }

console.log('settlegrid-random-user-gen MCP server ready')
console.log('Methods: generate_users')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 319: URL Encoder
gen({ slug: 'url-tools', title: 'URL Tools', desc: 'URL encode/decode, parse, and validate — local processing.', api: { base: 'https://local', name: 'Local Processing', docs: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/URL' }, key: null, keywords: ['utility', 'url', 'encode', 'decode', 'parse'], methods: [{ name: 'parse_url', display: 'Parse and analyze a URL', cost: 1, params: 'url', inputs: [{ name: 'url', type: 'string', required: true, desc: 'URL to parse' }] }, { name: 'encode_url', display: 'URL encode a string', cost: 1, params: 'text', inputs: [{ name: 'text', type: 'string', required: true, desc: 'Text to encode' }] }],
  serverTs: `/**
 * settlegrid-url-tools — URL Tools MCP Server
 *
 * Parses and encodes URLs locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_url(url) — parse URL (1¢)
 *   encode_url(text) — encode URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface UrlInput { url: string }
interface EncodeInput { text: string }

const sg = settlegrid.init({
  toolSlug: 'url-tools',
  pricing: { defaultCostCents: 1, methods: { parse_url: { costCents: 1, displayName: 'Parse URL' }, encode_url: { costCents: 1, displayName: 'Encode URL' } } },
})

const parseUrl = sg.wrap(async (args: UrlInput) => {
  if (!args.url) throw new Error('url is required')
  try {
    const u = new URL(args.url)
    const params: Record<string, string> = {}
    u.searchParams.forEach((v, k) => { params[k] = v })
    return {
      valid: true, protocol: u.protocol, hostname: u.hostname, port: u.port || null,
      pathname: u.pathname, search: u.search, hash: u.hash,
      origin: u.origin, params, host: u.host,
    }
  } catch {
    return { valid: false, error: 'Invalid URL format', input: args.url }
  }
}, { method: 'parse_url' })

const encodeUrl = sg.wrap(async (args: EncodeInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  return {
    original: args.text,
    encoded: encodeURIComponent(args.text),
    encoded_full: encodeURI(args.text),
  }
}, { method: 'encode_url' })

export { parseUrl, encodeUrl }

console.log('settlegrid-url-tools MCP server ready')
console.log('Methods: parse_url, encode_url')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 320: Placeholder Images
gen({ slug: 'placeholder-images', title: 'Placeholder Images', desc: 'Generate placeholder image URLs with custom dimensions and text.', api: { base: 'https://via.placeholder.com', name: 'Placeholder.com', docs: 'https://placeholder.com/' }, key: null, keywords: ['photography', 'placeholder', 'images', 'design'], methods: [{ name: 'get_placeholder', display: 'Generate placeholder image URL', cost: 1, params: 'width, height?, text?, bg_color?, text_color?', inputs: [{ name: 'width', type: 'number', required: true, desc: 'Width in pixels' }, { name: 'height', type: 'number', required: false, desc: 'Height (default same as width)' }, { name: 'text', type: 'string', required: false, desc: 'Overlay text' }, { name: 'bg_color', type: 'string', required: false, desc: 'Background color hex (no #)' }, { name: 'text_color', type: 'string', required: false, desc: 'Text color hex (no #)' }] }],
  serverTs: `/**
 * settlegrid-placeholder-images — Placeholder Images MCP Server
 *
 * Generates placeholder image URLs with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_placeholder(width, height?, text?, bg_color?, text_color?) — placeholder URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface PlaceholderInput { width: number; height?: number; text?: string; bg_color?: string; text_color?: string }

const sg = settlegrid.init({
  toolSlug: 'placeholder-images',
  pricing: { defaultCostCents: 1, methods: { get_placeholder: { costCents: 1, displayName: 'Get Placeholder' } } },
})

const getPlaceholder = sg.wrap(async (args: PlaceholderInput) => {
  if (!args.width || args.width < 1) throw new Error('width is required and must be positive')
  const h = args.height ?? args.width
  const bg = args.bg_color || 'cccccc'
  const tc = args.text_color || '969696'
  let url = \`https://via.placeholder.com/\${args.width}x\${h}/\${bg}/\${tc}\`
  if (args.text) url += \`?text=\${encodeURIComponent(args.text)}\`
  return {
    url, png_url: \`\${url}.png\`, jpg_url: \`\${url}.jpg\`, webp_url: \`\${url}.webp\`,
    width: args.width, height: h, bg_color: bg, text_color: tc,
  }
}, { method: 'get_placeholder' })

export { getPlaceholder }

console.log('settlegrid-placeholder-images MCP server ready')
console.log('Methods: get_placeholder')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 321: Hacker News Top
gen({ slug: 'hackernews-top', title: 'Hacker News Top Stories', desc: 'Top and best stories from Hacker News Firebase API.', api: { base: 'https://hacker-news.firebaseio.com/v0', name: 'HN Firebase', docs: 'https://github.com/HackerNews/API' }, key: null, keywords: ['misc', 'hackernews', 'tech', 'news', 'stories'], methods: [{ name: 'get_top_stories', display: 'Get top HN stories', cost: 1, params: 'limit?', inputs: [{ name: 'limit', type: 'number', required: false, desc: 'Max stories (default 10)' }] }],
  serverTs: `/**
 * settlegrid-hackernews-top — Hacker News Top Stories MCP Server
 *
 * Wraps HN Firebase API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_top_stories(limit?) — top stories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TopInput { limit?: number }

const API_BASE = 'https://hacker-news.firebaseio.com/v0'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'hackernews-top',
  pricing: { defaultCostCents: 1, methods: { get_top_stories: { costCents: 1, displayName: 'Top Stories' } } },
})

const getTopStories = sg.wrap(async (args: TopInput) => {
  const limit = args.limit ?? 10
  const ids = await apiFetch<number[]>('/topstories.json')
  const top = ids.slice(0, limit)
  const stories = await Promise.all(top.map(id => apiFetch<any>(\`/item/\${id}.json\`)))
  return {
    stories: stories.map(s => ({
      id: s.id, title: s.title, url: s.url, by: s.by,
      score: s.score, comments: s.descendants, time: s.time,
    })),
  }
}, { method: 'get_top_stories' })

export { getTopStories }

console.log('settlegrid-hackernews-top MCP server ready')
console.log('Methods: get_top_stories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 322: Archive.org Search
gen({ slug: 'archive-org', title: 'Archive.org Search', desc: 'Search the Internet Archive for books, media, and web archives.', api: { base: 'https://archive.org/advancedsearch.php', name: 'Internet Archive', docs: 'https://archive.org/developers/' }, key: null, keywords: ['misc', 'archive', 'books', 'media', 'web'], methods: [{ name: 'search_archive', display: 'Search Internet Archive', cost: 1, params: 'query, media_type?, limit?', inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }, { name: 'media_type', type: 'string', required: false, desc: 'Media type: texts, audio, movies, software' }, { name: 'limit', type: 'number', required: false, desc: 'Max results' }] }],
  serverTs: `/**
 * settlegrid-archive-org — Archive.org Search MCP Server
 *
 * Wraps Internet Archive API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_archive(query, media_type?, limit?) — search IA (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string; media_type?: string; limit?: number }

const sg = settlegrid.init({
  toolSlug: 'archive-org',
  pricing: { defaultCostCents: 1, methods: { search_archive: { costCents: 1, displayName: 'Search Archive' } } },
})

const searchArchive = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const limit = args.limit ?? 10
  let q = args.query
  if (args.media_type) q += \` AND mediatype:\${args.media_type}\`
  const url = \`https://archive.org/advancedsearch.php?q=\${encodeURIComponent(q)}&output=json&rows=\${limit}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  const data = await res.json() as any
  return {
    total: data.response?.numFound,
    items: (data.response?.docs || []).map((d: any) => ({
      identifier: d.identifier, title: d.title, creator: d.creator,
      mediatype: d.mediatype, date: d.date, description: d.description?.slice(0, 200),
      url: \`https://archive.org/details/\${d.identifier}\`,
      downloads: d.downloads,
    })),
  }
}, { method: 'search_archive' })

export { searchArchive }

console.log('settlegrid-archive-org MCP server ready')
console.log('Methods: search_archive')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 323: Barcode Generator
gen({ slug: 'barcode-gen', title: 'Barcode Generator', desc: 'Generate barcode image URLs for EAN, UPC, Code128, and QR codes.', api: { base: 'https://barcodeapi.org/api', name: 'BarcodeAPI', docs: 'https://barcodeapi.org/' }, key: null, keywords: ['utility', 'barcode', 'ean', 'upc', 'generator'], methods: [{ name: 'generate_barcode', display: 'Generate barcode image URL', cost: 1, params: 'data, type?', inputs: [{ name: 'data', type: 'string', required: true, desc: 'Data to encode' }, { name: 'type', type: 'string', required: false, desc: 'Type: 128, ean13, upc, qr (default 128)' }] }],
  serverTs: `/**
 * settlegrid-barcode-gen — Barcode Generator MCP Server
 *
 * Generates barcode URLs via BarcodeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_barcode(data, type?) — barcode URL (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface BarcodeInput { data: string; type?: string }

const sg = settlegrid.init({
  toolSlug: 'barcode-gen',
  pricing: { defaultCostCents: 1, methods: { generate_barcode: { costCents: 1, displayName: 'Generate Barcode' } } },
})

const generateBarcode = sg.wrap(async (args: BarcodeInput) => {
  if (!args.data) throw new Error('data is required')
  const type = args.type || '128'
  const url = \`https://barcodeapi.org/api/\${type}/\${encodeURIComponent(args.data)}\`
  return { url, type, data: args.data, format: 'PNG' }
}, { method: 'generate_barcode' })

export { generateBarcode }

console.log('settlegrid-barcode-gen MCP server ready')
console.log('Methods: generate_barcode')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 324: HTTP Status Codes
gen({ slug: 'http-status', title: 'HTTP Status Codes', desc: 'HTTP status code reference and information.', api: { base: 'https://local', name: 'Local Data', docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status' }, key: null, keywords: ['utility', 'http', 'status-codes', 'web'], methods: [{ name: 'get_status_info', display: 'Get HTTP status code info', cost: 1, params: 'code', inputs: [{ name: 'code', type: 'number', required: true, desc: 'HTTP status code (100-599)' }] }],
  serverTs: `/**
 * settlegrid-http-status — HTTP Status Codes MCP Server
 *
 * Provides HTTP status code reference with SettleGrid billing.
 * No API key needed — local data.
 *
 * Methods:
 *   get_status_info(code) — status code info (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface StatusInput { code: number }

const CODES: Record<number, { name: string; desc: string; category: string }> = {
  100: { name: 'Continue', desc: 'Server received request headers, client should proceed.', category: 'Informational' },
  200: { name: 'OK', desc: 'Request succeeded.', category: 'Success' },
  201: { name: 'Created', desc: 'Request succeeded and a new resource was created.', category: 'Success' },
  204: { name: 'No Content', desc: 'Request succeeded with no response body.', category: 'Success' },
  301: { name: 'Moved Permanently', desc: 'Resource has been permanently moved.', category: 'Redirection' },
  302: { name: 'Found', desc: 'Resource temporarily at different URI.', category: 'Redirection' },
  304: { name: 'Not Modified', desc: 'Resource has not been modified since last request.', category: 'Redirection' },
  400: { name: 'Bad Request', desc: 'Server cannot process request due to client error.', category: 'Client Error' },
  401: { name: 'Unauthorized', desc: 'Authentication is required.', category: 'Client Error' },
  403: { name: 'Forbidden', desc: 'Server refuses to authorize the request.', category: 'Client Error' },
  404: { name: 'Not Found', desc: 'Requested resource could not be found.', category: 'Client Error' },
  405: { name: 'Method Not Allowed', desc: 'HTTP method not allowed for this resource.', category: 'Client Error' },
  408: { name: 'Request Timeout', desc: 'Server timed out waiting for the request.', category: 'Client Error' },
  409: { name: 'Conflict', desc: 'Request conflicts with current state of the resource.', category: 'Client Error' },
  422: { name: 'Unprocessable Entity', desc: 'Request was well-formed but could not be followed.', category: 'Client Error' },
  429: { name: 'Too Many Requests', desc: 'User has sent too many requests.', category: 'Client Error' },
  500: { name: 'Internal Server Error', desc: 'Server encountered an unexpected condition.', category: 'Server Error' },
  502: { name: 'Bad Gateway', desc: 'Server received an invalid response from upstream.', category: 'Server Error' },
  503: { name: 'Service Unavailable', desc: 'Server is temporarily unable to handle the request.', category: 'Server Error' },
  504: { name: 'Gateway Timeout', desc: 'Server did not receive a timely response from upstream.', category: 'Server Error' },
}

const sg = settlegrid.init({
  toolSlug: 'http-status',
  pricing: { defaultCostCents: 1, methods: { get_status_info: { costCents: 1, displayName: 'Status Info' } } },
})

const getStatusInfo = sg.wrap(async (args: StatusInput) => {
  if (!args.code || args.code < 100 || args.code > 599) throw new Error('Valid HTTP status code (100-599) required')
  const info = CODES[args.code]
  if (info) return { code: args.code, ...info }
  const cat = args.code < 200 ? 'Informational' : args.code < 300 ? 'Success' : args.code < 400 ? 'Redirection' : args.code < 500 ? 'Client Error' : 'Server Error'
  return { code: args.code, name: 'Unknown', desc: 'Non-standard status code.', category: cat }
}, { method: 'get_status_info' })

export { getStatusInfo }

console.log('settlegrid-http-status MCP server ready')
console.log('Methods: get_status_info')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 325: Word Counter
gen({ slug: 'word-counter', title: 'Word Counter', desc: 'Count words, characters, sentences, and reading time — local processing.', api: { base: 'https://local', name: 'Local Processing', docs: 'https://en.wikipedia.org/wiki/Word_count' }, key: null, keywords: ['utility', 'words', 'text', 'counter', 'readability'], methods: [{ name: 'count_words', display: 'Count words and characters', cost: 1, params: 'text', inputs: [{ name: 'text', type: 'string', required: true, desc: 'Text to analyze' }] }],
  serverTs: `/**
 * settlegrid-word-counter — Word Counter MCP Server
 *
 * Counts words and characters locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   count_words(text) — word count (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface TextInput { text: string }

const sg = settlegrid.init({
  toolSlug: 'word-counter',
  pricing: { defaultCostCents: 1, methods: { count_words: { costCents: 1, displayName: 'Count Words' } } },
})

const countWords = sg.wrap(async (args: TextInput) => {
  if (!args.text && args.text !== '') throw new Error('text is required')
  const text = args.text.trim()
  const words = text ? text.split(/\\s+/).length : 0
  const chars = text.length
  const chars_no_spaces = text.replace(/\\s/g, '').length
  const sentences = text ? (text.match(/[.!?]+/g) || []).length || 1 : 0
  const paragraphs = text ? text.split(/\\n\\n+/).filter(p => p.trim()).length : 0
  const reading_time_min = Math.ceil(words / 200)
  const speaking_time_min = Math.ceil(words / 130)
  return { words, characters: chars, characters_no_spaces: chars_no_spaces, sentences, paragraphs, reading_time_min, speaking_time_min, avg_word_length: words > 0 ? Math.round(chars_no_spaces / words * 10) / 10 : 0 }
}, { method: 'count_words' })

export { countWords }

console.log('settlegrid-word-counter MCP server ready')
console.log('Methods: count_words')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 326: Password Generator
gen({ slug: 'password-gen', title: 'Password Generator', desc: 'Generate secure random passwords — local processing.', api: { base: 'https://local', name: 'Node.js Crypto', docs: 'https://nodejs.org/api/crypto.html' }, key: null, keywords: ['utility', 'password', 'security', 'generator'], methods: [{ name: 'generate_password', display: 'Generate a secure password', cost: 1, params: 'length?, uppercase?, numbers?, symbols?', inputs: [{ name: 'length', type: 'number', required: false, desc: 'Password length (8-128, default 16)' }, { name: 'uppercase', type: 'boolean', required: false, desc: 'Include uppercase (default true)' }, { name: 'numbers', type: 'boolean', required: false, desc: 'Include numbers (default true)' }, { name: 'symbols', type: 'boolean', required: false, desc: 'Include symbols (default true)' }] }],
  serverTs: `/**
 * settlegrid-password-gen — Password Generator MCP Server
 *
 * Generates secure passwords locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_password(length?, uppercase?, numbers?, symbols?) — password (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'
import { randomBytes } from 'node:crypto'

interface PwInput { length?: number; uppercase?: boolean; numbers?: boolean; symbols?: boolean }

const sg = settlegrid.init({
  toolSlug: 'password-gen',
  pricing: { defaultCostCents: 1, methods: { generate_password: { costCents: 1, displayName: 'Generate Password' } } },
})

const generatePassword = sg.wrap(async (args: PwInput) => {
  const len = Math.min(Math.max(args.length ?? 16, 8), 128)
  let chars = 'abcdefghijklmnopqrstuvwxyz'
  if (args.uppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (args.numbers !== false) chars += '0123456789'
  if (args.symbols !== false) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'
  const bytes = randomBytes(len)
  let password = ''
  for (let i = 0; i < len; i++) password += chars[bytes[i] % chars.length]
  const strength = len >= 20 && args.symbols !== false ? 'strong' : len >= 12 ? 'good' : 'fair'
  return { password, length: len, strength, charset_size: chars.length, entropy_bits: Math.round(Math.log2(chars.length) * len) }
}, { method: 'generate_password' })

export { generatePassword }

console.log('settlegrid-password-gen MCP server ready')
console.log('Methods: generate_password')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 327: Cron Parser
gen({ slug: 'cron-parser', title: 'Cron Expression Parser', desc: 'Parse and explain cron expressions — local processing.', api: { base: 'https://local', name: 'Local Processing', docs: 'https://crontab.guru/' }, key: null, keywords: ['utility', 'cron', 'scheduler', 'parser'], methods: [{ name: 'parse_cron', display: 'Parse cron expression', cost: 1, params: 'expression', inputs: [{ name: 'expression', type: 'string', required: true, desc: 'Cron expression (e.g. "*/5 * * * *")' }] }],
  serverTs: `/**
 * settlegrid-cron-parser — Cron Expression Parser MCP Server
 *
 * Parses cron expressions locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   parse_cron(expression) — parse cron (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CronInput { expression: string }

const FIELD_NAMES = ['minute', 'hour', 'day_of_month', 'month', 'day_of_week']
const FIELD_RANGES = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]]

function explainField(field: string, idx: number): string {
  const name = FIELD_NAMES[idx]
  if (field === '*') return \`every \${name}\`
  if (field.startsWith('*/')) return \`every \${field.slice(2)} \${name}s\`
  if (field.includes(',')) return \`\${name} \${field}\`
  if (field.includes('-')) return \`\${name} \${field}\`
  return \`\${name} \${field}\`
}

const sg = settlegrid.init({
  toolSlug: 'cron-parser',
  pricing: { defaultCostCents: 1, methods: { parse_cron: { costCents: 1, displayName: 'Parse Cron' } } },
})

const parseCron = sg.wrap(async (args: CronInput) => {
  if (!args.expression) throw new Error('expression is required')
  const parts = args.expression.trim().split(/\\s+/)
  if (parts.length < 5 || parts.length > 6) throw new Error('Cron must have 5 or 6 fields')
  const fields = parts.slice(0, 5).map((f, i) => ({
    field: FIELD_NAMES[i], value: f,
    range: \`\${FIELD_RANGES[i][0]}-\${FIELD_RANGES[i][1]}\`,
    explanation: explainField(f, i),
  }))
  const description = fields.map(f => f.explanation).join(', ')
  return { expression: args.expression, fields, description, valid: true, has_seconds: parts.length === 6 }
}, { method: 'parse_cron' })

export { parseCron }

console.log('settlegrid-cron-parser MCP server ready')
console.log('Methods: parse_cron')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 328: Emoji Data
gen({ slug: 'emoji-data', title: 'Emoji Data', desc: 'Emoji search and info from Open Emoji API.', api: { base: 'https://emoji-api.com', name: 'Open Emoji API', docs: 'https://emoji-api.com/' }, key: { env: 'EMOJI_API_KEY', url: 'https://emoji-api.com/', required: true }, keywords: ['misc', 'emoji', 'unicode', 'search'], methods: [{ name: 'search_emoji', display: 'Search emojis by keyword', cost: 1, params: 'query', inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search keyword' }] }],
  serverTs: `/**
 * settlegrid-emoji-data — Emoji Data MCP Server
 *
 * Wraps Open Emoji API with SettleGrid billing.
 * Free key from https://emoji-api.com/.
 *
 * Methods:
 *   search_emoji(query) — search emojis (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }

const API_KEY = process.env.EMOJI_API_KEY || ''

const sg = settlegrid.init({
  toolSlug: 'emoji-data',
  pricing: { defaultCostCents: 1, methods: { search_emoji: { costCents: 1, displayName: 'Search Emoji' } } },
})

const searchEmoji = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  if (!API_KEY) throw new Error('EMOJI_API_KEY not set')
  const res = await fetch(\`https://emoji-api.com/emojis?search=\${encodeURIComponent(args.query)}&access_key=\${API_KEY}\`)
  if (!res.ok) throw new Error(\`API \${res.status}\`)
  const data = await res.json() as any
  if (!Array.isArray(data)) return { emojis: [], message: 'No emojis found' }
  return {
    emojis: data.slice(0, 20).map((e: any) => ({
      character: e.character, name: e.unicodeName, slug: e.slug,
      group: e.group, sub_group: e.subGroup, codePoint: e.codePoint,
    })),
  }
}, { method: 'search_emoji' })

export { searchEmoji }

console.log('settlegrid-emoji-data MCP server ready')
console.log('Methods: search_emoji')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 329: Country REST v3.1
gen({ slug: 'country-info', title: 'Country Information', desc: 'Detailed country information from RestCountries v3.1.', api: { base: 'https://restcountries.com/v3.1', name: 'RestCountries', docs: 'https://restcountries.com/' }, key: null, keywords: ['travel', 'countries', 'geography', 'data'], methods: [{ name: 'get_country', display: 'Get country info by name', cost: 1, params: 'name', inputs: [{ name: 'name', type: 'string', required: true, desc: 'Country name' }] }, { name: 'get_country_by_code', display: 'Get country by code', cost: 1, params: 'code', inputs: [{ name: 'code', type: 'string', required: true, desc: 'ISO 3166-1 alpha-2 or alpha-3 code' }] }],
  serverTs: `/**
 * settlegrid-country-info — Country Information MCP Server
 *
 * Wraps RestCountries v3.1 with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_country(name) — country by name (1¢)
 *   get_country_by_code(code) — country by code (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface NameInput { name: string }
interface CodeInput { code: string }

const API_BASE = 'https://restcountries.com/v3.1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.status === 404 ? 'Country not found' : \`API \${res.status}\`)
  return res.json() as Promise<T>
}

function mapCountry(c: any) {
  return {
    name: c.name?.common, official_name: c.name?.official, cca2: c.cca2, cca3: c.cca3,
    capital: c.capital, region: c.region, subregion: c.subregion,
    population: c.population, area_km2: c.area, timezones: c.timezones,
    currencies: c.currencies ? Object.values(c.currencies).map((cu: any) => cu.name) : [],
    languages: c.languages ? Object.values(c.languages) : [],
    flag_emoji: c.flag, flag_png: c.flags?.png, borders: c.borders,
    latlng: c.latlng, landlocked: c.landlocked, un_member: c.unMember,
  }
}

const sg = settlegrid.init({
  toolSlug: 'country-info',
  pricing: { defaultCostCents: 1, methods: { get_country: { costCents: 1, displayName: 'Get Country' }, get_country_by_code: { costCents: 1, displayName: 'Country By Code' } } },
})

const getCountry = sg.wrap(async (args: NameInput) => {
  if (!args.name) throw new Error('name is required')
  const data = await apiFetch<any[]>(\`/name/\${encodeURIComponent(args.name)}\`)
  return { countries: data.map(mapCountry) }
}, { method: 'get_country' })

const getCountryByCode = sg.wrap(async (args: CodeInput) => {
  if (!args.code) throw new Error('code is required')
  const data = await apiFetch<any[]>(\`/alpha/\${args.code}\`)
  return { country: mapCountry(data[0]) }
}, { method: 'get_country_by_code' })

export { getCountry, getCountryByCode }

console.log('settlegrid-country-info MCP server ready')
console.log('Methods: get_country, get_country_by_code')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
` })

// 330: VirusTotal Hash Check
gen({ slug: 'vt-hash-check', title: 'VirusTotal Hash Check', desc: 'Check file hashes against VirusTotal malware database.', api: { base: 'https://www.virustotal.com/api/v3', name: 'VirusTotal', docs: 'https://docs.virustotal.com/reference/overview' }, key: { env: 'VIRUSTOTAL_API_KEY', url: 'https://www.virustotal.com/', required: true }, keywords: ['cybersecurity', 'virustotal', 'malware', 'hash', 'antivirus'], methods: [{ name: 'check_file_hash', display: 'Check file hash against VirusTotal', cost: 3, params: 'hash', inputs: [{ name: 'hash', type: 'string', required: true, desc: 'File hash (MD5, SHA1, or SHA256)' }] }],
  serverTs: `/**
 * settlegrid-vt-hash-check — VirusTotal Hash Check MCP Server
 *
 * Wraps VirusTotal API with SettleGrid billing.
 * Free key from https://www.virustotal.com/.
 *
 * Methods:
 *   check_file_hash(hash) — check hash (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface HashInput { hash: string }

const API_BASE = 'https://www.virustotal.com/api/v3'
const API_KEY = process.env.VIRUSTOTAL_API_KEY || ''

const sg = settlegrid.init({
  toolSlug: 'vt-hash-check',
  pricing: { defaultCostCents: 3, methods: { check_file_hash: { costCents: 3, displayName: 'Check File Hash' } } },
})

const checkFileHash = sg.wrap(async (args: HashInput) => {
  if (!args.hash) throw new Error('hash is required')
  if (!API_KEY) throw new Error('VIRUSTOTAL_API_KEY not set')
  const res = await fetch(\`\${API_BASE}/files/\${args.hash}\`, {
    headers: { 'x-apikey': API_KEY },
  })
  if (!res.ok) {
    if (res.status === 404) return { hash: args.hash, found: false, message: 'Hash not found in VirusTotal' }
    throw new Error(\`API \${res.status}\`)
  }
  const data = await res.json() as any
  const attrs = data.data?.attributes
  return {
    hash: args.hash, found: true,
    sha256: attrs?.sha256, md5: attrs?.md5, sha1: attrs?.sha1,
    file_type: attrs?.type_description, size: attrs?.size,
    detection_stats: attrs?.last_analysis_stats,
    malicious: attrs?.last_analysis_stats?.malicious || 0,
    undetected: attrs?.last_analysis_stats?.undetected || 0,
    reputation: attrs?.reputation,
    names: attrs?.names?.slice(0, 5),
    first_submission: attrs?.first_submission_date,
    last_analysis: attrs?.last_analysis_date,
    tags: attrs?.tags?.slice(0, 10),
  }
}, { method: 'check_file_hash' })

export { checkFileHash }

console.log('settlegrid-vt-hash-check MCP server ready')
console.log('Methods: check_file_hash')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
` })

console.log('\\n=== Batch 3G COMPLETE: 95 servers (236-330) generated ===\\n')
