import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "vaccine-data", pricing: { defaultCostCents: 2, methods: {
  get_vaccine: { costCents: 2, displayName: "Get Vaccine Info" },
  get_schedule: { costCents: 2, displayName: "Get Vaccination Schedule" },
}}})
const vaccines: Record<string, { disease: string; type: string; doses: number; efficacy_pct: number; storage: string; manufacturer: string[] }> = {
  mmr: { disease: "Measles, Mumps, Rubella", type: "Live attenuated", doses: 2, efficacy_pct: 97, storage: "2-8°C", manufacturer: ["Merck", "GSK"] },
  polio_ipv: { disease: "Poliomyelitis", type: "Inactivated", doses: 4, efficacy_pct: 99, storage: "2-8°C", manufacturer: ["Sanofi Pasteur"] },
  hpv: { disease: "Human Papillomavirus", type: "Recombinant", doses: 2, efficacy_pct: 97, storage: "2-8°C", manufacturer: ["Merck (Gardasil 9)"] },
  flu: { disease: "Influenza", type: "Inactivated/Live", doses: 1, efficacy_pct: 50, storage: "2-8°C", manufacturer: ["Sanofi", "CSL Seqirus", "AstraZeneca"] },
  covid_mrna: { disease: "COVID-19", type: "mRNA", doses: 2, efficacy_pct: 95, storage: "-20°C", manufacturer: ["Pfizer-BioNTech", "Moderna"] },
  tdap: { disease: "Tetanus, Diphtheria, Pertussis", type: "Inactivated/Toxoid", doses: 5, efficacy_pct: 95, storage: "2-8°C", manufacturer: ["GSK", "Sanofi"] },
}
const getVaccine = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error("name is required")
  const v = vaccines[args.name.toLowerCase().replace(/[- ]/g, "_")]
  if (!v) throw new Error(`Unknown. Available: ${Object.keys(vaccines).join(", ")}`)
  return { name: args.name, ...v }
}, { method: "get_vaccine" })
const getSchedule = sg.wrap(async (args: { age_months: number }) => {
  if (args.age_months === undefined) throw new Error("age_months is required")
  const schedule: Array<{ age: string; vaccines: string[] }> = [
    { age: "Birth", vaccines: ["Hepatitis B (dose 1)"] },
    { age: "2 months", vaccines: ["DTaP", "IPV", "Hib", "PCV13", "RV", "HepB (dose 2)"] },
    { age: "4 months", vaccines: ["DTaP", "IPV", "Hib", "PCV13", "RV"] },
    { age: "6 months", vaccines: ["DTaP", "PCV13", "RV", "HepB (dose 3)", "Influenza"] },
    { age: "12 months", vaccines: ["MMR (dose 1)", "Varicella (dose 1)", "HepA (dose 1)", "PCV13 (dose 4)"] },
    { age: "4-6 years", vaccines: ["DTaP (dose 5)", "IPV (dose 4)", "MMR (dose 2)", "Varicella (dose 2)"] },
    { age: "11-12 years", vaccines: ["Tdap", "HPV", "MenACWY"] },
  ]
  const due = schedule.filter((_, i) => {
    const ages = [0, 2, 4, 6, 12, 54, 138]
    return args.age_months >= ages[i]
  })
  return { age_months: args.age_months, completed_milestones: due.length, schedule: due, source: "CDC recommended schedule" }
}, { method: "get_schedule" })
export { getVaccine, getSchedule }
console.log("settlegrid-vaccine-data MCP server ready | 2c/call | Powered by SettleGrid")
