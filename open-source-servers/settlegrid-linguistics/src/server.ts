/**
 * settlegrid-linguistics — Language Data MCP Server
 * Wraps Glottolog with SettleGrid billing.
 * Methods:
 *   search_languages(query) — Search languages (1¢)
 *   get_language(id)        — Get language details (1¢)
 *   list_families()         — List families (2¢)
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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'settlegrid-linguistics/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Glottolog API ${res.status}: ${body.slice(0, 200)}`)
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
  return apiFetch<unknown>(`/glottolog.languoid?name=${encodeURIComponent(args.query)}&type=languages`)
}, { method: 'search_languages' })

const getLanguage = sg.wrap(async (args: LanguageInput) => {
  if (!args.id || typeof args.id !== 'string') {
    throw new Error('id is required (Glottocode)')
  }
  return apiFetch<unknown>(`/resource/languoid/id/${encodeURIComponent(args.id)}.json`)
}, { method: 'get_language' })

const listFamilies = sg.wrap(async () => {
  return apiFetch<unknown>('/glottolog.languoid?type=family&level=top')
}, { method: 'list_families' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchLanguages, getLanguage, listFamilies }

console.log('settlegrid-linguistics MCP server ready')
console.log('Methods: search_languages, get_language, list_families')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
