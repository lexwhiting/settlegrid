import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "bond-spreads", pricing: { defaultCostCents: 2, methods: {
  get_spread: { costCents: 2, displayName: "Get Bond Spread" },
  get_yield_curve: { costCents: 2, displayName: "Get Yield Curve" },
}}})
const spreads: Record<string, { spread_bps: number; rating: string; yield_pct: number }> = {
  us_ig: { spread_bps: 98, rating: "BBB", yield_pct: 5.42 },
  us_hy: { spread_bps: 332, rating: "BB", yield_pct: 7.76 },
  eu_ig: { spread_bps: 112, rating: "BBB", yield_pct: 3.94 },
  em_sovereign: { spread_bps: 285, rating: "BB+", yield_pct: 7.29 },
  us_mbs: { spread_bps: 45, rating: "AAA", yield_pct: 5.89 },
}
const getSpread = sg.wrap(async (args: { category: string }) => {
  if (!args.category) throw new Error("category is required")
  const s = spreads[args.category.toLowerCase().replace(/[- ]/g, "_")]
  if (!s) throw new Error(`Unknown. Available: ${Object.keys(spreads).join(", ")}`)
  return { category: args.category, ...s }
}, { method: "get_spread" })
const getYieldCurve = sg.wrap(async (args: { country?: string }) => {
  const country = args.country ?? "us"
  const curves: Record<string, Record<string, number>> = {
    us: { "1m": 5.53, "3m": 5.46, "6m": 5.36, "1y": 5.02, "2y": 4.62, "5y": 4.20, "10y": 4.22, "30y": 4.37 },
    de: { "1m": 3.81, "3m": 3.78, "6m": 3.62, "1y": 3.31, "2y": 2.89, "5y": 2.41, "10y": 2.36, "30y": 2.54 },
    jp: { "1m": -0.05, "3m": 0.01, "6m": 0.06, "1y": 0.11, "2y": 0.19, "5y": 0.42, "10y": 0.74, "30y": 1.78 },
  }
  const curve = curves[country.toLowerCase()]
  if (!curve) throw new Error(`Unknown country. Available: ${Object.keys(curves).join(", ")}`)
  return { country, yield_curve: curve }
}, { method: "get_yield_curve" })
export { getSpread, getYieldCurve }
console.log("settlegrid-bond-spreads MCP server ready | 2c/call | Powered by SettleGrid")
