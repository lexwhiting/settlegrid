import { settlegrid } from "@settlegrid/mcp"
const sg = settlegrid.init({ toolSlug: "genome-browser", pricing: { defaultCostCents: 3, methods: {
  search_genes: { costCents: 3, displayName: "Search Genes" },
  get_gene: { costCents: 3, displayName: "Get Gene Info" },
}}})
const ENSEMBL = "https://rest.ensembl.org"
const searchGenes = sg.wrap(async (args: { query: string; species?: string }) => {
  if (!args.query) throw new Error("query is required")
  const species = args.species ?? "homo_sapiens"
  const res = await fetch(`${ENSEMBL}/xrefs/symbol/${species}/${encodeURIComponent(args.query)}?content-type=application/json`)
  if (!res.ok) throw new Error(`Ensembl API ${res.status}`)
  const data = await res.json()
  return { query: args.query, species, count: data.length, genes: (Array.isArray(data) ? data : []).slice(0, 10).map((g: any) => ({ id: g.id, type: g.type })) }
}, { method: "search_genes" })
const getGene = sg.wrap(async (args: { gene_id: string }) => {
  if (!args.gene_id) throw new Error("gene_id is required (e.g. ENSG00000141510)")
  const res = await fetch(`${ENSEMBL}/lookup/id/${args.gene_id}?content-type=application/json;expand=1`)
  if (!res.ok) throw new Error(`Ensembl API ${res.status}`)
  const g = await res.json()
  return { id: g.id, display_name: g.display_name, description: g.description, biotype: g.biotype, species: g.species, chromosome: g.seq_region_name, start: g.start, end: g.end, strand: g.strand }
}, { method: "get_gene" })
export { searchGenes, getGene }
console.log("settlegrid-genome-browser MCP server ready | 3c/call | Powered by SettleGrid")
