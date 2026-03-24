import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "estonia-data", pricing: { defaultCostCents: 2, methods: {
  get_demographics: { costCents: 2, displayName: "Get Demographics" },
  get_digital_society: { costCents: 2, displayName: "Get Digital Society Stats" },
}}})
const counties: Record<string, number> = { harju: 617400, tartu: 153200, ida_viru: 130800, parnu: 91200, laane_viru: 57200, viljandi: 43500 }
const getDemographics = sg.wrap(async (args: { county?: string }) => {
  if (args.county) {
    const p = counties[args.county.toLowerCase().replace(/ /g, "_")]
    if (!p) throw new Error(`Unknown. Available: ${Object.keys(counties).join(", ")}`)
    return { country: "Estonia", county: args.county, population: p }
  }
  return { country: "Estonia", population: 1373101, year: 2023, eu_member_since: 2004, euro_since: 2011 }
}, { method: "get_demographics" })
const getDigitalSociety = sg.wrap(async (args: { metric?: string }) => {
  const metrics: Record<string, { value: number | string; detail: string }> = {
    e_residency: { value: 109000, detail: "e-residents from 176 countries" },
    digital_id_usage: { value: 99, detail: "percent of population with digital ID" },
    online_voting: { value: 51.1, detail: "percent voted online in 2023 elections" },
    startups_per_capita: { value: 1, detail: "per 258 people (highest in EU)" },
    unicorns: { value: 10, detail: "Skype, Wise, Bolt, Pipedrive, Veriff, etc." },
    digital_services: { value: 99, detail: "percent of govt services online" },
  }
  if (args.metric) {
    const d = metrics[args.metric.toLowerCase()]
    if (!d) throw new Error(`Unknown. Available: ${Object.keys(metrics).join(", ")}`)
    return { country: "Estonia", metric: args.metric, ...d }
  }
  return { country: "Estonia", digital_society: metrics }
}, { method: "get_digital_society" })
export { getDemographics, getDigitalSociety }
console.log("settlegrid-estonia-data MCP server ready | 2c/call | Powered by SettleGrid")
