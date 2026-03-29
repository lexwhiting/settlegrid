/**
 * Developer Email Resolver
 *
 * Resolves a GitHub repository URL to the developer's email address.
 * Tries: (1) GitHub user profile email, (2) recent commit emails.
 * Filters out noreply@github.com and invalid addresses.
 *
 * Uses GITHUB_TOKEN env var if available; degrades gracefully without it
 * (subject to GitHub's 60 req/hr unauthenticated rate limit).
 */

import { getGitHubToken } from '@/lib/env'
import { logger } from '@/lib/logger'

// ─── Constants ──────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com'
const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-EmailResolver/1.0'
const MAX_COMMITS_TO_CHECK = 5

/** Patterns that indicate a noreply / bot email */
const NOREPLY_PATTERNS = [
  'noreply@github.com',
  'users.noreply.github.com',
  'noreply',
  'github-actions',
  'dependabot',
  '[bot]',
]

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResolvedDeveloper {
  email: string
  name: string | null
  githubUsername: string
}

interface GitHubUser {
  login: string
  name: string | null
  email: string | null
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

// ─── Validation ─────────────────────────────────────────────────────────────

function isNoReplyEmail(email: string): boolean {
  const lower = email.toLowerCase()
  return NOREPLY_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length < 5 || email.length > 254) return false
  if (isNoReplyEmail(email)) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ─── URL Parsing ────────────────────────────────────────────────────────────

/** Allowlist of valid GitHub hostnames to prevent SSRF */
const ALLOWED_HOSTS = new Set(['github.com', 'www.github.com'])

/**
 * Parse a GitHub URL into owner/repo. Returns null for invalid or non-GitHub URLs.
 * Validates against an allowlist of GitHub hostnames to prevent SSRF.
 */
export function parseGitHubRepoUrl(
  url: string
): { owner: string; repo: string } | null {
  if (!url || typeof url !== 'string') return null

  // Strip trailing slashes, .git suffix
  const cleaned = url.replace(/\/+$/, '').replace(/\.git$/, '')

  let parsed: URL
  try {
    parsed = new URL(cleaned)
  } catch {
    return null
  }

  // SSRF guard: only allow github.com
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return null
  }

  // Must be HTTPS
  if (parsed.protocol !== 'https:') {
    return null
  }

  // Extract owner/repo from path
  const segments = parsed.pathname
    .split('/')
    .filter((s) => s.length > 0)
    .slice(0, 2)

  if (segments.length < 2) return null

  const owner = segments[0]
  const repo = segments[1]

  // Validate segment characters and length (GitHub limits: owner max 39, repo max 100)
  const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/
  if (!SEGMENT_RE.test(owner) || !SEGMENT_RE.test(repo)) return null
  if (owner.length > 39 || repo.length > 100) return null

  return { owner, repo }
}

// ─── GitHub API ─────────────────────────────────────────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  }

  const token = getGitHubToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

async function githubFetch<T>(url: string): Promise<T | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: buildHeaders(),
    })

    if (!response.ok) {
      logger.warn('developer_email_resolver.fetch_failed', {
        url: url.replace(/\/\/.*@/, '//***@'), // redact any auth in URL
        status: response.status,
      })
      return null
    }

    return (await response.json()) as T
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('developer_email_resolver.fetch_error', {
      msg: isTimeout ? 'Request timed out' : 'Request failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Strategy 1: User Profile Email ─────────────────────────────────────────

async function getProfileEmail(
  owner: string
): Promise<{ email: string; name: string | null } | null> {
  const user = await githubFetch<GitHubUser>(
    `${GITHUB_API_BASE}/users/${encodeURIComponent(owner)}`
  )

  if (!user) return null

  if (user.email && isValidEmail(user.email)) {
    return { email: user.email, name: user.name }
  }

  return null
}

// ─── Strategy 2: Commit Emails ──────────────────────────────────────────────

async function getCommitEmail(
  owner: string,
  repo: string
): Promise<{ email: string; name: string } | null> {
  const commits = await githubFetch<GitHubCommit[]>(
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${MAX_COMMITS_TO_CHECK}`
  )

  if (!commits || !Array.isArray(commits)) return null

  for (const commit of commits) {
    const authorEmail = commit.commit?.author?.email
    const authorName = commit.commit?.author?.name

    if (authorEmail && isValidEmail(authorEmail)) {
      return { email: authorEmail, name: authorName || owner }
    }

    const committerEmail = commit.commit?.committer?.email
    const committerName = commit.commit?.committer?.name

    if (committerEmail && isValidEmail(committerEmail)) {
      return { email: committerEmail, name: committerName || owner }
    }
  }

  return null
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolves a GitHub repository URL to the developer's email and name.
 *
 * Strategy order:
 * 1. GitHub user profile email (GET /users/{owner})
 * 2. Email from recent commits (GET /repos/{owner}/{repo}/commits?per_page=5)
 *
 * Returns null if no valid email can be found.
 */
export async function resolveDeveloperEmail(
  repoUrl: string
): Promise<ResolvedDeveloper | null> {
  const parsed = parseGitHubRepoUrl(repoUrl)
  if (!parsed) {
    logger.info('developer_email_resolver.invalid_url', {
      url: repoUrl.slice(0, 200),
    })
    return null
  }

  const { owner, repo } = parsed

  // Strategy 1: Profile email
  const profile = await getProfileEmail(owner)
  if (profile) {
    logger.info('developer_email_resolver.resolved_via_profile', {
      owner,
      repo,
    })
    return {
      email: profile.email,
      name: profile.name,
      githubUsername: owner,
    }
  }

  // Strategy 2: Commit emails
  const commitResult = await getCommitEmail(owner, repo)
  if (commitResult) {
    logger.info('developer_email_resolver.resolved_via_commits', {
      owner,
      repo,
    })
    return {
      email: commitResult.email,
      name: commitResult.name,
      githubUsername: owner,
    }
  }

  logger.info('developer_email_resolver.no_email_found', { owner, repo })
  return null
}
