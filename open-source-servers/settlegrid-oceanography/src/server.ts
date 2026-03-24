import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "oceanography", pricing: { defaultCostCents: 2, methods: {
  get_ocean: { costCents: 2, displayName: "Get Ocean Data" },
  get_ocean_current: { costCents: 2, displayName: "Get Ocean Current" },
}}})
const oceans: Record<string, { area_million_km2: number; avg_depth_m: number; max_depth_m: string; volume_million_km3: number; salinity_psu: number }> = {
  pacific: { area_million_km2: 165.25, avg_depth_m: 4280, max_depth_m: "10994 (Mariana Trench)", volume_million_km3: 710, salinity_psu: 34.5 },
  atlantic: { area_million_km2: 106.46, avg_depth_m: 3646, max_depth_m: "8376 (Puerto Rico Trench)", volume_million_km3: 310, salinity_psu: 35.0 },
  indian: { area_million_km2: 73.56, avg_depth_m: 3741, max_depth_m: "7258 (Java Trench)", volume_million_km3: 264, salinity_psu: 34.8 },
  southern: { area_million_km2: 21.96, avg_depth_m: 3270, max_depth_m: "7236 (South Sandwich Trench)", volume_million_km3: 71.8, salinity_psu: 34.7 },
  arctic: { area_million_km2: 14.06, avg_depth_m: 1205, max_depth_m: "5550 (Molloy Deep)", volume_million_km3: 18.75, salinity_psu: 32.0 },
}
const getOcean = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const o = oceans[args.name.toLowerCase()]
  if (!o) throw new Error(`Unknown ocean. Available: ${Object.keys(oceans).join(", ")}`)
  return { ocean: args.name, ...o }
}, { method: "get_ocean" })
const currents: Record<string, { type: string; speed_knots: number; temperature: string; ocean: string; length_km: number }> = {
  gulf_stream: { type: "warm", speed_knots: 4.0, temperature: "24-28°C", ocean: "Atlantic", length_km: 6400 },
  kuroshio: { type: "warm", speed_knots: 2.5, temperature: "20-25°C", ocean: "Pacific", length_km: 3000 },
  humboldt: { type: "cold", speed_knots: 0.5, temperature: "15-20°C", ocean: "Pacific", length_km: 2500 },
  antarctic_circumpolar: { type: "cold", speed_knots: 0.5, temperature: "1-5°C", ocean: "Southern", length_km: 21000 },
  agulhas: { type: "warm", speed_knots: 3.5, temperature: "22-27°C", ocean: "Indian", length_km: 2500 },
}
const getOceanCurrent = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const c = currents[args.name.toLowerCase().replace(/[- ]/g, "_")]
  if (!c) throw new Error(`Unknown current. Available: ${Object.keys(currents).join(", ")}`)
  return { current: args.name, ...c }
}, { method: "get_ocean_current" })
export { getOcean, getOceanCurrent }
console.log("settlegrid-oceanography MCP server ready | 2c/call | Powered by SettleGrid")
