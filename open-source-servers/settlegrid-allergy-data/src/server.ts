import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "allergy-data", pricing: { defaultCostCents: 1, methods: {
  get_allergen: { costCents: 1, displayName: "Get Allergen Info" },
  check_cross_reactivity: { costCents: 1, displayName: "Check Cross-Reactivity" },
}}})
const allergens: Record<string, { type: string; prevalence_pct: number; symptoms: string[]; avoidance: string[]; emergency: boolean }> = {
  peanut: { type: "food", prevalence_pct: 2.5, symptoms: ["hives", "swelling", "anaphylaxis", "GI distress"], avoidance: ["Check labels for peanut/tree nut", "Carry epinephrine"], emergency: true },
  shellfish: { type: "food", prevalence_pct: 2.0, symptoms: ["hives", "swelling", "GI distress", "anaphylaxis"], avoidance: ["Avoid crustaceans", "Check Asian sauces"], emergency: true },
  dust_mites: { type: "environmental", prevalence_pct: 20, symptoms: ["sneezing", "runny nose", "itchy eyes", "asthma"], avoidance: ["Allergen-proof bedding", "HEPA filter", "Low humidity"], emergency: false },
  pollen: { type: "environmental", prevalence_pct: 30, symptoms: ["sneezing", "congestion", "itchy eyes", "fatigue"], avoidance: ["Monitor pollen counts", "HEPA filter", "Shower after outdoors"], emergency: false },
  latex: { type: "contact", prevalence_pct: 1, symptoms: ["skin rash", "hives", "anaphylaxis"], avoidance: ["Non-latex gloves", "Alert medical providers"], emergency: true },
  penicillin: { type: "drug", prevalence_pct: 10, symptoms: ["rash", "hives", "anaphylaxis", "fever"], avoidance: ["Medical alert bracelet", "Inform all providers"], emergency: true },
}
const getAllergen = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const a = allergens[args.name.toLowerCase().replace(/ /g, "_")]
  if (!a) throw new Error(`Unknown. Available: ${Object.keys(allergens).join(", ")}`)
  return { allergen: args.name, ...a }
}, { method: "get_allergen" })
const crossReactivity: Record<string, string[]> = {
  peanut: ["lupin", "soy", "tree nuts (some)"], latex: ["banana", "avocado", "kiwi", "chestnut"],
  birch_pollen: ["apple", "pear", "cherry", "peach"], shellfish: ["dust mites", "cockroach"],
}
const checkCrossReactivity = sg.wrap(async (args: { allergen: string }) => {
  if (!args.allergen) throw new Error("allergen is required")
  const cr = crossReactivity[args.allergen.toLowerCase().replace(/ /g, "_")]
  return { allergen: args.allergen, cross_reactive_with: cr ?? [], note: cr ? "Cross-reactivity possible but not guaranteed" : "No well-established cross-reactivity data" }
}, { method: "check_cross_reactivity" })
export { getAllergen, checkCrossReactivity }
console.log("settlegrid-allergy-data MCP server ready | 1c/call | Powered by SettleGrid")
