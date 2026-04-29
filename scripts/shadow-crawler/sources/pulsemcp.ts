import { fetchJson } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

interface PulseMCPServer {
  name?: string
  description?: string
  github_url?: string
  categories?: string[]
  tags?: string[]
}

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') }
}

export async function* fetchPulseMCP(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity

  const servers = await fetchJson<PulseMCPServer[]>(
    'https://www.pulsemcp.com/api/servers',
  )

  for (const s of servers) {
    if (count >= limit) return
    if (!s.github_url || !s.name) continue

    const parsed = parseGithubUrl(s.github_url)
    if (!parsed) continue

    yield {
      source: 'pulsemcp',
      owner: parsed.owner,
      repo: parsed.repo,
      name: s.name,
      description: s.description,
      category: s.categories?.[0],
      tags: s.tags,
      sourceUrl: s.github_url,
    }
    count++
  }
}
