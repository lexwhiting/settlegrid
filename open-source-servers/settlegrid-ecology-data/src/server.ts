import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "ecology-data", pricing: { defaultCostCents: 2, methods: {
  get_biome: { costCents: 2, displayName: "Get Biome" },
  get_ecosystem_service: { costCents: 2, displayName: "Get Ecosystem Service" },
}}})
const biomes: Record<string, { area_million_km2: number; biodiversity_index: number; carbon_gt: number; threat_level: string; temperature_range_c: string }> = {
  tropical_rainforest: { area_million_km2: 17.0, biodiversity_index: 0.95, carbon_gt: 228, threat_level: "high", temperature_range_c: "25-28" },
  temperate_forest: { area_million_km2: 10.4, biodiversity_index: 0.72, carbon_gt: 119, threat_level: "moderate", temperature_range_c: "5-20" },
  boreal_forest: { area_million_km2: 12.0, biodiversity_index: 0.45, carbon_gt: 272, threat_level: "moderate", temperature_range_c: "-5-5" },
  savanna: { area_million_km2: 20.0, biodiversity_index: 0.68, carbon_gt: 64, threat_level: "high", temperature_range_c: "20-30" },
  tundra: { area_million_km2: 8.0, biodiversity_index: 0.25, carbon_gt: 1672, threat_level: "critical", temperature_range_c: "-34-12" },
  coral_reef: { area_million_km2: 0.28, biodiversity_index: 0.92, carbon_gt: 2, threat_level: "critical", temperature_range_c: "23-29" },
  mangrove: { area_million_km2: 0.15, biodiversity_index: 0.78, carbon_gt: 6.4, threat_level: "critical", temperature_range_c: "24-28" },
  desert: { area_million_km2: 33.7, biodiversity_index: 0.15, carbon_gt: 19, threat_level: "low", temperature_range_c: "-10-50" },
}
const getBiome = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const key = args.name.toLowerCase().replace(/[- ]/g, "_")
  const b = biomes[key]
  if (!b) throw new Error(`Unknown biome. Available: ${Object.keys(biomes).join(", ")}`)
  return { biome: args.name, ...b }
}, { method: "get_biome" })
const services: Record<string, { value_trillion_usd: number; examples: string[] }> = {
  pollination: { value_trillion_usd: 0.577, examples: ["crop yields", "wild plant reproduction"] },
  water_purification: { value_trillion_usd: 2.3, examples: ["wetland filtration", "soil filtration"] },
  carbon_sequestration: { value_trillion_usd: 4.7, examples: ["forest carbon storage", "ocean absorption"] },
  flood_protection: { value_trillion_usd: 1.8, examples: ["wetlands", "mangroves", "floodplains"] },
  soil_formation: { value_trillion_usd: 1.2, examples: ["decomposition", "nutrient cycling"] },
}
const getEcosystemService = sg.wrap(async (args: { service: string }) => {
  if (!args.service) throw new Error("service is required")
  const key = args.service.toLowerCase().replace(/[- ]/g, "_")
  const s = services[key]
  if (!s) throw new Error(`Unknown service. Available: ${Object.keys(services).join(", ")}`)
  return { service: args.service, ...s }
}, { method: "get_ecosystem_service" })
export { getBiome, getEcosystemService }
console.log("settlegrid-ecology-data MCP server ready | 2c/call | Powered by SettleGrid")
