import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "materials-db", pricing: { defaultCostCents: 2, methods: {
  get_material: { costCents: 2, displayName: "Get Material" },
  compare_materials: { costCents: 2, displayName: "Compare Materials" },
}}})
interface Material { name: string; type: string; density_g_cm3: number; tensile_mpa: number; youngs_gpa: number; melting_c: number; thermal_conductivity: number; cost_usd_kg: number }
const materials: Record<string, Material> = {
  steel_304: { name: "Stainless Steel 304", type: "metal", density_g_cm3: 8.0, tensile_mpa: 515, youngs_gpa: 193, melting_c: 1400, thermal_conductivity: 16.2, cost_usd_kg: 3.5 },
  aluminum_6061: { name: "Aluminum 6061-T6", type: "metal", density_g_cm3: 2.7, tensile_mpa: 310, youngs_gpa: 68.9, melting_c: 582, thermal_conductivity: 167, cost_usd_kg: 4.0 },
  titanium_grade5: { name: "Titanium Ti-6Al-4V", type: "metal", density_g_cm3: 4.43, tensile_mpa: 950, youngs_gpa: 114, melting_c: 1660, thermal_conductivity: 6.7, cost_usd_kg: 35 },
  carbon_fiber: { name: "Carbon Fiber (T300)", type: "composite", density_g_cm3: 1.76, tensile_mpa: 3530, youngs_gpa: 230, melting_c: 3652, thermal_conductivity: 10, cost_usd_kg: 25 },
  hdpe: { name: "HDPE", type: "polymer", density_g_cm3: 0.96, tensile_mpa: 32, youngs_gpa: 1.1, melting_c: 130, thermal_conductivity: 0.5, cost_usd_kg: 1.2 },
  concrete: { name: "Concrete (C30)", type: "ceramic", density_g_cm3: 2.4, tensile_mpa: 3, youngs_gpa: 30, melting_c: 1500, thermal_conductivity: 1.7, cost_usd_kg: 0.1 },
  glass: { name: "Soda-Lime Glass", type: "ceramic", density_g_cm3: 2.5, tensile_mpa: 50, youngs_gpa: 72, melting_c: 1000, thermal_conductivity: 1.0, cost_usd_kg: 0.8 },
  copper: { name: "Copper C11000", type: "metal", density_g_cm3: 8.94, tensile_mpa: 220, youngs_gpa: 117, melting_c: 1085, thermal_conductivity: 391, cost_usd_kg: 8.5 },
}
const getMaterial = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const key = args.name.toLowerCase().replace(/[- ]/g, "_")
  const m = materials[key]
  if (!m) throw new Error(`Unknown material. Available: ${Object.keys(materials).join(", ")}`)
  return m
}, { method: "get_material" })
const compareMaterials = sg.wrap(async (args: { materials: string[]; property?: string }) => {
  if (!args.materials || args.materials.length < 2) throw new Error("At least 2 materials required")
  const results = args.materials.map(n => {
    const m = materials[n.toLowerCase().replace(/[- ]/g, "_")]
    if (!m) throw new Error(`Unknown material: ${n}`)
    return m
  })
  return { count: results.length, materials: results, property: args.property ?? "all" }
}, { method: "compare_materials" })
export { getMaterial, compareMaterials }
console.log("settlegrid-materials-db MCP server ready | 2c/call | Powered by SettleGrid")
