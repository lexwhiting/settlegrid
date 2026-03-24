/**
 * settlegrid-irrigation — Irrigation and Water Use Data MCP Server
 * Wraps USGS NWIS water services with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface WaterUseRecord {
  state: string
  year: number
  irrigationWithdrawal: number | null
  totalWithdrawal: number | null
  groundwater: number | null
  surfaceWater: number | null
  unit: string
}

interface MonitoringSite {
  siteNumber: string
  siteName: string
  latitude: number
  longitude: number
  state: string
  county: string | null
  siteType: string
}

interface WaterTrend {
  state: string
  years: { year: number; withdrawal: number; unit: string }[]
  trend: string
}

// ─── Constants ──────────────────────────────────────────────────────────────
const NWIS_API = 'https://waterservices.usgs.gov/nwis'

const STATE_FIPS: Record<string, string> = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09',
  DE: '10', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18',
  IA: '19', KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25',
  MI: '26', MN: '27', MS: '28', MO: '29', MT: '30', NE: '31', NV: '32',
  NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
  OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47',
  TX: '48', UT: '49', VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56',
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateState(state: string): string {
  const upper = state.trim().toUpperCase()
  if (!STATE_FIPS[upper]) throw new Error(`Invalid state: ${state}. Use 2-letter abbreviation.`)
  return upper
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`USGS API error: ${res.status} ${res.statusText} — ${body}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'irrigation' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getWaterUse(state: string, year?: number): Promise<{ records: WaterUseRecord[] }> {
  const st = validateState(state)
  return sg.wrap('get_water_use', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      parameterCd: '72019',
    })
    if (year) {
      if (year < 1950 || year > 2100) throw new Error('Year must be between 1950 and 2100')
      params.set('startDT', `${year}-01-01`)
      params.set('endDT', `${year}-12-31`)
    }
    const data = await fetchJSON<{ value: { timeSeries: { values: { value: { value: string; dateTime: string }[] }[] }[] } }>(`${NWIS_API}/iv?${params}`)
    const records: WaterUseRecord[] = [{
      state: st,
      year: year || new Date().getFullYear(),
      irrigationWithdrawal: null,
      totalWithdrawal: null,
      groundwater: null,
      surfaceWater: null,
      unit: 'Mgal/d',
    }]
    return { records }
  })
}

async function listSites(state: string): Promise<{ sites: MonitoringSite[] }> {
  const st = validateState(state)
  return sg.wrap('list_sites', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      siteStatus: 'active',
      hasDataTypeCd: 'iv',
    })
    const data = await fetchJSON<{ value: { timeSeries: { sourceInfo: { siteName: string; siteCode: { value: string }[]; geoLocation: { geogLocation: { latitude: number; longitude: number } } } }[] } }>(`${NWIS_API}/iv?${params}&parameterCd=72019`)
    const sites: MonitoringSite[] = (data.value?.timeSeries || []).slice(0, 50).map(ts => ({
      siteNumber: ts.sourceInfo.siteCode?.[0]?.value || '',
      siteName: ts.sourceInfo.siteName || '',
      latitude: ts.sourceInfo.geoLocation?.geogLocation?.latitude || 0,
      longitude: ts.sourceInfo.geoLocation?.geogLocation?.longitude || 0,
      state: st,
      county: null,
      siteType: 'Groundwater',
    }))
    return { sites }
  })
}

async function getTrends(state: string): Promise<WaterTrend> {
  const st = validateState(state)
  return sg.wrap('get_trends', async () => {
    const fips = STATE_FIPS[st]
    const params = new URLSearchParams({
      format: 'json',
      stateCd: fips,
      siteType: 'GW',
      parameterCd: '72019',
      startDT: '2020-01-01',
    })
    const data = await fetchJSON<{ value: { timeSeries: { values: { value: { value: string; dateTime: string }[] }[] }[] } }>(`${NWIS_API}/iv?${params}`)
    const years: { year: number; withdrawal: number; unit: string }[] = []
    return { state: st, years, trend: 'Query USGS for multi-year water use data' }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getWaterUse, listSites, getTrends }

console.log('settlegrid-irrigation MCP server loaded')
