/**
 * settlegrid-genome-browser — Genomic Data MCP Server
 *
 * Provides gene information, chromosome data, and genetic code lookup
 * using the Ensembl REST API and local reference data.
 *
 * Methods:
 *   get_gene(symbol)              — Get gene information            (2c)
 *   get_chromosome(number)        — Get chromosome details          (2c)
 *   lookup_codon(codon)           — Translate codon to amino acid   (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetGeneInput { symbol: string }
interface GetChromosomeInput { number: string }
interface LookupCodonInput { codon: string }

const CHROMOSOMES: Record<string, { length_bp: number; genes: number; type: string }> = {
  '1': { length_bp: 248956422, genes: 2058, type: 'autosome' },
  '2': { length_bp: 242193529, genes: 1309, type: 'autosome' },
  '3': { length_bp: 198295559, genes: 1078, type: 'autosome' },
  '7': { length_bp: 159345973, genes: 989, type: 'autosome' },
  '11': { length_bp: 135086622, genes: 1303, type: 'autosome' },
  '17': { length_bp: 83257441, genes: 1197, type: 'autosome' },
  '22': { length_bp: 50818468, genes: 488, type: 'autosome' },
  'X': { length_bp: 156040895, genes: 842, type: 'sex chromosome' },
  'Y': { length_bp: 57227415, genes: 63, type: 'sex chromosome' },
  'MT': { length_bp: 16569, genes: 37, type: 'mitochondrial' },
}

const CODON_TABLE: Record<string, { amino_acid: string; abbreviation: string; type: string }> = {
  UUU: { amino_acid: 'Phenylalanine', abbreviation: 'Phe (F)', type: 'nonpolar' },
  UUC: { amino_acid: 'Phenylalanine', abbreviation: 'Phe (F)', type: 'nonpolar' },
  UUA: { amino_acid: 'Leucine', abbreviation: 'Leu (L)', type: 'nonpolar' },
  UUG: { amino_acid: 'Leucine', abbreviation: 'Leu (L)', type: 'nonpolar' },
  AUG: { amino_acid: 'Methionine (START)', abbreviation: 'Met (M)', type: 'nonpolar' },
  UAA: { amino_acid: 'STOP', abbreviation: 'Stop', type: 'stop' },
  UAG: { amino_acid: 'STOP', abbreviation: 'Stop', type: 'stop' },
  UGA: { amino_acid: 'STOP', abbreviation: 'Stop', type: 'stop' },
  GCU: { amino_acid: 'Alanine', abbreviation: 'Ala (A)', type: 'nonpolar' },
  GAU: { amino_acid: 'Aspartic acid', abbreviation: 'Asp (D)', type: 'acidic' },
  UGU: { amino_acid: 'Cysteine', abbreviation: 'Cys (C)', type: 'polar' },
  GGU: { amino_acid: 'Glycine', abbreviation: 'Gly (G)', type: 'nonpolar' },
  AAA: { amino_acid: 'Lysine', abbreviation: 'Lys (K)', type: 'basic' },
  UGG: { amino_acid: 'Tryptophan', abbreviation: 'Trp (W)', type: 'nonpolar' },
}

const sg = settlegrid.init({
  toolSlug: 'genome-browser',
  pricing: { defaultCostCents: 2, methods: {
    get_gene: { costCents: 2, displayName: 'Get Gene Info' },
    get_chromosome: { costCents: 2, displayName: 'Get Chromosome' },
    lookup_codon: { costCents: 1, displayName: 'Lookup Codon' },
  }},
})

const getGene = sg.wrap(async (args: GetGeneInput) => {
  if (!args.symbol) throw new Error('gene symbol required (e.g. "BRCA1", "TP53")')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(`https://rest.ensembl.org/lookup/symbol/homo_sapiens/${encodeURIComponent(args.symbol)}?content-type=application/json`, { signal: controller.signal })
    if (!res.ok) throw new Error(`Gene not found: ${args.symbol}`)
    const data = await res.json() as Record<string, unknown>
    return {
      symbol: data.display_name, description: data.description,
      chromosome: data.seq_region_name, start: data.start, end: data.end, strand: data.strand,
      biotype: data.biotype, species: 'Homo sapiens',
      ensembl_id: data.id,
    }
  } finally { clearTimeout(timeout) }
}, { method: 'get_gene' })

const getChromosome = sg.wrap(async (args: GetChromosomeInput) => {
  if (!args.number) throw new Error('chromosome number required (1-22, X, Y, MT)')
  const chr = CHROMOSOMES[args.number.toUpperCase()]
  if (!chr) throw new Error(`Unknown. Available: ${Object.keys(CHROMOSOMES).join(', ')}`)
  return { chromosome: args.number, ...chr, length_mbp: Math.round(chr.length_bp / 1000000 * 10) / 10, species: 'Homo sapiens' }
}, { method: 'get_chromosome' })

const lookupCodon = sg.wrap(async (args: LookupCodonInput) => {
  if (!args.codon || args.codon.length !== 3) throw new Error('codon required (3 nucleotides, e.g. "AUG")')
  const c = args.codon.toUpperCase().replace(/T/g, 'U')
  const result = CODON_TABLE[c]
  if (!result) return { codon: args.codon, note: 'Codon not in lookup table — verify nucleotide sequence' }
  return { codon: c, ...result }
}, { method: 'lookup_codon' })

export { getGene, getChromosome, lookupCodon }
console.log('settlegrid-genome-browser MCP server ready')
console.log('Methods: get_gene, get_chromosome, lookup_codon')
console.log('Pricing: 2c per call | Powered by SettleGrid')
