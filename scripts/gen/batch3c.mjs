/**
 * Batch 3c — 40 Niche Science/Research MCP servers (#71-#110)
 */
import { gen } from './core.mjs'

console.log('Batch 3c: Niche Science/Research (40 servers)\n')

// ──────────────────────────────────────────────────────────────────────────────
// 71. settlegrid-genbank
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'genbank',
  title: 'GenBank Genomic Sequences',
  desc: 'Access NCBI GenBank genomic sequence data via E-utilities. Search nucleotide sequences, retrieve FASTA data, and get sequence summaries.',
  api: { base: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils', name: 'NCBI E-utilities', docs: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/' },
  key: null,
  keywords: ['genbank', 'ncbi', 'genomics', 'dna', 'sequences', 'bioinformatics'],
  methods: [
    { name: 'search_sequences', display: 'Search nucleotide sequences by query', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "BRCA1 human", "COVID-19 spike")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 100)' },
      ] },
    { name: 'get_sequence', display: 'Get FASTA sequence by accession/GI', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'GenBank accession or GI number (e.g. NM_007294)' },
      ] },
    { name: 'get_summary', display: 'Get sequence summary/metadata', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'GenBank accession or GI number' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-genbank — GenBank Genomic Sequences MCP Server
 * Wraps NCBI E-utilities with SettleGrid billing.
 * Methods:
 *   search_sequences(query, limit?) — Search nucleotide sequences (1\u00A2)
 *   get_sequence(id)                — Get FASTA sequence (2\u00A2)
 *   get_summary(id)                 — Get sequence summary (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface IdInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('retmode', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-genbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NCBI API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

async function apiFetchText(path: string, params?: Record<string, string>): Promise<string> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-genbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NCBI API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'genbank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_sequences: { costCents: 1, displayName: 'Search nucleotide sequences' },
      get_sequence: { costCents: 2, displayName: 'Get FASTA sequence' },
      get_summary: { costCents: 1, displayName: 'Get sequence summary' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSequences = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('esearch.fcgi', {
    db: 'nucleotide',
    term: args.query,
    retmax: String(limit),
  })
}, { method: 'search_sequences' })

const getSequence = sg.wrap(async (args: IdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (GenBank accession or GI number)')
  }
  return apiFetchText('efetch.fcgi', {
    db: 'nucleotide',
    id: args.id,
    rettype: 'fasta',
    retmode: 'text',
  })
}, { method: 'get_sequence' })

const getSummary = sg.wrap(async (args: IdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('esummary.fcgi', {
    db: 'nucleotide',
    id: args.id,
  })
}, { method: 'get_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSequences, getSequence, getSummary }

console.log('settlegrid-genbank MCP server ready')
console.log('Methods: search_sequences, get_sequence, get_summary')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 72. settlegrid-uniprot
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'uniprot',
  title: 'UniProt Protein Data',
  desc: 'Access UniProt protein sequence and functional information. Search proteins, retrieve entries, and get feature annotations.',
  api: { base: 'https://rest.uniprot.org', name: 'UniProt REST API', docs: 'https://www.uniprot.org/help/api' },
  key: null,
  keywords: ['uniprot', 'protein', 'proteomics', 'bioinformatics', 'sequence'],
  methods: [
    { name: 'search_proteins', display: 'Search protein entries', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "insulin human", "P53")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_protein', display: 'Get protein entry by accession', cost: 1, params: 'accession',
      inputs: [
        { name: 'accession', type: 'string', required: true, desc: 'UniProt accession (e.g. P04637, Q9Y6K1)' },
      ] },
    { name: 'get_features', display: 'Get protein feature annotations', cost: 2, params: 'accession',
      inputs: [
        { name: 'accession', type: 'string', required: true, desc: 'UniProt accession (e.g. P04637)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-uniprot — UniProt Protein Data MCP Server
 * Wraps UniProt REST API with SettleGrid billing.
 * Methods:
 *   search_proteins(query, limit?) — Search proteins (1\u00A2)
 *   get_protein(accession)         — Get protein entry (1\u00A2)
 *   get_features(accession)        — Get features (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface AccessionInput {
  accession: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.uniprot.org'

async function apiFetch<T>(path: string): Promise<T> {
  const url = \`\${API_BASE}\${path}\`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-uniprot/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UniProt API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'uniprot',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_proteins: { costCents: 1, displayName: 'Search protein entries' },
      get_protein: { costCents: 1, displayName: 'Get protein entry' },
      get_features: { costCents: 2, displayName: 'Get protein features' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchProteins = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>(\`/uniprotkb/search?query=\${encodeURIComponent(args.query)}&size=\${limit}&format=json\`)
}, { method: 'search_proteins' })

const getProtein = sg.wrap(async (args: AccessionInput) => {
  if (!args.accession || typeof args.accession !== 'string') {
    throw new Error('accession is required (e.g. P04637)')
  }
  return apiFetch<unknown>(\`/uniprotkb/\${encodeURIComponent(args.accession)}.json\`)
}, { method: 'get_protein' })

const getFeatures = sg.wrap(async (args: AccessionInput) => {
  if (!args.accession || typeof args.accession !== 'string') {
    throw new Error('accession is required')
  }
  return apiFetch<unknown>(\`/uniprotkb/\${encodeURIComponent(args.accession)}.json\`)
}, { method: 'get_features' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchProteins, getProtein, getFeatures }

console.log('settlegrid-uniprot MCP server ready')
console.log('Methods: search_proteins, get_protein, get_features')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 73. settlegrid-drugbank
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'drugbank',
  title: 'FDA Drug Information',
  desc: 'Access drug data via the openFDA drug API. Search drugs, get label information, and find drug interactions.',
  api: { base: 'https://api.fda.gov/drug', name: 'openFDA Drug API', docs: 'https://open.fda.gov/apis/drug/' },
  key: null,
  keywords: ['drug', 'fda', 'pharmaceutical', 'medicine', 'pharmacology'],
  methods: [
    { name: 'search_drugs', display: 'Search drugs by name or ingredient', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Drug name or active ingredient (e.g. "aspirin", "ibuprofen")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 100)' },
      ] },
    { name: 'get_drug', display: 'Get drug label by application number', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Application number or drug name' },
      ] },
    { name: 'get_interactions', display: 'Get adverse event data for a drug', cost: 2, params: 'drug_name',
      inputs: [
        { name: 'drug_name', type: 'string', required: true, desc: 'Drug brand or generic name' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-drugbank — FDA Drug Information MCP Server
 * Wraps openFDA Drug API with SettleGrid billing.
 * Methods:
 *   search_drugs(query, limit?)    — Search drugs (1\u00A2)
 *   get_drug(id)                   — Get drug label (1\u00A2)
 *   get_interactions(drug_name)    — Get adverse events (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface DrugIdInput {
  id: string
}

interface InteractionInput {
  drug_name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fda.gov/drug'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-drugbank/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`FDA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'drugbank',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_drugs: { costCents: 1, displayName: 'Search drugs' },
      get_drug: { costCents: 1, displayName: 'Get drug label' },
      get_interactions: { costCents: 2, displayName: 'Get adverse events' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDrugs = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('label.json', {
    search: \`openfda.brand_name:"\${args.query}"+openfda.generic_name:"\${args.query}"\`,
    limit: String(limit),
  })
}, { method: 'search_drugs' })

const getDrug = sg.wrap(async (args: DrugIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('label.json', {
    search: \`openfda.application_number:"\${args.id}"+openfda.brand_name:"\${args.id}"\`,
    limit: '1',
  })
}, { method: 'get_drug' })

const getInteractions = sg.wrap(async (args: InteractionInput) => {
  if (!args.drug_name || typeof args.drug_name !== 'string') {
    throw new Error('drug_name is required')
  }
  return apiFetch<unknown>('event.json', {
    search: \`patient.drug.medicinalproduct:"\${args.drug_name}"\`,
    limit: '10',
  })
}, { method: 'get_interactions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDrugs, getDrug, getInteractions }

console.log('settlegrid-drugbank MCP server ready')
console.log('Methods: search_drugs, get_drug, get_interactions')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 74. settlegrid-clinicaltrials
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'clinicaltrials',
  title: 'Clinical Trials Data',
  desc: 'Access ClinicalTrials.gov v2 API for clinical trial data. Search trials, get study details, and view condition statistics.',
  api: { base: 'https://clinicaltrials.gov/api/v2', name: 'ClinicalTrials.gov v2 API', docs: 'https://clinicaltrials.gov/data-api/api' },
  key: null,
  keywords: ['clinical-trials', 'medical', 'research', 'fda', 'healthcare'],
  methods: [
    { name: 'search_trials', display: 'Search clinical trials', cost: 1, params: 'query, status?, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "diabetes", "cancer immunotherapy")' },
        { name: 'status', type: 'string', required: false, desc: 'Trial status filter (e.g. RECRUITING, COMPLETED)' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_trial', display: 'Get trial details by NCT ID', cost: 1, params: 'nctId',
      inputs: [
        { name: 'nctId', type: 'string', required: true, desc: 'NCT identifier (e.g. NCT04280705)' },
      ] },
    { name: 'get_stats', display: 'Get trial statistics for a condition', cost: 2, params: 'condition',
      inputs: [
        { name: 'condition', type: 'string', required: true, desc: 'Medical condition (e.g. "breast cancer")' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-clinicaltrials — Clinical Trials Data MCP Server
 * Wraps ClinicalTrials.gov v2 API with SettleGrid billing.
 * Methods:
 *   search_trials(query, status?, limit?) — Search trials (1\u00A2)
 *   get_trial(nctId)                      — Get trial details (1\u00A2)
 *   get_stats(condition)                  — Get condition stats (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  status?: string
  limit?: number
}

interface TrialInput {
  nctId: string
}

interface StatsInput {
  condition: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://clinicaltrials.gov/api/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-clinicaltrials/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`ClinicalTrials API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'clinicaltrials',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_trials: { costCents: 1, displayName: 'Search clinical trials' },
      get_trial: { costCents: 1, displayName: 'Get trial details' },
      get_stats: { costCents: 2, displayName: 'Get condition statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTrials = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  const params: Record<string, string> = {
    'query.term': args.query,
    pageSize: String(limit),
  }
  if (args.status) params['filter.overallStatus'] = args.status.toUpperCase()
  return apiFetch<unknown>('studies', params)
}, { method: 'search_trials' })

const getTrial = sg.wrap(async (args: TrialInput) => {
  if (!args.nctId || typeof args.nctId !== 'string') {
    throw new Error('nctId is required (e.g. NCT04280705)')
  }
  return apiFetch<unknown>(\`studies/\${encodeURIComponent(args.nctId)}\`)
}, { method: 'get_trial' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (!args.condition || typeof args.condition !== 'string') {
    throw new Error('condition is required')
  }
  return apiFetch<unknown>('studies', {
    'query.cond': args.condition,
    countTotal: 'true',
    pageSize: '1',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTrials, getTrial, getStats }

console.log('settlegrid-clinicaltrials MCP server ready')
console.log('Methods: search_trials, get_trial, get_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 75. settlegrid-ncbi-gene
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'ncbi-gene',
  title: 'NCBI Gene Information',
  desc: 'Access NCBI Gene database via E-utilities. Search genes, get gene details, and retrieve functional summaries.',
  api: { base: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils', name: 'NCBI E-utilities (Gene)', docs: 'https://www.ncbi.nlm.nih.gov/books/NBK25501/' },
  key: null,
  keywords: ['ncbi', 'gene', 'genetics', 'genomics', 'bioinformatics'],
  methods: [
    { name: 'search_genes', display: 'Search gene database', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Gene name or keyword (e.g. "TP53", "BRCA1 human")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 100)' },
      ] },
    { name: 'get_gene', display: 'Get gene details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'NCBI Gene ID (e.g. 7157 for TP53)' },
      ] },
    { name: 'get_gene_summary', display: 'Get gene functional summary', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'NCBI Gene ID' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-ncbi-gene — NCBI Gene Information MCP Server
 * Wraps NCBI E-utilities (Gene db) with SettleGrid billing.
 * Methods:
 *   search_genes(query, limit?) — Search genes (1\u00A2)
 *   get_gene(id)                — Get gene details (1\u00A2)
 *   get_gene_summary(id)        — Get gene summary (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface GeneIdInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

async function apiFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${endpoint}\`)
  url.searchParams.set('retmode', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-ncbi-gene/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NCBI API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ncbi-gene',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_genes: { costCents: 1, displayName: 'Search genes' },
      get_gene: { costCents: 1, displayName: 'Get gene details' },
      get_gene_summary: { costCents: 2, displayName: 'Get gene summary' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchGenes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('esearch.fcgi', {
    db: 'gene',
    term: args.query,
    retmax: String(limit),
  })
}, { method: 'search_genes' })

const getGene = sg.wrap(async (args: GeneIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NCBI Gene ID)')
  }
  return apiFetch<unknown>('esummary.fcgi', {
    db: 'gene',
    id: args.id,
  })
}, { method: 'get_gene' })

const getGeneSummary = sg.wrap(async (args: GeneIdInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const search = await apiFetch<unknown>('esummary.fcgi', {
    db: 'gene',
    id: args.id,
  })
  const links = await apiFetch<unknown>('elink.fcgi', {
    dbfrom: 'gene',
    db: 'pubmed',
    id: args.id,
    retmax: '5',
  })
  return { summary: search, relatedPubmed: links }
}, { method: 'get_gene_summary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchGenes, getGene, getGeneSummary }

console.log('settlegrid-ncbi-gene MCP server ready')
console.log('Methods: search_genes, get_gene, get_gene_summary')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 76. settlegrid-ensembl
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'ensembl',
  title: 'Ensembl Genome Browser',
  desc: 'Access Ensembl genome browser data via REST API. Look up genes, retrieve sequences, and search across species.',
  api: { base: 'https://rest.ensembl.org', name: 'Ensembl REST API', docs: 'https://rest.ensembl.org/documentation' },
  key: null,
  keywords: ['ensembl', 'genome', 'gene', 'genomics', 'dna', 'bioinformatics'],
  methods: [
    { name: 'lookup_gene', display: 'Look up gene by symbol and species', cost: 1, params: 'symbol, species?',
      inputs: [
        { name: 'symbol', type: 'string', required: true, desc: 'Gene symbol (e.g. BRCA2, TP53)' },
        { name: 'species', type: 'string', required: false, desc: 'Species (default: homo_sapiens)' },
      ] },
    { name: 'get_sequence', display: 'Get sequence by stable Ensembl ID', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Ensembl stable ID (e.g. ENSG00000139618)' },
      ] },
    { name: 'search', display: 'Search Ensembl for genes/transcripts', cost: 1, params: 'query, species?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query' },
        { name: 'species', type: 'string', required: false, desc: 'Species filter (default: homo_sapiens)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-ensembl — Ensembl Genome Browser MCP Server
 * Wraps Ensembl REST API with SettleGrid billing.
 * Methods:
 *   lookup_gene(symbol, species?) — Look up gene (1\u00A2)
 *   get_sequence(id)              — Get sequence (2\u00A2)
 *   search(query, species?)       — Search Ensembl (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface LookupInput {
  symbol: string
  species?: string
}

interface SequenceInput {
  id: string
}

interface SearchInput {
  query: string
  species?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.ensembl.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'settlegrid-ensembl/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Ensembl API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ensembl',
  pricing: {
    defaultCostCents: 1,
    methods: {
      lookup_gene: { costCents: 1, displayName: 'Look up gene by symbol' },
      get_sequence: { costCents: 2, displayName: 'Get sequence by ID' },
      search: { costCents: 1, displayName: 'Search Ensembl' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupGene = sg.wrap(async (args: LookupInput) => {
  if (!args.symbol || typeof args.symbol !== 'string') {
    throw new Error('symbol is required (e.g. BRCA2)')
  }
  const species = args.species || 'homo_sapiens'
  return apiFetch<unknown>(\`/lookup/symbol/\${encodeURIComponent(species)}/\${encodeURIComponent(args.symbol)}\`)
}, { method: 'lookup_gene' })

const getSequence = sg.wrap(async (args: SequenceInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Ensembl stable ID)')
  }
  return apiFetch<unknown>(\`/sequence/id/\${encodeURIComponent(args.id)}?type=genomic\`)
}, { method: 'get_sequence' })

const search = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const species = args.species || 'homo_sapiens'
  return apiFetch<unknown>(\`/xrefs/symbol/\${encodeURIComponent(species)}/\${encodeURIComponent(args.query)}\`)
}, { method: 'search' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupGene, getSequence, search }

console.log('settlegrid-ensembl MCP server ready')
console.log('Methods: lookup_gene, get_sequence, search')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 77. settlegrid-kegg
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'kegg',
  title: 'KEGG Pathway Database',
  desc: 'Access KEGG pathway and genome database via REST API. Search metabolic pathways, get pathway details, and list organisms.',
  api: { base: 'https://rest.kegg.jp', name: 'KEGG REST API', docs: 'https://www.kegg.jp/kegg/rest/keggapi.html' },
  key: null,
  keywords: ['kegg', 'pathway', 'metabolism', 'genome', 'bioinformatics'],
  methods: [
    { name: 'search_pathways', display: 'Search KEGG pathways', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Pathway keyword (e.g. "glycolysis", "apoptosis")' },
      ] },
    { name: 'get_pathway', display: 'Get pathway details by ID', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'KEGG pathway ID (e.g. hsa00010, map00010)' },
      ] },
    { name: 'list_organisms', display: 'List KEGG organisms', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-kegg — KEGG Pathway Database MCP Server
 * Wraps KEGG REST API with SettleGrid billing.
 * Methods:
 *   search_pathways(query) — Search pathways (1\u00A2)
 *   get_pathway(id)        — Get pathway details (2\u00A2)
 *   list_organisms()       — List organisms (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface PathwayInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.kegg.jp'

async function apiFetchText(path: string): Promise<string> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { 'User-Agent': 'settlegrid-kegg/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`KEGG API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.text()
}

function parseKeggList(text: string): Array<{ id: string; name: string }> {
  return text.trim().split('\\n').filter(Boolean).map(line => {
    const [id, ...rest] = line.split('\\t')
    return { id: id.trim(), name: rest.join('\\t').trim() }
  })
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'kegg',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_pathways: { costCents: 1, displayName: 'Search pathways' },
      get_pathway: { costCents: 2, displayName: 'Get pathway details' },
      list_organisms: { costCents: 1, displayName: 'List organisms' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPathways = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const text = await apiFetchText(\`/find/pathway/\${encodeURIComponent(args.query)}\`)
  return parseKeggList(text)
}, { method: 'search_pathways' })

const getPathway = sg.wrap(async (args: PathwayInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. hsa00010)')
  }
  const text = await apiFetchText(\`/get/\${encodeURIComponent(args.id)}\`)
  return { id: args.id, data: text }
}, { method: 'get_pathway' })

const listOrganisms = sg.wrap(async () => {
  const text = await apiFetchText('/list/organism')
  return parseKeggList(text).slice(0, 50)
}, { method: 'list_organisms' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPathways, getPathway, listOrganisms }

console.log('settlegrid-kegg MCP server ready')
console.log('Methods: search_pathways, get_pathway, list_organisms')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 78. settlegrid-covid-genome
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'covid-genome',
  title: 'COVID Genomic Data',
  desc: 'Access COVID-19 genomic surveillance data via CoV-Spectrum LAPIS API. Get mutations, sequences, and variant prevalence.',
  api: { base: 'https://lapis.cov-spectrum.org/open/v2', name: 'CoV-Spectrum LAPIS API', docs: 'https://lapis.cov-spectrum.org/open/v2/docs' },
  key: null,
  keywords: ['covid', 'sars-cov-2', 'genomics', 'variants', 'mutations', 'pandemic'],
  methods: [
    { name: 'get_mutations', display: 'Get mutation data by country/lineage', cost: 2, params: 'country?, lineage?',
      inputs: [
        { name: 'country', type: 'string', required: false, desc: 'Country name (e.g. "USA", "Germany")' },
        { name: 'lineage', type: 'string', required: false, desc: 'Pangolin lineage (e.g. BA.5, XBB.1.5)' },
      ] },
    { name: 'get_sequences', display: 'Get sequences by lineage', cost: 2, params: 'lineage, limit?',
      inputs: [
        { name: 'lineage', type: 'string', required: true, desc: 'Pangolin lineage (e.g. BA.2)' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ] },
    { name: 'get_prevalence', display: 'Get variant prevalence by country', cost: 1, params: 'country, lineage?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'Country name' },
        { name: 'lineage', type: 'string', required: false, desc: 'Specific lineage to check' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-covid-genome — COVID Genomic Data MCP Server
 * Wraps CoV-Spectrum LAPIS API with SettleGrid billing.
 * Methods:
 *   get_mutations(country?, lineage?)  — Get mutations (2\u00A2)
 *   get_sequences(lineage, limit?)     — Get sequences (2\u00A2)
 *   get_prevalence(country, lineage?)  — Get prevalence (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MutationInput {
  country?: string
  lineage?: string
}

interface SequenceInput {
  lineage: string
  limit?: number
}

interface PrevalenceInput {
  country: string
  lineage?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://lapis.cov-spectrum.org/open/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-covid-genome/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`LAPIS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'covid-genome',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_mutations: { costCents: 2, displayName: 'Get mutation data' },
      get_sequences: { costCents: 2, displayName: 'Get sequences' },
      get_prevalence: { costCents: 1, displayName: 'Get variant prevalence' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMutations = sg.wrap(async (args: MutationInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.lineage) params.pangoLineage = args.lineage
  return apiFetch<unknown>('sample/nuc-mutations', params)
}, { method: 'get_mutations' })

const getSequences = sg.wrap(async (args: SequenceInput) => {
  if (!args.lineage || typeof args.lineage !== 'string') {
    throw new Error('lineage is required (e.g. BA.2)')
  }
  const limit = Math.min(args.limit || 10, 100)
  return apiFetch<unknown>('sample/details', {
    pangoLineage: args.lineage,
    limit: String(limit),
  })
}, { method: 'get_sequences' })

const getPrevalence = sg.wrap(async (args: PrevalenceInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  const params: Record<string, string> = { country: args.country }
  if (args.lineage) params.pangoLineage = args.lineage
  return apiFetch<unknown>('sample/aggregated', params)
}, { method: 'get_prevalence' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMutations, getSequences, getPrevalence }

console.log('settlegrid-covid-genome MCP server ready')
console.log('Methods: get_mutations, get_sequences, get_prevalence')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 79. settlegrid-plant-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'plant-data',
  title: 'Plant Biology Data',
  desc: 'Access plant species data via GBIF (Global Biodiversity Information Facility). Search plants, get species details, and list families.',
  api: { base: 'https://api.gbif.org/v1', name: 'GBIF API', docs: 'https://www.gbif.org/developer/summary' },
  key: null,
  keywords: ['plants', 'botany', 'biodiversity', 'species', 'gbif', 'ecology'],
  methods: [
    { name: 'search_plants', display: 'Search plant species', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Plant name or keyword (e.g. "Rosa", "Quercus alba")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_species', display: 'Get species details by key', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'GBIF species key (numeric ID)' },
      ] },
    { name: 'list_families', display: 'List plant families', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-plant-data — Plant Biology Data MCP Server
 * Wraps GBIF API with SettleGrid billing.
 * Methods:
 *   search_plants(query, limit?) — Search plants (1\u00A2)
 *   get_species(id)              — Get species details (1\u00A2)
 *   list_families()              — List plant families (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SpeciesInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gbif.org/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-plant-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`GBIF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'plant-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_plants: { costCents: 1, displayName: 'Search plant species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      list_families: { costCents: 1, displayName: 'List plant families' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlants = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('species/search', {
    q: args.query,
    limit: String(limit),
    highertaxonKey: '6', // Plantae kingdom
  })
}, { method: 'search_plants' })

const getSpecies = sg.wrap(async (args: SpeciesInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (GBIF species key)')
  }
  return apiFetch<unknown>(\`species/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_species' })

const listFamilies = sg.wrap(async () => {
  return apiFetch<unknown>('species/search', {
    rank: 'FAMILY',
    highertaxonKey: '6',
    limit: '50',
    status: 'ACCEPTED',
  })
}, { method: 'list_families' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlants, getSpecies, listFamilies }

console.log('settlegrid-plant-data MCP server ready')
console.log('Methods: search_plants, get_species, list_families')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 80. settlegrid-marine-biology
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'marine-biology',
  title: 'Marine Species Data',
  desc: 'Access marine species data via WoRMS (World Register of Marine Species). Search species, get details, and view classification.',
  api: { base: 'https://www.marinespecies.org/rest', name: 'WoRMS REST API', docs: 'https://www.marinespecies.org/rest/' },
  key: null,
  keywords: ['marine', 'ocean', 'species', 'biology', 'taxonomy', 'worms'],
  methods: [
    { name: 'search_species', display: 'Search marine species', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Species name (e.g. "Carcharodon", "dolphin")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_species', display: 'Get species by AphiaID', cost: 1, params: 'aphiaId',
      inputs: [
        { name: 'aphiaId', type: 'string', required: true, desc: 'WoRMS AphiaID (e.g. 105838)' },
      ] },
    { name: 'get_classification', display: 'Get taxonomic classification', cost: 2, params: 'aphiaId',
      inputs: [
        { name: 'aphiaId', type: 'string', required: true, desc: 'WoRMS AphiaID' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-marine-biology — Marine Species Data MCP Server
 * Wraps WoRMS REST API with SettleGrid billing.
 * Methods:
 *   search_species(query, limit?) — Search marine species (1\u00A2)
 *   get_species(aphiaId)          — Get species details (1\u00A2)
 *   get_classification(aphiaId)   — Get classification (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface AphiaInput {
  aphiaId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.marinespecies.org/rest'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-marine-biology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`WoRMS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'marine-biology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search marine species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      get_classification: { costCents: 2, displayName: 'Get classification' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>(\`/AphiaRecordsByVernacular/\${encodeURIComponent(args.query)}?like=true&offset=1&limit=\${limit}\`)
}, { method: 'search_species' })

const getSpecies = sg.wrap(async (args: AphiaInput) => {
  if (!args.aphiaId || typeof args.aphiaId !== 'string') {
    throw new Error('aphiaId is required')
  }
  return apiFetch<unknown>(\`/AphiaRecordByAphiaID/\${encodeURIComponent(args.aphiaId)}\`)
}, { method: 'get_species' })

const getClassification = sg.wrap(async (args: AphiaInput) => {
  if (!args.aphiaId || typeof args.aphiaId !== 'string') {
    throw new Error('aphiaId is required')
  }
  return apiFetch<unknown>(\`/AphiaClassificationByAphiaID/\${encodeURIComponent(args.aphiaId)}\`)
}, { method: 'get_classification' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getSpecies, getClassification }

console.log('settlegrid-marine-biology MCP server ready')
console.log('Methods: search_species, get_species, get_classification')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 81. settlegrid-bird-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'bird-data',
  title: 'eBird Observation Data',
  desc: 'Access eBird bird observation data. Get recent sightings, birding hotspots, and species lists by region.',
  api: { base: 'https://api.ebird.org/v2', name: 'eBird API 2.0', docs: 'https://documenter.getpostman.com/view/664302/S1ENwy59' },
  key: { env: 'EBIRD_API_KEY', url: 'https://ebird.org/api/keygen', required: true },
  keywords: ['ebird', 'birds', 'ornithology', 'birding', 'sightings', 'wildlife'],
  methods: [
    { name: 'get_recent', display: 'Get recent bird observations near location', cost: 1, params: 'lat, lon, limit?',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude (e.g. 42.36)' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude (e.g. -71.06)' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20, max 100)' },
      ] },
    { name: 'get_hotspots', display: 'Get birding hotspots in a region', cost: 1, params: 'regionCode',
      inputs: [
        { name: 'regionCode', type: 'string', required: true, desc: 'eBird region code (e.g. US-MA, US-CA)' },
      ] },
    { name: 'get_species_list', display: 'Get species list for a region', cost: 2, params: 'regionCode',
      inputs: [
        { name: 'regionCode', type: 'string', required: true, desc: 'eBird region code (e.g. US-NY)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-bird-data — eBird Observation Data MCP Server
 * Wraps eBird API 2.0 with SettleGrid billing.
 * Methods:
 *   get_recent(lat, lon, limit?)    — Get recent sightings (1\u00A2)
 *   get_hotspots(regionCode)        — Get hotspots (1\u00A2)
 *   get_species_list(regionCode)    — Get species list (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecentInput {
  lat: number
  lon: number
  limit?: number
}

interface RegionInput {
  regionCode: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.ebird.org/v2'
const API_KEY = process.env.EBIRD_API_KEY || ''

async function apiFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('EBIRD_API_KEY environment variable is required')
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { 'X-eBirdApiToken': API_KEY, Accept: 'application/json', 'User-Agent': 'settlegrid-bird-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`eBird API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'bird-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_recent: { costCents: 1, displayName: 'Get recent bird observations' },
      get_hotspots: { costCents: 1, displayName: 'Get birding hotspots' },
      get_species_list: { costCents: 2, displayName: 'Get species list' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getRecent = sg.wrap(async (args: RecentInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  const limit = Math.min(args.limit || 20, 100)
  return apiFetch<unknown>(\`/data/obs/geo/recent?lat=\${args.lat}&lng=\${args.lon}&maxResults=\${limit}\`)
}, { method: 'get_recent' })

const getHotspots = sg.wrap(async (args: RegionInput) => {
  if (!args.regionCode || typeof args.regionCode !== 'string') {
    throw new Error('regionCode is required (e.g. US-MA)')
  }
  return apiFetch<unknown>(\`/ref/hotspot/\${encodeURIComponent(args.regionCode)}\`)
}, { method: 'get_hotspots' })

const getSpeciesList = sg.wrap(async (args: RegionInput) => {
  if (!args.regionCode || typeof args.regionCode !== 'string') {
    throw new Error('regionCode is required')
  }
  return apiFetch<unknown>(\`/product/spplist/\${encodeURIComponent(args.regionCode)}\`)
}, { method: 'get_species_list' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getRecent, getHotspots, getSpeciesList }

console.log('settlegrid-bird-data MCP server ready')
console.log('Methods: get_recent, get_hotspots, get_species_list')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 82. settlegrid-butterfly-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'butterfly-data',
  title: 'Butterfly Species Data',
  desc: 'Access butterfly (Lepidoptera) species data via GBIF. Search butterfly species, get details, and find occurrence records.',
  api: { base: 'https://api.gbif.org/v1', name: 'GBIF API (Lepidoptera)', docs: 'https://www.gbif.org/developer/summary' },
  key: null,
  keywords: ['butterfly', 'lepidoptera', 'insects', 'entomology', 'biodiversity', 'gbif'],
  methods: [
    { name: 'search_species', display: 'Search butterfly species', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Butterfly name (e.g. "Monarch", "Papilio")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_species', display: 'Get species details by key', cost: 1, params: 'key',
      inputs: [
        { name: 'key', type: 'string', required: true, desc: 'GBIF species key (numeric)' },
      ] },
    { name: 'get_occurrences', display: 'Get occurrence records for a species', cost: 2, params: 'speciesKey, country?',
      inputs: [
        { name: 'speciesKey', type: 'string', required: true, desc: 'GBIF species key' },
        { name: 'country', type: 'string', required: false, desc: 'ISO country code (e.g. US, GB)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-butterfly-data — Butterfly Species Data MCP Server
 * Wraps GBIF API (Lepidoptera) with SettleGrid billing.
 * Methods:
 *   search_species(query, limit?)            — Search butterflies (1\u00A2)
 *   get_species(key)                         — Get species details (1\u00A2)
 *   get_occurrences(speciesKey, country?)     — Get occurrences (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SpeciesInput {
  key: string
}

interface OccurrenceInput {
  speciesKey: string
  country?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.gbif.org/v1'
const LEPIDOPTERA_KEY = '797' // GBIF key for Lepidoptera

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-butterfly-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`GBIF API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'butterfly-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_species: { costCents: 1, displayName: 'Search butterfly species' },
      get_species: { costCents: 1, displayName: 'Get species details' },
      get_occurrences: { costCents: 2, displayName: 'Get occurrence records' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSpecies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('species/search', {
    q: args.query,
    limit: String(limit),
    highertaxonKey: LEPIDOPTERA_KEY,
  })
}, { method: 'search_species' })

const getSpecies = sg.wrap(async (args: SpeciesInput) => {
  if (!args.key || typeof args.key !== 'string') {
    throw new Error('key is required (GBIF species key)')
  }
  return apiFetch<unknown>(\`species/\${encodeURIComponent(args.key)}\`)
}, { method: 'get_species' })

const getOccurrences = sg.wrap(async (args: OccurrenceInput) => {
  if (!args.speciesKey || typeof args.speciesKey !== 'string') {
    throw new Error('speciesKey is required')
  }
  const params: Record<string, string> = { taxonKey: args.speciesKey, limit: '20' }
  if (args.country) params.country = args.country.toUpperCase()
  return apiFetch<unknown>('occurrence/search', params)
}, { method: 'get_occurrences' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSpecies, getSpecies, getOccurrences }

console.log('settlegrid-butterfly-data MCP server ready')
console.log('Methods: search_species, get_species, get_occurrences')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 83. settlegrid-mineral-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'mineral-data',
  title: 'Mineral Database',
  desc: 'Access mineral data via Mindat API. Search minerals, get details, and list chemical groups.',
  api: { base: 'https://api.mindat.org', name: 'Mindat API', docs: 'https://api.mindat.org/schema/redoc/' },
  key: null,
  keywords: ['minerals', 'geology', 'mineralogy', 'rocks', 'geoscience'],
  methods: [
    { name: 'search_minerals', display: 'Search minerals by name', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Mineral name (e.g. "quartz", "feldspar")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_mineral', display: 'Get mineral details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Mindat mineral ID' },
      ] },
    { name: 'list_chemical_groups', display: 'List mineral chemical groups', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-mineral-data — Mineral Database MCP Server
 * Wraps Mindat API with SettleGrid billing.
 * Methods:
 *   search_minerals(query, limit?) — Search minerals (1\u00A2)
 *   get_mineral(id)                — Get mineral details (1\u00A2)
 *   list_chemical_groups()         — List chemical groups (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface MineralInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.mindat.org'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-mineral-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Mindat API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'mineral-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_minerals: { costCents: 1, displayName: 'Search minerals' },
      get_mineral: { costCents: 1, displayName: 'Get mineral details' },
      list_chemical_groups: { costCents: 1, displayName: 'List chemical groups' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMinerals = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('/minerals_ima.json', {
    name: args.query,
    page_size: String(limit),
  })
}, { method: 'search_minerals' })

const getMineral = sg.wrap(async (args: MineralInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(\`/minerals_ima/\${encodeURIComponent(args.id)}.json\`)
}, { method: 'get_mineral' })

const listChemicalGroups = sg.wrap(async () => {
  return apiFetch<unknown>('/minerals_ima.json', {
    fields: 'ima_chemistry,name',
    page_size: '50',
  })
}, { method: 'list_chemical_groups' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMinerals, getMineral, listChemicalGroups }

console.log('settlegrid-mineral-data MCP server ready')
console.log('Methods: search_minerals, get_mineral, list_chemical_groups')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 84. settlegrid-asteroid-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'asteroid-data',
  title: 'Asteroid Tracking Data',
  desc: 'Access NASA Near Earth Object Web Service (NeoWs) for asteroid tracking. Get feeds, individual asteroids, and statistics.',
  api: { base: 'https://api.nasa.gov/neo/rest/v1', name: 'NASA NeoWs', docs: 'https://api.nasa.gov/' },
  key: null,
  keywords: ['asteroid', 'neo', 'nasa', 'space', 'near-earth-object', 'planetary-defense'],
  methods: [
    { name: 'get_feed', display: 'Get near-Earth asteroids by date range', cost: 2, params: 'startDate, endDate?',
      inputs: [
        { name: 'startDate', type: 'string', required: true, desc: 'Start date (YYYY-MM-DD)' },
        { name: 'endDate', type: 'string', required: false, desc: 'End date (YYYY-MM-DD, max 7 days from start)' },
      ] },
    { name: 'get_asteroid', display: 'Get asteroid details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'NASA SPK-ID (e.g. 3542519)' },
      ] },
    { name: 'get_stats', display: 'Get NeoWs statistics', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-asteroid-data — Asteroid Tracking MCP Server
 * Wraps NASA NeoWs API with SettleGrid billing.
 * Methods:
 *   get_feed(startDate, endDate?) — Get NEO feed (2\u00A2)
 *   get_asteroid(id)              — Get asteroid details (1\u00A2)
 *   get_stats()                   — Get statistics (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FeedInput {
  startDate: string
  endDate?: string
}

interface AsteroidInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.nasa.gov/neo/rest/v1'
const API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('api_key', API_KEY)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-asteroid-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NASA NeoWs \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'asteroid-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_feed: { costCents: 2, displayName: 'Get NEO feed' },
      get_asteroid: { costCents: 1, displayName: 'Get asteroid details' },
      get_stats: { costCents: 1, displayName: 'Get NeoWs statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFeed = sg.wrap(async (args: FeedInput) => {
  if (!args.startDate || typeof args.startDate !== 'string') {
    throw new Error('startDate is required (YYYY-MM-DD)')
  }
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(args.startDate)) {
    throw new Error('startDate must be in YYYY-MM-DD format')
  }
  const params: Record<string, string> = { start_date: args.startDate }
  if (args.endDate) params.end_date = args.endDate
  return apiFetch<unknown>('feed', params)
}, { method: 'get_feed' })

const getAsteroid = sg.wrap(async (args: AsteroidInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NASA SPK-ID)')
  }
  return apiFetch<unknown>(\`neo/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_asteroid' })

const getStats = sg.wrap(async () => {
  return apiFetch<unknown>('stats')
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFeed, getAsteroid, getStats }

console.log('settlegrid-asteroid-data MCP server ready')
console.log('Methods: get_feed, get_asteroid, get_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 85. settlegrid-exoplanet
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'exoplanet',
  title: 'Exoplanet Archive',
  desc: 'Access NASA Exoplanet Archive via TAP service. Search exoplanets, get statistics, and filter by discovery method.',
  api: { base: 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync', name: 'NASA Exoplanet Archive TAP', docs: 'https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html' },
  key: null,
  keywords: ['exoplanet', 'nasa', 'astronomy', 'space', 'planetary-science'],
  methods: [
    { name: 'search_planets', display: 'Search confirmed exoplanets', cost: 1, params: 'query?, limit?',
      inputs: [
        { name: 'query', type: 'string', required: false, desc: 'Planet name or host star (e.g. "Kepler", "TRAPPIST")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 100)' },
      ] },
    { name: 'get_stats', display: 'Get exoplanet discovery statistics', cost: 1, params: '',
      inputs: [] },
    { name: 'get_by_method', display: 'Get exoplanets by discovery method', cost: 2, params: 'method, limit?',
      inputs: [
        { name: 'method', type: 'string', required: true, desc: 'Discovery method (e.g. "Transit", "Radial Velocity")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20, max 100)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-exoplanet — Exoplanet Archive MCP Server
 * Wraps NASA Exoplanet Archive TAP service with SettleGrid billing.
 * Methods:
 *   search_planets(query?, limit?)    — Search exoplanets (1\u00A2)
 *   get_stats()                       — Get discovery stats (1\u00A2)
 *   get_by_method(method, limit?)     — Get by method (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query?: string
  limit?: number
}

interface MethodInput {
  method: string
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TAP_BASE = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync'

async function tapQuery<T>(adql: string): Promise<T> {
  const url = new URL(TAP_BASE)
  url.searchParams.set('query', adql)
  url.searchParams.set('format', 'json')
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-exoplanet/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Exoplanet Archive \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'exoplanet',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_planets: { costCents: 1, displayName: 'Search exoplanets' },
      get_stats: { costCents: 1, displayName: 'Get discovery statistics' },
      get_by_method: { costCents: 2, displayName: 'Get by discovery method' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPlanets = sg.wrap(async (args: SearchInput) => {
  const limit = Math.min(args.limit || 10, 100)
  let adql = \`SELECT pl_name,hostname,discoverymethod,disc_year,pl_orbper,pl_rade FROM ps\`
  if (args.query) {
    const q = args.query.replace(/'/g, "''")
    adql += \` WHERE pl_name LIKE '%\${q}%' OR hostname LIKE '%\${q}%'\`
  }
  adql += \` ORDER BY disc_year DESC\`
  adql += \` TOP \${limit}\`
  return tapQuery<unknown>(adql)
}, { method: 'search_planets' })

const getStats = sg.wrap(async () => {
  const adql = 'SELECT discoverymethod, COUNT(*) as count FROM ps GROUP BY discoverymethod ORDER BY count DESC'
  return tapQuery<unknown>(adql)
}, { method: 'get_stats' })

const getByMethod = sg.wrap(async (args: MethodInput) => {
  if (!args.method || typeof args.method !== 'string') {
    throw new Error('method is required (e.g. "Transit")')
  }
  const limit = Math.min(args.limit || 20, 100)
  const m = args.method.replace(/'/g, "''")
  const adql = \`SELECT TOP \${limit} pl_name,hostname,disc_year,pl_orbper,pl_rade FROM ps WHERE discoverymethod='\${m}' ORDER BY disc_year DESC\`
  return tapQuery<unknown>(adql)
}, { method: 'get_by_method' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPlanets, getStats, getByMethod }

console.log('settlegrid-exoplanet MCP server ready')
console.log('Methods: search_planets, get_stats, get_by_method')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 86. settlegrid-solar-system
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'solar-system',
  title: 'Solar System Data',
  desc: 'Access solar system body data via Le Systeme Solaire API. List celestial bodies, get details, and filter planets.',
  api: { base: 'https://api.le-systeme-solaire.net/rest', name: 'Le Systeme Solaire API', docs: 'https://api.le-systeme-solaire.net/' },
  key: null,
  keywords: ['solar-system', 'planets', 'astronomy', 'space', 'celestial-bodies'],
  methods: [
    { name: 'list_bodies', display: 'List celestial bodies with optional filter', cost: 1, params: 'filter?',
      inputs: [
        { name: 'filter', type: 'string', required: false, desc: 'Body type filter (e.g. "planet", "dwarf planet", "moon")' },
      ] },
    { name: 'get_body', display: 'Get celestial body details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Body ID/name (e.g. "terre", "mars", "jupiter")' },
      ] },
    { name: 'get_planets', display: 'Get all planets in the solar system', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-solar-system — Solar System Data MCP Server
 * Wraps Le Systeme Solaire API with SettleGrid billing.
 * Methods:
 *   list_bodies(filter?) — List bodies (1\u00A2)
 *   get_body(id)         — Get body details (1\u00A2)
 *   get_planets()        — Get all planets (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput {
  filter?: string
}

interface BodyInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.le-systeme-solaire.net/rest'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-solar-system/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Solar System API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'solar-system',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_bodies: { costCents: 1, displayName: 'List celestial bodies' },
      get_body: { costCents: 1, displayName: 'Get body details' },
      get_planets: { costCents: 1, displayName: 'Get all planets' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listBodies = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.filter) {
    params['filter[]'] = \`bodyType,eq,\${args.filter}\`
  }
  return apiFetch<unknown>('bodies', params)
}, { method: 'list_bodies' })

const getBody = sg.wrap(async (args: BodyInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. "mars", "jupiter")')
  }
  return apiFetch<unknown>(\`bodies/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_body' })

const getPlanets = sg.wrap(async () => {
  return apiFetch<unknown>('bodies', { 'filter[]': 'isPlanet,eq,true' })
}, { method: 'get_planets' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listBodies, getBody, getPlanets }

console.log('settlegrid-solar-system MCP server ready')
console.log('Methods: list_bodies, get_body, get_planets')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 87. settlegrid-star-catalog
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'star-catalog',
  title: 'Star & Constellation Data',
  desc: 'Access star and constellation data via Le Systeme Solaire API. List constellations, search stars, and get constellation details.',
  api: { base: 'https://api.le-systeme-solaire.net/rest', name: 'Le Systeme Solaire API', docs: 'https://api.le-systeme-solaire.net/' },
  key: null,
  keywords: ['stars', 'constellations', 'astronomy', 'celestial', 'catalog'],
  methods: [
    { name: 'list_constellations', display: 'List all constellations', cost: 1, params: '',
      inputs: [] },
    { name: 'search_stars', display: 'Search stars by name', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Star name or keyword (e.g. "Sirius", "Alpha")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_constellation', display: 'Get constellation details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Constellation ID (e.g. "ori" for Orion)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-star-catalog — Star & Constellation Data MCP Server
 * Wraps Le Systeme Solaire API with SettleGrid billing.
 * Methods:
 *   list_constellations()      — List constellations (1\u00A2)
 *   search_stars(query, limit?) — Search stars (1\u00A2)
 *   get_constellation(id)      — Get constellation (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface ConstellationInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.le-systeme-solaire.net/rest'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-star-catalog/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Star Catalog API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'star-catalog',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_constellations: { costCents: 1, displayName: 'List constellations' },
      search_stars: { costCents: 1, displayName: 'Search stars' },
      get_constellation: { costCents: 1, displayName: 'Get constellation details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listConstellations = sg.wrap(async () => {
  return apiFetch<unknown>('bodies', {
    'filter[]': 'bodyType,eq,Star',
  })
}, { method: 'list_constellations' })

const searchStars = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  const data = await apiFetch<{ bodies?: Array<{ name: string; [k: string]: unknown }> }>('bodies')
  const filtered = (data.bodies || [])
    .filter((b: { name: string }) => b.name.toLowerCase().includes(args.query.toLowerCase()))
    .slice(0, limit)
  return { results: filtered, count: filtered.length }
}, { method: 'search_stars' })

const getConstellation = sg.wrap(async (args: ConstellationInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(\`bodies/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_constellation' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listConstellations, searchStars, getConstellation }

console.log('settlegrid-star-catalog MCP server ready')
console.log('Methods: list_constellations, search_stars, get_constellation')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 88. settlegrid-satellite-tle
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'satellite-tle',
  title: 'Satellite TLE Tracking',
  desc: 'Access satellite Two-Line Element set data via TLE API. Search satellites, get details, and retrieve TLE data for orbit tracking.',
  api: { base: 'https://tle.ivanstanojevic.me/api/tle', name: 'TLE API', docs: 'https://tle.ivanstanojevic.me/' },
  key: null,
  keywords: ['satellite', 'tle', 'orbit', 'space', 'tracking', 'norad'],
  methods: [
    { name: 'search_satellites', display: 'Search satellites by name', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Satellite name (e.g. "ISS", "Hubble", "Starlink")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_satellite', display: 'Get satellite info by NORAD ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'NORAD catalog ID (e.g. 25544 for ISS)' },
      ] },
    { name: 'get_tle', display: 'Get TLE orbital elements', cost: 2, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'NORAD catalog ID' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-satellite-tle — Satellite TLE Tracking MCP Server
 * Wraps TLE API with SettleGrid billing.
 * Methods:
 *   search_satellites(query, limit?) — Search satellites (1\u00A2)
 *   get_satellite(id)                — Get satellite info (1\u00A2)
 *   get_tle(id)                      — Get TLE data (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface SatelliteInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://tle.ivanstanojevic.me/api/tle'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : \`\${API_BASE}\${path ? '/' + path : ''}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-satellite-tle/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`TLE API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'satellite-tle',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_satellites: { costCents: 1, displayName: 'Search satellites' },
      get_satellite: { costCents: 1, displayName: 'Get satellite info' },
      get_tle: { costCents: 2, displayName: 'Get TLE data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSatellites = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('', {
    search: args.query,
    page_size: String(limit),
  })
}, { method: 'search_satellites' })

const getSatellite = sg.wrap(async (args: SatelliteInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (NORAD catalog ID)')
  }
  return apiFetch<unknown>(args.id)
}, { method: 'get_satellite' })

const getTle = sg.wrap(async (args: SatelliteInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const data = await apiFetch<{ line1?: string; line2?: string; name?: string }>(args.id)
  return {
    name: data.name,
    noradId: args.id,
    line1: data.line1,
    line2: data.line2,
  }
}, { method: 'get_tle' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSatellites, getSatellite, getTle }

console.log('settlegrid-satellite-tle MCP server ready')
console.log('Methods: search_satellites, get_satellite, get_tle')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 89. settlegrid-weather-balloon
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'weather-balloon',
  title: 'Radiosonde/Weather Balloon Data',
  desc: 'Access radiosonde sounding data via NWS API. Get atmospheric soundings, list stations, and retrieve latest observations.',
  api: { base: 'https://api.weather.gov', name: 'NWS API (Radiosonde)', docs: 'https://www.weather.gov/documentation/services-web-api' },
  key: null,
  keywords: ['radiosonde', 'weather-balloon', 'sounding', 'atmospheric', 'nws', 'meteorology'],
  methods: [
    { name: 'get_soundings', display: 'Get radiosonde soundings for a station', cost: 2, params: 'station, date?',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'Station ID (e.g. OKX, MPX, BUF)' },
        { name: 'date', type: 'string', required: false, desc: 'Date (YYYY-MM-DD). Defaults to latest.' },
      ] },
    { name: 'list_stations', display: 'List radiosonde stations', cost: 1, params: '',
      inputs: [] },
    { name: 'get_latest', display: 'Get latest observation for a station', cost: 1, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'Station ID (e.g. OKX)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-weather-balloon — Radiosonde Data MCP Server
 * Wraps NWS API with SettleGrid billing.
 * Methods:
 *   get_soundings(station, date?) — Get soundings (2\u00A2)
 *   list_stations()               — List stations (1\u00A2)
 *   get_latest(station)           — Get latest obs (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SoundingInput {
  station: string
  date?: string
}

interface StationInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weather.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'settlegrid-weather-balloon/1.0 (contact@settlegrid.ai)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NWS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'weather-balloon',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_soundings: { costCents: 2, displayName: 'Get radiosonde soundings' },
      list_stations: { costCents: 1, displayName: 'List radiosonde stations' },
      get_latest: { costCents: 1, displayName: 'Get latest observation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSoundings = sg.wrap(async (args: SoundingInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (e.g. OKX)')
  }
  const station = args.station.toUpperCase()
  return apiFetch<unknown>(\`/stations/\${encodeURIComponent(station)}/observations\`)
}, { method: 'get_soundings' })

const listStations = sg.wrap(async () => {
  return apiFetch<unknown>('/stations?state=US&limit=50')
}, { method: 'list_stations' })

const getLatest = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const station = args.station.toUpperCase()
  return apiFetch<unknown>(\`/stations/\${encodeURIComponent(station)}/observations/latest\`)
}, { method: 'get_latest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSoundings, listStations, getLatest }

console.log('settlegrid-weather-balloon MCP server ready')
console.log('Methods: get_soundings, list_stations, get_latest')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 90. settlegrid-lightning-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'lightning-data',
  title: 'Lightning & Severe Weather',
  desc: 'Access severe weather alerts and lightning-related data via NWS API. Get active alerts, search by state, and check density.',
  api: { base: 'https://api.weather.gov', name: 'NWS Alerts API', docs: 'https://www.weather.gov/documentation/services-web-api' },
  key: null,
  keywords: ['lightning', 'severe-weather', 'storms', 'nws', 'alerts', 'meteorology'],
  methods: [
    { name: 'get_strikes', display: 'Get active severe thunderstorm alerts near location', cost: 2, params: 'lat, lon, radius?',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
        { name: 'radius', type: 'number', required: false, desc: 'Search radius in km (default 50)' },
      ] },
    { name: 'get_alerts', display: 'Get active weather alerts by state', cost: 1, params: 'state',
      inputs: [
        { name: 'state', type: 'string', required: true, desc: 'Two-letter state code (e.g. TX, FL)' },
      ] },
    { name: 'get_density', display: 'Get alert count by region', cost: 1, params: 'region',
      inputs: [
        { name: 'region', type: 'string', required: true, desc: 'Region or state code' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-lightning-data — Lightning & Severe Weather MCP Server
 * Wraps NWS Alerts API with SettleGrid billing.
 * Methods:
 *   get_strikes(lat, lon, radius?)  — Get severe thunderstorm alerts (2\u00A2)
 *   get_alerts(state)               — Get alerts by state (1\u00A2)
 *   get_density(region)             — Get alert density (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StrikeInput {
  lat: number
  lon: number
  radius?: number
}

interface AlertInput {
  state: string
}

interface DensityInput {
  region: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.weather.gov'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/geo+json',
      'User-Agent': 'settlegrid-lightning-data/1.0 (contact@settlegrid.ai)',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NWS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lightning-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_strikes: { costCents: 2, displayName: 'Get severe thunderstorm alerts' },
      get_alerts: { costCents: 1, displayName: 'Get alerts by state' },
      get_density: { costCents: 1, displayName: 'Get alert density' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getStrikes = sg.wrap(async (args: StrikeInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  return apiFetch<unknown>('/alerts/active', {
    point: \`\${args.lat},\${args.lon}\`,
    event: 'Severe Thunderstorm Warning',
  })
}, { method: 'get_strikes' })

const getAlerts = sg.wrap(async (args: AlertInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('/alerts/active', {
    area: args.state.toUpperCase(),
  })
}, { method: 'get_alerts' })

const getDensity = sg.wrap(async (args: DensityInput) => {
  if (!args.region || typeof args.region !== 'string') {
    throw new Error('region is required')
  }
  const data = await apiFetch<{ features?: unknown[] }>('/alerts/active', {
    area: args.region.toUpperCase(),
  })
  return { region: args.region, activeAlerts: (data.features || []).length, data }
}, { method: 'get_density' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getStrikes, getAlerts, getDensity }

console.log('settlegrid-lightning-data MCP server ready')
console.log('Methods: get_strikes, get_alerts, get_density')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 91. settlegrid-soil-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'soil-data',
  title: 'Soil Composition Data',
  desc: 'Access soil property data via ISRIC SoilGrids REST API. Get soil properties, list available properties, and get classification.',
  api: { base: 'https://rest.isric.org/soilgrids/v2.0', name: 'SoilGrids REST API', docs: 'https://rest.isric.org/soilgrids/v2.0/docs' },
  key: null,
  keywords: ['soil', 'agriculture', 'geoscience', 'earth-science', 'soilgrids'],
  methods: [
    { name: 'get_soil', display: 'Get soil properties at a location', cost: 2, params: 'lat, lon, property?',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude (-90 to 90)' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude (-180 to 180)' },
        { name: 'property', type: 'string', required: false, desc: 'Soil property (e.g. "clay", "sand", "phh2o", "soc")' },
      ] },
    { name: 'list_properties', display: 'List available soil properties', cost: 1, params: '',
      inputs: [] },
    { name: 'get_classification', display: 'Get soil classification at a location', cost: 2, params: 'lat, lon',
      inputs: [
        { name: 'lat', type: 'number', required: true, desc: 'Latitude' },
        { name: 'lon', type: 'number', required: true, desc: 'Longitude' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-soil-data — Soil Composition Data MCP Server
 * Wraps ISRIC SoilGrids REST API with SettleGrid billing.
 * Methods:
 *   get_soil(lat, lon, property?) — Get soil properties (2\u00A2)
 *   list_properties()             — List properties (1\u00A2)
 *   get_classification(lat, lon)  — Get classification (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SoilInput {
  lat: number
  lon: number
  property?: string
}

interface ClassInput {
  lat: number
  lon: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://rest.isric.org/soilgrids/v2.0'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-soil-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SoilGrids API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

const SOIL_PROPERTIES = [
  'bdod', 'cec', 'cfvo', 'clay', 'nitrogen', 'ocd', 'ocs', 'phh2o', 'sand', 'silt', 'soc', 'wv0010', 'wv0033', 'wv1500'
]

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'soil-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_soil: { costCents: 2, displayName: 'Get soil properties' },
      list_properties: { costCents: 1, displayName: 'List soil properties' },
      get_classification: { costCents: 2, displayName: 'Get soil classification' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSoil = sg.wrap(async (args: SoilInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required (numeric)')
  }
  const params: Record<string, string> = {
    lat: String(args.lat),
    lon: String(args.lon),
  }
  if (args.property) {
    params.property = args.property
  }
  return apiFetch<unknown>('properties/query', params)
}, { method: 'get_soil' })

const listProperties = sg.wrap(async () => {
  return {
    properties: SOIL_PROPERTIES,
    descriptions: {
      bdod: 'Bulk density', cec: 'Cation exchange capacity', cfvo: 'Coarse fragments',
      clay: 'Clay content', nitrogen: 'Total nitrogen', ocd: 'Organic carbon density',
      ocs: 'Organic carbon stocks', phh2o: 'Soil pH in H2O', sand: 'Sand content',
      silt: 'Silt content', soc: 'Soil organic carbon', wv0010: 'Water content 10kPa',
      wv0033: 'Water content 33kPa', wv1500: 'Water content 1500kPa',
    },
  }
}, { method: 'list_properties' })

const getClassification = sg.wrap(async (args: ClassInput) => {
  if (typeof args.lat !== 'number' || typeof args.lon !== 'number') {
    throw new Error('lat and lon are required')
  }
  return apiFetch<unknown>('classification/query', {
    lat: String(args.lat),
    lon: String(args.lon),
    number_classes: '3',
  })
}, { method: 'get_classification' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSoil, listProperties, getClassification }

console.log('settlegrid-soil-data MCP server ready')
console.log('Methods: get_soil, list_properties, get_classification')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 92. settlegrid-river-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'river-data',
  title: 'River Flow & Level Data',
  desc: 'Access river flow and water level data via USGS Water Services. Get real-time streamflow, search monitoring sites, and view statistics.',
  api: { base: 'https://waterservices.usgs.gov/nwis', name: 'USGS Water Services', docs: 'https://waterservices.usgs.gov/' },
  key: null,
  keywords: ['river', 'water', 'streamflow', 'hydrology', 'usgs'],
  methods: [
    { name: 'get_flow', display: 'Get current streamflow for a site', cost: 1, params: 'site, period?',
      inputs: [
        { name: 'site', type: 'string', required: true, desc: 'USGS site number (e.g. 01646500)' },
        { name: 'period', type: 'string', required: false, desc: 'Data period (e.g. P7D for 7 days, default P1D)' },
      ] },
    { name: 'search_sites', display: 'Search monitoring sites by state', cost: 1, params: 'state, type?',
      inputs: [
        { name: 'state', type: 'string', required: true, desc: 'Two-letter state code (e.g. VA, CO)' },
        { name: 'type', type: 'string', required: false, desc: 'Site type (e.g. ST for stream, default ST)' },
      ] },
    { name: 'get_stats', display: 'Get daily statistics for a site', cost: 2, params: 'site',
      inputs: [
        { name: 'site', type: 'string', required: true, desc: 'USGS site number' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-river-data — River Flow & Level Data MCP Server
 * Wraps USGS Water Services with SettleGrid billing.
 * Methods:
 *   get_flow(site, period?)    — Get streamflow (1\u00A2)
 *   search_sites(state, type?) — Search sites (1\u00A2)
 *   get_stats(site)            — Get statistics (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FlowInput {
  site: string
  period?: string
}

interface SearchInput {
  state: string
  type?: string
}

interface StatsInput {
  site: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://waterservices.usgs.gov/nwis'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('format', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-river-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USGS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'river-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_flow: { costCents: 1, displayName: 'Get streamflow data' },
      search_sites: { costCents: 1, displayName: 'Search monitoring sites' },
      get_stats: { costCents: 2, displayName: 'Get site statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlow = sg.wrap(async (args: FlowInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required (USGS site number)')
  }
  return apiFetch<unknown>('iv/', {
    sites: args.site,
    parameterCd: '00060,00065',
    period: args.period || 'P1D',
  })
}, { method: 'get_flow' })

const searchSites = sg.wrap(async (args: SearchInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('site/', {
    stateCd: args.state.toUpperCase(),
    siteType: args.type || 'ST',
    siteStatus: 'active',
    hasDataTypeCd: 'iv',
  })
}, { method: 'search_sites' })

const getStats = sg.wrap(async (args: StatsInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required')
  }
  return apiFetch<unknown>('stat/', {
    sites: args.site,
    statReportType: 'daily',
    statTypeCd: 'mean,min,max',
    parameterCd: '00060',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlow, searchSites, getStats }

console.log('settlegrid-river-data MCP server ready')
console.log('Methods: get_flow, search_sites, get_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 93. settlegrid-lake-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'lake-data',
  title: 'Lake & Reservoir Data',
  desc: 'Access lake and reservoir water level data via USGS Water Services. Get levels, search reservoirs, and view statistics.',
  api: { base: 'https://waterservices.usgs.gov/nwis', name: 'USGS Water Services (Reservoirs)', docs: 'https://waterservices.usgs.gov/' },
  key: null,
  keywords: ['lake', 'reservoir', 'water-level', 'hydrology', 'usgs'],
  methods: [
    { name: 'get_level', display: 'Get current water level for a site', cost: 1, params: 'site',
      inputs: [
        { name: 'site', type: 'string', required: true, desc: 'USGS site number (e.g. 09380000)' },
      ] },
    { name: 'search_reservoirs', display: 'Search reservoir sites by state', cost: 1, params: 'state',
      inputs: [
        { name: 'state', type: 'string', required: true, desc: 'Two-letter state code (e.g. AZ, CA)' },
      ] },
    { name: 'get_stats', display: 'Get water level statistics for a site', cost: 2, params: 'site',
      inputs: [
        { name: 'site', type: 'string', required: true, desc: 'USGS site number' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-lake-data — Lake & Reservoir Data MCP Server
 * Wraps USGS Water Services with SettleGrid billing.
 * Methods:
 *   get_level(site)           — Get water level (1\u00A2)
 *   search_reservoirs(state)  — Search reservoirs (1\u00A2)
 *   get_stats(site)           — Get level statistics (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SiteInput {
  site: string
}

interface SearchInput {
  state: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://waterservices.usgs.gov/nwis'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('format', 'json')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-lake-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USGS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'lake-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_level: { costCents: 1, displayName: 'Get water level' },
      search_reservoirs: { costCents: 1, displayName: 'Search reservoirs' },
      get_stats: { costCents: 2, displayName: 'Get level statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getLevel = sg.wrap(async (args: SiteInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required (USGS site number)')
  }
  return apiFetch<unknown>('iv/', {
    sites: args.site,
    parameterCd: '00062,00065',
    period: 'P1D',
  })
}, { method: 'get_level' })

const searchReservoirs = sg.wrap(async (args: SearchInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required (two-letter code)')
  }
  return apiFetch<unknown>('site/', {
    stateCd: args.state.toUpperCase(),
    siteType: 'LK',
    siteStatus: 'active',
    hasDataTypeCd: 'iv',
  })
}, { method: 'search_reservoirs' })

const getStats = sg.wrap(async (args: SiteInput) => {
  if (!args.site || typeof args.site !== 'string') {
    throw new Error('site is required')
  }
  return apiFetch<unknown>('stat/', {
    sites: args.site,
    statReportType: 'daily',
    statTypeCd: 'mean,min,max',
    parameterCd: '00062',
  })
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getLevel, searchReservoirs, getStats }

console.log('settlegrid-lake-data MCP server ready')
console.log('Methods: get_level, search_reservoirs, get_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 94. settlegrid-volcano-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'volcano-data',
  title: 'Volcanic Activity Data',
  desc: 'Access volcanic activity data via USGS Volcano Hazards API and Smithsonian GVP. List volcanoes, get details, and check recent eruptions.',
  api: { base: 'https://volcanoes.usgs.gov/vsc/api', name: 'USGS Volcano Hazards API', docs: 'https://volcanoes.usgs.gov/' },
  key: null,
  keywords: ['volcano', 'eruption', 'geoscience', 'hazards', 'usgs', 'geology'],
  methods: [
    { name: 'list_volcanoes', display: 'List volcanoes with optional filters', cost: 1, params: 'country?, status?',
      inputs: [
        { name: 'country', type: 'string', required: false, desc: 'Country name (e.g. "United States", "Japan")' },
        { name: 'status', type: 'string', required: false, desc: 'Status filter (e.g. "Historical", "Holocene")' },
      ] },
    { name: 'get_volcano', display: 'Get volcano details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Volcano number or name' },
      ] },
    { name: 'get_recent_eruptions', display: 'Get recent volcanic eruptions', cost: 2, params: 'limit?',
      inputs: [
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-volcano-data — Volcanic Activity Data MCP Server
 * Wraps USGS Volcano Hazards API with SettleGrid billing.
 * Methods:
 *   list_volcanoes(country?, status?) — List volcanoes (1\u00A2)
 *   get_volcano(id)                   — Get volcano details (1\u00A2)
 *   get_recent_eruptions(limit?)      — Get recent eruptions (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ListInput {
  country?: string
  status?: string
}

interface VolcanoInput {
  id: string
}

interface RecentInput {
  limit?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://volcanoes.usgs.gov/vsc/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-volcano-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Volcano API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'volcano-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_volcanoes: { costCents: 1, displayName: 'List volcanoes' },
      get_volcano: { costCents: 1, displayName: 'Get volcano details' },
      get_recent_eruptions: { costCents: 2, displayName: 'Get recent eruptions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const listVolcanoes = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.status) params.status = args.status
  return apiFetch<unknown>('volcanoApi/volcanos', params)
}, { method: 'list_volcanoes' })

const getVolcano = sg.wrap(async (args: VolcanoInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (volcano number or name)')
  }
  return apiFetch<unknown>(\`volcanoApi/volcanos/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_volcano' })

const getRecentEruptions = sg.wrap(async (args: RecentInput) => {
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('volcanoApi/volcanos', {
    status: 'Historical',
    limit: String(limit),
  })
}, { method: 'get_recent_eruptions' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { listVolcanoes, getVolcano, getRecentEruptions }

console.log('settlegrid-volcano-data MCP server ready')
console.log('Methods: list_volcanoes, get_volcano, get_recent_eruptions')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 95. settlegrid-tide-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'tide-data',
  title: 'Tidal Predictions',
  desc: 'Access tidal prediction data via NOAA CO-OPS API. Get tide predictions, list stations, and retrieve water levels.',
  api: { base: 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter', name: 'NOAA CO-OPS API', docs: 'https://tidesandcurrents.noaa.gov/api/' },
  key: null,
  keywords: ['tides', 'ocean', 'noaa', 'coastal', 'water-level', 'predictions'],
  methods: [
    { name: 'get_predictions', display: 'Get tide predictions for a station', cost: 2, params: 'station, date?, range?',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'Station ID (e.g. 8454000 for Providence)' },
        { name: 'date', type: 'string', required: false, desc: 'Date (YYYYMMDD). Defaults to today.' },
        { name: 'range', type: 'number', required: false, desc: 'Hours of data (default 24, max 168)' },
      ] },
    { name: 'list_stations', display: 'List tide stations', cost: 1, params: 'state?',
      inputs: [
        { name: 'state', type: 'string', required: false, desc: 'Two-letter state code (e.g. CA, FL)' },
      ] },
    { name: 'get_levels', display: 'Get observed water levels', cost: 1, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'Station ID' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-tide-data — Tidal Predictions MCP Server
 * Wraps NOAA CO-OPS API with SettleGrid billing.
 * Methods:
 *   get_predictions(station, date?, range?) — Get predictions (2\u00A2)
 *   list_stations(state?)                   — List stations (1\u00A2)
 *   get_levels(station)                     — Get water levels (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface PredictionInput {
  station: string
  date?: string
  range?: number
}

interface ListInput {
  state?: string
}

interface LevelInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'

async function apiFetch<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  params.application = 'settlegrid-tide-data'
  params.units = 'english'
  params.time_zone = 'gmt'
  params.format = 'json'
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-tide-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NOAA CO-OPS \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10).replace(/-/g, '')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'tide-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_predictions: { costCents: 2, displayName: 'Get tide predictions' },
      list_stations: { costCents: 1, displayName: 'List tide stations' },
      get_levels: { costCents: 1, displayName: 'Get water levels' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getPredictions = sg.wrap(async (args: PredictionInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const range = Math.min(args.range || 24, 168)
  return apiFetch<unknown>({
    station: args.station,
    product: 'predictions',
    datum: 'MLLW',
    begin_date: args.date || todayStr(),
    range: String(range),
    interval: 'hilo',
  })
}, { method: 'get_predictions' })

const listStations = sg.wrap(async (args: ListInput) => {
  const url = new URL('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json')
  url.searchParams.set('type', 'tidepredictions')
  if (args.state) url.searchParams.set('state', args.state.toUpperCase())
  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'settlegrid-tide-data/1.0' },
  })
  if (!res.ok) throw new Error(\`NOAA API \${res.status}\`)
  return res.json()
}, { method: 'list_stations' })

const getLevels = sg.wrap(async (args: LevelInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  return apiFetch<unknown>({
    station: args.station,
    product: 'water_level',
    datum: 'MLLW',
    date: 'latest',
    range: '24',
  })
}, { method: 'get_levels' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getPredictions, listStations, getLevels }

console.log('settlegrid-tide-data MCP server ready')
console.log('Methods: get_predictions, list_stations, get_levels')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 96. settlegrid-wave-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'wave-data',
  title: 'Ocean Wave Data',
  desc: 'Access ocean buoy and wave data via NOAA NDBC. Get real-time observations, list stations, and retrieve latest readings.',
  api: { base: 'https://www.ndbc.noaa.gov/data/realtime2', name: 'NOAA NDBC', docs: 'https://www.ndbc.noaa.gov/docs/ndbc_web_data_guide.pdf' },
  key: null,
  keywords: ['waves', 'ocean', 'buoy', 'ndbc', 'noaa', 'surf', 'maritime'],
  methods: [
    { name: 'get_observations', display: 'Get buoy observations', cost: 1, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'NDBC station ID (e.g. 44013, 46025)' },
      ] },
    { name: 'list_stations', display: 'List active NDBC stations', cost: 1, params: '',
      inputs: [] },
    { name: 'get_latest', display: 'Get latest observation for a station', cost: 1, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'NDBC station ID' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-wave-data — Ocean Wave Data MCP Server
 * Wraps NOAA NDBC with SettleGrid billing.
 * Methods:
 *   get_observations(station) — Get buoy observations (1\u00A2)
 *   list_stations()           — List stations (1\u00A2)
 *   get_latest(station)       — Get latest reading (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StationInput {
  station: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const NDBC_BASE = 'https://www.ndbc.noaa.gov'

async function fetchNdbc(path: string): Promise<string> {
  const res = await fetch(\`\${NDBC_BASE}\${path}\`, {
    headers: { 'User-Agent': 'settlegrid-wave-data/1.0' },
  })
  if (!res.ok) {
    throw new Error(\`NDBC \${res.status}: failed to fetch \${path}\`)
  }
  return res.text()
}

function parseNdbcText(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\\n')
  if (lines.length < 3) return []
  const headers = lines[0].replace(/#/g, '').trim().split(/\\s+/)
  return lines.slice(2, 12).map(line => {
    const vals = line.trim().split(/\\s+/)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] || '' })
    return row
  })
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'wave-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_observations: { costCents: 1, displayName: 'Get buoy observations' },
      list_stations: { costCents: 1, displayName: 'List active stations' },
      get_latest: { costCents: 1, displayName: 'Get latest observation' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getObservations = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (NDBC station ID)')
  }
  const text = await fetchNdbc(\`/data/realtime2/\${args.station}.txt\`)
  return parseNdbcText(text)
}, { method: 'get_observations' })

const listStations = sg.wrap(async () => {
  const text = await fetchNdbc('/data/realtime2/')
  const matches = text.match(/\\w+\\.txt/g) || []
  const stations = [...new Set(matches.map(m => m.replace('.txt', '')))]
  return { stations: stations.slice(0, 50), count: stations.length }
}, { method: 'list_stations' })

const getLatest = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  const text = await fetchNdbc(\`/data/realtime2/\${args.station}.txt\`)
  const rows = parseNdbcText(text)
  return rows.length > 0 ? rows[0] : { error: 'No data available' }
}, { method: 'get_latest' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getObservations, listStations, getLatest }

console.log('settlegrid-wave-data MCP server ready')
console.log('Methods: get_observations, list_stations, get_latest')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 97. settlegrid-snow-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'snow-data',
  title: 'Snowfall & Snowpack Data',
  desc: 'Access SNOTEL snowpack data via NRCS AWDB Web Service. Get snowpack measurements, list stations, and view forecasts.',
  api: { base: 'https://wcc.sc.egov.usda.gov/awdbWebService/services', name: 'NRCS SNOTEL AWDB', docs: 'https://www.nrcs.usda.gov/wps/portal/wcc/home/dataAccessHelp/webService/' },
  key: null,
  keywords: ['snow', 'snotel', 'snowpack', 'winter', 'hydrology', 'nrcs'],
  methods: [
    { name: 'get_snowpack', display: 'Get current snowpack for a station', cost: 1, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'SNOTEL station triplet (e.g. 669:CO:SNTL)' },
      ] },
    { name: 'list_stations', display: 'List SNOTEL stations', cost: 1, params: 'state?',
      inputs: [
        { name: 'state', type: 'string', required: false, desc: 'Two-letter state code (e.g. CO, UT)' },
      ] },
    { name: 'get_forecast', display: 'Get water supply forecast for a station', cost: 2, params: 'station',
      inputs: [
        { name: 'station', type: 'string', required: true, desc: 'SNOTEL station triplet' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-snow-data — Snowfall & Snowpack Data MCP Server
 * Wraps NRCS SNOTEL AWDB with SettleGrid billing.
 * Methods:
 *   get_snowpack(station)     — Get snowpack data (1\u00A2)
 *   list_stations(state?)     — List stations (1\u00A2)
 *   get_forecast(station)     — Get forecast (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StationInput {
  station: string
}

interface ListInput {
  state?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://wcc.sc.egov.usda.gov/awdbWebService/services'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-snow-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NRCS API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'snow-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_snowpack: { costCents: 1, displayName: 'Get snowpack data' },
      list_stations: { costCents: 1, displayName: 'List SNOTEL stations' },
      get_forecast: { costCents: 2, displayName: 'Get water supply forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSnowpack = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required (e.g. 669:CO:SNTL)')
  }
  return apiFetch<unknown>('v1/data', {
    stationTriplets: args.station,
    elementCd: 'SNWD,WTEQ',
    beginDate: todayStr(),
    endDate: todayStr(),
  })
}, { method: 'get_snowpack' })

const listStations = sg.wrap(async (args: ListInput) => {
  const params: Record<string, string> = { networkCd: 'SNTL' }
  if (args.state) params.stateCd = args.state.toUpperCase()
  return apiFetch<unknown>('v1/stations', params)
}, { method: 'list_stations' })

const getForecast = sg.wrap(async (args: StationInput) => {
  if (!args.station || typeof args.station !== 'string') {
    throw new Error('station is required')
  }
  return apiFetch<unknown>('v1/forecasts', {
    stationTriplets: args.station,
  })
}, { method: 'get_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSnowpack, listStations, getForecast }

console.log('settlegrid-snow-data MCP server ready')
console.log('Methods: get_snowpack, list_stations, get_forecast')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 98. settlegrid-drought-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'drought-data',
  title: 'Drought Monitoring Data',
  desc: 'Access US Drought Monitor data via USDM API. Get current drought conditions, view history, and retrieve statistics.',
  api: { base: 'https://usdm.unl.edu/api/v1', name: 'US Drought Monitor API', docs: 'https://droughtmonitor.unl.edu/DmData/DataDownload/WebServiceInfo.aspx' },
  key: null,
  keywords: ['drought', 'water', 'climate', 'agriculture', 'usdm'],
  methods: [
    { name: 'get_current', display: 'Get current drought conditions', cost: 1, params: 'state?',
      inputs: [
        { name: 'state', type: 'string', required: false, desc: 'Two-letter state code (e.g. CA, TX). Defaults to national.' },
      ] },
    { name: 'get_history', display: 'Get drought history for a state', cost: 2, params: 'state, weeks?',
      inputs: [
        { name: 'state', type: 'string', required: true, desc: 'Two-letter state code' },
        { name: 'weeks', type: 'number', required: false, desc: 'Number of weeks history (default 12)' },
      ] },
    { name: 'get_stats', display: 'Get drought statistics by date', cost: 1, params: 'date?',
      inputs: [
        { name: 'date', type: 'string', required: false, desc: 'Date (YYYY-MM-DD). Defaults to latest.' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-drought-data — Drought Monitoring Data MCP Server
 * Wraps US Drought Monitor API with SettleGrid billing.
 * Methods:
 *   get_current(state?)           — Get current drought (1\u00A2)
 *   get_history(state, weeks?)    — Get drought history (2\u00A2)
 *   get_stats(date?)              — Get drought stats (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface CurrentInput {
  state?: string
}

interface HistoryInput {
  state: string
  weeks?: number
}

interface StatsInput {
  date?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://usdm.unl.edu/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-drought-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USDM API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'drought-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current: { costCents: 1, displayName: 'Get current drought' },
      get_history: { costCents: 2, displayName: 'Get drought history' },
      get_stats: { costCents: 1, displayName: 'Get drought statistics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrent = sg.wrap(async (args: CurrentInput) => {
  const params: Record<string, string> = { type: 'state' }
  if (args.state) params.area = args.state.toUpperCase()
  return apiFetch<unknown>('currentConditions', params)
}, { method: 'get_current' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  if (!args.state || typeof args.state !== 'string') {
    throw new Error('state is required')
  }
  const weeks = args.weeks || 12
  const endDate = todayStr()
  const startDate = new Date(Date.now() - weeks * 7 * 86400000).toISOString().slice(0, 10)
  return apiFetch<unknown>('timeseries', {
    area: args.state.toUpperCase(),
    startDate,
    endDate,
    type: 'state',
  })
}, { method: 'get_history' })

const getStats = sg.wrap(async (args: StatsInput) => {
  const params: Record<string, string> = { type: 'national' }
  if (args.date) params.date = args.date
  return apiFetch<unknown>('currentConditions', params)
}, { method: 'get_stats' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrent, getHistory, getStats }

console.log('settlegrid-drought-data MCP server ready')
console.log('Methods: get_current, get_history, get_stats')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 99. settlegrid-aurora
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'aurora',
  title: 'Aurora Forecast Data',
  desc: 'Access aurora borealis forecast data via NOAA SWPC. Get aurora forecasts, Kp index, and OVATION aurora maps.',
  api: { base: 'https://services.swpc.noaa.gov', name: 'NOAA SWPC', docs: 'https://www.swpc.noaa.gov/products-and-data' },
  key: null,
  keywords: ['aurora', 'northern-lights', 'space-weather', 'noaa', 'geomagnetic'],
  methods: [
    { name: 'get_forecast', display: 'Get aurora forecast', cost: 1, params: '',
      inputs: [] },
    { name: 'get_kp_index', display: 'Get current Kp geomagnetic index', cost: 1, params: '',
      inputs: [] },
    { name: 'get_ovation_map', display: 'Get OVATION aurora probability map', cost: 2, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-aurora — Aurora Forecast Data MCP Server
 * Wraps NOAA SWPC with SettleGrid billing.
 * Methods:
 *   get_forecast()    — Get aurora forecast (1\u00A2)
 *   get_kp_index()    — Get Kp index (1\u00A2)
 *   get_ovation_map() — Get OVATION map (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://services.swpc.noaa.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-aurora/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SWPC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'aurora',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_forecast: { costCents: 1, displayName: 'Get aurora forecast' },
      get_kp_index: { costCents: 1, displayName: 'Get Kp index' },
      get_ovation_map: { costCents: 2, displayName: 'Get OVATION aurora map' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getForecast = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index-forecast.json')
}, { method: 'get_forecast' })

const getKpIndex = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index.json')
}, { method: 'get_kp_index' })

const getOvationMap = sg.wrap(async () => {
  return apiFetch<unknown>('/json/ovation_aurora_latest.json')
}, { method: 'get_ovation_map' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getForecast, getKpIndex, getOvationMap }

console.log('settlegrid-aurora MCP server ready')
console.log('Methods: get_forecast, get_kp_index, get_ovation_map')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 100. settlegrid-space-weather
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'space-weather',
  title: 'Space Weather Alerts',
  desc: 'Access space weather alerts and data via NOAA SWPC. Get alerts, solar wind data, and geomagnetic forecasts.',
  api: { base: 'https://services.swpc.noaa.gov', name: 'NOAA SWPC', docs: 'https://www.swpc.noaa.gov/products-and-data' },
  key: null,
  keywords: ['space-weather', 'solar', 'geomagnetic', 'noaa', 'swpc'],
  methods: [
    { name: 'get_alerts', display: 'Get active space weather alerts', cost: 1, params: '',
      inputs: [] },
    { name: 'get_solar_wind', display: 'Get real-time solar wind data', cost: 1, params: '',
      inputs: [] },
    { name: 'get_geomag_forecast', display: 'Get geomagnetic activity forecast', cost: 2, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-space-weather — Space Weather Alerts MCP Server
 * Wraps NOAA SWPC with SettleGrid billing.
 * Methods:
 *   get_alerts()          — Get space weather alerts (1\u00A2)
 *   get_solar_wind()      — Get solar wind data (1\u00A2)
 *   get_geomag_forecast() — Get geomagnetic forecast (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://services.swpc.noaa.gov'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-space-weather/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SWPC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'space-weather',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_alerts: { costCents: 1, displayName: 'Get space weather alerts' },
      get_solar_wind: { costCents: 1, displayName: 'Get solar wind data' },
      get_geomag_forecast: { costCents: 2, displayName: 'Get geomagnetic forecast' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getAlerts = sg.wrap(async () => {
  return apiFetch<unknown>('/products/alerts.json')
}, { method: 'get_alerts' })

const getSolarWind = sg.wrap(async () => {
  return apiFetch<unknown>('/products/solar-wind/plasma-7-day.json')
}, { method: 'get_solar_wind' })

const getGeomagForecast = sg.wrap(async () => {
  return apiFetch<unknown>('/products/noaa-planetary-k-index-forecast.json')
}, { method: 'get_geomag_forecast' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getAlerts, getSolarWind, getGeomagForecast }

console.log('settlegrid-space-weather MCP server ready')
console.log('Methods: get_alerts, get_solar_wind, get_geomag_forecast')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 101. settlegrid-radiation
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'radiation',
  title: 'Environmental Radiation',
  desc: 'Access environmental radiation monitoring data via EPA RadNet. Get readings, list monitors, and view history.',
  api: { base: 'https://www.epa.gov/enviro/radnet-csv-file-download', name: 'EPA RadNet', docs: 'https://www.epa.gov/radnet' },
  key: null,
  keywords: ['radiation', 'epa', 'radnet', 'environmental', 'monitoring', 'nuclear'],
  methods: [
    { name: 'get_readings', display: 'Get radiation readings by state', cost: 1, params: 'state?',
      inputs: [
        { name: 'state', type: 'string', required: false, desc: 'Two-letter state code (e.g. NV, PA)' },
      ] },
    { name: 'list_monitors', display: 'List radiation monitors', cost: 1, params: 'state?',
      inputs: [
        { name: 'state', type: 'string', required: false, desc: 'Two-letter state code' },
      ] },
    { name: 'get_history', display: 'Get historical readings for a monitor', cost: 2, params: 'monitor, days?',
      inputs: [
        { name: 'monitor', type: 'string', required: true, desc: 'Monitor ID or location name' },
        { name: 'days', type: 'number', required: false, desc: 'Number of days of history (default 7)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-radiation — Environmental Radiation MCP Server
 * Wraps EPA RadNet data with SettleGrid billing.
 * Methods:
 *   get_readings(state?)          — Get readings (1\u00A2)
 *   list_monitors(state?)         — List monitors (1\u00A2)
 *   get_history(monitor, days?)   — Get history (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReadingsInput {
  state?: string
}

interface ListInput {
  state?: string
}

interface HistoryInput {
  monitor: string
  days?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://enviro.epa.gov/enviro/efservice'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}/\${path}/json\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-radiation/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`EPA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'radiation',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_readings: { costCents: 1, displayName: 'Get radiation readings' },
      list_monitors: { costCents: 1, displayName: 'List monitors' },
      get_history: { costCents: 2, displayName: 'Get historical readings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getReadings = sg.wrap(async (args: ReadingsInput) => {
  let path = 'RAD_NET_GAMMA_GROSS'
  if (args.state) {
    path += \`/STATE_ABBREVIATION/=\${args.state.toUpperCase()}\`
  }
  path += '/rows/0:20'
  return apiFetch<unknown>(path)
}, { method: 'get_readings' })

const listMonitors = sg.wrap(async (args: ListInput) => {
  let path = 'RAD_NET_GAMMA_GROSS'
  if (args.state) {
    path += \`/STATE_ABBREVIATION/=\${args.state.toUpperCase()}\`
  }
  path += '/rows/0:50'
  return apiFetch<unknown>(path)
}, { method: 'list_monitors' })

const getHistory = sg.wrap(async (args: HistoryInput) => {
  if (!args.monitor || typeof args.monitor !== 'string') {
    throw new Error('monitor is required')
  }
  const path = \`RAD_NET_GAMMA_GROSS/LOCATION_NAME/=\${encodeURIComponent(args.monitor)}/rows/0:50\`
  return apiFetch<unknown>(path)
}, { method: 'get_history' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getReadings, listMonitors, getHistory }

console.log('settlegrid-radiation MCP server ready')
console.log('Methods: get_readings, list_monitors, get_history')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 102. settlegrid-paleoclimate
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'paleoclimate',
  title: 'Paleoclimate Data',
  desc: 'Access historical climate data via NOAA Paleoclimatology API. Search datasets, get dataset details, and list data types.',
  api: { base: 'https://www.ncei.noaa.gov/access/paleo-search/api/v1', name: 'NOAA Paleo API', docs: 'https://www.ncei.noaa.gov/access/paleo-search/api' },
  key: null,
  keywords: ['paleoclimate', 'climate-history', 'ice-cores', 'noaa', 'earth-science'],
  methods: [
    { name: 'search_datasets', display: 'Search paleoclimate datasets', cost: 1, params: 'query, type?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "ice core", "tree ring")' },
        { name: 'type', type: 'string', required: false, desc: 'Data type (e.g. "ice core", "coral", "tree ring")' },
      ] },
    { name: 'get_dataset', display: 'Get dataset details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Dataset ID' },
      ] },
    { name: 'list_data_types', display: 'List available paleoclimate data types', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-paleoclimate — Paleoclimate Data MCP Server
 * Wraps NOAA Paleoclimatology API with SettleGrid billing.
 * Methods:
 *   search_datasets(query, type?) — Search datasets (1\u00A2)
 *   get_dataset(id)               — Get dataset details (1\u00A2)
 *   list_data_types()             — List data types (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  type?: string
}

interface DatasetInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.ncei.noaa.gov/access/paleo-search/api/v1'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-paleoclimate/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`NOAA Paleo API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'paleoclimate',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_datasets: { costCents: 1, displayName: 'Search paleoclimate datasets' },
      get_dataset: { costCents: 1, displayName: 'Get dataset details' },
      list_data_types: { costCents: 1, displayName: 'List data types' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDatasets = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const params: Record<string, string> = {
    searchText: args.query,
    limit: '20',
    offset: '0',
  }
  if (args.type) params.dataTypeId = args.type
  return apiFetch<unknown>('search', params)
}, { method: 'search_datasets' })

const getDataset = sg.wrap(async (args: DatasetInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>(\`study/\${encodeURIComponent(args.id)}\`)
}, { method: 'get_dataset' })

const listDataTypes = sg.wrap(async () => {
  return {
    types: [
      { id: 'ice_core', name: 'Ice Cores' },
      { id: 'tree_ring', name: 'Tree Rings' },
      { id: 'coral', name: 'Coral' },
      { id: 'lake_sediment', name: 'Lake Sediments' },
      { id: 'marine_sediment', name: 'Marine Sediments' },
      { id: 'speleothem', name: 'Speleothems (Cave)' },
      { id: 'borehole', name: 'Borehole Temperatures' },
      { id: 'pollen', name: 'Pollen' },
      { id: 'insect', name: 'Insect Data' },
      { id: 'plant_macrofossil', name: 'Plant Macrofossils' },
    ],
  }
}, { method: 'list_data_types' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDatasets, getDataset, listDataTypes }

console.log('settlegrid-paleoclimate MCP server ready')
console.log('Methods: search_datasets, get_dataset, list_data_types')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 103. settlegrid-fossil-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'fossil-data',
  title: 'Fossil Record Data',
  desc: 'Access fossil record data via the Paleobiology Database (PBDB). Search fossils, get occurrences, and look up taxa.',
  api: { base: 'https://paleobiodb.org/data1.2', name: 'Paleobiology Database', docs: 'https://paleobiodb.org/data1.2/' },
  key: null,
  keywords: ['fossil', 'paleontology', 'paleobiology', 'pbdb', 'taxonomy', 'evolution'],
  methods: [
    { name: 'search_fossils', display: 'Search fossil occurrences', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Taxon name (e.g. "Tyrannosaurus", "Trilobita")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 20, max 100)' },
      ] },
    { name: 'get_occurrence', display: 'Get fossil occurrence details', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Occurrence ID (e.g. occ:12345)' },
      ] },
    { name: 'get_taxa', display: 'Get taxonomic information', cost: 2, params: 'name',
      inputs: [
        { name: 'name', type: 'string', required: true, desc: 'Taxon name (e.g. "Dinosauria", "Mammalia")' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-fossil-data — Fossil Record Data MCP Server
 * Wraps Paleobiology Database with SettleGrid billing.
 * Methods:
 *   search_fossils(query, limit?) — Search fossils (1\u00A2)
 *   get_occurrence(id)            — Get occurrence (1\u00A2)
 *   get_taxa(name)                — Get taxonomy (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface OccurrenceInput {
  id: string
}

interface TaxaInput {
  name: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://paleobiodb.org/data1.2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('show', 'full')
  url.searchParams.set('vocab', 'pbdb')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-fossil-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`PBDB API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fossil-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_fossils: { costCents: 1, displayName: 'Search fossils' },
      get_occurrence: { costCents: 1, displayName: 'Get occurrence' },
      get_taxa: { costCents: 2, displayName: 'Get taxonomy' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFossils = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 20, 100)
  return apiFetch<unknown>('occs/list.json', {
    base_name: args.query,
    limit: String(limit),
  })
}, { method: 'search_fossils' })

const getOccurrence = sg.wrap(async (args: OccurrenceInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  return apiFetch<unknown>('occs/single.json', { id: args.id })
}, { method: 'get_occurrence' })

const getTaxa = sg.wrap(async (args: TaxaInput) => {
  if (!args.name || typeof args.name !== 'string') {
    throw new Error('name is required')
  }
  return apiFetch<unknown>('taxa/list.json', {
    base_name: args.name,
    rel: 'all_children',
    limit: '20',
  })
}, { method: 'get_taxa' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFossils, getOccurrence, getTaxa }

console.log('settlegrid-fossil-data MCP server ready')
console.log('Methods: search_fossils, get_occurrence, get_taxa')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 104. settlegrid-archaeology
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'archaeology',
  title: 'Archaeological Site Data',
  desc: 'Access archaeological site data via Open Context. Search sites, get item details, and list research projects.',
  api: { base: 'https://opencontext.org/search/.json', name: 'Open Context API', docs: 'https://opencontext.org/about/services' },
  key: null,
  keywords: ['archaeology', 'sites', 'artifacts', 'history', 'anthropology'],
  methods: [
    { name: 'search_sites', display: 'Search archaeological sites', cost: 1, params: 'query, limit?',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Search query (e.g. "pottery", "Roman")' },
        { name: 'limit', type: 'number', required: false, desc: 'Max results (default 10, max 50)' },
      ] },
    { name: 'get_item', display: 'Get item details by ID', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Open Context item UUID or path' },
      ] },
    { name: 'list_projects', display: 'List archaeological projects', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-archaeology — Archaeological Site Data MCP Server
 * Wraps Open Context API with SettleGrid billing.
 * Methods:
 *   search_sites(query, limit?) — Search sites (1\u00A2)
 *   get_item(id)                — Get item details (1\u00A2)
 *   list_projects()             — List projects (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
  limit?: number
}

interface ItemInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://opencontext.org'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-archaeology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Open Context API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'archaeology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_sites: { costCents: 1, displayName: 'Search archaeological sites' },
      get_item: { costCents: 1, displayName: 'Get item details' },
      list_projects: { costCents: 1, displayName: 'List projects' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchSites = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const limit = Math.min(args.limit || 10, 50)
  return apiFetch<unknown>('/search/.json', {
    q: args.query,
    rows: String(limit),
  })
}, { method: 'search_sites' })

const getItem = sg.wrap(async (args: ItemInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required')
  }
  const path = args.id.startsWith('/') ? args.id : \`/subjects/\${args.id}\`
  return apiFetch<unknown>(\`\${path}.json\`)
}, { method: 'get_item' })

const listProjects = sg.wrap(async () => {
  return apiFetch<unknown>('/projects/.json', { rows: '25' })
}, { method: 'list_projects' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchSites, getItem, listProjects }

console.log('settlegrid-archaeology MCP server ready')
console.log('Methods: search_sites, get_item, list_projects')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 105. settlegrid-linguistics
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'linguistics',
  title: 'Language Data',
  desc: 'Access language and linguistic data via Glottolog. Search languages, get language details, and list language families.',
  api: { base: 'https://glottolog.org/glottolog', name: 'Glottolog API', docs: 'https://glottolog.org/' },
  key: null,
  keywords: ['linguistics', 'language', 'glottolog', 'typology', 'language-families'],
  methods: [
    { name: 'search_languages', display: 'Search languages by name', cost: 1, params: 'query',
      inputs: [
        { name: 'query', type: 'string', required: true, desc: 'Language name (e.g. "Mandarin", "Swahili")' },
      ] },
    { name: 'get_language', display: 'Get language details by Glottocode', cost: 1, params: 'id',
      inputs: [
        { name: 'id', type: 'string', required: true, desc: 'Glottocode (e.g. stan1293 for English)' },
      ] },
    { name: 'list_families', display: 'List top-level language families', cost: 2, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-linguistics — Language Data MCP Server
 * Wraps Glottolog with SettleGrid billing.
 * Methods:
 *   search_languages(query) — Search languages (1\u00A2)
 *   get_language(id)        — Get language details (1\u00A2)
 *   list_families()         — List families (2\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput {
  query: string
}

interface LanguageInput {
  id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://glottolog.org'

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-linguistics/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Glottolog API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'linguistics',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_languages: { costCents: 1, displayName: 'Search languages' },
      get_language: { costCents: 1, displayName: 'Get language details' },
      list_families: { costCents: 2, displayName: 'List language families' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchLanguages = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  return apiFetch<unknown>(\`/glottolog.languoid?name=\${encodeURIComponent(args.query)}&type=languages\`)
}, { method: 'search_languages' })

const getLanguage = sg.wrap(async (args: LanguageInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Glottocode)')
  }
  return apiFetch<unknown>(\`/resource/languoid/id/\${encodeURIComponent(args.id)}.json\`)
}, { method: 'get_language' })

const listFamilies = sg.wrap(async () => {
  return apiFetch<unknown>('/glottolog.languoid?type=family&level=top')
}, { method: 'list_families' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchLanguages, getLanguage, listFamilies }

console.log('settlegrid-linguistics MCP server ready')
console.log('Methods: search_languages, get_language, list_families')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 106. settlegrid-etymology
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'etymology',
  title: 'Word Origin & Definition Data',
  desc: 'Access word definitions, etymology, and phonetics via the Free Dictionary API. Look up definitions, origins, and pronunciations.',
  api: { base: 'https://api.dictionaryapi.dev/api/v2/entries', name: 'Free Dictionary API', docs: 'https://dictionaryapi.dev/' },
  key: null,
  keywords: ['etymology', 'dictionary', 'definition', 'language', 'words', 'phonetics'],
  methods: [
    { name: 'get_definition', display: 'Get word definitions', cost: 1, params: 'word, lang?',
      inputs: [
        { name: 'word', type: 'string', required: true, desc: 'Word to look up (e.g. "serendipity")' },
        { name: 'lang', type: 'string', required: false, desc: 'Language code (default "en")' },
      ] },
    { name: 'get_etymology', display: 'Get word origin/etymology', cost: 2, params: 'word',
      inputs: [
        { name: 'word', type: 'string', required: true, desc: 'Word to look up' },
      ] },
    { name: 'get_phonetics', display: 'Get word phonetics/pronunciation', cost: 1, params: 'word',
      inputs: [
        { name: 'word', type: 'string', required: true, desc: 'Word to look up' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-etymology — Word Origin & Definition MCP Server
 * Wraps Free Dictionary API with SettleGrid billing.
 * Methods:
 *   get_definition(word, lang?) — Get definitions (1\u00A2)
 *   get_etymology(word)         — Get etymology (2\u00A2)
 *   get_phonetics(word)         — Get phonetics (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface WordInput {
  word: string
  lang?: string
}

interface SimpleWordInput {
  word: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries'

async function apiFetch<T>(lang: string, word: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}/\${lang}/\${encodeURIComponent(word)}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-etymology/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Dictionary API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'etymology',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_definition: { costCents: 1, displayName: 'Get word definitions' },
      get_etymology: { costCents: 2, displayName: 'Get word etymology' },
      get_phonetics: { costCents: 1, displayName: 'Get word phonetics' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getDefinition = sg.wrap(async (args: WordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const lang = args.lang || 'en'
  return apiFetch<unknown>(lang, args.word)
}, { method: 'get_definition' })

const getEtymology = sg.wrap(async (args: SimpleWordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const data = await apiFetch<Array<{ origin?: string; meanings?: unknown[] }>>('en', args.word)
  return {
    word: args.word,
    origin: data[0]?.origin || 'Etymology not available',
    meanings: data[0]?.meanings || [],
  }
}, { method: 'get_etymology' })

const getPhonetics = sg.wrap(async (args: SimpleWordInput) => {
  if (!args.word || typeof args.word !== 'string') {
    throw new Error('word is required')
  }
  const data = await apiFetch<Array<{ phonetics?: Array<{ text?: string; audio?: string }> }>>('en', args.word)
  return {
    word: args.word,
    phonetics: data[0]?.phonetics || [],
  }
}, { method: 'get_phonetics' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getDefinition, getEtymology, getPhonetics }

console.log('settlegrid-etymology MCP server ready')
console.log('Methods: get_definition, get_etymology, get_phonetics')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 107. settlegrid-census-historical
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'census-historical',
  title: 'Historical Census Data',
  desc: 'Access US Census Bureau historical data. Query census datasets, list available surveys, and explore variables.',
  api: { base: 'https://api.census.gov/data', name: 'US Census API', docs: 'https://www.census.gov/data/developers.html' },
  key: null,
  keywords: ['census', 'demographics', 'population', 'statistics', 'us-government'],
  methods: [
    { name: 'get_data', display: 'Get census data by year and variables', cost: 2, params: 'year, variables, state?',
      inputs: [
        { name: 'year', type: 'string', required: true, desc: 'Census year (e.g. "2020", "2010")' },
        { name: 'variables', type: 'string', required: true, desc: 'Comma-separated variable codes (e.g. "NAME,P1_001N")' },
        { name: 'state', type: 'string', required: false, desc: 'State FIPS code (e.g. "06" for California)' },
      ] },
    { name: 'list_datasets', display: 'List available census datasets', cost: 1, params: '',
      inputs: [] },
    { name: 'list_variables', display: 'List variables for a dataset', cost: 1, params: 'dataset',
      inputs: [
        { name: 'dataset', type: 'string', required: true, desc: 'Dataset path (e.g. "2020/dec/pl")' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-census-historical — Historical Census Data MCP Server
 * Wraps US Census API with SettleGrid billing.
 * Methods:
 *   get_data(year, variables, state?) — Get census data (2\u00A2)
 *   list_datasets()                   — List datasets (1\u00A2)
 *   list_variables(dataset)           — List variables (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DataInput {
  year: string
  variables: string
  state?: string
}

interface VariableInput {
  dataset: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.census.gov/data'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-census-historical/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Census API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'census-historical',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_data: { costCents: 2, displayName: 'Get census data' },
      list_datasets: { costCents: 1, displayName: 'List datasets' },
      list_variables: { costCents: 1, displayName: 'List variables' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getData = sg.wrap(async (args: DataInput) => {
  if (!args.year || typeof args.year !== 'string') {
    throw new Error('year is required (e.g. "2020")')
  }
  if (!args.variables || typeof args.variables !== 'string') {
    throw new Error('variables is required (e.g. "NAME,P1_001N")')
  }
  const params: Record<string, string> = {
    get: args.variables,
    'for': args.state ? \`county:*&in=state:\${args.state}\` : 'state:*',
  }
  return apiFetch<unknown>(\`\${args.year}/dec/pl\`, params)
}, { method: 'get_data' })

const listDatasets = sg.wrap(async () => {
  return apiFetch<unknown>('.json')
}, { method: 'list_datasets' })

const listVariables = sg.wrap(async (args: VariableInput) => {
  if (!args.dataset || typeof args.dataset !== 'string') {
    throw new Error('dataset is required (e.g. "2020/dec/pl")')
  }
  return apiFetch<unknown>(\`\${args.dataset}/variables.json\`)
}, { method: 'list_variables' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getData, listDatasets, listVariables }

console.log('settlegrid-census-historical MCP server ready')
console.log('Methods: get_data, list_datasets, list_variables')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 108. settlegrid-historical-events
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'historical-events',
  title: 'Historical Event Timeline',
  desc: 'Access historical events via Wikimedia On This Day API. Get events, births, and deaths by date.',
  api: { base: 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday', name: 'Wikimedia On This Day', docs: 'https://api.wikimedia.org/wiki/Feed_API' },
  key: null,
  keywords: ['history', 'events', 'timeline', 'wikimedia', 'on-this-day'],
  methods: [
    { name: 'get_events', display: 'Get historical events on a date', cost: 1, params: 'month, day, type?',
      inputs: [
        { name: 'month', type: 'number', required: true, desc: 'Month (1-12)' },
        { name: 'day', type: 'number', required: true, desc: 'Day (1-31)' },
        { name: 'type', type: 'string', required: false, desc: 'Event type: selected, events, holidays (default: selected)' },
      ] },
    { name: 'get_births', display: 'Get notable births on a date', cost: 1, params: 'month, day',
      inputs: [
        { name: 'month', type: 'number', required: true, desc: 'Month (1-12)' },
        { name: 'day', type: 'number', required: true, desc: 'Day (1-31)' },
      ] },
    { name: 'get_deaths', display: 'Get notable deaths on a date', cost: 1, params: 'month, day',
      inputs: [
        { name: 'month', type: 'number', required: true, desc: 'Month (1-12)' },
        { name: 'day', type: 'number', required: true, desc: 'Day (1-31)' },
      ] },
  ],
  serverTs: `/**
 * settlegrid-historical-events — Historical Event Timeline MCP Server
 * Wraps Wikimedia On This Day API with SettleGrid billing.
 * Methods:
 *   get_events(month, day, type?) — Get events (1\u00A2)
 *   get_births(month, day)        — Get births (1\u00A2)
 *   get_deaths(month, day)        — Get deaths (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EventInput {
  month: number
  day: number
  type?: string
}

interface DateInput {
  month: number
  day: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday'

async function apiFetch<T>(type: string, month: number, day: number): Promise<T> {
  const res = await fetch(\`\${API_BASE}/\${type}/\${month}/\${day}\`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-historical-events/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Wikimedia API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateDate(month: number, day: number): void {
  if (typeof month !== 'number' || month < 1 || month > 12) {
    throw new Error('month must be 1-12')
  }
  if (typeof day !== 'number' || day < 1 || day > 31) {
    throw new Error('day must be 1-31')
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'historical-events',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_events: { costCents: 1, displayName: 'Get historical events' },
      get_births: { costCents: 1, displayName: 'Get notable births' },
      get_deaths: { costCents: 1, displayName: 'Get notable deaths' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getEvents = sg.wrap(async (args: EventInput) => {
  validateDate(args.month, args.day)
  const type = args.type || 'selected'
  return apiFetch<unknown>(type, args.month, args.day)
}, { method: 'get_events' })

const getBirths = sg.wrap(async (args: DateInput) => {
  validateDate(args.month, args.day)
  return apiFetch<unknown>('births', args.month, args.day)
}, { method: 'get_births' })

const getDeaths = sg.wrap(async (args: DateInput) => {
  validateDate(args.month, args.day)
  return apiFetch<unknown>('deaths', args.month, args.day)
}, { method: 'get_deaths' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getEvents, getBirths, getDeaths }

console.log('settlegrid-historical-events MCP server ready')
console.log('Methods: get_events, get_births, get_deaths')
console.log('Pricing: 1\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 109. settlegrid-war-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'war-data',
  title: 'Conflict & War Data',
  desc: 'Access armed conflict data via UCDP API (Uppsala Conflict Data Program). Get conflicts, battle deaths, and country data.',
  api: { base: 'https://ucdpapi.pcr.uu.se/api', name: 'UCDP API', docs: 'https://ucdp.uu.se/apidocs/' },
  key: null,
  keywords: ['conflict', 'war', 'ucdp', 'geopolitical', 'peace-research', 'violence'],
  methods: [
    { name: 'get_conflicts', display: 'Get armed conflicts', cost: 1, params: 'country?, year?',
      inputs: [
        { name: 'country', type: 'string', required: false, desc: 'Country name (e.g. "Syria", "Ukraine")' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. "2023")' },
      ] },
    { name: 'get_battle_deaths', display: 'Get battle-related deaths', cost: 2, params: 'conflict_id',
      inputs: [
        { name: 'conflict_id', type: 'string', required: true, desc: 'UCDP conflict ID' },
      ] },
    { name: 'list_countries', display: 'List countries with conflict data', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-war-data — Conflict & War Data MCP Server
 * Wraps UCDP API with SettleGrid billing.
 * Methods:
 *   get_conflicts(country?, year?)  — Get conflicts (1\u00A2)
 *   get_battle_deaths(conflict_id)  — Get battle deaths (2\u00A2)
 *   list_countries()                — List countries (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConflictInput {
  country?: string
  year?: string
}

interface DeathsInput {
  conflict_id: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://ucdpapi.pcr.uu.se/api'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('pagesize', '20')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-war-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`UCDP API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'war-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_conflicts: { costCents: 1, displayName: 'Get armed conflicts' },
      get_battle_deaths: { costCents: 2, displayName: 'Get battle deaths' },
      list_countries: { costCents: 1, displayName: 'List countries' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getConflicts = sg.wrap(async (args: ConflictInput) => {
  const params: Record<string, string> = {}
  if (args.country) params.country = args.country
  if (args.year) params.year = args.year
  return apiFetch<unknown>('ucdpprioconflict/23.1', params)
}, { method: 'get_conflicts' })

const getBattleDeaths = sg.wrap(async (args: DeathsInput) => {
  if (!args.conflict_id || typeof args.conflict_id !== 'string') {
    throw new Error('conflict_id is required')
  }
  return apiFetch<unknown>(\`battledeaths/23.1/\${encodeURIComponent(args.conflict_id)}\`)
}, { method: 'get_battle_deaths' })

const listCountries = sg.wrap(async () => {
  return apiFetch<unknown>('ucdpprioconflict/23.1', {
    pagesize: '50',
  })
}, { method: 'list_countries' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getConflicts, getBattleDeaths, listCountries }

console.log('settlegrid-war-data MCP server ready')
console.log('Methods: get_conflicts, get_battle_deaths, list_countries')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

// ──────────────────────────────────────────────────────────────────────────────
// 110. settlegrid-migration-data
// ──────────────────────────────────────────────────────────────────────────────
gen({
  slug: 'migration-data',
  title: 'Migration Statistics',
  desc: 'Access migration and remittance data via World Bank API. Get migration stocks, remittance flows, and browse indicators.',
  api: { base: 'https://api.worldbank.org/v2', name: 'World Bank API', docs: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation' },
  key: null,
  keywords: ['migration', 'remittances', 'world-bank', 'demographics', 'immigration'],
  methods: [
    { name: 'get_migration', display: 'Get migration data for a country', cost: 1, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO2 country code (e.g. US, MX, DE)' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. "2020"). Defaults to latest.' },
      ] },
    { name: 'get_remittances', display: 'Get remittance data for a country', cost: 2, params: 'country, year?',
      inputs: [
        { name: 'country', type: 'string', required: true, desc: 'ISO2 country code' },
        { name: 'year', type: 'string', required: false, desc: 'Year (e.g. "2020")' },
      ] },
    { name: 'list_indicators', display: 'List migration-related indicators', cost: 1, params: '',
      inputs: [] },
  ],
  serverTs: `/**
 * settlegrid-migration-data — Migration Statistics MCP Server
 * Wraps World Bank API with SettleGrid billing.
 * Methods:
 *   get_migration(country, year?)    — Get migration data (1\u00A2)
 *   get_remittances(country, year?)  — Get remittances (2\u00A2)
 *   list_indicators()                — List indicators (1\u00A2)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MigrationInput {
  country: string
  year?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.worldbank.org/v2'

async function apiFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(\`\${API_BASE}/\${path}\`)
  url.searchParams.set('format', 'json')
  url.searchParams.set('per_page', '50')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-migration-data/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`World Bank API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'migration-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_migration: { costCents: 1, displayName: 'Get migration data' },
      get_remittances: { costCents: 2, displayName: 'Get remittance data' },
      list_indicators: { costCents: 1, displayName: 'List indicators' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getMigration = sg.wrap(async (args: MigrationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required (ISO2 code)')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`country/\${args.country.toUpperCase()}/indicator/SM.POP.NETM\`, params)
}, { method: 'get_migration' })

const getRemittances = sg.wrap(async (args: MigrationInput) => {
  if (!args.country || typeof args.country !== 'string') {
    throw new Error('country is required')
  }
  const params: Record<string, string> = {}
  if (args.year) params.date = args.year
  return apiFetch<unknown>(\`country/\${args.country.toUpperCase()}/indicator/BX.TRF.PWKR.CD.DT\`, params)
}, { method: 'get_remittances' })

const listIndicators = sg.wrap(async () => {
  return {
    indicators: [
      { id: 'SM.POP.NETM', name: 'Net migration' },
      { id: 'SM.POP.TOTL', name: 'International migrant stock (total)' },
      { id: 'SM.POP.TOTL.ZS', name: 'International migrant stock (% of population)' },
      { id: 'SM.POP.REFG', name: 'Refugee population by country of asylum' },
      { id: 'SM.POP.REFG.OR', name: 'Refugee population by country of origin' },
      { id: 'BX.TRF.PWKR.CD.DT', name: 'Personal remittances received (current US$)' },
      { id: 'BX.TRF.PWKR.DT.GD.ZS', name: 'Personal remittances received (% of GDP)' },
      { id: 'BM.TRF.PWKR.CD.DT', name: 'Personal remittances paid (current US$)' },
    ],
  }
}, { method: 'list_indicators' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getMigration, getRemittances, listIndicators }

console.log('settlegrid-migration-data MCP server ready')
console.log('Methods: get_migration, get_remittances, list_indicators')
console.log('Pricing: 1-2\u00A2 per call | Powered by SettleGrid')
`,
})

console.log('\n✅ Batch 3c complete: 40 servers generated (#71-#110)')
