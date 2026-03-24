import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "lng-prices", pricing: { defaultCostCents: 2, methods: {
  get_spot_price: { costCents: 2, displayName: "Get Spot Price" },
  get_market_overview: { costCents: 2, displayName: "Get Market Overview" },
}}})
const regions: Record<string, { price_usd_mmbtu: number; change_pct: number; benchmark: string }> = {
  asia_jkm: { price_usd_mmbtu: 10.85, change_pct: -2.3, benchmark: "JKM (Japan Korea Marker)" },
  europe_ttf: { price_usd_mmbtu: 8.92, change_pct: -1.1, benchmark: "TTF (Netherlands)" },
  us_henry_hub: { price_usd_mmbtu: 1.78, change_pct: 0.5, benchmark: "Henry Hub" },
  south_america: { price_usd_mmbtu: 11.20, change_pct: 1.8, benchmark: "South America DES" },
  middle_east: { price_usd_mmbtu: 9.45, change_pct: -0.7, benchmark: "Middle East DES" },
}
const getSpotPrice = sg.wrap(async (args: { region: string }) => {
  if (!args.region) throw new Error("region is required")
  const r = regions[args.region.toLowerCase().replace(/[- ]/g, "_")]
  if (!r) throw new Error(`Unknown region. Available: ${Object.keys(regions).join(", ")}`)
  return { region: args.region, ...r }
}, { method: "get_spot_price" })
const getMarketOverview = sg.wrap(async (_args: Record<string, never>) => {
  return {
    global_trade_mt: 401, top_exporters: ["Australia", "Qatar", "United States", "Russia", "Malaysia"],
    top_importers: ["China", "Japan", "South Korea", "India", "Taiwan"],
    fleet_size: 700, regions: Object.entries(regions).map(([k, v]) => ({ region: k, ...v })),
  }
}, { method: "get_market_overview" })
export { getSpotPrice, getMarketOverview }
console.log("settlegrid-lng-prices MCP server ready | 2c/call | Powered by SettleGrid")
