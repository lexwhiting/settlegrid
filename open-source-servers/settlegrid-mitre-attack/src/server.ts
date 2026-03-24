/**
 * settlegrid-mitre-attack — MITRE ATT&CK MCP Server
 *
 * Wraps MITRE ATT&CK STIX data with SettleGrid billing.
 * No API key needed — open data from GitHub.
 *
 * Methods:
 *   search_techniques(query) — search techniques (1¢)
 *   get_technique(technique_id) — technique details (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface SearchInput { query: string }
interface TechInput { technique_id: string }

const API_BASE = 'https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack'

let cachedData: any = null

async function loadData() {
  if (cachedData) return cachedData
  const res = await fetch(`${API_BASE}/enterprise-attack.json`)
  if (!res.ok) throw new Error(`Failed to load ATT&CK data: ${res.status}`)
  cachedData = await res.json()
  return cachedData
}

const sg = settlegrid.init({
  toolSlug: 'mitre-attack',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_techniques: { costCents: 1, displayName: 'Search Techniques' },
      get_technique: { costCents: 1, displayName: 'Get Technique' },
    },
  },
})

const searchTechniques = sg.wrap(async (args: SearchInput) => {
  if (!args.query) throw new Error('query is required')
  const data = await loadData()
  const q = args.query.toLowerCase()
  const techniques = (data.objects || [])
    .filter((o: any) => o.type === 'attack-pattern' && !o.revoked)
    .filter((o: any) => o.name?.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
    .slice(0, 20)
  return {
    results: techniques.map((t: any) => ({
      id: t.external_references?.find((r: any) => r.source_name === 'mitre-attack')?.external_id,
      name: t.name,
      description: t.description?.slice(0, 300),
      platforms: t.x_mitre_platforms,
      tactics: t.kill_chain_phases?.map((p: any) => p.phase_name),
    })),
  }
}, { method: 'search_techniques' })

const getTechnique = sg.wrap(async (args: TechInput) => {
  if (!args.technique_id) throw new Error('technique_id required')
  const data = await loadData()
  const tid = args.technique_id.toUpperCase()
  const tech = (data.objects || []).find((o: any) =>
    o.type === 'attack-pattern' &&
    o.external_references?.some((r: any) => r.external_id === tid)
  )
  if (!tech) throw new Error('Technique not found')
  return {
    id: tid, name: tech.name, description: tech.description?.slice(0, 1000),
    platforms: tech.x_mitre_platforms,
    tactics: tech.kill_chain_phases?.map((p: any) => p.phase_name),
    detection: tech.x_mitre_detection?.slice(0, 500),
    data_sources: tech.x_mitre_data_sources,
    url: `https://attack.mitre.org/techniques/${tid}/`,
  }
}, { method: 'get_technique' })

export { searchTechniques, getTechnique }

console.log('settlegrid-mitre-attack MCP server ready')
console.log('Methods: search_techniques, get_technique')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
