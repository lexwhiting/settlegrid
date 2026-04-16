import { fetchJson } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

interface GitHubSearchItem {
  full_name: string
  name: string
  owner: { login: string }
  description?: string | null
  stargazers_count: number
  updated_at: string
  html_url: string
  topics?: string[]
}

interface GitHubSearchResponse {
  total_count: number
  items: GitHubSearchItem[]
}

export async function* fetchGitHub(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity

  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'settlegrid-shadow-crawler',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let page = 1
  const perPage = 100

  while (count < limit) {
    const url = `https://api.github.com/search/repositories?q=topic:model-context-protocol&sort=stars&order=desc&per_page=${perPage}&page=${page}`

    const data = await fetchJson<GitHubSearchResponse>(url, { headers })

    if (data.items.length === 0) break

    for (const item of data.items) {
      if (count >= limit) return

      yield {
        source: 'github',
        owner: item.owner.login,
        repo: item.name,
        name: item.name,
        description: item.description ?? undefined,
        stars: item.stargazers_count,
        lastUpdated: new Date(item.updated_at),
        sourceUrl: item.html_url,
        tags: item.topics,
      }
      count++
    }

    // GitHub search API caps at 1000 results (10 pages of 100)
    if (data.items.length < perPage || page >= 10) break
    page++

    // Respect rate limits: ~10 req/min for search
    await new Promise((r) => setTimeout(r, 2000))
  }
}
