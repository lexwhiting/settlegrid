#!/usr/bin/env npx tsx
/**
 * extract-mcp-developers.ts
 *
 * Finds MCP server developers on GitHub and extracts contact info.
 * Searches for repos using @modelcontextprotocol/sdk, plus repos
 * with topic "mcp" or "mcp-server". Deduplicates by email, outputs CSV.
 *
 * Usage:
 *   npx tsx scripts/extract-mcp-developers.ts
 *   npx tsx scripts/extract-mcp-developers.ts --limit 50
 *   npx tsx scripts/extract-mcp-developers.ts --dry-run
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const OUTPUT_DIR = join(ROOT, 'scripts', 'output')
const OUTPUT_FILE = join(OUTPUT_DIR, 'mcp-developers.csv')

// ── Types ───────────────────────────────────────────────────────────────────

interface GitHubRepo {
  full_name: string
  name: string
  html_url: string
  stargazers_count: number
  owner: {
    login: string
    type: string
  }
}

interface GitHubUser {
  login: string
  name: string | null
  email: string | null
  bio: string | null
  company: string | null
  blog: string | null
  location: string | null
}

interface GitHubCommit {
  commit: {
    author: {
      name: string
      email: string
    }
    committer: {
      name: string
      email: string
    }
  }
}

interface DeveloperRecord {
  name: string
  email: string
  github_username: string
  repo_name: string
  repo_stars: number
  repo_url: string
  bio: string
  company: string
}

// ── CLI arg parsing ─────────────────────────────────────────────────────────

function parseArgs(): { limit: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  let limit = 500
  let dryRun = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10)
      if (isNaN(limit) || limit < 1) {
        console.error('Error: --limit must be a positive integer')
        process.exit(1)
      }
      i++
    } else if (args[i] === '--dry-run') {
      dryRun = true
    }
  }

  return { limit, dryRun }
}

// ── GitHub API helpers ──────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const API_BASE = 'https://api.github.com'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'settlegrid-mcp-extractor',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`
  }
  return headers
}

async function checkRateLimit(response: Response): Promise<void> {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '999', 10)
  const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10)

  if (remaining <= 5) {
    const now = Math.floor(Date.now() / 1000)
    const waitSeconds = Math.max(resetAt - now + 1, 1)
    console.log(`  Rate limit nearly exhausted (${remaining} remaining). Sleeping ${waitSeconds}s...`)
    await sleep(waitSeconds * 1000)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function githubFetch<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: authHeaders() })
    await checkRateLimit(response)

    if (response.status === 403) {
      const resetAt = parseInt(response.headers.get('X-RateLimit-Reset') || '0', 10)
      const now = Math.floor(Date.now() / 1000)
      const waitSeconds = Math.max(resetAt - now + 1, 60)
      console.log(`  Rate limited (403). Sleeping ${waitSeconds}s...`)
      await sleep(waitSeconds * 1000)
      // Retry once
      const retry = await fetch(url, { headers: authHeaders() })
      if (!retry.ok) return null
      return (await retry.json()) as T
    }

    if (!response.ok) {
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    return null
  }
}

// ── Search queries ──────────────────────────────────────────────────────────

async function searchRepos(query: string, perPage: number, maxPages: number): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = []

  for (let page = 1; page <= maxPages; page++) {
    const url = `${API_BASE}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}&page=${page}`
    const data = await githubFetch<{ items: GitHubRepo[]; total_count: number }>(url)

    if (!data || !data.items || data.items.length === 0) break
    repos.push(...data.items)

    // GitHub search API returns max 1000 results
    if (repos.length >= data.total_count || repos.length >= 1000) break

    // Small delay between pages to be polite
    await sleep(200)
  }

  return repos
}

async function collectRepos(limit: number): Promise<GitHubRepo[]> {
  console.log('Searching for MCP server repositories...')

  // Three search strategies
  const queries = [
    '@modelcontextprotocol/sdk in:file filename:package.json',
    'topic:mcp-server',
    'topic:mcp',
  ]

  const seen = new Set<string>()
  const allRepos: GitHubRepo[] = []

  for (const query of queries) {
    console.log(`  Query: "${query}"`)
    const pagesNeeded = Math.ceil(limit / 30)
    const repos = await searchRepos(query, 30, Math.min(pagesNeeded, 34))
    console.log(`    Found ${repos.length} repos`)

    for (const repo of repos) {
      const key = repo.full_name.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        allRepos.push(repo)
      }
    }

    if (allRepos.length >= limit) break
    await sleep(500) // Pause between different search queries
  }

  // Sort by stars descending, then trim to limit
  allRepos.sort((a, b) => b.stargazers_count - a.stargazers_count)
  return allRepos.slice(0, limit)
}

// ── Email extraction ────────────────────────────────────────────────────────

const NOREPLY_PATTERNS = [
  'noreply@github.com',
  'users.noreply.github.com',
  'noreply',
]

function isNoReplyEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return NOREPLY_PATTERNS.some((pattern) => lower.includes(pattern))
}

function isValidEmail(email: string): boolean {
  if (!email || email.length < 5) return false
  if (isNoReplyEmail(email)) return false
  // Basic format check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function getUserProfile(username: string): Promise<GitHubUser | null> {
  return githubFetch<GitHubUser>(`${API_BASE}/users/${encodeURIComponent(username)}`)
}

async function getCommitEmails(repoFullName: string): Promise<Array<{ name: string; email: string }>> {
  const commits = await githubFetch<GitHubCommit[]>(
    `${API_BASE}/repos/${repoFullName}/commits?per_page=5`,
  )

  if (!commits || !Array.isArray(commits)) return []

  const emails: Array<{ name: string; email: string }> = []

  for (const commit of commits) {
    const authorEmail = commit.commit?.author?.email
    const authorName = commit.commit?.author?.name
    if (authorEmail && isValidEmail(authorEmail)) {
      emails.push({ name: authorName || '', email: authorEmail })
    }

    const committerEmail = commit.commit?.committer?.email
    const committerName = commit.commit?.committer?.name
    if (
      committerEmail &&
      isValidEmail(committerEmail) &&
      committerEmail !== authorEmail
    ) {
      emails.push({ name: committerName || '', email: committerEmail })
    }
  }

  return emails
}

// ── CSV escaping ────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (!value) return ''
  // If the value contains commas, quotes, or newlines, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()

  if (!GITHUB_TOKEN) {
    console.warn('WARNING: No GITHUB_TOKEN set. Rate limits will be very low (60 req/hr).')
    console.warn('Set GITHUB_TOKEN env var for 5,000 req/hr.\n')
  }

  console.log(`Settings: limit=${limit}, dryRun=${dryRun}\n`)

  // 1. Collect repos
  const repos = await collectRepos(limit)
  console.log(`\nCollected ${repos.length} unique repos to process.\n`)

  if (dryRun) {
    console.log('DRY RUN: Would process these repos:')
    for (const repo of repos.slice(0, 20)) {
      console.log(`  ${repo.full_name} (${repo.stargazers_count} stars)`)
    }
    if (repos.length > 20) {
      console.log(`  ... and ${repos.length - 20} more`)
    }
    return
  }

  // 2. Extract emails from each repo
  const emailMap = new Map<string, DeveloperRecord>()
  let processed = 0

  for (const repo of repos) {
    processed++

    // Skip bot/org owners that are unlikely to be individual developers
    if (repo.owner.type === 'Organization') {
      // Still check commits for individual contributors
    }

    // Get owner profile
    const profile = await getUserProfile(repo.owner.login)
    if (profile?.email && isValidEmail(profile.email)) {
      const key = profile.email.toLowerCase()
      if (!emailMap.has(key)) {
        emailMap.set(key, {
          name: profile.name || profile.login,
          email: profile.email,
          github_username: profile.login,
          repo_name: repo.name,
          repo_stars: repo.stargazers_count,
          repo_url: repo.html_url,
          bio: (profile.bio || '').replace(/[\n\r]+/g, ' ').trim(),
          company: (profile.company || '').trim(),
        })
      }
    }

    // Get committer emails
    const commitEmails = await getCommitEmails(repo.full_name)
    for (const { name, email } of commitEmails) {
      const key = email.toLowerCase()
      if (!emailMap.has(key)) {
        emailMap.set(key, {
          name: name || profile?.name || '',
          email,
          github_username: repo.owner.login,
          repo_name: repo.name,
          repo_stars: repo.stargazers_count,
          repo_url: repo.html_url,
          bio: (profile?.bio || '').replace(/[\n\r]+/g, ' ').trim(),
          company: (profile?.company || '').trim(),
        })
      }
    }

    // Progress logging every 10 repos
    if (processed % 10 === 0 || processed === repos.length) {
      console.log(`Processed ${processed}/${repos.length} repos, found ${emailMap.size} unique emails`)
    }

    // Small delay to be polite
    await sleep(150)
  }

  // 3. Write CSV
  const header = 'name,email,github_username,repo_name,repo_stars,repo_url,bio,company'
  const rows = Array.from(emailMap.values()).map((d) =>
    [
      csvEscape(d.name),
      csvEscape(d.email),
      csvEscape(d.github_username),
      csvEscape(d.repo_name),
      d.repo_stars.toString(),
      csvEscape(d.repo_url),
      csvEscape(d.bio),
      csvEscape(d.company),
    ].join(','),
  )

  const csv = [header, ...rows].join('\n') + '\n'

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_FILE, csv, 'utf-8')

  console.log(`\nDone! Wrote ${emailMap.size} developers to ${OUTPUT_FILE}`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
