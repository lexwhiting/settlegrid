import { fetchWithRetry } from '../fetch-utils'
import type { ShadowRecord, FetchOptions } from '../types'

const README_URL =
  'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md'

// Matches markdown links like: - [Name](https://github.com/owner/repo) - Description
const ENTRY_RE =
  /^-\s+\[([^\]]+)\]\((https:\/\/github\.com\/([^/]+)\/([^/)]+))[^)]*\)\s*[-–—]\s*(.*)/

export async function* fetchAwesomeMCP(
  opts: FetchOptions = {},
): AsyncIterable<ShadowRecord> {
  let count = 0
  const limit = opts.limit ?? Infinity

  const res = await fetchWithRetry(README_URL)
  const text = await res.text()
  const lines = text.split('\n')

  let currentCategory = ''

  for (const line of lines) {
    if (count >= limit) return

    // Track headings for category
    const headingMatch = line.match(/^#{2,3}\s+(.+)/)
    if (headingMatch) {
      currentCategory = headingMatch[1].trim()
      continue
    }

    const match = line.match(ENTRY_RE)
    if (!match) continue

    const [, name, sourceUrl, owner, repo, description] = match

    yield {
      source: 'awesome-mcp',
      owner,
      repo: repo.replace(/\.git$/, ''),
      name,
      description: description.trim() || undefined,
      category: currentCategory || undefined,
      sourceUrl,
    }
    count++
  }
}
