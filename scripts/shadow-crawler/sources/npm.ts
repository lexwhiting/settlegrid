import { fetchJson } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

interface NpmSearchResult {
  objects: {
    package: {
      name: string
      description?: string
      keywords?: string[]
      links?: { repository?: string; npm?: string }
      publisher?: { username?: string }
      date?: string
    }
  }[]
  total: number
}

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

export async function* fetchNpm(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity
  const queries = ['mcp server', '@modelcontextprotocol']
  const seen = new Set<string>()

  for (const query of queries) {
    let from = 0
    const size = 250

    while (count < limit) {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${size}&from=${from}`
      const data = await fetchJson<NpmSearchResult>(url)

      if (data.objects.length === 0) break

      for (const obj of data.objects) {
        if (count >= limit) return
        const pkg = obj.package
        const repoUrl = pkg.links?.repository
        const parsed = repoUrl ? parseRepoUrl(repoUrl) : null

        const owner = parsed?.owner ?? pkg.publisher?.username ?? 'unknown'
        const repo = parsed?.repo ?? pkg.name

        const key = `${owner}/${repo}`
        if (seen.has(key)) continue
        seen.add(key)

        yield {
          source: 'npm',
          owner,
          repo,
          name: pkg.name,
          description: pkg.description,
          tags: pkg.keywords,
          lastUpdated: pkg.date ? new Date(pkg.date) : undefined,
          sourceUrl: pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`,
        }
        count++
      }

      if (data.objects.length < size) break
      from += size

      // Rate limit: 10 req/s cap
      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
