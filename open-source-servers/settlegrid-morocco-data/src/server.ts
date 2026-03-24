/**
 * settlegrid-morocco-data — Morocco HCP Statistics MCP Server
 */
import { settlegrid } from "@settlegrid/mcp"

const sg = settlegrid.init({
  toolSlug: "morocco-data",
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_demographics: { costCents: 2, displayName: "Get Demographics" },
      get_economy: { costCents: 2, displayName: "Get Economy" },
    },
  },
})

const regions: Record<string, { population: number; capital: string }> = {
  casablanca_settat: { population: 7210000, capital: "Casablanca" },
  rabat_sale_kenitra: { population: 4773000, capital: "Rabat" },
  marrakech_safi: { population: 4745000, capital: "Marrakech" },
  fes_meknes: { population: 4300000, capital: "Fes" },
  tangier_tetouan: { population: 3828000, capital: "Tangier" },
  souss_massa: { population: 2826000, capital: "Agadir" },
}

const getDemographics = sg.wrap(async (args: { region?: string }) => {
  if (args.region) {
    const r = regions[args.region.toLowerCase().replace(/[- ]/g, "_")]
    if (!r) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
    return { country: "Morocco", region: args.region, ...r }
  }
  return { country: "Morocco", total_population: 37076584, year: 2023, regions: Object.keys(regions) }
}, { method: "get_demographics" })

const econ: Record<string, { value: number; unit: string }> = {
  gdp: { value: 134.2, unit: "billion USD" },
  unemployment: { value: 11.4, unit: "percent" },
  inflation: { value: 6.1, unit: "percent" },
  phosphate_production: { value: 38, unit: "million tonnes" },
  tourism_revenue: { value: 9.8, unit: "billion USD" },
  remittances: { value: 11.2, unit: "billion USD" },
}

const getEconomy = sg.wrap(async (args: { indicator: string }) => {
  if (!args.indicator) throw new Error("indicator is required")
  const d = econ[args.indicator.toLowerCase()]
  if (!d) throw new Error(`Unknown indicator. Available: ${Object.keys(econ).join(", ")}`)
  return { country: "Morocco", year: 2023, indicator: args.indicator, ...d }
}, { method: "get_economy" })

export { getDemographics, getEconomy }
console.log("settlegrid-morocco-data MCP server ready | 2c/call | Powered by SettleGrid")
