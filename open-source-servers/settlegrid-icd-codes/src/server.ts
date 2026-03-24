import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "icd-codes", pricing: { defaultCostCents: 2, methods: {
  search_codes: { costCents: 2, displayName: "Search ICD Codes" },
  get_code: { costCents: 2, displayName: "Get ICD Code" },
}}})
const codes: Record<string, { description: string; category: string; chapter: string }> = {
  "A09": { description: "Infectious gastroenteritis and colitis, unspecified", category: "Intestinal infectious diseases", chapter: "I" },
  "E11": { description: "Type 2 diabetes mellitus", category: "Diabetes mellitus", chapter: "IV" },
  "I10": { description: "Essential (primary) hypertension", category: "Hypertensive diseases", chapter: "IX" },
  "J06": { description: "Acute upper respiratory infections of multiple and unspecified sites", category: "Acute upper respiratory infections", chapter: "X" },
  "K21": { description: "Gastro-oesophageal reflux disease", category: "Diseases of oesophagus, stomach and duodenum", chapter: "XI" },
  "M54": { description: "Dorsalgia (back pain)", category: "Dorsopathies", chapter: "XIII" },
  "F32": { description: "Major depressive disorder, single episode", category: "Mood disorders", chapter: "V" },
  "F41": { description: "Other anxiety disorders", category: "Anxiety disorders", chapter: "V" },
  "G43": { description: "Migraine", category: "Episodic and paroxysmal disorders", chapter: "VI" },
  "N39": { description: "Other disorders of urinary system", category: "Other diseases of urinary system", chapter: "XIV" },
  "R10": { description: "Abdominal and pelvic pain", category: "Symptoms involving digestive system", chapter: "XVIII" },
  "Z00": { description: "Encounter for general examination without complaint", category: "Persons encountering health services for examinations", chapter: "XXI" },
}
const searchCodes = sg.wrap(async (args: { query: string }) => {
  if (!args.query) throw new Error("query is required")
  const q = args.query.toLowerCase()
  const results = Object.entries(codes).filter(([k, v]) => k.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || v.category.toLowerCase().includes(q)).map(([code, info]) => ({ code, ...info }))
  return { query: args.query, count: results.length, results: results.slice(0, 20), version: "ICD-10" }
}, { method: "search_codes" })
const getCode = sg.wrap(async (args: { code: string }) => {
  if (!args.code) throw new Error("code is required (e.g. I10, E11)")
  const c = codes[args.code.toUpperCase()]
  if (!c) throw new Error(`Code not found: ${args.code}`)
  return { code: args.code.toUpperCase(), ...c, version: "ICD-10" }
}, { method: "get_code" })
export { searchCodes, getCode }
console.log("settlegrid-icd-codes MCP server ready | 2c/call | Powered by SettleGrid")
