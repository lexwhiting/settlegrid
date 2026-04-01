/**
 * settlegrid-enzyme-data — Enzyme Database MCP Server
 *
 * Provides enzyme classification, reaction data, and kinetics parameters.
 * Reference data from EC classification with local enrichment.
 *
 * Methods:
 *   get_enzyme(name_or_ec)        — Get enzyme details              (2c)
 *   search_enzymes(query)         — Search enzyme database          (2c)
 *   get_classes()                 — List EC enzyme classes          (2c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetEnzymeInput { name: string }
interface SearchInput { query: string; limit?: number }

interface EnzymeData { name: string; ec_number: string; class_name: string; reaction: string; substrates: string[]; products: string[]; cofactors: string[]; km_um?: number; kcat_s?: number; ph_optimum: number; temp_optimum_c: number }

const ENZYMES: Record<string, EnzymeData> = {
  hexokinase: { name: 'Hexokinase', ec_number: '2.7.1.1', class_name: 'Transferase', reaction: 'Glucose + ATP -> Glucose-6-phosphate + ADP', substrates: ['glucose', 'ATP'], products: ['glucose-6-phosphate', 'ADP'], cofactors: ['Mg2+'], km_um: 100, kcat_s: 200, ph_optimum: 7.4, temp_optimum_c: 37 },
  dna_polymerase: { name: 'DNA Polymerase I', ec_number: '2.7.7.7', class_name: 'Transferase', reaction: 'dNTP + DNA(n) -> DNA(n+1) + PPi', substrates: ['dNTP', 'template DNA'], products: ['extended DNA', 'pyrophosphate'], cofactors: ['Mg2+', 'Zn2+'], km_um: 10, kcat_s: 15, ph_optimum: 7.5, temp_optimum_c: 37 },
  trypsin: { name: 'Trypsin', ec_number: '3.4.21.4', class_name: 'Hydrolase', reaction: 'Peptide bond hydrolysis (Arg/Lys)', substrates: ['protein/peptide'], products: ['peptide fragments'], cofactors: ['Ca2+'], km_um: 500, kcat_s: 100, ph_optimum: 8.0, temp_optimum_c: 37 },
  catalase: { name: 'Catalase', ec_number: '1.11.1.6', class_name: 'Oxidoreductase', reaction: '2 H2O2 -> 2 H2O + O2', substrates: ['hydrogen peroxide'], products: ['water', 'oxygen'], cofactors: ['heme (Fe)'], km_um: 25000, kcat_s: 40000000, ph_optimum: 7.0, temp_optimum_c: 37 },
  lactase: { name: 'Lactase', ec_number: '3.2.1.108', class_name: 'Hydrolase', reaction: 'Lactose -> Glucose + Galactose', substrates: ['lactose'], products: ['glucose', 'galactose'], cofactors: [], km_um: 3700, kcat_s: 50, ph_optimum: 6.5, temp_optimum_c: 37 },
  amylase: { name: 'Alpha-Amylase', ec_number: '3.2.1.1', class_name: 'Hydrolase', reaction: 'Starch -> Maltose + Dextrins', substrates: ['starch'], products: ['maltose', 'dextrins'], cofactors: ['Ca2+', 'Cl-'], km_um: 2000, kcat_s: 800, ph_optimum: 6.9, temp_optimum_c: 37 },
  atp_synthase: { name: 'ATP Synthase', ec_number: '7.1.2.2', class_name: 'Translocase', reaction: 'ADP + Pi + H+(out) -> ATP + H2O + H+(in)', substrates: ['ADP', 'phosphate', 'H+'], products: ['ATP', 'water'], cofactors: ['Mg2+'], kcat_s: 100, ph_optimum: 7.0, temp_optimum_c: 37 },
  lysozyme: { name: 'Lysozyme', ec_number: '3.2.1.17', class_name: 'Hydrolase', reaction: 'Peptidoglycan hydrolysis', substrates: ['peptidoglycan'], products: ['NAM', 'NAG fragments'], cofactors: [], km_um: 6000, kcat_s: 0.5, ph_optimum: 5.0, temp_optimum_c: 37 },
}

const EC_CLASSES = [
  { class: 1, name: 'Oxidoreductases', description: 'Catalyze oxidation-reduction reactions' },
  { class: 2, name: 'Transferases', description: 'Transfer functional groups between molecules' },
  { class: 3, name: 'Hydrolases', description: 'Catalyze hydrolysis reactions' },
  { class: 4, name: 'Lyases', description: 'Cleave bonds by non-hydrolytic means' },
  { class: 5, name: 'Isomerases', description: 'Catalyze structural rearrangements' },
  { class: 6, name: 'Ligases', description: 'Join molecules using ATP' },
  { class: 7, name: 'Translocases', description: 'Catalyze movement across membranes' },
]

const sg = settlegrid.init({
  toolSlug: 'enzyme-data',
  pricing: { defaultCostCents: 2, methods: {
    get_enzyme: { costCents: 2, displayName: 'Get Enzyme' },
    search_enzymes: { costCents: 2, displayName: 'Search Enzymes' },
    get_classes: { costCents: 2, displayName: 'Get EC Classes' },
  }},
})

const getEnzyme = sg.wrap(async (args: GetEnzymeInput) => {
  if (!args.name) throw new Error('name (or EC number) is required')
  const key = args.name.toLowerCase().replace(/[- ]/g, '_')
  let enzyme = ENZYMES[key]
  if (!enzyme) enzyme = Object.values(ENZYMES).find(e => e.ec_number === args.name) ?? undefined
  if (!enzyme) throw new Error(`Unknown enzyme. Available: ${Object.keys(ENZYMES).join(', ')}`)
  const efficiency = (enzyme.kcat_s && enzyme.km_um) ? Math.round((enzyme.kcat_s / (enzyme.km_um / 1000000)) * 100) / 100 : null
  return { ...enzyme, catalytic_efficiency_M_s: efficiency }
}, { method: 'get_enzyme' })

const searchEnzymes = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query required')
  const q = args.query.toLowerCase()
  const limit = Math.min(args.limit ?? 5, 20)
  const results = Object.entries(ENZYMES)
    .filter(([k, e]) => k.includes(q) || e.name.toLowerCase().includes(q) || e.class_name.toLowerCase().includes(q) || e.reaction.toLowerCase().includes(q))
    .slice(0, limit)
    .map(([, e]) => ({ name: e.name, ec_number: e.ec_number, class_name: e.class_name, reaction: e.reaction }))
  return { query: args.query, results, count: results.length }
}, { method: 'search_enzymes' })

const getClasses = sg.wrap(async (_a: Record<string, never>) => {
  return { classes: EC_CLASSES, count: EC_CLASSES.length }
}, { method: 'get_classes' })

export { getEnzyme, searchEnzymes, getClasses }
console.log('settlegrid-enzyme-data MCP server ready')
console.log('Methods: get_enzyme, search_enzymes, get_classes')
console.log('Pricing: 2c per call | Powered by SettleGrid')
