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

  // PyPI doesn't have a search API — fetch the simple index once and
  // scan for matching package names across all search terms.
  let indexText: string
  try {
    const res = await fetchWithRetry('https://pypi.org/simple/')
    indexText = await res.text()
  } catch {
    return
  }

  // Parse all package names from the simple index (fetched once)
  const allPackages: string[] = []
  const packageRe = /href="\/simple\/([^/]+)\//g
  let reMatch: RegExpExecArray | null
  while ((reMatch = packageRe.exec(indexText)) !== null) {
    allPackages.push(reMatch[1])
  }

  // Collect candidates matching any search term
  const candidates: string[] = []
  const candidateSet = new Set<string>()
  for (const pkg of allPackages) {
    if (candidateSet.has(pkg)) continue
    for (const term of SEARCH_TERMS) {
      if (pkg.includes(term) || pkg.startsWith('mcp-')) {
        candidates.push(pkg)
        candidateSet.add(pkg)
        break
      }
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
