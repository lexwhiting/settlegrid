/**
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
  const url = `${API_BASE}${path}`
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
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
  const data = await apiFetch<any>(`/intensity/date/${args.date}`)
  return {
    date: args.date,
    periods: (data.data || []).map((d: any) => ({
      from: d.from, to: d.to,
      forecast: d.intensity?.forecast, actual: d.intensity?.actual, index: d.intensity?.index,
    })),
  }
}, { method: 'get_intensity_by_date' })

const getRegionalIntensity = sg.wrap(async (args: RegionInput) => {
  const path = args.region_id ? `/regional/regionid/${args.region_id}` : '/regional'
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
