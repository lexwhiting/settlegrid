import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "enzyme-data", pricing: { defaultCostCents: 2, methods: {
  get_enzyme: { costCents: 2, displayName: "Get Enzyme" },
  search_enzymes: { costCents: 2, displayName: "Search Enzymes" },
}}})
const enzymes: Record<string, { name: string; ec_number: string; reaction: string; cofactors: string[]; substrate: string; optimal_ph: string; optimal_temp_c: string }> = {
  amylase: { name: "Alpha-Amylase", ec_number: "3.2.1.1", reaction: "Starch hydrolysis to maltose", cofactors: ["Ca²⁺", "Cl⁻"], substrate: "Starch", optimal_ph: "6.7-7.0", optimal_temp_c: "37" },
  lipase: { name: "Pancreatic Lipase", ec_number: "3.1.1.3", reaction: "Triglyceride hydrolysis", cofactors: ["colipase"], substrate: "Triglycerides", optimal_ph: "7.0-8.0", optimal_temp_c: "37" },
  catalase: { name: "Catalase", ec_number: "1.11.1.6", reaction: "2 H₂O₂ → 2 H₂O + O₂", cofactors: ["Fe-heme"], substrate: "Hydrogen peroxide", optimal_ph: "7.0", optimal_temp_c: "37" },
  dna_polymerase: { name: "DNA Polymerase III", ec_number: "2.7.7.7", reaction: "DNA replication", cofactors: ["Mg²⁺", "Zn²⁺"], substrate: "dNTPs", optimal_ph: "7.5", optimal_temp_c: "37" },
  trypsin: { name: "Trypsin", ec_number: "3.4.21.4", reaction: "Protein hydrolysis at Arg/Lys", cofactors: ["Ca²⁺"], substrate: "Proteins", optimal_ph: "7.5-8.5", optimal_temp_c: "37" },
  luciferase: { name: "Firefly Luciferase", ec_number: "1.13.12.7", reaction: "Luciferin + O₂ → light", cofactors: ["Mg²⁺", "ATP"], substrate: "Luciferin", optimal_ph: "7.8", optimal_temp_c: "25" },
  lactase: { name: "Lactase", ec_number: "3.2.1.23", reaction: "Lactose → glucose + galactose", cofactors: [], substrate: "Lactose", optimal_ph: "6.0-7.0", optimal_temp_c: "37" },
}
const getEnzyme = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const e = enzymes[args.name.toLowerCase().replace(/[- ]/g, "_")]
  if (!e) throw new Error(`Unknown enzyme. Available: ${Object.keys(enzymes).join(", ")}`)
  return e
}, { method: "get_enzyme" })
const searchEnzymes = sg.wrap(async (args: { query: string }) => {
  if (!args.query) throw new Error("query is required")
  const q = args.query.toLowerCase()
  const results = Object.values(enzymes).filter(e => e.name.toLowerCase().includes(q) || e.reaction.toLowerCase().includes(q))
  return { query: args.query, count: results.length, enzymes: results }
}, { method: "search_enzymes" })
export { getEnzyme, searchEnzymes }
console.log("settlegrid-enzyme-data MCP server ready | 2c/call | Powered by SettleGrid")
