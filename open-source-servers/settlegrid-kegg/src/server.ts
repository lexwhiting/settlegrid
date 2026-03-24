/**
 * settlegrid-kegg — KEGG Pathway Database MCP Server
 * Wraps KEGG REST API with SettleGrid billing.
 * Methods:
 *   search_pathways(query) — Search pathways (1¢)
 *   get_pathway(id)        — Get pathway details (2¢)
 *   list_organisms()       — List organisms (1¢)
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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-kegg/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`KEGG API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.text()
}

function parseKeggList(text: string): Array<{ id: string; name: string }> {
  return text.trim().split('\n').filter(Boolean).map(line => {
    const [id, ...rest] = line.split('\t')
    return { id: id.trim(), name: rest.join('\t').trim() }
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
  const text = await apiFetchText(`/find/pathway/${encodeURIComponent(args.query)}`)
  return parseKeggList(text)
}, { method: 'search_pathways' })

const getPathway = sg.wrap(async (args: PathwayInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (e.g. hsa00010)')
  }
  const text = await apiFetchText(`/get/${encodeURIComponent(args.id)}`)
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
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
