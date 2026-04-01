/**
 * settlegrid-rna-central — RNA Sequence Tools MCP Server
 *
 * RNA Sequence Tools tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface TranscribeInput { dna: string }
interface TranslateInput { rna: string }

const CODON_TABLE: Record<string, string> = { UUU:'F',UUC:'F',UUA:'L',UUG:'L',CUU:'L',CUC:'L',CUA:'L',CUG:'L',AUU:'I',AUC:'I',AUA:'I',AUG:'M',GUU:'V',GUC:'V',GUA:'V',GUG:'V',UCU:'S',UCC:'S',UCA:'S',UCG:'S',CCU:'P',CCC:'P',CCA:'P',CCG:'P',ACU:'T',ACC:'T',ACA:'T',ACG:'T',GCU:'A',GCC:'A',GCA:'A',GCG:'A',UAU:'Y',UAC:'Y',UAA:'*',UAG:'*',CAU:'H',CAC:'H',CAA:'Q',CAG:'Q',AAU:'N',AAC:'N',AAA:'K',AAG:'K',GAU:'D',GAC:'D',GAA:'E',GAG:'E',UGU:'C',UGC:'C',UGA:'*',UGG:'W',CGU:'R',CGC:'R',CGA:'R',CGG:'R',AGU:'S',AGC:'S',AGA:'R',AGG:'R',GGU:'G',GGC:'G',GGA:'G',GGG:'G' }

const sg = settlegrid.init({ toolSlug: 'rna-central', pricing: { defaultCostCents: 1, methods: {
  transcribe: { costCents: 1, displayName: 'DNA to RNA' },
  translate: { costCents: 1, displayName: 'RNA to Protein' },
  gc_content: { costCents: 1, displayName: 'GC Content' },
}}})

const transcribe = sg.wrap(async (args: TranscribeInput) => {
  if (!args.dna) throw new Error('dna sequence required')
  const dna = args.dna.toUpperCase().replace(/[^ATCG]/g, '')
  if (!dna) throw new Error('Invalid DNA sequence (use A, T, C, G)')
  const rna = dna.replace(/T/g, 'U')
  const complement = dna.split('').map(n => ({ A:'T',T:'A',C:'G',G:'C' }[n] ?? n)).join('')
  return { dna: args.dna, rna, complement, length: dna.length }
}, { method: 'transcribe' })

const translate = sg.wrap(async (args: TranslateInput) => {
  if (!args.rna) throw new Error('rna sequence required')
  const rna = args.rna.toUpperCase().replace(/[^AUCG]/g, '')
  const protein: string[] = []
  for (let i = 0; i <= rna.length - 3; i += 3) {
    const codon = rna.slice(i, i + 3)
    const aa = CODON_TABLE[codon] ?? '?'
    if (aa === '*') break
    protein.push(aa)
  }
  return { rna: args.rna, protein: protein.join(''), codons: Math.floor(rna.length / 3), amino_acids: protein.length }
}, { method: 'translate' })

const gcContent = sg.wrap(async (args: { sequence: string }) => {
  if (!args.sequence) throw new Error('sequence required')
  const seq = args.sequence.toUpperCase().replace(/[^ATCGU]/g, '')
  const gc = (seq.match(/[GC]/g)?.length ?? 0) / Math.max(seq.length, 1)
  return { sequence_length: seq.length, gc_content: Math.round(gc * 10000) / 100, at_content: Math.round((1 - gc) * 10000) / 100, classification: gc > 0.6 ? 'GC-rich' : gc < 0.4 ? 'AT-rich' : 'balanced' }
}, { method: 'gc_content' })

export { transcribe, translate, gcContent }
console.log('settlegrid-rna-central MCP server ready | Powered by SettleGrid')
