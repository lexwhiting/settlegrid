import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "drug-interactions", pricing: { defaultCostCents: 2, methods: {
  check_interaction: { costCents: 2, displayName: "Check Drug Interaction" },
  get_drug_info: { costCents: 2, displayName: "Get Drug Info" },
}}})
const interactions: Record<string, { severity: string; description: string }> = {
  "warfarin+aspirin": { severity: "major", description: "Increased bleeding risk. Monitor INR closely." },
  "metformin+alcohol": { severity: "major", description: "Risk of lactic acidosis. Avoid excessive alcohol." },
  "ssri+maoi": { severity: "contraindicated", description: "Risk of serotonin syndrome. Never combine." },
  "statin+grapefruit": { severity: "moderate", description: "Grapefruit increases statin levels. Monitor for muscle pain." },
  "ace_inhibitor+potassium": { severity: "major", description: "Risk of hyperkalemia. Monitor potassium levels." },
  "metformin+contrast_dye": { severity: "major", description: "Risk of lactic acidosis. Hold metformin 48h before/after." },
  "warfarin+vitamin_k": { severity: "moderate", description: "Vitamin K reduces warfarin efficacy. Maintain consistent intake." },
}
const checkInteraction = sg.wrap(async (args: { drug_a: string; drug_b: string }) => {
  if (!args.drug_a || !args.drug_b) throw new Error("drug_a and drug_b are required")
  const key1 = `${args.drug_a.toLowerCase()}+${args.drug_b.toLowerCase()}`
  const key2 = `${args.drug_b.toLowerCase()}+${args.drug_a.toLowerCase()}`
  const inter = interactions[key1] || interactions[key2]
  if (!inter) return { drug_a: args.drug_a, drug_b: args.drug_b, interaction_found: false, note: "No known interaction in database. Always consult a pharmacist." }
  return { drug_a: args.drug_a, drug_b: args.drug_b, interaction_found: true, ...inter, disclaimer: "For informational purposes only. Consult healthcare provider." }
}, { method: "check_interaction" })
const drugs: Record<string, { class: string; uses: string[]; common_side_effects: string[] }> = {
  metformin: { class: "Biguanide", uses: ["Type 2 diabetes"], common_side_effects: ["nausea", "diarrhea", "abdominal pain"] },
  lisinopril: { class: "ACE Inhibitor", uses: ["Hypertension", "Heart failure"], common_side_effects: ["dry cough", "dizziness", "hyperkalemia"] },
  atorvastatin: { class: "Statin", uses: ["High cholesterol", "CVD prevention"], common_side_effects: ["muscle pain", "headache", "nausea"] },
  omeprazole: { class: "Proton Pump Inhibitor", uses: ["GERD", "Peptic ulcer"], common_side_effects: ["headache", "nausea", "B12 deficiency"] },
  sertraline: { class: "SSRI", uses: ["Depression", "Anxiety", "OCD"], common_side_effects: ["nausea", "insomnia", "sexual dysfunction"] },
}
const getDrugInfo = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const d = drugs[args.name.toLowerCase()]
  if (!d) throw new Error(`Unknown drug. Available: ${Object.keys(drugs).join(", ")}`)
  return { name: args.name, ...d, disclaimer: "For informational purposes only." }
}, { method: "get_drug_info" })
export { checkInteraction, getDrugInfo }
console.log("settlegrid-drug-interactions MCP server ready | 2c/call | Powered by SettleGrid")
