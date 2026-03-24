/**
 * settlegrid-spectrum — Radio Spectrum Data MCP Server
 *
 * Wraps FCC Open Data API with SettleGrid billing.
 * No API key needed — FCC data is public.
 *
 * Methods:
 *   search_licenses(query?, state?) — Search licenses (1¢)
 *   get_license(id) — License details (1¢)
 *   get_allocation(band?) — Band allocation (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; state?: string }
interface LicenseInput { id: string }
interface AllocationInput { band?: string }

interface FccLicense {
  licenseId: string
  licName: string
  frqBand: string
  callSign: string
  status: string
  serviceDesc: string
  state: string
  marketDesc: string
  expDate: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://opendata.fcc.gov/api'
const LICENSE_API = 'https://data.fcc.gov/api/license-view/basicSearch/getLicenses'

async function apiFetch<T>(path: string): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const SPECTRUM_BANDS: Record<string, { range: string; use: string; notes: string }> = {
  '700mhz': { range: '698-806 MHz', use: 'LTE/5G cellular', notes: 'First responder (Band 14), T-Mobile, AT&T' },
  '850mhz': { range: '824-894 MHz', use: 'Cellular (GSM/CDMA)', notes: 'Legacy cellular bands' },
  '900mhz': { range: '896-960 MHz', use: 'Narrowband IoT, SMR', notes: 'Industrial/enterprise' },
  '1.7ghz': { range: '1710-1755 MHz', use: 'AWS cellular', notes: 'AWS-1 band' },
  '1.9ghz': { range: '1850-1995 MHz', use: 'PCS cellular', notes: 'Major cellular band' },
  '2.4ghz': { range: '2400-2483.5 MHz', use: 'WiFi, Bluetooth, ISM', notes: 'Unlicensed ISM band' },
  '2.5ghz': { range: '2496-2690 MHz', use: '5G mid-band', notes: 'T-Mobile 5G primary' },
  '3.5ghz': { range: '3550-3700 MHz', use: 'CBRS/5G', notes: 'Citizens Broadband Radio Service' },
  '5ghz': { range: '5150-5850 MHz', use: 'WiFi 5/6, U-NII', notes: 'Unlicensed/shared' },
  '6ghz': { range: '5925-7125 MHz', use: 'WiFi 6E', notes: 'Newly opened for unlicensed use' },
  '24ghz': { range: '24.25-27.5 GHz', use: '5G mmWave', notes: 'Ultra-high bandwidth' },
  '28ghz': { range: '27.5-28.35 GHz', use: '5G mmWave', notes: 'Verizon 5G primary' },
  '37ghz': { range: '37-40 GHz', use: '5G mmWave', notes: 'High-capacity 5G' },
  '39ghz': { range: '38.6-40 GHz', use: '5G mmWave', notes: 'T-Mobile, AT&T 5G' },
  '47ghz': { range: '47.2-48.2 GHz', use: '5G mmWave', notes: 'Future 5G expansion' },
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'spectrum',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_licenses: { costCents: 1, displayName: 'Search Licenses' },
      get_license: { costCents: 1, displayName: 'License Details' },
      get_allocation: { costCents: 1, displayName: 'Band Allocation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchLicenses = sg.wrap(async (args: SearchInput) => {
  const query = args.query || 'wireless'
  const params = new URLSearchParams({ searchValue: query, format: 'json', limit: '25' })
  if (args.state) {
    if (args.state.length !== 2) throw new Error('state must be a 2-letter US state code')
    params.set('stateCode', args.state.toUpperCase())
  }
  try {
    const data = await apiFetch<any>(`${LICENSE_API}?${params}`)
    const licenses = data.Licenses?.License || []
    return {
      query,
      state: args.state?.toUpperCase(),
      licenses: Array.isArray(licenses)
        ? licenses.slice(0, 25).map((l: any) => ({
            id: l.licenseId,
            name: l.licName,
            callSign: l.callSign,
            service: l.serviceDesc,
            status: l.status,
            state: l.state,
            expiration: l.expDate,
          }))
        : [],
      count: data.Licenses?.totalRows || 0,
      source: 'FCC License View',
    }
  } catch (err: any) {
    return {
      query,
      state: args.state,
      error: err.message,
      note: 'FCC API may be temporarily unavailable. Try again later.',
      source: 'FCC License View',
    }
  }
}, { method: 'search_licenses' })

const getLicense = sg.wrap(async (args: LicenseInput) => {
  if (!args.id) throw new Error('id is required')
  try {
    const data = await apiFetch<any>(`${LICENSE_API}?searchValue=${args.id}&format=json`)
    const license = data.Licenses?.License
    if (!license) throw new Error(`License ${args.id} not found`)
    const l = Array.isArray(license) ? license[0] : license
    return {
      id: l.licenseId,
      name: l.licName,
      callSign: l.callSign,
      frqBand: l.frqBand,
      service: l.serviceDesc,
      status: l.status,
      state: l.state,
      market: l.marketDesc,
      expiration: l.expDate,
      grantDate: l.grantDate,
      source: 'FCC License View',
    }
  } catch (err: any) {
    return { id: args.id, error: err.message, source: 'FCC License View' }
  }
}, { method: 'get_license' })

const getAllocation = sg.wrap(async (args: AllocationInput) => {
  if (args.band) {
    const key = args.band.toLowerCase().replace(/\s+/g, '')
    const band = SPECTRUM_BANDS[key]
    if (!band) {
      return {
        query: args.band,
        error: `Band '${args.band}' not found`,
        available_bands: Object.keys(SPECTRUM_BANDS),
      }
    }
    return { band: key, ...band, source: 'FCC Spectrum Allocation' }
  }
  const bands = Object.entries(SPECTRUM_BANDS).map(([key, info]) => ({
    band: key,
    ...info,
  }))
  return {
    bands,
    count: bands.length,
    source: 'FCC Spectrum Allocation',
  }
}, { method: 'get_allocation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchLicenses, getLicense, getAllocation }

console.log('settlegrid-spectrum MCP server ready')
console.log('Methods: search_licenses, get_license, get_allocation')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
