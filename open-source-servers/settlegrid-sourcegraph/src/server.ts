/**
 * settlegrid-sourcegraph — Sourcegraph Code Search MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface SearchCodeInput {
  query: string
  display?: number
}

interface StreamMatch {
  type: string
  [key: string]: unknown
}

const BASE = 'https://sourcegraph.com'

function getToken(): string {
  const t = process.env.SOURCEGRAPH_TOKEN
  if (!t) throw new Error('SOURCEGRAPH_TOKEN environment variable is required. Get one at https://sourcegraph.com/user/settings/tokens')
  return t
}

async function fetchSearchStream(query: string, display: number, token: string): Promise<StreamMatch[]> {
  const params = new URLSearchParams({
    q: query,
    v: 'V3',
    display: String(display),
  })
  const url = `${BASE}/.api/search/stream?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'text/event-stream',
      'User-Agent': 'settlegrid-sourcegraph/1.0',
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Sourcegraph API error ${res.status}: ${body.slice(0, 200)}`)
  }
  const text = await res.text()
  const matches: StreamMatch[] = []
  const lines = text.split('\n')
  let eventType = ''
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      const raw = line.slice(5).trim()
      if (!raw || raw === 'null') continue
      try {
        const parsed = JSON.parse(raw)
        if (eventType === 'matches' && Array.isArray(parsed)) {
          for (const m of parsed) {
            matches.push(m as StreamMatch)
          }
        }
      } catch {
        // skip unparseable data lines
      }
    }
  }
  return matches
}

const sg = settlegrid.init({
  toolSlug: 'sourcegraph',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_code: { costCents: 2, displayName: 'Search Code' },
    },
  },
})

const searchCode = sg.wrap(async (args: SearchCodeInput) => {
  const token = getToken()
  const q = args.query?.trim()
  if (!q) throw new Error('query is required')
  const display = Math.min(args.display || 20, 50)

  const matches = await fetchSearchStream(q, display, token)

  const summarized = matches.slice(0, display).map((m) => {
    if (m.type === 'content') {
      const cm = m as {
        type: string
        path?: string
        repository?: string
        commit?: string
        lineMatches?: Array<{ lineNumber: number; line: string }>
        chunkMatches?: Array<{ contentStart: { line: number }; content: string }>
      }
      return {
        type: 'content',
        repository: cm.repository,
        path: cm.path,
        commit: cm.commit,
        lineMatches: (cm.lineMatches ?? []).slice(0, 5).map((lm) => ({
          line: lm.lineNumber,
          content: lm.line,
        })),
        chunkMatches: (cm.chunkMatches ?? []).slice(0, 3).map((ck) => ({
          startLine: ck.contentStart?.line,
          content: ck.content,
        })),
      }
    }
    if (m.type === 'repo') {
      const rm = m as { type: string; repository?: string; description?: string }
      return { type: 'repo', repository: rm.repository, description: rm.description }
    }
    if (m.type === 'symbol') {
      const sm = m as {
        type: string
        path?: string
        repository?: string
        symbols?: Array<{ name: string; kind: string; line: number }>
      }
      return {
        type: 'symbol',
        repository: sm.repository,
        path: sm.path,
        symbols: (sm.symbols ?? []).slice(0, 5),
      }
    }
    return m
  })

  return {
    query: q,
    totalMatches: matches.length,
    results: summarized,
  }
}, { method: 'search_code' })

export { searchCode }
console.log('settlegrid-sourcegraph MCP server ready')
console.log('Methods: search_code')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')