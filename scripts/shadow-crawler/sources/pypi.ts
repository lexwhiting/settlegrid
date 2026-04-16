import { fetchJson, fetchWithRetry } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

interface PyPISearchResult {
  info: {
    name: string
    summary?: string
    home_page?: string
    project_urls?: Record<string, string>
    keywords?: string
    classifiers?: string[]
    author?: string
    version?: string
  }
}

const SEARCH_TERMS = ['mcp-server', 'mcp_server', 'model-context-protocol']

export async function* fetchPyPI(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity
  const seen = new Set<string>()

  // PyPI doesn't have a search API — use the simple index + known prefixes
  // Fall back to checking known packages by name pattern
  for (const term of SEARCH_TERMS) {
    if (count >= limit) break

    // Use PyPI's JSON API for packages matching the search term
    // We search by fetching the simple index page and filtering
    const url = `https://pypi.org/simple/`
    let indexText: string
    try {
      const res = await fetchWithRetry(url, {
        headers: { Accept: 'application/vnd.pypi.simple.v1+json' },
      })
      indexText = await res.text()
    } catch {
      continue
    }

    // Parse package names from the simple index
    const packageRe = /href="\/simple\/([^/]+)\//g
    let match: RegExpExecArray | null
    const candidates: string[] = []

    while ((match = packageRe.exec(indexText)) !== null) {
      const name = match[1]
      if (name.includes(term) || name.startsWith('mcp-')) {
        candidates.push(name)
      }
    }

    // Fetch details for each candidate
    for (const pkgName of candidates.slice(0, 50)) {
      if (count >= limit) return
      if (seen.has(pkgName)) continue
      seen.add(pkgName)

      try {
        const info = await fetchJson<PyPISearchResult>(
          `https://pypi.org/pypi/${pkgName}/json`,
        )
        const pkg = info.info

        const repoUrl =
          pkg.project_urls?.['Source'] ??
          pkg.project_urls?.['Repository'] ??
          pkg.project_urls?.['GitHub'] ??
          pkg.home_page

        let owner = pkg.author ?? 'unknown'
        let repo = pkgName

        if (repoUrl) {
          const ghMatch = repoUrl.match(
            /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
          )
          if (ghMatch) {
            owner = ghMatch[1]
            repo = ghMatch[2]
          }
        }

        yield {
          source: 'pypi',
          owner,
          repo,
          name: pkg.name,
          description: pkg.summary,
          tags: pkg.keywords?.split(/[,\s]+/).filter(Boolean),
          sourceUrl: `https://pypi.org/project/${pkgName}/`,
        }
        count++
      } catch {
        // Package detail fetch failed — skip
      }

      await new Promise((r) => setTimeout(r, 100))
    }
  }
}
