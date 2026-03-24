/**
 * settlegrid-noaa-climate — NOAA Climate Data MCP Server
 *
 * Wraps the NOAA Climate Data API with SettleGrid billing.
 * Requires NOAA_CDO_TOKEN environment variable.
 *
 * Methods:
 *   get_datasets()                           (1¢)
 *   get_data(datasetid, startdate, enddate)  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetDatasetsInput {
}

interface GetDataInput {
  datasetid: string
  startdate: string
  enddate: string
  locationid?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.ncdc.noaa.gov/cdo-web/api/v2'
const USER_AGENT = 'settlegrid-noaa-climate/1.0 (contact@settlegrid.ai)'

function getApiKey(): string {
  const key = process.env.NOAA_CDO_TOKEN
  if (!key) throw new Error('NOAA_CDO_TOKEN environment variable is required')
  return key
}

async function apiFetch<T>(path: string, options: {
  method?: string
  params?: Record<string, string>
  body?: unknown
  headers?: Record<string, string>
} = {}): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`)
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      url.searchParams.set(k, v)
    }
  }
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'token': `${getApiKey()}`,
    ...options.headers,
  }
  const fetchOpts: RequestInit = { method: options.method ?? 'GET', headers }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), fetchOpts)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`NOAA Climate Data API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'noaa-climate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_datasets: { costCents: 1, displayName: 'List available climate datasets' },
      get_data: { costCents: 2, displayName: 'Get climate data observations' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDatasets = sg.wrap(async (args: GetDatasetsInput) => {

  const params: Record<string, string> = {}

  const data = await apiFetch<Record<string, unknown>>('/datasets', {
    params,
  })

  return data
}, { method: 'get_datasets' })

const getData = sg.wrap(async (args: GetDataInput) => {
  if (!args.datasetid || typeof args.datasetid !== 'string') {
    throw new Error('datasetid is required (dataset id (e.g. ghcnd))')
  }
  if (!args.startdate || typeof args.startdate !== 'string') {
    throw new Error('startdate is required (start date yyyy-mm-dd)')
  }
  if (!args.enddate || typeof args.enddate !== 'string') {
    throw new Error('enddate is required (end date yyyy-mm-dd)')
  }

  const params: Record<string, string> = {}
  params['datasetid'] = args.datasetid
  params['startdate'] = args.startdate
  params['enddate'] = args.enddate
  if (args.locationid !== undefined) params['locationid'] = String(args.locationid)

  const data = await apiFetch<Record<string, unknown>>('/data', {
    params,
  })

  return data
}, { method: 'get_data' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDatasets, getData }

console.log('settlegrid-noaa-climate MCP server ready')
console.log('Methods: get_datasets, get_data')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
