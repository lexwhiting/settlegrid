/**
 * settlegrid-changelog-parser — Changelog / Release Notes MCP Server
 *
 * Fetch and parse changelogs and release notes from GitHub. No API key needed.
 *
 * Methods:
 *   get_releases(owner, repo, limit?) — GitHub releases (1¢)
 *   get_latest_release(owner, repo) — Latest release info (1¢)
 *   get_changelog(owner, repo) — Parse CHANGELOG.md from repo (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface ReleasesInput { owner: string; repo: string; limit?: number }
interface LatestInput { owner: string; repo: string }
interface ChangelogInput { owner: string; repo: string }

const GH_API = 'https://api.github.com'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'settlegrid-changelog-parser/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function parseChangelogSections(content: string): Array<{ version: string; date: string; changes: string }> {
  const sections: Array<{ version: string; date: string; changes: string }> = []
  const lines = content.split('\n')
  let current: { version: string; date: string; changes: string[] } | null = null
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+\[?v?([\d.]+(?:-[\w.]+)?)\]?(?:\s*[-–—]\s*(.+))?/)
    if (match) {
      if (current) sections.push({ ...current, changes: current.changes.join('\n').trim() })
      current = { version: match[1], date: match[2]?.trim() || '', changes: [] }
    } else if (current) {
      current.changes.push(line)
    }
  }
  if (current) sections.push({ ...current, changes: current.changes.join('\n').trim() })
  return sections.slice(0, 20)
}

const sg = settlegrid.init({
  toolSlug: 'changelog-parser',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_releases: { costCents: 1, displayName: 'GitHub Releases' },
      get_latest_release: { costCents: 1, displayName: 'Latest Release' },
      get_changelog: { costCents: 1, displayName: 'Parse Changelog' },
    },
  },
})

const getReleases = sg.wrap(async (args: ReleasesInput) => {
  if (!args.owner || !args.repo) throw new Error('owner and repo required')
  const limit = Math.min(args.limit || 10, 30)
  const data = await apiFetch<any[]>(`${GH_API}/repos/${args.owner}/${args.repo}/releases?per_page=${limit}`)
  return data.map((r: any) => ({
    tag: r.tag_name, name: r.name, published: r.published_at, prerelease: r.prerelease,
    body: r.body?.slice(0, 1000) || '',
  }))
}, { method: 'get_releases' })

const getLatestRelease = sg.wrap(async (args: LatestInput) => {
  if (!args.owner || !args.repo) throw new Error('owner and repo required')
  const data = await apiFetch<any>(`${GH_API}/repos/${args.owner}/${args.repo}/releases/latest`)
  return {
    tag: data.tag_name, name: data.name, published: data.published_at,
    body: data.body?.slice(0, 2000) || '', assets: data.assets?.length || 0,
  }
}, { method: 'get_latest_release' })

const getChangelog = sg.wrap(async (args: ChangelogInput) => {
  if (!args.owner || !args.repo) throw new Error('owner and repo required')
  const files = ['CHANGELOG.md', 'CHANGES.md', 'HISTORY.md', 'changelog.md']
  for (const f of files) {
    try {
      const data = await apiFetch<any>(`${GH_API}/repos/${args.owner}/${args.repo}/contents/${f}`)
      const content = Buffer.from(data.content, 'base64').toString('utf-8')
      return { file: f, sections: parseChangelogSections(content) }
    } catch { continue }
  }
  throw new Error('No changelog found (tried CHANGELOG.md, CHANGES.md, HISTORY.md)')
}, { method: 'get_changelog' })

export { getReleases, getLatestRelease, getChangelog }

console.log('settlegrid-changelog-parser MCP server ready')
console.log('Methods: get_releases, get_latest_release, get_changelog')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
