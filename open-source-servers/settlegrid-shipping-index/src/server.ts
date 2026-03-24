import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "shipping-index", pricing: { defaultCostCents: 2, methods: {
  get_index: { costCents: 2, displayName: "Get Shipping Index" },
  get_route_rates: { costCents: 2, displayName: "Get Route Rates" },
}}})
const indices: Record<string, { value: number; change_pct: number; description: string }> = {
  bdi: { value: 1823, change_pct: 2.4, description: "Baltic Dry Index — bulk carriers" },
  bci: { value: 2456, change_pct: 3.1, description: "Baltic Capesize Index" },
  bpi: { value: 1634, change_pct: 1.8, description: "Baltic Panamax Index" },
  bsi: { value: 1245, change_pct: 0.9, description: "Baltic Supramax Index" },
  scfi: { value: 1876, change_pct: -1.2, description: "Shanghai Containerized Freight Index" },
  harpex: { value: 1234, change_pct: -0.5, description: "Harper Petersen Charter Rates Index" },
}
const getIndex = sg.wrap(async (args: { index: string }) => {
  if (!args.index) throw new Error("index is required")
  const d = indices[args.index.toLowerCase()]
  if (!d) throw new Error(`Unknown. Available: ${Object.keys(indices).join(", ")}`)
  return { index: args.index, ...d }
}, { method: "get_index" })
const routes: Record<string, { rate_usd: number; unit: string; transit_days: number }> = {
  shanghai_rotterdam: { rate_usd: 2450, unit: "per TEU", transit_days: 30 },
  shanghai_la: { rate_usd: 3200, unit: "per TEU", transit_days: 14 },
  rotterdam_ny: { rate_usd: 1800, unit: "per TEU", transit_days: 10 },
  singapore_suez_rotterdam: { rate_usd: 2100, unit: "per TEU", transit_days: 25 },
  tubarao_qingdao: { rate_usd: 18.50, unit: "per tonne (iron ore)", transit_days: 40 },
}
const getRouteRates = sg.wrap(async (args: { route?: string }) => {
  if (args.route) {
    const r = routes[args.route.toLowerCase().replace(/[- ]/g, "_")]
    if (!r) throw new Error(`Unknown route. Available: ${Object.keys(routes).join(", ")}`)
    return { route: args.route, ...r }
  }
  return { count: Object.keys(routes).length, routes: Object.entries(routes).map(([k, v]) => ({ route: k, ...v })) }
}, { method: "get_route_rates" })
export { getIndex, getRouteRates }
console.log("settlegrid-shipping-index MCP server ready | 2c/call | Powered by SettleGrid")
