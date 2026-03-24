import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "physics-constants", pricing: { defaultCostCents: 1, methods: {
  get_constant: { costCents: 1, displayName: "Get Constant" },
  search_constants: { costCents: 1, displayName: "Search Constants" },
}}})
const constants: Record<string, { value: string; unit: string; uncertainty: string }> = {
  speed_of_light: { value: "299792458", unit: "m/s", uncertainty: "exact" },
  planck: { value: "6.62607015e-34", unit: "J·s", uncertainty: "exact" },
  gravitational: { value: "6.67430e-11", unit: "m³/(kg·s²)", uncertainty: "2.2e-15" },
  boltzmann: { value: "1.380649e-23", unit: "J/K", uncertainty: "exact" },
  avogadro: { value: "6.02214076e23", unit: "1/mol", uncertainty: "exact" },
  elementary_charge: { value: "1.602176634e-19", unit: "C", uncertainty: "exact" },
  electron_mass: { value: "9.1093837015e-31", unit: "kg", uncertainty: "2.8e-40" },
  proton_mass: { value: "1.67262192369e-27", unit: "kg", uncertainty: "5.1e-37" },
  fine_structure: { value: "7.2973525693e-3", unit: "dimensionless", uncertainty: "1.1e-12" },
  gas_constant: { value: "8.314462618", unit: "J/(mol·K)", uncertainty: "exact" },
  vacuum_permittivity: { value: "8.8541878128e-12", unit: "F/m", uncertainty: "1.3e-21" },
  vacuum_permeability: { value: "1.25663706212e-6", unit: "N/A²", uncertainty: "1.9e-16" },
  stefan_boltzmann: { value: "5.670374419e-8", unit: "W/(m²·K⁴)", uncertainty: "exact" },
  rydberg: { value: "10973731.568160", unit: "1/m", uncertainty: "2.1e-5" },
  bohr_radius: { value: "5.29177210903e-11", unit: "m", uncertainty: "8.0e-21" },
}
const getConstant = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const key = args.name.toLowerCase().replace(/[- ]/g, "_")
  const c = constants[key]
  if (!c) throw new Error(`Unknown constant. Available: ${Object.keys(constants).join(", ")}`)
  return { name: args.name, ...c, source: "NIST CODATA 2018" }
}, { method: "get_constant" })
const searchConstants = sg.wrap(async (args: { query: string }) => {
  if (!args.query) throw new Error("query is required")
  const q = args.query.toLowerCase()
  const matches = Object.entries(constants).filter(([k]) => k.includes(q)).map(([k, v]) => ({ name: k, ...v }))
  return { query: args.query, count: matches.length, results: matches }
}, { method: "search_constants" })
export { getConstant, searchConstants }
console.log("settlegrid-physics-constants MCP server ready | 1c/call | Powered by SettleGrid")
