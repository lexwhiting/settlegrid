import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "seismology-data", pricing: { defaultCostCents: 2, methods: {
  get_recent_quakes: { costCents: 2, displayName: "Get Recent Earthquakes" },
  get_tectonic_plates: { costCents: 2, displayName: "Get Tectonic Plates" },
}}})
const USGS = "https://earthquake.usgs.gov/fdsnws/event/1/query"
const getRecentQuakes = sg.wrap(async (args: { min_magnitude?: number; limit?: number; days?: number }) => {
  const minMag = args.min_magnitude ?? 4.5
  const limit = Math.min(args.limit ?? 10, 50)
  const days = Math.min(args.days ?? 7, 30)
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const url = `${USGS}?format=geojson&minmagnitude=${minMag}&limit=${limit}&starttime=${start.toISOString().slice(0,10)}&endtime=${end.toISOString().slice(0,10)}&orderby=time`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USGS API ${res.status}`)
  const data = await res.json()
  return { count: data.features?.length ?? 0, earthquakes: (data.features ?? []).map((f: any) => ({
    magnitude: f.properties.mag, place: f.properties.place, time: new Date(f.properties.time).toISOString(),
    depth_km: f.geometry?.coordinates?.[2], lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0],
  }))}
}, { method: "get_recent_quakes" })
const plates: Record<string, { type: string; area_million_km2: number; speed_cm_yr: number; notable_boundaries: string[] }> = {
  pacific: { type: "oceanic", area_million_km2: 103.3, speed_cm_yr: 7, notable_boundaries: ["Ring of Fire", "San Andreas Fault"] },
  north_american: { type: "continental+oceanic", area_million_km2: 75.9, speed_cm_yr: 2.3, notable_boundaries: ["San Andreas Fault", "Mid-Atlantic Ridge"] },
  eurasian: { type: "continental+oceanic", area_million_km2: 67.8, speed_cm_yr: 2.1, notable_boundaries: ["Himalayas", "Alps", "Mid-Atlantic Ridge"] },
  african: { type: "continental+oceanic", area_million_km2: 61.3, speed_cm_yr: 2.15, notable_boundaries: ["East African Rift", "Mid-Atlantic Ridge"] },
  antarctic: { type: "continental+oceanic", area_million_km2: 60.9, speed_cm_yr: 1.7, notable_boundaries: ["Antarctic Ridge"] },
  indo_australian: { type: "continental+oceanic", area_million_km2: 58.9, speed_cm_yr: 6.9, notable_boundaries: ["Himalayas", "Sunda Trench"] },
  south_american: { type: "continental+oceanic", area_million_km2: 43.6, speed_cm_yr: 1.7, notable_boundaries: ["Andes", "Mid-Atlantic Ridge"] },
}
const getTectonicPlates = sg.wrap(async (args: { plate?: string }) => {
  if (args.plate) {
    const p = plates[args.plate.toLowerCase().replace(/[- ]/g, "_")]
    if (!p) throw new Error(`Unknown plate. Available: ${Object.keys(plates).join(", ")}`)
    return { plate: args.plate, ...p }
  }
  return { count: Object.keys(plates).length, plates: Object.entries(plates).map(([k, v]) => ({ name: k, ...v })) }
}, { method: "get_tectonic_plates" })
export { getRecentQuakes, getTectonicPlates }
console.log("settlegrid-seismology-data MCP server ready | 2c/call | Powered by SettleGrid")
