/**
 * settlegrid-soil-survey — USDA Soil Survey MCP Server
 * Wraps the USDA Soil Data Access (SDA) web service with SettleGrid billing.
 */
import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────
interface SoilType {
  mukey: string
  musym: string
  muname: string
  slopeLow: number | null
  slopeHigh: number | null
  drainageClass: string | null
  taxonomicClass: string | null
}

interface SoilProperties {
  mukey: string
  componentName: string
  textureName: string | null
  ph: number | null
  organicMatter: number | null
  kFactor: number | null
  drainageClass: string | null
  depth: number | null
}

interface MapUnitResult {
  mukey: string
  musym: string
  muname: string
  acres: number | null
  state: string
  county: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────
const SDA_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest'

// ─── Helpers ────────────────────────────────────────────────────────────────
function validateLat(lat: number): number {
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90')
  return lat
}

function validateLon(lon: number): number {
  if (typeof lon !== 'number' || lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180')
  return lon
}

async function runSdaQuery(query: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(SDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, format: 'JSON' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`SDA API error: ${res.status} ${res.statusText} — ${body}`)
  }
  const json = await res.json() as { Table?: Record<string, unknown>[] }
  return json.Table || []
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────
const sg = settlegrid.init({ toolSlug: 'soil-survey' })

// ─── Handlers ───────────────────────────────────────────────────────────────
async function getSoilType(lat: number, lon: number): Promise<{ soils: SoilType[] }> {
  const vLat = validateLat(lat)
  const vLon = validateLon(lon)
  return sg.wrap('get_soil_type', async () => {
    const query = `SELECT mukey, musym, muname, slopegradwta AS slopeLow, slopegradwtb AS slopeHigh, drclassdcd AS drainageClass, taxclname AS taxonomicClass FROM mapunit WHERE mukey IN (SELECT mukey FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${vLon} ${vLat})'))`
    const rows = await runSdaQuery(query)
    return { soils: rows as unknown as SoilType[] }
  })
}

async function getProperties(mukey: string): Promise<{ properties: SoilProperties[] }> {
  if (!mukey || !mukey.trim()) throw new Error('Map unit key (mukey) is required')
  return sg.wrap('get_properties', async () => {
    const query = `SELECT m.mukey, c.compname AS componentName, t.texdesc AS textureName, ch.ph1to1h2o_r AS ph, ch.om_r AS organicMatter, ch.kffact AS kFactor, c.drainagecl AS drainageClass, ch.hzdepb_r AS depth FROM mapunit m INNER JOIN component c ON c.mukey = m.mukey LEFT JOIN chorizon ch ON ch.cokey = c.cokey LEFT JOIN chtexturegrp t ON t.chkey = ch.chkey AND t.rvindicator = 'Yes' WHERE m.mukey = '${mukey.trim()}'`
    const rows = await runSdaQuery(query)
    return { properties: rows as unknown as SoilProperties[] }
  })
}

async function searchMapunits(state: string, county?: string): Promise<{ mapunits: MapUnitResult[] }> {
  if (!state || !state.trim()) throw new Error('State is required')
  return sg.wrap('search_mapunits', async () => {
    let query = `SELECT TOP 100 m.mukey, m.musym, m.muname, m.muacres AS acres, l.areasymbol AS state FROM mapunit m INNER JOIN legend l ON l.lkey = m.lkey WHERE l.areasymbol LIKE '${state.trim().toUpperCase()}%'`
    if (county) query += ` AND l.areaname LIKE '%${county.trim()}%'`
    const rows = await runSdaQuery(query)
    return { mapunits: rows as unknown as MapUnitResult[] }
  })
}

// ─── Exports ────────────────────────────────────────────────────────────────
export { getSoilType, getProperties, searchMapunits }

console.log('settlegrid-soil-survey MCP server loaded')
