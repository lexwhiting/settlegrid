/**
 * Batch 3b — 30 International Organizations MCP servers (#41-#70)
 */
import { gen } from './core.mjs'

console.log('Batch 3b: International Organizations (30 servers)\n')

// ──────────────────────────────────────────────────────────────────────────────
// 41. settlegrid-world-trade
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-trade',
  title: 'WTO Trade Data',
  desc: 'Access World Trade Organization trade statistics and indicators via the WTO Timeseries API.',
  api: { base: 'https://api.wto.org/timeseries/v1', name: 'WTO Timeseries API', docs: 'https://apiportal.wto.org/' },
  key: null,
  keywords: ['wto', 'trade', 'tariffs', 'commerce', 'international-trade'],
  methods: [
    { name: 'get_trade_data', display: 'Get trade data for a reporter country', cost: 2, params: 'reporter, year?',
      inputs: [
        { name: 'reporter', type: 'string', required: true, desc: 'ISO3 country code (e.g. USA, CHN, DEU)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2022). Defaults to latest.' },
      ] },
    { name: 'list_indicators', display: 'List available WTO indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'search_topics', display: 'Search WTO data topics', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "tariffs", "services")' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-world-trade — WTO Trade Data MCP Server
 *
 * Wraps the WTO Timeseries API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_trade_data(reporter, year?)  — Get trade data (2\\u00A2)
 *   list_indicators()                — List indicators (1\\u00A2)
 *   search_topics(query)             — Search topics (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TradeDataInput {
  reporter: string
  year?: string
}

interface SearchTopicsInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.wto.org/timeseries/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-trade/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WTO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-trade',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_trade_data: { costCents: 2, displayName: 'Get trade data for a reporter country' },
      list_indicators: { costCents: 1, displayName: 'List available WTO indicators' },
      search_topics: { costCents: 1, displayName: 'Search WTO data topics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTradeData = sg.wrap(async (args: TradeDataInput) => {
  if (!args.reporter || typeof args.reporter !== 'string') {
    throw new Error('reporter is required (ISO3 country code, e.g. USA)')
  }
  const params: Record<string, string> = { r: args.reporter.toUpperCase(), i: 'HS_M_0010' }
  if (args.year) params.ps = args.year
  return apiFetch<unknown>('/data', params)
}, { method: 'get_trade_data' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const searchTopics = sg.wrap(async (args: SearchTopicsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/topics', { q: args.query })
}, { method: 'search_topics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTradeData, listIndicators, searchTopics }

console.log('settlegrid-world-trade MCP server ready')
console.log('Methods: get_trade_data, list_indicators, search_topics')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 42. settlegrid-un-population
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'un-population',
  title: 'UN Population Data',
  desc: 'Access United Nations population estimates and projections via the UN Data Portal API.',
  api: { base: 'https://population.un.org/dataportalapi/api/v1', name: 'UN Population Data Portal', docs: 'https://population.un.org/dataportal/about/dataapi' },
  key: null,
  keywords: ['un', 'population', 'demographics', 'census', 'world-population'],
  methods: [
    { name: 'get_population', display: 'Get population data for a country', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3166 numeric country code or name (e.g. 840 for USA)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2023). Defaults to latest.' },
      ] },
    { name: 'list_indicators', display: 'List available population indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'list_locations', display: 'List available locations/countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-un-population — UN Population Data MCP Server
 *
 * Wraps the UN Data Portal API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_population(country, year?)  — Get population data (2\\u00A2)
 *   list_indicators()               — List indicators (1\\u00A2)
 *   list_locations()                 — List locations (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PopulationInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://population.un.org/dataportalapi/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-un-population/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UN Population API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-population',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_population: { costCents: 2, displayName: 'Get population data for a country' },
      list_indicators: { costCents: 1, displayName: 'List available population indicators' },
      list_locations: { costCents: 1, displayName: 'List available locations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPopulation = sg.wrap(async (args: PopulationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3166 numeric code or name)')
  }
  const params: Record<string, string> = { locationId: args.country, indicatorIds: '49' }
  if (args.year) params.startYear = args.year
  if (args.year) params.endYear = args.year
  return apiFetch<unknown>('/data/indicators/49/locations/' + encodeURIComponent(args.country), params)
}, { method: 'get_population' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listLocations = sg.wrap(async () => {
  return apiFetch<unknown>('/locations')
}, { method: 'list_locations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPopulation, listIndicators, listLocations }

console.log('settlegrid-un-population MCP server ready')
console.log('Methods: get_population, list_indicators, list_locations')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 43. settlegrid-un-refugees
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'un-refugees',
  title: 'UNHCR Refugee Data',
  desc: 'Access UNHCR refugee statistics and population data via the UNHCR Population API.',
  api: { base: 'https://api.unhcr.org/population/v1', name: 'UNHCR Population API', docs: 'https://api.unhcr.org/' },
  key: null,
  keywords: ['unhcr', 'refugees', 'asylum', 'displacement', 'humanitarian'],
  methods: [
    { name: 'get_refugee_data', display: 'Get refugee data for a country', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3 country code (e.g. SYR, AFG, UKR)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2023). Defaults to latest.' },
      ] },
    { name: 'list_countries', display: 'List countries with refugee data', cost: 1, params: '',
      inputs: [] },
    { name: 'get_demographics', display: 'Get demographic breakdown for a country', cost: 2, params: 'country',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3 country code' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-un-refugees — UNHCR Refugee Data MCP Server
 *
 * Wraps the UNHCR Population API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_refugee_data(country, year?)  — Get refugee data (2\\u00A2)
 *   list_countries()                  — List countries (1\\u00A2)
 *   get_demographics(country)         — Get demographics (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RefugeeDataInput {
  country: string
  year?: string
}

interface DemographicsInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.unhcr.org/population/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-un-refugees/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UNHCR API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'un-refugees',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_refugee_data: { costCents: 2, displayName: 'Get refugee data for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with refugee data' },
      get_demographics: { costCents: 2, displayName: 'Get demographic breakdown' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRefugeeData = sg.wrap(async (args: RefugeeDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code, e.g. SYR)')
  }
  const params: Record<string, string> = { limit: '100', coo: args.country.toUpperCase() }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/population/', params)
}, { method: 'get_refugee_data' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries/')
}, { method: 'list_countries' })

const getDemographics = sg.wrap(async (args: DemographicsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code)')
  }
  return apiFetch<unknown>('/demographics/', { coo: args.country.toUpperCase(), limit: '100' })
}, { method: 'get_demographics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRefugeeData, listCountries, getDemographics }

console.log('settlegrid-un-refugees MCP server ready')
console.log('Methods: get_refugee_data, list_countries, get_demographics')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 44. settlegrid-unicef
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'unicef',
  title: 'UNICEF Child Welfare Data',
  desc: 'Access UNICEF child welfare statistics via the UNICEF SDMX API.',
  api: { base: 'https://sdmx.data.unicef.org/ws/public/sdmxapi/rest', name: 'UNICEF SDMX API', docs: 'https://data.unicef.org/resources/dataset/sdmx/' },
  key: null,
  keywords: ['unicef', 'children', 'welfare', 'health', 'education', 'sdmx'],
  methods: [
    { name: 'search_indicators', display: 'Search UNICEF indicators', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search term (e.g. "mortality", "nutrition")' },
      ] },
    { name: 'get_data', display: 'Get data for an indicator and country', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'UNICEF indicator/dataflow ID (e.g. GLOBAL_DATAFLOW)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO2 country code (e.g. US, GB)' },
      ] },
    { name: 'list_datasets', display: 'List available UNICEF datasets', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-unicef — UNICEF Child Welfare Data MCP Server
 *
 * Wraps the UNICEF SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_indicators(query)          — Search indicators (1\\u00A2)
 *   get_data(indicator, country?)     — Get data (2\\u00A2)
 *   list_datasets()                   — List datasets (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface GetDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.data.unicef.org/ws/public/sdmxapi/rest'

async function apiFetch<T>(path: string, accept = 'application/json'): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { Accept: accept, 'User-Agent': 'settlegrid-unicef/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UNICEF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'unicef',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_indicators: { costCents: 1, displayName: 'Search UNICEF indicators' },
      get_data: { costCents: 2, displayName: 'Get data for indicator and country' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(\`/codelist/UNICEF/CL_INDICATOR/latest?format=sdmx-json&detail=full\`)
}, { method: 'search_indicators' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. GLOBAL_DATAFLOW)')
  }
  const key = args.country ? \`\${args.country.toUpperCase()}.\` : ''
  return apiFetch<unknown>(\`/data/UNICEF,\${encodeURIComponent(args.indicator)},1.0/\${key}?format=sdmx-json&lastNObservations=10\`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/UNICEF?format=sdmx-json')
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIndicators, getData, listDatasets }

console.log('settlegrid-unicef MCP server ready')
console.log('Methods: search_indicators, get_data, list_datasets')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 45. settlegrid-fao-food
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'fao-food',
  title: 'FAO Food & Agriculture Data',
  desc: 'Access FAO food and agriculture statistics via the FAOSTAT API.',
  api: { base: 'https://www.fao.org/faostat/api/v1', name: 'FAOSTAT API', docs: 'https://www.fao.org/faostat/en/#data' },
  key: null,
  keywords: ['fao', 'food', 'agriculture', 'farming', 'nutrition'],
  methods: [
    { name: 'get_data', display: 'Get data from a FAOSTAT dataset', cost: 2, params: 'dataset, country?, year?',
      inputs: [
        { name: 'dataset', type: 'string', required: true, desc: 'Dataset code (e.g. QCL for crops, FBS for food balance)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 numeric area code (e.g. 231 for USA)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2022)' },
      ] },
    { name: 'list_datasets', display: 'List available FAOSTAT datasets', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List available countries/areas', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-fao-food — FAO Food & Agriculture Data MCP Server
 *
 * Wraps the FAOSTAT API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, country?, year?)  — Get FAOSTAT data (2\\u00A2)
 *   list_datasets()                     — List datasets (1\\u00A2)
 *   list_countries()                    — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  country?: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.fao.org/faostat/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fao-food/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FAOSTAT API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fao-food',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get data from FAOSTAT dataset' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. QCL, FBS, TP)')
  }
  const params: Record<string, string> = { output_type: 'objects' }
  if (args.country) params.area = args.country
  if (args.year) params.year = args.year
  return apiFetch<unknown>(\`/en/data/\${encodeURIComponent(args.dataset)}\`, params)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/en/definitions/domains')
}, { method: 'list_datasets' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/en/definitions/types/area')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, listCountries }

console.log('settlegrid-fao-food MCP server ready')
console.log('Methods: get_data, list_datasets, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 46. settlegrid-ilo-labor
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'ilo-labor',
  title: 'ILO Labor Statistics',
  desc: 'Access International Labour Organization statistics via the ILO SDMX API.',
  api: { base: 'https://www.ilo.org/sdmx/rest', name: 'ILO SDMX API', docs: 'https://ilostat.ilo.org/resources/sdmx-tools/' },
  key: null,
  keywords: ['ilo', 'labor', 'employment', 'wages', 'work', 'sdmx'],
  methods: [
    { name: 'search_indicators', display: 'Search ILO indicators', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search term (e.g. "unemployment", "wages")' },
      ] },
    { name: 'get_data', display: 'Get data for an indicator', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'ILO dataflow ID (e.g. DF_STI_ALL_UNE_DEAP_SEX_AGE_RT)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code (e.g. USA, GBR)' },
      ] },
    { name: 'list_datasets', display: 'List available ILO datasets', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-ilo-labor — ILO Labor Statistics MCP Server
 *
 * Wraps the ILO SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_indicators(query)        — Search indicators (1\\u00A2)
 *   get_data(indicator, country?)   — Get data (2\\u00A2)
 *   list_datasets()                 — List datasets (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface GetDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.ilo.org/sdmx/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-ilo-labor/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ILO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ilo-labor',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_indicators: { costCents: 1, displayName: 'Search ILO indicators' },
      get_data: { costCents: 2, displayName: 'Get data for an indicator' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(\`/dataflow/ILO?detail=allstubs&references=none\`)
}, { method: 'search_indicators' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (ILO dataflow ID)')
  }
  const key = args.country ? \`\${args.country.toUpperCase()}\` : 'all'
  return apiFetch<unknown>(\`/data/ILO,\${encodeURIComponent(args.indicator)},1.0/\${key}?lastNObservations=10\`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/ILO?detail=allstubs')
}, { method: 'list_datasets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchIndicators, getData, listDatasets }

console.log('settlegrid-ilo-labor MCP server ready')
console.log('Methods: search_indicators, get_data, list_datasets')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 47. settlegrid-wipo-patents
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'wipo-patents',
  title: 'WIPO Patent Data',
  desc: 'Access WIPO intellectual property statistics and patent data via the WIPO IP Statistics API.',
  api: { base: 'https://www3.wipo.int/ipstats/api', name: 'WIPO IP Statistics API', docs: 'https://www.wipo.int/ipstats/en/' },
  key: null,
  keywords: ['wipo', 'patents', 'intellectual-property', 'trademarks', 'innovation'],
  methods: [
    { name: 'get_patent_stats', display: 'Get patent statistics for a country', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO2 country code (e.g. US, CN, JP)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2022)' },
      ] },
    { name: 'list_countries', display: 'List countries with patent data', cost: 1, params: '',
      inputs: [] },
    { name: 'get_trend', display: 'Get patent trend for a country and indicator', cost: 2, params: 'country, indicator',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO2 country code' },
        { name: 'indicator', type: 'string', required: true, desc: 'Indicator (e.g. patent_applications, trademark_registrations)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-wipo-patents — WIPO Patent Data MCP Server
 *
 * Wraps the WIPO IP Statistics API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_patent_stats(country, year?)    — Get patent stats (2\\u00A2)
 *   list_countries()                    — List countries (1\\u00A2)
 *   get_trend(country, indicator)       — Get trend data (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PatentStatsInput {
  country: string
  year?: string
}

interface TrendInput {
  country: string
  indicator: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www3.wipo.int/ipstats/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-wipo-patents/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WIPO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wipo-patents',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_patent_stats: { costCents: 2, displayName: 'Get patent statistics for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with patent data' },
      get_trend: { costCents: 2, displayName: 'Get patent trend data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPatentStats = sg.wrap(async (args: PatentStatsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 country code, e.g. US)')
  }
  const params: Record<string, string> = { country: args.country.toUpperCase(), type: 'patent' }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/ipcountryprofile', params)
}, { method: 'get_patent_stats' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

const getTrend = sg.wrap(async (args: TrendInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 country code)')
  }
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. patent_applications)')
  }
  return apiFetch<unknown>('/trend', {
    country: args.country.toUpperCase(),
    indicator: args.indicator,
  })
}, { method: 'get_trend' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPatentStats, listCountries, getTrend }

console.log('settlegrid-wipo-patents MCP server ready')
console.log('Methods: get_patent_stats, list_countries, get_trend')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 48. settlegrid-iaea-nuclear
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'iaea-nuclear',
  title: 'IAEA Nuclear Data',
  desc: 'Access IAEA nuclear reactor and power statistics via the PRIS API.',
  api: { base: 'https://pris.iaea.org/PRIS/api', name: 'IAEA PRIS API', docs: 'https://pris.iaea.org/PRIS/' },
  key: null,
  keywords: ['iaea', 'nuclear', 'reactors', 'power', 'energy', 'atomic'],
  methods: [
    { name: 'list_reactors', display: 'List nuclear reactors by country', cost: 1, params: 'country?',
      inputs: [
        { name: 'country', type: 'string', required: false, desc: 'Country name or ISO code (e.g. France, US)' },
      ] },
    { name: 'get_reactor', display: 'Get details for a specific reactor', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Reactor ID or name' },
      ] },
    { name: 'get_power_stats', display: 'Get nuclear power statistics for a country', cost: 2, params: 'country',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'Country name or ISO code' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-iaea-nuclear — IAEA Nuclear Data MCP Server
 *
 * Wraps the IAEA PRIS API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_reactors(country?)       — List reactors (1\\u00A2)
 *   get_reactor(id)               — Get reactor details (2\\u00A2)
 *   get_power_stats(country)      — Get power stats (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListReactorsInput {
  country?: string
}

interface GetReactorInput {
  id: string
}

interface PowerStatsInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pris.iaea.org/PRIS/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-iaea-nuclear/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IAEA PRIS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'iaea-nuclear',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_reactors: { costCents: 1, displayName: 'List nuclear reactors' },
      get_reactor: { costCents: 2, displayName: 'Get reactor details' },
      get_power_stats: { costCents: 2, displayName: 'Get nuclear power statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listReactors = sg.wrap(async (args: ListReactorsInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  return apiFetch<unknown>('/reactors', params)
}, { method: 'list_reactors' })

const getReactor = sg.wrap(async (args: GetReactorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (reactor ID or name)')
  }
  return apiFetch<unknown>(\`/reactors/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_reactor' })

const getPowerStats = sg.wrap(async (args: PowerStatsInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  return apiFetch<unknown>('/countrystatistics', { country: args.country })
}, { method: 'get_power_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listReactors, getReactor, getPowerStats }

console.log('settlegrid-iaea-nuclear MCP server ready')
console.log('Methods: list_reactors, get_reactor, get_power_stats')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 49. settlegrid-itu-telecom
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'itu-telecom',
  title: 'ITU Telecom Data',
  desc: 'Access ITU telecommunications statistics via the ITU DataHub API.',
  api: { base: 'https://datahub.itu.int/api', name: 'ITU DataHub API', docs: 'https://datahub.itu.int/' },
  key: null,
  keywords: ['itu', 'telecom', 'internet', 'broadband', 'communications'],
  methods: [
    { name: 'get_indicator', display: 'Get telecom indicator data', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'Indicator code (e.g. "internet_users_pct")' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code' },
      ] },
    { name: 'list_indicators', display: 'List available ITU indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-itu-telecom — ITU Telecom Data MCP Server
 *
 * Wraps the ITU DataHub API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(indicator, country?)  — Get indicator data (2\\u00A2)
 *   list_indicators()                   — List indicators (1\\u00A2)
 *   list_countries()                    — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://datahub.itu.int/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-itu-telecom/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ITU API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'itu-telecom',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get telecom indicator data' },
      list_indicators: { costCents: 1, displayName: 'List available indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required')
  }
  const params: Record<string, string> = { indicator: args.indicator }
  if (args.country) params.country = args.country.toUpperCase()
  return apiFetch<unknown>('/data', params)
}, { method: 'get_indicator' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, listIndicators, listCountries }

console.log('settlegrid-itu-telecom MCP server ready')
console.log('Methods: get_indicator, list_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 50. settlegrid-who-gho
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'who-gho',
  title: 'WHO Global Health Observatory',
  desc: 'Access WHO Global Health Observatory indicators and data via the GHO OData API.',
  api: { base: 'https://ghoapi.azureedge.net/api', name: 'WHO GHO API', docs: 'https://www.who.int/data/gho/info/gho-odata-api' },
  key: null,
  keywords: ['who', 'health', 'global-health', 'disease', 'mortality'],
  methods: [
    { name: 'get_indicator', display: 'Get data for a GHO indicator', cost: 2, params: 'code, country?',
      inputs: [
        { name: 'code', type: 'string', required: true, desc: 'GHO indicator code (e.g. WHOSIS_000001 for life expectancy)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code (e.g. USA, GBR)' },
      ] },
    { name: 'search_indicators', display: 'Search GHO indicators', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "malaria", "mortality")' },
      ] },
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-who-gho — WHO Global Health Observatory MCP Server
 *
 * Wraps the WHO GHO OData API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(code, country?)  — Get indicator data (2\\u00A2)
 *   search_indicators(query)       — Search indicators (1\\u00A2)
 *   list_countries()               — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  code: string
  country?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ghoapi.azureedge.net/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-who-gho/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WHO GHO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'who-gho',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get GHO indicator data' },
      search_indicators: { costCents: 1, displayName: 'Search GHO indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.code || typeof args.code !== 'string') {
    throw new Error('code is required (GHO indicator code, e.g. WHOSIS_000001)')
  }
  const filter = args.country
    ? \`?\$filter=SpatialDim eq '\${args.country.toUpperCase()}'\`
    : ''
  return apiFetch<unknown>(\`/\${encodeURIComponent(args.code)}\${filter}\`)
}, { method: 'get_indicator' })

const searchIndicators = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(\`/Indicator?\$filter=contains(IndicatorName,'\${encodeURIComponent(args.query)}')\`)
}, { method: 'search_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/DIMENSION/COUNTRY/DimensionValues')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, searchIndicators, listCountries }

console.log('settlegrid-who-gho MCP server ready')
console.log('Methods: get_indicator, search_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 51. settlegrid-world-bank-climate
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-bank-climate',
  title: 'World Bank Climate Data',
  desc: 'Access World Bank climate-related indicators including CO2 emissions, renewable energy, and forest data.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['world-bank', 'climate', 'emissions', 'co2', 'environment', 'renewable'],
  methods: [
    { name: 'get_climate_data', display: 'Get climate indicator data for a country', cost: 2, params: 'country, indicator',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3 or ISO2 country code (e.g. USA, GB)' },
        { name: 'indicator', type: 'string', required: true, desc: 'WB indicator code (e.g. EN.ATM.CO2E.PC for CO2 per capita)' },
      ] },
    { name: 'list_indicators', display: 'List climate-related indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'get_historical', display: 'Get historical climate variable for a country', cost: 2, params: 'country, variable',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3 country code' },
        { name: 'variable', type: 'string', required: true, desc: 'Climate variable (e.g. EN.ATM.CO2E.KT, AG.LND.FRST.ZS)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-world-bank-climate — World Bank Climate Data MCP Server
 *
 * Wraps the World Bank API (climate indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_climate_data(country, indicator)  — Get climate data (2\\u00A2)
 *   list_indicators()                     — List climate indicators (1\\u00A2)
 *   get_historical(country, variable)     — Get historical data (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClimateDataInput {
  country: string
  indicator: string
}

interface HistoricalInput {
  country: string
  variable: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-climate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const CLIMATE_INDICATORS = [
  'EN.ATM.CO2E.PC', 'EN.ATM.CO2E.KT', 'EG.FEC.RNEW.ZS', 'AG.LND.FRST.ZS',
  'EN.ATM.GHGT.KT.CE', 'EG.USE.PCAP.KG.OE', 'EN.ATM.PM25.MC.M3',
]

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-climate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_climate_data: { costCents: 2, displayName: 'Get climate indicator data' },
      list_indicators: { costCents: 1, displayName: 'List climate indicators' },
      get_historical: { costCents: 2, displayName: 'Get historical climate data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getClimateData = sg.wrap(async (args: ClimateDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. EN.ATM.CO2E.PC)')
  }
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${encodeURIComponent(args.indicator)}\`)
}, { method: 'get_climate_data' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: CLIMATE_INDICATORS.map(code => ({ code, url: \`\${API_BASE}/indicator/\${code}?format=json\` })),
    description: 'Climate-related World Bank indicators',
  }
}, { method: 'list_indicators' })

const getHistorical = sg.wrap(async (args: HistoricalInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  if (!args.variable || typeof args.variable !== 'string') {
    throw new Error('variable is required (WB indicator code)')
  }
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${encodeURIComponent(args.variable)}\`, {
    date: '1960:2025',
  })
}, { method: 'get_historical' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getClimateData, listIndicators, getHistorical }

console.log('settlegrid-world-bank-climate MCP server ready')
console.log('Methods: get_climate_data, list_indicators, get_historical')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 52. settlegrid-world-bank-education
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-bank-education',
  title: 'World Bank Education Data',
  desc: 'Access World Bank education indicators including enrollment, literacy, and attainment data.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['world-bank', 'education', 'enrollment', 'literacy', 'schools'],
  methods: [
    { name: 'get_enrollment', display: 'Get school enrollment data', cost: 2, params: 'country, level?, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. USA, GBR)' },
        { name: 'level', type: 'string', required: false, desc: 'Level: primary, secondary, tertiary (default: primary)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2021)' },
      ] },
    { name: 'get_literacy', display: 'Get literacy rate data', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_indicators', display: 'List education indicators', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-world-bank-education — World Bank Education Data MCP Server
 *
 * Wraps the World Bank API (education indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_enrollment(country, level?, year?)  — Get enrollment data (2\\u00A2)
 *   get_literacy(country, year?)            — Get literacy rates (2\\u00A2)
 *   list_indicators()                       — List education indicators (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnrollmentInput {
  country: string
  level?: string
  year?: string
}

interface LiteracyInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

const ENROLLMENT_INDICATORS: Record<string, string> = {
  primary: 'SE.PRM.ENRR',
  secondary: 'SE.SEC.ENRR',
  tertiary: 'SE.TER.ENRR',
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-education/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-education',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_enrollment: { costCents: 2, displayName: 'Get school enrollment data' },
      get_literacy: { costCents: 2, displayName: 'Get literacy rate data' },
      list_indicators: { costCents: 1, displayName: 'List education indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEnrollment = sg.wrap(async (args: EnrollmentInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const level = args.level?.toLowerCase() || 'primary'
  const indicator = ENROLLMENT_INDICATORS[level]
  if (!indicator) {
    throw new Error(\`Invalid level: \${level}. Use: primary, secondary, tertiary\`)
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${indicator}\`, params)
}, { method: 'get_enrollment' })

const getLiteracy = sg.wrap(async (args: LiteracyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/SE.ADT.LITR.ZS\`, params)
}, { method: 'get_literacy' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SE.PRM.ENRR', name: 'Primary school enrollment rate' },
      { code: 'SE.SEC.ENRR', name: 'Secondary school enrollment rate' },
      { code: 'SE.TER.ENRR', name: 'Tertiary school enrollment rate' },
      { code: 'SE.ADT.LITR.ZS', name: 'Adult literacy rate' },
      { code: 'SE.XPD.TOTL.GD.ZS', name: 'Education expenditure (% GDP)' },
      { code: 'SE.PRM.CMPT.ZS', name: 'Primary completion rate' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEnrollment, getLiteracy, listIndicators }

console.log('settlegrid-world-bank-education MCP server ready')
console.log('Methods: get_enrollment, get_literacy, list_indicators')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 53. settlegrid-world-bank-health
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-bank-health',
  title: 'World Bank Health Data',
  desc: 'Access World Bank health indicators including life expectancy, health spending, and mortality data.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['world-bank', 'health', 'life-expectancy', 'mortality', 'healthcare'],
  methods: [
    { name: 'get_life_expectancy', display: 'Get life expectancy data', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. USA, JPN)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2021)' },
      ] },
    { name: 'get_health_spending', display: 'Get health expenditure data', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_indicators', display: 'List health indicators', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-world-bank-health — World Bank Health Data MCP Server
 *
 * Wraps the World Bank API (health indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_life_expectancy(country, year?)   — Get life expectancy (2\\u00A2)
 *   get_health_spending(country, year?)   — Get health spending (2\\u00A2)
 *   list_indicators()                     — List health indicators (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HealthDataInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-health/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-health',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_life_expectancy: { costCents: 2, displayName: 'Get life expectancy data' },
      get_health_spending: { costCents: 2, displayName: 'Get health expenditure data' },
      list_indicators: { costCents: 1, displayName: 'List health indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLifeExpectancy = sg.wrap(async (args: HealthDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/SP.DYN.LE00.IN\`, params)
}, { method: 'get_life_expectancy' })

const getHealthSpending = sg.wrap(async (args: HealthDataInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/SH.XPD.CHEX.GD.ZS\`, params)
}, { method: 'get_health_spending' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SP.DYN.LE00.IN', name: 'Life expectancy at birth' },
      { code: 'SH.XPD.CHEX.GD.ZS', name: 'Current health expenditure (% GDP)' },
      { code: 'SP.DYN.IMRT.IN', name: 'Infant mortality rate' },
      { code: 'SH.MED.PHYS.ZS', name: 'Physicians per 1,000 people' },
      { code: 'SH.MED.BEDS.ZS', name: 'Hospital beds per 1,000 people' },
      { code: 'SH.STA.MMRT', name: 'Maternal mortality ratio' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLifeExpectancy, getHealthSpending, listIndicators }

console.log('settlegrid-world-bank-health MCP server ready')
console.log('Methods: get_life_expectancy, get_health_spending, list_indicators')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 54. settlegrid-world-bank-poverty
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-bank-poverty',
  title: 'World Bank Poverty Data',
  desc: 'Access World Bank poverty indicators including poverty headcount, GINI coefficient, and income data.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392' },
  key: null,
  keywords: ['world-bank', 'poverty', 'inequality', 'gini', 'income'],
  methods: [
    { name: 'get_poverty_rate', display: 'Get poverty headcount ratio', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. IND, NGA)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2019)' },
      ] },
    { name: 'get_gini', display: 'Get GINI coefficient', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_indicators', display: 'List poverty indicators', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-world-bank-poverty — World Bank Poverty Data MCP Server
 *
 * Wraps the World Bank API (poverty indicators) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_poverty_rate(country, year?)  — Get poverty rate (2\\u00A2)
 *   get_gini(country, year?)          — Get GINI coefficient (2\\u00A2)
 *   list_indicators()                 — List poverty indicators (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PovertyInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-bank-poverty/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-bank-poverty',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_poverty_rate: { costCents: 2, displayName: 'Get poverty headcount ratio' },
      get_gini: { costCents: 2, displayName: 'Get GINI coefficient' },
      list_indicators: { costCents: 1, displayName: 'List poverty indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPovertyRate = sg.wrap(async (args: PovertyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/SI.POV.DDAY\`, params)
}, { method: 'get_poverty_rate' })

const getGini = sg.wrap(async (args: PovertyInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/SI.POV.GINI\`, params)
}, { method: 'get_gini' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { code: 'SI.POV.DDAY', name: 'Poverty headcount ratio at $2.15/day (%)' },
      { code: 'SI.POV.GINI', name: 'GINI index' },
      { code: 'SI.POV.NAHC', name: 'Poverty headcount ratio at national poverty lines (%)' },
      { code: 'SI.DST.10TH.10', name: 'Income share held by highest 10%' },
      { code: 'SI.DST.FRST.10', name: 'Income share held by lowest 10%' },
      { code: 'NY.GNP.PCAP.CD', name: 'GNI per capita (current US$)' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPovertyRate, getGini, listIndicators }

console.log('settlegrid-world-bank-poverty MCP server ready')
console.log('Methods: get_poverty_rate, get_gini, list_indicators')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 55. settlegrid-imf-weo
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'imf-weo',
  title: 'IMF World Economic Outlook',
  desc: 'Access IMF World Economic Outlook data including GDP, inflation, and economic forecasts.',
  api: { base: 'https://www.imf.org/external/datamapper/api/v1', name: 'IMF DataMapper API', docs: 'https://www.imf.org/external/datamapper/api/help' },
  key: null,
  keywords: ['imf', 'economy', 'gdp', 'inflation', 'forecast', 'weo'],
  methods: [
    { name: 'get_indicator', display: 'Get WEO indicator data', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'WEO indicator code (e.g. NGDP_RPCH for GDP growth)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code (e.g. USA, CHN)' },
      ] },
    { name: 'list_indicators', display: 'List WEO indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List available countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-imf-weo — IMF World Economic Outlook MCP Server
 *
 * Wraps the IMF DataMapper API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicator(indicator, country?)  — Get WEO data (2\\u00A2)
 *   list_indicators()                   — List indicators (1\\u00A2)
 *   list_countries()                    — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.imf.org/external/datamapper/api/v1'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-imf-weo/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`IMF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'imf-weo',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicator: { costCents: 2, displayName: 'Get WEO indicator data' },
      list_indicators: { costCents: 1, displayName: 'List WEO indicators' },
      list_countries: { costCents: 1, displayName: 'List available countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. NGDP_RPCH for GDP growth)')
  }
  const path = args.country
    ? \`/\${encodeURIComponent(args.indicator)}/\${encodeURIComponent(args.country.toUpperCase())}\`
    : \`/\${encodeURIComponent(args.indicator)}\`
  return apiFetch<unknown>(path)
}, { method: 'get_indicator' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/indicators')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicator, listIndicators, listCountries }

console.log('settlegrid-imf-weo MCP server ready')
console.log('Methods: get_indicator, list_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 56. settlegrid-oecd-education
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'oecd-education',
  title: 'OECD Education Statistics',
  desc: 'Access OECD education statistics via the OECD SDMX API.',
  api: { base: 'https://sdmx.oecd.org/public/rest', name: 'OECD SDMX API', docs: 'https://data.oecd.org/api/' },
  key: null,
  keywords: ['oecd', 'education', 'pisa', 'schools', 'learning'],
  methods: [
    { name: 'get_data', display: 'Get education dataset', cost: 2, params: 'dataset, country?',
      inputs: [
        { name: 'dataset', type: 'string', required: true, desc: 'OECD dataset ID (e.g. EDU_ENRL_AGE, EDU_FINANCE)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code (e.g. USA, FRA)' },
      ] },
    { name: 'search_datasets', display: 'Search OECD education datasets', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search term (e.g. "enrollment", "pisa")' },
      ] },
    { name: 'list_countries', display: 'List OECD member countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-oecd-education — OECD Education Statistics MCP Server
 *
 * Wraps the OECD SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, country?)     — Get education data (2\\u00A2)
 *   search_datasets(query)          — Search datasets (1\\u00A2)
 *   list_countries()                — List OECD countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  country?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.oecd.org/public/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-oecd-education/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OECD API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-education',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get OECD education data' },
      search_datasets: { costCents: 1, displayName: 'Search education datasets' },
      list_countries: { costCents: 1, displayName: 'List OECD member countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. EDU_ENRL_AGE)')
  }
  const key = args.country ? args.country.toUpperCase() : 'all'
  return apiFetch<unknown>(\`/data/OECD.EDU,DSD_EDU@\${encodeURIComponent(args.dataset)},1.0/\${key}?lastNObservations=10\`)
}, { method: 'get_data' })

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/dataflow/OECD.EDU?detail=allstubs')
}, { method: 'search_datasets' })

const listCountries = sg.wrap(async () => {
  return {
    countries: [
      'AUS','AUT','BEL','CAN','CHL','COL','CRI','CZE','DNK','EST',
      'FIN','FRA','DEU','GRC','HUN','ISL','IRL','ISR','ITA','JPN',
      'KOR','LVA','LTU','LUX','MEX','NLD','NZL','NOR','POL','PRT',
      'SVK','SVN','ESP','SWE','CHE','TUR','GBR','USA',
    ],
    description: 'OECD member country ISO3 codes',
  }
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, searchDatasets, listCountries }

console.log('settlegrid-oecd-education MCP server ready')
console.log('Methods: get_data, search_datasets, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 57. settlegrid-oecd-health
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'oecd-health',
  title: 'OECD Health Statistics',
  desc: 'Access OECD health statistics via the OECD SDMX API.',
  api: { base: 'https://sdmx.oecd.org/public/rest', name: 'OECD SDMX API', docs: 'https://data.oecd.org/api/' },
  key: null,
  keywords: ['oecd', 'health', 'healthcare', 'hospitals', 'doctors'],
  methods: [
    { name: 'get_health_data', display: 'Get health indicator data', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'Health dataflow ID (e.g. HEALTH_STAT, HEALTH_REAC)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code' },
      ] },
    { name: 'list_indicators', display: 'List OECD health dataflows', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List OECD countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-oecd-health — OECD Health Statistics MCP Server
 *
 * Wraps the OECD SDMX API (health) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_health_data(indicator, country?)  — Get health data (2\\u00A2)
 *   list_indicators()                     — List health dataflows (1\\u00A2)
 *   list_countries()                      — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HealthDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.oecd.org/public/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-oecd-health/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OECD API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-health',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_health_data: { costCents: 2, displayName: 'Get OECD health data' },
      list_indicators: { costCents: 1, displayName: 'List health dataflows' },
      list_countries: { costCents: 1, displayName: 'List OECD countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHealthData = sg.wrap(async (args: HealthDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (OECD health dataflow ID)')
  }
  const key = args.country ? args.country.toUpperCase() : 'all'
  return apiFetch<unknown>(\`/data/OECD.ELS.HD,DSD_HEALTH_STAT@\${encodeURIComponent(args.indicator)},1.0/\${key}?lastNObservations=10\`)
}, { method: 'get_health_data' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/OECD.ELS.HD?detail=allstubs')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return {
    countries: [
      'AUS','AUT','BEL','CAN','CHL','COL','CRI','CZE','DNK','EST',
      'FIN','FRA','DEU','GRC','HUN','ISL','IRL','ISR','ITA','JPN',
      'KOR','LVA','LTU','LUX','MEX','NLD','NZL','NOR','POL','PRT',
      'SVK','SVN','ESP','SWE','CHE','TUR','GBR','USA',
    ],
    description: 'OECD member country ISO3 codes',
  }
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHealthData, listIndicators, listCountries }

console.log('settlegrid-oecd-health MCP server ready')
console.log('Methods: get_health_data, list_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 58. settlegrid-oecd-environment
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'oecd-environment',
  title: 'OECD Environment Statistics',
  desc: 'Access OECD environment statistics via the OECD SDMX API.',
  api: { base: 'https://sdmx.oecd.org/public/rest', name: 'OECD SDMX API', docs: 'https://data.oecd.org/api/' },
  key: null,
  keywords: ['oecd', 'environment', 'emissions', 'waste', 'water', 'pollution'],
  methods: [
    { name: 'get_environment_data', display: 'Get environment indicator data', cost: 2, params: 'indicator, country?',
      inputs: [
        { name: 'indicator', type: 'string', required: true, desc: 'Environment dataflow ID (e.g. AIR_GHG, WASTE)' },
        { name: 'country', type: 'string', required: false, desc: 'ISO3 country code' },
      ] },
    { name: 'list_indicators', display: 'List environment dataflows', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List OECD countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-oecd-environment — OECD Environment Statistics MCP Server
 *
 * Wraps the OECD SDMX API (environment) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_environment_data(indicator, country?)  — Get data (2\\u00A2)
 *   list_indicators()                          — List dataflows (1\\u00A2)
 *   list_countries()                           — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnvDataInput {
  indicator: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://sdmx.oecd.org/public/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-oecd-environment/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`OECD API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'oecd-environment',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_environment_data: { costCents: 2, displayName: 'Get environment data' },
      list_indicators: { costCents: 1, displayName: 'List environment dataflows' },
      list_countries: { costCents: 1, displayName: 'List OECD countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEnvironmentData = sg.wrap(async (args: EnvDataInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (OECD environment dataflow ID)')
  }
  const key = args.country ? args.country.toUpperCase() : 'all'
  return apiFetch<unknown>(\`/data/OECD.ENV,DSD_ENV@\${encodeURIComponent(args.indicator)},1.0/\${key}?lastNObservations=10\`)
}, { method: 'get_environment_data' })

const listIndicators = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/OECD.ENV?detail=allstubs')
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return {
    countries: [
      'AUS','AUT','BEL','CAN','CHL','COL','CRI','CZE','DNK','EST',
      'FIN','FRA','DEU','GRC','HUN','ISL','IRL','ISR','ITA','JPN',
      'KOR','LVA','LTU','LUX','MEX','NLD','NZL','NOR','POL','PRT',
      'SVK','SVN','ESP','SWE','CHE','TUR','GBR','USA',
    ],
    description: 'OECD member country ISO3 codes',
  }
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEnvironmentData, listIndicators, listCountries }

console.log('settlegrid-oecd-environment MCP server ready')
console.log('Methods: get_environment_data, list_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 59. settlegrid-bis-banking
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'bis-banking',
  title: 'Bank for Intl Settlements Data',
  desc: 'Access Bank for International Settlements financial statistics via the BIS SDMX API.',
  api: { base: 'https://data.bis.org/api/v2', name: 'BIS SDMX API', docs: 'https://data.bis.org/' },
  key: null,
  keywords: ['bis', 'banking', 'finance', 'central-bank', 'credit', 'debt'],
  methods: [
    { name: 'get_data', display: 'Get BIS dataset data', cost: 2, params: 'dataset, key?',
      inputs: [
        { name: 'dataset', type: 'string', required: true, desc: 'BIS dataset ID (e.g. WS_CBPOL_D, WS_XRU_D)' },
        { name: 'key', type: 'string', required: false, desc: 'Series key filter (e.g. "A.US")' },
      ] },
    { name: 'list_datasets', display: 'List available BIS datasets', cost: 1, params: '',
      inputs: [] },
    { name: 'search_data', display: 'Search BIS data', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "exchange rates", "credit")' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-bis-banking — Bank for Intl Settlements Data MCP Server
 *
 * Wraps the BIS SDMX API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_data(dataset, key?)   — Get BIS data (2\\u00A2)
 *   list_datasets()           — List datasets (1\\u00A2)
 *   search_data(query)        — Search data (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDataInput {
  dataset: string
  key?: string
}

interface SearchInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.bis.org/api/v2'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.sdmx.data+json;version=1.0.0-wd',
      'User-Agent': 'settlegrid-bis-banking/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`BIS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bis-banking',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get BIS dataset data' },
      list_datasets: { costCents: 1, displayName: 'List available datasets' },
      search_data: { costCents: 1, displayName: 'Search BIS data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. WS_CBPOL_D, WS_XRU_D)')
  }
  const key = args.key || 'all'
  return apiFetch<unknown>(\`/data/BIS,\${encodeURIComponent(args.dataset)},1.0/\${encodeURIComponent(key)}?lastNObservations=20\`)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('/dataflow/BIS?detail=allstubs')
}, { method: 'list_datasets' })

const searchData = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>('/dataflow/BIS?detail=full')
}, { method: 'search_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, searchData }

console.log('settlegrid-bis-banking MCP server ready')
console.log('Methods: get_data, list_datasets, search_data')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 60. settlegrid-fatf-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'fatf-data',
  title: 'FATF Country Assessments',
  desc: 'Access FATF anti-money laundering country assessments and ratings data.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (FATF proxy)', docs: 'https://www.fatf-gafi.org/' },
  key: null,
  keywords: ['fatf', 'aml', 'money-laundering', 'compliance', 'financial-crime'],
  methods: [
    { name: 'list_countries', display: 'List countries with AML data', cost: 1, params: '',
      inputs: [] },
    { name: 'get_assessment', display: 'Get AML assessment for a country', cost: 2, params: 'country',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. USA, GBR)' },
      ] },
    { name: 'get_ratings', display: 'Get financial regulation ratings', cost: 2, params: 'country',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-fatf-data — FATF Country Assessments MCP Server
 *
 * Wraps World Bank regulatory quality indicators as FATF data proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   list_countries()           — List countries (1\\u00A2)
 *   get_assessment(country)    — Get assessment (2\\u00A2)
 *   get_ratings(country)       — Get ratings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CountryInput {
  country: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '50')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fatf-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fatf-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_countries: { costCents: 1, displayName: 'List countries with AML data' },
      get_assessment: { costCents: 2, displayName: 'Get AML assessment for a country' },
      get_ratings: { costCents: 2, displayName: 'Get financial regulation ratings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getAssessment = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  // RQ.EST = Regulatory Quality Estimate (proxy for AML compliance)
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/RQ.EST\`)
}, { method: 'get_assessment' })

const getRatings = sg.wrap(async (args: CountryInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  // RL.EST = Rule of Law Estimate
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/RL.EST\`)
}, { method: 'get_ratings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listCountries, getAssessment, getRatings }

console.log('settlegrid-fatf-data MCP server ready')
console.log('Methods: list_countries, get_assessment, get_ratings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 61. settlegrid-transparency-intl
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'transparency-intl',
  title: 'Corruption Perceptions Index',
  desc: 'Access Corruption Perceptions Index data via World Bank governance indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (CPI proxy)', docs: 'https://www.transparency.org/en/cpi' },
  key: null,
  keywords: ['transparency', 'corruption', 'cpi', 'governance', 'integrity'],
  methods: [
    { name: 'get_cpi', display: 'Get corruption control score', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. USA, NGA)' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get corruption control rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-transparency-intl — Corruption Perceptions Index MCP Server
 *
 * Wraps World Bank Control of Corruption indicator (CC.EST) as CPI proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_cpi(country, year?)       — Get corruption score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CpiInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'CC.EST' // Control of Corruption Estimate

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-transparency-intl/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'transparency-intl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_cpi: { costCents: 2, displayName: 'Get corruption control score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get corruption rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCpi = sg.wrap(async (args: CpiInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_cpi' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCpi, listCountries, getRankings }

console.log('settlegrid-transparency-intl MCP server ready')
console.log('Methods: get_cpi, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 62. settlegrid-freedom-house
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'freedom-house',
  title: 'Freedom Index Data',
  desc: 'Access freedom and democracy index data via World Bank governance indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (Freedom proxy)', docs: 'https://freedomhouse.org/' },
  key: null,
  keywords: ['freedom', 'democracy', 'civil-liberties', 'political-rights', 'governance'],
  methods: [
    { name: 'get_score', display: 'Get Voice & Accountability score', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code (e.g. USA, RUS)' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get freedom rankings', cost: 2, params: 'year?, category?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
        { name: 'category', type: 'string', required: false, desc: 'Indicator: voice_accountability (default), political_stability' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-freedom-house — Freedom Index Data MCP Server
 *
 * Wraps World Bank Voice & Accountability indicator (VA.EST) as freedom proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)            — Get freedom score (2\\u00A2)
 *   list_countries(year?)                — List countries (1\\u00A2)
 *   get_rankings(year?, category?)       — Get rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface RankingsInput {
  year?: string
  category?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

const INDICATORS: Record<string, string> = {
  voice_accountability: 'VA.EST',
  political_stability: 'PV.EST',
}

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-freedom-house/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'freedom-house',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get freedom score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get freedom rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/VA.EST\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: { year?: string }) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: RankingsInput) => {
  const cat = args.category?.toLowerCase() || 'voice_accountability'
  const indicator = INDICATORS[cat] || 'VA.EST'
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${indicator}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-freedom-house MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 63. settlegrid-heritage-economic
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'heritage-economic',
  title: 'Economic Freedom Index',
  desc: 'Access Economic Freedom Index data via World Bank ease of doing business and trade indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (Economic Freedom proxy)', docs: 'https://www.heritage.org/index/' },
  key: null,
  keywords: ['heritage', 'economic-freedom', 'business', 'trade', 'regulation'],
  methods: [
    { name: 'get_score', display: 'Get trade freedom indicator', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get economic freedom rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-heritage-economic — Economic Freedom Index MCP Server
 *
 * Wraps World Bank trade/business indicators as economic freedom proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get economic freedom score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'IC.BUS.EASE.XQ' // Ease of Doing Business rank

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-heritage-economic/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'heritage-economic',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get economic freedom score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get economic freedom rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-heritage-economic MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 64. settlegrid-v-dem
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'v-dem',
  title: 'Democracy Indices',
  desc: 'Access democracy indices and governance data via World Bank governance indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (V-Dem proxy)', docs: 'https://v-dem.net/' },
  key: null,
  keywords: ['vdem', 'democracy', 'governance', 'elections', 'political'],
  methods: [
    { name: 'get_index', display: 'Get democracy governance index', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_indicators', display: 'List governance indicators', cost: 1, params: '',
      inputs: [] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-v-dem — Democracy Indices MCP Server
 *
 * Wraps World Bank governance indicators as democracy index proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_index(country, year?)   — Get democracy index (2\\u00A2)
 *   list_indicators()           — List governance indicators (1\\u00A2)
 *   list_countries()            — List countries (1\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface IndexInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

const GOV_INDICATORS = [
  { code: 'VA.EST', name: 'Voice and Accountability' },
  { code: 'PV.EST', name: 'Political Stability' },
  { code: 'GE.EST', name: 'Government Effectiveness' },
  { code: 'RQ.EST', name: 'Regulatory Quality' },
  { code: 'RL.EST', name: 'Rule of Law' },
  { code: 'CC.EST', name: 'Control of Corruption' },
]

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '100')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-v-dem/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'v-dem',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_index: { costCents: 2, displayName: 'Get democracy governance index' },
      list_indicators: { costCents: 1, displayName: 'List governance indicators' },
      list_countries: { costCents: 1, displayName: 'List countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndex = sg.wrap(async (args: IndexInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  // VA.EST = Voice and Accountability (core democracy indicator)
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/VA.EST\`, params)
}, { method: 'get_index' })

const listIndicators = sg.wrap(async () => {
  return { indicators: GOV_INDICATORS, description: 'World Bank Governance Indicators (democracy proxies)' }
}, { method: 'list_indicators' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndex, listIndicators, listCountries }

console.log('settlegrid-v-dem MCP server ready')
console.log('Methods: get_index, list_indicators, list_countries')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 65. settlegrid-global-peace
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'global-peace',
  title: 'Global Peace Index',
  desc: 'Access Global Peace Index data via World Bank political stability indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (GPI proxy)', docs: 'https://www.visionofhumanity.org/maps/' },
  key: null,
  keywords: ['peace', 'conflict', 'security', 'violence', 'stability'],
  methods: [
    { name: 'get_score', display: 'Get political stability score', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get peace/stability rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-global-peace — Global Peace Index MCP Server
 *
 * Wraps World Bank Political Stability indicator (PV.EST) as GPI proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get peace score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'PV.EST' // Political Stability and Absence of Violence

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-global-peace/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'global-peace',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get peace/stability score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get peace rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-global-peace MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 66. settlegrid-human-development
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'human-development',
  title: 'Human Development Index',
  desc: 'Access Human Development Index data via the UNDP HDR API.',
  api: { base: 'https://hdr.undp.org/data-center/api', name: 'UNDP HDR API', docs: 'https://hdr.undp.org/data-center' },
  key: null,
  keywords: ['hdi', 'undp', 'development', 'human-development', 'welfare'],
  methods: [
    { name: 'get_hdi', display: 'Get HDI for a country', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO3 country code (e.g. USA, NOR)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. 2022)' },
      ] },
    { name: 'list_countries', display: 'List countries with HDI data', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get HDI rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-human-development — Human Development Index MCP Server
 *
 * Wraps the UNDP HDR API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_hdi(country, year?)     — Get HDI data (2\\u00A2)
 *   list_countries(year?)       — List countries (1\\u00A2)
 *   get_rankings(year?)         — Get HDI rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HdiInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://hdr.undp.org/data-center/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-human-development/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UNDP HDR API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'human-development',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_hdi: { costCents: 2, displayName: 'Get HDI for a country' },
      list_countries: { costCents: 1, displayName: 'List countries with HDI data' },
      get_rankings: { costCents: 2, displayName: 'Get HDI rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHdi = sg.wrap(async (args: HdiInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO3 country code, e.g. USA)')
  }
  const params: Record<string, string> = {
    indicator_id: '137506',
    country_code: args.country.toUpperCase(),
  }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/indicator-data', params)
}, { method: 'get_hdi' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/countries')
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = { indicator_id: '137506' }
  if (args.year) params.year = args.year
  return apiFetch<unknown>('/indicator-data', params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHdi, listCountries, getRankings }

console.log('settlegrid-human-development MCP server ready')
console.log('Methods: get_hdi, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 67. settlegrid-world-happiness
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'world-happiness',
  title: 'World Happiness Report',
  desc: 'Access World Happiness Report data via World Bank life satisfaction and GDP indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (WHR proxy)', docs: 'https://worldhappiness.report/' },
  key: null,
  keywords: ['happiness', 'wellbeing', 'life-satisfaction', 'quality-of-life'],
  methods: [
    { name: 'get_score', display: 'Get GDP per capita (welfare proxy)', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get welfare rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-world-happiness — World Happiness Report MCP Server
 *
 * Wraps World Bank GDP per capita and social indicators as happiness proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get welfare score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'NY.GDP.PCAP.PP.CD' // GDP per capita, PPP (proxy for welfare)

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-world-happiness/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'world-happiness',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get welfare score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get welfare rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-world-happiness MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 68. settlegrid-press-freedom
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'press-freedom',
  title: 'Press Freedom Index',
  desc: 'Access Press Freedom Index data via World Bank governance and voice/accountability indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (Press Freedom proxy)', docs: 'https://rsf.org/' },
  key: null,
  keywords: ['press-freedom', 'media', 'journalism', 'censorship', 'rsf'],
  methods: [
    { name: 'get_score', display: 'Get press freedom score', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get press freedom rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-press-freedom — Press Freedom Index MCP Server
 *
 * Wraps World Bank Voice & Accountability indicator (VA.PER.RNK) as press freedom proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get press freedom score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get press freedom rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'VA.PER.RNK' // Voice and Accountability Percentile Rank

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-press-freedom/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'press-freedom',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get press freedom score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get press freedom rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-press-freedom MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 69. settlegrid-fragile-states
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'fragile-states',
  title: 'Fragile States Index',
  desc: 'Access Fragile States Index data via World Bank governance and stability indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (FSI proxy)', docs: 'https://fragilestatesindex.org/' },
  key: null,
  keywords: ['fragile-states', 'conflict', 'instability', 'failed-states', 'governance'],
  methods: [
    { name: 'get_score', display: 'Get state fragility score', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get fragility rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-fragile-states — Fragile States Index MCP Server
 *
 * Wraps World Bank Government Effectiveness indicator (GE.EST) as FSI proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get fragility score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get fragility rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'GE.EST' // Government Effectiveness Estimate

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fragile-states/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fragile-states',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get state fragility score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get fragility rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-fragile-states MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 70. settlegrid-gender-gap
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'gender-gap',
  title: 'Gender Gap Index',
  desc: 'Access gender gap and equality data via World Bank gender-related indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API (Gender Gap proxy)', docs: 'https://www.weforum.org/publications/global-gender-gap-report/' },
  key: null,
  keywords: ['gender', 'equality', 'wef', 'women', 'gender-gap'],
  methods: [
    { name: 'get_score', display: 'Get gender parity indicator', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
    { name: 'list_countries', display: 'List countries', cost: 1, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year filter' },
      ] },
    { name: 'get_rankings', display: 'Get gender parity rankings', cost: 2, params: 'year?',
      inputs: [
        { name: 'year', type: 'string', required: false, desc: 'Year' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-gender-gap — Gender Gap Index MCP Server
 *
 * Wraps World Bank gender parity indicators as gender gap proxy.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_score(country, year?)     — Get gender parity score (2\\u00A2)
 *   list_countries(year?)         — List countries (1\\u00A2)
 *   get_rankings(year?)           — Get gender parity rankings (2\\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreInput {
  country: string
  year?: string
}

interface ListInput {
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const INDICATOR = 'SG.GEN.PARL.ZS' // Proportion of seats held by women in parliament

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '300')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-gender-gap/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gender-gap',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_score: { costCents: 2, displayName: 'Get gender parity score' },
      list_countries: { costCents: 1, displayName: 'List countries' },
      get_rankings: { costCents: 2, displayName: 'Get gender parity rankings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getScore = sg.wrap(async (args: ScoreInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO country code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`/country/\${encodeURIComponent(args.country)}/indicator/\${INDICATOR}\`, params)
}, { method: 'get_score' })

const listCountries = sg.wrap(async (args: ListInput) => {
  return apiFetch<unknown>('/country', { per_page: '300' })
}, { method: 'list_countries' })

const getRankings = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  else params.mrnev = '1'
  return apiFetch<unknown>(\`/country/all/indicator/\${INDICATOR}\`, params)
}, { method: 'get_rankings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getScore, listCountries, getRankings }

console.log('settlegrid-gender-gap MCP server ready')
console.log('Methods: get_score, list_countries, get_rankings')
console.log('Pricing: 1-2\\u00A2 per call | Powered by SettleGrid')
`,
})

console.log('\nBatch 3b complete!')
