import { fetchJson } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

interface SmitheryServer {
  qualifiedName?: string
  displayName?: string
  description?: string
  homepage?: string
  tags?: string[]
}

interface SmitheryResponse {
  servers?: SmitheryServer[]
  nextCursor?: string
}

export async function* fetchSmithery(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity
  let cursor: string | undefined

  do {
    const url = cursor
      ? `https://registry.smithery.ai/servers?cursor=${encodeURIComponent(cursor)}`
      : 'https://registry.smithery.ai/servers'

    const data = await fetchJson<SmitheryResponse>(url)
    const servers = data.servers ?? []

    for (const s of servers) {
      if (count >= limit) return
      if (!s.qualifiedName) continue

      // qualifiedName is typically "owner/repo" format
      const parts = s.qualifiedName.split('/')
      const owner = parts.length >= 2 ? parts[0] : 'unknown'
      const repo = parts.length >= 2 ? parts.slice(1).join('/') : s.qualifiedName

      yield {
        source: 'smithery',
        owner,
        repo,
        name: s.displayName ?? s.qualifiedName,
        description: s.description,
        tags: s.tags,
        sourceUrl: s.homepage ?? `https://smithery.ai/server/${s.qualifiedName}`,
      }
      count++
    }

    cursor = data.nextCursor
  } while (cursor && count < limit)
}
