/**
 * Batch 3a — 40 International Government Data MCP servers
 */

import { gen } from './core.mjs'

console.log('Batch 3a: International Government Data servers\n')

// ────────────────────────────────────────────────────────────────────────────
// Helper: build a CKAN-based server (many portals use the same CKAN API)
// ────────────────────────────────────────────────────────────────────────────

function ckanServer(slug, title, desc, apiBase, apiName, docs) {
  const serverTs = `/**
 * settlegrid-${slug} — ${title} MCP Server
 *
 * Wraps ${apiName} with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_organizations(limit?)             — List organizations (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListOrganizationsInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = '${apiBase}'
const USER_AGENT = 'settlegrid-${slug}/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const res = await fetch(url.toString(), { method: options.method ?? 'GET', headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`${apiName} API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: '${slug}',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search ${title} datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_organizations: { costCents: 1, displayName: 'List publishing organizations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/package_search', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>('/action/package_show', {
    params: { id: args.id },
  })
  return data
}, { method: 'get_dataset' })

const listOrganizations = sg.wrap(async (args: ListOrganizationsInput) => {
  const params: Record<string, string> = { all_fields: 'true' }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/organization_list', { params })
  return data
}, { method: 'list_organizations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listOrganizations }

console.log('settlegrid-${slug} MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
  return {
    slug,
    title,
    desc,
    api: { base: apiBase, name: apiName, docs },
    key: null,
    keywords: ['government', 'open-data', 'datasets', slug.split('-')[0]],
    methods: [
      {
        name: 'search_datasets', display: `Search ${title} datasets`, cost: 1,
        params: 'query, limit?',
        inputs: [
          { name: 'query', type: 'string', required: true, desc: 'Search query' },
          { name: 'limit', type: 'number', required: false, desc: 'Max results to return' },
        ],
      },
      {
        name: 'get_dataset', display: 'Get dataset details by ID', cost: 1,
        params: 'id',
        inputs: [
          { name: 'id', type: 'string', required: true, desc: 'Dataset identifier' },
        ],
      },
      {
        name: 'list_organizations', display: 'List publishing organizations', cost: 1,
        params: 'limit?',
        inputs: [
          { name: 'limit', type: 'number', required: false, desc: 'Max results to return' },
        ],
      },
    ],
    serverTs,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: World Bank country-based server
// ────────────────────────────────────────────────────────────────────────────

function worldBankServer(slug, title, countryCode, desc, method3Name, method3Display, method3Indicator, method3ParamName) {
  const serverTs = `/**
 * settlegrid-${slug} — ${title} MCP Server
 *
 * Wraps World Bank API (${countryCode} subset) with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   get_indicators(indicator)              — Get indicator data (1¢)
 *   list_indicators(topic?)                — List available indicators (1¢)
 *   ${method3Name}(${method3ParamName}?)   — ${method3Display} (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetIndicatorsInput {
  indicator: string
  per_page?: number
}

interface ListIndicatorsInput {
  topic?: string
  per_page?: number
}

interface ${capitalize(method3Name)}Input {
  ${method3ParamName}?: string
  per_page?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = '${countryCode}'
const USER_AGENT = 'settlegrid-${slug}/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    ...options.headers,
  }
  const res = await fetch(url.toString(), { method: options.method ?? 'GET', headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: '${slug}',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_indicators: { costCents: 1, displayName: 'Get indicator data for ${title.split(' ')[0]}' },
      list_indicators: { costCents: 1, displayName: 'List available indicators' },
      ${method3Name}: { costCents: 1, displayName: '${method3Display}' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getIndicators = sg.wrap(async (args: GetIndicatorsInput) => {
  if (!args.indicator || typeof args.indicator !== 'string') {
    throw new Error('indicator is required (e.g. NY.GDP.MKTP.CD)')
  }
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.indicator}\`, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicators' })

const listIndicators = sg.wrap(async (args: ListIndicatorsInput) => {
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  let path = '/indicator'
  if (args.topic) path = \`/topic/\${args.topic}/indicator\`
  const data = await apiFetch<unknown[]>(path, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], indicators: data[1] } : data
}, { method: 'list_indicators' })

const ${camelCase(method3Name)} = sg.wrap(async (args: ${capitalize(method3Name)}Input) => {
  const params: Record<string, string> = {}
  if (args.per_page !== undefined) params['per_page'] = String(args.per_page)
  if (args.${method3ParamName}) params['date'] = args.${method3ParamName}
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/${method3Indicator}\`, { params })
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: '${method3Name}' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getIndicators, listIndicators, ${camelCase(method3Name)} }

console.log('settlegrid-${slug} MCP server ready')
console.log('Methods: get_indicators, list_indicators, ${method3Name}')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`
  return {
    slug,
    title,
    desc,
    api: { base: `https://api.worldbank.org/v2/country/${countryCode}`, name: `World Bank API (${countryCode})`, docs: `https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api` },
    key: null,
    keywords: ['government', 'statistics', 'world-bank', 'economics', slug.split('-')[0]],
    methods: [
      {
        name: 'get_indicators', display: `Get indicator data for ${title}`, cost: 1,
        params: 'indicator, per_page?',
        inputs: [
          { name: 'indicator', type: 'string', required: true, desc: 'World Bank indicator code (e.g. NY.GDP.MKTP.CD)' },
          { name: 'per_page', type: 'number', required: false, desc: 'Results per page' },
        ],
      },
      {
        name: 'list_indicators', display: 'List available World Bank indicators', cost: 1,
        params: 'topic?, per_page?',
        inputs: [
          { name: 'topic', type: 'string', required: false, desc: 'Topic ID to filter indicators' },
          { name: 'per_page', type: 'number', required: false, desc: 'Results per page' },
        ],
      },
      {
        name: method3Name, display: method3Display, cost: 1,
        params: `${method3ParamName}?, per_page?`,
        inputs: [
          { name: method3ParamName, type: 'string', required: false, desc: 'Year or date range (e.g. 2020 or 2015:2020)' },
          { name: 'per_page', type: 'number', required: false, desc: 'Results per page' },
        ],
      },
    ],
    serverTs,
  }
}

function capitalize(s) {
  return s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('')
}

function camelCase(s) {
  const parts = s.split('_')
  return parts[0] + parts.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('')
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. UK Government Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'uk-gov-data',
  'UK Government Datasets',
  'Access UK government open datasets via CKAN API. Search, browse and retrieve public sector data.',
  'https://ckan.publishing.service.gov.uk/api/3',
  'UK Government CKAN',
  'https://guidance.data.gov.uk/get_data/api_documentation/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 2. UK NHS
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'uk-nhs',
  title: 'NHS Health Data',
  desc: 'Search NHS health conditions, symptoms and medicines via the NHS API.',
  api: { base: 'https://api.nhs.uk', name: 'NHS Conditions API', docs: 'https://developer.api.nhs.uk/' },
  key: null,
  keywords: ['health', 'nhs', 'uk', 'medical', 'conditions', 'medicines'],
  methods: [
    {
      name: 'search_conditions', display: 'Search health conditions', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term for conditions' }],
    },
    {
      name: 'get_condition', display: 'Get condition details', cost: 1,
      params: 'slug',
      inputs: [{ name: 'slug', type: 'string', required: true, desc: 'Condition slug (e.g. diabetes)' }],
    },
    {
      name: 'list_medicines', display: 'List medicines', cost: 1,
      params: 'letter?',
      inputs: [{ name: 'letter', type: 'string', required: false, desc: 'Filter by first letter (A-Z)' }],
    },
  ],
  serverTs: `/**
 * settlegrid-uk-nhs — NHS Health Data MCP Server
 *
 * Wraps NHS Conditions API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_conditions(query)               — Search health conditions (1¢)
 *   get_condition(slug)                    — Get condition details (1¢)
 *   list_medicines(letter?)                — List medicines (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchConditionsInput {
  query: string
}

interface GetConditionInput {
  slug: string
}

interface ListMedicinesInput {
  letter?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nhs.uk'
const USER_AGENT = 'settlegrid-uk-nhs/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'subscription-key': 'none',
    ...options.headers,
  }
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NHS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-nhs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_conditions: { costCents: 1, displayName: 'Search NHS health conditions' },
      get_condition: { costCents: 1, displayName: 'Get condition details' },
      list_medicines: { costCents: 1, displayName: 'List NHS medicines' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchConditions = sg.wrap(async (args: SearchConditionsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/conditions', {
    params: { category: args.query },
  })
  return data
}, { method: 'search_conditions' })

const getCondition = sg.wrap(async (args: GetConditionInput) => {
  if (!args.slug || typeof args.slug !== 'string') {
    throw new Error('slug is required (e.g. diabetes)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/conditions/\${encodeURIComponent(args.slug)}\`)
  return data
}, { method: 'get_condition' })

const listMedicines = sg.wrap(async (args: ListMedicinesInput) => {
  const path = args.letter ? \`/medicines?letter=\${encodeURIComponent(args.letter)}\` : '/medicines'
  const data = await apiFetch<Record<string, unknown>>(path)
  return data
}, { method: 'list_medicines' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchConditions, getCondition, listMedicines }

console.log('settlegrid-uk-nhs MCP server ready')
console.log('Methods: search_conditions, get_condition, list_medicines')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. UK Transport
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'uk-transport',
  title: 'UK Transport Data',
  desc: 'Get UK train departures, station searches, and bus times via TransportAPI.',
  api: { base: 'https://transportapi.com/v3', name: 'TransportAPI', docs: 'https://developer.transportapi.com/' },
  key: { env: 'TRANSPORT_API_KEY', url: 'https://developer.transportapi.com/', required: true },
  keywords: ['transport', 'uk', 'trains', 'buses', 'stations', 'departures'],
  methods: [
    {
      name: 'get_departures', display: 'Get train departures', cost: 2,
      params: 'station_code',
      inputs: [{ name: 'station_code', type: 'string', required: true, desc: 'Station CRS code (e.g. PAD)' }],
    },
    {
      name: 'search_stations', display: 'Search train stations', cost: 2,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Station name search' }],
    },
    {
      name: 'get_bus_times', display: 'Get bus departure times', cost: 2,
      params: 'atcocode',
      inputs: [{ name: 'atcocode', type: 'string', required: true, desc: 'Bus stop ATCO code' }],
    },
  ],
  serverTs: `/**
 * settlegrid-uk-transport — UK Transport Data MCP Server
 *
 * Wraps TransportAPI with SettleGrid billing.
 * Free key from https://developer.transportapi.com/.
 *
 * Methods:
 *   get_departures(station_code)           — Get departures (2¢)
 *   search_stations(query)                 — Search stations (2¢)
 *   get_bus_times(atcocode)                — Get bus times (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDeparturesInput {
  station_code: string
}

interface SearchStationsInput {
  query: string
}

interface GetBusTimesInput {
  atcocode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://transportapi.com/v3'
const API_KEY = process.env.TRANSPORT_API_KEY || ''
const APP_ID = process.env.TRANSPORT_APP_ID || ''
const USER_AGENT = 'settlegrid-uk-transport/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('api_key', API_KEY)
  url.searchParams.set('app_id', APP_ID)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TransportAPI \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-transport',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_departures: { costCents: 2, displayName: 'Get train departures' },
      search_stations: { costCents: 2, displayName: 'Search train stations' },
      get_bus_times: { costCents: 2, displayName: 'Get bus departure times' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDepartures = sg.wrap(async (args: GetDeparturesInput) => {
  if (!args.station_code || typeof args.station_code !== 'string') {
    throw new Error('station_code is required (CRS code e.g. PAD)')
  }
  const code = args.station_code.toUpperCase()
  const data = await apiFetch<Record<string, unknown>>(\`/uk/train/station/\${code}/live.json\`)
  return data
}, { method: 'get_departures' })

const searchStations = sg.wrap(async (args: SearchStationsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (station name)')
  }
  const data = await apiFetch<Record<string, unknown>>('/uk/places.json', {
    params: { query: args.query, type: 'train_station' },
  })
  return data
}, { method: 'search_stations' })

const getBusTimes = sg.wrap(async (args: GetBusTimesInput) => {
  if (!args.atcocode || typeof args.atcocode !== 'string') {
    throw new Error('atcocode is required (bus stop ATCO code)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/uk/bus/stop/\${args.atcocode}/live.json\`)
  return data
}, { method: 'get_bus_times' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDepartures, searchStations, getBusTimes }

console.log('settlegrid-uk-transport MCP server ready')
console.log('Methods: get_departures, search_stations, get_bus_times')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 4. UK Police
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'uk-police',
  title: 'UK Crime Data',
  desc: 'Access UK street-level crime data, police forces and neighbourhood info.',
  api: { base: 'https://data.police.uk/api', name: 'UK Police Data API', docs: 'https://data.police.uk/docs/' },
  key: null,
  keywords: ['crime', 'police', 'uk', 'safety', 'law-enforcement'],
  methods: [
    {
      name: 'get_crimes', display: 'Get street-level crimes', cost: 1,
      params: 'lat, lon, date?',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
        { name: 'date', type: 'string', required: false, desc: 'Month (YYYY-MM)' },
      ],
    },
    {
      name: 'get_forces', display: 'List all police forces', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_neighbourhood', display: 'Get neighbourhood details', cost: 1,
      params: 'force, id',
      inputs: [
        { name: 'force', type: 'string', required: true, desc: 'Force slug' },
        { name: 'id', type: 'string', required: true, desc: 'Neighbourhood ID' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-uk-police — UK Crime Data MCP Server
 *
 * Wraps UK Police Data API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_crimes(lat, lon, date?)            — Get street-level crimes (1¢)
 *   get_forces()                           — List police forces (1¢)
 *   get_neighbourhood(force, id)           — Get neighbourhood details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCrimesInput {
  lat: number
  lon: number
  date?: string
}

interface GetForcesInput {}

interface GetNeighbourhoodInput {
  force: string
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.police.uk/api'
const USER_AGENT = 'settlegrid-uk-police/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UK Police API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-police',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_crimes: { costCents: 1, displayName: 'Get street-level crimes' },
      get_forces: { costCents: 1, displayName: 'List police forces' },
      get_neighbourhood: { costCents: 1, displayName: 'Get neighbourhood details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCrimes = sg.wrap(async (args: GetCrimesInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const params: Record<string, string> = {
    lat: String(args.lat),
    lng: String(args.lon),
  }
  if (args.date) params['date'] = args.date
  const data = await apiFetch<unknown[]>('/crimes-street/all-crime', { params })
  return { count: Array.isArray(data) ? data.length : 0, crimes: data }
}, { method: 'get_crimes' })

const getForces = sg.wrap(async (_args: GetForcesInput) => {
  const data = await apiFetch<unknown[]>('/forces')
  return { count: Array.isArray(data) ? data.length : 0, forces: data }
}, { method: 'get_forces' })

const getNeighbourhood = sg.wrap(async (args: GetNeighbourhoodInput) => {
  if (!args.force || typeof args.force !== 'string') {
    throw new Error('force is required (force slug)')
  }
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (neighbourhood ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/\${encodeURIComponent(args.force)}/\${encodeURIComponent(args.id)}\`)
  return data
}, { method: 'get_neighbourhood' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCrimes, getForces, getNeighbourhood }

console.log('settlegrid-uk-police MCP server ready')
console.log('Methods: get_crimes, get_forces, get_neighbourhood')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 5. UK Weather (Met Office)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'uk-weather',
  title: 'UK Met Office Weather',
  desc: 'Get UK weather forecasts, observations and warnings from the Met Office DataHub.',
  api: { base: 'https://data.hub.api.metoffice.gov.uk', name: 'Met Office DataHub', docs: 'https://datahub.metoffice.gov.uk/' },
  key: { env: 'MET_OFFICE_API_KEY', url: 'https://datahub.metoffice.gov.uk/', required: true },
  keywords: ['weather', 'uk', 'met-office', 'forecast', 'observations'],
  methods: [
    {
      name: 'get_forecast', display: 'Get weather forecast', cost: 2,
      params: 'lat, lon',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      ],
    },
    {
      name: 'get_observations', display: 'Get weather observations', cost: 2,
      params: 'lat, lon',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      ],
    },
    {
      name: 'get_warnings', display: 'Get weather warnings', cost: 2,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-uk-weather — UK Met Office Weather MCP Server
 *
 * Wraps Met Office DataHub with SettleGrid billing.
 * Free key from https://datahub.metoffice.gov.uk/.
 *
 * Methods:
 *   get_forecast(lat, lon)                 — Get weather forecast (2¢)
 *   get_observations(lat, lon)             — Get observations (2¢)
 *   get_warnings()                         — Get weather warnings (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetForecastInput {
  lat: number
  lon: number
}

interface GetObservationsInput {
  lat: number
  lon: number
}

interface GetWarningsInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.hub.api.metoffice.gov.uk'
const API_KEY = process.env.MET_OFFICE_API_KEY || ''
const USER_AGENT = 'settlegrid-uk-weather/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    apikey: API_KEY,
  }
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Met Office API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uk-weather',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_forecast: { costCents: 2, displayName: 'Get UK weather forecast' },
      get_observations: { costCents: 2, displayName: 'Get weather observations' },
      get_warnings: { costCents: 2, displayName: 'Get weather warnings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async (args: GetForecastInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/point/hourly', {
    params: { latitude: String(args.lat), longitude: String(args.lon) },
  })
  return data
}, { method: 'get_forecast' })

const getObservations = sg.wrap(async (args: GetObservationsInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric coordinates)')
  }
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/point/observation', {
    params: { latitude: String(args.lat), longitude: String(args.lon) },
  })
  return data
}, { method: 'get_observations' })

const getWarnings = sg.wrap(async (_args: GetWarningsInput) => {
  const data = await apiFetch<Record<string, unknown>>('/sitespecific/v0/warnings')
  return data
}, { method: 'get_warnings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getObservations, getWarnings }

console.log('settlegrid-uk-weather MCP server ready')
console.log('Methods: get_forecast, get_observations, get_warnings')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 6. France Data (CKAN-like)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'france-data',
  title: 'France Open Data',
  desc: 'Access French government open datasets from data.gouv.fr.',
  api: { base: 'https://www.data.gouv.fr/api/1', name: 'data.gouv.fr', docs: 'https://doc.data.gouv.fr/api/reference/' },
  key: null,
  keywords: ['france', 'government', 'open-data', 'datasets'],
  methods: [
    {
      name: 'search_datasets', display: 'Search French datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset identifier' }],
    },
    {
      name: 'list_organizations', display: 'List organizations', cost: 1,
      params: 'limit?',
      inputs: [{ name: 'limit', type: 'number', required: false, desc: 'Max results' }],
    },
  ],
  serverTs: `/**
 * settlegrid-france-data — France Open Data MCP Server
 *
 * Wraps data.gouv.fr API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_organizations(limit?)             — List organizations (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListOrganizationsInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.data.gouv.fr/api/1'
const USER_AGENT = 'settlegrid-france-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`data.gouv.fr API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'france-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search French datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_organizations: { costCents: 1, displayName: 'List French organizations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['page_size'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/datasets/', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/datasets/\${encodeURIComponent(args.id)}/\`)
  return data
}, { method: 'get_dataset' })

const listOrganizations = sg.wrap(async (args: ListOrganizationsInput) => {
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['page_size'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/organizations/', { params })
  return data
}, { method: 'list_organizations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listOrganizations }

console.log('settlegrid-france-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 7. France SIRENE (Company Data)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'france-sirene',
  title: 'French Company Data',
  desc: 'Search French companies and establishments via the SIRENE/recherche-entreprises API.',
  api: { base: 'https://recherche-entreprises.api.gouv.fr', name: 'Recherche Entreprises', docs: 'https://recherche-entreprises.api.gouv.fr/docs' },
  key: null,
  keywords: ['france', 'companies', 'business', 'sirene', 'siret'],
  methods: [
    {
      name: 'search_companies', display: 'Search French companies', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Company name or keyword' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ],
    },
    {
      name: 'get_company', display: 'Get company by SIRET', cost: 1,
      params: 'siret',
      inputs: [{ name: 'siret', type: 'string', required: true, desc: 'SIRET number (14 digits)' }],
    },
    {
      name: 'search_by_activity', display: 'Search by NAF activity code', cost: 1,
      params: 'naf_code',
      inputs: [{ name: 'naf_code', type: 'string', required: true, desc: 'NAF/APE activity code' }],
    },
  ],
  serverTs: `/**
 * settlegrid-france-sirene — French Company Data MCP Server
 *
 * Wraps Recherche Entreprises API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_companies(query, limit?)        — Search companies (1¢)
 *   get_company(siret)                     — Get company by SIRET (1¢)
 *   search_by_activity(naf_code)           — Search by NAF code (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchCompaniesInput {
  query: string
  limit?: number
}

interface GetCompanyInput {
  siret: string
}

interface SearchByActivityInput {
  naf_code: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://recherche-entreprises.api.gouv.fr'
const USER_AGENT = 'settlegrid-france-sirene/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Recherche Entreprises API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'france-sirene',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search French companies' },
      get_company: { costCents: 1, displayName: 'Get company by SIRET' },
      search_by_activity: { costCents: 1, displayName: 'Search by NAF activity code' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchCompaniesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (company name or keyword)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['per_page'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/search', { params })
  return data
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.siret || typeof args.siret !== 'string') {
    throw new Error('siret is required (14-digit SIRET number)')
  }
  const data = await apiFetch<Record<string, unknown>>('/search', {
    params: { q: args.siret },
  })
  return data
}, { method: 'get_company' })

const searchByActivity = sg.wrap(async (args: SearchByActivityInput) => {
  if (!args.naf_code || typeof args.naf_code !== 'string') {
    throw new Error('naf_code is required (NAF/APE activity code)')
  }
  const data = await apiFetch<Record<string, unknown>>('/search', {
    params: { activite_principale: args.naf_code },
  })
  return data
}, { method: 'search_by_activity' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany, searchByActivity }

console.log('settlegrid-france-sirene MCP server ready')
console.log('Methods: search_companies, get_company, search_by_activity')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 8. Germany Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'germany-data',
  'German Open Data',
  'Access German government open datasets from GovData.de via CKAN API.',
  'https://ckan.govdata.de/api/3',
  'GovData.de CKAN',
  'https://www.govdata.de/web/guest/daten'
))

// ═══════════════════════════════════════════════════════════════════════════
// 9. Germany DESTATIS
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'germany-destatis',
  title: 'German Statistics (DESTATIS)',
  desc: 'Access German federal statistics from DESTATIS GENESIS database.',
  api: { base: 'https://www-genesis.destatis.de/genesisWS/rest/2020', name: 'DESTATIS GENESIS', docs: 'https://www-genesis.destatis.de/genesis/online' },
  key: null,
  keywords: ['germany', 'statistics', 'destatis', 'economics', 'census'],
  methods: [
    {
      name: 'search_tables', display: 'Search statistical tables', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'get_table', display: 'Get table metadata', cost: 1,
      params: 'name',
      inputs: [{ name: 'name', type: 'string', required: true, desc: 'Table name/code' }],
    },
    {
      name: 'list_statistics', display: 'List available statistics', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-germany-destatis — German Statistics (DESTATIS) MCP Server
 *
 * Wraps DESTATIS GENESIS API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tables(query)                   — Search tables (1¢)
 *   get_table(name)                        — Get table metadata (1¢)
 *   list_statistics()                      — List statistics (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTablesInput {
  query: string
}

interface GetTableInput {
  name: string
}

interface ListStatisticsInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www-genesis.destatis.de/genesisWS/rest/2020'
const USER_AGENT = 'settlegrid-germany-destatis/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('username', 'GUEST')
  url.searchParams.set('password', '')
  url.searchParams.set('language', 'en')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`DESTATIS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'germany-destatis',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tables: { costCents: 1, displayName: 'Search DESTATIS tables' },
      get_table: { costCents: 1, displayName: 'Get table metadata' },
      list_statistics: { costCents: 1, displayName: 'List available statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/find/find', {
    params: { term: args.query, category: 'tables' },
  })
  return data
}, { method: 'search_tables' })

const getTable = sg.wrap(async (args: GetTableInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (table code)')
  }
  const data = await apiFetch<Record<string, unknown>>('/catalogue/tables', {
    params: { selection: args.name },
  })
  return data
}, { method: 'get_table' })

const listStatistics = sg.wrap(async (_args: ListStatisticsInput) => {
  const data = await apiFetch<Record<string, unknown>>('/catalogue/statistics')
  return data
}, { method: 'list_statistics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTables, getTable, listStatistics }

console.log('settlegrid-germany-destatis MCP server ready')
console.log('Methods: search_tables, get_table, list_statistics')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 10. Italy Data (CKAN-like)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'italy-data',
  title: 'Italian Open Data',
  desc: 'Access Italian government open datasets from dati.gov.it.',
  api: { base: 'https://www.dati.gov.it/opendata/api/3', name: 'dati.gov.it CKAN', docs: 'https://www.dati.gov.it/' },
  key: null,
  keywords: ['italy', 'government', 'open-data', 'datasets'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Italian datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset identifier' }],
    },
    {
      name: 'list_organizations', display: 'List organizations', cost: 1,
      params: 'limit?',
      inputs: [{ name: 'limit', type: 'number', required: false, desc: 'Max results' }],
    },
  ],
  serverTs: `/**
 * settlegrid-italy-data — Italian Open Data MCP Server
 *
 * Wraps dati.gov.it CKAN API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_organizations(limit?)             — List organizations (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListOrganizationsInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.dati.gov.it/opendata/api/3'
const USER_AGENT = 'settlegrid-italy-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`dati.gov.it API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'italy-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Italian datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_organizations: { costCents: 1, displayName: 'List Italian organizations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/package_search', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>('/action/package_show', {
    params: { id: args.id },
  })
  return data
}, { method: 'get_dataset' })

const listOrganizations = sg.wrap(async (args: ListOrganizationsInput) => {
  const params: Record<string, string> = { all_fields: 'true' }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/action/organization_list', { params })
  return data
}, { method: 'list_organizations' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listOrganizations }

console.log('settlegrid-italy-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_organizations')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 11. Spain Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'spain-data',
  title: 'Spanish Open Data',
  desc: 'Access Spanish government open datasets from datos.gob.es.',
  api: { base: 'https://datos.gob.es/apidata', name: 'datos.gob.es', docs: 'https://datos.gob.es/es/apidata' },
  key: null,
  keywords: ['spain', 'government', 'open-data', 'datasets'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Spanish datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset identifier' }],
    },
    {
      name: 'list_publishers', display: 'List data publishers', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-spain-data — Spanish Open Data MCP Server
 *
 * Wraps datos.gob.es API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_publishers()                      — List publishers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListPublishersInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://datos.gob.es/apidata'
const USER_AGENT = 'settlegrid-spain-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`datos.gob.es API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spain-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Spanish datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_publishers: { costCents: 1, displayName: 'List data publishers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { '_q': args.query }
  if (args.limit !== undefined) params['_pageSize'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/catalog/dataset', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset identifier)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/catalog/dataset/\${encodeURIComponent(args.id)}\`)
  return data
}, { method: 'get_dataset' })

const listPublishers = sg.wrap(async (_args: ListPublishersInput) => {
  const data = await apiFetch<Record<string, unknown>>('/catalog/publisher')
  return data
}, { method: 'list_publishers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listPublishers }

console.log('settlegrid-spain-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_publishers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 12. Netherlands CBS
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'netherlands-cbs',
  title: 'Dutch Statistics (CBS)',
  desc: 'Access Dutch statistical data from CBS via OData v4 API.',
  api: { base: 'https://odata4.cbs.nl/CBS', name: 'CBS OData', docs: 'https://www.cbs.nl/en-gb/our-services/open-data' },
  key: null,
  keywords: ['netherlands', 'statistics', 'cbs', 'dutch', 'economics'],
  methods: [
    {
      name: 'search_tables', display: 'Search statistical tables', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'get_table_data', display: 'Get table data', cost: 1,
      params: 'identifier, limit?',
      inputs: [
        { name: 'identifier', type: 'string', required: true, desc: 'Table identifier' },
        { name: 'limit', type: 'number', required: false, desc: 'Max rows' },
      ],
    },
    {
      name: 'list_themes', display: 'List statistical themes', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-netherlands-cbs — Dutch Statistics (CBS) MCP Server
 *
 * Wraps CBS OData v4 API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_tables(query)                   — Search tables (1¢)
 *   get_table_data(identifier, limit?)     — Get table data (1¢)
 *   list_themes()                          — List themes (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchTablesInput {
  query: string
}

interface GetTableDataInput {
  identifier: string
  limit?: number
}

interface ListThemesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://odata4.cbs.nl/CBS'
const USER_AGENT = 'settlegrid-netherlands-cbs/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`CBS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'netherlands-cbs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_tables: { costCents: 1, displayName: 'Search CBS tables' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
      list_themes: { costCents: 1, displayName: 'List statistical themes' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/Datasets', {
    params: { '\\$filter': \`contains(Title,'\\\${args.query}')\` },
  })
  return data
}, { method: 'search_tables' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.identifier || typeof args.identifier !== 'string') {
    throw new Error('identifier is required (table ID)')
  }
  const params: Record<string, string> = {}
  if (args.limit !== undefined) params['\\$top'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>(\`/\${encodeURIComponent(args.identifier)}/Observations\`, { params })
  return data
}, { method: 'get_table_data' })

const listThemes = sg.wrap(async (_args: ListThemesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/Themes')
  return data
}, { method: 'list_themes' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTables, getTableData, listThemes }

console.log('settlegrid-netherlands-cbs MCP server ready')
console.log('Methods: search_tables, get_table_data, list_themes')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 13. Sweden SCB
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'sweden-scb',
  title: 'Swedish Statistics (SCB)',
  desc: 'Access Swedish official statistics from SCB (Statistics Sweden).',
  api: { base: 'https://api.scb.se/OV0104/v1/doris/en/ssd', name: 'SCB API', docs: 'https://www.scb.se/en/services/open-data-api/' },
  key: null,
  keywords: ['sweden', 'statistics', 'scb', 'economics', 'demographics'],
  methods: [
    {
      name: 'list_subjects', display: 'List statistical subjects', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_table_info', display: 'Get table info', cost: 1,
      params: 'path',
      inputs: [{ name: 'path', type: 'string', required: true, desc: 'Table path in the hierarchy' }],
    },
    {
      name: 'get_table_data', display: 'Get table data', cost: 1,
      params: 'path',
      inputs: [{ name: 'path', type: 'string', required: true, desc: 'Table path' }],
    },
  ],
  serverTs: `/**
 * settlegrid-sweden-scb — Swedish Statistics (SCB) MCP Server
 *
 * Wraps SCB (Statistics Sweden) API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects()                        — List subjects (1¢)
 *   get_table_info(path)                   — Get table info (1¢)
 *   get_table_data(path)                   — Get table data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {}

interface GetTableInfoInput {
  path: string
}

interface GetTableDataInput {
  path: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.scb.se/OV0104/v1/doris/en/ssd'
const USER_AGENT = 'settlegrid-sweden-scb/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  body?: unknown
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path.startsWith('/') ? path : '/' + path}\`
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SCB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sweden-scb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List statistical subjects' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (_args: ListSubjectsInput) => {
  const data = await apiFetch<unknown[]>('/')
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path in hierarchy)')
  }
  const data = await apiFetch<unknown>(\`/\${args.path}\`)
  return data
}, { method: 'get_table_info' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path)')
  }
  const info = await apiFetch<{ variables?: unknown[] }>(\`/\${args.path}\`)
  const query = { query: [], response: { format: 'json' } }
  const data = await apiFetch<unknown>(\`/\${args.path}\`, { method: 'POST', body: query })
  return data
}, { method: 'get_table_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, getTableData }

console.log('settlegrid-sweden-scb MCP server ready')
console.log('Methods: list_subjects, get_table_info, get_table_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 14. Norway SSB
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'norway-ssb',
  title: 'Norwegian Statistics (SSB)',
  desc: 'Access Norwegian official statistics from SSB (Statistics Norway).',
  api: { base: 'https://data.ssb.no/api/v0/en/table', name: 'SSB API', docs: 'https://www.ssb.no/en/omssb/tjenester-og-verktoy/api' },
  key: null,
  keywords: ['norway', 'statistics', 'ssb', 'economics', 'demographics'],
  methods: [
    {
      name: 'list_subjects', display: 'List statistical subjects', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_table_info', display: 'Get table info', cost: 1,
      params: 'tableId',
      inputs: [{ name: 'tableId', type: 'string', required: true, desc: 'SSB table ID' }],
    },
    {
      name: 'search_tables', display: 'Search tables', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
  ],
  serverTs: `/**
 * settlegrid-norway-ssb — Norwegian Statistics (SSB) MCP Server
 *
 * Wraps SSB (Statistics Norway) API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects()                        — List subjects (1¢)
 *   get_table_info(tableId)                — Get table info (1¢)
 *   search_tables(query)                   — Search tables (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {}

interface GetTableInfoInput {
  tableId: string
}

interface SearchTablesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.ssb.no/api/v0/en/table'
const USER_AGENT = 'settlegrid-norway-ssb/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  body?: unknown
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path.startsWith('/') ? path : '/' + path}\`
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SSB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'norway-ssb',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List SSB subjects' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      search_tables: { costCents: 1, displayName: 'Search SSB tables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (_args: ListSubjectsInput) => {
  const data = await apiFetch<unknown[]>('https://data.ssb.no/api/v0/en/table/')
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.tableId || typeof args.tableId !== 'string') {
    throw new Error('tableId is required')
  }
  const data = await apiFetch<unknown>(\`/\${args.tableId}\`)
  return data
}, { method: 'get_table_info' })

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('https://data.ssb.no/api/v0/en/table/?query=' + encodeURIComponent(args.query))
  return { results: data }
}, { method: 'search_tables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, searchTables }

console.log('settlegrid-norway-ssb MCP server ready')
console.log('Methods: list_subjects, get_table_info, search_tables')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 15. Denmark DST
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'denmark-dst',
  title: 'Danish Statistics (DST)',
  desc: 'Access Danish statistics from Statistics Denmark (StatBank).',
  api: { base: 'https://api.statbank.dk/v1', name: 'StatBank Denmark', docs: 'https://www.dst.dk/en/Statistik/brug-statistikken/muligheder-i-telefonisk-markup/api' },
  key: null,
  keywords: ['denmark', 'statistics', 'dst', 'economics', 'demographics'],
  methods: [
    {
      name: 'list_subjects', display: 'List subject areas', cost: 1,
      params: 'subject_id?',
      inputs: [{ name: 'subject_id', type: 'string', required: false, desc: 'Parent subject ID for sub-subjects' }],
    },
    {
      name: 'get_table_info', display: 'Get table info', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Table ID' }],
    },
    {
      name: 'get_table_data', display: 'Get table data', cost: 1,
      params: 'table, variables',
      inputs: [
        { name: 'table', type: 'string', required: true, desc: 'Table ID' },
        { name: 'variables', type: 'object', required: true, desc: 'Variable selections as key-value pairs' },
      ],
    },
  ],
  serverTs: `/**
 * settlegrid-denmark-dst — Danish Statistics (DST) MCP Server
 *
 * Wraps StatBank Denmark API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects(subject_id?)             — List subjects (1¢)
 *   get_table_info(id)                     — Get table info (1¢)
 *   get_table_data(table, variables)       — Get data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {
  subject_id?: string
}

interface GetTableInfoInput {
  id: string
}

interface GetTableDataInput {
  table: string
  variables: Record<string, string[]>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.statbank.dk/v1'
const USER_AGENT = 'settlegrid-denmark-dst/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
  body?: unknown
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path}\`
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'POST', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
  }
  const res = await fetch(url, fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`StatBank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'denmark-dst',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List subject areas' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      get_table_data: { costCents: 1, displayName: 'Get table data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (args: ListSubjectsInput) => {
  const body: Record<string, unknown> = { format: 'JSON', lang: 'en', recursive: false }
  if (args.subject_id) body['subjects'] = [args.subject_id]
  const data = await apiFetch<unknown[]>('/subjects', { body })
  return { subjects: data }
}, { method: 'list_subjects' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (table ID)')
  }
  const data = await apiFetch<unknown>('/tableinfo', { body: { table: args.id, format: 'JSON', lang: 'en' } })
  return data
}, { method: 'get_table_info' })

const getTableData = sg.wrap(async (args: GetTableDataInput) => {
  if (!args.table || typeof args.table !== 'string') {
    throw new Error('table is required (table ID)')
  }
  if (!args.variables || typeof args.variables !== 'object') {
    throw new Error('variables is required (variable selections)')
  }
  const vars = Object.entries(args.variables).map(([code, values]) => ({
    code,
    values: Array.isArray(values) ? values : [values],
  }))
  const body = { table: args.table, format: 'JSON', lang: 'en', variables: vars }
  const data = await apiFetch<unknown>('/data', { body })
  return data
}, { method: 'get_table_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getTableInfo, getTableData }

console.log('settlegrid-denmark-dst MCP server ready')
console.log('Methods: list_subjects, get_table_info, get_table_data')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 16. Finland Stat
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'finland-stat',
  title: 'Finnish Statistics',
  desc: 'Access Finnish official statistics from Statistics Finland (PXWeb).',
  api: { base: 'https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin', name: 'Statistics Finland PXWeb', docs: 'https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin' },
  key: null,
  keywords: ['finland', 'statistics', 'pxweb', 'economics', 'demographics'],
  methods: [
    {
      name: 'list_databases', display: 'List database hierarchy', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_table_info', display: 'Get table info', cost: 1,
      params: 'path',
      inputs: [{ name: 'path', type: 'string', required: true, desc: 'Table path in hierarchy' }],
    },
    {
      name: 'search_tables', display: 'Search tables', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search query' }],
    },
  ],
  serverTs: `/**
 * settlegrid-finland-stat — Finnish Statistics MCP Server
 *
 * Wraps Statistics Finland PXWeb API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_databases()                       — List databases (1¢)
 *   get_table_info(path)                   — Get table info (1¢)
 *   search_tables(query)                   — Search tables (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListDatabasesInput {}

interface GetTableInfoInput {
  path: string
}

interface SearchTablesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin'
const USER_AGENT = 'settlegrid-finland-stat/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  method?: string
} = {}): Promise<T> {
  const url = path.startsWith('http') ? path : \`\${API_BASE}\${path.startsWith('/') ? path : '/' + path}\`
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Statistics Finland API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'finland-stat',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_databases: { costCents: 1, displayName: 'List database hierarchy' },
      get_table_info: { costCents: 1, displayName: 'Get table information' },
      search_tables: { costCents: 1, displayName: 'Search statistical tables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listDatabases = sg.wrap(async (_args: ListDatabasesInput) => {
  const data = await apiFetch<unknown[]>('/')
  return { databases: data }
}, { method: 'list_databases' })

const getTableInfo = sg.wrap(async (args: GetTableInfoInput) => {
  if (!args.path || typeof args.path !== 'string') {
    throw new Error('path is required (table path)')
  }
  const data = await apiFetch<unknown>(\`/\${args.path}\`)
  return data
}, { method: 'get_table_info' })

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/')
  const items = Array.isArray(data) ? data.filter((d) => {
    const s = JSON.stringify(d).toLowerCase()
    return s.includes(args.query.toLowerCase())
  }) : []
  return { results: items, query: args.query }
}, { method: 'search_tables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listDatabases, getTableInfo, searchTables }

console.log('settlegrid-finland-stat MCP server ready')
console.log('Methods: list_databases, get_table_info, search_tables')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 17. Switzerland Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'switzerland-data',
  'Swiss Open Data',
  'Access Swiss government open datasets from opendata.swiss via CKAN API.',
  'https://ckan.opendata.swiss/api/3',
  'opendata.swiss CKAN',
  'https://handbook.opendata.swiss/en/content/nutzen/api-nutzen.html'
))

// ═══════════════════════════════════════════════════════════════════════════
// 18. Austria Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'austria-data',
  'Austrian Open Data',
  'Access Austrian government open datasets from data.gv.at via CKAN API.',
  'https://www.data.gv.at/katalog/api/3',
  'data.gv.at CKAN',
  'https://www.data.gv.at/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 19. Poland Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'poland-data',
  title: 'Polish Open Data',
  desc: 'Access Polish government open datasets from dane.gov.pl.',
  api: { base: 'https://api.dane.gov.pl/1.4', name: 'dane.gov.pl', docs: 'https://api.dane.gov.pl/' },
  key: null,
  keywords: ['poland', 'government', 'open-data', 'datasets'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Polish datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset ID' }],
    },
    {
      name: 'list_categories', display: 'List dataset categories', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-poland-data — Polish Open Data MCP Server
 *
 * Wraps dane.gov.pl API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_categories()                      — List categories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListCategoriesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dane.gov.pl/1.4'
const USER_AGENT = 'settlegrid-poland-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`dane.gov.pl API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'poland-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Polish datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_categories: { costCents: 1, displayName: 'List dataset categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['per_page'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/datasets', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/datasets/\${encodeURIComponent(args.id)}\`)
  return data
}, { method: 'get_dataset' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/categories')
  return data
}, { method: 'list_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCategories }

console.log('settlegrid-poland-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 20. Czech Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'czech-data',
  title: 'Czech Open Data',
  desc: 'Access Czech government open datasets from the National Open Data Catalog.',
  api: { base: 'https://data.gov.cz/api/v2', name: 'Czech NODC', docs: 'https://data.gov.cz/' },
  key: null,
  keywords: ['czech', 'government', 'open-data', 'datasets'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Czech datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset IRI' }],
    },
    {
      name: 'list_publishers', display: 'List data publishers', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-czech-data — Czech Open Data MCP Server
 *
 * Wraps Czech National Open Data Catalog with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_publishers()                      — List publishers (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListPublishersInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.gov.cz/api/v2'
const USER_AGENT = 'settlegrid-czech-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Czech NODC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'czech-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Czech datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_publishers: { costCents: 1, displayName: 'List data publishers' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { dotaz: args.query }
  if (args.limit !== undefined) params['pocet'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/datasets', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset IRI)')
  }
  const data = await apiFetch<Record<string, unknown>>('/datasets/' + encodeURIComponent(args.id))
  return data
}, { method: 'get_dataset' })

const listPublishers = sg.wrap(async (_args: ListPublishersInput) => {
  const data = await apiFetch<Record<string, unknown>>('/publishers')
  return data
}, { method: 'list_publishers' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listPublishers }

console.log('settlegrid-czech-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_publishers')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 21. Israel Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'israel-data',
  'Israeli Open Data',
  'Access Israeli government open datasets from data.gov.il via CKAN API.',
  'https://data.gov.il/api/3',
  'data.gov.il CKAN',
  'https://data.gov.il/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 22. Singapore Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'singapore-data',
  title: 'Singapore Open Data',
  desc: 'Access Singapore government open datasets from data.gov.sg.',
  api: { base: 'https://data.gov.sg/api/action', name: 'data.gov.sg', docs: 'https://data.gov.sg/' },
  key: null,
  keywords: ['singapore', 'government', 'open-data', 'datasets', 'asia'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Singapore datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset ID' }],
    },
    {
      name: 'list_collections', display: 'List dataset collections', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-singapore-data — Singapore Open Data MCP Server
 *
 * Wraps data.gov.sg API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_collections()                     — List collections (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListCollectionsInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.gov.sg/api/action'
const USER_AGENT = 'settlegrid-singapore-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`data.gov.sg API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'singapore-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Singapore datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_collections: { costCents: 1, displayName: 'List dataset collections' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['rows'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/package_search', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>('/package_show', {
    params: { id: args.id },
  })
  return data
}, { method: 'get_dataset' })

const listCollections = sg.wrap(async (_args: ListCollectionsInput) => {
  const data = await apiFetch<Record<string, unknown>>('/group_list', {
    params: { all_fields: 'true' },
  })
  return data
}, { method: 'list_collections' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCollections }

console.log('settlegrid-singapore-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_collections')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 23. Hong Kong Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'hong-kong-data',
  title: 'Hong Kong Open Data',
  desc: 'Access Hong Kong government open datasets from DATA.GOV.HK.',
  api: { base: 'https://data.gov.hk/en/api', name: 'DATA.GOV.HK', docs: 'https://data.gov.hk/en/' },
  key: null,
  keywords: ['hong-kong', 'government', 'open-data', 'datasets', 'asia'],
  methods: [
    {
      name: 'search_datasets', display: 'Search HK datasets', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search query' }],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset ID' }],
    },
    {
      name: 'list_categories', display: 'List data categories', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-hong-kong-data — Hong Kong Open Data MCP Server
 *
 * Wraps DATA.GOV.HK API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query)                 — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_categories()                      — List categories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface GetDatasetInput {
  id: string
}

interface ListCategoriesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.gov.hk/en-data'
const USER_AGENT = 'settlegrid-hong-kong-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`DATA.GOV.HK API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hong-kong-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search HK datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_categories: { costCents: 1, displayName: 'List data categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<Record<string, unknown>>('/dataset-search', {
    params: { q: args.query },
  })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/dataset/\${encodeURIComponent(args.id)}\`)
  return data
}, { method: 'get_dataset' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/category-list')
  return data
}, { method: 'list_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCategories }

console.log('settlegrid-hong-kong-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 24. Taiwan Data
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'taiwan-data',
  title: 'Taiwan Open Data',
  desc: 'Access Taiwan government open datasets from data.gov.tw.',
  api: { base: 'https://data.gov.tw/api/v2', name: 'data.gov.tw', docs: 'https://data.gov.tw/' },
  key: null,
  keywords: ['taiwan', 'government', 'open-data', 'datasets', 'asia'],
  methods: [
    {
      name: 'search_datasets', display: 'Search Taiwan datasets', cost: 1,
      params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results' },
      ],
    },
    {
      name: 'get_dataset', display: 'Get dataset details', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Dataset ID' }],
    },
    {
      name: 'list_categories', display: 'List data categories', cost: 1,
      params: '',
      inputs: [],
    },
  ],
  serverTs: `/**
 * settlegrid-taiwan-data — Taiwan Open Data MCP Server
 *
 * Wraps data.gov.tw API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query, limit?)         — Search datasets (1¢)
 *   get_dataset(id)                        — Get dataset details (1¢)
 *   list_categories()                      — List categories (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
  limit?: number
}

interface GetDatasetInput {
  id: string
}

interface ListCategoriesInput {}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://data.gov.tw/api/v2'
const USER_AGENT = 'settlegrid-taiwan-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`data.gov.tw API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'taiwan-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Taiwan datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_categories: { costCents: 1, displayName: 'List data categories' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const params: Record<string, string> = { q: args.query }
  if (args.limit !== undefined) params['limit'] = String(args.limit)
  const data = await apiFetch<Record<string, unknown>>('/datasets', { params })
  return data
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: GetDatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (dataset ID)')
  }
  const data = await apiFetch<Record<string, unknown>>(\`/datasets/\${encodeURIComponent(args.id)}\`)
  return data
}, { method: 'get_dataset' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<Record<string, unknown>>('/datasets/categories')
  return data
}, { method: 'list_categories' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listCategories }

console.log('settlegrid-taiwan-data MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_categories')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 25. New Zealand Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'new-zealand-data',
  'New Zealand Open Data',
  'Access New Zealand government open datasets from catalogue.data.govt.nz via CKAN API.',
  'https://catalogue.data.govt.nz/api/3',
  'data.govt.nz CKAN',
  'https://catalogue.data.govt.nz/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 26. South Africa Data (CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'south-africa-data',
  'South African Open Data',
  'Access South African government open datasets from data.gov.za via CKAN API.',
  'https://data.gov.za/api/3',
  'data.gov.za CKAN',
  'https://data.gov.za/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 27. Nigeria Data (World Bank proxy)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'nigeria-data',
  title: 'Nigerian Statistics',
  desc: 'Access Nigerian economic and demographic data via World Bank API.',
  api: { base: 'https://api.worldbank.org/v2/country/NGA', name: 'World Bank API (NGA)', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api' },
  key: null,
  keywords: ['nigeria', 'statistics', 'world-bank', 'africa', 'economics'],
  methods: [
    {
      name: 'search_publications', display: 'Search indicators (as publications)', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'list_categories', display: 'List indicator topics', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_indicator', display: 'Get indicator data', cost: 1,
      params: 'name',
      inputs: [{ name: 'name', type: 'string', required: true, desc: 'Indicator code (e.g. NY.GDP.MKTP.CD)' }],
    },
  ],
  serverTs: `/**
 * settlegrid-nigeria-data — Nigerian Statistics MCP Server
 *
 * Wraps World Bank API (NGA) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_publications(query)             — Search indicators (1¢)
 *   list_categories()                      — List topics (1¢)
 *   get_indicator(name)                    — Get indicator data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchPublicationsInput {
  query: string
}

interface ListCategoriesInput {}

interface GetIndicatorInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'NGA'
const USER_AGENT = 'settlegrid-nigeria-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'nigeria-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_publications: { costCents: 1, displayName: 'Search Nigerian indicators' },
      list_categories: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPublications = sg.wrap(async (args: SearchPublicationsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', {
    params: { per_page: '50' },
  })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_publications' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_categories' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.name}\`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPublications, listCategories, getIndicator }

console.log('settlegrid-nigeria-data MCP server ready')
console.log('Methods: search_publications, list_categories, get_indicator')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 28. Kenya Data (openAFRICA CKAN)
// ═══════════════════════════════════════════════════════════════════════════

gen(ckanServer(
  'kenya-data',
  'Kenyan Open Data',
  'Access Kenyan and African open datasets from openAFRICA via CKAN API.',
  'https://open.africa/api/3',
  'openAFRICA CKAN',
  'https://open.africa/'
))

// ═══════════════════════════════════════════════════════════════════════════
// 29. Egypt Data (World Bank proxy)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'egypt-data',
  title: 'Egyptian Statistics',
  desc: 'Access Egyptian economic and demographic data via World Bank API.',
  api: { base: 'https://api.worldbank.org/v2/country/EGY', name: 'World Bank API (EGY)', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api' },
  key: null,
  keywords: ['egypt', 'statistics', 'world-bank', 'africa', 'economics'],
  methods: [
    {
      name: 'search_statistics', display: 'Search indicators', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'list_categories', display: 'List indicator topics', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_indicator', display: 'Get indicator data', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Indicator code' }],
    },
  ],
  serverTs: `/**
 * settlegrid-egypt-data — Egyptian Statistics MCP Server
 *
 * Wraps World Bank API (EGY) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_statistics(query)               — Search indicators (1¢)
 *   list_categories()                      — List topics (1¢)
 *   get_indicator(id)                      — Get indicator data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchStatisticsInput {
  query: string
}

interface ListCategoriesInput {}

interface GetIndicatorInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'EGY'
const USER_AGENT = 'settlegrid-egypt-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'egypt-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_statistics: { costCents: 1, displayName: 'Search Egyptian indicators' },
      list_categories: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchStatistics = sg.wrap(async (args: SearchStatisticsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', { params: { per_page: '50' } })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_statistics' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_categories' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.id}\`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchStatistics, listCategories, getIndicator }

console.log('settlegrid-egypt-data MCP server ready')
console.log('Methods: search_statistics, list_categories, get_indicator')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 30. Turkey Data (World Bank proxy)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'turkey-data',
  title: 'Turkish Statistics',
  desc: 'Access Turkish economic and demographic data via World Bank API.',
  api: { base: 'https://api.worldbank.org/v2/country/TUR', name: 'World Bank API (TUR)', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api' },
  key: null,
  keywords: ['turkey', 'statistics', 'world-bank', 'economics'],
  methods: [
    {
      name: 'search_datasets', display: 'Search indicators', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'list_categories', display: 'List indicator topics', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_indicator', display: 'Get indicator data', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Indicator code' }],
    },
  ],
  serverTs: `/**
 * settlegrid-turkey-data — Turkish Statistics MCP Server
 *
 * Wraps World Bank API (TUR) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query)                 — Search indicators (1¢)
 *   list_categories()                      — List topics (1¢)
 *   get_indicator(id)                      — Get indicator data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface ListCategoriesInput {}

interface GetIndicatorInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'TUR'
const USER_AGENT = 'settlegrid-turkey-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'turkey-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Turkish indicators' },
      list_categories: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', { params: { per_page: '50' } })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_datasets' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_categories' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.id}\`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, listCategories, getIndicator }

console.log('settlegrid-turkey-data MCP server ready')
console.log('Methods: search_datasets, list_categories, get_indicator')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 31. Russia Data (World Bank proxy)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'russia-data',
  title: 'Russian Statistics',
  desc: 'Access Russian economic and demographic data via World Bank API.',
  api: { base: 'https://api.worldbank.org/v2/country/RUS', name: 'World Bank API (RUS)', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api' },
  key: null,
  keywords: ['russia', 'statistics', 'world-bank', 'economics'],
  methods: [
    {
      name: 'search_datasets', display: 'Search indicators', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
    {
      name: 'list_categories', display: 'List indicator topics', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_indicator', display: 'Get indicator data', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Indicator code' }],
    },
  ],
  serverTs: `/**
 * settlegrid-russia-data — Russian Statistics MCP Server
 *
 * Wraps World Bank API (RUS) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_datasets(query)                 — Search indicators (1¢)
 *   list_categories()                      — List topics (1¢)
 *   get_indicator(id)                      — Get indicator data (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchDatasetsInput {
  query: string
}

interface ListCategoriesInput {}

interface GetIndicatorInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'RUS'
const USER_AGENT = 'settlegrid-russia-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'russia-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search Russian indicators' },
      list_categories: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchDatasetsInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', { params: { per_page: '50' } })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_datasets' })

const listCategories = sg.wrap(async (_args: ListCategoriesInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_categories' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.id}\`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, listCategories, getIndicator }

console.log('settlegrid-russia-data MCP server ready')
console.log('Methods: search_datasets, list_categories, get_indicator')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 32. China Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'china-data', 'Chinese Economic Data', 'CHN',
  'Access Chinese economic and development indicators via World Bank API.',
  'get_gdp_data', 'Get GDP data for China', 'NY.GDP.MKTP.CD', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 33. Indonesia Data (World Bank proxy)
// ═══════════════════════════════════════════════════════════════════════════

gen({
  slug: 'indonesia-data',
  title: 'Indonesian Statistics',
  desc: 'Access Indonesian economic and demographic data via World Bank API.',
  api: { base: 'https://api.worldbank.org/v2/country/IDN', name: 'World Bank API (IDN)', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api' },
  key: null,
  keywords: ['indonesia', 'statistics', 'world-bank', 'economics', 'asia'],
  methods: [
    {
      name: 'list_subjects', display: 'List indicator topics', cost: 1,
      params: '',
      inputs: [],
    },
    {
      name: 'get_indicator', display: 'Get indicator data', cost: 1,
      params: 'id',
      inputs: [{ name: 'id', type: 'string', required: true, desc: 'Indicator code (e.g. NY.GDP.MKTP.CD)' }],
    },
    {
      name: 'search_tables', display: 'Search indicators', cost: 1,
      params: 'query',
      inputs: [{ name: 'query', type: 'string', required: true, desc: 'Search term' }],
    },
  ],
  serverTs: `/**
 * settlegrid-indonesia-data — Indonesian Statistics MCP Server
 *
 * Wraps World Bank API (IDN) with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   list_subjects()                        — List topics (1¢)
 *   get_indicator(id)                      — Get indicator data (1¢)
 *   search_tables(query)                   — Search indicators (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListSubjectsInput {}

interface GetIndicatorInput {
  id: string
}

interface SearchTablesInput {
  query: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'
const COUNTRY = 'IDN'
const USER_AGENT = 'settlegrid-indonesia-data/1.0 (contact@settlegrid.ai)'

async function apiFetch<T>(path: string, options: {
  params?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path}\`)
  url.searchParams.set('format', 'json')
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'indonesia-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_subjects: { costCents: 1, displayName: 'List indicator topics' },
      get_indicator: { costCents: 1, displayName: 'Get indicator data' },
      search_tables: { costCents: 1, displayName: 'Search indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listSubjects = sg.wrap(async (_args: ListSubjectsInput) => {
  const data = await apiFetch<unknown[]>('/topic')
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], topics: data[1] } : data
}, { method: 'list_subjects' })

const getIndicator = sg.wrap(async (args: GetIndicatorInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (indicator code)')
  }
  const data = await apiFetch<unknown[]>(\`/country/\${COUNTRY}/indicator/\${args.id}\`)
  return Array.isArray(data) && data.length > 1 ? { metadata: data[0], data: data[1] } : data
}, { method: 'get_indicator' })

const searchTables = sg.wrap(async (args: SearchTablesInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required (search term)')
  }
  const data = await apiFetch<unknown[]>('/indicator', { params: { per_page: '50' } })
  if (Array.isArray(data) && data.length > 1) {
    const indicators = Array.isArray(data[1]) ? data[1].filter((i: any) =>
      JSON.stringify(i).toLowerCase().includes(args.query.toLowerCase())
    ) : data[1]
    return { metadata: data[0], results: indicators }
  }
  return data
}, { method: 'search_tables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listSubjects, getIndicator, searchTables }

console.log('settlegrid-indonesia-data MCP server ready')
console.log('Methods: list_subjects, get_indicator, search_tables')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ═══════════════════════════════════════════════════════════════════════════
// 34. Thailand Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'thailand-data', 'Thai Statistics', 'THA',
  'Access Thai economic and demographic indicators via World Bank API.',
  'get_population_data', 'Get population data for Thailand', 'SP.POP.TOTL', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 35. Vietnam Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'vietnam-data', 'Vietnamese Data', 'VNM',
  'Access Vietnamese economic and development indicators via World Bank API.',
  'get_gdp_data', 'Get GDP data for Vietnam', 'NY.GDP.MKTP.CD', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 36. Philippines Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'philippines-data', 'Philippine Data', 'PHL',
  'Access Philippine economic and demographic indicators via World Bank API.',
  'get_population_data', 'Get population data for Philippines', 'SP.POP.TOTL', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 37. Colombia Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'colombia-data', 'Colombian Data', 'COL',
  'Access Colombian economic and development indicators via World Bank API.',
  'get_gdp_data', 'Get GDP data for Colombia', 'NY.GDP.MKTP.CD', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 38. Argentina Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'argentina-data', 'Argentine Data', 'ARG',
  'Access Argentine economic data and inflation indicators via World Bank API.',
  'get_inflation_data', 'Get inflation data for Argentina', 'FP.CPI.TOTL.ZG', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 39. Chile Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'chile-data', 'Chilean Data', 'CHL',
  'Access Chilean economic and development indicators via World Bank API.',
  'get_gdp_data', 'Get GDP data for Chile', 'NY.GDP.MKTP.CD', 'year'
))

// ═══════════════════════════════════════════════════════════════════════════
// 40. Peru Data (World Bank)
// ═══════════════════════════════════════════════════════════════════════════

gen(worldBankServer(
  'peru-data', 'Peruvian Data', 'PER',
  'Access Peruvian economic and demographic indicators via World Bank API.',
  'get_population_data', 'Get population data for Peru', 'SP.POP.TOTL', 'year'
))

console.log('\nBatch 3a complete — 40 International Government Data servers generated')
